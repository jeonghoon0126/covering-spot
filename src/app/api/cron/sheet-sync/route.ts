import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";
import { createBooking, updateBooking } from "@/lib/db";
import { sendBookingCreated, sendErrorAlert } from "@/lib/slack-notify";
import {
  DANGUN_SHEET_ID,
  SHEET_COL,
  getSheetsToken,
  readSheetValues,
  batchUpdateSheetCells,
  parseSheetDate,
  parseSheetPrice,
  normalizePhone,
} from "@/lib/google-sheets";
import type { Booking } from "@/types/booking";

export const dynamic = "force-dynamic";

const DISPATCH_DONE_STATUSES = new Set(["in_progress", "completed", "check_completed"]);
const PICKUP_DONE_STATUSES = new Set(["completed", "check_completed"]);

/**
 * 단건시트(신사업) ↔ Supabase 양방향 동기화 Cron
 * - Vercel Cron: 매일 UTC 01:00 (KST 10:00) 실행
 *
 * Sheet → Supabase:
 *   - 유효한 행(순번=숫자, 날짜 파싱 가능) 중 Supabase 미등록 건 → pending 예약 생성
 *   - 최종 정산금액=0인 기존 예약 → cancelled 처리
 *
 * Supabase → Sheet:
 *   - 배차완료(col O): 빈칸이고 Supabase status가 in_progress 이상이면 "완료" 업데이트
 *   - 수거완료(col P): 빈칸이고 Supabase status가 completed 이상이면 "완료" 업데이트
 *
 * 중복 체크 기준: customer_name + date (전화번호가 없는 행 존재)
 *
 * 필수 Vercel 환경변수:
 *   GOOGLE_SERVICE_ACCOUNT_JSON - 서비스 계정 JSON (google-sheets@covering-app-ccd23.iam.gserviceaccount.com)
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.warn("[sheet-sync] GOOGLE_SERVICE_ACCOUNT_JSON 미설정, 동기화 스킵");
    return NextResponse.json({ skipped: true, reason: "GOOGLE_SERVICE_ACCOUNT_JSON not set" });
  }

  try {
    const token = await getSheetsToken();
    const rows = await readSheetValues(DANGUN_SHEET_ID, "A1:R1000", token);
    if (rows.length < 2) return NextResponse.json({ created: 0, cancelled: 0, sheetUpdated: 0 });

    let created = 0;
    let cancelled = 0;
    const sheetUpdates: { range: string; value: string }[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const seqCell = (row[SHEET_COL.SEQ] ?? "").trim();
      const dateCell = (row[SHEET_COL.DATE] ?? "").trim();

      // 템플릿 행 및 순번 없는 행 스킵 (순번은 숫자여야 함)
      if (!seqCell || !/^\d+$/.test(seqCell)) continue;

      const date = parseSheetDate(dateCell);
      if (!date) continue;

      const customerName = (row[SHEET_COL.APPLICANT] ?? "").trim();
      if (!customerName) continue;

      // 전화번호: 사장님 연락처(col G) 우선, 없으면 현장 담당자(col H) 사용
      const phoneRaw = (row[SHEET_COL.PHONE_OWNER] ?? "").trim() || (row[SHEET_COL.PHONE_SITE] ?? "").trim();
      const phoneNorm = normalizePhone(phoneRaw);

      // 최종 정산금액 (0이면 취소 대상)
      const finalPrice = parseSheetPrice((row[SHEET_COL.FINAL_PRICE] ?? "").trim());

      // Supabase에서 동명 + 동일 날짜 예약 조회
      const { data: existing } = await supabase
        .from("bookings")
        .select("id, status")
        .ilike("customer_name", customerName)
        .eq("date", date)
        .limit(1)
        .maybeSingle();

      const rowNum = i + 1; // 1-indexed 시트 행 번호
      const dispatchDoneCell = (row[SHEET_COL.DISPATCH_DONE] ?? "").trim();
      const pickupDoneCell = (row[SHEET_COL.PICKUP_DONE] ?? "").trim();

      if (existing) {
        // Sheet → Supabase: 최종금액=0이면 취소
        if (finalPrice === 0 && existing.status !== "cancelled") {
          await updateBooking(existing.id, { status: "cancelled" } as Partial<Booking>);
          cancelled++;
        }
        // Supabase → Sheet: 상태 반영 (빈칸인 경우만 업데이트)
        if (!dispatchDoneCell && DISPATCH_DONE_STATUSES.has(existing.status)) {
          sheetUpdates.push({ range: `O${rowNum}`, value: "완료" });
        }
        if (!pickupDoneCell && PICKUP_DONE_STATUSES.has(existing.status)) {
          sheetUpdates.push({ range: `P${rowNum}`, value: "완료" });
        }
      } else {
        // 신규 예약 생성: 최종금액=0(취소 건)이면 스킵
        if (finalPrice === 0) continue;

        const memo = [
          row[SHEET_COL.COUNT] ? `도시락: ${row[SHEET_COL.COUNT]}` : "",
          (row[SHEET_COL.NOTES] ?? "").trim(),
        ].filter(Boolean).join(" / ");

        const price = parseSheetPrice((row[SHEET_COL.TRANSPORT_PRICE] ?? "").trim()) ?? 0;
        const now = new Date().toISOString();

        const booking: Booking = {
          id: uuidv4(),
          date,
          timeSlot: (row[SHEET_COL.TIME] ?? "").trim(),
          area: "",
          items: [],
          totalPrice: price,
          crewSize: 1,
          needLadder: false,
          ladderPrice: 0,
          customerName,
          phone: phoneNorm || "00000000000", // 연락처 없는 행 플레이스홀더
          address: (row[SHEET_COL.ADDRESS] ?? "").trim(),
          addressDetail: "",
          memo: memo.trim(),
          status: "pending",
          createdAt: now,
          updatedAt: now,
          hasElevator: false,
          hasParking: false,
          hasGroundAccess: false,
          estimateMin: price,
          estimateMax: price,
          finalPrice: finalPrice !== null && finalPrice > 0 ? finalPrice : null,
          photos: [],
          adminMemo: "",
          confirmedTime: null,
          slackThreadTs: null,
          source: "단건시트 자동동기화",
        };

        const createdBooking = await createBooking(booking);
        sendBookingCreated(createdBooking)
          .then((threadTs) => {
            if (threadTs) updateBooking(createdBooking.id, { slackThreadTs: threadTs } as Partial<Booking>).catch(() => {});
          })
          .catch(() => {});
        created++;
      }
    }

    // Supabase→Sheet 배치 업데이트
    if (sheetUpdates.length > 0) {
      await batchUpdateSheetCells(DANGUN_SHEET_ID, sheetUpdates, token);
    }

    console.log(`[sheet-sync] 완료: created=${created}, cancelled=${cancelled}, sheetUpdated=${sheetUpdates.length}`);
    return NextResponse.json({ created, cancelled, sheetUpdated: sheetUpdates.length });
  } catch (e) {
    console.error("[sheet-sync] 오류:", e);
    sendErrorAlert("GET /api/cron/sheet-sync", e).catch(() => {});
    return NextResponse.json({ error: "동기화 실패" }, { status: 500 });
  }
}

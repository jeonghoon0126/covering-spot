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
 * - Vercel Cron: 5분마다 실행 (schedule: "* /5 * * * *" without space)
 *
 * 동기화 정책:
 *   처리 범위: 날짜 기준 30일 전 ~ 90일 후 (과거 누락 + 미래 예정 커버)
 *   중복 체크: customer_name + date 기준 메모리 맵 (DB 배치 쿼리 1회로 최적화)
 *
 * Sheet → Supabase:
 *   - 유효 행(순번=숫자, 날짜 파싱 가능) 중 미등록 건 → pending 예약 생성
 *   - 최종 정산금액=0인 기존 예약 → cancelled 처리
 *   - 최종 정산금액=0인 신규 행 → 스킵 (이미 취소된 건)
 *
 * Supabase → Sheet:
 *   - 배차완료(col O): 빈칸 + status IN (in_progress, completed, check_completed) → "완료"
 *   - 수거완료(col P): 빈칸 + status IN (completed, check_completed) → "완료"
 *   - 이미 값 있는 셀은 덮어쓰지 않음 (단방향 누락 방지)
 *
 * 필수 Vercel 환경변수:
 *   GOOGLE_SERVICE_ACCOUNT_JSON (google-sheets@covering-app-ccd23.iam.gserviceaccount.com)
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

    // 1. 시트 전체 읽기 (A~R열, 최대 1000행)
    const rows = await readSheetValues(DANGUN_SHEET_ID, "A1:R1000", token);
    if (rows.length < 2) return NextResponse.json({ created: 0, cancelled: 0, sheetUpdated: 0 });

    // 2. 처리 범위: 오늘 기준 -30일 ~ +90일
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const cutoffPast = new Date(now);
    cutoffPast.setDate(cutoffPast.getDate() - 30);
    const cutoffFuture = new Date(now);
    cutoffFuture.setDate(cutoffFuture.getDate() + 90);

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dateMin = fmt(cutoffPast);
    const dateMax = fmt(cutoffFuture);

    // 3. 유효 시트 행 파싱 (처리 범위 내)
    type SheetRowParsed = {
      sheetRowNum: number; // 1-indexed
      date: string;
      customerName: string;
      phone: string;
      address: string;
      timeSlot: string;
      memo: string;
      price: number;
      finalPrice: number | null;
      dispatchDoneCell: string;
      pickupDoneCell: string;
    };

    const validRows: SheetRowParsed[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const seqCell = (row[SHEET_COL.SEQ] ?? "").trim();
      if (!seqCell || !/^\d+$/.test(seqCell)) continue; // 템플릿 행 스킵

      const date = parseSheetDate((row[SHEET_COL.DATE] ?? "").trim());
      if (!date) continue;
      if (date < dateMin || date > dateMax) continue; // 처리 범위 밖 스킵

      const customerName = (row[SHEET_COL.APPLICANT] ?? "").trim();
      if (!customerName) continue;

      const phoneRaw =
        (row[SHEET_COL.PHONE_OWNER] ?? "").trim() || (row[SHEET_COL.PHONE_SITE] ?? "").trim();

      validRows.push({
        sheetRowNum: i + 1,
        date,
        customerName,
        phone: normalizePhone(phoneRaw) || "00000000000",
        address: (row[SHEET_COL.ADDRESS] ?? "").trim(),
        timeSlot: (row[SHEET_COL.TIME] ?? "").trim(),
        memo: [
          row[SHEET_COL.COUNT] ? `도시락: ${row[SHEET_COL.COUNT]}` : "",
          (row[SHEET_COL.NOTES] ?? "").trim(),
        ]
          .filter(Boolean)
          .join(" / "),
        price: parseSheetPrice((row[SHEET_COL.TRANSPORT_PRICE] ?? "").trim()) ?? 0,
        finalPrice: parseSheetPrice((row[SHEET_COL.FINAL_PRICE] ?? "").trim()),
        dispatchDoneCell: (row[SHEET_COL.DISPATCH_DONE] ?? "").trim(),
        pickupDoneCell: (row[SHEET_COL.PICKUP_DONE] ?? "").trim(),
      });
    }

    if (validRows.length === 0) {
      return NextResponse.json({ created: 0, cancelled: 0, sheetUpdated: 0 });
    }

    // 4. Supabase 배치 조회 (처리 범위 내 전체, 1회 쿼리)
    const { data: dbBookings } = await supabase
      .from("bookings")
      .select("id, status, customer_name, date")
      .gte("date", dateMin)
      .lte("date", dateMax)
      .limit(5000);

    // 조회 결과 메모리 맵 구성: "customerName|date" → { id, status }
    const dbMap = new Map<string, { id: string; status: string }>();
    for (const b of dbBookings || []) {
      const key = `${(b.customer_name as string).trim().toLowerCase()}|${b.date}`;
      dbMap.set(key, { id: b.id as string, status: b.status as string });
    }

    // 5. 행별 처리
    let created = 0;
    let cancelled = 0;
    const sheetUpdates: { range: string; value: string }[] = [];
    const nowIso = new Date().toISOString();

    for (const r of validRows) {
      const key = `${r.customerName.toLowerCase()}|${r.date}`;
      const existing = dbMap.get(key);

      if (existing) {
        // Sheet → Supabase: 최종금액=0이면 취소
        if (r.finalPrice === 0 && existing.status !== "cancelled") {
          await updateBooking(existing.id, { status: "cancelled" } as Partial<Booking>);
          dbMap.set(key, { ...existing, status: "cancelled" });
          cancelled++;
        }
        // Supabase → Sheet: 배차완료/수거완료 (빈칸인 경우만)
        if (!r.dispatchDoneCell && DISPATCH_DONE_STATUSES.has(existing.status)) {
          sheetUpdates.push({ range: `O${r.sheetRowNum}`, value: "완료" });
        }
        if (!r.pickupDoneCell && PICKUP_DONE_STATUSES.has(existing.status)) {
          sheetUpdates.push({ range: `P${r.sheetRowNum}`, value: "완료" });
        }
      } else {
        // 신규 생성: 최종금액=0(취소 건) 스킵
        if (r.finalPrice === 0) continue;

        const booking: Booking = {
          id: uuidv4(),
          date: r.date,
          timeSlot: r.timeSlot,
          area: "",
          items: [],
          totalPrice: r.price,
          crewSize: 1,
          needLadder: false,
          ladderPrice: 0,
          customerName: r.customerName,
          phone: r.phone,
          address: r.address,
          addressDetail: "",
          memo: r.memo.trim(),
          status: "pending",
          createdAt: nowIso,
          updatedAt: nowIso,
          hasElevator: false,
          hasParking: false,
          hasGroundAccess: false,
          estimateMin: r.price,
          estimateMax: r.price,
          finalPrice: r.finalPrice !== null && r.finalPrice > 0 ? r.finalPrice : null,
          photos: [],
          adminMemo: "",
          confirmedTime: null,
          slackThreadTs: null,
          source: "단건시트 자동동기화",
        };

        const createdBooking = await createBooking(booking);
        dbMap.set(key, { id: createdBooking.id, status: "pending" });
        sendBookingCreated(createdBooking)
          .then((threadTs) => {
            if (threadTs)
              updateBooking(createdBooking.id, { slackThreadTs: threadTs } as Partial<Booking>).catch(() => {});
          })
          .catch(() => {});
        created++;
      }
    }

    // 6. Supabase→Sheet 배치 업데이트
    if (sheetUpdates.length > 0) {
      await batchUpdateSheetCells(DANGUN_SHEET_ID, sheetUpdates, token);
    }

    console.log(`[sheet-sync] created=${created}, cancelled=${cancelled}, sheetUpdated=${sheetUpdates.length}`);
    return NextResponse.json({ created, cancelled, sheetUpdated: sheetUpdates.length });
  } catch (e) {
    console.error("[sheet-sync] 오류:", e);
    sendErrorAlert("GET /api/cron/sheet-sync", e).catch(() => {});
    return NextResponse.json({ error: "동기화 실패" }, { status: 500 });
  }
}

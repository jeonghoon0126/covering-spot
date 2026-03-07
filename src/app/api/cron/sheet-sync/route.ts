import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";
import { createBooking } from "@/lib/db";
import { sendBookingCreated } from "@/lib/slack-notify";
import { updateBooking } from "@/lib/db";
import { sendErrorAlert } from "@/lib/slack-notify";
import type { Booking } from "@/types/booking";

/**
 * 단건시트(신사업) ↔ Supabase 동기화 Cron
 * - Vercel Cron: 매일 UTC 1:00 (KST 10:00) 실행
 * - Sheet → Supabase: 새 행 → 신규 예약 생성 (price=0 제외)
 * - Sheet → Supabase: 기존 예약 price=0 → 취소 처리
 * - 중복 체크: phone + date + time_slot 기준
 */

const SHEET_ID = "1Y8ztdzT-Y08-XOkKSX-jryLJFT4r1ID4nuzRcN9ddTU";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (line[i] === "," && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

const HEADER_MAP: Record<string, string> = {
  고객명: "customerName", 이름: "customerName", 성함: "customerName", name: "customerName",
  전화번호: "phone", 연락처: "phone", 핸드폰: "phone", phone: "phone",
  주소: "address", address: "address",
  상세주소: "addressDetail", 상세: "addressDetail", 호수: "addressDetail",
  수거일: "date", 날짜: "date", 수거날짜: "date", date: "date",
  시간대: "timeSlot", 시간: "timeSlot", timeslot: "timeSlot",
  평형: "area", 면적: "area", 평수: "area", area: "area",
  예상금액: "estimatedPrice", 금액: "estimatedPrice", 가격: "estimatedPrice", price: "estimatedPrice",
  품목설명: "itemsDescription", 품목: "itemsDescription",
  메모: "sheetMemo", 비고: "sheetMemo", memo: "sheetMemo",
};

interface SheetRow {
  customerName?: string;
  phone?: string;
  address?: string;
  addressDetail?: string;
  date?: string;
  timeSlot?: string;
  area?: string;
  estimatedPrice?: string;
  itemsDescription?: string;
  sheetMemo?: string;
}

function parseCSV(csvText: string): SheetRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const rawHeaders = parseCSVLine(lines[0]);
  const fieldKeys = rawHeaders.map((h) => {
    const normalized = h.trim().toLowerCase().replace(/\s+/g, "");
    return HEADER_MAP[normalized] ?? null;
  });

  const rows: SheetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const raw: Record<string, string> = {};
    fieldKeys.forEach((key, idx) => {
      if (key && values[idx] !== undefined) raw[key] = values[idx].trim();
    });
    if (Object.values(raw).every((v) => !v)) continue;
    rows.push(raw as SheetRow);
  }
  return rows;
}

function sheetRowToBooking(row: SheetRow): Booking {
  const now = new Date().toISOString();
  const price = row.estimatedPrice ? parseInt(row.estimatedPrice.replace(/,/g, ""), 10) || 0 : 0;
  const adminMemoParts = [
    row.itemsDescription ? `[품목] ${row.itemsDescription}` : "",
    row.sheetMemo ? `[메모] ${row.sheetMemo}` : "",
  ].filter(Boolean);

  return {
    id: uuidv4(),
    date: row.date || "",
    timeSlot: row.timeSlot || "",
    area: row.area || "",
    items: [],
    totalPrice: price,
    crewSize: 1,
    needLadder: false,
    ladderPrice: 0,
    customerName: row.customerName!,
    phone: row.phone!,
    address: row.address!,
    addressDetail: row.addressDetail || "",
    memo: "",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    hasElevator: false,
    hasParking: false,
    hasGroundAccess: false,
    estimateMin: price,
    estimateMax: price,
    finalPrice: null,
    photos: [],
    adminMemo: adminMemoParts.join("\n"),
    confirmedTime: null,
    slackThreadTs: null,
    source: "단건시트 자동동기화",
  };
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // 1. 시트 CSV 가져오기
    const sheetRes = await fetch(CSV_URL, { signal: AbortSignal.timeout(15000) });
    if (!sheetRes.ok) {
      console.error("[sheet-sync] 시트 fetch 실패:", sheetRes.status);
      return NextResponse.json({ error: `시트 접근 실패 (${sheetRes.status})` }, { status: 502 });
    }

    const csvText = await sheetRes.text();
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return NextResponse.json({ created: 0, cancelled: 0, skipped: 0 });
    }

    let created = 0;
    let cancelled = 0;
    let skipped = 0;

    for (const row of rows) {
      // 필수 필드 없으면 스킵
      if (!row.customerName || !row.phone || !row.address) { skipped++; continue; }

      const price = row.estimatedPrice ? parseInt(row.estimatedPrice.replace(/,/g, ""), 10) : NaN;

      // 기존 예약 조회 (phone + date + time_slot 기준)
      const query = supabase.from("bookings").select("id, status");
      let matchQuery = query.eq("phone", row.phone);
      if (row.date) matchQuery = matchQuery.eq("date", row.date);
      if (row.timeSlot) matchQuery = matchQuery.eq("time_slot", row.timeSlot);
      const { data: existing } = await matchQuery.maybeSingle();

      if (existing) {
        // price=0 → 취소 처리 (이미 취소된 건 스킵)
        if (!isNaN(price) && price === 0 && existing.status !== "cancelled") {
          await updateBooking(existing.id, { status: "cancelled" } as Partial<Booking>);
          cancelled++;
        } else {
          skipped++;
        }
      } else {
        // price=0인 신규 행은 스킵 (이미 취소된 건으로 간주)
        if (!isNaN(price) && price === 0) { skipped++; continue; }

        // 신규 예약 생성
        const booking = sheetRowToBooking(row);
        const createdBooking = await createBooking(booking);
        sendBookingCreated(createdBooking)
          .then((threadTs) => {
            if (threadTs) updateBooking(createdBooking.id, { slackThreadTs: threadTs } as Partial<Booking>).catch(() => {});
          })
          .catch(() => {});
        created++;
      }
    }

    console.log(`[sheet-sync] 완료: created=${created}, cancelled=${cancelled}, skipped=${skipped}`);
    return NextResponse.json({ created, cancelled, skipped });
  } catch (e) {
    console.error("[sheet-sync] 오류:", e);
    sendErrorAlert("GET /api/cron/sheet-sync", e).catch(() => {});
    return NextResponse.json({ error: "동기화 실패" }, { status: 500 });
  }
}

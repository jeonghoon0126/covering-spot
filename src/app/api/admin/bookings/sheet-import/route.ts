import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { validateToken } from "@/app/api/admin/auth/route";
import { createBooking, updateBooking } from "@/lib/db";
import { sendBookingCreated } from "@/lib/slack-notify";
import type { Booking } from "@/types/booking";

export const dynamic = "force-dynamic";

/** Google Sheets URL → CSV 내보내기 URL */
function toCSVExportURL(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const spreadsheetId = match[1];
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

/** CSV 한 줄 파싱 (따옴표 처리 포함) */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (line[i] === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

/** 헤더명 → 필드 매핑 (한글/유사어 통일) */
const HEADER_MAP: Record<string, string> = {
  고객명: "customerName",
  이름: "customerName",
  성함: "customerName",
  name: "customerName",
  전화번호: "phone",
  연락처: "phone",
  핸드폰: "phone",
  phone: "phone",
  주소: "address",
  address: "address",
  상세주소: "addressDetail",
  상세: "addressDetail",
  호수: "addressDetail",
  수거일: "date",
  날짜: "date",
  수거날짜: "date",
  date: "date",
  시간대: "timeSlot",
  시간: "timeSlot",
  timeslot: "timeSlot",
  평형: "area",
  면적: "area",
  평수: "area",
  area: "area",
  예상금액: "estimatedPrice",
  금액: "estimatedPrice",
  가격: "estimatedPrice",
  price: "estimatedPrice",
  품목설명: "itemsDescription",
  품목: "itemsDescription",
  메모: "memo",
  비고: "memo",
  memo: "memo",
};

export interface SheetRow {
  rowIndex: number;
  customerName?: string;
  phone?: string;
  address?: string;
  addressDetail?: string;
  date?: string;
  timeSlot?: string;
  area?: string;
  estimatedPrice?: string;
  itemsDescription?: string;
  memo?: string;
  errors: string[];
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

    // 완전히 빈 행 스킵
    if (Object.values(raw).every((v) => !v)) continue;

    const row: SheetRow = {
      rowIndex: i + 1, // 사람이 읽는 행 번호 (헤더=1, 데이터 시작=2)
      customerName: raw.customerName || undefined,
      phone: raw.phone || undefined,
      address: raw.address || undefined,
      addressDetail: raw.addressDetail || undefined,
      date: raw.date || undefined,
      timeSlot: raw.timeSlot || undefined,
      area: raw.area || undefined,
      estimatedPrice: raw.estimatedPrice || undefined,
      itemsDescription: raw.itemsDescription || undefined,
      memo: raw.memo || undefined,
      errors: [],
    };

    if (!row.customerName) row.errors.push("고객명 없음");
    if (!row.phone) row.errors.push("전화번호 없음");
    if (!row.address) row.errors.push("주소 없음");

    rows.push(row);
  }

  return rows;
}

function rowToBooking(row: SheetRow): Booking {
  const now = new Date().toISOString();
  const adminMemoParts = [
    row.itemsDescription ? `[품목] ${row.itemsDescription}` : "",
  ].filter(Boolean);

  return {
    id: uuidv4(),
    date: row.date || "",
    timeSlot: row.timeSlot || "",
    area: row.area || "",
    items: [],
    totalPrice: row.estimatedPrice ? parseInt(row.estimatedPrice.replace(/,/g, ""), 10) || 0 : 0,
    crewSize: 1,
    needLadder: false,
    ladderPrice: 0,
    customerName: row.customerName!,
    phone: row.phone!,
    address: row.address!,
    addressDetail: row.addressDetail || "",
    memo: row.memo || "",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    hasElevator: false,
    hasParking: false,
    hasGroundAccess: false,
    estimateMin: row.estimatedPrice ? parseInt(row.estimatedPrice.replace(/,/g, ""), 10) || 0 : 0,
    estimateMax: row.estimatedPrice ? parseInt(row.estimatedPrice.replace(/,/g, ""), 10) || 0 : 0,
    finalPrice: null,
    photos: [],
    adminMemo: adminMemoParts.join("\n"),
    confirmedTime: null,
    slackThreadTs: null,
    source: "구글시트 임포트",
  };
}

export async function POST(req: NextRequest) {
  if (!validateToken(req)) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { url, dryRun = true } = body as { url: string; dryRun?: boolean };

    if (!url?.trim()) {
      return NextResponse.json({ error: "구글 시트 URL을 입력해주세요" }, { status: 400 });
    }

    const csvURL = toCSVExportURL(url.trim());
    if (!csvURL) {
      return NextResponse.json(
        { error: "유효한 구글 시트 URL이 아닙니다. 'https://docs.google.com/spreadsheets/d/...' 형식이어야 합니다." },
        { status: 400 },
      );
    }

    // Google Sheets에서 CSV 가져오기 (공개 시트 필요)
    const sheetRes = await fetch(csvURL, { signal: AbortSignal.timeout(10000) });
    if (!sheetRes.ok) {
      if (sheetRes.status === 403) {
        return NextResponse.json(
          { error: "시트 접근 권한이 없습니다. '링크가 있는 모든 사용자에게 보기 권한'으로 공유해주세요." },
          { status: 403 },
        );
      }
      return NextResponse.json({ error: `시트를 불러오지 못했습니다 (HTTP ${sheetRes.status})` }, { status: 502 });
    }

    const csvText = await sheetRes.text();
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return NextResponse.json({ error: "시트에 데이터가 없거나 올바른 헤더가 없습니다." }, { status: 400 });
    }

    const validRows = rows.filter((r) => r.errors.length === 0);
    const invalidRows = rows.filter((r) => r.errors.length > 0);

    // dryRun: 미리보기만 반환
    if (dryRun) {
      return NextResponse.json({ rows, validCount: validRows.length, invalidCount: invalidRows.length });
    }

    // 실제 임포트
    const results: { rowIndex: number; bookingId?: string; error?: string }[] = [];

    for (const row of validRows) {
      try {
        const booking = rowToBooking(row);
        const created = await createBooking(booking);
        // Slack 알림 (fire-and-forget)
        sendBookingCreated(created)
          .then((threadTs) => {
            if (threadTs) updateBooking(created.id, { slackThreadTs: threadTs } as Partial<Booking>).catch((err) => console.error("[DB] slackThreadTs 업데이트 실패:", err?.message));
          })
          .catch((err) => console.error("[Slack] 시트임포트 알림 실패:", err?.message));
        results.push({ rowIndex: row.rowIndex, bookingId: created.id });
      } catch (e) {
        results.push({ rowIndex: row.rowIndex, error: String(e) });
      }
    }

    const succeeded = results.filter((r) => r.bookingId).length;
    const failed = results.filter((r) => r.error).length;

    return NextResponse.json({ succeeded, failed, results, skipped: invalidRows.length });
  } catch (e) {
    console.error("[sheet-import/POST]", e);
    return NextResponse.json({ error: "임포트 실패" }, { status: 500 });
  }
}

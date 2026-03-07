import { createSign } from "crypto";

export const DANGUN_SHEET_ID = "1Y8ztdzT-Y08-XOkKSX-jryLJFT4r1ID4nuzRcN9ddTU";

// 단건시트 컬럼 인덱스 (0-based)
export const SHEET_COL = {
  SEQ: 0,            // 순번
  DATE: 1,           // 날짜
  APPLICANT: 2,      // 신청자
  TIME: 3,           // 수거시간
  COUNT: 4,          // 도시락 개수
  ADDRESS: 5,        // 수거 주소 / 매장 앞
  PHONE_OWNER: 6,    // 사장님 연락처
  PHONE_SITE: 7,     // 현장 담당자
  NOTES: 8,          // 특이사항
  DISPATCH: 9,       // 배차
  DRIVER_PHONE: 10,  // 기사님 연락처
  TRANSPORT_PRICE: 11, // 운송가격
  SORT_PRICE: 12,    // 선별가격(개 당)
  FINAL_PRICE: 13,   // 최종 정산금액(부가세 포함)
  DISPATCH_DONE: 14, // 배차완료 (col O)
  PICKUP_DONE: 15,   // 수거완료 (col P)
  SETTLEMENT: 16,    // 정산요청 (col Q)
  SLACK_ID: 17,      // 슬랙 메시지 id (col R)
} as const;

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function getSheetsToken(): Promise<string> {
  const saJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: saJson.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(saJson.private_key, "base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${header}.${payload}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`Sheets 토큰 실패: ${data.error}`);
  return data.access_token;
}

export async function readSheetValues(spreadsheetId: string, range: string, token: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json() as { values?: string[][] };
  return data.values || [];
}

export async function batchUpdateSheetCells(
  spreadsheetId: string,
  updates: { range: string; value: string }[],
  token: string,
): Promise<void> {
  if (updates.length === 0) return;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: updates.map((u) => ({ range: u.range, values: [[u.value]] })),
    }),
  });
  if (!res.ok) throw new Error(`batchUpdate 실패: ${await res.text()}`);
}

/** "2026.03.07" 또는 "2026-03-07" → "2026-03-07" */
export function parseSheetDate(raw: string): string | null {
  const m = raw.match(/(\d{4})[.\-](\d{2})[.\-](\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** "461,000원" | "461,000" | "0" → 숫자, 빈 문자열 → null */
export function parseSheetPrice(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed.replace(/[,원\s]/g, ""), 10);
  return isNaN(n) ? null : n;
}

/** "010-8482-8507" → "01084828507" */
export function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

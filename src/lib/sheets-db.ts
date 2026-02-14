import { google } from "googleapis";
import type { Booking } from "@/types/booking";

const SPREADSHEET_ID = process.env.BOOKING_SPREADSHEET_ID!;
const SHEET_NAME = process.env.BOOKING_SHEET_NAME || "bookings";

const HEADERS = [
  "id",            // A (0)
  "date",          // B (1)
  "timeSlot",      // C (2)
  "area",          // D (3)
  "items",         // E (4)
  "totalPrice",    // F (5)
  "crewSize",      // G (6)
  "needLadder",    // H (7)
  "ladderType",    // I (8)
  "ladderHours",   // J (9)
  "ladderPrice",   // K (10)
  "customerName",  // L (11)
  "phone",         // M (12)
  "address",       // N (13)
  "addressDetail", // O (14)
  "memo",          // P (15)
  "status",        // Q (16)
  "createdAt",     // R (17)
  "updatedAt",     // S (18)
  "hasElevator",   // T (19)
  "hasParking",    // U (20)
  "estimateMin",   // V (21)
  "estimateMax",   // W (22)
  "finalPrice",    // X (23)
  "photos",        // Y (24)
  "adminMemo",     // Z (25)
];

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const key = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export function getDriveService() {
  return google.drive({ version: "v3", auth: getAuth() });
}

function rowToBooking(row: string[]): Booking {
  return {
    id: row[0] || "",
    date: row[1] || "",
    timeSlot: row[2] || "",
    area: row[3] || "",
    items: row[4] ? JSON.parse(row[4]) : [],
    totalPrice: Number(row[5]) || 0,
    crewSize: Number(row[6]) || 1,
    needLadder: row[7] === "true",
    ladderType: row[8] || undefined,
    ladderHours: row[9] ? Number(row[9]) : undefined,
    ladderPrice: Number(row[10]) || 0,
    customerName: row[11] || "",
    phone: row[12] || "",
    address: row[13] || "",
    addressDetail: row[14] || "",
    memo: row[15] || "",
    status: (row[16] as Booking["status"]) || "pending",
    createdAt: row[17] || "",
    updatedAt: row[18] || "",
    // 새 필드 - 기존 데이터에 컬럼이 없어도 안전하게 기본값 처리
    hasElevator: row[19] === "true",
    hasParking: row[20] === "true",
    estimateMin: Number(row[21]) || 0,
    estimateMax: Number(row[22]) || 0,
    finalPrice: row[23] ? Number(row[23]) : null,
    photos: row[24] ? JSON.parse(row[24]) : [],
    adminMemo: row[25] || "",
  };
}

function bookingToRow(b: Booking): string[] {
  return [
    b.id,
    b.date,
    b.timeSlot,
    b.area,
    JSON.stringify(b.items),
    String(b.totalPrice),
    String(b.crewSize),
    String(b.needLadder),
    b.ladderType || "",
    b.ladderHours != null ? String(b.ladderHours) : "",
    String(b.ladderPrice),
    b.customerName,
    b.phone,
    b.address,
    b.addressDetail,
    b.memo,
    b.status,
    b.createdAt,
    b.updatedAt,
    String(b.hasElevator),
    String(b.hasParking),
    String(b.estimateMin),
    String(b.estimateMax),
    b.finalPrice != null ? String(b.finalPrice) : "",
    JSON.stringify(b.photos),
    b.adminMemo,
  ];
}

export async function initBookingSheet(): Promise<void> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const exists = res.data.sheets?.some(
      (s) => s.properties?.title === SHEET_NAME,
    );
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [HEADERS] },
      });
    }
  } catch {
    // Sheet may already exist
  }
}

export async function getBookings(date?: string): Promise<Booking[]> {
  await initBookingSheet();
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:Z`,
  });
  const rows = (res.data.values || []) as string[][];
  let bookings = rows
    .filter((r) => r[0] && r[16] !== "cancelled")
    .map(rowToBooking);
  if (date) {
    bookings = bookings.filter((b) => b.date === date);
  }
  return bookings;
}

export async function getBookingById(
  id: string,
): Promise<Booking | null> {
  const all = await getBookings();
  return all.find((b) => b.id === id) || null;
}

export async function getBookingsByPhone(
  phone: string,
): Promise<Booking[]> {
  await initBookingSheet();
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:Z`,
  });
  const rows = (res.data.values || []) as string[][];
  return rows.filter((r) => r[12] === phone && r[0]).map(rowToBooking);
}

export async function getAllBookings(): Promise<Booking[]> {
  await initBookingSheet();
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:Z`,
  });
  const rows = (res.data.values || []) as string[][];
  return rows.filter((r) => r[0]).map(rowToBooking);
}

export async function getBookingsByStatus(
  status: string,
): Promise<Booking[]> {
  const all = await getAllBookings();
  return all.filter((b) => b.status === status);
}

export async function createBooking(
  booking: Booking,
): Promise<Booking> {
  await initBookingSheet();
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:Z`,
    valueInputOption: "RAW",
    requestBody: { values: [bookingToRow(booking)] },
  });
  return booking;
}

export async function updateBooking(
  id: string,
  updates: Partial<Booking>,
): Promise<Booking | null> {
  await initBookingSheet();
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:Z`,
  });
  const rows = (res.data.values || []) as string[][];
  const rowIndex = rows.findIndex((r) => r[0] === id);
  if (rowIndex === -1) return null;

  const existing = rowToBooking(rows[rowIndex]);
  const updated: Booking = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const sheetRow = rowIndex + 2; // 1-indexed + header row
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${sheetRow}:Z${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [bookingToRow(updated)] },
  });

  return updated;
}

export async function deleteBooking(id: string): Promise<boolean> {
  const result = await updateBooking(id, { status: "cancelled" });
  return result !== null;
}

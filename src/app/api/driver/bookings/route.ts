import { NextRequest, NextResponse } from "next/server";
import { validateDriverToken } from "@/lib/driver-auth";
import { supabase } from "@/lib/supabase";
import type { Booking } from "@/types/booking";

/**
 * KST 기준 날짜 반환 (offset: 0=오늘, 1=내일)
 * setHours 방식은 날짜 경계에서 부정확 → epoch ms 기준으로 정확하게 계산
 */
function getKSTDate(offset = 0): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstMs = Date.now() + KST_OFFSET_MS + offset * 24 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

/**
 * DB row → 드라이버용 Booking (adminMemo 등 내부 필드 제외)
 * 보안: 드라이버는 고객 연락처/주소는 볼 수 있으나 관리자 메모/결제 내역은 볼 수 없음
 */
function rowToDriverBooking(row: Record<string, unknown>): Partial<Booking> {
  return {
    id: row.id as string,
    date: row.date as string,
    timeSlot: row.time_slot as string,
    area: row.area as string,
    items: (row.items as Booking["items"]) || [],
    totalPrice: (row.total_price as number) || 0,
    crewSize: (row.crew_size as number) || 1,
    needLadder: (row.need_ladder as boolean) || false,
    ladderType: (row.ladder_type as string) || undefined,
    ladderHours: row.ladder_hours != null ? (row.ladder_hours as number) : undefined,
    ladderPrice: (row.ladder_price as number) || 0,
    customerName: row.customer_name as string,
    phone: row.phone as string,
    address: row.address as string,
    addressDetail: (row.address_detail as string) || "",
    memo: (row.memo as string) || "",
    status: row.status as Booking["status"],
    confirmedTime: (row.confirmed_time as string) || null,
    hasElevator: (row.has_elevator as boolean) || false,
    hasParking: (row.has_parking as boolean) || false,
    driverId: (row.driver_id as string) || null,
    driverName: (row.driver_name as string) || null,
    totalLoadingCube: (row.total_loading_cube as number) || 0,
    routeOrder: row.route_order != null ? (row.route_order as number) : null,
    // 제외: adminMemo, finalPrice, completionPhotos, slackThreadTs, photos, source
  };
}

/** GET /api/driver/bookings — 당일 + 내일 내 배차 목록 */
export async function GET(req: NextRequest) {
  const auth = validateDriverToken(req);
  if (!auth) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const today = getKSTDate(0);
  const tomorrow = getKSTDate(1);

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, date, time_slot, area, items, total_price, crew_size, " +
      "need_ladder, ladder_type, ladder_hours, ladder_price, " +
      "customer_name, phone, address, address_detail, memo, status, " +
      "confirmed_time, has_elevator, has_parking, driver_id, driver_name, " +
      "total_loading_cube, route_order",
    )
    .eq("driver_id", auth.driverId)
    .in("date", [today, tomorrow])
    .in("status", ["quote_confirmed", "in_progress", "completed"])
    .order("date", { ascending: true })
    .order("route_order", { ascending: true });

  if (error) {
    console.error("[driver/bookings GET]", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }

  const bookings = ((data || []) as unknown as Record<string, unknown>[]).map(
    rowToDriverBooking,
  );
  return NextResponse.json({ bookings });
}

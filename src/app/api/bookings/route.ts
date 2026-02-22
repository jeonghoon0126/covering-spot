import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getBookingsByPhone,
  createBooking,
  updateBooking,
} from "@/lib/db";
import { sendBookingCreated } from "@/lib/slack-notify";
import { isDateBookable } from "@/lib/booking-utils";
import { generateBookingToken, validateBookingToken } from "@/lib/booking-token";
import { BookingCreateSchema, PhoneSchema } from "@/lib/validation";
import { geocodeAddress } from "@/lib/geocode";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { sendStatusSms } from "@/lib/sms-notify";
import type { Booking, BookingItem } from "@/types/booking";

export async function GET(req: NextRequest) {
  try {
    // Rate limiting: 20 requests per IP per 60s
    const ip = getRateLimitKey(req);
    const rl = rateLimit(`${ip}:/api/bookings/GET`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "잠시 후 다시 시도해주세요", retryAfter: rl.retryAfter },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfter) },
        },
      );
    }

    const phone = req.nextUrl.searchParams.get("phone");
    if (!phone) {
      return NextResponse.json(
        { error: "phone 파라미터가 필요합니다" },
        { status: 400 },
      );
    }

    // 전화번호 형식 검증
    const digits = phone.replace(/[^\d]/g, "");
    const parsed = PhoneSchema.safeParse(digits);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "올바른 전화번호 형식이 아닙니다" },
        { status: 400 },
      );
    }


    // 전화번호별 rate limit: 5회/5분 (전화번호 열거 공격 방어 — 동일 번호로 반복 시도 제한)
    const phoneRl = rateLimit(`phone:${digits}:/api/bookings/GET`, 5, 300_000);
    if (!phoneRl.allowed) {
      return NextResponse.json(
        { error: "잠시 후 다시 시도해주세요", retryAfter: phoneRl.retryAfter },
        { status: 429, headers: { "Retry-After": String(phoneRl.retryAfter) } },
      );
    }

    // 토큰 검증: phone 기반 토큰이 일치해야 조회 가능
    if (!validateBookingToken(req, phone)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    const bookings = await getBookingsByPhone(phone);
    return NextResponse.json({ bookings });
  } catch (e) {
    console.error("[bookings/GET]", e);
    return NextResponse.json(
      { error: "조회 실패" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 5 requests per IP per 60s (prevents spam bookings)
    const ip = getRateLimitKey(req);
    const rl = rateLimit(`${ip}:/api/bookings/POST`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "잠시 후 다시 시도해주세요", retryAfter: rl.retryAfter },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfter) },
        },
      );
    }

    const body = await req.json();

    // Zod 서버사이드 검증
    const parsed = BookingCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다", fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const validData = parsed.data;

    // 전날 12시 마감 정책 검증
    if (!isDateBookable(validData.date)) {
      return NextResponse.json(
        { error: "예약 마감된 날짜입니다. 전날 12시까지 신청 가능합니다." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    // 적재큐브 합계 계산
    const items: BookingItem[] = (validData.items || []).map((item) => ({
      ...item,
      displayName: item.displayName || item.name,
    }));
    const totalLoadingCube = items.reduce(
      (sum: number, item: BookingItem) => sum + (item.loadingCube || 0) * item.quantity,
      0,
    );

    const booking: Booking = {
      id: uuidv4(),
      date: validData.date,
      timeSlot: validData.timeSlot,
      area: validData.area,
      items,
      totalPrice: validData.totalPrice || 0,
      crewSize: validData.crewSize || 1,
      needLadder: validData.needLadder || false,
      ladderType: validData.ladderType || "",
      ladderHours: validData.ladderHours,
      ladderPrice: validData.ladderPrice || 0,
      customerName: validData.customerName,
      phone: validData.phone,
      address: validData.address,
      addressDetail: validData.addressDetail || "",
      memo: validData.memo || "",
      status: "pending",
      createdAt: now,
      updatedAt: now,
      hasElevator: validData.hasElevator || false,
      hasParking: validData.hasParking || false,
      estimateMin: validData.estimateMin || 0,
      estimateMax: validData.estimateMax || 0,
      finalPrice: null,
      photos: validData.photos || [],
      adminMemo: "",
      confirmedTime: null,
      slackThreadTs: null,
      totalLoadingCube: Math.round(totalLoadingCube * 100) / 100,
    };

    // Geocoding을 createBooking 전에 완료: 자동배차 시 lat/lng가 null이면 주문 제외되는 버그 방지
    const coords = await geocodeAddress(validData.address).catch(() => null);
    if (coords) {
      booking.latitude = coords.lat;
      booking.longitude = coords.lng;
    }

    await createBooking(booking);

    // 수거 신청 접수 SMS (fire-and-forget)
    sendStatusSms(booking.phone, "received", booking.id).catch(() => {});

    // Slack 알림만 fire-and-forget (지연 무관)
    sendBookingCreated(booking).then((threadTs) => {
      if (threadTs) {
        updateBooking(booking.id, { slackThreadTs: threadTs }).catch(() => {});
      }
    }).catch(() => {});

    // 예약 생성 시 bookingToken 반환 (고객이 조회/수정/삭제에 사용)
    const bookingToken = generateBookingToken(booking.phone);

    return NextResponse.json({ booking, bookingToken }, { status: 201 });
  } catch (e) {
    console.error("[bookings/POST]", e);
    return NextResponse.json(
      { error: "예약 생성 실패" },
      { status: 500 },
    );
  }
}

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
import { enforceServerItems } from "@/lib/server-price";
import { calculateQuote } from "@/lib/quote-calculator";
import { getSpotItems, getSpotAreas, getSpotLadder, createAdminNotification } from "@/lib/db";
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

    // 조회는 토큰 없이 허용 (phone + IP·phone별 rate limit으로 열거 공격 방어)
    // 수정(PUT)/삭제(DELETE)는 booking-token 검증 유지
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

    // 필수 약관 동의 서버사이드 검증
    if (!validData.agreedToTerms || !validData.agreedToPrivacy) {
      return NextResponse.json(
        { error: "서비스 이용약관 및 개인정보 수집·이용에 동의해 주세요" },
        { status: 400 },
      );
    }

    // 전날 12시 마감 정책 검증
    if (!isDateBookable(validData.date)) {
      return NextResponse.json(
        { error: "예약 마감된 날짜입니다. 전날 12시까지 신청 가능합니다." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    // DB에서 단가표 로드 (서버 기준 가격 강제 적용 + 견적 재계산)
    const [spotItems, areas, ladderPrices] = await Promise.all([
      getSpotItems(true),
      getSpotAreas(true),
      getSpotLadder(),
    ]);

    // 서버 단가표를 기준으로 품목 정보 덮어쓰기 (가격, 적재량 변조 방지)
    const items = enforceServerItems(validData.items || [], spotItems);

    // 서버 단가 기준 총 적재량 재계산
    const totalLoadingCube = items.reduce(
      (sum, item) => sum + (item.loadingCube || 0) * item.quantity,
      0,
    );

    // 고객이 던진 totalPrice, estimateMin/Max 대신 서버에서 엄격히 재계산한 견적값 적용
    const serverQuote = calculateQuote({
      area: validData.area,
      items: items,
      needLadder: validData.needLadder,
      ladderType: validData.ladderType,
      ladderHours: validData.ladderHours,
    }, undefined, spotItems, areas, ladderPrices);

    const booking: Booking = {
      id: uuidv4(),
      date: validData.date,
      timeSlot: validData.timeSlot,
      area: validData.area,
      items,
      totalPrice: serverQuote.totalPrice, // 서버 계산값 적용
      crewSize: validData.crewSize || serverQuote.crewSize, // 고객 요청 우선 또는 자동
      needLadder: validData.needLadder || false,
      ladderType: validData.ladderType || "",
      ladderHours: validData.ladderHours,
      ladderPrice: serverQuote.ladderPrice, // 서버 계산값 적용
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
      hasGroundAccess: validData.hasGroundAccess || false,
      estimateMin: serverQuote.estimateMin, // 서버 계산값 적용
      estimateMax: serverQuote.estimateMax, // 서버 계산값 적용
      finalPrice: null,
      photos: validData.photos || [],
      adminMemo: "",
      confirmedTime: null,
      slackThreadTs: null,
      totalLoadingCube: Math.round(totalLoadingCube * 100) / 100,
      agreedToTerms: validData.agreedToTerms,
      agreedToPrivacy: validData.agreedToPrivacy,
      agreedToMarketing: validData.agreedToMarketing ?? false,
      agreedToNightNotification: validData.agreedToNightNotification ?? false,
    };

    // Geocoding을 createBooking 전에 완료: 자동배차 시 lat/lng가 null이면 주문 제외되는 버그 방지
    const coords = await geocodeAddress(validData.address).catch(() => null);
    if (coords) {
      booking.latitude = coords.lat;
      booking.longitude = coords.lng;
    }

    await createBooking(booking);

    // 수거 신청 접수 SMS (fire-and-forget)
    sendStatusSms(booking.phone, "received", booking.id).catch((err) => console.error("[SMS] 접수 알림 실패:", err?.message));

    // 백오피스 알림 (신규 접수)
    createAdminNotification({
      bookingId: booking.id,
      type: "new_booking",
      title: `[신규접수] ${booking.customerName}`,
      body: `${booking.date} ${booking.timeSlot} | ${booking.area} | ${booking.address}`,
    }).catch((err) => console.error("[알림] 신규접수 알림 생성 실패:", err?.message));

    // Slack 알림만 fire-and-forget (지연 무관)
    sendBookingCreated(booking).then((threadTs) => {
      if (threadTs) {
        updateBooking(booking.id, { slackThreadTs: threadTs }).catch((err) => console.error("[DB] slackThreadTs 업데이트 실패:", err?.message));
      }
    }).catch((err) => console.error("[Slack] 신규접수 알림 실패:", err?.message));

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

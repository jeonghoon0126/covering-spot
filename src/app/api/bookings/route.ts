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
import type { Booking } from "@/types/booking";

export async function GET(req: NextRequest) {
  try {
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
    const body = await req.json();

    // Zod 서버사이드 검증
    const parsed = BookingCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다", fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // 전날 12시 마감 정책 검증
    if (!isDateBookable(body.date)) {
      return NextResponse.json(
        { error: "예약 마감된 날짜입니다. 전날 12시까지 신청 가능합니다." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const booking: Booking = {
      id: uuidv4(),
      date: body.date,
      timeSlot: body.timeSlot,
      area: body.area,
      items: body.items || [],
      totalPrice: body.totalPrice || 0,
      crewSize: body.crewSize || 1,
      needLadder: body.needLadder || false,
      ladderType: body.ladderType || "",
      ladderHours: body.ladderHours,
      ladderPrice: body.ladderPrice || 0,
      customerName: body.customerName,
      phone: body.phone,
      address: body.address,
      addressDetail: body.addressDetail || "",
      memo: body.memo || "",
      status: "pending",
      createdAt: now,
      updatedAt: now,
      hasElevator: body.hasElevator || false,
      hasParking: body.hasParking || false,
      estimateMin: body.estimateMin || 0,
      estimateMax: body.estimateMax || 0,
      finalPrice: null,
      photos: body.photos || [],
      adminMemo: "",
      confirmedTime: null,
      slackThreadTs: null,
    };

    await createBooking(booking);

    // Slack 알림 -> thread_ts 저장 (실패해도 예약은 성공)
    sendBookingCreated(booking)
      .then((threadTs) => {
        if (threadTs) {
          updateBooking(booking.id, { slackThreadTs: threadTs } as Partial<Booking>).catch(() => {});
        }
      })
      .catch(() => {});

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

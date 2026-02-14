import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getBookings,
  getBookingsByPhone,
  createBooking,
} from "@/lib/sheets-db";
import { sendBookingCreated } from "@/lib/slack-notify";
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
    const bookings = await getBookingsByPhone(phone);
    return NextResponse.json({ bookings });
  } catch (e) {
    return NextResponse.json(
      { error: "조회 실패", detail: String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 슬롯 중복 체크
    const existing = await getBookings(body.date);
    const conflict = existing.find((b) => b.timeSlot === body.timeSlot);
    if (conflict) {
      return NextResponse.json(
        { error: "해당 시간은 이미 예약되어 있습니다" },
        { status: 409 },
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
    };

    await createBooking(booking);

    // Slack 알림 (실패해도 예약은 성공)
    sendBookingCreated(booking).catch(() => {});

    return NextResponse.json({ booking }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "예약 생성 실패", detail: String(e) },
      { status: 500 },
    );
  }
}

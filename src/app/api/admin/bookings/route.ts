import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getBookingStatusCounts, getBookingsPaginated, createBooking, updateBooking } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";
import { sendBookingCreated } from "@/lib/slack-notify";
import type { Booking } from "@/types/booking";

export async function GET(req: NextRequest) {
  try {
    // 인증 확인
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      1000,
    );

    // status가 "all"이면 필터 없이 조회
    const filterStatus = status === "all" ? undefined : status;

    const { bookings, total } = await getBookingsPaginated({
      status: filterStatus,
      dateFrom,
      dateTo,
      search,
      page,
      limit,
    });

    // 상태별 카운트 (전체 기준, status 컬럼만 조회)
    const counts = await getBookingStatusCounts();

    return NextResponse.json({
      bookings,
      counts,
      total,
      page,
      limit,
    });
  } catch (e) {
    console.error("[admin/bookings/GET]", e);
    return NextResponse.json(
      { error: "조회 실패" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    const body = await req.json();

    // 필수 필드 검증
    if (!body.customerName?.trim()) {
      return NextResponse.json({ error: "고객 이름은 필수입니다" }, { status: 400 });
    }
    if (!body.phone?.trim()) {
      return NextResponse.json({ error: "전화번호는 필수입니다" }, { status: 400 });
    }
    if (!body.address?.trim()) {
      return NextResponse.json({ error: "주소는 필수입니다" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const booking: Booking = {
      id: uuidv4(),
      date: body.date || "",
      timeSlot: body.timeSlot || "",
      area: body.area || "",
      items: [],
      totalPrice: body.estimatedPrice || 0,
      crewSize: 1,
      needLadder: false,
      ladderPrice: 0,
      customerName: body.customerName.trim(),
      phone: body.phone.trim(),
      address: body.address.trim(),
      addressDetail: body.addressDetail?.trim() || "",
      memo: body.memo?.trim() || "",
      status: "pending",
      createdAt: now,
      updatedAt: now,
      hasElevator: false,
      hasParking: false,
      estimateMin: body.estimatedPrice || 0,
      estimateMax: body.estimatedPrice || 0,
      finalPrice: null,
      photos: [],
      adminMemo: [
        body.itemsDescription ? `[품목] ${body.itemsDescription}` : "",
        body.adminMemo || "",
      ].filter(Boolean).join("\n"),
      confirmedTime: null,
      slackThreadTs: null,
      source: body.source || "카카오톡 상담",
    };

    const created = await createBooking(booking);

    // Slack 알림 (fire-and-forget)
    sendBookingCreated(created)
      .then((threadTs) => {
        if (threadTs) {
          updateBooking(created.id, { slackThreadTs: threadTs } as Partial<Booking>).catch(() => {});
        }
      })
      .catch(() => {});

    return NextResponse.json({ booking: created }, { status: 201 });
  } catch (e) {
    console.error("[admin/bookings/POST]", e);
    return NextResponse.json(
      { error: "예약 생성 실패" },
      { status: 500 },
    );
  }
}

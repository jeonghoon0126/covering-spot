import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getBookingStatusCounts, getBookingsPaginated, createBooking, updateBooking } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";
import { sendBookingCreated } from "@/lib/slack-notify";
import { calcCrewSize } from "@/lib/crew-utils";
import type { Booking } from "@/types/booking";

// 캐싱 비활성화: 항상 최신 DB 데이터 반환
export const dynamic = "force-dynamic";

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

    // items: BookingItem[] 수신 (없으면 빈 배열)
    const items: Booking["items"] = Array.isArray(body.items)
      ? body.items.map((i: { category: string; name: string; displayName: string; price: number; quantity: number; loadingCube: number }) => ({
          category: String(i.category || ""),
          name: String(i.name || ""),
          displayName: String(i.displayName || i.name || ""),
          price: Math.max(0, Number(i.price) || 0),
          quantity: Math.max(1, Math.min(100, Number(i.quantity) || 1)),
          loadingCube: Math.max(0, Number(i.loadingCube) || 0),
        }))
      : [];

    // totalLoadingCube: items에서 계산
    const totalLoadingCube = items.reduce(
      (s, i) => s + i.loadingCube * i.quantity,
      0,
    );

    // estimatedPrice: 클라이언트 override 있으면 사용, 없으면 items 합계
    const itemsTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const priceNum = body.estimatedPrice || itemsTotal || 0;

    const now = new Date().toISOString();
    const booking: Booking = {
      id: uuidv4(),
      date: body.date || "",
      timeSlot: body.timeSlot || "",
      area: body.area || "",
      items,
      totalPrice: priceNum,
      crewSize: calcCrewSize(totalLoadingCube),
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
      hasGroundAccess: body.hasGroundAccess ?? false,
      estimateMin: priceNum,
      estimateMax: priceNum,
      finalPrice: null,
      photos: [],
      adminMemo: body.adminMemo?.trim() || "",
      confirmedTime: null,
      slackThreadTs: null,
      source: body.source || "카카오톡 상담",
      totalLoadingCube,
    };

    const created = await createBooking(booking);

    // Slack 알림 (fire-and-forget)
    sendBookingCreated(created)
      .then((threadTs) => {
        if (threadTs) {
          updateBooking(created.id, { slackThreadTs: threadTs } as Partial<Booking>).catch((err) => console.error("[DB] slackThreadTs 업데이트 실패:", err?.message));
        }
      })
      .catch((err) => console.error("[Slack] 관리자 예약생성 알림 실패:", err?.message));

    return NextResponse.json({ booking: created }, { status: 201 });
  } catch (e) {
    console.error("[admin/bookings/POST]", e);
    return NextResponse.json(
      { error: "예약 생성 실패" },
      { status: 500 },
    );
  }
}

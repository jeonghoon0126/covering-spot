import { NextRequest, NextResponse } from "next/server";
import {
  getBlockedSlots,
  getBlockedSlotsRange,
  createBlockedSlot,
  deleteBlockedSlot,
} from "@/lib/db";
import { validateToken, getAdminFromToken } from "@/app/api/admin/auth/route";

export async function GET(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    const date = req.nextUrl.searchParams.get("date");
    const dateFrom = req.nextUrl.searchParams.get("dateFrom");
    const dateTo = req.nextUrl.searchParams.get("dateTo");
    const driverId = req.nextUrl.searchParams.get("driverId") || undefined;

    let slots;
    if (date) {
      slots = await getBlockedSlots(date, driverId);
    } else if (dateFrom && dateTo) {
      slots = await getBlockedSlotsRange(dateFrom, dateTo, driverId);
    } else {
      return NextResponse.json(
        { error: "date 또는 dateFrom+dateTo 파라미터가 필요합니다" },
        { status: 400 },
      );
    }

    return NextResponse.json({ slots });
  } catch (e) {
    console.error("[admin/blocked-slots/GET]", e);
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

    if (!body.date || !body.timeStart || !body.timeEnd) {
      return NextResponse.json(
        { error: "date, timeStart, timeEnd 필드가 필요합니다" },
        { status: 400 },
      );
    }

    const { adminEmail } = getAdminFromToken(req);

    const slot = await createBlockedSlot({
      date: body.date,
      timeStart: body.timeStart,
      timeEnd: body.timeEnd,
      reason: body.reason,
      createdBy: adminEmail || undefined,
      driverId: body.driverId || null,
    });

    return NextResponse.json({ slot }, { status: 201 });
  } catch (e) {
    console.error("[admin/blocked-slots/POST]", e);
    return NextResponse.json(
      { error: "생성 실패" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "id 파라미터가 필요합니다" },
        { status: 400 },
      );
    }

    const deleted = await deleteBlockedSlot(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "슬롯을 찾을 수 없습니다" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[admin/blocked-slots/DELETE]", e);
    return NextResponse.json(
      { error: "삭제 실패" },
      { status: 500 },
    );
  }
}

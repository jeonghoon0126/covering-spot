import { NextRequest, NextResponse } from "next/server";
import {
  getBookingById,
  updateBooking,
  deleteBooking,
} from "@/lib/db";
import {
  sendBookingUpdated,
  sendBookingDeleted,
} from "@/lib/slack-notify";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const booking = await getBookingById(id);
    if (!booking) {
      return NextResponse.json(
        { error: "예약을 찾을 수 없습니다" },
        { status: 404 },
      );
    }
    return NextResponse.json({ booking });
  } catch (e) {
    return NextResponse.json(
      { error: "조회 실패", detail: String(e) },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const existing = await getBookingById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "예약을 찾을 수 없습니다" },
        { status: 404 },
      );
    }

    // 수정 가능 조건: pending 상태만
    if (existing.status !== "pending") {
      return NextResponse.json(
        { error: "견적 확정 전에만 수정할 수 있습니다" },
        { status: 400 },
      );
    }

    // 수정 가능 조건: 수거일 전날 22시(KST) 이전까지만
    const pickupDate = new Date(existing.date + "T00:00:00+09:00");
    const deadline = new Date(pickupDate.getTime() - 2 * 60 * 60 * 1000); // 전날 22시 = 당일 00시 - 2시간
    const now = new Date();
    if (now >= deadline) {
      return NextResponse.json(
        { error: "수거일 전날 22시 이후에는 수정할 수 없습니다" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const updated = await updateBooking(id, body);
    if (!updated) {
      return NextResponse.json(
        { error: "수정 실패" },
        { status: 500 },
      );
    }
    sendBookingUpdated(updated).catch(() => {});
    return NextResponse.json({ booking: updated });
  } catch (e) {
    return NextResponse.json(
      { error: "수정 실패", detail: String(e) },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const booking = await getBookingById(id);
    if (!booking) {
      return NextResponse.json(
        { error: "예약을 찾을 수 없습니다" },
        { status: 404 },
      );
    }
    await deleteBooking(id);
    sendBookingDeleted(booking).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "삭제 실패", detail: String(e) },
      { status: 500 },
    );
  }
}

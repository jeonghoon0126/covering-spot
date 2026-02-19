import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getBookingById,
  updateBooking,
  deleteBooking,
} from "@/lib/db";
import {
  sendBookingUpdated,
  sendBookingDeleted,
} from "@/lib/slack-notify";
import { validateBookingToken } from "@/lib/booking-token";

/** 고객이 수정 가능한 필드만 허용 (admin 전용 필드 차단) */
const CustomerUpdateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeSlot: z.string().optional(),
  items: z.array(z.object({
    name: z.string(),
    displayName: z.string(),
    category: z.string(),
    price: z.number(),
    quantity: z.number().int().positive(),
  })).optional(),
  memo: z.string().max(500).optional(),
  photos: z.array(z.string().url()).optional(),
  address: z.string().optional(),
  addressDetail: z.string().max(200).optional(),
  needLadder: z.boolean().optional(),
  ladderType: z.string().optional(),
  ladderHours: z.number().int().min(1).max(8).optional(),
}).strict();

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
    // GET by ID: UUID로만 접근 가능 (추측 불가)
    // 토큰 없는 요청에는 전화번호 마스킹 (IDOR 대응)
    const hasToken = validateBookingToken(_req, booking.phone);
    if (!hasToken) {
      const masked = { ...booking };
      if (masked.phone) {
        masked.phone = masked.phone.replace(/(\d{3})[-]?\d{4}[-]?(\d{4})/, "$1-****-$2");
      }
      return NextResponse.json({ booking: masked });
    }
    return NextResponse.json({ booking });
  } catch (e) {
    console.error("[bookings/[id]/GET]", e);
    return NextResponse.json(
      { error: "조회 실패" },
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

    // 토큰 검증: phone 기반 토큰 필수
    if (!validateBookingToken(req, existing.phone)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
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
    const parsed = CustomerUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "허용되지 않는 필드가 포함되어 있습니다", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const updated = await updateBooking(id, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { error: "수정 실패" },
        { status: 500 },
      );
    }
    sendBookingUpdated(updated).catch(() => {});
    return NextResponse.json({ booking: updated });
  } catch (e) {
    console.error("[bookings/[id]/PUT]", e);
    return NextResponse.json(
      { error: "수정 실패" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
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

    // 토큰 검증: phone 기반 토큰 필수
    if (!validateBookingToken(req, booking.phone)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    // pending 상태에서만 취소 가능
    if (booking.status !== "pending") {
      return NextResponse.json(
        { error: "견적 확정 전에만 취소할 수 있습니다" },
        { status: 400 },
      );
    }

    await deleteBooking(id);
    sendBookingDeleted(booking).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[bookings/[id]/DELETE]", e);
    return NextResponse.json(
      { error: "삭제 실패" },
      { status: 500 },
    );
  }
}

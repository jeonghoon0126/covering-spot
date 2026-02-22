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
import { getCustomerDeadline } from "@/lib/booking-utils";
import type { Booking } from "@/types/booking";

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
    loadingCube: z.number().min(0).default(0),
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
      // 전화번호 마스킹: 010-1234-5678 → 010-****-5678
      if (masked.phone) {
        masked.phone = masked.phone.replace(/(\d{3})[-]?\d{4}[-]?(\d{4})/, "$1-****-$2");
      }
      // 이름 마스킹: "홍길동" → "홍*동", "홍길" → "홍*"
      if (masked.customerName && masked.customerName.length >= 2) {
        masked.customerName =
          masked.customerName[0] +
          "*".repeat(Math.max(1, masked.customerName.length - 2)) +
          (masked.customerName.length >= 3 ? masked.customerName.slice(-1) : "");
      }
      // 주소 마스킹: 구 단위까지만 표시 ("서울특별시 강남구 ***")
      if (masked.address) {
        const parts = masked.address.split(" ");
        masked.address = parts.slice(0, 2).join(" ") + (parts.length > 2 ? " ***" : "");
      }
      if (masked.addressDetail) {
        masked.addressDetail = "***";
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

    // 수정 가능 조건: pending 또는 quote_confirmed 상태
    const isReschedule = existing.status === "quote_confirmed";
    if (existing.status !== "pending" && !isReschedule) {
      return NextResponse.json(
        { error: "일정 변경이 불가능한 상태입니다" },
        { status: 400 },
      );
    }

    // 수정 가능 조건: 수거일 전날 22시(KST) 이전까지만
    const now = new Date();
    if (now >= getCustomerDeadline(existing.date)) {
      return NextResponse.json(
        { error: "수거일 전날 22시 이후에는 수정할 수 없습니다" },
        { status: 400 },
      );
    }

    const body = await req.json();

    // quote_confirmed 상태에서는 date, timeSlot만 변경 가능 (confirmedTime은 admin 전용)
    if (isReschedule) {
      const { date, timeSlot } = body;
      if (!date && !timeSlot) {
        return NextResponse.json(
          { error: "변경할 날짜 또는 시간대를 입력해주세요" },
          { status: 400 },
        );
      }
      // 입력값 형식 검증 (raw body이므로 명시적 타입 체크 필요)
      if (date && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
        return NextResponse.json({ error: "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)" }, { status: 400 });
      }
      // 고객 예약 시간대는 4개 슬롯만 허용
      const VALID_CUSTOMER_SLOTS = ["10:00", "12:00", "14:00", "16:00"];
      if (timeSlot && (typeof timeSlot !== "string" || !VALID_CUSTOMER_SLOTS.includes(timeSlot))) {
        return NextResponse.json({ error: "시간대 형식이 올바르지 않습니다" }, { status: 400 });
      }
      const rescheduleData: Partial<Booking> = {};
      if (date) rescheduleData.date = date;
      if (timeSlot) rescheduleData.timeSlot = timeSlot;
      // 날짜/시간 변경 시 admin이 확정한 시간 초기화 (관리자가 다시 확인해야 함)
      if (date || timeSlot) rescheduleData.confirmedTime = null;
      const updated = await updateBooking(id, rescheduleData);
      if (!updated) {
        return NextResponse.json({ error: "수정 실패" }, { status: 500 });
      }
      sendBookingUpdated(updated).catch(() => {});
      return NextResponse.json({ booking: updated });
    }

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

    // pending 또는 quote_confirmed 상태에서만 취소 가능
    if (booking.status !== "pending" && booking.status !== "quote_confirmed") {
      return NextResponse.json(
        { error: "수거 진행 중에는 취소할 수 없습니다" },
        { status: 400 },
      );
    }

    // 수거일 전날 22시(KST) 이후에는 취소 불가
    if (new Date() >= getCustomerDeadline(booking.date)) {
      return NextResponse.json(
        { error: "수거일 전날 22시 이후에는 취소할 수 없습니다. 취소가 필요하시면 고객센터로 문의해 주세요." },
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

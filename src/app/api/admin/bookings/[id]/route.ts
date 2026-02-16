import { NextRequest, NextResponse } from "next/server";
import { getAllBookings, updateBooking } from "@/lib/db";
import { validateToken, getAdminFromToken } from "@/app/api/admin/auth/route";
import { supabase } from "@/lib/supabase";
import {
  sendQuoteConfirmed,
  sendStatusChanged,
  sendAdminMemoUpdated,
} from "@/lib/slack-notify";
import { sendStatusSms } from "@/lib/sms-notify";

// 관리자용 getBookingById (취소된 건 포함)
async function getBookingByIdAdmin(id: string) {
  const all = await getAllBookings();
  return all.find((b) => b.id === id) || null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const booking = await getBookingByIdAdmin(id);
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
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await req.json();

    // 허용되는 업데이트 필드만 추출
    const allowedUpdates: Record<string, unknown> = {};
    if (body.status !== undefined) allowedUpdates.status = body.status;
    if (body.finalPrice !== undefined) allowedUpdates.finalPrice = body.finalPrice;
    if (body.adminMemo !== undefined) allowedUpdates.adminMemo = body.adminMemo;
    if (body.confirmedTime !== undefined) allowedUpdates.confirmedTime = body.confirmedTime;
    if (body.items !== undefined) allowedUpdates.items = body.items;

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        { error: "수정할 필드가 없습니다 (status, finalPrice, adminMemo, confirmedTime, items)" },
        { status: 400 },
      );
    }

    const existing = await getBookingByIdAdmin(id);
    if (!existing) {
      return NextResponse.json(
        { error: "예약을 찾을 수 없습니다" },
        { status: 404 },
      );
    }

    const previousStatus = existing.status;
    const previousMemo = existing.adminMemo;
    const updated = await updateBooking(id, allowedUpdates);

    if (!updated) {
      return NextResponse.json(
        { error: "예약을 찾을 수 없습니다" },
        { status: 404 },
      );
    }

    // Slack 알림 발송 (상태가 변경된 경우에만)
    const newStatus = body.status;
    if (newStatus && newStatus !== previousStatus) {
      if (newStatus === "quote_confirmed") {
        sendQuoteConfirmed(updated).catch(() => {});
      } else {
        sendStatusChanged(updated, newStatus).catch(() => {});
      }
      // SMS 알림 (fire-and-forget)
      if (updated.phone) {
        sendStatusSms(updated.phone, newStatus, id, updated.finalPrice).catch(() => {});
      }
    }

    // 관리자 메모 변경 시 스레드 답글
    if (body.adminMemo !== undefined && body.adminMemo !== previousMemo && body.adminMemo) {
      sendAdminMemoUpdated(updated, body.adminMemo).catch(() => {});
    }

    // Audit log (fire-and-forget)
    const { adminId, adminEmail } = getAdminFromToken(req);
    const action = newStatus && newStatus !== previousStatus
      ? "status_change"
      : body.items !== undefined
        ? "items_update"
        : "info_update";
    const details: Record<string, unknown> = {};
    if (newStatus && newStatus !== previousStatus) {
      details.previousStatus = previousStatus;
      details.newStatus = newStatus;
    }
    if (body.finalPrice !== undefined) details.finalPrice = body.finalPrice;
    if (body.adminMemo !== undefined) details.adminMemo = body.adminMemo;
    if (body.confirmedTime !== undefined) details.confirmedTime = body.confirmedTime;
    if (body.items !== undefined) details.itemCount = body.items.length;

    Promise.resolve(
      supabase
        .from("admin_audit_log")
        .insert({
          admin_id: adminId,
          admin_email: adminEmail,
          booking_id: id,
          action,
          details,
        }),
    ).catch(() => {});

    return NextResponse.json({ booking: updated });
  } catch (e) {
    return NextResponse.json(
      { error: "수정 실패", detail: String(e) },
      { status: 500 },
    );
  }
}

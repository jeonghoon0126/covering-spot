import { NextRequest, NextResponse } from "next/server";
import { getBookingByIdAdmin, updateBooking } from "@/lib/db";
import { validateToken, getAdminFromToken } from "@/app/api/admin/auth/route";
import { supabase } from "@/lib/supabase";
import { hasPermission } from "@/lib/admin-roles";
import { BookingUpdateSchema } from "@/lib/validation";
import {
  sendQuoteConfirmed,
  sendStatusChanged,
  sendAdminMemoUpdated,
} from "@/lib/slack-notify";
import { sendStatusSms } from "@/lib/sms-notify";
import { createPaymentLink } from "@/lib/payment-link";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["quote_confirmed", "rejected", "cancelled"],
  quote_confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: ["payment_requested"],
  payment_requested: ["payment_completed"],
};

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
    console.error("[admin/bookings/[id]/GET]", e);
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
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await req.json();

    // Zod 서버사이드 검증
    const parsed = BookingUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다", fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // 역할 기반 권한 검사
    const { adminId, adminEmail, role } = getAdminFromToken(req);

    // Zod 파싱 완료 후 parsed.data 사용 (raw body 대신 검증/변환된 값 사용)
    const data = parsed.data;

    // payment_completed 상태 변경은 admin만 가능
    if (data.status === "payment_completed" && !hasPermission(role, "payment_confirm")) {
      return NextResponse.json(
        { error: "정산 완료 권한이 없습니다" },
        { status: 403 },
      );
    }

    // 가격 변경은 admin만 가능
    if (data.finalPrice !== undefined && !hasPermission(role, "price_change")) {
      return NextResponse.json(
        { error: "가격 변경 권한이 없습니다" },
        { status: 403 },
      );
    }

    // 허용되는 업데이트 필드만 추출 (Zod 변환 완료된 parsed.data 사용)
    const allowedUpdates: Record<string, unknown> = {};
    if (data.status !== undefined) allowedUpdates.status = data.status;
    if (data.finalPrice !== undefined) allowedUpdates.finalPrice = data.finalPrice;
    if (data.adminMemo !== undefined) allowedUpdates.adminMemo = data.adminMemo;
    if (data.confirmedTime !== undefined) allowedUpdates.confirmedTime = data.confirmedTime;
    if (data.items !== undefined) allowedUpdates.items = data.items;
    if (data.driverId !== undefined) allowedUpdates.driverId = data.driverId;
    if (data.driverName !== undefined) allowedUpdates.driverName = data.driverName;
    if (data.confirmedDuration !== undefined) allowedUpdates.confirmedDuration = data.confirmedDuration;
    if (data.completionPhotos !== undefined) allowedUpdates.completionPhotos = data.completionPhotos;

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        { error: "수정할 필드가 없습니다 (status, finalPrice, adminMemo, confirmedTime, confirmedDuration, completionPhotos, items, driverId, driverName)" },
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

    if (data.status && data.status !== existing.status) {
      const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(data.status)) {
        return NextResponse.json(
          { error: `'${existing.status}' 상태에서 '${data.status}'(으)로 변경할 수 없습니다.` },
          { status: 422 },
        );
      }
    }

    const previousStatus = existing.status;
    const previousMemo = existing.adminMemo;

    // expectedUpdatedAt가 있으면 optimistic locking 적용
    const expectedUpdatedAt: string | undefined = data.expectedUpdatedAt;
    if (!expectedUpdatedAt) {
      console.warn("[admin/bookings] expectedUpdatedAt 미제공 — 동시 수정 충돌 감지 비활성화", { bookingId: id, adminId });
    }
    const updated = await updateBooking(id, allowedUpdates, expectedUpdatedAt);

    if (!updated) {
      // updateBooking이 null을 반환했지만 existing은 존재 → 동시 수정 충돌
      if (expectedUpdatedAt) {
        return NextResponse.json(
          {
            error: "다른 관리자가 이미 수정했습니다. 새로고침 후 다시 시도해 주세요.",
            code: "CONFLICT",
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "예약을 찾을 수 없습니다" },
        { status: 404 },
      );
    }

    // Slack 알림 발송 (상태가 변경된 경우에만)
    const newStatus = data.status;
    if (newStatus && newStatus !== previousStatus) {
      if (newStatus === "quote_confirmed") {
        sendQuoteConfirmed(updated).catch(() => {});
      } else {
        sendStatusChanged(updated, newStatus).catch(() => {});
      }
      // 결제 링크 생성 + SMS 알림 (fire-and-forget)
      if (updated.phone) {
        if (newStatus === "payment_requested") {
          createPaymentLink(id, updated.finalPrice ?? 0, updated.customerName ?? "")
            .then((paymentUrl) => {
              sendStatusSms(updated.phone, newStatus, id, updated.finalPrice, paymentUrl).catch((err) => console.error("[SMS 발송 실패]", { status: newStatus, bookingId: id, error: err?.message }));
            })
            .catch(() => {
              sendStatusSms(updated.phone, newStatus, id, updated.finalPrice).catch((err) => console.error("[SMS 발송 실패]", { status: newStatus, bookingId: id, error: err?.message }));
            });
        } else {
          sendStatusSms(updated.phone, newStatus, id, updated.finalPrice).catch((err) => console.error("[SMS 발송 실패]", { status: newStatus, bookingId: id, error: err?.message }));
        }
      }
      // 푸시 알림 (fire-and-forget)
      const STATUS_MSG: Record<string, string> = {
        quote_confirmed: `견적이 확정되었어요! ${updated.finalPrice ? `최종 견적: ${updated.finalPrice.toLocaleString("ko-KR")}원` : "자세한 내용을 확인해 주세요."}`,
        in_progress: "수거 팀이 출발했어요! 도착 예정 시간에 맞춰 준비 부탁드려요.",
        completed: "수거가 완료되었어요! 이용해 주셔서 감사합니다.",
        payment_completed: "정산이 완료되었습니다. 감사합니다!",
      };
      if (STATUS_MSG[newStatus]) {
        fetch(new URL("/api/push/send", req.url), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-token": process.env.INTERNAL_PUSH_SECRET || "",
          },
          body: JSON.stringify({
            bookingId: id,
            title: "커버링 방문수거",
            message: STATUS_MSG[newStatus],
            url: `/booking/manage?id=${id}`,
          }),
        }).catch(() => {});
      }
    }

    // 관리자 메모 변경 시 스레드 답글
    if (data.adminMemo !== undefined && data.adminMemo !== previousMemo && data.adminMemo) {
      sendAdminMemoUpdated(updated, data.adminMemo).catch(() => {});
    }

    // Audit log (fire-and-forget)
    const action = newStatus && newStatus !== previousStatus
      ? "status_change"
      : data.items !== undefined
        ? "items_update"
        : "info_update";
    const details: Record<string, unknown> = {};
    if (newStatus && newStatus !== previousStatus) {
      details.previousStatus = previousStatus;
      details.newStatus = newStatus;
    }
    if (data.finalPrice !== undefined) details.finalPrice = data.finalPrice;
    if (data.adminMemo !== undefined) details.adminMemo = data.adminMemo;
    if (data.confirmedTime !== undefined) details.confirmedTime = data.confirmedTime;
    if (data.confirmedDuration !== undefined) details.confirmedDuration = data.confirmedDuration;
    if (data.completionPhotos !== undefined) details.completionPhotoCount = data.completionPhotos.length;
    if (data.items !== undefined) details.itemCount = data.items.length;

    // Audit log with retry (최대 3회 재시도 — 감사 기록 손실 방지)
    (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await supabase
          .from("admin_audit_log")
          .insert({ admin_id: adminId, admin_email: adminEmail, booking_id: id, action, details });
        if (!error) return;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
        else console.error("[audit_log] 저장 실패 (3회 시도)", { bookingId: id, action, error: error.message });
      }
    })();

    return NextResponse.json({ booking: updated });
  } catch (e) {
    console.error("[admin/bookings/[id]/PUT]", e);
    return NextResponse.json(
      { error: "수정 실패" },
      { status: 500 },
    );
  }
}

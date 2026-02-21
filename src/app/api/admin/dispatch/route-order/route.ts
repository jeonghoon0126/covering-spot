import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateBooking } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";
import type { Booking } from "@/types/booking";

const RouteOrderSchema = z.object({
  updates: z
    .array(
      z.object({
        bookingId: z.string().uuid(),
        routeOrder: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(50),
});

/**
 * PUT /api/admin/dispatch/route-order
 * 기사별 경로 순서 일괄 업데이트
 *
 * 보안:
 *  - Admin 토큰 필수
 *  - UUID 형식 검증 (Zod) → SQL injection 방어
 *  - max 50건 제한 (DoS 방어)
 *  - Promise.allSettled → 부분 실패 안전 처리
 */
export async function PUT(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "요청 본문이 필요합니다" }, { status: 400 });
    }

    const parsed = RouteOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "잘못된 요청", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { updates } = parsed.data;

    const results = await Promise.allSettled(
      updates.map(({ bookingId, routeOrder }) =>
        updateBooking(bookingId, { routeOrder } as Partial<Booking>),
      ),
    );

    const succeeded: string[] = [];
    const failed: string[] = [];

    results.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value !== null) {
        succeeded.push(updates[idx].bookingId);
      } else {
        failed.push(updates[idx].bookingId);
      }
    });

    if (failed.length > 0 && succeeded.length === 0) {
      return NextResponse.json(
        { error: "모든 업데이트 실패", failed },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      updated: succeeded,
      ...(failed.length > 0 ? { partialFailure: true, failed } : {}),
    });
  } catch (e) {
    console.error("[admin/dispatch/route-order PUT]", e);
    return NextResponse.json({ error: "순서 업데이트 실패" }, { status: 500 });
  }
}

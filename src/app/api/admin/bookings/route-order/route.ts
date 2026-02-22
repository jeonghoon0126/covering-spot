import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateBooking } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";
import type { Booking } from "@/types/booking";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Schema = z.array(
  z.object({
    id: z.string().regex(UUID_REGEX, "유효하지 않은 id"),
    routeOrder: z.number().int().positive(),
  }),
).min(1).max(100);

/**
 * PATCH /api/admin/bookings/route-order
 * 배차된 주문의 routeOrder 일괄 업데이트 (flat list DnD 순서 저장)
 */
export async function PATCH(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "유효하지 않은 JSON입니다" }, { status: 400 });
    }

    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const results = await Promise.allSettled(
      parsed.data.map(({ id, routeOrder }) =>
        updateBooking(id, { routeOrder } as Partial<Booking>),
      ),
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    return NextResponse.json({
      updated: parsed.data.length - failed,
      ...(failed > 0 ? { failed } : {}),
    });
  } catch (e) {
    console.error("[bookings/route-order/PATCH]", e);
    return NextResponse.json({ error: "순서 저장 실패" }, { status: 500 });
  }
}

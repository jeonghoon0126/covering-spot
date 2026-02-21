import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getBlockedSlots,
  getBlockedSlotsRange,
  createBlockedSlot,
  deleteBlockedSlot,
} from "@/lib/db";
import { validateToken, getAdminFromToken } from "@/app/api/admin/auth/route";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^\d{2}:\d{2}$/;

const createBlockedSlotSchema = z.object({
  date: z.string().regex(dateRegex, "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)"),
  timeStart: z.string().regex(timeRegex, "시작 시간 형식이 올바르지 않습니다 (HH:mm)"),
  timeEnd: z.string().regex(timeRegex, "종료 시간 형식이 올바르지 않습니다 (HH:mm)"),
  reason: z.string().max(200).optional(),
  driverId: z.string().uuid("driverId 형식이 올바르지 않습니다").nullable().optional(),
});

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
    const driverIdParam = req.nextUrl.searchParams.get("driverId");
    if (driverIdParam && !uuidRegex.test(driverIdParam)) {
      return NextResponse.json(
        { error: "유효하지 않은 driverId 형식입니다" },
        { status: 400 },
      );
    }
    const driverId = driverIdParam || undefined;

    let slots;
    if (date) {
      if (!dateRegex.test(date)) {
        return NextResponse.json(
          { error: "date 형식이 올바르지 않습니다 (YYYY-MM-DD)" },
          { status: 400 },
        );
      }
      slots = await getBlockedSlots(date, driverId);
    } else if (dateFrom && dateTo) {
      if (!dateRegex.test(dateFrom) || !dateRegex.test(dateTo)) {
        return NextResponse.json(
          { error: "dateFrom/dateTo 형식이 올바르지 않습니다 (YYYY-MM-DD)" },
          { status: 400 },
        );
      }
      if (dateFrom > dateTo) {
        return NextResponse.json(
          { error: "dateFrom은 dateTo 이전이어야 합니다" },
          { status: 400 },
        );
      }
      // 최대 조회 범위 90일 제한
      const msPerDay = 24 * 60 * 60 * 1000;
      const rangeDays = (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / msPerDay;
      if (rangeDays > 90) {
        return NextResponse.json(
          { error: "조회 범위는 최대 90일입니다" },
          { status: 400 },
        );
      }
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

    const parsed = createBlockedSlotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { date, timeStart, timeEnd, reason, driverId } = parsed.data;

    // timeStart < timeEnd 검증
    if (timeStart >= timeEnd) {
      return NextResponse.json(
        { error: "종료 시간은 시작 시간 이후여야 합니다" },
        { status: 400 },
      );
    }

    const { adminEmail } = getAdminFromToken(req);

    const slot = await createBlockedSlot({
      date,
      timeStart,
      timeEnd,
      reason,
      createdBy: adminEmail || undefined,
      driverId: driverId ?? null,
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
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "유효하지 않은 id 형식입니다" },
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

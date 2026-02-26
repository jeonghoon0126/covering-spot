import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getDriverVehicleAssignments,
  createDriverVehicleAssignment,
  deleteDriverVehicleAssignment,
} from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createSchema = z.object({
  driverId: z.string().uuid("유효하지 않은 driverId입니다"),
  vehicleId: z.string().uuid("유효하지 않은 vehicleId입니다"),
  date: z.string().regex(DATE_REGEX, "date 형식: YYYY-MM-DD"),
});

export async function GET(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    const date = req.nextUrl.searchParams.get("date") || undefined;
    const driverId = req.nextUrl.searchParams.get("driverId") || undefined;
    const assignments = await getDriverVehicleAssignments(date, driverId);
    return NextResponse.json({ assignments });
  } catch (e) {
    console.error("[admin/assignments/GET]", e);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "유효하지 않은 JSON입니다" }, { status: 400 });
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { driverId, vehicleId, date } = parsed.data;
    const assignment = await createDriverVehicleAssignment(driverId, vehicleId, date);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (e) {
    // UNIQUE 제약 위반 (23505)
    const err = e as { code?: string };
    if (err?.code === "23505") {
      return NextResponse.json(
        { error: "해당 날짜에 이미 배정된 기사 또는 차량이 있습니다" },
        { status: 409 },
      );
    }
    console.error("[admin/assignments/POST]", e);
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    const id = req.nextUrl.searchParams.get("id");
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "유효한 id가 필요합니다" }, { status: 400 });
    }
    const deleted = await deleteDriverVehicleAssignment(id);
    if (!deleted) {
      return NextResponse.json({ error: "배정을 찾을 수 없습니다" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[admin/assignments/DELETE]", e);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}

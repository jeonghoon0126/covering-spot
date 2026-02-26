import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getVehicleUnavailablePeriods,
  createVehicleUnavailablePeriod,
  deleteVehicleUnavailablePeriod,
} from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createSchema = z.object({
  vehicleId: z.string().uuid("유효하지 않은 vehicleId입니다"),
  startDate: z.string().regex(DATE_REGEX, "startDate 형식: YYYY-MM-DD"),
  endDate: z.string().regex(DATE_REGEX, "endDate 형식: YYYY-MM-DD"),
  reason: z.string().max(200).default(""),
}).refine((d) => d.startDate <= d.endDate, { message: "startDate는 endDate보다 이전이어야 합니다" });

export async function GET(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    const vehicleId = req.nextUrl.searchParams.get("vehicleId") || undefined;
    const periods = await getVehicleUnavailablePeriods(vehicleId);
    return NextResponse.json({ periods });
  } catch (e) {
    console.error("[admin/vehicles/unavailable/GET]", e);
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
    const { vehicleId, startDate, endDate, reason } = parsed.data;
    const period = await createVehicleUnavailablePeriod(vehicleId, startDate, endDate, reason);
    return NextResponse.json({ period }, { status: 201 });
  } catch (e) {
    console.error("[admin/vehicles/unavailable/POST]", e);
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
    const deleted = await deleteVehicleUnavailablePeriod(id);
    if (!deleted) {
      return NextResponse.json({ error: "이용불가 기간을 찾을 수 없습니다" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[admin/vehicles/unavailable/DELETE]", e);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}

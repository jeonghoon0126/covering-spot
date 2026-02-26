import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getVehicles, createVehicle, updateVehicle, deleteVehicle } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";

const VEHICLE_TYPES = ["1톤", "1.4톤", "2.5톤", "5톤"] as const;

const createVehicleSchema = z.object({
  name: z.string().min(1, "name 필드가 필요합니다").max(50),
  type: z.enum(VEHICLE_TYPES).default("1톤"),
  capacity: z.number().min(0.1).max(50),
  licensePlate: z.string().max(20).optional(),
});

const updateVehicleSchema = z.object({
  id: z.string().uuid("유효하지 않은 id 형식입니다"),
  name: z.string().min(1).max(50).optional(),
  type: z.enum(VEHICLE_TYPES).optional(),
  capacity: z.number().min(0.1).max(50).optional(),
  licensePlate: z.string().max(20).nullable().optional(),
  active: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    const activeParam = req.nextUrl.searchParams.get("active");
    const activeOnly = activeParam === "true";
    const vehicles = await getVehicles(activeOnly);
    return NextResponse.json({ vehicles });
  } catch (e) {
    console.error("[admin/vehicles/GET]", e);
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
    const parsed = createVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { name, type, capacity, licensePlate } = parsed.data;
    const vehicle = await createVehicle(name, type, capacity, licensePlate);
    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (e) {
    console.error("[admin/vehicles/POST]", e);
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "유효하지 않은 JSON입니다" }, { status: 400 });
    }
    const parsed = updateVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { id, ...updates } = parsed.data;
    const vehicle = await updateVehicle(id, updates);
    if (!vehicle) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다" }, { status: 404 });
    }
    return NextResponse.json({ vehicle });
  } catch (e) {
    console.error("[admin/vehicles/PUT]", e);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    const id = req.nextUrl.searchParams.get("id");
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "유효한 id가 필요합니다" }, { status: 400 });
    }
    const deleted = await deleteVehicle(id);
    if (!deleted) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[admin/vehicles/DELETE]", e);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}

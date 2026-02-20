import { NextRequest, NextResponse } from "next/server";
import {
  getDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
} from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    const activeParam = req.nextUrl.searchParams.get("active");
    const activeOnly = activeParam !== "false";

    const drivers = await getDrivers(activeOnly);
    return NextResponse.json({ drivers });
  } catch (e) {
    console.error("[admin/drivers/GET]", e);
    return NextResponse.json(
      { error: "조회 실패" },
      { status: 500 },
    );
  }
}

const phoneRegex = /^01[0-9]\d{7,8}$/;

const createDriverSchema = z.object({
  name: z.string().min(1, "name 필드가 필요합니다").max(50),
  phone: z.string().regex(phoneRegex, "올바른 전화번호 형식이 아닙니다").optional(),
  vehicleType: z.enum(['1톤', '1.4톤', '2.5톤', '5톤']).optional().default('1톤'),
  vehicleCapacity: z.number().min(0).max(50).optional(),
  licensePlate: z.string().max(20).optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    const body = await req.json();

    const parsed = createDriverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { name, phone, vehicleType, vehicleCapacity, licensePlate } = parsed.data;
    const driver = await createDriver(name, phone, vehicleType, vehicleCapacity, licensePlate);
    return NextResponse.json({ driver }, { status: 201 });
  } catch (e) {
    console.error("[admin/drivers/POST]", e);
    return NextResponse.json(
      { error: "생성 실패" },
      { status: 500 },
    );
  }
}

const updateDriverSchema = z.object({
  id: z.string().min(1, "id 필드가 필요합니다"),
  name: z.string().min(1).max(50).optional(),
  phone: z.string().regex(phoneRegex, "올바른 전화번호 형식이 아닙니다").optional(),
  active: z.boolean().optional(),
  vehicleType: z.enum(['1톤', '1.4톤', '2.5톤', '5톤']).optional(),
  vehicleCapacity: z.number().min(0).max(50).optional(),
  licensePlate: z.string().max(20).optional(),
});

export async function PUT(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    const body = await req.json();

    const parsed = updateDriverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { id, name, phone, active, vehicleType, vehicleCapacity, licensePlate } = parsed.data;

    const updates: {
      name?: string;
      phone?: string;
      active?: boolean;
      vehicleType?: string;
      vehicleCapacity?: number;
      licensePlate?: string;
    } = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (active !== undefined) updates.active = active;
    if (vehicleType !== undefined) updates.vehicleType = vehicleType;
    if (vehicleCapacity !== undefined) updates.vehicleCapacity = vehicleCapacity;
    if (licensePlate !== undefined) updates.licensePlate = licensePlate;

    const driver = await updateDriver(id, updates);
    if (!driver) {
      return NextResponse.json(
        { error: "기사를 찾을 수 없습니다" },
        { status: 404 },
      );
    }

    return NextResponse.json({ driver });
  } catch (e) {
    console.error("[admin/drivers/PUT]", e);
    return NextResponse.json(
      { error: "수정 실패" },
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

    const deleted = await deleteDriver(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "기사를 찾을 수 없습니다" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[admin/drivers/DELETE]", e);
    return NextResponse.json(
      { error: "삭제 실패" },
      { status: 500 },
    );
  }
}

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

const VALID_WORK_DAYS = ["월", "화", "수", "목", "금", "토", "일"];

function validateWorkDays(val: string): boolean {
  if (!val) return false;
  return val.split(",").every((d) => VALID_WORK_DAYS.includes(d.trim()));
}

const VALID_WORK_SLOTS = ["오전 (9시~12시)", "오후 (13시~17시)", "저녁 (18시~20시)"];

function validateWorkSlots(val: string): boolean {
  if (!val) return true; // 빈 문자열 = 모든 슬롯 허용
  return val.split(",").every((s) => VALID_WORK_SLOTS.includes(s.trim()));
}

const createDriverSchema = z.object({
  name: z.string().min(1, "name 필드가 필요합니다").max(50),
  phone: z.string().regex(phoneRegex, "올바른 전화번호 형식이 아닙니다").optional(),
  vehicleType: z.enum(['1톤', '1.4톤', '2.5톤', '5톤']).optional().default('1톤'),
  vehicleCapacity: z.number().min(0).max(50).optional(),
  licensePlate: z.string().max(20).optional(),
  workDays: z.string().optional().refine((v) => !v || validateWorkDays(v), { message: "올바른 근무요일 형식이 아닙니다" }),
  workSlots: z.string().optional().default("").refine((v) => !v || validateWorkSlots(v), { message: "올바른 슬롯 형식이 아닙니다 (예: 오전 (9시~12시),오후 (13시~17시))" }),
});

export async function POST(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "유효하지 않은 JSON입니다" }, { status: 400 });
    }

    const parsed = createDriverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { name, phone, vehicleType, vehicleCapacity, licensePlate, workDays, workSlots } = parsed.data;
    const driver = await createDriver(name, phone, vehicleType, vehicleCapacity, licensePlate, workDays, workSlots);
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
  id: z.string().uuid("유효하지 않은 id 형식입니다"),
  name: z.string().min(1).max(50).optional(),
  phone: z.string().regex(phoneRegex, "올바른 전화번호 형식이 아닙니다").optional(),
  active: z.boolean().optional(),
  vehicleType: z.enum(['1톤', '1.4톤', '2.5톤', '5톤']).optional(),
  vehicleCapacity: z.number().min(0).max(50).optional(),
  licensePlate: z.string().max(20).optional(),
  workDays: z.string().optional().refine((v) => !v || validateWorkDays(v), { message: "올바른 근무요일 형식이 아닙니다" }),
  workSlots: z.string().optional().refine((v) => v === undefined || validateWorkSlots(v), { message: "올바른 슬롯 형식이 아닙니다 (예: 오전 (9시~12시),오후 (13시~17시))" }),
});

export async function PUT(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "유효하지 않은 JSON입니다" }, { status: 400 });
    }

    const parsed = updateDriverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { id, name, phone, active, vehicleType, vehicleCapacity, licensePlate, workDays, workSlots } = parsed.data;

    const updates: {
      name?: string;
      phone?: string;
      active?: boolean;
      vehicleType?: string;
      vehicleCapacity?: number;
      licensePlate?: string;
      workDays?: string;
      workSlots?: string;
    } = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (active !== undefined) updates.active = active;
    if (vehicleType !== undefined) updates.vehicleType = vehicleType;
    if (vehicleCapacity !== undefined) updates.vehicleCapacity = vehicleCapacity;
    if (licensePlate !== undefined) updates.licensePlate = licensePlate;
    if (workDays !== undefined) updates.workDays = workDays;
    if (workSlots !== undefined) updates.workSlots = workSlots;

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
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json(
        { error: "유효하지 않은 id 형식입니다" },
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

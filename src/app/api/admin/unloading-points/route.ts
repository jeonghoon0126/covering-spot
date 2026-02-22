import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUnloadingPoints, createUnloadingPoint, updateUnloadingPoint, deleteUnloadingPoint } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";
import { geocodeAddress } from "@/lib/geocode";

/**
 * GET /api/admin/unloading-points
 * 하차지 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    const points = await getUnloadingPoints(false); // 비활성 포함 전체 조회
    return NextResponse.json({ points });
  } catch (e) {
    console.error("[unloading-points/GET]", e);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

const CreateSchema = z.object({
  // trim()으로 공백만 입력된 경우 방어 (예: "   " → "" → min(1) 실패)
  name: z.string().trim().min(1).max(50),
  address: z.string().trim().min(1).max(200),
});

/**
 * POST /api/admin/unloading-points
 * 하차지 생성 (주소 → 자동 지오코딩)
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "잘못된 요청", details: parsed.error.format() }, { status: 400 });
    }

    const { name, address } = parsed.data;

    // 지오코딩
    const coords = await geocodeAddress(address);
    if (!coords) {
      return NextResponse.json({ error: "주소를 찾을 수 없습니다. 정확한 도로명 주소를 입력해주세요." }, { status: 400 });
    }

    const point = await createUnloadingPoint(name, address, coords.lat, coords.lng);
    return NextResponse.json({ point }, { status: 201 });
  } catch (e) {
    console.error("[unloading-points/POST]", e);
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }
}

const UpdateSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(50).optional(),
    address: z.string().trim().min(1).max(200).optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.address !== undefined || d.active !== undefined,
    { message: "수정할 필드를 하나 이상 입력해주세요" },
  );

/**
 * PUT /api/admin/unloading-points
 * 하차지 수정
 */
export async function PUT(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "잘못된 요청", details: parsed.error.format() }, { status: 400 });
    }

    const { id, ...updates } = parsed.data;

    // 주소 변경 시 재지오코딩
    let coords: { latitude: number; longitude: number } | undefined;
    if (updates.address) {
      const geo = await geocodeAddress(updates.address);
      if (!geo) {
        return NextResponse.json({ error: "주소를 찾을 수 없습니다" }, { status: 400 });
      }
      coords = { latitude: geo.lat, longitude: geo.lng };
    }

    const point = await updateUnloadingPoint(id, { ...updates, ...coords });
    if (!point) {
      return NextResponse.json({ error: "하차지를 찾을 수 없습니다" }, { status: 404 });
    }
    return NextResponse.json({ point });
  } catch (e) {
    console.error("[unloading-points/PUT]", e);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}

const DeleteSchema = z.object({ id: z.string().uuid() });

/**
 * DELETE /api/admin/unloading-points
 * 하차지 삭제
 */
export async function DELETE(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    const body = await req.json();
    const parsed = DeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
    }

    const deleted = await deleteUnloadingPoint(parsed.data.id);
    if (!deleted) {
      return NextResponse.json({ error: "하차지를 찾을 수 없습니다" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[unloading-points/DELETE]", e);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}

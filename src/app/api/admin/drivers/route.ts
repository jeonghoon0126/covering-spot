import { NextRequest, NextResponse } from "next/server";
import {
  getDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
} from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";

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

export async function POST(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    const body = await req.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "name 필드가 필요합니다" },
        { status: 400 },
      );
    }

    const driver = await createDriver(body.name, body.phone);
    return NextResponse.json({ driver }, { status: 201 });
  } catch (e) {
    console.error("[admin/drivers/POST]", e);
    return NextResponse.json(
      { error: "생성 실패" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "id 필드가 필요합니다" },
        { status: 400 },
      );
    }

    const updates: { name?: string; phone?: string; active?: boolean } = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.active !== undefined) updates.active = body.active;

    const driver = await updateDriver(body.id, updates);
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

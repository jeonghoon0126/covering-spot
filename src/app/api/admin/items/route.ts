import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateToken, getAdminFromToken } from "@/app/api/admin/auth/route";
import { insertSpotItem } from "@/lib/db";
import { hasPermission } from "@/lib/admin-roles";

const NewItemSchema = z.object({
  category: z.string().min(1, "카테고리는 필수입니다."),
  name: z.string().min(1, "품목명은 필수입니다."),
  displayName: z.string().min(1, "표시명은 필수입니다."),
  price: z.number().int().min(0, "가격은 0 이상이어야 합니다."),
  loadingCube: z.number().min(0, "적재 큐브는 0 이상이어야 합니다."),
});

export async function POST(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const { role } = getAdminFromToken(req);
    if (!hasPermission(role, "price_change")) {
      return NextResponse.json({ error: "품목 관리 권한이 없습니다" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = NewItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "입력값이 올바르지 않습니다", details: parsed.error.flatten() }, { status: 400 });
    }

    const newItem = await insertSpotItem(parsed.data);

    return NextResponse.json({ item: newItem }, { status: 201 });

  } catch (e) {
    console.error("[admin/items/POST]", e);
    const errorMessage = e instanceof Error ? e.message : "품목 등록 실패";
    if (errorMessage.includes('duplicate key value violates unique constraint')) {
      return NextResponse.json({ error: "이미 동일한 이름의 품목이 존재합니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "서버 오류로 품목 등록에 실패했습니다." }, { status: 500 });
  }
}

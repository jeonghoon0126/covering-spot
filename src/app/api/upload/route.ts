import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(getRateLimitKey(req), 10, 60_000); // 10 uploads per minute
    if (!rl.allowed) {
      return NextResponse.json({ error: "요청이 너무 많습니다" }, { status: 429 });
    }

    const formData = await req.formData();
    const files = formData.getAll("photos") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "파일이 필요합니다" },
        { status: 400 },
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { error: "최대 10개 파일까지 업로드 가능합니다" },
        { status: 400 },
      );
    }

    const urls: string[] = [];

    for (const file of files) {
      // 안전한 이미지 MIME 타입만 허용 (SVG/HTML 등 XSS 위험 차단)
      const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "JPG, PNG, WebP, HEIC 파일만 업로드 가능합니다" },
          { status: 400 },
        );
      }

      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "파일 크기는 5MB 이하만 가능합니다" },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      // 확장자는 MIME 타입에서 추출 (사용자 입력 대신)
      const EXT_MAP: Record<string, string> = {
        "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
        "image/heic": "heic", "image/heif": "heif",
      };
      const ext = EXT_MAP[file.type] || "jpg";
      const fileName = `booking_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;

      const { error } = await supabase.storage
        .from("booking-photos")
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("booking-photos")
        .getPublicUrl(fileName);

      urls.push(urlData.publicUrl);
    }

    return NextResponse.json({ urls });
  } catch (e) {
    console.error("[upload/POST]", e);
    return NextResponse.json(
      { error: "업로드 실패" },
      { status: 500 },
    );
  }
}

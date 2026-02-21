import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createDriverToken } from "@/lib/driver-auth";

// 전화번호 입력 최대 길이 (DoS 방어)
const MAX_PHONE_LENGTH = 20;

/**
 * 전화번호 정규화: DB 저장 형식(xxx-xxxx-xxxx) + 숫자만 형식 두 가지 반환
 * +82/82 prefix 처리 (길이 무관)
 */
function normalizePhone(raw: string): { formatted: string; digits: string } {
  const rawDigits = raw.replace(/[^\d]/g, "");

  // +82 prefix 처리: 82로 시작하고 길이가 11자 이상이면 0으로 치환
  // 예: 821012345678(12자) → 01012345678(11자)
  const local =
    rawDigits.startsWith("82") && rawDigits.length >= 11
      ? "0" + rawDigits.slice(2)
      : rawDigits;

  // 11자리 휴대폰 → 하이픈 포맷
  const formatted =
    local.length === 11
      ? `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`
      : local;

  return { formatted, digits: local };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.phone !== "string") {
      return NextResponse.json({ error: "전화번호를 입력해주세요" }, { status: 400 });
    }

    const rawPhone = body.phone.trim();
    if (!rawPhone) {
      return NextResponse.json({ error: "전화번호를 입력해주세요" }, { status: 400 });
    }

    // 입력 길이 제한 (DoS 방어)
    if (rawPhone.length > MAX_PHONE_LENGTH) {
      return NextResponse.json({ error: "전화번호를 확인해주세요" }, { status: 400 });
    }

    const { formatted, digits } = normalizePhone(rawPhone);

    // 하이픈 포함/미포함 두 형식 모두 조회 (DB 저장 방식 불일치 방어)
    // .in() 사용: .or() raw string 대비 SQL injection 안전
    const phoneVariants = [...new Set([formatted, digits])];
    const { data, error } = await supabase
      .from("drivers")
      .select("id, name, phone, active")
      .eq("active", true)
      .in("phone", phoneVariants)
      .limit(1);

    if (error) {
      console.error("[driver/auth POST] supabase error:", error);
      return NextResponse.json({ error: "인증 실패" }, { status: 500 });
    }

    const driver = data?.[0];
    // 존재 여부와 무관하게 동일한 메시지로 통일 (전화번호 존재 여부 열거 방지)
    if (!driver) {
      return NextResponse.json(
        { error: "인증 정보를 확인해주세요" },
        { status: 401 },
      );
    }

    const token = createDriverToken(driver.id, driver.name);

    return NextResponse.json({
      token,
      driverName: driver.name,
      expiresIn: 12 * 60 * 60, // 12시간 (초)
    });
  } catch (e) {
    console.error("[driver/auth POST]", e);
    return NextResponse.json({ error: "인증 실패" }, { status: 500 });
  }
}

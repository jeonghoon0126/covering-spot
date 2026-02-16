import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// 세션 만료 시간: 24시간
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function getSecret(): string {
  return process.env.ADMIN_PASSWORD || "fallback-secret";
}

// HMAC 기반 토큰 생성 (서버리스 호환 - 상태 없음)
function createToken(): { token: string; expiresIn: number } {
  const exp = Date.now() + SESSION_TTL_MS;
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(String(exp))
    .digest("hex");
  return {
    token: `${exp}:${signature}`,
    expiresIn: SESSION_TTL_MS / 1000,
  };
}

// 토큰 검증 헬퍼 (다른 admin API에서 사용)
// Authorization: Bearer <token> 헤더 또는 ?token= 쿼리 파라미터 지원
export function validateToken(req: NextRequest): boolean {
  let raw: string | null = null;

  // Authorization 헤더에서 Bearer 토큰 추출
  const authHeader =
    req.headers.get("Authorization") || req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    raw = authHeader.slice(7);
  }

  // 쿼리 파라미터에서 토큰 추출 (fallback)
  if (!raw) {
    raw = req.nextUrl.searchParams.get("token");
  }

  if (!raw) return false;

  const idx = raw.lastIndexOf(":");
  if (idx === -1) return false;

  const expStr = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const exp = Number(expStr);

  if (!exp || exp < Date.now()) return false;

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(expStr)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "비밀번호가 필요합니다" },
        { status: 400 },
      );
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return NextResponse.json(
        { error: "관리자 비밀번호가 설정되지 않았습니다" },
        { status: 500 },
      );
    }

    if (password !== adminPassword) {
      return NextResponse.json(
        { error: "비밀번호가 일치하지 않습니다" },
        { status: 401 },
      );
    }

    const { token, expiresIn } = createToken();

    return NextResponse.json({ token, expiresIn });
  } catch (e) {
    return NextResponse.json(
      { error: "인증 실패", detail: String(e) },
      { status: 500 },
    );
  }
}

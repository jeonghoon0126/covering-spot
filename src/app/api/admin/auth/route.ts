import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyGoogleToken, getOrCreateAdmin } from "@/lib/google-auth";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function getSecret(): string {
  return process.env.ADMIN_PASSWORD || "fallback-secret";
}

/**
 * HMAC 기반 토큰 생성 (서버리스 호환 - 상태 없음)
 * Legacy (비밀번호): {exp}:{hmac}
 * Google OAuth:     {exp}:{adminId}:{email}:{hmac}
 */
function createToken(adminId?: string, email?: string): { token: string; expiresIn: number } {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = adminId && email ? `${exp}:${adminId}:${email}` : String(exp);
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
  return {
    token: `${payload}:${signature}`,
    expiresIn: SESSION_TTL_MS / 1000,
  };
}

function extractRawToken(req: NextRequest): string | null {
  const authHeader =
    req.headers.get("Authorization") || req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.nextUrl.searchParams.get("token");
}

/**
 * 토큰 검증 (Legacy + Google OAuth 양쪽 호환)
 */
export function validateToken(req: NextRequest): boolean {
  const raw = extractRawToken(req);
  if (!raw) return false;

  const idx = raw.lastIndexOf(":");
  if (idx === -1) return false;

  const payload = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const exp = Number(payload.split(":")[0]);

  if (!exp || exp < Date.now()) return false;

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

/**
 * 토큰에서 admin 정보 추출
 * Legacy 토큰: { adminId: null, adminEmail: "legacy" }
 * Google 토큰: { adminId: "uuid", adminEmail: "user@covering.app" }
 */
export function getAdminFromToken(req: NextRequest): { adminId: string | null; adminEmail: string } {
  const raw = extractRawToken(req);
  if (!raw) return { adminId: null, adminEmail: "legacy" };

  const idx = raw.lastIndexOf(":");
  if (idx === -1) return { adminId: null, adminEmail: "legacy" };

  const payload = raw.slice(0, idx);
  const parts = payload.split(":");

  if (parts.length >= 3) {
    return { adminId: parts[1], adminEmail: parts[2] };
  }

  return { adminId: null, adminEmail: "legacy" };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Google OAuth 로그인
    if (body.googleToken) {
      const googleUser = await verifyGoogleToken(body.googleToken);
      if (!googleUser) {
        return NextResponse.json(
          { error: "@covering.app 계정만 로그인 가능합니다" },
          { status: 401 },
        );
      }

      const admin = await getOrCreateAdmin(googleUser.email, googleUser.name);
      if (!admin) {
        return NextResponse.json(
          { error: "관리자 등록 실패" },
          { status: 500 },
        );
      }

      const { token, expiresIn } = createToken(admin.id, admin.email);
      return NextResponse.json({
        token,
        expiresIn,
        admin: { email: admin.email, name: admin.name },
      });
    }

    // 비밀번호 로그인 (레거시)
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

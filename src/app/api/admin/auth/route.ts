import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyGoogleToken, getOrCreateAdmin } from "@/lib/google-auth";
import type { AdminRole } from "@/lib/admin-roles";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const SECRET = process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD;
if (!SECRET) throw new Error("ADMIN_TOKEN_SECRET 또는 ADMIN_PASSWORD 환경변수가 필요합니다");

/**
 * HMAC 기반 토큰 생성 (서버리스 호환 - 상태 없음)
 * Legacy (비밀번호): {exp}:{role}:{hmac}
 * Google OAuth:     {exp}:{adminId}:{email}:{role}:{hmac}
 */
function createToken(adminId?: string, email?: string, role: AdminRole = "admin"): { token: string; expiresIn: number } {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = adminId && email
    ? `${exp}:${adminId}:${email}:${role}`
    : `${exp}:${role}`;
  const signature = crypto
    .createHmac("sha256", SECRET)
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

  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("hex");

  try {
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * 토큰에서 admin 정보 + role 추출
 * Legacy 토큰:  { adminId: null, adminEmail: "legacy", role: "admin" }
 * Google 토큰:  { adminId: "uuid", adminEmail: "user@covering.app", role: "admin"|"operator" }
 */
export function getAdminFromToken(req: NextRequest): { adminId: string | null; adminEmail: string; role: AdminRole } {
  const raw = extractRawToken(req);
  if (!raw) return { adminId: null, adminEmail: "legacy", role: "operator" };

  const idx = raw.lastIndexOf(":");
  if (idx === -1) return { adminId: null, adminEmail: "legacy", role: "operator" };

  const payload = raw.slice(0, idx);
  const parts = payload.split(":");

  // Google OAuth token: {exp}:{adminId}:{email}:{role}
  if (parts.length >= 4) {
    const role = (parts[3] === "operator" ? "operator" : "admin") as AdminRole;
    return { adminId: parts[1], adminEmail: parts[2], role };
  }

  // Legacy token: {exp}:{role}
  if (parts.length === 2) {
    const role = (parts[1] === "operator" ? "operator" : "admin") as AdminRole;
    return { adminId: null, adminEmail: "legacy", role };
  }

  return { adminId: null, adminEmail: "legacy", role: "operator" };
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

      // admin_users 테이블의 role 사용
      const role = (admin.role === "operator" ? "operator" : "admin") as AdminRole;
      const { token, expiresIn } = createToken(admin.id, admin.email, role);
      return NextResponse.json({
        token,
        expiresIn,
        admin: { email: admin.email, name: admin.name, role },
      });
    }

    // 비밀번호 로그인 (레거시) - admin 역할
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "비밀번호가 필요합니다" },
        { status: 400 },
      );
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error("[admin/auth] ADMIN_PASSWORD 환경변수 미설정");
      return NextResponse.json(
        { error: "인증 서버 오류" },
        { status: 500 },
      );
    }

    const pwBuf = Buffer.from(password);
    const expectedBuf = Buffer.from(adminPassword);
    if (pwBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(pwBuf, expectedBuf)) {
      return NextResponse.json(
        { error: "비밀번호가 일치하지 않습니다" },
        { status: 401 },
      );
    }

    const { token, expiresIn } = createToken(undefined, undefined, "admin");

    return NextResponse.json({ token, expiresIn });
  } catch (e) {
    console.error("[admin/auth]", e);
    return NextResponse.json(
      { error: "인증 실패" },
      { status: 500 },
    );
  }
}

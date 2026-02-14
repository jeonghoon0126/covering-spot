import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// 메모리 기반 세션 저장소 (서버 재시작 시 초기화)
// key: token, value: 만료 시간 (ms)
const sessions = new Map<string, number>();

// 세션 만료 시간: 24시간
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// 만료된 세션 정리
function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [token, expiry] of sessions.entries()) {
    if (expiry < now) {
      sessions.delete(token);
    }
  }
}

// 토큰 검증 헬퍼 (다른 admin API에서 사용)
// Authorization: Bearer <token> 헤더 또는 ?token= 쿼리 파라미터 지원
export function validateToken(req: NextRequest): boolean {
  cleanExpiredSessions();

  // Authorization 헤더에서 Bearer 토큰 추출
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const expiry = sessions.get(token);
    if (expiry && expiry > Date.now()) return true;
  }

  // 쿼리 파라미터에서 토큰 추출
  const queryToken = req.nextUrl.searchParams.get("token");
  if (queryToken) {
    const expiry = sessions.get(queryToken);
    if (expiry && expiry > Date.now()) return true;
  }

  return false;
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

    // 세션 토큰 생성
    cleanExpiredSessions();
    const token = crypto.randomUUID();
    sessions.set(token, Date.now() + SESSION_TTL_MS);

    return NextResponse.json({
      token,
      expiresIn: SESSION_TTL_MS / 1000,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "인증 실패", detail: String(e) },
      { status: 500 },
    );
  }
}

import crypto from "crypto";

function getSecret(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error("ADMIN_PASSWORD 환경변수가 설정되지 않았습니다");
  }
  return secret;
}

/**
 * 30일 단위 윈도우 인덱스
 * offset=-1 → 이전 윈도우 (최대 30일 전 발급 토큰 허용)
 */
function getWindowIndex(offset = 0): number {
  return Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 30)) + offset;
}

function computeToken(payload: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex")
    .slice(0, 32);
}

/** Generate a booking access token from phone number (30일 만료) */
export function generateBookingToken(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return computeToken(`${digits}:${getWindowIndex()}`);
}

/** Validate booking token from request */
export function validateBookingToken(
  req: {
    headers: { get(name: string): string | null };
    nextUrl: { searchParams: { get(name: string): string | null } };
  },
  phone: string,
): boolean {
  const token =
    req.headers.get("x-booking-token") ||
    req.nextUrl.searchParams.get("token");
  if (!token) return false;

  const digits = phone.replace(/[^\d]/g, "");
  const tokenBuf = Buffer.from(token);

  // 유효한 후보 토큰 목록:
  //   1) 현재 윈도우 (이번 달 발급)
  //   2) 이전 윈도우 (지난달 발급, 최대 60일까지 허용)
  //   3) 레거시 토큰 (윈도우 없음 — 이전 배포 호환)
  const candidates = [
    computeToken(`${digits}:${getWindowIndex(0)}`),
    computeToken(`${digits}:${getWindowIndex(-1)}`),
    computeToken(digits), // legacy
  ];

  return candidates.some((expected) => {
    try {
      return crypto.timingSafeEqual(tokenBuf, Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

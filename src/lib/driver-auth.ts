import crypto from "crypto";
import { NextRequest } from "next/server";

// 12시간 (하루 작업 기준)
const DRIVER_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const SECRET = process.env.DRIVER_TOKEN_SECRET || process.env.ADMIN_PASSWORD || "change-me";

interface DriverTokenPayload {
  type: "driver";
  exp: number;
  driverId: string;
  driverName: string;
}

/**
 * 드라이버 토큰 생성
 * 형식: {base64url(JSON payload)}.{hmac}
 * - base64url에 "."이 포함되지 않으므로 구분자 충돌 없음
 * - JSON 직렬화로 콜론/특수문자에 안전 (이전 콜론 구분 방식 대비 파싱 취약점 제거)
 */
export function createDriverToken(driverId: string, driverName: string): string {
  const payload: DriverTokenPayload = {
    type: "driver",
    exp: Date.now() + DRIVER_SESSION_TTL_MS,
    driverId,
    driverName,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(payloadB64)
    .digest("hex");
  return `${payloadB64}.${sig}`;
}

export interface DriverAuth {
  driverId: string;
  driverName: string;
}

/**
 * 드라이버 토큰 검증
 * - admin 토큰(콜론 구분 구조)과 형식이 달라 구분됨
 * - base64url + JSON으로 구분자 충돌 없음
 */
export function validateDriverToken(req: NextRequest): DriverAuth | null {
  const authHeader =
    req.headers.get("Authorization") || req.headers.get("authorization");
  const raw = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!raw) return null;

  // 형식: {base64url}.{hex-hmac}
  const dotIdx = raw.indexOf(".");
  if (dotIdx === -1) return null;

  const payloadB64 = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);

  // HMAC 검증 (timing-safe)
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(payloadB64)
    .digest("hex");

  try {
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  // 페이로드 파싱 및 검증
  let payload: DriverTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as DriverTokenPayload;
  } catch {
    return null;
  }

  if (payload.type !== "driver") return null;
  if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) return null;
  if (!payload.driverId || !payload.driverName) return null;

  return { driverId: payload.driverId, driverName: payload.driverName };
}

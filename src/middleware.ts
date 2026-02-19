import { NextRequest, NextResponse } from "next/server";
import { getActiveExperiment, assignVariant } from "@/config/experiments";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

// 경로별 Rate Limit 설정 (limit, windowMs)
const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/bookings": { limit: 30, windowMs: 60_000 },
  "/api/push": { limit: 10, windowMs: 60_000 },
  "/api/leads": { limit: 20, windowMs: 60_000 },
  "/api/admin/auth": { limit: 5, windowMs: 60_000 },
  "/api/admin/bookings": { limit: 60, windowMs: 60_000 },
  "/api/admin/blocked-slots": { limit: 30, windowMs: 60_000 },
};

function findRateLimit(pathname: string): { limit: number; windowMs: number } | null {
  for (const [prefix, config] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) return config;
  }
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate Limiting (API 경로만)
  if (pathname.startsWith("/api/")) {
    const config = findRateLimit(pathname);
    if (config) {
      const ip = getRateLimitKey(request);
      const key = `${ip}:${pathname}`;
      const result = rateLimit(key, config.limit, config.windowMs);
      if (!result.allowed) {
        return NextResponse.json(
          { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
          {
            status: 429,
            headers: {
              "Retry-After": "60",
              "X-RateLimit-Remaining": "0",
            },
          },
        );
      }
    }
  }

  // A/B 테스트 variant 할당
  const response = NextResponse.next();

  const experiment = getActiveExperiment();
  if (!experiment) return response;

  const cookieName = `ab_${experiment.name}`;
  const existing = request.cookies.get(cookieName)?.value;

  // 이미 할당된 variant가 유효하면 유지
  if (existing && experiment.variants.includes(existing)) {
    return response;
  }

  // 새로 할당
  const variant = assignVariant(experiment);
  response.cookies.set(cookieName, variant, {
    maxAge: 60 * 60 * 24 * 30, // 30일
    path: "/",
    sameSite: "lax",
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|images|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|otf)$).*)",
  ],
};

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (서버 재시작 시 초기화 — serverless 환경에서는 인스턴스당 독립)
const store = new Map<string, RateLimitEntry>();

let lastClean = Date.now();

// 만료된 엔트리 주기적 정리 (메모리 누수 방지)
function cleanupIfNeeded() {
  const now = Date.now();
  if (now - lastClean < 60_000) return; // 1분에 1회만
  lastClean = now;
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}

/**
 * Rate limit 체크
 * @param key - 식별자 (예: "1.2.3.4:/api/bookings")
 * @param limit - 윈도우 내 최대 요청 수
 * @param windowMs - 윈도우 크기 (ms)
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfter?: number } {
  cleanupIfNeeded();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true };
}

/** checkRateLimit alias (rateLimit과 동일) */
export const checkRateLimit = rateLimit;

/** IP 추출 헬퍼 (middleware용) */
export function getRateLimitKey(request: { headers: { get(name: string): string | null } }): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

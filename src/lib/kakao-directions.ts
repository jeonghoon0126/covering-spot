/**
 * Kakao Mobility 길찾기 API 유틸
 *
 * 보안:
 *  - 서버 사이드 전용 (KAKAO_REST_API_KEY는 NEXT_PUBLIC_ 아님)
 *  - 응답 유효성 검증 (routes[0].summary 존재 확인)
 *  - 실패 시 null 반환 (graceful degradation — 자동배차 자체는 영향 없음)
 *
 * API:
 *  - 3개 이상 포인트: POST https://apis-navi.kakaomobility.com/v1/waypoints/directions
 *  - 2개 포인트: GET https://apis-navi.kakaomobility.com/v1/directions
 *
 * 카카오 좌표 형식: x = 경도(longitude), y = 위도(latitude)
 */

const TIMEOUT_MS = 5000;
const BASE_URL = "https://apis-navi.kakaomobility.com/v1";

export interface RoutePoint {
  /** 경도 (longitude) — 카카오 x 축 */
  x: number;
  /** 위도 (latitude) — 카카오 y 축 */
  y: number;
  name?: string;
}

export interface RouteETA {
  /** 예상 소요 시간 (초) */
  duration: number;
  /** 총 거리 (미터) */
  distance: number;
}

/**
 * 경로 ETA 계산
 * @param points - 경유지 포함 전체 포인트 배열 (출발지 포함 최소 2개)
 * @returns ETA 또는 null (API 실패/키 미설정 시)
 */
export async function getRouteETA(points: RoutePoint[]): Promise<RouteETA | null> {
  if (points.length < 2) return null;

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    console.warn("[kakao-directions] KAKAO_REST_API_KEY not set");
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const origin = points[0];
    const destination = points[points.length - 1];
    const waypoints = points.slice(1, -1);

    let res: Response;

    if (waypoints.length === 0) {
      // 2개 포인트: 단순 directions GET API
      const url = new URL(`${BASE_URL}/directions`);
      url.searchParams.set("origin", `${origin.x},${origin.y}`);
      url.searchParams.set("destination", `${destination.x},${destination.y}`);
      // priority: RECOMMEND = 카카오 추천 (교통 상황 반영)
      url.searchParams.set("priority", "RECOMMEND");

      res = await fetch(url.toString(), {
        headers: { Authorization: `KakaoAK ${apiKey}` },
        signal: controller.signal,
      });
    } else {
      // 3개 이상: waypoints directions POST API (최대 30 waypoints)
      if (waypoints.length > 30) {
        console.warn(`[kakao-directions] waypoints ${waypoints.length}개 > 30 제한, 처음 30개만 사용`);
      }
      const body = {
        origin: { x: origin.x, y: origin.y, name: origin.name || "출발지" },
        destination: { x: destination.x, y: destination.y, name: destination.name || "도착지" },
        waypoints: waypoints.slice(0, 30).map((p, i) => ({
          x: p.x,
          y: p.y,
          name: p.name || `경유지${i + 1}`,
        })),
        priority: "RECOMMEND",
      };

      res = await fetch(`${BASE_URL}/waypoints/directions`, {
        method: "POST",
        headers: {
          Authorization: `KakaoAK ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    }

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[kakao-directions] API error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const summary = data?.routes?.[0]?.summary;
    if (!summary || typeof summary.duration !== "number" || typeof summary.distance !== "number") {
      console.warn("[kakao-directions] Unexpected response format", data);
      return null;
    }

    return {
      duration: summary.duration, // 초
      distance: summary.distance, // 미터
    };
  } catch (e) {
    if ((e as Error).name !== "AbortError") {
      console.warn("[kakao-directions] Request failed:", (e as Error).message);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * ETA를 한국어 시간 문자열로 변환
 * @example formatDuration(5400) → "1시간 30분"
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes > 0 ? `${minutes}분` : ""}`.trim();
  return `${minutes}분`;
}

/**
 * 거리를 한국어 문자열로 변환
 * @example formatDistance(45200) → "45.2km"
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${meters}m`;
}

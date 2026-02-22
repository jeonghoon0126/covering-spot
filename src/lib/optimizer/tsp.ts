import { haversine } from "./haversine";
import type { DispatchBooking, DispatchUnloadingPoint, UnloadingStop } from "./types";

/**
 * 직선거리 → 도로거리 보정계수 (서울 시내 평균 우회율 1.4)
 * TSP 거리 행렬, routeDistance 계산에 적용
 */
const ROAD_FACTOR = 1.4;

/**
 * Nearest Neighbor + 2-opt TSP 최적화
 *
 * 1단계: Nearest Neighbor로 초기 경로 생성
 * 2단계: 2-opt 개선 (교차 경로 제거)
 *
 * 서울 시내 주문 10~20건 기준 수밀리초 내 완료
 */
export function optimizeRoute(bookings: DispatchBooking[]): DispatchBooking[] {
  if (bookings.length <= 2) return [...bookings];

  // 1단계: Nearest Neighbor
  const route = nearestNeighbor(bookings);

  // 2단계: 2-opt 개선
  return twoOpt(route);
}

/**
 * Nearest Neighbor 휴리스틱
 * 현재 위치에서 가장 가까운 미방문 포인트를 선택 (도로 보정계수 적용)
 */
function nearestNeighbor(bookings: DispatchBooking[]): DispatchBooking[] {
  const n = bookings.length;
  const visited = new Set<number>();
  const route: DispatchBooking[] = [];

  // 가장 북쪽(위도 높은) 포인트에서 시작 (일반적 수거 패턴)
  let current = 0;
  let maxLat = -Infinity;
  for (let i = 0; i < n; i++) {
    if (bookings[i].lat > maxLat) {
      maxLat = bookings[i].lat;
      current = i;
    }
  }

  visited.add(current);
  route.push(bookings[current]);

  while (route.length < n) {
    let nearest = -1;
    let nearestDist = Infinity;
    const cur = bookings[current];

    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue;
      // ROAD_FACTOR 적용: 직선거리보다 실제 도로 거리에 근사한 비교
      const d = haversine(cur.lat, cur.lng, bookings[i].lat, bookings[i].lng) * ROAD_FACTOR;
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    }

    if (nearest === -1) break;
    visited.add(nearest);
    route.push(bookings[nearest]);
    current = nearest;
  }

  return route;
}

/**
 * 2-opt 개선
 * 교차하는 두 간선을 찾아 역전하여 거리 감소
 * O(n²) per iteration, 최대 100회 반복
 */
function twoOpt(route: DispatchBooking[]): DispatchBooking[] {
  const n = route.length;
  if (n <= 3) return route;

  let improved = true;
  let iterations = 0;
  const result = [...route];

  while (improved && iterations < 100) {
    improved = false;
    iterations++;

    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 2; j < n; j++) {
        const d1 =
          haversine(result[i].lat, result[i].lng, result[i + 1].lat, result[i + 1].lng) +
          (j + 1 < n
            ? haversine(result[j].lat, result[j].lng, result[j + 1].lat, result[j + 1].lng)
            : 0);
        const d2 =
          haversine(result[i].lat, result[i].lng, result[j].lat, result[j].lng) +
          (j + 1 < n
            ? haversine(result[i + 1].lat, result[i + 1].lng, result[j + 1].lat, result[j + 1].lng)
            : 0);

        if (d2 < d1 - 0.001) {
          // i+1 ~ j 구간 역전
          let left = i + 1;
          let right = j;
          while (left < right) {
            [result[left], result[right]] = [result[right], result[left]];
            left++;
            right--;
          }
          improved = true;
        }
      }
    }
  }

  return result;
}

/**
 * 경로 총 거리 계산 (km, 도로 보정계수 적용)
 * 직선거리 × ROAD_FACTOR → 실제 도로거리 추정값
 */
export function routeDistance(route: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += haversine(route[i].lat, route[i].lng, route[i + 1].lat, route[i + 1].lng);
  }
  return Math.round(total * ROAD_FACTOR * 10) / 10;
}

/**
 * 경로에 하차지 삽입
 * 누적 적재량이 용량 초과 시 최적 하차지를 경로에 삽입
 *
 * 최적 하차지 선택 기준:
 *   dist(현재수거지 → 하차지) + dist(하차지 → 다음수거지) 최소화
 *   (기존: 현재 위치에서 가장 가까운 하차지만 고려 → 하차지 이후 경로 비효율 발생)
 */
export function insertUnloadingStops(
  route: DispatchBooking[],
  capacity: number,
  unloadingPoints: DispatchUnloadingPoint[],
): UnloadingStop[] {
  if (unloadingPoints.length === 0) return [];

  const stops: UnloadingStop[] = [];
  let cumLoad = 0;

  for (let i = 0; i < route.length; i++) {
    cumLoad += route[i].totalLoadingCube;

    // 단일 주문이 차량 용량 초과: 물리적으로 적재 불가 — 경고 로그 (배차 제외는 상위 레이어에서 처리)
    if (i === 0 && route[i].totalLoadingCube > capacity) {
      console.warn(
        `[tsp] 단일 주문(id=${route[i].id}) 적재량(${route[i].totalLoadingCube}) > 차량 용량(${capacity}). 하차지 삽입 후 진행.`,
      );
    }

    const isLast = i === route.length - 1;
    const nextLoad = isLast ? 0 : route[i + 1].totalLoadingCube;

    // 하차지 삽입 조건:
    // 1) 현재 누적이 이미 용량 초과 → 마지막 픽업이어도 반드시 삽입 (과적재 방지)
    // 2) 마지막이 아닌데 다음 픽업 후 초과 예상 → 선제적 삽입
    if (cumLoad > capacity || (!isLast && cumLoad + nextLoad > capacity)) {
      // 현재 수거지 → 하차지 → 다음 수거지 총 거리가 최소인 하차지 선택
      const nextStop = isLast ? null : route[i + 1];
      const best = findBestUnloadingPoint(route[i], nextStop, unloadingPoints);
      if (best) {
        stops.push({
          afterRouteOrder: i + 1, // 1-indexed route order
          pointId: best.id,
          pointName: best.name,
        });
        cumLoad = 0; // 적재량 리셋
      }
    }
  }

  return stops;
}

/**
 * 최적 하차지 선택
 * dist(from → point) + dist(point → nextStop) 합산 최소화
 * nextStop이 없으면(마지막 수거지) dist(from → point) 만 고려
 */
function findBestUnloadingPoint(
  from: { lat: number; lng: number },
  nextStop: { lat: number; lng: number } | null,
  points: DispatchUnloadingPoint[],
): DispatchUnloadingPoint | null {
  let best: DispatchUnloadingPoint | null = null;
  let bestDist = Infinity;

  for (const p of points) {
    const toPoint = haversine(from.lat, from.lng, p.lat, p.lng);
    const toNext = nextStop ? haversine(p.lat, p.lng, nextStop.lat, nextStop.lng) : 0;
    const total = toPoint + toNext;
    if (total < bestDist) {
      bestDist = total;
      best = p;
    }
  }

  return best;
}

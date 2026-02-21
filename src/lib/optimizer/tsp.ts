import { haversine } from "./haversine";
import type { DispatchBooking, DispatchUnloadingPoint, UnloadingStop } from "./types";

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
 * 현재 위치에서 가장 가까운 미방문 포인트를 선택
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
      const d = haversine(cur.lat, cur.lng, bookings[i].lat, bookings[i].lng);
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
 * 경로 총 거리 계산 (km)
 */
export function routeDistance(route: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += haversine(route[i].lat, route[i].lng, route[i + 1].lat, route[i + 1].lng);
  }
  return Math.round(total * 10) / 10;
}

/**
 * 경로에 하차지 삽입
 * 누적 적재량이 용량 초과 시 가장 가까운 하차지를 경로에 삽입
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

    // 다음 주문 적재 후 용량 초과 여부 미리 확인
    // i < route.length - 1 조건: 마지막 픽업 후에는 삽입 불필요 (루트가 하차지로 자연 종료)
    const nextLoad = i + 1 < route.length ? route[i + 1].totalLoadingCube : 0;
    if (cumLoad + nextLoad > capacity && i < route.length - 1) {
      // 현재 위치에서 가장 가까운 하차지 찾기
      const nearest = findNearestUnloadingPoint(route[i], unloadingPoints);
      if (nearest) {
        stops.push({
          afterRouteOrder: i + 1, // 1-indexed route order
          pointId: nearest.id,
          pointName: nearest.name,
        });
        cumLoad = 0; // 적재량 리셋
      }
    }
  }

  return stops;
}

function findNearestUnloadingPoint(
  from: { lat: number; lng: number },
  points: DispatchUnloadingPoint[],
): DispatchUnloadingPoint | null {
  let nearest: DispatchUnloadingPoint | null = null;
  let nearestDist = Infinity;

  for (const p of points) {
    const d = haversine(from.lat, from.lng, p.lat, p.lng);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = p;
    }
  }

  return nearest;
}

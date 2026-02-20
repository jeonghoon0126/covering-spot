import { clusterBookings } from "./cluster";
import { optimizeRoute, routeDistance, insertUnloadingStops } from "./tsp";
import type {
  DispatchBooking,
  DispatchDriver,
  DispatchUnloadingPoint,
  AutoDispatchResult,
  DriverPlan,
} from "./types";

/**
 * 자동배차 메인 엔트리
 *
 * CVRP (Capacitated Vehicle Routing Problem) 솔버
 * 1. 미배차 주문을 기사 수 만큼 클러스터링 (K-Means + 용량 제약)
 * 2. 클러스터를 기사에게 매칭 (큰 용량 기사 → 큰 클러스터)
 * 3. 기사별 경로 최적화 (Nearest Neighbor + 2-opt)
 * 4. 하차지 자동 삽입 (누적 적재량 > 용량 시)
 */
export function autoDispatch(
  bookings: DispatchBooking[],
  drivers: DispatchDriver[],
  unloadingPoints: DispatchUnloadingPoint[],
): AutoDispatchResult {
  // 좌표 없는 주문은 자동배차 불가
  const validBookings = bookings.filter((b) => b.lat !== 0 && b.lng !== 0);
  const invalidBookings = bookings.filter((b) => b.lat === 0 || b.lng === 0);

  if (validBookings.length === 0 || drivers.length === 0) {
    return {
      plan: [],
      unassigned: [
        ...invalidBookings.map((b) => ({ id: b.id, reason: "좌표 없음" })),
        ...validBookings.map((b) => ({ id: b.id, reason: "배차 가능한 기사 없음" })),
      ],
      stats: { totalBookings: bookings.length, assigned: 0, unassigned: bookings.length, totalDistance: 0 },
    };
  }

  // 1. 지리적 클러스터링
  const { clusters, driverAssignment } = clusterBookings(validBookings, drivers);

  // 2~4. 기사별 경로 최적화 + 하차지 삽입
  const plan: DriverPlan[] = [];
  const assignedIds = new Set<string>();
  let totalDist = 0;

  for (let ci = 0; ci < clusters.length; ci++) {
    const cluster = clusters[ci];
    const driverId = driverAssignment.get(ci);
    if (!driverId || cluster.bookings.length === 0) continue;

    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) continue;

    // TSP 최적화
    const optimized = optimizeRoute(cluster.bookings);
    const dist = routeDistance(optimized);
    totalDist += dist;

    // 하차지 삽입
    const unloadingStops = insertUnloadingStops(optimized, driver.vehicleCapacity, unloadingPoints);
    const legs = unloadingStops.length + 1;

    const driverPlan: DriverPlan = {
      driverId: driver.id,
      driverName: driver.name,
      vehicleType: driver.vehicleType,
      vehicleCapacity: driver.vehicleCapacity,
      bookings: optimized.map((b, idx) => ({
        id: b.id,
        routeOrder: idx + 1,
        address: b.address,
        customerName: b.customerName,
        loadCube: b.totalLoadingCube,
      })),
      unloadingStops,
      totalDistance: dist,
      totalLoad: cluster.totalLoad,
      legs,
    };

    plan.push(driverPlan);
    optimized.forEach((b) => assignedIds.add(b.id));
  }

  // 미배차 주문
  const unassigned = [
    ...invalidBookings.map((b) => ({ id: b.id, reason: "좌표 없음" })),
    ...validBookings
      .filter((b) => !assignedIds.has(b.id))
      .map((b) => ({ id: b.id, reason: "클러스터 할당 실패" })),
  ];

  return {
    plan,
    unassigned,
    stats: {
      totalBookings: bookings.length,
      assigned: assignedIds.size,
      unassigned: unassigned.length,
      totalDistance: Math.round(totalDist * 10) / 10,
    },
  };
}

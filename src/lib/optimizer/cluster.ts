import { haversine } from "./haversine";
import type { DispatchBooking, DispatchDriver, Cluster } from "./types";

/**
 * 용량 제약 K-Means 클러스터링
 *
 * 1. 초기 센트로이드: 가장 먼 포인트 쌍에서 시작 (K-Means++ 변형)
 * 2. 각 주문을 가장 가까운 센트로이드에 배정 (용량 체크 포함)
 * 3. 센트로이드 재계산 → 수렴할 때까지 반복
 *
 * 기사 수보다 주문이 적으면 1:1 매칭
 */
export function clusterBookings(
  bookings: DispatchBooking[],
  drivers: DispatchDriver[],
): { clusters: Cluster[]; driverAssignment: Map<number, string> } {
  const k = Math.min(drivers.length, bookings.length);
  if (k === 0) return { clusters: [], driverAssignment: new Map() };

  // 기사를 용량 큰 순으로 정렬 (큰 기사 → 큰 클러스터)
  const sortedDrivers = [...drivers].sort((a, b) => b.vehicleCapacity - a.vehicleCapacity);

  // 초기 센트로이드: K-Means++ (거리 기반)
  const centroids = initCentroids(bookings, k);

  // 최대 20회 반복
  let assignments = new Array(bookings.length).fill(-1);
  for (let iter = 0; iter < 20; iter++) {
    const newAssignments = assignToClusters(bookings, centroids, k);
    if (arraysEqual(assignments, newAssignments)) break;
    assignments = newAssignments;
    updateCentroids(bookings, assignments, centroids, k);
  }

  // 클러스터 생성
  const clusters: Cluster[] = Array.from({ length: k }, (_, i) => ({
    centroidLat: centroids[i].lat,
    centroidLng: centroids[i].lng,
    bookings: [],
    totalLoad: 0,
  }));

  for (let i = 0; i < bookings.length; i++) {
    const ci = assignments[i];
    if (ci >= 0 && ci < k) {
      clusters[ci].bookings.push(bookings[i]);
      clusters[ci].totalLoad += bookings[i].totalLoadingCube;
    }
  }

  // 클러스터를 적재량 내림차순 정렬 → 큰 기사와 매칭
  const sortedIndices = clusters
    .map((c, i) => ({ load: c.totalLoad, idx: i }))
    .sort((a, b) => b.load - a.load)
    .map((x) => x.idx);

  const driverAssignment = new Map<number, string>();
  sortedIndices.forEach((clusterIdx, rank) => {
    if (rank < sortedDrivers.length) {
      driverAssignment.set(clusterIdx, sortedDrivers[rank].id);
    }
  });

  return { clusters, driverAssignment };
}

// K-Means++ 초기화
function initCentroids(
  bookings: DispatchBooking[],
  k: number,
): { lat: number; lng: number }[] {
  const centroids: { lat: number; lng: number }[] = [];

  // 첫 번째: 무작위 (가장 중심에 가까운 포인트)
  const avgLat = bookings.reduce((s, b) => s + b.lat, 0) / bookings.length;
  const avgLng = bookings.reduce((s, b) => s + b.lng, 0) / bookings.length;
  let closest = 0;
  let closestDist = Infinity;
  for (let i = 0; i < bookings.length; i++) {
    const d = haversine(avgLat, avgLng, bookings[i].lat, bookings[i].lng);
    if (d < closestDist) {
      closestDist = d;
      closest = i;
    }
  }
  centroids.push({ lat: bookings[closest].lat, lng: bookings[closest].lng });

  // 나머지: 가장 먼 포인트 선택
  for (let c = 1; c < k; c++) {
    let bestIdx = 0;
    let bestMinDist = -1;
    for (let i = 0; i < bookings.length; i++) {
      const minDist = Math.min(
        ...centroids.map((ct) => haversine(ct.lat, ct.lng, bookings[i].lat, bookings[i].lng)),
      );
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestIdx = i;
      }
    }
    centroids.push({ lat: bookings[bestIdx].lat, lng: bookings[bestIdx].lng });
  }

  return centroids;
}

function assignToClusters(
  bookings: DispatchBooking[],
  centroids: { lat: number; lng: number }[],
  k: number,
): number[] {
  return bookings.map((b) => {
    let bestCluster = 0;
    let bestDist = Infinity;
    for (let c = 0; c < k; c++) {
      const d = haversine(centroids[c].lat, centroids[c].lng, b.lat, b.lng);
      if (d < bestDist) {
        bestDist = d;
        bestCluster = c;
      }
    }
    return bestCluster;
  });
}

function updateCentroids(
  bookings: DispatchBooking[],
  assignments: number[],
  centroids: { lat: number; lng: number }[],
  k: number,
): void {
  for (let c = 0; c < k; c++) {
    const members = bookings.filter((_, i) => assignments[i] === c);
    if (members.length > 0) {
      centroids[c].lat = members.reduce((s, b) => s + b.lat, 0) / members.length;
      centroids[c].lng = members.reduce((s, b) => s + b.lng, 0) / members.length;
    }
  }
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

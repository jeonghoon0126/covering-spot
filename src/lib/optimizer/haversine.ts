const R = 6371; // 지구 반지름 (km)
const DEG_TO_RAD = Math.PI / 180;

/**
 * 두 좌표 간 Haversine 거리 (km)
 * 서울 시내 직선거리 기준으로 충분히 정확 (실제 도로 거리 ≈ 직선 × 1.3~1.5)
 */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * N개 포인트 간 거리 행렬 생성
 * distMatrix[i][j] = i번째 포인트에서 j번째 포인트까지 거리 (km)
 */
export function buildDistanceMatrix(points: { lat: number; lng: number }[]): number[][] {
  const n = points.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversine(points[i].lat, points[i].lng, points[j].lat, points[j].lng);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }
  return matrix;
}

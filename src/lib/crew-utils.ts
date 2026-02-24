/**
 * 적재량(m³) 기반 인력 수 자동 계산
 * 기준 조정 시 CREW_THRESHOLDS 상수만 수정
 */
export const CREW_THRESHOLDS: { minCube: number; crew: number }[] = [
  { minCube: 6, crew: 3 },   // 6m³ 이상 → 3명
  { minCube: 1.5, crew: 2 }, // 1.5m³ 이상 → 2명
  { minCube: 0, crew: 1 },   // 그 이하 → 1명
];

export function calcCrewSize(totalLoadingCube: number): number {
  for (const t of CREW_THRESHOLDS) {
    if (totalLoadingCube >= t.minCube) return t.crew;
  }
  return 1;
}

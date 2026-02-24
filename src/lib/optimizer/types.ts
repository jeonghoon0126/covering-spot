/** 좌표를 가진 모든 포인트의 공통 인터페이스 */
export interface GeoPoint {
  id: string;
  lat: number;
  lng: number;
}

/** 자동배차에 사용되는 주문 정보 */
export interface DispatchBooking extends GeoPoint {
  totalLoadingCube: number;
  timeSlot: string;
  address: string;
  customerName: string;
}

/** 기사 정보 */
export interface DispatchDriver {
  id: string;
  name: string;
  vehicleCapacity: number; // m³
  vehicleType: string;
  /** 배차 시작 시 이미 적재된 물량 (m³) — 전날 미하차 분. 기본 0 */
  initialLoadCube?: number;
  /** 출발지 좌표 — 이 지점에서 가장 가까운 수거지를 첫 경유지로 선택 */
  startLat?: number;
  startLng?: number;
  /** 퇴근지 좌표 — 향후 반환 경로 최적화에 활용 예정 */
  endLat?: number;
  endLng?: number;
}

/** 하차지 정보 */
export interface DispatchUnloadingPoint extends GeoPoint {
  name: string;
}

/** 클러스터 (기사에게 할당될 주문 그룹) */
export interface Cluster {
  centroidLat: number;
  centroidLng: number;
  bookings: DispatchBooking[];
  totalLoad: number; // m³
}

/** 경로 내 하차지 삽입 정보 */
export interface UnloadingStop {
  afterRouteOrder: number;
  pointId: string;
  pointName: string;
}

/**
 * 자동배차 경로의 구간별 이동 정보
 * segments[i] = pointTypes[i] → pointTypes[i+1] 이동 구간
 * - fromBookingId: 수거지에서 출발할 때 해당 bookingId
 * - fromUnloadingId: 하차지에서 출발할 때 해당 unloadingPointId
 */
export interface RouteSegment {
  /** 출발지가 수거지인 경우 해당 bookingId */
  fromBookingId?: string;
  /** 출발지가 하차지인 경우 해당 unloadingPointId */
  fromUnloadingId?: string;
  /** 이동 소요 시간 (초) — Kakao 실측값 */
  travelSecs: number;
  /** 이동 거리 (미터) — Kakao 실측값 */
  distanceMeters: number;
  /** 출발 시각 "HH:MM" (수거지의 경우 서비스 시간 완료 후) */
  departureTime: string;
  /** 도착 시각 "HH:MM" */
  arrivalTime: string;
  /** 목적지가 하차지인 구간 여부 */
  isUnloadingLeg: boolean;
}

/** 기사별 자동배차 결과 */
export interface DriverPlan {
  driverId: string;
  driverName: string;
  vehicleType: string;
  vehicleCapacity: number;
  bookings: { id: string; routeOrder: number; address: string; customerName: string; loadCube: number }[];
  unloadingStops: UnloadingStop[];
  totalDistance: number; // km
  totalLoad: number; // m³
  legs: number;
  /** 카카오 길찾기 API 예상 소요 시간 (초) — 미지원 시 undefined */
  estimatedDuration?: number;
  /** 카카오 길찾기 API 예상 거리 (미터) — 미지원 시 undefined */
  estimatedDistance?: number;
  /** 구간별 이동 정보 (Kakao 실측) — 미지원 시 undefined */
  segments?: RouteSegment[];
}

/** 자동배차 전체 결과 */
export interface AutoDispatchResult {
  plan: DriverPlan[];
  unassigned: { id: string; reason: string }[];
  stats: {
    totalBookings: number;
    assigned: number;
    unassigned: number;
    totalDistance: number;
  };
}

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

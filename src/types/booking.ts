export interface BookingItem {
  category: string;
  name: string;
  displayName: string;
  price: number;
  quantity: number;
  loadingCube: number; // 적재큐브 (m³)
}

export interface Booking {
  id: string;
  date: string;
  timeSlot: string;
  area: string;
  items: BookingItem[];
  totalPrice: number;
  crewSize: number;
  needLadder: boolean;
  ladderType?: string;
  ladderHours?: number;
  ladderPrice: number;
  customerName: string;
  phone: string;
  address: string;
  addressDetail: string;
  memo: string;
  status:
    | "pending"
    | "quote_confirmed"
    | "user_confirmed"
    | "change_requested"
    | "in_progress"
    | "completed"
    | "payment_requested"
    | "payment_completed"
    | "cancelled"
    | "rejected";
  createdAt: string;
  updatedAt: string;
  hasElevator: boolean;
  hasParking: boolean;
  hasGroundAccess: boolean;
  estimateMin: number;
  estimateMax: number;
  finalPrice: number | null;
  photos: string[];
  adminMemo: string;
  confirmedTime: string | null;
  confirmedDuration?: number | null;
  completionPhotos?: string[];
  slackThreadTs: string | null;
  driverId?: string | null;
  driverName?: string | null;
  source?: string | null;
  totalLoadingCube?: number; // 주문 전체 적재큐브 합계 (m³)
  latitude?: number | null;  // 주소 좌표 (위도)
  longitude?: number | null; // 주소 좌표 (경도)
  routeOrder?: number | null; // 기사 루트 내 순서 (1, 2, 3...)
  unloadingStopAfter?: string | null; // 이 수거지 다음 하차지 ID (경유 있을 경우)
  agreedToTerms?: boolean; // 서비스 이용약관 동의 (필수)
  agreedToPrivacy?: boolean; // 개인정보 수집·이용 동의 (필수)
  agreedToMarketing?: boolean; // 마케팅 정보 수신 동의 (선택)
  agreedToNightNotification?: boolean; // 야간 수신 동의 21:00~익일08:00 (선택)
}

export interface UnloadingPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface QuoteInput {
  area: string;
  items: BookingItem[];
  needLadder: boolean;
  ladderType?: string;
  ladderHours?: number;
}

export interface QuoteResult {
  itemsTotal: number;
  crewSize: number;
  crewPrice: number;
  ladderPrice: number;
  totalPrice: number;
  estimateMin: number;
  estimateMax: number;
  breakdown: {
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
}

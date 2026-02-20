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
    | "confirmed"
    | "quote_confirmed"
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

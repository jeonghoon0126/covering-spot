export interface BookingItem {
  category: string;
  name: string;
  displayName: string;
  price: number;
  quantity: number;
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
  status: "pending" | "confirmed" | "completed" | "cancelled";
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
  breakdown: {
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
}

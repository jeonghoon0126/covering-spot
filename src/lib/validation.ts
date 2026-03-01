import { z } from "zod";

export const BookingCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().min(1),
  area: z.string().min(1),
  items: z
    .array(
      z.object({
        category: z.string(),
        name: z.string(),
        displayName: z.string().optional(),
        price: z.number().min(0),
        quantity: z.number().int().min(1).max(100),
        loadingCube: z.number().min(0).default(0),
      }),
    )
    .min(1),
  totalPrice: z.number().min(0).max(100000000),
  crewSize: z.number().int().min(1).max(20),
  needLadder: z.boolean(),
  ladderType: z.string().optional(),
  ladderHours: z.number().int().min(0).max(10).optional(),
  ladderPrice: z.number().min(0).optional(),
  customerName: z.string().min(2).max(50),
  phone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/),
  address: z.string().min(5).max(200),
  addressDetail: z.string().max(100).optional(),
  memo: z.string().max(500).optional(),
  hasElevator: z.boolean(),
  hasParking: z.boolean(),
  hasGroundAccess: z.boolean(),
  estimateMin: z.number().min(0).optional(),
  estimateMax: z.number().min(0).optional(),
  photos: z.array(z.string().url()).max(5).optional(),
  agreedToTerms: z.boolean(),
  agreedToPrivacy: z.boolean(),
  agreedToMarketing: z.boolean().optional().default(false),
  agreedToNightNotification: z.boolean().optional().default(false),
  preferredSlots: z.array(z.string()).min(1).optional(),
});

export const BookingUpdateSchema = z.object({
  status: z
    .enum([
      "pending",
      "quote_confirmed",
      "user_confirmed",
      "change_requested",
      "in_progress",
      "completed",
      "payment_requested",
      "payment_completed",
      "cancelled",
      "rejected",
    ])
    .optional(),
  finalPrice: z.number().min(0).max(100000000).optional(),
  adminMemo: z.string().max(2000).optional(),
  confirmedTime: z.string().nullable().optional(),
  expectedUpdatedAt: z.string().optional(),
  driverId: z.string().nullable().optional(),
  driverName: z.string().max(50).nullable().optional(),
  confirmedDuration: z.number().int().min(0).max(600).nullable().optional(),
  completionPhotos: z.array(z.string().url()).max(20).optional(),
  crewSize: z.number().int().min(1).max(20).optional(),
  items: z
    .array(
      z.object({
        category: z.string(),
        name: z.string(),
        displayName: z.string().optional(),
        price: z.number().min(0),
        quantity: z.number().int().min(1),
        loadingCube: z.number().min(0).default(0),
      }),
    )
    .optional(),
});

export const PhoneSchema = z.string().regex(/^01[0-9]\d{7,8}$/);

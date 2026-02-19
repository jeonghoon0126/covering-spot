import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

const LeadSchema = z.object({
  customerName: z.string().min(1).max(50),
  phone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/),
  address: z.string().max(200).optional(),
  addressDetail: z.string().max(100).optional(),
  items: z.unknown().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeSlot: z.string().max(50).optional(),
  area: z.string().max(50).optional(),
  hasElevator: z.boolean().optional(),
  hasParking: z.boolean().optional(),
  needLadder: z.boolean().optional(),
  memo: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다" },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const { data, error } = await supabase
      .from("leads")
      .insert({
        customer_name: d.customerName,
        phone: d.phone,
        address: d.address || null,
        address_detail: d.addressDetail || null,
        items: d.items || null,
        date: d.date || null,
        time_slot: d.timeSlot || null,
        area: d.area || null,
        has_elevator: d.hasElevator ?? null,
        has_parking: d.hasParking ?? null,
        need_ladder: d.needLadder ?? null,
        memo: d.memo || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (e) {
    console.error("[leads/POST]", e);
    return NextResponse.json(
      { error: "리드 저장 실패" },
      { status: 500 },
    );
  }
}

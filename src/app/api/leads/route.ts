import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { data, error } = await supabase
      .from("leads")
      .insert({
        customer_name: body.customerName,
        phone: body.phone,
        address: body.address || null,
        address_detail: body.addressDetail || null,
        items: body.items || null,
        date: body.date || null,
        time_slot: body.timeSlot || null,
        area: body.area || null,
        has_elevator: body.hasElevator ?? null,
        has_parking: body.hasParking ?? null,
        need_ladder: body.needLadder ?? null,
        memo: body.memo || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "리드 저장 실패", detail: String(e) },
      { status: 500 },
    );
  }
}

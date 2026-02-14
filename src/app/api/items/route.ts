import { NextResponse } from "next/server";
import { SPOT_CATEGORIES } from "@/data/spot-items";

export async function GET() {
  return NextResponse.json({ categories: SPOT_CATEGORIES });
}

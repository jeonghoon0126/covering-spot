import { NextResponse } from "next/server";
import { SPOT_AREAS } from "@/data/spot-areas";

export async function GET() {
  return NextResponse.json({ areas: SPOT_AREAS });
}

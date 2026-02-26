import { NextResponse } from "next/server";
import { getSpotAreas } from "@/lib/db";

export async function GET() {
  try {
    const areas = await getSpotAreas(true);
    return NextResponse.json({ areas });
  } catch (e) {
    console.error("[areas/GET]", e);
    return NextResponse.json({ error: "지역 조회 실패" }, { status: 500 });
  }
}

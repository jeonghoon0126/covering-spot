import { NextRequest, NextResponse } from "next/server";
import { getBookings } from "@/lib/db-bookings";
import { getBlockedSlots } from "@/lib/db-misc";
import { getDriversWithVehicleForDate } from "@/lib/db-vehicles";
import { validateToken } from "@/app/api/admin/auth/route";

export const dynamic = "force-dynamic";

const SLOTS = ["10:00", "12:00", "14:00", "16:00"];
const SLOT_LABELS: Record<string, string> = {
  "10:00": "10:00~12:00",
  "12:00": "12:00~14:00",
  "14:00": "14:00~16:00",
  "16:00": "16:00~18:00",
};

function mapToSlot(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const mins = h * 60 + m;
  if (mins >= 9 * 60 && mins < 12 * 60) return "10:00";
  if (mins >= 12 * 60 && mins < 14 * 60) return "12:00";
  if (mins >= 14 * 60 && mins < 16 * 60) return "14:00";
  if (mins >= 16 * 60 && mins < 19 * 60) return "16:00";
  return time;
}

function isSlotBlocked(slotStart: string, timeStart: string, timeEnd: string): boolean {
  const [sh] = slotStart.split(":").map(Number);
  const slotS = sh * 60;
  const slotE = slotS + 120;
  const [bh1, bm1] = timeStart.split(":").map(Number);
  const [bh2, bm2] = timeEnd.split(":").map(Number);
  const blockedS = bh1 * 60 + bm1;
  const blockedE = bh2 * 60 + bm2;
  return !(slotE <= blockedS || slotS >= blockedE);
}

export async function GET(req: NextRequest) {
  if (!validateToken(req)) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "date 파라미터가 필요합니다" }, { status: 400 });
  }

  const [drivers, bookings, blocked] = await Promise.all([
    getDriversWithVehicleForDate(date),
    getBookings(date),
    getBlockedSlots(date),
  ]);

  // 기사별 슬롯별 사용 적재량 + 예약 수
  const usedCubePerDriver: Record<string, number> = {};
  const bookingCountPerDriverSlot: Record<string, Record<string, number>> = {};
  for (const d of drivers) {
    usedCubePerDriver[d.id] = 0;
    bookingCountPerDriverSlot[d.id] = {};
  }
  for (const b of bookings) {
    if (b.status === "rejected" || b.status === "cancelled") continue;
    if (!b.driverId || !(b.driverId in usedCubePerDriver)) continue;
    usedCubePerDriver[b.driverId] += b.totalLoadingCube ?? 0;
    if (b.confirmedTime) {
      const slot = mapToSlot(b.confirmedTime);
      bookingCountPerDriverSlot[b.driverId][slot] =
        (bookingCountPerDriverSlot[b.driverId][slot] ?? 0) + 1;
    }
  }

  const blockedSlotSet = new Set<string>();
  for (const bs of blocked) {
    for (const slot of SLOTS) {
      if (isSlotBlocked(slot, bs.timeStart, bs.timeEnd)) blockedSlotSet.add(slot);
    }
  }

  const slots = SLOTS.map((time) => {
    const slotDrivers = drivers.filter((d) => {
      if (d.workSlots && d.workSlots.trim() !== "") {
        const allowed = d.workSlots.split(",").map((s) => s.trim());
        if (!allowed.includes(time)) return false;
      }
      return true;
    });

    const driverDetails = slotDrivers.map((d) => {
      const usedCube = usedCubePerDriver[d.id] ?? 0;
      const remainingCube = d.effectiveCapacity - d.initialLoadCube - usedCube;
      return {
        driverId: d.id,
        driverName: d.name,
        vehicleName: d.effectiveVehicleName,
        vehicleType: d.vehicleType,
        effectiveCapacity: d.effectiveCapacity,
        isAssignedVehicle: d.isAssignedVehicle,
        initialLoadCube: d.initialLoadCube,
        usedCube: Math.round(usedCube * 100) / 100,
        remainingCube: Math.round(remainingCube * 100) / 100,
        bookingCount: bookingCountPerDriverSlot[d.id]?.[time] ?? 0,
      };
    });

    const totalCapacity = driverDetails.reduce((s, d) => s + d.effectiveCapacity, 0);
    const totalUsed = driverDetails.reduce((s, d) => s + d.usedCube, 0);
    const totalRemaining = driverDetails.reduce((s, d) => s + d.remainingCube, 0);

    return {
      time,
      label: SLOT_LABELS[time],
      blocked: blockedSlotSet.has(time),
      crewCount: driverDetails.length,
      totalCapacity: Math.round(totalCapacity * 100) / 100,
      totalUsed: Math.round(totalUsed * 100) / 100,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
      drivers: driverDetails,
    };
  });

  return NextResponse.json({ date, slots });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBookings, getDrivers, getUnloadingPoints, updateBooking, getBookingPhonesByIds } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";
import { sendStatusSms } from "@/lib/sms-notify";
import { autoDispatch } from "@/lib/optimizer/auto-dispatch";
import { getRouteETA, type RoutePoint } from "@/lib/kakao-directions";
import type { DispatchBooking, DispatchDriver, DispatchUnloadingPoint } from "@/lib/optimizer/types";
import type { Booking } from "@/types/booking";

const AutoDispatchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // 기사별 허용 시간대 제약 (빈 배열 = 제약 없음)
  driverSlotFilters: z.record(z.string().uuid(), z.array(z.string())).optional(),
});

/**
 * POST /api/admin/dispatch-auto
 * 자동배차 실행 (미리보기)
 * - 미배차 주문만 대상
 * - 결과는 제안(plan)만 반환, 실제 적용은 클라이언트에서 별도 호출
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = AutoDispatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "잘못된 요청", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { date, driverSlotFilters } = parsed.data;

    // 배차 날짜 요일 계산 (KST 기준)
    // workDays = "월,화,수,목,금" 등 쉼표 구분 한국어 요일
    const KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
    const [dy, dm, dd] = date.split("-").map(Number);
    const dayOfWeek = KO_DAYS[new Date(dy, dm - 1, dd).getDay()];

    // 병렬 조회
    const [allBookings, allDrivers, unloadingPoints] = await Promise.all([
      getBookings(date),
      getDrivers(true),
      getUnloadingPoints(true),
    ]);

    // 해당 요일에 근무하는 기사만 필터링 (workDays 미설정 시 항상 근무로 간주)
    const drivers = allDrivers.filter((d) => {
      if (!d.workDays) return true;
      return d.workDays.split(",").map((s) => s.trim()).includes(dayOfWeek);
    });

    // quote_confirmed 상태만 배차 가능 (pending=견적전, in_progress=수거중 등 제외)
    // 좌표 없는 주문(lat=0 또는 lng=0)은 별도 unassigned 처리 (0,0 = 아프리카 근해)
    const dispatchableStatuses = ["quote_confirmed"];
    const unassignedBookings = allBookings.filter(
      (b) =>
        !b.driverId &&
        dispatchableStatuses.includes(b.status) &&
        b.latitude &&
        b.longitude,
    );
    const noCoordBookings = allBookings.filter(
      (b) =>
        !b.driverId &&
        dispatchableStatuses.includes(b.status) &&
        (!b.latitude || !b.longitude),
    );

    // 좌표 없는 주문은 unassigned로 분류
    const noCoordUnassigned = noCoordBookings.map((b) => ({
      id: b.id,
      reason: "좌표 없음",
    }));

    if (unassignedBookings.length === 0) {
      return NextResponse.json({
        plan: [],
        unassigned: noCoordUnassigned,
        stats: {
          totalBookings: noCoordBookings.length,
          assigned: 0,
          unassigned: noCoordBookings.length,
          totalDistance: 0,
        },
        message: "미배차 주문이 없습니다",
      });
    }

    // Booking → DispatchBooking 변환 (좌표 검증 완료된 주문만)
    const dispatchBookings: DispatchBooking[] = unassignedBookings.map((b) => ({
      id: b.id,
      lat: b.latitude!,
      lng: b.longitude!,
      totalLoadingCube: b.totalLoadingCube || 0,
      timeSlot: b.timeSlot,
      address: b.address,
      customerName: b.customerName,
    }));

    const dispatchDrivers: DispatchDriver[] = drivers.map((d) => ({
      id: d.id,
      name: d.name,
      vehicleCapacity: d.vehicleCapacity,
      vehicleType: d.vehicleType,
    }));

    const dispatchUnloadingPoints: DispatchUnloadingPoint[] = unloadingPoints.map((p) => ({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      name: p.name,
    }));

    // 단일 주문 적재량 > 기사 최대 용량 → 물리적 적재 불가 → unassigned 선분리
    // (최대 용량 기준: 투입 기사 중 가장 큰 vehicleCapacity)
    const maxVehicleCapacity =
      dispatchDrivers.length > 0 ? Math.max(...dispatchDrivers.map((d) => d.vehicleCapacity)) : 0;
    const oversizedBookings =
      maxVehicleCapacity > 0
        ? dispatchBookings.filter((b) => b.totalLoadingCube > maxVehicleCapacity)
        : [];
    const validBookings =
      oversizedBookings.length > 0
        ? dispatchBookings.filter((b) => b.totalLoadingCube <= maxVehicleCapacity)
        : dispatchBookings;
    if (oversizedBookings.length > 0) {
      console.warn(
        `[dispatch-auto] 적재 불가 주문 ${oversizedBookings.length}건 unassigned 처리 (최대용량=${maxVehicleCapacity}):`,
        oversizedBookings.map((b) => `id=${b.id} load=${b.totalLoadingCube}`),
      );
    }
    const oversizedUnassigned = oversizedBookings.map((b) => ({
      id: b.id,
      reason: `단일 주문 적재량(${b.totalLoadingCube}) > 최대 차량 용량(${maxVehicleCapacity})`,
    }));

    // 자동배차 실행 (시간대 제약 있으면 그룹별 분리 실행)
    let result;
    const activeFilters = driverSlotFilters
      ? Object.fromEntries(Object.entries(driverSlotFilters).filter(([, slots]) => slots.length > 0))
      : {};
    if (Object.keys(activeFilters).length > 0) {
      const groups = buildSlotGroups(validBookings, dispatchDrivers, activeFilters);
      const groupResults = groups.map(({ bookings, drivers }) =>
        bookings.length > 0 && drivers.length > 0
          ? autoDispatch(bookings, drivers, dispatchUnloadingPoints)
          : null,
      );
      // 빈 그룹(기사 없음) → unassigned 처리
      const emptyGroupBookings = groups
        .filter(({ drivers }) => drivers.length === 0)
        .flatMap(({ bookings }) => bookings.map((b) => ({ id: b.id, reason: "배정 기사 없음" })));
      const merged = mergeDispatchResults(groupResults);
      merged.unassigned.push(...emptyGroupBookings, ...oversizedUnassigned);
      merged.stats.unassigned += emptyGroupBookings.length + oversizedUnassigned.length;
      merged.stats.totalBookings += emptyGroupBookings.length + oversizedUnassigned.length;
      result = merged;
    } else {
      result = autoDispatch(validBookings, dispatchDrivers, dispatchUnloadingPoints);
      result.unassigned.push(...oversizedUnassigned);
      result.stats.unassigned += oversizedUnassigned.length;
      result.stats.totalBookings += oversizedUnassigned.length;
    }

    // 기사별 ETA 병렬 계산 (실패해도 plan은 반환 — graceful degradation)
    const coordMap = new Map<string, RoutePoint>(
      dispatchBookings.map((b) => [b.id, { x: b.lng, y: b.lat }]),
    );

    const etaResults = await Promise.allSettled(
      result.plan.map((dp) => {
        const points = dp.bookings
          .map((b) => coordMap.get(b.id))
          .filter((p): p is RoutePoint => p !== undefined);
        return points.length >= 2 ? getRouteETA(points) : Promise.resolve(null);
      }),
    );

    const planWithETA = result.plan.map((dp, idx) => {
      const etaRes = etaResults[idx];
      const eta = etaRes.status === "fulfilled" ? etaRes.value : null;
      if (!eta) return dp;
      return { ...dp, estimatedDuration: eta.duration, estimatedDistance: eta.distance };
    });

    // 좌표 없는 주문을 unassigned에 합산
    const finalUnassigned = [...result.unassigned, ...noCoordUnassigned];
    return NextResponse.json({
      ...result,
      plan: planWithETA,
      unassigned: finalUnassigned,
      stats: {
        ...result.stats,
        unassigned: result.stats.unassigned + noCoordUnassigned.length,
        totalBookings: result.stats.totalBookings + noCoordUnassigned.length,
      },
    });
  } catch (e) {
    console.error("[dispatch-auto/POST]", e);
    return NextResponse.json({ error: "자동배차 실패" }, { status: 500 });
  }
}

/* ── 시간대 제약 헬퍼 ── */

/**
 * 기사별 시간대 제약에 따라 주문·기사를 그룹으로 분리
 * - 제약 있는 기사: 허용 슬롯의 주문만 받음
 * - 제약 없는 기사: 나머지 주문 전체 처리
 *
 * 주의: driverSlotFilters에 명시된 기사가 workDays 필터링으로 drivers 배열에서
 * 이미 제거된 경우, 해당 기사의 슬롯은 slotToDrivers에 등록되지 않아 소속 주문이
 * remaining(제약 없는 기사 그룹)으로 넘어간다. 이는 의도된 동작:
 * 휴무 기사가 담당하던 슬롯 주문은 출근 기사에게 재배정.
 */
function buildSlotGroups(
  bookings: DispatchBooking[],
  drivers: DispatchDriver[],
  driverSlotFilters: Record<string, string[]>,
): Array<{ bookings: DispatchBooking[]; drivers: DispatchDriver[] }> {
  // drivers는 이미 workDays 필터링된 배열 — 휴무 기사 ID는 여기에 없음
  const activeDriverIds = new Set(drivers.map((d) => d.id));
  // driverSlotFilters 중 실제 근무 기사만 제약으로 취급
  const restrictedIds = new Set(
    Object.keys(driverSlotFilters).filter((id) => activeDriverIds.has(id)),
  );
  const unrestrictedDrivers = drivers.filter((d) => !restrictedIds.has(d.id));

  // 슬롯 → 허용된 (제약) 기사 목록 (근무 기사만)
  const slotToDrivers = new Map<string, DispatchDriver[]>();
  for (const driver of drivers) {
    if (!restrictedIds.has(driver.id)) continue;
    for (const slot of driverSlotFilters[driver.id] ?? []) {
      if (!slotToDrivers.has(slot)) slotToDrivers.set(slot, []);
      slotToDrivers.get(slot)!.push(driver);
    }
  }

  const groups: Array<{ bookings: DispatchBooking[]; drivers: DispatchDriver[] }> = [];
  const claimedIds = new Set<string>();

  for (const [slot, slotDrivers] of slotToDrivers.entries()) {
    const slotBookings = bookings.filter((b) => (b.timeSlot || "기타") === slot);
    if (slotBookings.length === 0) continue;
    for (const b of slotBookings) claimedIds.add(b.id);
    groups.push({ bookings: slotBookings, drivers: slotDrivers });
  }

  // 미분류 주문 → 제약 없는 기사에게
  const remaining = bookings.filter((b) => !claimedIds.has(b.id));
  if (remaining.length > 0) {
    groups.push({ bookings: remaining, drivers: unrestrictedDrivers });
  }

  return groups;
}

import type { AutoDispatchResult } from "@/lib/optimizer/types";

/**
 * 여러 autoDispatch 결과를 하나로 병합
 * 같은 기사가 여러 그룹에 나타나면 주문을 순서대로 합산
 */
function mergeDispatchResults(results: (AutoDispatchResult | null)[]): AutoDispatchResult {
  const merged: AutoDispatchResult = {
    plan: [],
    unassigned: [],
    stats: { totalBookings: 0, assigned: 0, unassigned: 0, totalDistance: 0 },
  };

  for (const result of results) {
    if (!result) continue;
    for (const dp of result.plan) {
      const existing = merged.plan.find((p) => p.driverId === dp.driverId);
      if (existing) {
        const offset = existing.bookings.length;
        existing.bookings.push(...dp.bookings.map((b, i) => ({ ...b, routeOrder: offset + i + 1 })));
        existing.totalLoad += dp.totalLoad;
        existing.totalDistance += dp.totalDistance;
        existing.legs += dp.legs;
        existing.unloadingStops.push(...dp.unloadingStops);
      } else {
        merged.plan.push({ ...dp });
      }
    }
    merged.unassigned.push(...result.unassigned);
    merged.stats.assigned += result.stats.assigned;
    merged.stats.unassigned += result.stats.unassigned;
    merged.stats.totalDistance += result.stats.totalDistance;
  }

  merged.stats.totalBookings = merged.stats.assigned + merged.stats.unassigned;
  return merged;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ApplySchema = z.object({
  plan: z.array(
    z.object({
      driverId: z.string().uuid(),
      // driverName은 클라이언트 입력 무시 → 서버에서 DB 조회 (변조 방지)
      bookings: z.array(
        z.object({
          id: z.string().regex(UUID_REGEX, "올바른 UUID 형식이 아닙니다"),
          routeOrder: z.number().int().positive(),
        }),
      ),
    }),
  ),
});

/**
 * PUT /api/admin/dispatch-auto
 * 자동배차 결과 일괄 적용
 *
 * 보안:
 *  - UUID 형식 검증 (Zod) → injection 방어
 *  - driverName 서버 조회 (클라이언트 입력 무시 → 변조 방지)
 *  - 취소/거부 상태 주문은 덮어쓰기 방지 (DB 레벨 status 체크)
 *  - 기사별 병렬 처리 → 성능 최적화
 */
export async function PUT(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = ApplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "잘못된 요청", details: parsed.error.format() }, { status: 400 });
    }

    const { plan } = parsed.data;

    // driverName 서버 조회 (비활성 기사 포함 — 배차 시점에 비활성화될 수 있음)
    const allDrivers = await getDrivers(false);
    const driverNameMap = new Map(allDrivers.map((d) => [d.id, d.name]));

    // driverId 유효성 검증 (DB에 없는 기사 → 즉시 거부)
    const unknownDriverIds = plan
      .map((dp) => dp.driverId)
      .filter((id) => !driverNameMap.has(id));
    if (unknownDriverIds.length > 0) {
      return NextResponse.json(
        { error: "존재하지 않는 기사 ID가 포함되어 있습니다", unknownDriverIds },
        { status: 400 },
      );
    }

    const succeeded: string[] = [];
    const failed: string[] = [];

    // 기사별 병렬 처리 (for...of 직렬 → Promise.allSettled 병렬)
    const driverResults = await Promise.allSettled(
      plan.map((driverPlan) => {
        const driverName = driverNameMap.get(driverPlan.driverId)!;
        return Promise.allSettled(
          driverPlan.bookings.map((b) =>
            // 취소/거부 상태 주문은 supabase에서 .neq("status", "cancelled") 등으로 보호
            // updateBooking이 조건 불일치 시 null 반환 → failed 처리
            updateBooking(b.id, {
              driverId: driverPlan.driverId,
              driverName,
              routeOrder: b.routeOrder,
            } as Partial<Booking>),
          ),
        ).then((results) => ({ driverPlan, results }));
      }),
    );

    for (const [planIdx, driverResult] of driverResults.entries()) {
      if (driverResult.status === "fulfilled") {
        const { driverPlan, results } = driverResult.value;
        results.forEach((result, idx) => {
          const bookingId = driverPlan.bookings[idx].id;
          if (result.status === "fulfilled" && result.value !== null) {
            succeeded.push(bookingId);
          } else {
            failed.push(bookingId);
          }
        });
      } else {
        // 기사 전체 실패 — entries()로 인덱스 안전 취득
        plan[planIdx].bookings.forEach((b) => failed.push(b.id));
      }
    }

    if (succeeded.length === 0) {
      return NextResponse.json({ error: "모든 배차 적용 실패", failed }, { status: 500 });
    }

    // 고객 SMS 발송 (fire-and-forget: SMS 실패가 배차 실패를 유발하지 않음)
    if (succeeded.length > 0) {
      getBookingPhonesByIds(succeeded)
        .then((phoneMap) => {
          for (const [bookingId, phone] of phoneMap.entries()) {
            if (phone) sendStatusSms(phone, "dispatched", bookingId).catch((err) => {
              console.error("[SMS 발송 실패]", { bookingId, status: "dispatched", error: err?.message });
            });
          }
        })
        .catch(console.error);
    }

    return NextResponse.json({
      success: failed.length === 0,
      updated: succeeded,
      ...(failed.length > 0 ? { partialFailure: true, failed } : {}),
    });
  } catch (e) {
    console.error("[dispatch-auto/PUT]", e);
    return NextResponse.json({ error: "적용 실패" }, { status: 500 });
  }
}

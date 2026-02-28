import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBookings, getDrivers, getUnloadingPoints, updateBooking, getBookingPhonesByIds, getDriversWithVehicleForDate } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";
import { sendStatusSms } from "@/lib/sms-notify";
import { autoDispatch } from "@/lib/optimizer/auto-dispatch";
import { insertUnloadingStops } from "@/lib/optimizer/tsp";
import { getRouteETA, type RoutePoint } from "@/lib/kakao-directions";
import type { DispatchBooking, DispatchDriver, DispatchUnloadingPoint, RouteSegment } from "@/lib/optimizer/types";
import type { Booking } from "@/types/booking";

// 슬롯 우선순위 (오전→오후→저녁 순서로 routeOrder 배정)
// 같은 기사에 여러 시간대 주문이 있을 때 시간창 역전(저녁→오후) 원천 차단
const SLOT_PRIORITY: Record<string, number> = {
  "오전 (9시~12시)": 0,
  "오후 (13시~17시)": 1,
  "저녁 (18시~20시)": 2,
};

// 현장 서비스 시간 계산 기준
// 기본 5분: 주차 + 인터폰 + 고객 응대 (큐빅 무관 고정값)
// m³당 7분: 품목 적재 작업 시간 (큐빅에 비례)
// 예: 1m³(냉장고+세탁기) → 5+7=12분 / 4m³(장롱+침대+식탁) → 5+28=33분
const BASE_SERVICE_SECS = 5 * 60;
const CUBE_SECS_PER_M3 = 7 * 60;

const AutoDispatchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다"),
  // 기사별 허용 시간대 제약 (빈 배열 = 제약 없음)
  driverSlotFilters: z
    .record(z.string().uuid("기사 ID는 유효한 UUID 형식이어야 합니다"), z.array(z.string()))
    .optional(),
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
    // getDriversWithVehicleForDate: workDays 필터 + 차량 배정 기반 capacity 해석 (차량 이용불가 기간 반영)
    const [allBookings, driversWithVehicle, unloadingPoints] = await Promise.all([
      getBookings(date),
      getDriversWithVehicleForDate(date),
      getUnloadingPoints(true),
    ]);

    // resolvedCapacity=0인 기사 = 차량이 이용불가 상태 → 자동배차에서 제외
    const drivers = driversWithVehicle.filter((d) => d.resolvedCapacity > 0);

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

    // 차량 타입별 1일 최대 수행 건수 (1톤:8건, 2.5톤:6건)
    const JOB_LIMITS: Record<string, number> = { "1톤": 8, "2.5톤": 6 };
    const dispatchDrivers: DispatchDriver[] = drivers.map((d) => ({
      id: d.id,
      name: d.name,
      // resolvedCapacity: 차량 배정이 있으면 vehicle.capacity, 없으면 driver.vehicleCapacity 폴백
      vehicleCapacity: d.resolvedCapacity,
      vehicleType: d.vehicleType,
      maxJobCount: JOB_LIMITS[d.vehicleType] ?? undefined,
      initialLoadCube: d.initialLoadCube ?? 0,
      workSlots: d.workSlots ?? undefined,
      startLat: d.startLatitude ?? undefined,
      startLng: d.startLongitude ?? undefined,
      endLat: d.endLatitude ?? undefined,
      endLng: d.endLongitude ?? undefined,
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

    // 기사 프로필의 workSlots → driverSlotFilters로 변환 (자동 적용)
    const profileSlotFilters: Record<string, string[]> = {};
    drivers.forEach((d) => {
      if (d.workSlots) {
        const slots = d.workSlots.split(",").map((s) => s.trim()).filter(Boolean);
        if (slots.length > 0) profileSlotFilters[d.id] = slots;
      }
    });
    // 요청 body의 driverSlotFilters가 있으면 override (없으면 프로필 값 사용)
    // 주의: 빈 배열 { "driverId": [] } 요청은 실제 제약으로 보지 않음 → 프로필 값 사용
    const hasActiveFilters = Object.values(driverSlotFilters ?? {}).some(
      (slots) => slots.length > 0,
    );
    const effectiveSlotFilters = hasActiveFilters ? driverSlotFilters! : profileSlotFilters;

    // 자동배차: 항상 슬롯별 분리 실행 → 오전→오후→저녁 순서로 routeOrder 배정
    // 슬롯 필터 없어도 주문의 timeSlot 기준으로 그룹을 나누어 시간창 역전 방지
    const activeFilters = Object.fromEntries(
      Object.entries(effectiveSlotFilters).filter(([, slots]) => slots.length > 0)
    );
    const groups = buildSlotGroups(validBookings, dispatchDrivers, activeFilters);
    const groupResults = groups.map(({ bookings, drivers }) =>
      bookings.length > 0 && drivers.length > 0
        ? autoDispatch(bookings, drivers, dispatchUnloadingPoints)
        : null,
    );
    // 빈 그룹(배정 가능한 기사 없음) → unassigned 처리
    const emptyGroupBookings = groups
      .filter(({ drivers }) => drivers.length === 0)
      .flatMap(({ bookings }) => bookings.map((b) => ({ id: b.id, reason: "배정 기사 없음" })));
    const merged = mergeDispatchResults(groupResults);
    merged.unassigned.push(...emptyGroupBookings, ...oversizedUnassigned);
    merged.stats.unassigned += emptyGroupBookings.length + oversizedUnassigned.length;
    merged.stats.totalBookings += emptyGroupBookings.length + oversizedUnassigned.length;
    const result = merged;

    // 기사별 ETA 병렬 계산 (실패해도 plan은 반환 — graceful degradation)
    const coordMap = new Map<string, RoutePoint>(
      dispatchBookings.map((b) => [b.id, { x: b.lng, y: b.lat }]),
    );

    // 하차지 좌표 맵 구성 (ETA waypoint 삽입용)
    const unloadingCoordMap = new Map<string, RoutePoint>(
      unloadingPoints.map((p) => [p.id, { x: p.longitude, y: p.latitude }]),
    );

    const etaResults = await Promise.allSettled(
      result.plan.map((dp) => {
        // routeOrder 기준 정렬 후 하차지 waypoint 삽입
        const sorted = [...dp.bookings].sort((a, b) => a.routeOrder - b.routeOrder);
        const points: RoutePoint[] = [];
        sorted.forEach((b) => {
          const coord = coordMap.get(b.id);
          if (coord) points.push(coord);
          // 이 수거지 이후 하차지 경유가 있으면 좌표 삽입
          const stop = dp.unloadingStops.find((s) => s.afterRouteOrder === b.routeOrder);
          if (stop) {
            const uc = unloadingCoordMap.get(stop.pointId);
            if (uc) points.push(uc);
          }
        });
        return points.length >= 2 ? getRouteETA(points) : Promise.resolve(null);
      }),
    );

    // 시각 계산용: booking id → timeSlot 맵 (unassignedBookings는 Booking 타입으로 timeSlot 포함)
    const bookingTimeSlotMap = new Map<string, string>(
      unassignedBookings.map((b) => [b.id, b.confirmedTime || b.timeSlot || "10:00"]),
    );

    /** 초(midnight 기준) → "HH:MM" 문자열 변환 */
    function secsToHHMM(secs: number): string {
      const normalized = ((secs % 86400) + 86400) % 86400; // 음수 방지
      const h = Math.floor(normalized / 3600);
      const m = Math.floor((normalized % 3600) / 60);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }

    const planWithETA = result.plan.map((dp, idx) => {
      const etaRes = etaResults[idx];
      const eta = etaRes.status === "fulfilled" ? etaRes.value : null;
      if (!eta) return dp;
      // 이동 시간 + 수거지별 서비스 시간 합산 (기본 5분 + m³당 7분)
      const totalServiceSecs = dp.bookings.reduce(
        (sum, b) => sum + BASE_SERVICE_SECS + Math.round(b.loadCube * CUBE_SECS_PER_M3),
        0,
      );
      const totalDuration = eta.duration + totalServiceSecs;

      // ── 구간별(leg별) 출발/도착 시각 계산 ──
      // Kakao sections[i] = points[i] → points[i+1] 이동 구간 (points 순서와 동일)
      const sorted = [...dp.bookings].sort((a, b) => a.routeOrder - b.routeOrder);

      // 경로에 포함된 포인트 순서 재구성 (ETA 호출과 동일한 순서)
      const pointTypes: Array<
        | { type: "booking"; id: string }
        | { type: "unloading"; id: string }
      > = [];
      sorted.forEach((b) => {
        if (coordMap.has(b.id)) {
          pointTypes.push({ type: "booking", id: b.id });
        }
        const stop = dp.unloadingStops.find((s) => s.afterRouteOrder === b.routeOrder);
        if (stop && unloadingCoordMap.has(stop.pointId)) {
          pointTypes.push({ type: "unloading", id: stop.pointId });
        }
      });

      // 시작 시각: 첫 번째 수거지 도착 시각 = booking의 timeSlot (또는 confirmedTime)
      const firstBookingId = sorted[0]?.id;
      const startTimeStr = (firstBookingId ? bookingTimeSlotMap.get(firstBookingId) : null) || "10:00";
      const [sh, sm] = startTimeStr.split(":").map(Number);
      let currentSecs = (isNaN(sh) ? 10 : sh) * 3600 + (isNaN(sm) ? 0 : sm) * 60;

      const sections = eta.sections;
      const segments: RouteSegment[] = [];

      // sections[i] = pointTypes[i] → pointTypes[i+1]
      for (let i = 0; i < pointTypes.length - 1; i++) {
        const fromPt = pointTypes[i];
        const toPt = pointTypes[i + 1];
        const section = sections[i];
        if (!section) break; // Kakao sections가 point 수보다 적은 경우 안전 종료

        // 출발지가 수거지인 경우 서비스 시간 경과 후 출발
        if (fromPt.type === "booking") {
          const bk = sorted.find((b) => b.id === fromPt.id);
          const svcSecs = bk
            ? BASE_SERVICE_SECS + Math.round(bk.loadCube * CUBE_SECS_PER_M3)
            : BASE_SERVICE_SECS;
          currentSecs += svcSecs;
        }
        // 하차지는 즉시 출발 (현재 모델에서 하차 작업 시간 미계상)

        const departureSecs = currentSecs;
        currentSecs += section.duration;
        const arrivalSecs = currentSecs;

        segments.push({
          fromBookingId: fromPt.type === "booking" ? fromPt.id : undefined,
          fromUnloadingId: fromPt.type === "unloading" ? fromPt.id : undefined,
          travelSecs: section.duration,
          distanceMeters: section.distance,
          departureTime: secsToHHMM(departureSecs),
          arrivalTime: secsToHHMM(arrivalSecs),
          isUnloadingLeg: toPt.type === "unloading",
        });
      }

      return { ...dp, estimatedDuration: totalDuration, estimatedDistance: eta.distance, segments };
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

/* ── 시간대 분리 헬퍼 ── */

/**
 * 주문을 timeSlot 기준으로 슬롯별 그룹 분리 + 오전→오후→저녁 순서 정렬
 *
 * 핵심 원칙:
 *   - 슬롯 필터 유무와 무관하게 항상 주문의 timeSlot으로 그룹을 나눔
 *   - mergeDispatchResults가 슬롯 순서대로 처리 → routeOrder가 시간창 순서 보장
 *   - "저녁 고객 → 오후 고객" 역전이 구조적으로 불가능해짐
 *
 * 기사 배정 기준:
 *   - driverSlotFilters에 해당 슬롯이 허용된 기사: 해당 슬롯만 처리
 *   - driverSlotFilters에 없는 기사: 제한 없음 (모든 슬롯 처리 가능)
 *   - workDays 필터링은 상위 레이어에서 완료된 상태 (drivers 배열이 이미 당일 근무자만)
 */
function buildSlotGroups(
  bookings: DispatchBooking[],
  drivers: DispatchDriver[],
  driverSlotFilters: Record<string, string[]>,
): Array<{ bookings: DispatchBooking[]; drivers: DispatchDriver[] }> {
  // 주문을 timeSlot별로 분류
  const slotBookingMap = new Map<string, DispatchBooking[]>();
  for (const booking of bookings) {
    const slot = booking.timeSlot || "기타";
    if (!slotBookingMap.has(slot)) slotBookingMap.set(slot, []);
    slotBookingMap.get(slot)!.push(booking);
  }

  // 슬롯을 SLOT_PRIORITY 순서로 정렬 (오전→오후→저녁→기타)
  const orderedSlots = [...slotBookingMap.keys()].sort((a, b) => {
    const pa = SLOT_PRIORITY[a] ?? 99;
    const pb = SLOT_PRIORITY[b] ?? 99;
    return pa - pb;
  });

  const groups: Array<{ bookings: DispatchBooking[]; drivers: DispatchDriver[] }> = [];

  for (const slot of orderedSlots) {
    const slotBookings = slotBookingMap.get(slot)!;

    // 이 슬롯을 처리 가능한 기사 필터링:
    // - driverSlotFilters에 명시된 기사: 해당 필터 우선 적용 (빈 배열이면 이 슬롯 배차 불가)
    // - driverSlotFilters에 없는 기사: 프로필 workSlots 확인 후 판단
    const slotDrivers = drivers.filter((d) => {
      const filter = driverSlotFilters[d.id];
      if (filter !== undefined) {
        // 고급 설정에 명시: 빈 배열이면 배차 불가, 아니면 허용 목록 확인
        return filter.length > 0 && filter.includes(slot);
      }
      // 고급 설정 없으면 프로필 workSlots 확인
      if (d.workSlots) {
        const profileSlots = d.workSlots.split(",").map((s) => s.trim()).filter(Boolean);
        return profileSlots.length === 0 || profileSlots.includes(slot);
      }
      return true;
    });

    groups.push({ bookings: slotBookings, drivers: slotDrivers });
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
      // 하차지 경유 정보: 어떤 routeOrder 이후에 어느 하차지를 경유하는지
      unloadingStops: z.array(
        z.object({
          afterRouteOrder: z.number().int().positive(),
          pointId: z.string().uuid(),
        }),
      ).optional().default([]),
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
          driverPlan.bookings.map((b) => {
            // 이 수거지 이후 하차지 경유가 있으면 unloadingStopAfter에 저장
            const stopAfter = (driverPlan.unloadingStops ?? []).find(
              (s) => s.afterRouteOrder === b.routeOrder,
            );
            return (
              // 취소/거부 상태 주문은 supabase에서 .neq("status", "cancelled") 등으로 보호
              // updateBooking이 조건 불일치 시 null 반환 → failed 처리
              updateBooking(b.id, {
                driverId: driverPlan.driverId,
                driverName,
                routeOrder: b.routeOrder,
                unloadingStopAfter: stopAfter?.pointId ?? null,
              } as Partial<Booking>)
            );
          }),
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

/**
 * PATCH /api/admin/dispatch-auto?date=YYYY-MM-DD
 * 이미 배차된 주문의 unloadingStopAfter 소급 계산
 * - 기사별 routeOrder 순서로 누적 적재량 계산 → 용량 초과 지점에 하차지 삽입
 * - 기존 배차(코드 배포 전)에 unloading_stop_after가 NULL인 경우 재계산
 */
export async function PATCH(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const date = req.nextUrl.searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date 파라미터가 필요합니다 (YYYY-MM-DD)" }, { status: 400 });
    }

    const [allBookings, allDrivers, unloadingPoints] = await Promise.all([
      getBookings(date),
      getDrivers(false),
      getUnloadingPoints(true),
    ]);

    const driverMap = new Map(allDrivers.map((d) => [d.id, d]));

    // 배차 완료된 주문만 (driverId + routeOrder 있는 것)
    const dispatchedBookings = allBookings.filter(
      (b) => b.driverId && b.routeOrder != null && b.latitude != null && b.longitude != null,
    );
    if (dispatchedBookings.length === 0) {
      return NextResponse.json({ updated: 0, message: "배차된 주문이 없습니다" });
    }

    // 기사별 그룹핑
    const byDriver = new Map<string, typeof dispatchedBookings>();
    for (const b of dispatchedBookings) {
      if (!byDriver.has(b.driverId!)) byDriver.set(b.driverId!, []);
      byDriver.get(b.driverId!)!.push(b);
    }

    const dispatchUnloadingPoints: DispatchUnloadingPoint[] = unloadingPoints.map((p) => ({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      name: p.name,
    }));

    const updateTasks: Array<() => Promise<unknown>> = [];

    for (const [driverId, driverBookings] of byDriver.entries()) {
      const driver = driverMap.get(driverId);
      if (!driver || !driver.vehicleCapacity) continue;

      const sorted = [...driverBookings].sort(
        (a, b) => (a.routeOrder ?? 9999) - (b.routeOrder ?? 9999),
      );

      const dispatchBks: DispatchBooking[] = sorted.map((b) => ({
        id: b.id,
        lat: b.latitude!,
        lng: b.longitude!,
        totalLoadingCube: b.totalLoadingCube || 0,
        timeSlot: b.timeSlot,
        address: b.address,
        customerName: b.customerName,
      }));

      const stops = insertUnloadingStops(dispatchBks, driver.vehicleCapacity, dispatchUnloadingPoints);

      for (const b of sorted) {
        const stop = stops.find((s) => s.afterRouteOrder === b.routeOrder);
        const newStopAfter = stop?.pointId ?? null;
        // 값이 변경된 경우만 업데이트
        if (b.unloadingStopAfter !== newStopAfter) {
          updateTasks.push(() =>
            updateBooking(b.id, { unloadingStopAfter: newStopAfter } as Partial<Booking>),
          );
        }
      }
    }

    await Promise.allSettled(updateTasks.map((fn) => fn()));

    return NextResponse.json({ updated: updateTasks.length });
  } catch (e) {
    console.error("[dispatch-auto/PATCH]", e);
    return NextResponse.json({ error: "재계산 실패" }, { status: 500 });
  }
}

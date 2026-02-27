/**
 * Barrel export — 모든 DB 쿼리 함수와 타입을 도메인별 파일에서 re-export
 *
 * 기존 import { getBookings, updateBooking } from "@/lib/db" 호환 유지
 */

// 예약 (Bookings)
export * from "./db-bookings";

// 기사 (Drivers)
export * from "./db-drivers";

// 차량 + 이용불가 기간 + 기사-차량 배정 (Vehicles)
export * from "./db-vehicles";

// 하차지 + 배차 복합 조회 (Dispatch)
export * from "./db-dispatch";

// 단가 테이블 (SpotItems/Areas/Ladder) + 차단 슬롯 (BlockedSlots)
export * from "./db-misc";

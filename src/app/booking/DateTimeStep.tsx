"use client";

import { isDateBookable } from "@/lib/booking-utils";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { DAYS_KO, TIME_OPTIONS, TIME_LABELS, getMonthDays } from "./booking-constants";

interface DateTimeStepProps {
  selectedDate: string;
  setSelectedDate: (v: string) => void;
  selectedTime: string;
  setSelectedTime: (v: string) => void;
  calMonth: { year: number; month: number };
  setCalMonth: React.Dispatch<React.SetStateAction<{ year: number; month: number }>>;
  timeSlotCounts: Record<string, number>;
  slotsLoading: boolean;
}

export function DateTimeStep({
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
  calMonth,
  setCalMonth,
  timeSlotCounts,
  slotsLoading,
}: DateTimeStepProps) {
  return (
    <div className="space-y-6">
      {/* 마감 안내 */}
      <div className="bg-primary-tint/30 rounded-md px-4 py-3 border border-primary/20">
        <p className="text-sm text-primary font-medium">
          수거 희망일 전날 낮 12시까지 신청 가능합니다
        </p>
      </div>
      {/* 달력 */}
      <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() =>
              setCalMonth((p) => {
                const d = new Date(p.year, p.month - 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })
            }
            className="p-2 hover:bg-bg-warm rounded-sm"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span className="font-semibold">
            {calMonth.year}년 {calMonth.month + 1}월
          </span>
          <button
            onClick={() =>
              setCalMonth((p) => {
                const d = new Date(p.year, p.month + 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })
            }
            className="p-2 hover:bg-bg-warm rounded-sm"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {DAYS_KO.map((d) => (
            <div key={d} className="py-1 text-text-muted font-medium">
              {d}
            </div>
          ))}
          {getMonthDays(calMonth.year, calMonth.month).map((day, i) => {
            if (day === null)
              return <div key={`empty-${i}`} />;
            const dateStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isPast = !isDateBookable(dateStr);
            const isSelected = dateStr === selectedDate;
            return (
              <button
                key={dateStr}
                disabled={isPast}
                onClick={() => setSelectedDate(dateStr)}
                aria-label={`${calMonth.month + 1}월 ${day}일 ${isPast ? '예약 불가' : '예약 가능'}`}
                aria-pressed={isSelected}
                className={`py-3 min-h-[44px] rounded-md text-sm transition-all duration-200 ${
                  isPast
                    ? "text-text-muted/40 cursor-not-allowed"
                    : isSelected
                      ? "bg-primary text-white font-bold shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                      : "hover:bg-primary-bg active:scale-95 font-medium"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* 시간대 선택 */}
      {selectedDate && (
        <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5">
          <h3 className="font-semibold mb-1">시간대 선택</h3>
          <p className="text-sm text-text-sub mb-3">
            쓰레기 수거량에 따라서 수거 시간대가 확정돼요.<br />
            매니저가 신청 내용 확인 후 견적과 함께 확정 안내를 드려요.
          </p>
          {slotsLoading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="grid grid-cols-3 max-sm:grid-cols-2 gap-3">
              {TIME_OPTIONS.map((opt) => {
                const count = timeSlotCounts[opt] ?? -1;
                const isFull = count === 0; // -1 = 미로드 (가능으로 표시), 0 = 마감
                return (
                  <button
                    key={opt}
                    onClick={() => !isFull && setSelectedTime(opt)}
                    disabled={isFull}
                    aria-label={`${opt} ${isFull ? '마감' : '선택 가능'}`}
                    aria-pressed={opt === selectedTime}
                    className={`py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                      isFull
                        ? "bg-fill-tint text-text-muted cursor-not-allowed"
                        : opt === selectedTime
                          ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                          : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
                    }`}
                  >
                    {TIME_LABELS[opt] || opt}
                    {isFull && (
                      <span className="block text-xs mt-0.5 text-semantic-red/70">마감</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

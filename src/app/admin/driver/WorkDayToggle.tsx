"use client";

import { ALL_WORK_DAYS, SLOT_ORDER, SLOT_LABELS } from "./constants";

/* ── 근무요일 토글 컴포넌트 ── */

export function WorkDayToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = new Set(value ? value.split(",") : []);
  function toggle(day: string) {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange(ALL_WORK_DAYS.filter((d) => next.has(d)).join(","));
  }
  return (
    <div className="flex gap-1">
      {ALL_WORK_DAYS.map((day) => {
        const active = selected.has(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            className={`flex-1 h-8 text-xs font-semibold rounded-sm border transition-colors ${
              active
                ? "bg-primary text-white border-primary"
                : "bg-bg-warm text-text-muted border-border-light"
            } ${day === "토" || day === "일" ? (active ? "bg-primary/80" : "text-text-muted/60") : ""}`}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

/* ── 가능 슬롯 토글 컴포넌트 ── */

export function WorkSlotToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // 빈 문자열 = 모든 슬롯 가능 (ALL)
  const selected = new Set(value ? value.split(",").map((s) => s.trim()).filter(Boolean) : []);
  const isAll = selected.size === 0;

  function toggle(slot: string) {
    const next = new Set(selected);
    if (next.has(slot)) {
      next.delete(slot);
    } else {
      next.add(slot);
    }
    // 모두 선택되거나 모두 해제 → 빈 문자열(전체)로 정규화
    if (next.size === 0 || next.size === SLOT_ORDER.length) {
      onChange("");
    } else {
      onChange(SLOT_ORDER.filter((s) => next.has(s)).join(","));
    }
  }

  function setAll() {
    onChange("");
  }

  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={setAll}
        className={`px-2 h-8 text-xs font-semibold rounded-sm border transition-colors ${
          isAll
            ? "bg-primary text-white border-primary"
            : "bg-bg-warm text-text-muted border-border-light"
        }`}
      >
        전체
      </button>
      {SLOT_ORDER.map((slot) => {
        const active = !isAll && selected.has(slot);
        return (
          <button
            key={slot}
            type="button"
            onClick={() => toggle(slot)}
            className={`flex-1 h-8 text-xs font-semibold rounded-sm border transition-colors ${
              active
                ? "bg-primary text-white border-primary"
                : "bg-bg-warm text-text-muted border-border-light"
            }`}
          >
            {SLOT_LABELS[slot]}
          </button>
        );
      })}
    </div>
  );
}

/* ── 가능 슬롯 읽기 전용 칩 ── */

export function WorkSlotChips({ value }: { value: string }) {
  if (!value) {
    return (
      <div className="flex gap-1 mt-1">
        <span className="text-[11px] px-2 py-0.5 rounded-sm border bg-primary/10 text-primary border-primary/30 font-medium">
          전체 슬롯
        </span>
      </div>
    );
  }
  const selected = new Set(value.split(",").map((s) => s.trim()).filter(Boolean));
  return (
    <div className="flex gap-1 mt-1">
      {SLOT_ORDER.filter((s) => selected.has(s)).map((slot) => (
        <span
          key={slot}
          className="text-[11px] px-2 py-0.5 rounded-sm border bg-primary/10 text-primary border-primary/30 font-medium"
        >
          {SLOT_LABELS[slot]}
        </span>
      ))}
    </div>
  );
}

/* ── 근무요일 읽기 전용 칩 ── */

export function WorkDayChips({ value }: { value: string }) {
  const selected = new Set(value ? value.split(",") : []);
  return (
    <div className="flex gap-1 mt-2">
      {ALL_WORK_DAYS.map((day) => {
        const active = selected.has(day);
        return (
          <span
            key={day}
            className={`flex-1 h-7 flex items-center justify-center text-[11px] font-semibold rounded-sm border ${
              active
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-bg-warm text-text-muted/50 border-border-light/50"
            }`}
          >
            {day}
          </span>
        );
      })}
    </div>
  );
}

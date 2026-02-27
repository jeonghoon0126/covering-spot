"use client";

import { STEPS } from "./booking-constants";

interface StepIndicatorProps {
  step: number;
  editMode: boolean;
}

export function StepIndicator({ step, editMode }: StepIndicatorProps) {
  return (
    <div className="mb-10" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuetext={`${STEPS.length}단계 중 ${step + 1}단계: ${STEPS[step]}`}>
      {/* 프로그레스 바 */}
      <div className="flex items-center gap-1.5 max-sm:gap-1 mb-4">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5 max-sm:gap-1 flex-1">
            <div
              className={`w-9 h-9 max-sm:w-7 max-sm:h-7 rounded-full flex items-center justify-center text-sm max-sm:text-xs font-bold shrink-0 transition-all duration-300 ${
                i < step
                  ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                  : i === step
                    ? "bg-primary text-white ring-[3px] ring-primary/20 shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                    : "bg-bg-warm2 text-text-muted"
              }`}
            >
              {i < step ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-[2px] flex-1 rounded-full overflow-hidden bg-bg-warm2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${i < step ? "w-full bg-primary" : "w-0"}`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {/* 현재 스텝 정보 */}
      {editMode && step === 0 && (
        <p className="text-xs font-semibold text-semantic-orange mb-1">신청 수정</p>
      )}
      <h2 className="text-2xl font-bold tracking-[-0.5px]">
        {STEPS[step]}
      </h2>
    </div>
  );
}

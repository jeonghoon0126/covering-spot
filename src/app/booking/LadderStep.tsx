"use client";

import { Checkbox } from "@/components/ui/Checkbox";

interface LadderStepProps {
  needLadder: boolean;
  setNeedLadder: (v: boolean) => void;
  ladderType: string;
  setLadderType: (v: string) => void;
}

export function LadderStep({
  needLadder,
  setNeedLadder,
  ladderType,
  setLadderType,
}: LadderStepProps) {
  return (
    <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5 space-y-5">
      <p className="text-sm text-text-sub">사다리차 필요여부를 알려주세요</p>
      <Checkbox
        checked={needLadder}
        onChange={(e) => setNeedLadder(e.target.checked)}
        label="사다리차가 필요해요"
      />

      {needLadder && (
        <>
          <div>
            <p className="text-sm font-semibold mb-3">층수</p>
            <div className="flex gap-3">
              {["10층 미만", "10층 이상"].map((t) => (
                <button
                  key={t}
                  onClick={() => setLadderType(t)}
                  className={`flex-1 py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                    ladderType === t
                      ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                      : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-text-muted mt-2">
            사다리차 소요시간은 품목에 따라 매니저가 확정합니다
          </p>
        </>
      )}
    </div>
  );
}

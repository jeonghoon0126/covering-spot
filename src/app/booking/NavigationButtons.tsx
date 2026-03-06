"use client";

import type { BookingItem } from "@/types/booking";
import { Button } from "@/components/ui/Button";
import { VAGUE_ITEM_KEYWORDS } from "./booking-constants";
import { KAKAO_CHAT_URL } from "@/lib/constants";

interface NavigationButtonsProps {
  step: number;
  setStep: (v: number) => void;
  canNext: (boolean | string)[];
  loading: boolean;
  editMode: boolean;
  selectedItems: BookingItem[];
  onVagueItem: (itemName: string, onContinue: () => void) => void;
  onSubmit: () => void;
}

export function NavigationButtons({
  step,
  setStep,
  canNext,
  loading,
  editMode,
  selectedItems,
  onVagueItem,
  onSubmit,
}: NavigationButtonsProps) {
  return (
    <div className="mt-8">
      <div className="flex gap-3">
        {step > 0 && (
          <Button
            variant="tertiary"
            size="lg"
            fullWidth
            onClick={() => setStep(step - 1)}
          >
            이전
          </Button>
        )}
        {step < 5 ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canNext[step]}
            onClick={() => {
              if (step === 0) {
                const vagueItem = selectedItems.find((item) =>
                  item.category === "직접입력" &&
                  VAGUE_ITEM_KEYWORDS.some((kw) => item.name.includes(kw))
                );
                if (vagueItem) {
                  onVagueItem(vagueItem.name, () => setStep(step + 1));
                  return;
                }
              }
              setStep(step + 1);
            }}
          >
            다음
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canNext[step] || loading}
            loading={loading}
            onClick={onSubmit}
          >
            {loading ? "" : editMode ? "수정 완료" : "최종 견적 요청하기"}
          </Button>
        )}
      </div>
      <div className="flex justify-center mt-3">
        <a
          href={KAKAO_CHAT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-text-muted hover:text-primary transition-colors"
        >
          💬 카톡으로 5분 만에 신청하기
        </a>
      </div>
    </div>
  );
}

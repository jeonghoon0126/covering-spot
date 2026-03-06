"use client";

import type { BookingItem } from "@/types/booking";
import { Button } from "@/components/ui/Button";
import { CTALink } from "@/components/ui/CTALink";
import { KakaoIcon } from "@/components/ui/KakaoIcon";
import { VAGUE_ITEM_KEYWORDS } from "./booking-constants";

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
      <div className="mt-3">
        <CTALink
          location="funnel"
          className="inline-flex items-center justify-center gap-2.5 bg-kakao text-text-primary text-base font-bold py-4 w-full rounded-lg shadow-sm hover:shadow-md hover:bg-kakao-hover hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
        >
          <KakaoIcon />
          <span>카카오톡으로 5분만에 신청하기</span>
        </CTALink>
      </div>
    </div>
  );
}

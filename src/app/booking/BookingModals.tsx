"use client";

import DaumPostcodeEmbed from "react-daum-postcode";
import { Button } from "@/components/ui/Button";
import { ModalHeader } from "@/components/ui/ModalHeader";
interface VagueItemModalProps {
  open: boolean;
  itemName: string;
  onClose: () => void;
  onContinue: (() => void) | null;
}

export function VagueItemModal({ open, itemName, onClose, onContinue }: VagueItemModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-label="품목 입력 안내"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div className="bg-white rounded-lg overflow-hidden w-full max-w-[28rem]">
        <ModalHeader
          title="품목을 구체적으로 입력해주세요"
          onClose={onClose}
        />
        <div className="p-6 space-y-4">
          <p className="text-sm text-text-primary leading-relaxed">
            &apos;{itemName}&apos;처럼 뭉뚱그린 품목은 실제 수거 시 시간이 크게 늘어날 수 있습니다.
          </p>
          <p className="text-sm text-text-sub leading-relaxed">
            예시: 소파 1개, 장롱 2자 1개, 박스 10개 등 구체적으로 입력해주세요.
          </p>
          <div className="flex gap-2 pt-2">
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={onClose}
            >
              다시 입력하기
            </Button>
            <Button
              variant="tertiary"
              size="md"
              fullWidth
              onClick={() => {
                onClose();
                if (onContinue) onContinue();
              }}
            >
              이대로 진행
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PostcodeModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (address: string, sigungu: string, sido: string) => void;
}

export function PostcodeModal({ open, onClose, onComplete }: PostcodeModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-label="주소 검색"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div className="bg-white rounded-lg overflow-hidden w-full max-w-[28rem]">
        <ModalHeader
          title="주소 검색"
          onClose={onClose}
        />
        <DaumPostcodeEmbed
          onComplete={(data) => {
            const address = data.roadAddress || data.jibunAddress;
            onComplete(address, data.sigungu, data.sido);
          }}
          style={{ height: 400 }}
        />
      </div>
    </div>
  );
}

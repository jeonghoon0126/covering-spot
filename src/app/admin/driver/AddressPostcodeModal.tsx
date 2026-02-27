"use client";

import DaumPostcodeEmbed from "react-daum-postcode";

interface AddressPostcodeModalProps {
  show: boolean;
  onClose: () => void;
  onComplete: (address: string) => void;
}

export default function AddressPostcodeModal({ show, onClose, onComplete }: AddressPostcodeModalProps) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <DaumPostcodeEmbed
          onComplete={(data) => {
            onComplete(data.roadAddress || data.jibunAddress);
          }}
          style={{ height: 400 }}
        />
      </div>
    </div>
  );
}

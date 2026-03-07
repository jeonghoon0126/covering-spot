"use client";

import Lottie from "lottie-react";
import animationData from "../../../public/animations/loading.json";

interface LottieOverlayProps {
  visible: boolean;
  message?: string;
}

export function LottieOverlay({ visible, message = "잠시만 기다려 주세요!" }: LottieOverlayProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/80 backdrop-blur-sm">
      <div className="w-48 h-48">
        <Lottie animationData={animationData} loop autoplay />
      </div>
      <p className="mt-2 text-sm font-medium text-text-sub">{message}</p>
    </div>
  );
}

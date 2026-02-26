"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function BookingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Booking Error]", error);
  }, [error]);

  return (
    <div className="text-center py-20 px-4">
      <p className="text-text-muted mb-2">페이지를 불러오는 중 오류가 발생했습니다.</p>
      <p className="text-xs text-text-muted mb-8">{error.message}</p>
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <button
          onClick={reset}
          className="w-full py-3 px-4 rounded-xl bg-primary text-white font-semibold text-sm"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="w-full py-3 px-4 rounded-xl border border-border text-text-sub font-semibold text-sm text-center"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}

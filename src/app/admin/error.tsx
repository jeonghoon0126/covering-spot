"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-text-primary mb-2">
          오류가 발생했습니다
        </h2>
        <p className="text-sm text-text-muted mb-4">
          관리자 페이지를 불러오는 중 문제가 발생했습니다.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}

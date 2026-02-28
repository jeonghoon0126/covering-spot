"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="flex items-center justify-center gap-2 mt-6 mb-4">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="px-3 py-2 text-sm rounded-md border border-border-light bg-bg text-text-sub hover:border-primary/40 hover:text-primary transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ← 이전
      </button>

      {/* 페이지 번호 버튼: 현재 페이지 중심 최대 5개 */}
      {pageNumbers.map((item, idx) =>
        item === "..." ? (
          <span key={`ellipsis-${idx}`} className="px-1 text-text-muted text-sm">…</span>
        ) : (
          <button
            key={item}
            onClick={() => onPageChange(item as number)}
            className={`w-9 h-9 text-sm rounded-md transition-all duration-200 ${
              currentPage === item
                ? "bg-primary text-white font-medium shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                : "border border-border-light bg-bg text-text-sub hover:border-primary/40 hover:text-primary"
            }`}
          >
            {item}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="px-3 py-2 text-sm rounded-md border border-border-light bg-bg text-text-sub hover:border-primary/40 hover:text-primary transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        다음 →
      </button>
    </div>
  );
}

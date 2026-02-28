"use client";

interface SearchFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  dateFrom: string;
  dateTo: string;
  onDateChange: (field: "from" | "to", val: string) => void;
  onResetDates: () => void;
}

export function SearchFilters({
  search,
  onSearchChange,
  showFilters,
  onToggleFilters,
  dateFrom,
  dateTo,
  onDateChange,
  onResetDates,
}: SearchFiltersProps) {
  return (
    <div className="space-y-3 mb-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <svg
            width="16" height="16" viewBox="0 0 16 16" fill="none"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="이름, 전화번호, 주소, 주문번호 검색"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-md border border-border bg-bg outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 transition-all duration-200"
          />
        </div>
        <button
          onClick={onToggleFilters}
          className={`shrink-0 px-3 py-2.5 rounded-md border text-sm transition-colors ${
            showFilters || dateFrom || dateTo
              ? "border-primary bg-primary-bg text-primary"
              : "border-border-light bg-bg text-text-sub"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block">
            <path d="M2 4H14M4 8H12M6 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* 기간 필터 */}
      {showFilters && (
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-xs text-text-sub shrink-0">수거일</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateChange("from", e.target.value)}
            className="flex-1 min-w-[120px] px-2.5 py-2 text-sm rounded-md border border-border bg-bg outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 transition-all duration-200"
          />
          <span className="text-text-muted text-xs">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateChange("to", e.target.value)}
            className="flex-1 min-w-[120px] px-2.5 py-2 text-sm rounded-md border border-border bg-bg outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 transition-all duration-200"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={onResetDates}
              className="shrink-0 text-xs text-semantic-red"
            >
              초기화
            </button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useExperiment } from "@/contexts/ExperimentContext";
import { AdminLogo } from "@/components/ui/AdminLogo";
import { safeSessionRemove } from "@/lib/storage";

interface DashboardHeaderProps {
  unreadCount: number;
  onSheetImport: () => void;
  onExportCSV: () => void;
  onRefresh: () => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

export function DashboardHeader({ unreadCount, onSheetImport, onExportCSV, onRefresh, autoRefresh, onToggleAutoRefresh }: DashboardHeaderProps) {
  const router = useRouter();
  const { experimentName, variant } = useExperiment();

  return (
    <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
      <div className="max-w-[56rem] mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AdminLogo />
          <h1 className="text-lg font-bold">커버링 방문수거 관리</h1>
          {experimentName && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-semantic-orange-tint text-semantic-orange">
              {experimentName}: {variant || "미할당"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push("/admin/notifications")}
            className="relative text-sm text-text-sub hover:text-text-primary transition-colors duration-200 px-2 py-2"
            aria-label="알림"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 13.5C6.33 14.09 6.97 14.5 7.7 14.5C8.43 14.5 9.07 14.09 9.4 13.5M12.3 5.5C12.3 3 10.27 1 7.7 1C5.13 1 3.1 3 3.1 5.5C3.1 10 1 11.5 1 11.5H14.4C14.4 11.5 12.3 10 12.3 5.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold text-white bg-semantic-red rounded-full px-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={onSheetImport}
            className="text-sm text-primary hover:text-primary-dark transition-colors duration-200 flex items-center gap-1 px-2 py-2 font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M1 5.5H13M5 5.5V12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span className="max-sm:hidden">시트 임포트</span>
          </button>
          <button
            onClick={() => router.push("/admin/bookings/new")}
            className="text-sm text-primary hover:text-primary-dark transition-colors duration-200 flex items-center gap-1 px-2 py-2 font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="max-sm:hidden">새 예약</span>
          </button>
          <button
            onClick={() => router.push("/admin/calendar")}
            className="text-sm text-text-sub hover:text-text-primary transition-colors duration-200 flex items-center gap-1 px-2 py-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M1 5.5H13M4 1V3.5M10 1V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span className="max-sm:hidden">캘린더</span>
          </button>
          <button
            onClick={() => router.push("/admin/dispatch")}
            className="text-sm text-text-sub hover:text-text-primary transition-colors duration-200 flex items-center gap-1 px-2 py-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 4.5L7 1L12.5 4.5V10L7 13L1.5 10V4.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            <span className="max-sm:hidden">배차</span>
          </button>
          <button
            onClick={() => router.push("/admin/driver")}
            className="text-sm text-text-sub hover:text-text-primary transition-colors duration-200 flex items-center gap-1 px-2 py-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="5" r="3" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M2 13C2 10.2 4.2 8 7 8C9.8 8 12 10.2 12 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span className="max-sm:hidden">기사님</span>
          </button>
          <button
            onClick={onExportCSV}
            className="text-sm text-text-sub hover:text-text-primary transition-colors duration-200 flex items-center gap-1 px-2 py-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V9M7 9L4 6M7 9L10 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 11H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span className="max-sm:hidden">내보내기</span>
          </button>
          <button
            onClick={onRefresh}
            className="text-sm text-text-sub hover:text-text-primary transition-colors duration-200 px-2 py-2"
            title="수동 새로고침"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="sm:hidden">
              <path d="M1.5 7A5.5 5.5 0 0 1 12 4M12.5 7A5.5 5.5 0 0 1 2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M12 1V4H9M2 13V10H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="max-sm:hidden">새로고침</span>
          </button>
          <button
            onClick={onToggleAutoRefresh}
            className={`text-sm transition-colors duration-200 flex items-center gap-1 px-2 py-2 ${autoRefresh ? "text-semantic-green" : "text-text-sub hover:text-text-primary"}`}
            title={autoRefresh ? "자동 새로고침 끄기 (30초)" : "자동 새로고침 켜기 (30초)"}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 7A5.5 5.5 0 0 1 12 4M12.5 7A5.5 5.5 0 0 1 2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M12 1V4H9M2 13V10H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              {autoRefresh && <circle cx="7" cy="7" r="1.5" fill="currentColor"/>}
            </svg>
            <span className="max-sm:hidden">{autoRefresh ? "자동:ON" : "자동:OFF"}</span>
          </button>
          <button
            onClick={() => {
              safeSessionRemove("admin_token");
              router.push("/admin");
            }}
            className="text-sm text-semantic-red px-2 py-2"
          >
            <span className="max-sm:hidden">로그아웃</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="sm:hidden">
              <path d="M5 1.5H3A1.5 1.5 0 0 0 1.5 3v8A1.5 1.5 0 0 0 3 12.5h2M9.5 10l3-3-3-3M5.5 7h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

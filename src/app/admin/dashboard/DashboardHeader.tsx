"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useExperiment } from "@/contexts/ExperimentContext";
import { AdminLogo } from "@/components/ui/AdminLogo";
import { safeLocalGet, safeLocalRemove } from "@/lib/storage";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = safeLocalGet("admin_role") === "admin";

  const closeMenu = () => setMobileMenuOpen(false);

  const handleLogout = () => {
    safeLocalRemove("admin_token");
    router.push("/admin");
  };

  return (
    <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
      <div className="max-w-[56rem] mx-auto px-4 h-14 flex items-center gap-2">

        {/* 모바일 햄버거 */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 text-text-sub hover:text-text-primary transition-colors"
          aria-label="메뉴 열기"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 4.5H16M2 9H16M2 13.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* 브랜딩: 로고 + 제목 */}
        <div className="flex items-center gap-2 shrink-0">
          <AdminLogo />
          <h1 className="text-sm font-bold whitespace-nowrap hidden sm:block">커버링 방문수거 관리</h1>
          {experimentName && (
            <span className="hidden md:inline text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-semantic-orange-tint text-semantic-orange whitespace-nowrap">
              {experimentName}: {variant || "미할당"}
            </span>
          )}
        </div>

        {/* 핵심 Nav — 데스크탑만 */}
        <nav className="hidden lg:flex items-center gap-0.5 border-l border-border-light pl-3 ml-1">
          <button
            onClick={() => router.push("/admin/calendar")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-text-sub hover:text-text-primary hover:bg-fill-tint transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M1 5.5H13M4 1V3.5M10 1V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            캘린더
          </button>
          <button
            onClick={() => router.push("/admin/dispatch")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-text-sub hover:text-text-primary hover:bg-fill-tint transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 4.5L7 1L12.5 4.5V10L7 13L1.5 10V4.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            배차
          </button>
          <button
            onClick={() => router.push("/admin/driver")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-text-sub hover:text-text-primary hover:bg-fill-tint transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="5" r="3" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M2 13C2 10.2 4.2 8 7 8C9.8 8 12 10.2 12 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            기사님
          </button>
          {isAdmin && (
            <button
              onClick={() => router.push("/admin/admins")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-text-sub hover:text-text-primary hover:bg-fill-tint transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M2 12.5C2 10.3 4.2 8.5 7 8.5C9.8 8.5 12 10.3 12 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M9.5 6.5L11 8L13 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              관리자 설정
            </button>
          )}
        </nav>

        {/* 우측 유틸리티 */}
        <div className="ml-auto flex items-center gap-1">

          {/* 시트 임포트 + 내보내기 (desktop, icon only) */}
          <div className="hidden lg:flex items-center">
            <div className="relative group/sheet">
              <button
                onClick={onSheetImport}
                className="p-2 text-text-sub hover:text-text-primary hover:bg-fill-tint rounded-md transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M1 5.5H13M5 5.5V12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </button>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 rounded-md bg-text-primary text-bg text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/sheet:opacity-100 scale-95 group-hover/sheet:scale-100 transition-all duration-150 pointer-events-none z-50">
                시트 임포트
              </span>
            </div>
            <div className="relative group/export">
              <button
                onClick={onExportCSV}
                className="p-2 text-text-sub hover:text-text-primary hover:bg-fill-tint rounded-md transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1V9M7 9L4 6M7 9L10 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 11H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </button>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 rounded-md bg-text-primary text-bg text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/export:opacity-100 scale-95 group-hover/export:scale-100 transition-all duration-150 pointer-events-none z-50">
                내보내기
              </span>
            </div>
          </div>

          {/* Refresh Pill: 새로고침 + 자동새로고침 통합 (desktop) */}
          <div className="hidden lg:flex h-8 items-center border border-border rounded-lg bg-bg-warm overflow-hidden">
            <button
              onClick={onRefresh}
              className="px-2.5 h-full flex items-center hover:bg-fill-tint transition-colors text-text-sub hover:text-text-primary"
              title="수동 새로고침"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M1.5 7A5.5 5.5 0 0 1 12 4M12.5 7A5.5 5.5 0 0 1 2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M12 1V4H9M2 13V10H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="w-px h-4 bg-border-light" />
            <button
              onClick={onToggleAutoRefresh}
              className="flex items-center gap-1.5 px-2.5 h-full hover:bg-fill-tint transition-colors"
              title={autoRefresh ? "자동 새로고침 끄기" : "자동 새로고침 켜기"}
            >
              <span className="text-[11px] text-text-sub font-medium">자동</span>
              <span className={`w-1.5 h-1.5 rounded-full transition-colors ${autoRefresh ? "bg-semantic-green" : "bg-border"}`} />
            </button>
          </div>

          {/* 알림 */}
          <div className="relative group/bell">
            <button
              onClick={() => router.push("/admin/notifications")}
              className="relative p-2 text-text-sub hover:text-text-primary hover:bg-fill-tint rounded-md transition-colors"
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
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 rounded-md bg-text-primary text-bg text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/bell:opacity-100 scale-95 group-hover/bell:scale-100 transition-all duration-150 pointer-events-none z-50">
              알림
            </span>
          </div>

          {/* 새 예약 — Primary, 항상 표시 */}
          <button
            onClick={() => router.push("/admin/bookings/new")}
            className="flex items-center gap-1 px-3 h-8 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark transition-colors shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span className="hidden md:inline">새 예약</span>
          </button>

          {/* 로그아웃 (desktop) */}
          <div className="relative group/logout hidden lg:block">
            <button
              onClick={handleLogout}
              className="flex p-2 text-text-muted hover:text-semantic-red hover:bg-fill-tint rounded-md transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 1.5H3A1.5 1.5 0 0 0 1.5 3v8A1.5 1.5 0 0 0 3 12.5h2M9.5 10l3-3-3-3M5.5 7h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="absolute top-full right-0 mt-1.5 px-2 py-1 rounded-md bg-text-primary text-bg text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/logout:opacity-100 scale-95 group-hover/logout:scale-100 transition-all duration-150 pointer-events-none z-50">
              로그아웃
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border-light bg-bg shadow-md">
          <nav className="px-4 py-2 space-y-0.5">
            <button
              onClick={() => { router.push("/admin/calendar"); closeMenu(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-text-primary hover:bg-fill-tint transition-colors text-left"
            >
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M1 5.5H13M4 1V3.5M10 1V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              캘린더
            </button>
            <button
              onClick={() => { router.push("/admin/dispatch"); closeMenu(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-text-primary hover:bg-fill-tint transition-colors text-left"
            >
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                <path d="M1.5 4.5L7 1L12.5 4.5V10L7 13L1.5 10V4.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              배차
            </button>
            <button
              onClick={() => { router.push("/admin/driver"); closeMenu(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-text-primary hover:bg-fill-tint transition-colors text-left"
            >
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="5" r="3" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M2 13C2 10.2 4.2 8 7 8C9.8 8 12 10.2 12 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              기사님
            </button>
            {isAdmin && (
              <button
                onClick={() => { router.push("/admin/admins"); closeMenu(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-text-primary hover:bg-fill-tint transition-colors text-left"
              >
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M2 12.5C2 10.3 4.2 8.5 7 8.5C9.8 8.5 12 10.3 12 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M9.5 6.5L11 8L13 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                관리자 설정
              </button>
            )}
          </nav>
          <div className="px-4 py-2 border-t border-border-light flex items-center gap-1">
            <button
              onClick={() => { onSheetImport(); closeMenu(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-text-sub hover:bg-fill-tint transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M1 5.5H13M5 5.5V12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              시트 임포트
            </button>
            <button
              onClick={() => { onExportCSV(); closeMenu(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-text-sub hover:bg-fill-tint transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1V9M7 9L4 6M7 9L10 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 11H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              내보내기
            </button>
            <button
              onClick={() => { onRefresh(); closeMenu(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-text-sub hover:bg-fill-tint transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1.5 7A5.5 5.5 0 0 1 12 4M12.5 7A5.5 5.5 0 0 1 2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M12 1V4H9M2 13V10H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              새로고침
            </button>
          </div>
          <div className="px-4 py-2 border-t border-border-light">
            <button
              onClick={() => { handleLogout(); closeMenu(); }}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-semantic-red hover:bg-semantic-red-tint transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 1.5H3A1.5 1.5 0 0 0 1.5 3v8A1.5 1.5 0 0 0 3 12.5h2M9.5 10l3-3-3-3M5.5 7h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

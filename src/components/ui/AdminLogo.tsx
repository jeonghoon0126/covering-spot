"use client";

import { useRouter, usePathname } from "next/navigation";

/**
 * 백오피스 좌상단 커버링 심볼 — 클릭 시 대시보드로 이동
 * 대시보드 자체에서는 링크 비활성(현재 페이지)
 */
export function AdminLogo() {
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = pathname === "/admin/dashboard";

  const symbol = (
    <span
      className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-white text-sm font-extrabold select-none shrink-0"
      aria-label="커버링"
    >
      C
    </span>
  );

  if (isDashboard) return symbol;

  return (
    <button
      onClick={() => router.push("/admin/dashboard")}
      className="hover:opacity-80 transition-opacity"
      aria-label="대시보드로 이동"
    >
      {symbol}
    </button>
  );
}

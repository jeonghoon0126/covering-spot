"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminLogo } from "@/components/ui/AdminLogo";

export function DriverHeader() {
  const pathname = usePathname();
  const isDriverList = pathname === "/admin/driver";

  return (
    <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
      <div className="max-w-[56rem] mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AdminLogo />
          <h1 className="text-lg font-bold">기사 관리</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border-light overflow-hidden">
            <Link
              href="/admin/driver"
              className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
                isDriverList ? "bg-primary text-white" : "bg-bg text-text-sub hover:bg-bg-warm"
              }`}
            >
              기사 목록
            </Link>
            <Link
              href="/admin/driver/dispatch"
              className={`px-4 py-1.5 text-xs font-semibold transition-colors border-l border-border-light ${
                !isDriverList ? "bg-primary text-white" : "bg-bg text-text-sub hover:bg-bg-warm"
              }`}
            >
              배차 현황
            </Link>
          </div>
          <Link
            href="/admin/vehicles"
            className="text-xs font-medium text-text-sub bg-bg border border-border-light rounded-md px-3 py-1.5 hover:bg-bg-warm transition-colors"
          >
            차량
          </Link>
          <Link
            href="/admin/calendar"
            className="text-xs font-medium text-text-sub bg-bg border border-border-light rounded-md px-3 py-1.5 hover:bg-bg-warm transition-colors"
          >
            캘린더
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { useScrollPosition } from "@/hooks/useScrollPosition";

export function Nav() {
  const scrollY = useScrollPosition();
  const scrolled = scrollY > 10;

  return (
    <nav
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[1000] w-[calc(100%-40px)] max-w-[1160px] h-14 flex items-center rounded-2xl transition-all duration-300 max-sm:top-2 max-sm:w-[calc(100%-16px)] ${
        scrolled
          ? "bg-white/80 backdrop-blur-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-white/60"
          : "bg-white/60 backdrop-blur-[12px] border border-white/40"
      }`}
    >
      <div className="px-6 max-sm:px-4 flex justify-between items-center w-full">
        <a
          href="#"
          className="flex items-center gap-2 font-bold text-[16px] text-text-primary no-underline"
        >
          <Image
            src="/images/logo.png"
            alt="커버링"
            width={28}
            height={28}
            className="w-7 h-7"
          />
          <span className="max-sm:hidden">커버링 방문 수거</span>
        </a>

        <div className="flex items-center gap-0.5">
          <a
            href="#pricing"
            className="text-text-sub no-underline text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all hover:text-text-primary hover:bg-black/[0.04] max-md:hidden"
          >
            서비스
          </a>
          <a
            href="#item-price"
            className="text-text-sub no-underline text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all hover:text-text-primary hover:bg-black/[0.04] max-md:hidden"
          >
            가격
          </a>
          <a
            href="#faq"
            className="text-text-sub no-underline text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all hover:text-text-primary hover:bg-black/[0.04] max-md:hidden"
          >
            FAQ
          </a>
          <Link
            href="/booking/manage"
            className="ml-1 inline-flex items-center gap-1.5 bg-bg-warm text-text-primary text-[13px] font-semibold px-4 py-2 rounded-xl no-underline transition-all hover:bg-bg-warm2 active:scale-[0.97] border border-border-light"
          >
            신청 조회
          </Link>
          <a
            href="https://abr.ge/u7gjoq"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1.5 inline-flex items-center gap-1.5 bg-text-primary text-white text-[13px] font-semibold px-4 py-2 rounded-xl no-underline transition-all hover:bg-brand-800 hover:shadow-md active:scale-[0.97]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="max-sm:hidden">앱 다운로드</span>
          </a>
        </div>
      </div>
    </nav>
  );
}

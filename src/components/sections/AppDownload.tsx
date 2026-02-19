"use client";

import Image from "next/image";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useEffect, useState } from "react";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone)
  );
}

export function AppDownload() {
  const { canInstall, install } = usePWAInstall();
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setIos(isIOS());
    setInstalled(isStandalone());
  }, []);

  // 이미 설치된 경우 숨김
  if (installed) return null;

  return (
    <section className="py-16 bg-[#F0F7FF] max-md:py-12">
      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5">
        <div className="flex items-center gap-8 max-md:flex-col max-md:text-center">
          {/* 앱 아이콘 */}
          <div className="shrink-0">
            <Image
              src="/images/logo.png"
              alt="커버링"
              width={80}
              height={80}
              className="w-20 h-20 rounded-lg shadow-lg"
            />
          </div>

          {/* 텍스트 */}
          <div className="flex-1 min-w-0">
            <h3 className="text-[22px] font-bold text-text-primary tracking-[-0.5px] max-md:text-[20px]">
              커버링 방문수거 앱
            </h3>
            <p className="text-[15px] text-text-sub mt-1.5 leading-relaxed">
              홈 화면에 추가하면 더 빠르게 수거 신청하고, 진행 상황 알림도 받을 수 있어요
            </p>
          </div>

          {/* 버튼 */}
          <div className="shrink-0 max-md:w-full">
            {canInstall ? (
              <button
                onClick={install}
                className="inline-flex items-center justify-center gap-2 bg-primary text-white text-[15px] font-bold px-8 py-3.5 rounded-md shadow-lg shadow-primary/20 hover:bg-primary-light hover:-translate-y-0.5 active:scale-[0.98] transition-all max-md:w-full"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                앱 설치하기
              </button>
            ) : ios ? (
              <div className="bg-white rounded-md p-4 border border-border-light max-md:w-full">
                <p className="text-[14px] text-text-primary font-semibold mb-2">Safari에서 홈 화면에 추가</p>
                <div className="flex items-center gap-3 text-[13px] text-text-sub">
                  <span className="inline-flex items-center gap-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    공유
                  </span>
                  <span>→</span>
                  <span className="inline-flex items-center gap-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    홈 화면에 추가
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-md p-4 border border-border-light max-md:w-full">
                <p className="text-[14px] text-text-primary font-semibold mb-1">Chrome 브라우저에서 설치 가능</p>
                <p className="text-[13px] text-text-sub">Chrome으로 접속하면 앱 설치 버튼이 나타납니다</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

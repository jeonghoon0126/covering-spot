"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CTALink } from "@/components/ui/CTALink";
import { KakaoIcon } from "@/components/ui/KakaoIcon";

export function FloatingCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handle = () => {
      const hero = document.getElementById("hero");
      const cta = document.getElementById("cta");
      if (!hero || !cta) return;

      const heroGone = hero.getBoundingClientRect().bottom < 0;
      const ctaVisible = cta.getBoundingClientRect().top < window.innerHeight;
      setShow(heroGone && !ctaVisible);
    };

    window.addEventListener("scroll", handle, { passive: true });
    handle();
    return () => window.removeEventListener("scroll", handle);
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[900] hidden max-md:block transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        show
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0"
      }`}
    >
      <div className="p-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] bg-white/90 backdrop-blur-xl border-t border-border/50 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="flex gap-2">
          <CTALink
            location="floating"
            className="flex-1 flex items-center justify-center gap-2 bg-kakao text-text-primary text-[15px] font-bold py-3.5 rounded-xl hover:bg-kakao-hover active:scale-[0.98] transition-all"
          >
            <KakaoIcon />
            <span>무료 견적 받기</span>
          </CTALink>
          <Link
            href="/booking"
            className="flex-1 flex items-center justify-center bg-primary text-white text-[15px] font-semibold py-3.5 rounded-xl shadow-sm shadow-primary/20 hover:bg-primary-light active:scale-[0.98] transition-all"
          >
            온라인 예약하기
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CTALink } from "@/components/ui/CTALink";
import { KakaoIcon } from "@/components/ui/KakaoIcon";

export function FloatingCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handle = () => {
      const hero = document.getElementById("hero") || document.querySelector(".hero-section");
      const cta = document.getElementById("cta");
      if (!hero || !cta) return;

      const heroGone = hero.getBoundingClientRect().bottom < 0;
      const ctaVisible = cta.getBoundingClientRect().top < window.innerHeight;
      setShow(heroGone && !ctaVisible);
    };

    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[900] p-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] bg-white/92 backdrop-blur-[20px] border-t border-border transition-transform duration-300 hidden max-md:block ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <a
        href="/booking/manage"
        className="block text-center text-xs text-text-sub font-medium mb-2 hover:text-primary transition-colors"
      >
        신청 조회하기
      </a>
      <CTALink
        location="floating"
        className="flex items-center justify-center gap-2 w-full bg-kakao text-text-primary text-base font-bold py-4 rounded-[14px] hover:bg-kakao-hover active:scale-[0.98] transition-all"
      >
        <KakaoIcon />
        <span>무료 견적 받기</span>
      </CTALink>
    </div>
  );
}

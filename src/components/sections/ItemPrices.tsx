"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { PriceCategory } from "@/types";
import { CTALink } from "@/components/ui/CTALink";
import { KakaoIcon } from "@/components/ui/KakaoIcon";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { track } from "@/lib/analytics";

/* ── SVG 아이콘 (Toss-level minimal line icons) ── */
const icons: Record<string, React.ReactNode> = {
  sofa: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11V8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v3" />
      <path d="M3 14a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-1Z" />
      <path d="M5 16v2m14-2v2" />
      <path d="M7 12V9" /><path d="M17 12V9" />
    </svg>
  ),
  bed: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v10" /><path d="M21 7v10" />
      <path d="M3 17h18" />
      <path d="M3 11h18" />
      <rect x="5" y="7" width="5" height="4" rx="1.5" />
      <path d="M12 11V8a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3" />
    </svg>
  ),
  wardrobe: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="17" rx="2" />
      <path d="M12 3v17" />
      <path d="M4 20h16" />
      <circle cx="10" cy="11" r="0.75" fill="currentColor" />
      <circle cx="14" cy="11" r="0.75" fill="currentColor" />
    </svg>
  ),
  table: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="3" rx="1.5" />
      <path d="M5 10v9" /><path d="M19 10v9" />
    </svg>
  ),
  desk: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="2.5" rx="1" />
      <path d="M5 9.5v9" /><path d="M19 9.5v9" />
      <rect x="13" y="9.5" width="6" height="6" rx="1" />
      <path d="M13 12.5h6" />
    </svg>
  ),
  fridge: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2.5" />
      <path d="M5 10h14" />
      <path d="M9 6v2" /><path d="M9 13v4" />
    </svg>
  ),
  washer: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2.5" />
      <circle cx="12" cy="13" r="5" />
      <circle cx="12" cy="13" r="2" />
      <circle cx="8" cy="5.5" r="0.75" fill="currentColor" />
      <circle cx="11" cy="5.5" r="0.75" fill="currentColor" />
    </svg>
  ),
  aircon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="9" rx="2.5" />
      <path d="M7 8.5h10" />
      <path d="M8 13v3c0 1.5 1.5 2.5 3 1" />
      <path d="M12 13v4" />
      <path d="M16 13v3c0 1.5-1.5 2.5-3 1" />
    </svg>
  ),
  tv: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M9 20h6" /><path d="M12 17v3" />
    </svg>
  ),
  kitchen: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3v6a3 3 0 0 0 3 3v0a3 3 0 0 0 3-3V3" />
      <path d="M9 12v9" />
      <path d="M18 3v0a4 4 0 0 0-4 4v5a2 2 0 0 0 2 2h2V3Zm0 0v18" />
    </svg>
  ),
  storage: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="6" rx="1.5" />
      <rect x="4" y="11" width="16" height="6" rx="1.5" />
      <path d="M10 6h4" /><path d="M10 14h4" />
      <path d="M6 19h12" />
    </svg>
  ),
  fitness: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 7v10" /><path d="M18 7v10" />
      <path d="M6 12h12" />
      <rect x="2" y="9" width="4" height="6" rx="1" />
      <rect x="18" y="9" width="4" height="6" rx="1" />
    </svg>
  ),
  music: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),
  appliance: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5Z" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 8v4l2.5 1.5" />
    </svg>
  ),
  etc: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  ),
};

interface Props {
  categories: PriceCategory[];
}

export function ItemPrices({ categories }: Props) {
  const [activeId, setActiveId] = useState(categories[0].id);
  const cardRef = useRef<HTMLDivElement>(null);
  const [barsAnimated, setBarsAnimated] = useState(false);

  const active = categories.find((c) => c.id === activeId) ?? categories[0];

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setBarsAnimated(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setBarsAnimated(false);
    const timer = setTimeout(() => setBarsAnimated(true), 50);
    return () => clearTimeout(timer);
  }, [activeId]);

  return (
    <section className="py-[120px] bg-bg-warm max-md:py-20" id="item-price">
      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5">
        <ScrollReveal>
          <SectionHeader
            tag="투명한 가격"
            title="품목별 예상 가격"
            desc="정확한 견적은 카톡으로 품목 알려주시면 바로 안내드려요"
            center
          />
        </ScrollReveal>

        {/* Tab selector - scrollable on mobile */}
        <ScrollReveal>
          <div className="flex gap-2 mb-12 flex-wrap justify-center max-md:justify-start max-md:overflow-x-auto max-md:flex-nowrap max-md:-mx-5 max-md:px-5 max-md:pb-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveId(cat.id);
                  track("price_tab_select", { item: cat.id });
                }}
                className={`flex items-center gap-2 py-3 px-5 rounded-full font-semibold text-sm border cursor-pointer transition-all duration-300 ease-out whitespace-nowrap shrink-0 ${
                  cat.id === activeId
                    ? "bg-primary text-white border-primary shadow-[0_4px_16px_rgba(26,163,255,0.3)]"
                    : "bg-bg text-text-primary border-border hover:border-primary/40 hover:shadow-sm"
                }`}
              >
                <span className={cat.id === activeId ? "text-white" : "text-primary"}>
                  {icons[cat.icon] || icons.etc}
                </span>
                {cat.title}
              </button>
            ))}
          </div>
        </ScrollReveal>

        {/* Price card */}
        <ScrollReveal>
          <div
            ref={cardRef}
            className="max-w-[640px] mx-auto bg-bg rounded-3xl p-10 border border-border/80 shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)] max-md:p-7"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-primary-tint flex items-center justify-center shrink-0 text-primary max-md:w-12 max-md:h-12">
                {icons[active.icon] || icons.etc}
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-1 max-md:text-xl">
                  {active.title}
                </h3>
                <p className="text-[15px] text-text-sub">{active.subtitle}</p>
              </div>
            </div>

            <div>
              {active.rows.map((row, i) => (
                <div key={i} className={i < active.rows.length - 1 ? "mb-5" : ""}>
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[15px] font-medium text-text-sub">
                      {row.label}
                    </span>
                    <span className="text-base font-bold text-text-primary tracking-[-0.3px]">
                      {row.value}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-bg-warm2 rounded-[5px] overflow-hidden">
                    <div
                      className="price-bar-fill h-full rounded-[5px] bg-gradient-to-r from-primary to-primary-light"
                      style={
                        { "--target-width": `${row.barPercent}%` } as React.CSSProperties
                      }
                      ref={(el) => {
                        if (el && barsAnimated) {
                          el.classList.add("animated");
                        } else if (el) {
                          el.classList.remove("animated");
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-3">
              <CTALink
                location="price"
                className="flex items-center justify-center gap-2 w-full bg-kakao text-text-primary text-base font-bold py-4 rounded-2xl hover:bg-kakao-hover hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(250,225,0,0.2)] active:scale-[0.98] transition-all duration-300 ease-out"
              >
                <KakaoIcon size={18} />
                <span>카톡으로 5분만에 견적받기</span>
              </CTALink>
              <Link
                href="/booking"
                className="flex items-center justify-center gap-1.5 w-full text-[15px] font-bold text-white bg-primary py-4 rounded-2xl shadow-sm shadow-primary/20 hover:bg-primary-light hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(26,163,255,0.25)] active:scale-[0.98] transition-all duration-300"
              >
                온라인 수거 신청하기
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

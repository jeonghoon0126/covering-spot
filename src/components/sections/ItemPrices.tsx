"use client";

import { useState, useRef, useEffect } from "react";
import type { PriceCategory } from "@/types";
import { CTALink } from "@/components/ui/CTALink";
import { KakaoIcon } from "@/components/ui/KakaoIcon";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { track } from "@/lib/analytics";

interface Props {
  categories: PriceCategory[];
}

export function ItemPrices({ categories }: Props) {
  const [activeId, setActiveId] = useState(categories[0].id);
  const cardRef = useRef<HTMLDivElement>(null);
  const [barsAnimated, setBarsAnimated] = useState(false);

  const active = categories.find((c) => c.id === activeId) ?? categories[0];

  // Observe price card for bar animation
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

  // Re-trigger bar animation on tab change
  useEffect(() => {
    setBarsAnimated(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setBarsAnimated(true);
      });
    });
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

        <ScrollReveal>
          <p className="text-center text-base font-medium text-text-sub mb-5">
            버리실 품목을 선택하세요
          </p>
        </ScrollReveal>

        {/* Tab selector */}
        <ScrollReveal>
          <div className="flex justify-center gap-3 mb-12 flex-wrap max-md:gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveId(cat.id);
                  track("price_tab_select", { item: cat.id });
                }}
                className={`flex flex-col items-center gap-2 py-4 px-6 rounded-[16px] font-semibold text-sm border cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] max-md:py-3 max-md:px-4 ${
                  cat.id === activeId
                    ? "bg-primary text-white border-primary shadow-[0_4px_16px_rgba(37,99,235,0.3)] -translate-y-0.5"
                    : "bg-bg text-text-primary border-border hover:border-primary-light hover:shadow-sm"
                }`}
              >
                <span className="text-[28px] leading-none max-md:text-2xl">
                  {cat.icon}
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
            className="max-w-[640px] mx-auto bg-bg rounded-3xl p-10 border border-border shadow-md max-md:p-7"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-[18px] bg-primary-bg flex items-center justify-center shrink-0 max-md:w-[52px] max-md:h-[52px]">
                <span className="text-[32px] leading-none">{active.icon}</span>
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
                      data-animated={barsAnimated}
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

            <div className="mt-8">
              <CTALink
                location="price"
                className="flex items-center justify-center gap-2 w-full bg-kakao text-text-primary text-base font-bold py-4 rounded-[16px] hover:bg-kakao-hover active:scale-[0.98] transition-all"
              >
                <KakaoIcon size={18} />
                <span>카톡으로 견적받기</span>
              </CTALink>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

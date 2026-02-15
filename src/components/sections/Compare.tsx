"use client";

import { useRef, useEffect, useState } from "react";
import { compareCards, compareReasons } from "@/data/compare-data";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

/* ── helpers ── */

function extractPrice(text: string): number {
  const match = text.match(/([\d,]+)원/);
  return match ? parseInt(match[1].replace(/,/g, ""), 10) : 0;
}

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

/* ── bar color palettes ── */

const GOOD_COLORS = ["#1AA3FF", "#4DB5FF", "#80CAFF", "#B2DFFF"];
const BAD_BASE = "#8A96A8";
const BAD_EXTRA = "#FF3358";

/* ── sub-components ── */

function BarChart({
  card,
  maxTotal,
  animated,
  variant,
}: {
  card: (typeof compareCards)[0];
  maxTotal: number;
  animated: boolean;
  variant: "good" | "bad";
}) {
  const totalNum = card.lines.reduce((s, l) => s + extractPrice(l.text), 0);
  const isGood = variant === "good";

  return (
    <div className="flex-1 min-w-0">
      {/* badge + method */}
      <div className="mb-5">
        <span
          className={`inline-flex items-center h-7 px-3 rounded-full text-[13px] font-semibold ${
            isGood
              ? "bg-primary-tint text-primary"
              : "bg-semantic-red-tint text-semantic-red"
          }`}
        >
          {card.badge}
        </span>
        <p className="text-[13px] text-text-muted mt-1.5">{card.method}</p>
      </div>

      {/* stacked horizontal bar */}
      <div className="relative h-14 rounded-lg overflow-hidden bg-border-light max-sm:h-12">
        <div
          className="absolute inset-y-0 left-0 flex transition-all ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            width: animated ? `${(totalNum / maxTotal) * 100}%` : "0%",
            transitionDuration: "1s",
          }}
        >
          {card.lines.map((line, i) => {
            const price = extractPrice(line.text);
            const pct = (price / totalNum) * 100;
            const color = isGood
              ? GOOD_COLORS[i % GOOD_COLORS.length]
              : line.isExtra
                ? BAD_EXTRA
                : BAD_BASE;

            return (
              <div
                key={i}
                className="h-full flex items-center justify-center overflow-hidden"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                  transitionDelay: `${i * 0.08}s`,
                }}
              >
                {pct > 14 && (
                  <span className="text-[11px] font-semibold text-white whitespace-nowrap max-sm:text-[10px]">
                    {formatPrice(price)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* legend items */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {card.lines.map((line, i) => {
          const color = isGood
            ? GOOD_COLORS[i % GOOD_COLORS.length]
            : line.isExtra
              ? BAD_EXTRA
              : BAD_BASE;
          const label = line.text.split(":")[0].replace("+", "").trim();

          return (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: color }}
              />
              <span
                className={`text-[12px] ${
                  line.isExtra
                    ? "text-semantic-red font-medium"
                    : "text-text-muted"
                }`}
              >
                {label}
                {line.isExtra && (
                  <span className="text-[11px] text-text-muted ml-1">
                    추가
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* total */}
      <div className="mt-5 flex items-baseline gap-3">
        <span className="text-[22px] font-bold tracking-[-0.3px] text-text-primary max-sm:text-lg">
          {card.total}
        </span>
        {isGood ? (
          <span className="text-[13px] font-medium text-text-muted">
            추가 비용 없음
          </span>
        ) : (
          <span className="text-[13px] font-medium text-semantic-red">
            {card.tag}
          </span>
        )}
      </div>
    </div>
  );
}

function ReasonCard({
  reason,
  index,
}: {
  reason: (typeof compareReasons)[0];
  index: number;
}) {
  return (
    <ScrollReveal delay={index * 0.1}>
      <div className="group bg-bg rounded-2xl border border-border-light p-6 shadow-sm transition-all duration-300 hover:shadow-hover hover:border-border hover:-translate-y-0.5 max-sm:p-5">
        <div className="flex gap-4 items-start">
          {/* warning icon */}
          <div className="shrink-0 w-10 h-10 rounded-xl bg-semantic-orange-tint flex items-center justify-center max-sm:w-9 max-sm:h-9">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="max-sm:w-[18px] max-sm:h-[18px]"
            >
              <path
                d="M10 6v5m0 2.5h.01M8.57 2.72 1.52 14.5c-.67 1.12.17 2.5 1.43 2.5h14.1c1.26 0 2.1-1.38 1.43-2.5L11.43 2.72c-.67-1.12-2.19-1.12-2.86 0Z"
                stroke="#FF9C1A"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="min-w-0">
            <p className="text-[15px] font-bold text-text-primary mb-1 leading-snug">
              {reason.heading}
            </p>
            <p className="text-[14px] text-text-muted leading-relaxed">
              {reason.desc}
            </p>
          </div>
        </div>
      </div>
    </ScrollReveal>
  );
}

/* ── main ── */

export function Compare() {
  const good = compareCards[0];
  const bad = compareCards[1];

  const goodTotal = good.lines.reduce((s, l) => s + extractPrice(l.text), 0);
  const badTotal = bad.lines.reduce((s, l) => s + extractPrice(l.text), 0);
  const maxTotal = Math.max(goodTotal, badTotal);
  const saving = badTotal - goodTotal;

  /* IntersectionObserver for bar animation */
  const barRef = useRef<HTMLDivElement>(null);
  const [barAnimated, setBarAnimated] = useState(false);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setBarAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setBarAnimated(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-[120px] bg-bg-warm max-md:py-20" id="compare">
      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5">
        <ScrollReveal>
          <SectionHeader
            tag="가격 비교"
            title="같은 품목, 이렇게 다릅니다"
            desc="침대 (싱글 매트리스 + 프레임), 책상, 의류 박스 2개 기준"
            center
          />
        </ScrollReveal>

        {/* ── Bar Chart Comparison ── */}
        <ScrollReveal>
          <div
            ref={barRef}
            className="max-w-[800px] mx-auto bg-bg rounded-2xl border border-border-light p-8 shadow-sm max-sm:p-5"
          >
            <div className="flex gap-10 max-md:flex-col max-md:gap-10">
              <BarChart
                card={good}
                maxTotal={maxTotal}
                animated={barAnimated}
                variant="good"
              />
              <div className="w-px bg-border-light self-stretch max-md:w-full max-md:h-px" />
              <BarChart
                card={bad}
                maxTotal={maxTotal}
                animated={barAnimated}
                variant="bad"
              />
            </div>

            {/* saving highlight */}
            <div
              className={`mt-8 pt-6 border-t border-border-light text-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                barAnimated
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-3"
              }`}
              style={{ transitionDelay: "0.8s" }}
            >
              <p className="text-[15px] text-text-sub">
                같은 품목인데
                <span className="text-[20px] font-bold text-primary mx-1.5">
                  {formatPrice(saving)}
                </span>
                차이납니다
              </p>
            </div>
          </div>
        </ScrollReveal>

        {/* ── Reasons ── */}
        <div className="max-w-[800px] mx-auto mt-20">
          <ScrollReveal>
            <p className="text-xl font-bold text-text-primary mb-2 max-sm:text-lg">
              왜 이런 차이가 날까요?
            </p>
            <p className="text-[15px] text-text-muted mb-8 leading-relaxed">
              대부분의 업체는 이런 패턴을 따릅니다.
            </p>
          </ScrollReveal>

          <div className="flex flex-col gap-4">
            {compareReasons.map((reason, i) => (
              <ReasonCard key={i} reason={reason} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CTALink } from "@/components/ui/CTALink";
import { KakaoIcon } from "@/components/ui/KakaoIcon";
import { useScrollReveal } from "@/hooks/useScrollReveal";

/* ── 타이핑 인디케이터 ── */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-1.5">
      <div className="px-4 py-3 bg-bg-warm2 rounded-[16px_16px_16px_4px] shadow-sm">
        <div className="flex gap-1 items-center h-[21px]">
          <span className="w-[6px] h-[6px] rounded-full bg-text-muted/60 animate-[typing_1.4s_ease-in-out_infinite]" />
          <span className="w-[6px] h-[6px] rounded-full bg-text-muted/60 animate-[typing_1.4s_ease-in-out_0.2s_infinite]" />
          <span className="w-[6px] h-[6px] rounded-full bg-text-muted/60 animate-[typing_1.4s_ease-in-out_0.4s_infinite]" />
        </div>
      </div>
    </div>
  );
}

/* ── 메시지 래퍼 (등장 애니메이션) ── */
function ChatMessage({
  children,
  visible,
  align = "left",
  delay = 0,
}: {
  children: React.ReactNode;
  visible: boolean;
  align?: "left" | "right";
  delay?: number;
}) {
  return (
    <div
      className={`transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-3"
      } ${align === "right" ? "flex justify-end items-end gap-1.5" : "flex items-end gap-1.5"}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function Hero() {
  const { ref: leftRef, visible: leftVisible } = useScrollReveal(0);
  const { ref: rightRef, visible: rightVisible } = useScrollReveal(0);

  /* ── 채팅 애니메이션 시퀀스 ── */
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!rightVisible) return;
    // step 0: 카드 보임
    // step 1: 첫 유저 메시지 (0.4s)
    // step 2: 타이핑 인디케이터 (1.0s)
    // step 3: 봇 견적 응답 (2.0s)
    // step 4: 유저 감탄 메시지 (3.2s)
    const timers = [
      setTimeout(() => setStep(1), 400),
      setTimeout(() => setStep(2), 1000),
      setTimeout(() => setStep(3), 2000),
      setTimeout(() => setStep(4), 3200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [rightVisible]);

  return (
    <section className="relative pt-[160px] pb-32 overflow-hidden max-md:pt-[128px] max-md:pb-24">
      {/* Gradient Background - CDS brand tint */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#F8FAFB] to-[#E5F4FF] -z-10" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#1AA3FF]/[0.04] rounded-full blur-[120px] -z-10 translate-x-1/3 -translate-y-1/4" />

      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5">
        <div className="grid grid-cols-[1fr_400px] items-center gap-16 max-lg:grid-cols-[1fr_360px] max-lg:gap-10 max-md:grid-cols-1 max-md:text-center">
          {/* Left: Text */}
          <div
            ref={leftRef}
            className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              leftVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-6"
            }`}
          >
            <div className="inline-flex items-center gap-2 bg-white border border-border-light rounded-full px-4 py-2 text-sm font-semibold text-text-sub mb-8 shadow-sm">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-semantic-green opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-semantic-green" />
              </span>
              서울 · 경기 · 인천 전 지역 | 주 7일 운영
            </div>
            <h1 className="text-[56px] font-extrabold leading-[1.15] tracking-[-2.5px] mb-6 max-lg:text-[48px] max-lg:tracking-[-2px] max-md:text-[40px] max-md:tracking-[-1.5px] max-sm:text-[32px] max-sm:tracking-[-1px]">
              대형/대량 폐기물,
              <br />
              <span className="text-primary">이제 쉽고 간편하게</span>
            </h1>
            <p className="text-[18px] text-text-sub leading-[1.75] mb-10 max-w-[440px] max-md:max-w-none max-md:text-[16px]">
              소량부터 대량까지, 카톡 한 번이면 끝
              <br />
              사전 견적 = 최종 금액, 추가 비용 없는 투명한 가격
            </p>
            <div className="flex gap-3 max-md:justify-center max-md:flex-col max-md:items-center">
              <CTALink
                location="hero"
                className="group inline-flex items-center gap-2.5 bg-kakao text-text-primary text-base font-bold py-[16px] px-8 rounded-[14px] shadow-sm hover:shadow-md hover:bg-kakao-hover hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 transition-all duration-200 max-md:w-full max-md:max-w-[320px] max-md:justify-center"
              >
                <KakaoIcon />
                <span>카카오톡으로 5분만에 견적 받기</span>
              </CTALink>
              <Link
                href="/booking"
                className="group inline-flex items-center bg-primary text-white text-base font-semibold py-[16px] px-8 rounded-[14px] shadow-sm shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 hover:bg-primary-light hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 transition-all duration-200 max-md:w-full max-md:max-w-[320px] max-md:justify-center"
              >
                5분만에 수거신청하기
              </Link>
            </div>
            <Link
              href="/booking/manage"
              className="inline-flex items-center gap-1.5 text-sm text-text-muted font-medium mt-5 hover:text-primary transition-colors max-md:justify-center"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              기존 신청 조회하기
            </Link>
          </div>

          {/* Right: Chat Mockup with Live Animation */}
          <div
            ref={rightRef}
            className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              rightVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: "0.15s" }}
          >
            <div className="w-full max-w-[400px] bg-white rounded-[20px] shadow-lg overflow-hidden max-md:max-w-[340px] max-md:mx-auto border border-white/80 ring-1 ring-black/[0.04]">
              {/* Chat Header */}
              <div className="bg-gradient-to-r from-bg-warm to-white px-6 py-5 flex items-center gap-3.5 border-b border-border-light">
                <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-primary to-primary-light grid place-items-center text-white text-sm font-extrabold shadow-sm shadow-primary/20">
                  C
                </div>
                <div>
                  <div className="text-[15px] font-bold text-text-primary">
                    커버링 스팟
                  </div>
                  <div className="text-[11px] text-semantic-green font-medium mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-semantic-green" />
                    보통 3분 내 응답
                  </div>
                </div>
              </div>

              {/* Chat Messages - Animated Sequence */}
              <div className="p-5 flex flex-col gap-3 bg-gradient-to-b from-white to-bg-warm/40 min-h-[280px]">
                {/* 1. User: 수거 문의 */}
                <ChatMessage visible={step >= 1} align="right">
                  <span className="text-[11px] text-text-muted shrink-0">
                    오후 2:03
                  </span>
                  <div className="max-w-[240px] px-4 py-3 text-[13px] leading-[1.6] break-keep bg-kakao rounded-[16px_16px_4px_16px] shadow-sm">
                    침대, 책상, 의류박스 2개
                    <br />
                    수거 가능한가요?
                  </div>
                </ChatMessage>

                {/* 2. Typing indicator */}
                {step === 2 && <TypingIndicator />}

                {/* 3. Bot: 견적 응답 */}
                <ChatMessage visible={step >= 3} align="left">
                  <div className="max-w-[240px] px-4 py-3 text-[13px] leading-[1.6] break-keep bg-bg-warm2 rounded-[16px_16px_16px_4px] shadow-sm">
                    네! 바로 견적 드릴게요 😊
                    <br />
                    <br />
                    <div className="space-y-0.5">
                      <div className="flex justify-between gap-4">
                        <span className="text-text-sub">침대 세트</span>
                        <span className="font-medium tabular-nums">
                          50,000원
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-text-sub">책상</span>
                        <span className="font-medium tabular-nums">
                          37,000원
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-text-sub">박스 2개</span>
                        <span className="font-medium tabular-nums">
                          10,000원
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-text-sub">출장비</span>
                        <span className="font-medium tabular-nums">
                          47,000원
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/50 flex justify-between gap-4">
                      <span className="font-bold">합계</span>
                      <span className="font-bold text-primary tabular-nums">
                        144,000원
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-text-muted shrink-0">
                    오후 2:05
                  </span>
                </ChatMessage>

                {/* 4. User: 감탄 */}
                <ChatMessage visible={step >= 4} align="right" delay={0}>
                  <span className="text-[11px] text-text-muted shrink-0">
                    오후 2:06
                  </span>
                  <div className="max-w-[240px] px-4 py-3 text-[13px] leading-[1.6] break-keep bg-kakao rounded-[16px_16px_4px_16px] shadow-sm">
                    오 깔끔하다! 토요일 가능해요?
                  </div>
                </ChatMessage>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wave Divider */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0] -z-0">
        <svg
          viewBox="0 0 1440 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative block w-full h-[56px] max-md:h-[40px]"
          preserveAspectRatio="none"
        >
          <path
            d="M0 56V28C240 4 480 4 720 28C960 52 1200 52 1440 28V56H0Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}

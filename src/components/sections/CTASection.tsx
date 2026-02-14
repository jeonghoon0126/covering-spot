import { CTALink } from "@/components/ui/CTALink";
import { KakaoIcon } from "@/components/ui/KakaoIcon";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

export function CTASection() {
  return (
    <section
      className="py-[120px] text-center bg-gradient-to-br from-[#0F172A] to-[#1E293B] relative overflow-hidden max-md:py-20"
      id="cta"
    >
      <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle_at_30%_50%,rgba(37,99,235,0.08)_0%,transparent_50%)] pointer-events-none" />
      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5 relative">
        <ScrollReveal>
          <h2 className="text-[44px] font-extrabold tracking-[-1.5px] leading-[1.15] text-white max-md:text-[32px]">
            지금 바로
            <br />
            견적 받아보세요
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <p className="text-[17px] text-[#94A3B8] mt-5 mb-10">
            카톡 한 번이면 정확한 견적 확인 가능
          </p>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <CTALink
            location="bottom"
            className="inline-flex items-center gap-2 bg-kakao text-text-primary text-[17px] font-bold py-[17px] px-9 rounded-[12px] hover:bg-kakao-hover active:scale-[0.98] transition-all"
          >
            <KakaoIcon />
            <span>카카오톡으로 무료 견적 받기</span>
          </CTALink>
        </ScrollReveal>
        <ScrollReveal delay={0.3}>
          <p className="text-sm text-[#64748B] mt-6 leading-relaxed">
            소량/대량 상관없이 · 평일/주말/공휴일 상관없이
            <br />
            언제든 편하게 문의하세요
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}

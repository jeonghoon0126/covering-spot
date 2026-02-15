import { pricingItems } from "@/data/pricing-items";
import { features } from "@/data/features";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export function Pricing() {
  return (
    <section className="py-[120px] bg-bg max-md:py-20" id="pricing">
      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5">
        {/* ── 견적 구성 ── */}
        <ScrollReveal>
          <SectionHeader
            tag="가격 안내"
            title="이렇게 견적이 정해져요"
            desc="명확한 기준으로 투명하게 안내드려요"
            center
          />
        </ScrollReveal>

        {/* 단일 카드 안에 테이블 형태로 구성 */}
        <ScrollReveal>
          <div className="max-w-[720px] mx-auto rounded-[20px] border border-border bg-bg-warm overflow-hidden">
            {pricingItems.map((item, i) => (
              <div
                key={item.title}
                className={`flex gap-6 px-10 py-8 max-sm:px-6 max-sm:py-6 max-sm:flex-col max-sm:gap-3 ${
                  i < pricingItems.length - 1
                    ? "border-b border-border"
                    : ""
                }`}
              >
                {/* 좌측: 라벨 + 제목 */}
                <div className="w-[200px] shrink-0 max-sm:w-full">
                  <span className="text-[12px] font-semibold text-primary tracking-[0.3px] leading-none">
                    {item.label}
                  </span>
                  <div className="text-[18px] font-bold mt-1.5 text-text-primary">
                    {item.title}
                  </div>
                </div>
                {/* 우측: 상세 설명 */}
                <div className="flex-1 text-[15px] text-text-sub leading-[1.8] whitespace-pre-line pt-0.5 max-sm:pt-0">
                  {item.detail}
                </div>
              </div>
            ))}

            {/* 하단 안내 */}
            <div className="px-10 py-5 bg-primary-bg border-t border-primary/8 max-sm:px-6">
              <p className="text-[13px] text-primary font-medium leading-relaxed">
                카톡으로 품목만 알려주시면 10분 내 견적을 안내드려요
              </p>
            </div>
          </div>
        </ScrollReveal>

        {/* ── 왜 커버링인가요 ── */}
        <ScrollReveal>
          <div className="mt-[120px] max-md:mt-20">
            <div className="text-center mb-14 max-md:mb-10">
              <h3 className="text-[28px] font-extrabold tracking-[-0.8px] text-text-primary max-md:text-[24px]">
                왜 커버링인가요?
              </h3>
            </div>

            {/* 수평 스트립 형태 */}
            <div className="flex max-lg:flex-col">
              {features.map((feat, i) => (
                <div
                  key={feat.title}
                  className={`flex-1 px-8 py-4 max-lg:px-0 max-lg:py-6 rounded-xl transition-all duration-200 hover:bg-primary-bg ${
                    i < features.length - 1
                      ? "border-r border-border max-lg:border-r-0 max-lg:border-b"
                      : ""
                  }`}
                >
                  <div className="text-[16px] font-bold text-text-primary mb-2">
                    {feat.title}
                  </div>
                  <div className="text-[14px] text-text-sub leading-[1.7] whitespace-pre-line">
                    {feat.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

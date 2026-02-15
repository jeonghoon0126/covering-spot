import { processSteps } from "@/data/process-steps";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export function Process() {
  return (
    <section className="py-[120px] bg-bg-warm max-md:py-20" id="process">
      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5">
        <ScrollReveal>
          <SectionHeader
            tag="이용 방법"
            title="간단한 4단계"
            desc="복잡한 절차 없이, 신청부터 수거까지 쉽고 빠르게"
            center
          />
        </ScrollReveal>
        <div className="grid grid-cols-4 gap-8 max-lg:grid-cols-2 max-lg:gap-6">
          {processSteps.map((step, i) => (
            <ScrollReveal key={step.num} delay={i * 0.1}>
              <div className="relative">
                {/* 스텝 간 연결선 (마지막 카드 제외) */}
                {i < processSteps.length - 1 && (
                  <div className="absolute top-10 -right-8 w-8 h-[2px] z-[1] max-lg:hidden">
                    <div className="w-full h-full border-t-2 border-dashed border-primary/20" />
                    <svg
                      className="absolute -right-1 top-1/2 -translate-y-1/2 text-primary/30"
                      width="8"
                      height="10"
                      viewBox="0 0 8 10"
                      fill="currentColor"
                    >
                      <path d="M0 0L8 5L0 10V0Z" />
                    </svg>
                  </div>
                )}
                <div className="bg-bg rounded-[16px] p-8 text-left border border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-hover">
                  {/* 번호 영역 */}
                  <div className="w-12 h-12 rounded-[14px] bg-primary-bg flex items-center justify-center mb-6">
                    <span className="text-[22px] font-extrabold text-primary leading-none">
                      {step.num}
                    </span>
                  </div>
                  <div className="text-xl font-bold mb-3">{step.title}</div>
                  <div className="text-[15px] text-text-sub leading-relaxed whitespace-pre-line">
                    {step.desc}
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

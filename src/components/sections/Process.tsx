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
        <div className="grid grid-cols-4 gap-6 max-lg:grid-cols-2">
          {processSteps.map((step, i) => (
            <ScrollReveal key={step.num} delay={i * 0.1}>
              <div className="bg-bg rounded-[16px] p-8 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <div className="text-[28px] font-bold text-primary opacity-80 mb-5 leading-none">
                  {step.num}
                </div>
                <div className="text-xl font-bold mb-3">{step.title}</div>
                <div className="text-[15px] text-text-sub leading-relaxed whitespace-pre-line">
                  {step.desc}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

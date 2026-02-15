import { compareCards, compareReasons } from "@/data/compare-data";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export function Compare() {
  const good = compareCards[0];
  const bad = compareCards[1];

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

        {/* Comparison Table */}
        <ScrollReveal>
          <div className="max-w-[720px] mx-auto">
            <div className="bg-bg rounded-2xl border border-border overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_1fr] border-b border-border">
                <div className="px-8 py-5 max-sm:px-5 max-sm:py-4">
                  <span className="text-[15px] font-bold text-text-primary">
                    {good.badge}
                  </span>
                  <p className="text-[13px] text-text-muted mt-0.5">
                    {good.method}
                  </p>
                </div>
                <div className="px-8 py-5 border-l border-border max-sm:px-5 max-sm:py-4">
                  <span className="text-[15px] font-bold text-text-primary">
                    {bad.badge}
                  </span>
                  <p className="text-[13px] text-text-muted mt-0.5">
                    {bad.method}
                  </p>
                </div>
              </div>

              {/* Line Items */}
              {good.lines.map((goodLine, i) => {
                const badLine = bad.lines[i];
                return (
                  <div
                    key={i}
                    className={`grid grid-cols-[1fr_1fr] ${
                      i < good.lines.length - 1
                        ? "border-b border-dashed border-border/60"
                        : ""
                    }`}
                  >
                    <div className="px-8 py-3.5 max-sm:px-5 max-sm:py-3">
                      <span className="text-sm text-text-primary">
                        {goodLine.text}
                      </span>
                    </div>
                    <div className="px-8 py-3.5 border-l border-border max-sm:px-5 max-sm:py-3">
                      <span
                        className={`text-sm ${
                          badLine?.isExtra
                            ? "text-[#B91C1C]"
                            : "text-text-primary"
                        }`}
                      >
                        {badLine?.text}
                        {badLine?.isExtra && (
                          <span className="text-[11px] text-text-muted ml-1.5">
                            추가
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Totals */}
              <div className="grid grid-cols-[1fr_1fr] border-t border-border bg-[#FAFAFA]">
                <div className="px-8 py-6 max-sm:px-5 max-sm:py-5">
                  <div className="text-[22px] font-extrabold tracking-[-0.3px] text-text-primary max-sm:text-xl">
                    {good.total}
                  </div>
                  <span className="text-[13px] font-medium text-[#16A34A] mt-1 inline-block">
                    {good.tag}
                  </span>
                </div>
                <div className="px-8 py-6 border-l border-border max-sm:px-5 max-sm:py-5">
                  <div className="text-[22px] font-extrabold tracking-[-0.3px] text-text-primary max-sm:text-xl">
                    {bad.total}
                  </div>
                  <span className="text-[13px] font-medium text-[#DC2626] mt-1 inline-block">
                    {bad.tag}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Reasons - conversational style */}
        <ScrollReveal>
          <div className="max-w-[720px] mx-auto mt-20">
            <p className="text-lg font-bold text-text-primary mb-2">
              왜 이런 차이가 날까요?
            </p>
            <p className="text-[15px] text-text-muted mb-8 leading-relaxed">
              대부분의 업체는 이런 패턴을 따릅니다.
            </p>
            <div className="flex flex-col gap-6">
              {compareReasons.map((reason, i) => (
                <div key={i}>
                  <p className="text-[15px] font-semibold text-text-primary mb-1">
                    {reason.heading}
                  </p>
                  <p className="text-sm text-text-muted leading-relaxed">
                    {reason.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

import { compareCards, compareReasons } from "@/data/compare-data";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

const iconMap = {
  check: { text: "✓", goodBg: "bg-[#DCFCE7] text-[#166534]" },
  cross: { text: "✗", badBg: "bg-[#FEE2E2] text-[#991B1B]" },
  warn: { text: "!", badBg: "bg-[#FEE2E2] text-[#991B1B]" },
};

export function Compare() {
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

        <div className="grid grid-cols-2 gap-6 max-w-[840px] mx-auto relative max-lg:grid-cols-1 max-lg:max-w-[420px]">
          {compareCards.map((card, i) => (
            <ScrollReveal key={card.badge} delay={i * 0.1}>
              <div className="rounded-[20px] overflow-hidden bg-bg border border-border flex flex-col transition-all hover:-translate-y-[3px] hover:shadow-lg">
                {/* Accent bar */}
                <div
                  className={`h-1 ${
                    card.type === "good"
                      ? "bg-gradient-to-r from-[#10B981] to-[#34D399]"
                      : "bg-gradient-to-r from-[#EF4444] to-[#F87171]"
                  }`}
                />
                {/* Head */}
                <div
                  className={`px-7 py-5 flex items-center gap-3 border-b border-border-light ${
                    card.type === "good" ? "bg-[#F0FDF4]" : "bg-[#FEF2F2]"
                  } max-sm:px-5 max-sm:py-4`}
                >
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-md tracking-[0.3px] whitespace-nowrap ${
                      card.type === "good"
                        ? "bg-[#DCFCE7] text-[#166534]"
                        : "bg-[#FEE2E2] text-[#991B1B]"
                    }`}
                  >
                    {card.badge}
                  </span>
                  <span className="text-[13px] font-semibold text-text-sub">
                    {card.method}
                  </span>
                </div>
                {/* Body */}
                <div className="px-7 py-6 flex-1 max-sm:px-5 max-sm:py-5">
                  {card.lines.map((line, j) => {
                    const isLast = j === card.lines.length - 1 && card.type === "good" && j === 3;
                    return (
                      <div key={j}>
                        {j === 3 && card.type === "good" && (
                          <hr className="border-0 border-t border-dashed border-border my-2.5" />
                        )}
                        <div
                          className={`flex items-center gap-2.5 py-[5px] text-sm font-medium ${
                            line.isExtra
                              ? "text-semantic-red font-semibold"
                              : isLast
                              ? "text-text-sub"
                              : "text-text-primary"
                          }`}
                        >
                          <span
                            className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] shrink-0 font-bold ${
                              card.type === "good"
                                ? "bg-[#DCFCE7] text-[#166534]"
                                : "bg-[#FEE2E2] text-[#991B1B]"
                            }`}
                          >
                            {iconMap[line.icon].text}
                          </span>
                          {line.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Foot */}
                <div
                  className={`px-7 py-5 text-center border-t border-border-light ${
                    card.type === "good" ? "bg-[#F0FDF4]" : "bg-[#FEF2F2]"
                  } max-sm:px-5 max-sm:py-4`}
                >
                  <div
                    className={`text-[28px] font-extrabold tracking-[-0.5px] leading-none max-md:text-2xl ${
                      card.type === "good"
                        ? "text-[#166534]"
                        : "text-[#991B1B]"
                    }`}
                  >
                    {card.total}
                  </div>
                  <span
                    className={`inline-block text-[13px] font-bold px-3 py-[5px] rounded-lg mt-2.5 ${
                      card.type === "good"
                        ? "bg-[#DCFCE7] text-[#166534]"
                        : "bg-[#FEE2E2] text-[#991B1B]"
                    }`}
                  >
                    {card.tag}
                  </span>
                </div>
              </div>
            </ScrollReveal>
          ))}

          {/* VS Badge */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[2] w-11 h-11 rounded-full bg-bg-warm border-2 border-border flex items-center justify-center text-xs font-extrabold text-text-muted tracking-[0.5px] max-lg:static max-lg:translate-x-0 max-lg:translate-y-0 max-lg:mx-auto max-lg:-my-3">
            VS
          </div>
        </div>

        {/* Reasons */}
        <ScrollReveal>
          <div className="max-w-[840px] mx-auto mt-14">
            <div className="text-xl font-bold mb-6 text-center">
              왜 이런 차이가 날까요?
            </div>
            <div className="flex flex-col gap-3">
              {compareReasons.map((reason, i) => (
                <div
                  key={i}
                  className="bg-bg border border-border rounded-[16px] px-7 py-6 flex gap-4 items-start transition-all hover:border-[#CBD5E1] hover:shadow-sm"
                >
                  <div className="w-8 h-8 rounded-[10px] bg-primary-bg text-primary text-sm font-extrabold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-[15px] font-bold mb-1">
                      {reason.heading}
                    </div>
                    <div className="text-sm text-text-muted leading-relaxed">
                      {reason.desc}
                    </div>
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

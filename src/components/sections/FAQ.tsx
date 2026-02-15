"use client";

import { useState } from "react";
import type { FAQItem } from "@/types";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { track } from "@/lib/analytics";

interface Props {
  items: FAQItem[];
}

export function FAQ({ items }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    if (openIndex === index) {
      setOpenIndex(null);
    } else {
      setOpenIndex(index);
      track("faq_open", { question: items[index].question, index });
    }
  };

  return (
    <section className="py-[120px] bg-bg max-md:py-20" id="faq">
      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5">
        <ScrollReveal>
          <SectionHeader title="자주 묻는 질문" center />
        </ScrollReveal>

        <ScrollReveal>
          <div className="max-w-[720px] mx-auto">
            {items.map((item, i) => (
              <div
                key={i}
                className={`border-b border-border rounded-2xl mb-2 transition-all duration-300 ease-out ${
                  openIndex === i
                    ? "bg-primary/[0.03] border-primary/20"
                    : "hover:bg-bg-warm/60"
                }`}
              >
                <button
                  onClick={() => toggle(i)}
                  className="w-full bg-none border-none cursor-pointer py-7 px-6 flex justify-between items-center text-left gap-4 transition-all duration-300 ease-out hover:text-primary text-[17px] font-semibold text-text-primary max-md:px-4"
                >
                  <span>{item.question}</span>
                  <span
                    className={`w-8 h-8 shrink-0 rounded-[10px] flex items-center justify-center text-lg transition-all duration-300 ease-out ${
                      openIndex === i
                        ? "bg-primary text-white rotate-0 shadow-[0_2px_8px_rgba(37,99,235,0.3)]"
                        : "bg-bg-warm text-text-muted"
                    }`}
                  >
                    {openIndex === i ? "−" : "+"}
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-[max-height,opacity] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    maxHeight: openIndex === i ? "500px" : "0px",
                    opacity: openIndex === i ? 1 : 0,
                  }}
                >
                  <div className="pb-7 px-6 text-[15px] text-text-sub leading-[1.75] max-md:px-4">
                    {item.answer}
                    {item.note && (
                      <div className="text-[13px] text-text-muted mt-3 py-4 px-5 bg-bg-warm rounded-2xl leading-relaxed border border-border/50">
                        {item.note}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

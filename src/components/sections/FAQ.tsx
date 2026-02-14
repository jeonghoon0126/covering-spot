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
              <div key={i} className="border-b border-border">
                <button
                  onClick={() => toggle(i)}
                  className="w-full bg-none border-none cursor-pointer py-7 flex justify-between items-center text-left gap-4 transition-colors hover:text-primary text-[17px] font-semibold text-text-primary"
                >
                  <span>{item.question}</span>
                  <span
                    className={`w-8 h-8 shrink-0 rounded-[10px] flex items-center justify-center text-lg transition-all duration-250 ${
                      openIndex === i
                        ? "bg-primary text-white"
                        : "bg-bg-warm text-text-muted"
                    }`}
                  >
                    {openIndex === i ? "−" : "+"}
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-[max-height] duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ maxHeight: openIndex === i ? "300px" : "0px" }}
                >
                  <div className="pb-7 text-[15px] text-text-sub leading-[1.75]">
                    {item.answer}
                    {item.note && (
                      <div className="text-[13px] text-text-muted mt-2.5 py-3.5 px-[18px] bg-bg-warm rounded-[10px] leading-relaxed">
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

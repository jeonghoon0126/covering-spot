import { pricingItems } from "@/data/pricing-items";
import { features } from "@/data/features";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

const pricingIcons: Record<string, React.ReactNode> = {
  location: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  tag: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  people: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  terminal: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
};

const featureIcons: Record<string, React.ReactNode> = {
  chat: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  clock: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  home: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  dollar: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
};

export function Pricing() {
  return (
    <section className="py-[120px] bg-bg max-md:py-20" id="pricing">
      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5">
        <ScrollReveal>
          <SectionHeader
            tag="가격 안내"
            title="이렇게 견적이 정해져요"
            desc="명확한 기준으로 투명하게 안내드려요"
            center
          />
        </ScrollReveal>

        {/* Pricing Grid */}
        <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
          {pricingItems.map((item, i) => (
            <ScrollReveal key={item.title} delay={i * 0.1}>
              <div className="bg-bg-warm rounded-[20px] p-10 flex flex-col border border-border transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-hover hover:border-primary/20">
                <div className="w-12 h-12 rounded-[14px] bg-primary-bg flex items-center justify-center mb-6 text-primary">
                  {pricingIcons[item.icon]}
                </div>
                <div className="text-xs font-bold text-primary tracking-[0.5px] mb-2 uppercase">
                  {item.label}
                </div>
                <div className="text-xl font-bold mb-4">{item.title}</div>
                <div className="text-[15px] text-text-sub leading-[1.7] whitespace-pre-line">
                  {item.detail}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Features Strip */}
        <ScrollReveal>
          <div className="mt-20 pt-16 border-t border-border">
            <h3 className="text-2xl font-extrabold text-center mb-12 tracking-[-0.5px]">
              왜 커버링인가요?
            </h3>
            <div className="grid grid-cols-4 gap-6 max-lg:grid-cols-2 max-sm:gap-4">
              {features.map((feat) => (
                <div
                  key={feat.title}
                  className="text-center py-8 px-5 rounded-[16px] bg-bg-warm border border-border transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-hover hover:border-primary/20 max-sm:py-6 max-sm:px-4"
                >
                  <div className="w-12 h-12 rounded-[14px] bg-primary-bg flex items-center justify-center mx-auto mb-5 text-primary">
                    {featureIcons[feat.icon]}
                  </div>
                  <div className="text-[15px] font-bold mb-2">
                    {feat.title}
                  </div>
                  <div className="text-[13px] text-text-sub leading-relaxed whitespace-pre-line">
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

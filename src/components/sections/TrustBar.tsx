import { trustStats } from "@/data/trust-stats";

export function TrustBar() {
  return (
    <div className="border-t border-b border-border bg-gradient-to-b from-bg to-bg-warm/40">
      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5 flex items-center justify-center py-14 gap-16 max-md:gap-8 max-md:flex-wrap max-sm:flex-col max-sm:gap-6 max-sm:py-10">
        {trustStats.map((stat, i) => (
          <div key={stat.label} className="contents">
            {i > 0 && (
              <div className="w-px h-14 bg-gradient-to-b from-transparent via-border to-transparent max-md:h-10 max-sm:hidden" />
            )}
            <div className="text-center group">
              <div className="text-[40px] font-extrabold tracking-[-1.5px] leading-none mb-2 flex items-baseline gap-0.5 justify-center max-md:text-[30px] text-text-primary">
                {stat.value}
                {stat.suffix && (
                  <span className="text-xl font-bold text-primary">
                    {stat.suffix}
                  </span>
                )}
              </div>
              <div className="text-[13px] text-text-muted font-medium tracking-wide">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

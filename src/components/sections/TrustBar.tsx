import { trustStats } from "@/data/trust-stats";

export function TrustBar() {
  return (
    <div className="border-t border-b border-border bg-bg">
      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5 flex items-center justify-center py-12 gap-12 max-md:gap-6 max-md:flex-wrap max-sm:flex-col max-sm:gap-4">
        {trustStats.map((stat, i) => (
          <div key={stat.label} className="contents">
            {i > 0 && (
              <div className="w-px h-12 bg-border max-md:h-9 max-sm:hidden" />
            )}
            <div className="text-center">
              <div className="text-4xl font-extrabold tracking-[-1px] leading-none mb-1.5 flex items-baseline gap-0.5 justify-center max-md:text-[28px]">
                {stat.value}
                {stat.suffix && (
                  <span className="text-lg font-bold text-primary">
                    {stat.suffix}
                  </span>
                )}
              </div>
              <div className="text-[13px] text-text-muted font-medium">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

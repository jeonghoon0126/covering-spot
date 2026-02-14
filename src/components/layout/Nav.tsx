"use client";

import { useScrollPosition } from "@/hooks/useScrollPosition";
import { CTALink } from "@/components/ui/CTALink";

export function Nav() {
  const scrollY = useScrollPosition();

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[1000] h-16 flex items-center bg-white/85 backdrop-blur-[20px] transition-[border-color] duration-300 ${
        scrollY > 10 ? "border-b border-border" : "border-b border-transparent"
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5 flex justify-between items-center w-full">
        <a
          href="#"
          className="flex items-center gap-2.5 font-bold text-[17px] text-text-primary no-underline"
        >
          <div className="w-8 h-8 bg-primary rounded-[9px] grid place-items-center text-white text-[15px] font-extrabold">
            C
          </div>
          커버링 스팟
        </a>
        <div className="flex items-center gap-1">
          <a
            href="#pricing"
            className="text-text-sub no-underline text-sm font-medium px-3.5 py-2 rounded-lg transition-all hover:text-text-primary hover:bg-bg-warm max-md:hidden"
          >
            서비스 특징
          </a>
          <a
            href="#item-price"
            className="text-text-sub no-underline text-sm font-medium px-3.5 py-2 rounded-lg transition-all hover:text-text-primary hover:bg-bg-warm max-md:hidden"
          >
            가격
          </a>
          <a
            href="#faq"
            className="text-text-sub no-underline text-sm font-medium px-3.5 py-2 rounded-lg transition-all hover:text-text-primary hover:bg-bg-warm max-md:hidden"
          >
            FAQ
          </a>
          <CTALink
            location="nav"
            className="ml-2 bg-text-primary text-white text-[13px] font-semibold px-[18px] py-2 rounded-lg no-underline transition-colors hover:bg-[#1E293B]"
          >
            견적 문의
          </CTALink>
        </div>
      </div>
    </nav>
  );
}

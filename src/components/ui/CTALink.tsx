"use client";

import { type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { KAKAO_CHAT_URL } from "@/lib/constants";

interface Props {
  location: "hero" | "price" | "floating" | "bottom" | "nav";
  children: ReactNode;
  className?: string;
}

export function CTALink({ location, children, className }: Props) {
  return (
    <a
      href={KAKAO_CHAT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => track("cta_click", { location })}
    >
      {children}
    </a>
  );
}

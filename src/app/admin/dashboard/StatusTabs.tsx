"use client";

import { useRef } from "react";
import { STATUS_TABS } from "./dashboard-constants";

interface StatusTabsProps {
  activeTab: string;
  counts: Record<string, number>;
  totalCount: number;
  onTabChange: (tabKey: string) => void;
}

export function StatusTabs({ activeTab, counts, totalCount, onTabChange }: StatusTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMoved = useRef(false);

  function onMouseDown(e: React.MouseEvent) {
    isDown.current = true;
    hasMoved.current = false;
    startX.current = e.clientX;
    scrollLeftRef.current = scrollRef.current?.scrollLeft ?? 0;
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!isDown.current) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 3) hasMoved.current = true;
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollLeftRef.current - dx;
  }

  function onMouseUp() { isDown.current = false; }

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4 cursor-grab active:cursor-grabbing select-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {STATUS_TABS.map((tab) => {
        const count = tab.key === "all" ? totalCount : counts[tab.key] || 0;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => { if (!hasMoved.current) onTabChange(tab.key); }}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              isActive
                ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                : "bg-bg text-text-sub border border-border-light hover:border-primary/30 hover:text-text-primary"
            }`}
          >
            {tab.label}
            <span className={`text-xs font-semibold min-w-[18px] text-center ${
              isActive
                ? "text-white/80"
                : count > 0 ? "px-1.5 py-px rounded-full bg-bg-warm2 text-text-sub" : "text-text-muted"
            }`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

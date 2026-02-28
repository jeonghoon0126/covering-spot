"use client";

import { STATUS_TABS } from "./dashboard-constants";

interface StatusTabsProps {
  activeTab: string;
  counts: Record<string, number>;
  totalCount: number;
  onTabChange: (tabKey: string) => void;
}

export function StatusTabs({ activeTab, counts, totalCount, onTabChange }: StatusTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
      {STATUS_TABS.map((tab) => {
        const count = tab.key === "all" ? totalCount : counts[tab.key] || 0;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              isActive
                ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                : "bg-bg text-text-sub border border-border-light hover:border-primary/30"
            }`}
          >
            {tab.label}{" "}
            <span className={isActive ? "text-white/70" : "text-text-muted"}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

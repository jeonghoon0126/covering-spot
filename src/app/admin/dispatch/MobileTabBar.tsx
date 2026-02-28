"use client";

interface MobileTabBarProps {
  mobileTab: "map" | "list";
  onSelectTab: (tab: "map" | "list") => void;
}

export default function MobileTabBar({ mobileTab, onSelectTab }: MobileTabBarProps) {
  return (
    <div className="lg:hidden flex border-b border-border-light bg-bg">
      <button
        onClick={() => onSelectTab("list")}
        className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
          mobileTab === "list"
            ? "text-primary border-b-2 border-primary"
            : "text-text-muted"
        }`}
      >
        주문 목록
      </button>
      <button
        onClick={() => onSelectTab("map")}
        className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
          mobileTab === "map"
            ? "text-primary border-b-2 border-primary"
            : "text-text-muted"
        }`}
      >
        지도
      </button>
    </div>
  );
}

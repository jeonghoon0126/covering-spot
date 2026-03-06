import { useMemo } from 'react';
import type { Booking } from "@/types/booking";
import type { SpotItem } from '@/lib/db-misc';
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/format";
import { ITEM_CATEGORIES } from "./booking-detail-constants";

interface ItemsSectionProps {
  booking: Booking;
  isLocked: boolean;
  editingItems: boolean;
  itemEdits: { price: string; category: string; name: string }[];
  saving: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onUpdateItemEdit: (idx: number, field: "price" | "category" | "name", value: string) => void;
  onSaveItems: () => void;
  allSpotItems: SpotItem[];
  matchingIdx: number | null;
  matchingSearchQuery: string;
  onSetMatchingSearchQuery: (q: string) => void;
  onStartMatching: (idx: number) => void;
  onCancelMatching: () => void;
  onSelectMatchedItem: (idx: number, item: SpotItem) => void;
  onRegisterAndSelectNewItem: (idx: number, itemInfo: { category: string; name: string; price: number; loadingCube: number }) => Promise<void>;
}

export function ItemsSection({
  booking,
  isLocked,
  editingItems,
  itemEdits,
  saving,
  onStartEditing,
  onCancelEditing,
  onUpdateItemEdit,
  onSaveItems,
  allSpotItems,
  matchingIdx,
  matchingSearchQuery,
  onSetMatchingSearchQuery,
  onStartMatching,
  onCancelMatching,
  onSelectMatchedItem,
  onRegisterAndSelectNewItem,
}: ItemsSectionProps) {

  const filteredItems = useMemo(() => {
    if (!matchingSearchQuery) return [];
    const normalizedQuery = matchingSearchQuery.toLowerCase().replace(/\s+/g, "");
    return allSpotItems.filter(item =>
      item.name.toLowerCase().replace(/\s+/g, "").includes(normalizedQuery) ||
      item.displayName.toLowerCase().replace(/\s+/g, "").includes(normalizedQuery)
    ).slice(0, 10);
  }, [matchingSearchQuery, allSpotItems]);

  const handleRegister = async () => {
    if (matchingIdx === null) return;
    const price = prompt("새 품목의 단가를 입력하세요 (숫자만):", "0");
    if (price === null || !/^\d+$/.test(price)) {
      alert("올바른 가격을 입력해주세요.");
      return;
    }
    const loadingCube = prompt("새 품목의 적재큐브(m³)를 입력하세요 (숫자만):", "0.1");
    if (loadingCube === null || !/^\d*\.?\d+$/.test(loadingCube)) {
        alert("올바른 적재큐브 값을 입력해주세요.");
        return;
    }
    await onRegisterAndSelectNewItem(matchingIdx, {
      category: '직접입력',
      name: matchingSearchQuery,
      price: parseInt(price, 10),
      loadingCube: parseFloat(loadingCube)
    });
  };

  return (
    <div className="bg-bg rounded-lg p-5 border border-border-light">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-sub">
          품목 ({booking.items.length}종)
        </h3>
        {!isLocked && !editingItems && (
          <button
            onClick={onStartEditing}
            className="text-xs text-primary font-medium"
          >
            {booking.items.some((i) => i.price === 0) ? '가격 편집' : '품목 편집'}
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {booking.items.map((item, idx) => (
          <div key={idx}>
            <div className="flex justify-between text-sm">
              <span className="text-text-sub truncate max-w-[65%]">
                {item.category === "직접입력" ? (
                  <span className="text-semantic-orange">직접입력</span>
                ) : (
                  item.category
                )}
                {" - "}
                {item.name} x{item.quantity}
              </span>
              <span
                className={`font-medium ${item.price === 0 ? "text-semantic-orange" : ""}`}
              >
                {item.price === 0
                  ? "가격 미정"
                  : `${formatPrice(item.price * item.quantity)}원`}
              </span>
            </div>
            {editingItems && (
              <div className="flex flex-col gap-2 mt-1.5 ml-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="가격"
                    value={itemEdits[idx]?.price || ""}
                    onChange={(e) => onUpdateItemEdit(idx, "price", e.target.value)}
                    className="w-24 px-2 py-1 text-xs rounded-lg border border-border bg-bg-warm"
                  />
                  <select
                    value={itemEdits[idx]?.category || item.category}
                    onChange={(e) => onUpdateItemEdit(idx, "category", e.target.value)}
                    className="px-2 py-1 text-xs rounded-lg border border-border bg-bg-warm"
                  >
                    {ITEM_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {item.category === "직접입력" && matchingIdx !== idx && (
                    <Button variant="secondary" size="xs" onClick={() => onStartMatching(idx)}>품목 매칭</Button>
                  )}
                </div>
                {matchingIdx === idx && (
                  <div className="p-2 rounded-md bg-bg-warm border border-border-light space-y-2 relative">
                    <button onClick={onCancelMatching} className="absolute top-1 right-1 text-text-muted hover:text-text-primary text-xs">✕</button>
                    <input
                      type="text"
                      placeholder="표준 품목 검색..."
                      value={matchingSearchQuery}
                      onChange={(e) => onSetMatchingSearchQuery(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded-lg border border-border bg-bg"
                    />
                    {filteredItems.length > 0 && (
                      <ul className="max-h-32 overflow-y-auto text-xs space-y-1">
                        {filteredItems.map(spotItem => (
                          <li key={spotItem.id}>
                            <button onClick={() => onSelectMatchedItem(idx, spotItem)} className="w-full text-left p-1.5 rounded hover:bg-primary-bg transition-colors">
                              <p className="font-medium">{spotItem.category} - {spotItem.name}</p>
                              <p className="text-text-muted">{formatPrice(spotItem.price)}원</p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button variant="tertiary" size="xs" onClick={handleRegister}>
                      &apos;{matchingSearchQuery}&apos; 새 품목으로 등록
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {editingItems && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border-light">
          <Button
            variant="primary"
            size="sm"
            disabled={saving}
            onClick={onSaveItems}
          >
            저장
          </Button>
          <Button variant="tertiary" size="sm" onClick={onCancelEditing}>
            취소
          </Button>
        </div>
      )}
    </div>
  );
}

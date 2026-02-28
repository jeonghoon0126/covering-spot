import type { Booking } from "@/types/booking";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/format";
import { ITEM_CATEGORIES } from "./booking-detail-constants";

interface ItemsSectionProps {
  booking: Booking;
  isLocked: boolean;
  editingItems: boolean;
  itemEdits: { price: string; category: string }[];
  saving: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onUpdateItemEdit: (idx: number, field: "price" | "category", value: string) => void;
  onSaveItems: () => void;
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
}: ItemsSectionProps) {
  return (
    <div className="bg-bg rounded-lg p-5 border border-border-light">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-sub">
          품목 ({booking.items.length}종)
        </h3>
        {!isLocked && booking.items.some((i) => i.price === 0) && !editingItems && (
          <button
            onClick={onStartEditing}
            className="text-xs text-primary font-medium"
          >
            가격 편집
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
              <div className="flex gap-2 mt-1.5 ml-2">
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

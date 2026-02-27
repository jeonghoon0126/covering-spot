"use client";

import type { BookingItem } from "@/types/booking";
import type { SpotCategory } from "@/data/spot-items";
import type { QuoteResult } from "@/types/booking";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { categoryIcons, defaultCategoryIcon } from "@/data/category-icons";
import { formatManWon } from "@/lib/format";
import { VAGUE_ITEM_KEYWORDS } from "./booking-constants";

interface ItemSelectionStepProps {
  categories: SpotCategory[];
  openCat: string | null;
  setOpenCat: (v: string | null) => void;
  selectedItems: BookingItem[];
  updateItemQty: (cat: string, name: string, displayName: string, price: number, delta: number) => void;
  getItemQty: (cat: string, name: string) => number;
  itemSearch: string;
  setItemSearch: (v: string) => void;
  customItemName: string;
  setCustomItemName: (v: string) => void;
  categoryFilter: string | null;
  setCategoryFilter: (v: string | null) => void;
  photos: File[];
  photoPreviews: string[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removePhoto: (index: number) => void;
  previewQuote: QuoteResult | null;
  onVagueItem: (itemName: string, onContinue: () => void) => void;
}

export function ItemSelectionStep({
  categories,
  openCat,
  setOpenCat,
  selectedItems,
  updateItemQty,
  getItemQty,
  itemSearch,
  setItemSearch,
  customItemName,
  setCustomItemName,
  categoryFilter,
  setCategoryFilter,
  photos,
  photoPreviews,
  fileInputRef,
  handlePhotoChange,
  removePhoto,
  previewQuote,
  onVagueItem,
}: ItemSelectionStepProps) {
  return (
    <div className="space-y-3">
      {/* 선택된 품목 요약 */}
      {selectedItems.length > 0 && (
        <div className="bg-primary-bg rounded-lg p-4 mb-1">
          <p className="text-sm font-semibold text-primary mb-2">
            선택된 품목 ({selectedItems.length}종,{" "}
            {selectedItems.reduce((s, i) => s + i.quantity, 0)}개)
          </p>
          {selectedItems.map((item) => (
            <div
              key={`${item.category}-${item.name}`}
              className="flex items-center justify-between text-sm py-1.5"
            >
              <span className="truncate max-w-[50%]">
                {item.category} - {item.name}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateItemQty(item.category, item.name, item.displayName, item.price, -1)}
                  className="w-10 h-10 rounded-sm bg-white/60 text-text-sub text-xs font-bold flex items-center justify-center"
                >
                  −
                </button>
                <span className="w-5 text-center font-semibold text-xs">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateItemQty(item.category, item.name, item.displayName, item.price, 1)}
                  className="w-10 h-10 rounded-sm bg-primary text-white text-xs font-bold flex items-center justify-center"
                >
                  +
                </button>
                <button
                  onClick={() => updateItemQty(item.category, item.name, item.displayName, item.price, -item.quantity)}
                  className="text-text-muted hover:text-semantic-red text-xs ml-1"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 인기 품목 */}
      <div className="bg-bg rounded-lg shadow-md border border-border-light p-5 max-sm:p-4">
        <h3 className="text-sm font-semibold mb-3">인기 품목</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { cat: "장롱", name: "3자", displayName: "장롱 3자" },
            { cat: "침대", name: "더블 SET", displayName: "침대 더블" },
            { cat: "소파", name: "2인용", displayName: "소파 2인" },
            { cat: "가전", name: "양문형 냉장고", displayName: "냉장고" },
            { cat: "가전", name: "세탁기(일반)", displayName: "세탁기" },
            { cat: "가전", name: "에어컨(2in1)", displayName: "에어컨" },
            { cat: "식탁", name: "6인용미만(의자포함)", displayName: "식탁 4인" },
            { cat: "서랍장", name: "3단이하", displayName: "서랍장 3단" },
          ].map((pop) => {
            const qty = getItemQty(pop.cat, pop.name);
            const catData = categories.find((c) => c.name === pop.cat);
            const itemData = catData?.items.find((i) => i.name === pop.name);
            if (!itemData) return null;
            return (
              <button
                key={`${pop.cat}-${pop.name}`}
                onClick={() => updateItemQty(pop.cat, pop.name, itemData.displayName, itemData.price, 1)}
                className={`px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 active:scale-[0.97] ${
                  qty > 0
                    ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.2)]"
                    : "bg-bg-warm hover:bg-primary-bg"
                }`}
              >
                {pop.displayName} {qty > 0 && `(${qty})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* 품목 검색 */}
      <div className="mb-3">
        <TextField
          placeholder="품목 검색 (예: 침대, 소파, 냉장고)"
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
        />
      </div>

      {/* 카테고리 필터 칩 */}
      {!itemSearch.trim() && categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`shrink-0 px-3.5 py-2.5 rounded-full text-xs font-medium transition-all duration-200 ${
              categoryFilter === null
                ? "bg-primary text-white"
                : "bg-bg-warm text-text-sub hover:bg-primary-bg border border-border-light"
            }`}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => {
                setCategoryFilter(cat.name);
                setOpenCat(cat.name);
              }}
              className={`shrink-0 px-3.5 py-2.5 rounded-full text-xs font-medium transition-all duration-200 ${
                categoryFilter === cat.name
                  ? "bg-primary text-white"
                  : "bg-bg-warm text-text-sub hover:bg-primary-bg border border-border-light"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* 검색 결과 또는 카테고리 아코디언 */}
      {itemSearch.trim() ? (
        <div className="bg-bg rounded-lg shadow-md border border-border-light p-5 max-sm:p-4 space-y-2">
          <p className="text-sm text-text-sub mb-2">
            &quot;{itemSearch}&quot; 검색 결과
          </p>
          {(() => {
            const results = categories.flatMap((cat) =>
              cat.items
                .filter((item) =>
                  item.name.includes(itemSearch) || cat.name.includes(itemSearch),
                )
                .map((item) => ({ ...item, category: cat.name })),
            );
            if (results.length === 0) {
              return (
                <p className="text-sm text-text-muted py-4 text-center">
                  검색 결과가 없습니다. 아래에서 직접 입력해 주세요.
                </p>
              );
            }
            return results.map((item) => {
              const qty = getItemQty(item.category, item.name);
              return (
                <div
                  key={`${item.category}-${item.name}`}
                  className="flex items-center justify-between py-2 border-b border-border-light last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      <span className="text-text-muted">{item.category}</span> {item.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={() => updateItemQty(item.category, item.name, item.displayName, item.price, -1)}
                      disabled={qty === 0}
                      className="w-10 h-10 rounded-sm bg-bg-warm text-text-sub font-bold disabled:opacity-30 transition-all duration-200 hover:bg-bg-warm2 active:scale-90"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                    <button
                      onClick={() => updateItemQty(item.category, item.name, item.displayName, item.price, 1)}
                      className="w-10 h-10 rounded-sm bg-primary text-white font-bold transition-all duration-200 hover:bg-primary-dark active:scale-90"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      ) : (
        categories
        .filter((cat) => !categoryFilter || cat.name === categoryFilter)
        .map((cat) => (
          <div
            key={cat.name}
            className="bg-bg rounded-lg shadow-md border border-border-light overflow-hidden transition-all duration-200 hover:shadow-hover"
          >
            <button
              onClick={() =>
                setOpenCat(openCat === cat.name ? null : cat.name)
              }
              className="w-full px-6 py-5 max-sm:px-4 max-sm:py-4 flex items-center justify-between text-left hover:bg-bg-warm/60 transition-colors duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary-tint/50 flex items-center justify-center shrink-0">
                  {categoryIcons[cat.name] || defaultCategoryIcon}
                </div>
                <span className="font-medium">{cat.name}</span>
              </div>
              <span className="flex items-center gap-1 text-text-muted text-sm">
                {cat.items.length}개
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={`transition-transform duration-200 ${openCat === cat.name ? "rotate-180" : ""}`}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </button>
            {openCat === cat.name && (
              <div className="px-6 max-sm:px-4 pb-5 space-y-2">
                {cat.items.map((item) => {
                  const qty = getItemQty(cat.name, item.name);
                  return (
                    <div
                      key={item.name}
                      className="flex items-center justify-between py-2 border-b border-border-light last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button
                          onClick={() =>
                            updateItemQty(cat.name, item.name, item.displayName, item.price, -1)
                          }
                          disabled={qty === 0}
                          className="w-10 h-10 rounded-sm bg-bg-warm text-text-sub font-bold disabled:opacity-30 transition-all duration-200 hover:bg-bg-warm2 active:scale-90"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">
                          {qty}
                        </span>
                        <button
                          onClick={() =>
                            updateItemQty(cat.name, item.name, item.displayName, item.price, 1)
                          }
                          className="w-10 h-10 rounded-sm bg-primary text-white font-bold transition-all duration-200 hover:bg-primary-dark active:scale-90"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))
      )}

      {/* 커스텀 품목 입력 */}
      <div className="bg-bg rounded-lg shadow-md border border-border-light p-5 max-sm:p-4">
        <h3 className="text-sm font-semibold mb-3">원하는 품목이 없나요?</h3>
        <div className="flex gap-2">
          <div className="flex-1">
            <TextField
              placeholder="품목명 입력 (예: 대형 거울)"
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            size="md"
            disabled={!customItemName.trim()}
            onClick={() => {
              const trimmed = customItemName.trim();
              if (!trimmed) return;
              const isVague = VAGUE_ITEM_KEYWORDS.some((kw) => trimmed.includes(kw));
              if (isVague) {
                onVagueItem(trimmed, () => {
                  updateItemQty("직접입력", trimmed, trimmed, 0, 1);
                  setCustomItemName("");
                });
              } else {
                updateItemQty("직접입력", trimmed, trimmed, 0, 1);
                setCustomItemName("");
              }
            }}
          >
            추가
          </Button>
        </div>
        <p className="text-xs text-text-muted mt-2">
          직접 입력한 품목은 매니저 확인 후 가격이 책정됩니다
        </p>
      </div>

      {/* 견적 미리보기 */}
      {previewQuote && selectedItems.length > 0 && (
        <div className="bg-primary-bg rounded-lg border border-primary/20 p-5 max-sm:p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-primary">예상 견적 (사다리차 별도)</p>
            <p className="text-lg font-bold text-primary">
              {formatManWon(previewQuote.estimateMin)}~{formatManWon(previewQuote.estimateMax)}원
            </p>
          </div>
          <p className="text-xs text-text-muted mt-1">
            품목 기준 예상 금액이며, 최종 견적은 매니저 확인 후 확정됩니다
          </p>
        </div>
      )}

      {/* 사진 업로드 */}
      <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5 space-y-4">
        <div>
          <h3 className="font-semibold mb-1">품목 사진 첨부 <span className="text-xs font-normal text-text-muted">(선택)</span></h3>
          <p className="text-sm text-text-sub">
            사진을 첨부하시면 더 정확한 견적을 받으실 수 있습니다
          </p>
        </div>

        {/* 미리보기 그리드 */}
        {photoPreviews.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {photoPreviews.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-bg-warm">
                <img
                  src={url}
                  alt={`사진 ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removePhoto(i)}
                  aria-label="사진 삭제"
                  className="absolute top-1 right-1 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 파일 선택 버튼 */}
        {photos.length < 5 && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 rounded-md border-2 border-dashed border-border text-sm text-text-sub font-medium hover:border-primary hover:text-primary transition-colors"
          >
            사진 추가 ({photos.length}/5)
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handlePhotoChange}
          className="hidden"
        />
      </div>
    </div>
  );
}

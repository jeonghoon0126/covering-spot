"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DaumPostcodeEmbed from "react-daum-postcode";
import { detectAreaFromAddress } from "@/data/spot-areas";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { ModalHeader } from "@/components/ui/ModalHeader";
import type { BookingItem } from "@/types/booking";

const SOURCE_OPTIONS = ["런치", "카카오톡 상담", "전화 상담", "기타"];
const TIME_SLOTS = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

const POPULAR_ITEMS = [
  { cat: "장롱", name: "3자", displayName: "장롱 3자" },
  { cat: "침대", name: "더블 SET", displayName: "침대 더블" },
  { cat: "소파", name: "2인용", displayName: "소파 2인" },
  { cat: "가전", name: "양문형 냉장고", displayName: "냉장고" },
  { cat: "가전", name: "세탁기(일반)", displayName: "세탁기" },
  { cat: "가전", name: "에어컨(2in1)", displayName: "에어컨" },
  { cat: "식탁", name: "6인용미만(의자포함)", displayName: "식탁 4인" },
  { cat: "서랍장", name: "3단이하", displayName: "서랍장 3단" },
];

interface SpotItem {
  category: string;
  name: string;
  displayName: string;
  price: number;
  loadingCube: number;
}

interface SpotCategory {
  name: string;
  items: SpotItem[];
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

interface FormData {
  customerName: string;
  phone: string;
  address: string;
  addressDetail: string;
  area: string;
  date: string;
  timeSlot: string;
  memo: string;
  source: string;
  hasGroundAccess: boolean;
}

interface FormErrors {
  customerName?: string;
  phone?: string;
  address?: string;
}

export default function AdminBookingNewPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [form, setForm] = useState<FormData>({
    customerName: "",
    phone: "",
    address: "",
    addressDetail: "",
    area: "",
    date: "",
    timeSlot: "",
    memo: "",
    source: "카카오톡 상담",
    hasGroundAccess: false,
  });
  const [showPostcode, setShowPostcode] = useState(false);

  // 품목 선택 상태
  const [categories, setCategories] = useState<SpotCategory[]>([]);
  const [selectedItems, setSelectedItems] = useState<BookingItem[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [customItemName, setCustomItemName] = useState("");
  const [priceOverride, setPriceOverride] = useState("");

  // 품목에서 계산
  const itemsTotal = selectedItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalLoadingCube = selectedItems.reduce((s, i) => s + i.loadingCube * i.quantity, 0);

  useEffect(() => {
    const t = sessionStorage.getItem("admin_token");
    if (!t) {
      sessionStorage.setItem("admin_return_url", window.location.pathname);
      router.push("/admin");
      return;
    }
    setToken(t);
  }, [router]);

  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []));
  }, []);

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function getItemQty(cat: string, name: string): number {
    return selectedItems.find((i) => i.category === cat && i.name === name)?.quantity ?? 0;
  }

  function updateItemQty(
    cat: string,
    name: string,
    displayName: string,
    price: number,
    loadingCube: number,
    delta: number,
  ) {
    setSelectedItems((prev) => {
      const idx = prev.findIndex((i) => i.category === cat && i.name === name);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + delta };
        if (next[idx].quantity <= 0) next.splice(idx, 1);
        return next;
      }
      if (delta > 0) {
        return [...prev, { category: cat, name, displayName, price, quantity: 1, loadingCube }];
      }
      return prev;
    });
  }

  function addCustomItem() {
    const trimmed = customItemName.trim();
    if (!trimmed) return;
    updateItemQty("직접입력", trimmed, trimmed, 0, 0, 1);
    setCustomItemName("");
  }

  const filteredItems: SpotItem[] =
    itemSearch.trim().length >= 1
      ? categories
          .flatMap((cat) =>
            cat.items
              .filter(
                (item) =>
                  item.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
                  cat.name.toLowerCase().includes(itemSearch.toLowerCase()),
              )
              .map((item) => ({ ...item, category: cat.name })),
          )
          .slice(0, 40)
      : [];

  function validate(): boolean {
    const next: FormErrors = {};

    if (!form.customerName.trim()) {
      next.customerName = "고객 이름을 입력해주세요";
    }

    const phoneDigits = form.phone.replace(/\D/g, "");
    if (!phoneDigits) {
      next.phone = "전화번호를 입력해주세요";
    } else if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      next.phone = "올바른 전화번호를 입력해주세요";
    }

    if (!form.address.trim()) {
      next.address = "주소를 입력해주세요";
    } else if (!form.area) {
      if (!confirm("서비스 지역을 감지하지 못했습니다.\n지역 없이 예약을 생성하시겠습니까?")) {
        return false;
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const priceNum = priceOverride
        ? Number(priceOverride.replace(/\D/g, ""))
        : itemsTotal;

      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          phone: formatPhone(form.phone),
          address: form.address.trim(),
          addressDetail: form.addressDetail.trim(),
          area: form.area,
          items: selectedItems,
          estimatedPrice: priceNum,
          date: form.date,
          timeSlot: form.timeSlot,
          memo: form.memo.trim(),
          source: form.source,
          hasGroundAccess: form.hasGroundAccess,
        }),
      });

      if (res.status === 401) {
        sessionStorage.removeItem("admin_token");
        router.push("/admin");
        return;
      }

      const data = await res.json();

      if (res.ok && data.booking) {
        router.push(`/admin/bookings/${data.booking.id}`);
      } else {
        alert(data.error || "예약 생성에 실패했습니다");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-warm">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[42rem] mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="text-text-sub hover:text-text-primary transition-colors duration-200"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="text-lg font-bold">수동 예약 생성</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-[42rem] mx-auto px-4 py-4 space-y-4">
        {/* 고객 정보 */}
        <div className="bg-bg rounded-lg p-5 border border-border-light">
          <h3 className="text-sm font-semibold text-text-sub mb-4">고객 정보</h3>
          <div className="space-y-4">
            <TextField
              label="고객 이름"
              required
              value={form.customerName}
              onChange={(e) => updateField("customerName", e.target.value)}
              placeholder="홍길동"
              error={!!errors.customerName}
              helperText={errors.customerName}
            />
            <TextField
              label="전화번호"
              required
              value={form.phone}
              onChange={(e) => updateField("phone", formatPhone(e.target.value))}
              placeholder="010-0000-0000"
              type="tel"
              error={!!errors.phone}
              helperText={errors.phone}
            />
            <div className="flex flex-col">
              <label className="mb-2 text-sm font-semibold leading-[22px] text-text-primary">
                주소<span className="ml-0.5 text-semantic-red">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPostcode(true)}
                className={`w-full h-12 px-4 rounded-md border text-base text-left transition-all duration-200 hover:border-brand-300 outline-none ${
                  errors.address ? "border-semantic-red" : "border-border"
                } ${form.address ? "text-text-primary" : "text-text-muted"}`}
              >
                {form.address || "주소를 검색하세요"}
              </button>
              {errors.address && (
                <p className="mt-1 text-xs text-semantic-red">{errors.address}</p>
              )}
              {form.area && (
                <p className="mt-1 text-xs text-primary font-medium">
                  서비스 지역: {form.area}
                </p>
              )}
              {form.address && !form.area && (
                <p className="mt-1 text-xs text-semantic-orange font-medium">
                  서비스 지역 감지 불가 (수동으로 지역을 설정하세요)
                </p>
              )}
            </div>
            <TextField
              label="상세주소"
              value={form.addressDetail}
              onChange={(e) => updateField("addressDetail", e.target.value)}
              placeholder="101동 1001호 (선택)"
            />
          </div>
        </div>

        {/* 품목 선택 */}
        <div className="bg-bg rounded-lg p-5 border border-border-light">
          <h3 className="text-sm font-semibold text-text-sub mb-4">품목 선택</h3>

          {/* 검색 */}
          <input
            type="text"
            placeholder="품목 검색 (예: 침대, 소파, 냉장고)"
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-white text-sm placeholder:text-text-muted focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 transition-all"
          />

          {/* 인기 품목 (검색 없을 때) */}
          {!itemSearch.trim() && (
            <div className="mt-3">
              <p className="text-xs text-text-muted mb-2">인기 품목</p>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_ITEMS.map((pop) => {
                  const catData = categories.find((c) => c.name === pop.cat);
                  const itemData = catData?.items.find((i) => i.name === pop.name);
                  if (!itemData) return null;
                  const qty = getItemQty(pop.cat, pop.name);
                  return (
                    <button
                      key={`${pop.cat}-${pop.name}`}
                      type="button"
                      onClick={() =>
                        updateItemQty(
                          pop.cat,
                          pop.name,
                          itemData.displayName,
                          itemData.price,
                          itemData.loadingCube,
                          1,
                        )
                      }
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all active:scale-[0.97] ${
                        qty > 0
                          ? "bg-primary text-white"
                          : "bg-bg-warm hover:bg-primary-bg text-text-primary"
                      }`}
                    >
                      {pop.displayName}
                      {qty > 0 ? ` (${qty})` : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 검색 결과 */}
          {filteredItems.length > 0 && (
            <div className="mt-2 border border-border-light rounded-md divide-y divide-border-light max-h-64 overflow-y-auto">
              {filteredItems.map((item) => {
                const qty = getItemQty(item.category, item.name);
                return (
                  <div
                    key={`${item.category}-${item.name}`}
                    className="flex items-center justify-between px-3 py-2.5"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <span className="text-sm text-text-primary">
                        {item.category} - {item.name}
                      </span>
                      {item.loadingCube > 0 && (
                        <span className="ml-2 text-xs text-text-muted">{item.loadingCube}m³</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-text-muted w-16 text-right">
                        {item.price > 0 ? `${formatPrice(item.price)}원` : "가격 미정"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateItemQty(
                            item.category,
                            item.name,
                            item.displayName,
                            item.price,
                            item.loadingCube,
                            -1,
                          )
                        }
                        disabled={qty === 0}
                        className="w-6 h-6 rounded-full bg-bg-warm text-text-sub hover:bg-border-light disabled:opacity-30 text-sm font-bold flex items-center justify-center"
                      >
                        −
                      </button>
                      <span
                        className={`w-5 text-center text-sm font-medium ${
                          qty > 0 ? "text-primary" : "text-text-muted"
                        }`}
                      >
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateItemQty(
                            item.category,
                            item.name,
                            item.displayName,
                            item.price,
                            item.loadingCube,
                            1,
                          )
                        }
                        className="w-6 h-6 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center hover:bg-primary-dark"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {itemSearch.trim() && filteredItems.length === 0 && (
            <p className="mt-3 text-sm text-text-muted text-center py-4">검색 결과 없음</p>
          )}

          {/* 카테고리 아코디언 (검색 없을 때) */}
          {!itemSearch.trim() && categories.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-text-muted mb-2">카테고리별 선택</p>
              <div className="border border-border-light rounded-md divide-y divide-border-light max-h-72 overflow-y-auto">
                {categories.map((cat) => {
                  const catSelectedCount = selectedItems
                    .filter((i) => i.category === cat.name)
                    .reduce((s, i) => s + i.quantity, 0);
                  return (
                    <div key={cat.name}>
                      <button
                        type="button"
                        onClick={() => setOpenCat(openCat === cat.name ? null : cat.name)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-warm transition-colors"
                      >
                        <span>{cat.name}</span>
                        <span className="text-xs text-text-muted">
                          {catSelectedCount > 0 ? (
                            <span className="text-primary font-semibold">{catSelectedCount}개 선택</span>
                          ) : (
                            `${cat.items.length}종`
                          )}
                          {" "}
                          {openCat === cat.name ? "▲" : "▼"}
                        </span>
                      </button>
                      {openCat === cat.name && (
                        <div className="divide-y divide-border-light bg-bg-warm">
                          {cat.items.map((item) => {
                            const qty = getItemQty(cat.name, item.name);
                            return (
                              <div
                                key={item.name}
                                className="flex items-center justify-between px-4 py-2"
                              >
                                <div className="flex-1 min-w-0 mr-3">
                                  <span className="text-sm text-text-primary">{item.name}</span>
                                  <span className="ml-2 text-xs text-text-muted">
                                    {item.price > 0 ? `${formatPrice(item.price)}원` : "가격 미정"}
                                    {item.loadingCube > 0 ? ` · ${item.loadingCube}m³` : ""}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateItemQty(
                                        cat.name,
                                        item.name,
                                        item.displayName,
                                        item.price,
                                        item.loadingCube,
                                        -1,
                                      )
                                    }
                                    disabled={qty === 0}
                                    className="w-6 h-6 rounded-full bg-bg text-text-sub hover:bg-border-light disabled:opacity-30 text-sm font-bold flex items-center justify-center"
                                  >
                                    −
                                  </button>
                                  <span
                                    className={`w-5 text-center text-sm font-medium ${
                                      qty > 0 ? "text-primary" : "text-text-muted"
                                    }`}
                                  >
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateItemQty(
                                        cat.name,
                                        item.name,
                                        item.displayName,
                                        item.price,
                                        item.loadingCube,
                                        1,
                                      )
                                    }
                                    className="w-6 h-6 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center hover:bg-primary-dark"
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
                  );
                })}
              </div>
            </div>
          )}

          {/* 직접 입력 */}
          <div className="mt-3">
            <p className="text-xs text-text-muted mb-2">목록에 없는 품목</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="품목명 직접 입력"
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomItem();
                  }
                }}
                className="flex-1 h-9 px-3 rounded-md border border-border bg-white text-sm placeholder:text-text-muted focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 transition-all"
              />
              <button
                type="button"
                onClick={addCustomItem}
                disabled={!customItemName.trim()}
                className="h-9 px-3 rounded-md bg-bg-warm text-sm font-medium text-text-primary hover:bg-border-light disabled:opacity-40 transition-colors"
              >
                추가
              </button>
            </div>
          </div>

          {/* 선택된 품목 요약 */}
          {selectedItems.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border-light">
              <p className="text-xs font-semibold text-text-sub mb-2">
                선택된 품목 ({selectedItems.length}종)
              </p>
              <div className="space-y-1.5">
                {selectedItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-text-sub flex-1 truncate mr-2">
                      {item.category === "직접입력"
                        ? `[직접입력] ${item.name}`
                        : `${item.category} - ${item.name}`}
                      <span className="text-text-muted"> × {item.quantity}</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={
                          item.price === 0 ? "text-semantic-orange text-xs" : "text-text-primary"
                        }
                      >
                        {item.price === 0
                          ? "가격 미정"
                          : `${formatPrice(item.price * item.quantity)}원`}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-text-muted hover:text-semantic-red text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-light text-sm font-semibold">
                <span className="text-text-sub">총 적재: {totalLoadingCube.toFixed(1)}m³</span>
                <span className="text-text-primary">합계: {formatPrice(itemsTotal)}원</span>
              </div>
            </div>
          )}
        </div>

        {/* 수거 일정 */}
        <div className="bg-bg rounded-lg p-5 border border-border-light">
          <h3 className="text-sm font-semibold text-text-sub mb-4">수거 일정</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className="mb-2 text-sm font-semibold leading-[22px] text-text-primary">
                수거 희망 날짜
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
                className="w-full h-12 rounded-md px-4 text-base leading-6 outline-none transition-all duration-200 border border-border bg-white text-text-primary focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-2 text-sm font-semibold leading-[22px] text-text-primary">
                수거 희망 시간대
              </label>
              <select
                value={form.timeSlot}
                onChange={(e) => updateField("timeSlot", e.target.value)}
                className="w-full h-12 rounded-md px-4 text-base leading-6 outline-none transition-all duration-200 border border-border bg-white text-text-primary focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
              >
                <option value="">시간 선택</option>
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 견적 금액: 품목 합계 자동 계산, 필요시 override */}
          <div className="mt-4">
            <label className="mb-2 text-sm font-semibold leading-[22px] text-text-primary block">
              견적 금액 (원)
              {selectedItems.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-text-muted">
                  품목 합계 {formatPrice(itemsTotal)}원 · 다르면 직접 입력
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={priceOverride ? Number(priceOverride).toLocaleString("ko-KR") : ""}
                onChange={(e) => setPriceOverride(e.target.value.replace(/\D/g, ""))}
                placeholder={selectedItems.length > 0 ? formatPrice(itemsTotal) : "0"}
                className="w-full h-12 rounded-md px-4 pr-10 text-base leading-6 outline-none transition-all duration-200 placeholder:text-text-muted border border-border bg-white text-text-primary focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-sub">
                원
              </span>
            </div>
          </div>
        </div>

        {/* 추가 정보 */}
        <div className="bg-bg rounded-lg p-5 border border-border-light">
          <h3 className="text-sm font-semibold text-text-sub mb-4">추가 정보</h3>
          <div className="space-y-4">
            <TextArea
              label="특이사항 / 메모"
              value={form.memo}
              onChange={(e) => updateField("memo", e.target.value)}
              placeholder="수거 시 참고할 사항 (선택)"
              rows={3}
            />

            <div className="flex flex-col">
              <label className="mb-2 text-sm font-semibold leading-[22px] text-text-primary">
                지상 출입 가능
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, hasGroundAccess: true }))}
                  className={`flex-1 py-3 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                    form.hasGroundAccess === true
                      ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                      : "bg-bg-warm hover:bg-primary-bg border border-border-light"
                  }`}
                >
                  가능
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, hasGroundAccess: false }))}
                  className={`flex-1 py-3 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                    form.hasGroundAccess === false
                      ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                      : "bg-bg-warm hover:bg-primary-bg border border-border-light"
                  }`}
                >
                  불가
                </button>
              </div>
            </div>

            <div className="flex flex-col">
              <label className="mb-2 text-sm font-semibold leading-[22px] text-text-primary">
                접수 출처
              </label>
              <select
                value={form.source}
                onChange={(e) => updateField("source", e.target.value)}
                className="w-full h-12 rounded-md px-4 text-base leading-6 outline-none transition-all duration-200 border border-border bg-white text-text-primary focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 제출 */}
        <div className="pb-8">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={submitting}
            loading={submitting}
          >
            예약 생성
          </Button>
        </div>
      </form>

      {/* 주소 검색 팝업 */}
      {showPostcode && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim p-4"
          role="dialog"
          aria-modal="true"
          aria-label="주소 검색"
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowPostcode(false);
          }}
        >
          <div className="bg-white rounded-lg overflow-hidden w-full max-w-[28rem]">
            <ModalHeader
              title="주소 검색"
              onClose={() => setShowPostcode(false)}
            />
            <DaumPostcodeEmbed
              onComplete={(data) => {
                const addr = data.roadAddress || data.jibunAddress;
                updateField("address", addr);
                setShowPostcode(false);
                const detected = detectAreaFromAddress(data.sigungu, data.sido);
                updateField("area", detected ? detected.name : "");
              }}
              style={{ height: 400 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

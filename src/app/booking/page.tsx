"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { BookingItem, TimeSlot } from "@/types/booking";
import type { SpotArea } from "@/data/spot-areas";
import type { SpotCategory } from "@/data/spot-items";
import type { QuoteResult } from "@/types/booking";

const STEPS = ["날짜/시간", "지역", "품목", "사다리차", "견적 확인"];
const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

export default function BookingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: 날짜/시간
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Step 2: 지역
  const [areas, setAreas] = useState<SpotArea[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [areaSearch, setAreaSearch] = useState("");

  // Step 3: 품목
  const [categories, setCategories] = useState<SpotCategory[]>([]);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<BookingItem[]>([]);

  // Step 4: 사다리차
  const [needLadder, setNeedLadder] = useState(false);
  const [ladderType, setLadderType] = useState("10층 미만");
  const [ladderHours, setLadderHours] = useState(0);

  // Step 5: 고객정보
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [memo, setMemo] = useState("");

  // 견적
  const [quote, setQuote] = useState<QuoteResult | null>(null);

  // 데이터 로드
  useEffect(() => {
    fetch("/api/areas")
      .then((r) => r.json())
      .then((d) => setAreas(d.areas || []));
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []));
  }, []);

  // 날짜 선택 시 슬롯 로드
  useEffect(() => {
    if (!selectedDate) return;
    setSlots([]);
    setSelectedTime("");
    fetch(`/api/slots?date=${selectedDate}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []));
  }, [selectedDate]);

  // 견적 계산
  const calcQuote = useCallback(async () => {
    if (!selectedArea || selectedItems.length === 0) return;
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: selectedArea,
          items: selectedItems,
          needLadder,
          ladderType: needLadder ? ladderType : undefined,
          ladderHours: needLadder ? ladderHours : undefined,
        }),
      });
      const data = await res.json();
      setQuote(data);
    } catch {
      /* 에러 무시 */
    }
  }, [selectedArea, selectedItems, needLadder, ladderType, ladderHours]);

  useEffect(() => {
    if (step === 4) calcQuote();
  }, [step, calcQuote]);

  // 품목 수량 변경
  function updateItemQty(
    cat: string,
    name: string,
    displayName: string,
    price: number,
    delta: number,
  ) {
    setSelectedItems((prev) => {
      const idx = prev.findIndex(
        (i) => i.category === cat && i.name === name,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + delta };
        if (next[idx].quantity <= 0) next.splice(idx, 1);
        return next;
      }
      if (delta > 0) {
        return [...prev, { category: cat, name, displayName, price, quantity: 1 }];
      }
      return prev;
    });
  }

  function getItemQty(cat: string, name: string) {
    return (
      selectedItems.find((i) => i.category === cat && i.name === name)
        ?.quantity || 0
    );
  }

  // 예약 제출
  async function handleSubmit() {
    if (!quote) return;
    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          timeSlot: selectedTime,
          area: selectedArea,
          items: selectedItems,
          totalPrice: quote.totalPrice,
          crewSize: quote.crewSize,
          needLadder,
          ladderType: needLadder ? ladderType : "",
          ladderHours: needLadder ? ladderHours : undefined,
          ladderPrice: quote.ladderPrice,
          customerName,
          phone,
          address,
          addressDetail,
          memo,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/booking/complete?id=${data.booking.id}`);
      } else {
        alert(data.error || "예약 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  // 스텝별 완료 조건
  const canNext = [
    selectedDate && selectedTime,
    selectedArea,
    selectedItems.length > 0,
    true,
    customerName && phone && address,
  ];

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div>
      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                i <= step
                  ? "bg-primary text-white"
                  : "bg-border-light text-text-muted"
              }`}
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 ${i < step ? "bg-primary" : "bg-border-light"}`}
              />
            )}
          </div>
        ))}
      </div>
      <h2 className="text-xl font-bold mb-6">
        {STEPS[step]}
      </h2>

      {/* Step 1: 날짜/시간 */}
      {step === 0 && (
        <div className="space-y-6">
          {/* 달력 */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() =>
                  setCalMonth((p) => {
                    const d = new Date(p.year, p.month - 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })
                }
                className="p-2 hover:bg-bg-warm rounded-lg"
              >
                ‹
              </button>
              <span className="font-semibold">
                {calMonth.year}년 {calMonth.month + 1}월
              </span>
              <button
                onClick={() =>
                  setCalMonth((p) => {
                    const d = new Date(p.year, p.month + 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })
                }
                className="p-2 hover:bg-bg-warm rounded-lg"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {DAYS_KO.map((d) => (
                <div key={d} className="py-1 text-text-muted font-medium">
                  {d}
                </div>
              ))}
              {getMonthDays(calMonth.year, calMonth.month).map((day, i) => {
                if (day === null)
                  return <div key={`empty-${i}`} />;
                const dateStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isPast = dateStr < todayStr;
                const isSelected = dateStr === selectedDate;
                return (
                  <button
                    key={dateStr}
                    disabled={isPast}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`py-2 rounded-lg text-sm transition-colors ${
                      isPast
                        ? "text-text-muted/40 cursor-not-allowed"
                        : isSelected
                          ? "bg-primary text-white font-semibold"
                          : "hover:bg-primary-bg"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 시간 슬롯 */}
          {selectedDate && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-semibold mb-3">시간 선택</h3>
              {slots.length === 0 ? (
                <p className="text-text-muted text-sm">로딩 중...</p>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      disabled={!s.available}
                      onClick={() => setSelectedTime(s.time)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        !s.available
                          ? "bg-bg-warm2 text-text-muted line-through cursor-not-allowed"
                          : s.time === selectedTime
                            ? "bg-primary text-white"
                            : "bg-bg-warm hover:bg-primary-bg"
                      }`}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2: 지역 */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <input
            type="text"
            placeholder="지역 검색 (예: 강남구)"
            value={areaSearch}
            onChange={(e) => setAreaSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-bg-warm text-sm mb-4 focus:outline-none focus:border-primary"
          />
          <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
            {areas
              .filter((a) => a.name.includes(areaSearch))
              .map((a) => (
                <button
                  key={a.name}
                  onClick={() => setSelectedArea(a.name)}
                  className={`py-2.5 px-2 rounded-xl text-sm font-medium transition-colors ${
                    a.name === selectedArea
                      ? "bg-primary text-white"
                      : "bg-bg-warm hover:bg-primary-bg"
                  }`}
                >
                  {a.name}
                </button>
              ))}
          </div>
          {selectedArea && (
            <div className="mt-4 p-3 bg-primary-bg rounded-xl">
              <p className="text-sm font-medium text-primary">
                {selectedArea} 인력 단가
              </p>
              {(() => {
                const a = areas.find((a) => a.name === selectedArea);
                if (!a) return null;
                return (
                  <div className="flex gap-4 mt-1 text-sm text-text-sub">
                    <span>1명: {formatPrice(a.price1)}원</span>
                    <span>2명: {formatPrice(a.price2)}원</span>
                    <span>3명: {formatPrice(a.price3)}원</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Step 3: 품목 */}
      {step === 2 && (
        <div className="space-y-3">
          {/* 선택된 품목 요약 */}
          {selectedItems.length > 0 && (
            <div className="bg-primary-bg rounded-2xl p-4 mb-4">
              <p className="text-sm font-semibold text-primary mb-2">
                선택된 품목 ({selectedItems.length}종)
              </p>
              {selectedItems.map((item) => (
                <div
                  key={`${item.category}-${item.name}`}
                  className="flex justify-between text-sm py-1"
                >
                  <span>
                    {item.category} - {item.name} x{item.quantity}
                  </span>
                  <span className="font-medium">
                    {formatPrice(item.price * item.quantity)}원
                  </span>
                </div>
              ))}
              <div className="border-t border-primary/20 mt-2 pt-2 flex justify-between font-semibold text-sm">
                <span>합계</span>
                <span>
                  {formatPrice(
                    selectedItems.reduce(
                      (s, i) => s + i.price * i.quantity,
                      0,
                    ),
                  )}
                  원
                </span>
              </div>
            </div>
          )}
          {/* 카테고리 아코디언 */}
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="bg-white rounded-2xl shadow-sm overflow-hidden"
            >
              <button
                onClick={() =>
                  setOpenCat(openCat === cat.name ? null : cat.name)
                }
                className="w-full px-5 py-4 flex items-center justify-between text-left"
              >
                <span className="font-medium">{cat.name}</span>
                <span className="text-text-muted text-sm">
                  {cat.items.length}개 {openCat === cat.name ? "▲" : "▼"}
                </span>
              </button>
              {openCat === cat.name && (
                <div className="px-5 pb-4 space-y-2">
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
                          <p className="text-xs text-text-muted">
                            {formatPrice(item.price)}원
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={() =>
                              updateItemQty(
                                cat.name,
                                item.name,
                                item.displayName,
                                item.price,
                                -1,
                              )
                            }
                            disabled={qty === 0}
                            className="w-8 h-8 rounded-lg bg-bg-warm text-text-sub font-bold disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">
                            {qty}
                          </span>
                          <button
                            onClick={() =>
                              updateItemQty(
                                cat.name,
                                item.name,
                                item.displayName,
                                item.price,
                                1,
                              )
                            }
                            className="w-8 h-8 rounded-lg bg-primary text-white font-bold"
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
          ))}
        </div>
      )}

      {/* Step 4: 사다리차 */}
      {step === 3 && (
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={needLadder}
              onChange={(e) => setNeedLadder(e.target.checked)}
              className="w-5 h-5 accent-primary"
            />
            <span className="font-medium">사다리차가 필요합니다</span>
          </label>

          {needLadder && (
            <>
              <div>
                <p className="text-sm font-medium mb-2">층수</p>
                <div className="flex gap-3">
                  {["10층 미만", "10층 이상"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setLadderType(t)}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                        ladderType === t
                          ? "bg-primary text-white"
                          : "bg-bg-warm hover:bg-primary-bg"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">예상 소요시간</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    "기본(1시간 미만)",
                    "1시간",
                    "2시간",
                    "3시간",
                    "4시간",
                    "5시간",
                    "6시간",
                    "7시간",
                  ].map((d, i) => (
                    <button
                      key={d}
                      onClick={() => setLadderHours(i)}
                      className={`py-2.5 rounded-xl text-xs font-medium transition-colors ${
                        ladderHours === i
                          ? "bg-primary text-white"
                          : "bg-bg-warm hover:bg-primary-bg"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 5: 견적 확인 + 고객정보 */}
      {step === 4 && (
        <div className="space-y-5">
          {/* 견적 요약 */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-semibold mb-3">예약 요약</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-sub">날짜</span>
                <span className="font-medium">{selectedDate} {selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub">지역</span>
                <span className="font-medium">{selectedArea}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub">품목 수</span>
                <span className="font-medium">{selectedItems.length}종</span>
              </div>
            </div>
          </div>

          {/* 견적 상세 */}
          {quote && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-semibold mb-3">견적 금액</h3>
              <div className="space-y-2 text-sm">
                {quote.breakdown.map((b, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-text-sub truncate max-w-[60%]">
                      {b.name} x{b.quantity}
                    </span>
                    <span>{formatPrice(b.subtotal)}원</span>
                  </div>
                ))}
                <div className="border-t border-border-light pt-2 flex justify-between">
                  <span className="text-text-sub">품목 합계</span>
                  <span className="font-medium">
                    {formatPrice(quote.itemsTotal)}원
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-sub">
                    인력비 ({quote.crewSize}명)
                  </span>
                  <span className="font-medium">
                    {formatPrice(quote.crewPrice)}원
                  </span>
                </div>
                {quote.ladderPrice > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-sub">사다리차</span>
                    <span className="font-medium">
                      {formatPrice(quote.ladderPrice)}원
                    </span>
                  </div>
                )}
                <div className="border-t border-primary/20 pt-2 flex justify-between text-lg font-bold text-primary">
                  <span>총 견적</span>
                  <span>{formatPrice(quote.totalPrice)}원</span>
                </div>
              </div>
            </div>
          )}

          {/* 고객 정보 */}
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <h3 className="font-semibold">고객 정보</h3>
            <input
              type="text"
              placeholder="이름 *"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-bg-warm text-sm focus:outline-none focus:border-primary"
            />
            <input
              type="tel"
              placeholder="전화번호 * (예: 01012345678)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-bg-warm text-sm focus:outline-none focus:border-primary"
            />
            <input
              type="text"
              placeholder="주소 *"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-bg-warm text-sm focus:outline-none focus:border-primary"
            />
            <input
              type="text"
              placeholder="상세주소 (동/호수)"
              value={addressDetail}
              onChange={(e) => setAddressDetail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-bg-warm text-sm focus:outline-none focus:border-primary"
            />
            <textarea
              placeholder="요청사항 (선택)"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-border bg-bg-warm text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </div>
      )}

      {/* 하단 네비게이션 */}
      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 py-3.5 rounded-2xl border border-border text-text-sub font-semibold text-sm"
          >
            이전
          </button>
        )}
        {step < 4 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canNext[step]}
            className="flex-1 py-3.5 rounded-2xl bg-primary text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다음
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canNext[step] || loading}
            className="flex-1 py-3.5 rounded-2xl bg-primary text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "예약 중..." : "예약 신청하기"}
          </button>
        )}
      </div>
    </div>
  );
}

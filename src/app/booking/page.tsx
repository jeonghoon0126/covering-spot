"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { BookingItem } from "@/types/booking";
import type { SpotArea } from "@/data/spot-areas";
import type { SpotCategory } from "@/data/spot-items";
import type { QuoteResult } from "@/types/booking";
import DaumPostcodeEmbed from "react-daum-postcode";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { Checkbox } from "@/components/ui/Checkbox";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const STEPS = ["고객 정보", "날짜/시간", "지역", "품목/사진", "작업 환경", "사다리차", "견적 확인"];
const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const TIME_OPTIONS = ["오전 (09~12시)", "오후 (13~18시)", "종일 가능"];
const PHOTO_RECOMMEND_CATEGORIES = ["장롱", "침대", "소파"];

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/[^\d]/g, "").slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
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

  // Step 0: 고객정보
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [memo, setMemo] = useState("");
  const [showPostcode, setShowPostcode] = useState(false);

  // Step 1: 날짜/시간
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Step 2: 지역
  const [areas, setAreas] = useState<SpotArea[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [areaSearch, setAreaSearch] = useState("");

  // Step 3: 품목 + 사진
  const [categories, setCategories] = useState<SpotCategory[]>([]);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<BookingItem[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 4: 작업 환경
  const [hasElevator, setHasElevator] = useState<boolean | null>(null);
  const [hasParking, setHasParking] = useState<boolean | null>(null);

  // Step 5: 사다리차
  const [needLadder, setNeedLadder] = useState(false);
  const [ladderType, setLadderType] = useState("10층 미만");
  const [ladderHours, setLadderHours] = useState(0);

  // Step 6: 견적
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [leadSaved, setLeadSaved] = useState(false);

  // 데이터 로드
  useEffect(() => {
    fetch("/api/areas")
      .then((r) => r.json())
      .then((d) => setAreas(d.areas || []));
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []));
  }, []);

  // 사진 선택 시 미리보기 생성
  useEffect(() => {
    // 기존 preview URL 해제
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  // 사진 추가
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files);
    setPhotos((prev) => {
      const combined = [...prev, ...newFiles];
      return combined.slice(0, 5);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // 사진 삭제
  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  // 사진 권장 카테고리가 선택되었는지 확인
  const hasPhotoRecommendItem = selectedItems.some((item) =>
    PHOTO_RECOMMEND_CATEGORIES.includes(item.category),
  );

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

  // 견적 확인 단계 진입 시 견적 계산
  useEffect(() => {
    if (step === 6) calcQuote();
  }, [step, calcQuote]);

  // 리드 저장 (견적 확인 단계 진입 시 - 넛지용)
  useEffect(() => {
    if (step === 6 && !leadSaved) {
      setLeadSaved(true);
      fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          phone,
          address,
          addressDetail,
          memo,
          date: selectedDate,
          timeSlot: selectedTime,
          area: selectedArea,
          items: selectedItems,
          hasElevator,
          hasParking,
          needLadder,
        }),
      }).catch(() => {
        /* 리드 저장 실패는 무시 */
      });
    }
  }, [step, leadSaved, customerName, phone, address, addressDetail, memo, selectedDate, selectedTime, selectedArea, selectedItems, hasElevator, hasParking, needLadder]);

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

  // 수거 신청 확정
  async function handleSubmit() {
    if (!quote) return;
    setLoading(true);
    try {
      // 1. 사진이 있으면 먼저 업로드
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        const formData = new FormData();
        photos.forEach((file) => formData.append("photos", file));
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok) {
          photoUrls = uploadData.urls || [];
        }
      }

      // 2. 신청 데이터 전송
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          timeSlot: selectedTime,
          area: selectedArea,
          items: selectedItems,
          totalPrice: quote.totalPrice,
          estimateMin: quote.estimateMin,
          estimateMax: quote.estimateMax,
          crewSize: quote.crewSize,
          needLadder,
          ladderType: needLadder ? ladderType : "",
          ladderHours: needLadder ? ladderHours : undefined,
          ladderPrice: quote.ladderPrice,
          hasElevator,
          hasParking,
          photos: photoUrls,
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
        alert(data.error || "신청 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  // 스텝별 완료 조건
  const canNext = [
    customerName.trim().length >= 2 && phone.replace(/-/g, "").length >= 10 && address,  // Step 0: 고객 정보
    selectedDate && selectedTime,                        // Step 1: 날짜/시간
    selectedArea,                                         // Step 2: 지역
    selectedItems.length > 0,                            // Step 3: 품목/사진
    hasElevator !== null && hasParking !== null,          // Step 4: 작업 환경
    true,                                                 // Step 5: 사다리차
    !!quote,                                              // Step 6: 견적 확인
  ];

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div>
      {/* 스텝 인디케이터 */}
      <div className="mb-8">
        <div className="flex items-center gap-1 mb-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors ${
                  i < step
                    ? "bg-primary text-white"
                    : i === step
                      ? "bg-primary text-white ring-4 ring-primary/20"
                      : "bg-border-light text-text-muted"
                }`}
              >
                {i < step ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 transition-colors ${i < step ? "bg-primary" : "bg-border-light"}`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="hidden sm:flex items-center gap-1 mb-3">
          {STEPS.map((s, i) => (
            <div key={`label-${s}`} className="flex items-center gap-1 flex-1">
              <span
                className={`text-[11px] font-medium w-8 text-center shrink-0 transition-colors ${
                  i <= step ? "text-primary" : "text-text-muted"
                }`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && <div className="flex-1" />}
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted">
          {step + 1}/{STEPS.length}단계
        </p>
        <h2 className="text-xl font-bold">
          {STEPS[step]}
        </h2>
      </div>

      {/* Step 0: 고객 정보 */}
      {step === 0 && (
        <div className="bg-bg rounded-2xl shadow-sm border border-border-light p-5 space-y-4">
          <p className="text-sm text-text-sub">
            수거 신청을 위해 기본 정보를 입력해 주세요
          </p>
          <TextField
            label="이름"
            required
            placeholder="이름을 입력하세요"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            error={customerName.length > 0 && customerName.trim().length < 2}
            helperText={customerName.length > 0 && customerName.trim().length < 2 ? "2글자 이상 입력하세요" : undefined}
          />
          <TextField
            label="전화번호"
            required
            type="tel"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
            error={phone.length > 0 && phone.replace(/-/g, "").length < 10}
            helperText={phone.length > 0 && phone.replace(/-/g, "").length < 10 ? "올바른 전화번호를 입력하세요" : undefined}
          />
          <div className="flex flex-col">
            <label className="mb-2 text-sm font-semibold leading-[22px] text-text-primary">
              주소<span className="ml-0.5 text-semantic-red">*</span>
            </label>
            <button
              type="button"
              onClick={() => setShowPostcode(true)}
              className={`w-full h-12 px-4 rounded-[--radius-md] border border-border text-base text-left transition-all duration-200 hover:border-brand-300 ${
                address ? "text-text-primary" : "text-text-muted"
              }`}
            >
              {address || "주소를 검색하세요"}
            </button>
          </div>
          <TextField
            label="상세주소"
            placeholder="동/호수를 입력하세요"
            value={addressDetail}
            onChange={(e) => setAddressDetail(e.target.value)}
          />
          <TextArea
            label="요청사항"
            placeholder="요청사항을 입력하세요 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            maxLength={200}
          />
        </div>
      )}

      {/* Step 1: 날짜/시간 */}
      {step === 1 && (
        <div className="space-y-6">
          {/* 달력 */}
          <div className="bg-bg rounded-2xl shadow-sm border border-border-light p-5">
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
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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

          {/* 시간대 선택 */}
          {selectedDate && (
            <div className="bg-bg rounded-2xl shadow-sm border border-border-light p-5">
              <h3 className="font-semibold mb-3">시간대 선택</h3>
              <div className="grid grid-cols-3 gap-3">
                {TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSelectedTime(opt)}
                    className={`py-3 rounded-xl text-sm font-medium transition-colors ${
                      opt === selectedTime
                        ? "bg-primary text-white"
                        : "bg-bg-warm hover:bg-primary-bg"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: 지역 */}
      {step === 2 && (
        <div className="bg-bg rounded-2xl shadow-sm border border-border-light p-5">
          <div className="mb-4">
            <TextField
              placeholder="지역 검색 (예: 강남구)"
              value={areaSearch}
              onChange={(e) => setAreaSearch(e.target.value)}
            />
          </div>
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
        </div>
      )}

      {/* Step 3: 품목 + 사진 업로드 */}
      {step === 3 && (
        <div className="space-y-3">
          {/* 선택된 품목 요약 (가격 미표시) */}
          {selectedItems.length > 0 && (
            <div className="bg-primary-bg rounded-2xl p-4 mb-4">
              <p className="text-sm font-semibold text-primary mb-2">
                선택된 품목 ({selectedItems.length}종,{" "}
                {selectedItems.reduce((s, i) => s + i.quantity, 0)}개)
              </p>
              {selectedItems.map((item) => (
                <div
                  key={`${item.category}-${item.name}`}
                  className="flex justify-between text-sm py-1"
                >
                  <span>
                    {item.category} - {item.name}
                  </span>
                  <span className="font-medium text-text-sub">
                    x{item.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
          {/* 카테고리 아코디언 */}
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="bg-bg rounded-2xl shadow-sm border border-border-light overflow-hidden"
            >
              <button
                onClick={() =>
                  setOpenCat(openCat === cat.name ? null : cat.name)
                }
                className="w-full px-5 py-4 flex items-center justify-between text-left"
              >
                <span className="font-medium">{cat.name}</span>
                <span className="flex items-center gap-1 text-text-muted text-sm">
                  {cat.items.length}개
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={`transition-transform duration-200 ${openCat === cat.name ? "rotate-180" : ""}`}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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

          {/* 사진 업로드 */}
          <div className="bg-bg rounded-2xl shadow-sm border border-border-light p-5 space-y-4">
            <div>
              <h3 className="font-semibold mb-1">품목 사진 첨부</h3>
              <p className="text-sm text-text-sub">
                대형 품목(침대, 장롱, 소파 등)은 사진 첨부 시 정확한 견적 산정이 가능합니다
              </p>
              {hasPhotoRecommendItem && photos.length === 0 && (
                <p className="text-sm text-semantic-orange mt-1 font-medium">
                  선택하신 품목은 사진 첨부를 권장합니다
                </p>
              )}
            </div>

            {/* 미리보기 그리드 */}
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {photoPreviews.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-bg-warm">
                    <img
                      src={url}
                      alt={`사진 ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs"
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
                className="w-full py-3 rounded-xl border-2 border-dashed border-border text-sm text-text-sub font-medium hover:border-primary hover:text-primary transition-colors"
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
      )}

      {/* Step 4: 작업 환경 */}
      {step === 4 && (
        <div className="bg-bg rounded-2xl shadow-sm border border-border-light p-5 space-y-6">
          <div>
            <p className="font-medium mb-3">엘리베이터</p>
            <div className="flex gap-3">
              <button
                onClick={() => setHasElevator(true)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                  hasElevator === true
                    ? "bg-primary text-white"
                    : "bg-bg-warm hover:bg-primary-bg"
                }`}
              >
                사용 가능
              </button>
              <button
                onClick={() => setHasElevator(false)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                  hasElevator === false
                    ? "bg-primary text-white"
                    : "bg-bg-warm hover:bg-primary-bg"
                }`}
              >
                사용 불가
              </button>
            </div>
          </div>
          <div>
            <p className="font-medium mb-3">주차</p>
            <div className="flex gap-3">
              <button
                onClick={() => setHasParking(true)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                  hasParking === true
                    ? "bg-primary text-white"
                    : "bg-bg-warm hover:bg-primary-bg"
                }`}
              >
                가능
              </button>
              <button
                onClick={() => setHasParking(false)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                  hasParking === false
                    ? "bg-primary text-white"
                    : "bg-bg-warm hover:bg-primary-bg"
                }`}
              >
                불가능
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: 사다리차 */}
      {step === 5 && (
        <div className="bg-bg rounded-2xl shadow-sm border border-border-light p-5 space-y-5">
          <Checkbox
            checked={needLadder}
            onChange={(e) => setNeedLadder(e.target.checked)}
            label="사다리차가 필요합니다"
          />

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

      {/* Step 6: 견적 확인 + 예약 확정 */}
      {step === 6 && (
        <div className="space-y-5">
          {/* 수거 신청 요약 */}
          <div className="bg-bg rounded-2xl shadow-sm border border-border-light p-5">
            <h3 className="font-semibold mb-3">수거 신청 요약</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-sub">고객명</span>
                <span className="font-medium">{customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub">연락처</span>
                <span className="font-medium">{phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub">주소</span>
                <span className="font-medium text-right max-w-[60%]">
                  {address} {addressDetail}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub">날짜</span>
                <span className="font-medium">{selectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub">시간대</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub">지역</span>
                <span className="font-medium">{selectedArea}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub">품목 수</span>
                <span className="font-medium">{selectedItems.length}종</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub">엘리베이터</span>
                <span className="font-medium">
                  {hasElevator ? "사용 가능" : "사용 불가"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub">주차</span>
                <span className="font-medium">
                  {hasParking ? "가능" : "불가능"}
                </span>
              </div>
              {photos.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-sub">첨부 사진</span>
                  <span className="font-medium">{photos.length}장</span>
                </div>
              )}
            </div>
          </div>

          {/* 견적 상세 */}
          {quote ? (
            <div className="bg-bg rounded-2xl shadow-sm border border-border-light p-5">
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
                <div className="border-t border-primary/20 pt-3 mt-2">
                  <div className="flex justify-between text-lg font-bold text-primary">
                    <span>예상 견적</span>
                    <span>
                      {formatPrice(quote.estimateMin)} ~ {formatPrice(quote.estimateMax)}원
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    정확한 금액은 담당자 확인 후 안내드립니다
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-bg rounded-2xl shadow-sm border border-border-light p-8 flex flex-col items-center">
              <LoadingSpinner size="lg" />
              <p className="text-text-muted mt-4 text-sm">견적을 계산하고 있습니다...</p>
            </div>
          )}
        </div>
      )}

      {/* 하단 네비게이션 */}
      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <Button
            variant="tertiary"
            size="lg"
            fullWidth
            onClick={() => setStep(step - 1)}
          >
            이전
          </Button>
        )}
        {step < 5 ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canNext[step]}
            onClick={() => setStep(step + 1)}
          >
            다음
          </Button>
        ) : step === 5 ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => setStep(6)}
          >
            견적 확인하기
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canNext[step] || loading}
            loading={loading}
            onClick={handleSubmit}
          >
            {loading ? "" : "수거 신청 확정하기"}
          </Button>
        )}
      </div>

      {/* 주소 검색 팝업 */}
      {showPostcode && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim p-4">
          <div className="bg-white rounded-2xl overflow-hidden w-full max-w-[28rem]">
            <ModalHeader
              title="주소 검색"
              onClose={() => setShowPostcode(false)}
            />
            <DaumPostcodeEmbed
              onComplete={(data) => {
                setAddress(data.roadAddress || data.jibunAddress);
                setShowPostcode(false);
              }}
              style={{ height: 400 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

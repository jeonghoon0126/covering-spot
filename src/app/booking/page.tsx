"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { BookingItem } from "@/types/booking";
import { detectAreaFromAddress } from "@/data/spot-areas";
import { getEarliestBookableDate, isDateBookable } from "@/lib/booking-utils";
import type { SpotCategory } from "@/data/spot-items";
import type { QuoteResult } from "@/types/booking";
import { track } from "@/lib/analytics";
import DaumPostcodeEmbed from "react-daum-postcode";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { Checkbox } from "@/components/ui/Checkbox";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { categoryIcons, defaultCategoryIcon } from "@/data/category-icons";
import { formatPhoneNumber } from "@/lib/format";

const STEPS = ["고객 정보", "날짜/시간", "품목/사진", "작업 환경", "사다리차", "견적 확인"];
const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const TIME_OPTIONS = ["오전 (09~12시)", "오후 (13~18시)", "종일 가능"];
// 견적 미리보기 debounce용
const QUOTE_PREVIEW_DEBOUNCE = 800;

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

  // 시간대별 슬롯 잔여 (-1 = 아직 로드 안됨, 로딩 중 마감 표시 방지)
  const [timeSlotCounts, setTimeSlotCounts] = useState<Record<string, number>>({
    "오전 (09~12시)": -1,
    "오후 (13~18시)": -1,
    "종일 가능": -1,
  });
  const [slotsLoading, setSlotsLoading] = useState(false);

  // 지역 (주소에서 자동 감지)
  const [selectedArea, setSelectedArea] = useState("");
  const [areaError, setAreaError] = useState(false);

  // Step 2: 품목 + 사진
  const [categories, setCategories] = useState<SpotCategory[]>([]);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<BookingItem[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [customItemName, setCustomItemName] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Step 3: 작업 환경
  const [hasElevator, setHasElevator] = useState<boolean | null>(null);
  const [hasParking, setHasParking] = useState<boolean | null>(null);

  // Step 4: 사다리차
  const [needLadder, setNeedLadder] = useState(false);
  const [ladderType, setLadderType] = useState("10층 미만");
  const [ladderHours, setLadderHours] = useState(0);

  // Step 5: 견적
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [leadSaved, setLeadSaved] = useState(false);

  // localStorage 복원 (마운트 시 1회)
  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("covering_spot_booking_draft");
      if (!raw) { setDraftLoaded(true); return; }
      const d = JSON.parse(raw);
      if (d.customerName) setCustomerName(d.customerName);
      if (d.phone) setPhone(d.phone);
      if (d.address) setAddress(d.address);
      if (d.addressDetail) setAddressDetail(d.addressDetail);
      if (d.memo) setMemo(d.memo);
      if (d.selectedDate) setSelectedDate(d.selectedDate);
      if (d.selectedTime) setSelectedTime(d.selectedTime);
      if (d.selectedArea) setSelectedArea(d.selectedArea);
      if (d.selectedItems?.length) setSelectedItems(d.selectedItems);
      if (d.hasElevator !== undefined) setHasElevator(d.hasElevator);
      if (d.hasParking !== undefined) setHasParking(d.hasParking);
      if (d.needLadder !== undefined) setNeedLadder(d.needLadder);
      if (d.ladderType) setLadderType(d.ladderType);
      if (d.ladderHours !== undefined) setLadderHours(d.ladderHours);
      if (typeof d.step === "number" && d.step >= 0 && d.step < STEPS.length) setStep(d.step);
    } catch { /* 파싱 실패 무시 */ }
    setDraftLoaded(true);
  }, []);

  // localStorage 저장 (debounce 500ms)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!draftLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem("covering_spot_booking_draft", JSON.stringify({
          customerName, phone, address, addressDetail, memo,
          selectedDate, selectedTime, selectedArea, selectedItems,
          hasElevator, hasParking, needLadder, ladderType, ladderHours, step,
        }));
      } catch { /* quota 초과 무시 */ }
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [draftLoaded, customerName, phone, address, addressDetail, memo, selectedDate, selectedTime, selectedArea, selectedItems, hasElevator, hasParking, needLadder, ladderType, ladderHours, step]);

  // 예약 시작 트래킹
  useEffect(() => {
    track("booking_start");
  }, []);

  // 스텝 변경 트래킹
  const prevStepRef = useRef(step);
  useEffect(() => {
    if (step !== prevStepRef.current) {
      track("booking_step_complete", { step: prevStepRef.current, stepName: STEPS[prevStepRef.current] });
      prevStepRef.current = step;
    }
  }, [step]);

  // 데이터 로드
  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []));
  }, []);

  // 날짜 변경 시 시간 선택 초기화 + 슬롯 카운트를 미로드 상태로 리셋
  useEffect(() => {
    setSelectedTime("");
    setTimeSlotCounts({
      "오전 (09~12시)": -1,
      "오후 (13~18시)": -1,
      "종일 가능": -1,
    });
  }, [selectedDate]);

  // 날짜 선택 시 슬롯 가용성 조회
  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    fetch(`/api/slots?date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => {
        const slots = data.slots || [];
        let am = 0;
        let pm = 0;
        for (const s of slots) {
          if (!s.available) continue;
          const h = parseInt(s.time.split(":")[0]);
          if (h < 13) am++;
          else pm++;
        }
        setTimeSlotCounts({
          "오전 (09~12시)": am,
          "오후 (13~18시)": pm,
          "종일 가능": am + pm,
        });
      })
      .catch(() => {})
      .finally(() => setSlotsLoading(false));
  }, [selectedDate]);

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
      const result = combined.slice(0, 5);
      track("booking_photo_upload", { count: result.length });
      return result;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // 사진 삭제
  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  // 품목 선택 시 견적 미리보기
  const [previewQuote, setPreviewQuote] = useState<QuoteResult | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if ((step !== 2 && step !== 4) || selectedItems.length === 0 || !selectedArea) {
      if (step !== 2 && step !== 4) setPreviewQuote(null);
      return;
    }
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            area: selectedArea,
            items: selectedItems,
            needLadder: step === 4 ? needLadder : false,
            ladderType: step === 4 && needLadder ? ladderType : undefined,
            ladderHours: step === 4 && needLadder ? ladderHours : undefined,
          }),
        });
        const data = await res.json();
        setPreviewQuote(data);
        if (data.estimateMin) {
          track("quote_preview", { itemCount: selectedItems.length, total: data.estimateMin });
        }
      } catch { /* 미리보기 실패 무시 */ }
    }, QUOTE_PREVIEW_DEBOUNCE);
    return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
  }, [step, selectedItems, selectedArea, needLadder, ladderType, ladderHours]);

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
    if (step === 5) calcQuote();
  }, [step, calcQuote]);

  // 리드 저장 (견적 확인 단계 진입 시 - 넛지용)
  useEffect(() => {
    if (step === 5 && !leadSaved) {
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
    if (delta > 0) {
      track("booking_item_select", { category: cat, name, price });
    }
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
    track("booking_submit", { itemCount: selectedItems.length, estimatedTotal: quote.estimateMin });
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
        localStorage.removeItem("covering_spot_booking_draft");
        // bookingToken 저장 (예약 조회/수정/삭제 시 사용)
        if (data.bookingToken) {
          localStorage.setItem("covering_spot_booking_token", data.bookingToken);
        }
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
    customerName.trim().length >= 2 && phone.replace(/-/g, "").length >= 10 && address && !!selectedArea && !areaError,  // Step 0: 고객 정보 + 지역 자동감지
    selectedDate && selectedTime,                        // Step 1: 날짜/시간
    selectedItems.length > 0,                            // Step 2: 품목 (사진은 선택)
    hasElevator !== null && hasParking !== null,          // Step 3: 작업 환경
    true,                                                 // Step 4: 사다리차
    !!quote,                                              // Step 5: 견적 확인
  ];

  const earliestBookable = getEarliestBookableDate();

  return (
    <div>
      {/* 스텝 인디케이터 */}
      <div className="mb-10" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuetext={`${STEPS.length}단계 중 ${step + 1}단계: ${STEPS[step]}`}>
        {/* 프로그레스 바 */}
        <div className="flex items-center gap-1.5 max-sm:gap-1 mb-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5 max-sm:gap-1 flex-1">
              <div
                className={`w-9 h-9 max-sm:w-7 max-sm:h-7 rounded-full flex items-center justify-center text-sm max-sm:text-xs font-bold shrink-0 transition-all duration-300 ${
                  i < step
                    ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                    : i === step
                      ? "bg-primary text-white ring-[3px] ring-primary/20 shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                      : "bg-bg-warm2 text-text-muted"
                }`}
              >
                {i < step ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div className="h-[2px] flex-1 rounded-full overflow-hidden bg-bg-warm2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${i < step ? "w-full bg-primary" : "w-0"}`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        {/* 현재 스텝 정보 */}
        <h2 className="text-2xl font-bold tracking-[-0.5px]">
          {STEPS[step]}
        </h2>
      </div>

      {/* Step 0: 고객 정보 */}
      {step === 0 && (
        <div className="bg-bg rounded-[--radius-lg] shadow-md border border-border-light p-7 max-sm:p-5 space-y-4">
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
              className={`w-full h-12 px-4 rounded-[--radius-md] border border-border text-base text-left transition-all duration-200 hover:border-brand-300 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none ${
                address ? "text-text-primary" : "text-text-muted"
              }`}
            >
              {address || "주소를 검색하세요"}
            </button>
          </div>
          {/* 지역 자동감지 결과 */}
          {address && areaError && (
            <p className="text-sm text-semantic-red font-medium">
              현재 서비스 불가 지역입니다. 서울 전역, 경기, 인천 지역만 서비스 가능합니다.
            </p>
          )}
          {address && selectedArea && !areaError && (
            <p className="text-sm text-primary font-medium">
              서비스 지역: {selectedArea}
            </p>
          )}
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
          {/* 마감 안내 */}
          <div className="bg-primary-tint/30 rounded-[--radius-md] px-4 py-3 border border-primary/20">
            <p className="text-sm text-primary font-medium">
              수거 희망일 전날 낮 12시까지 신청 가능합니다
            </p>
          </div>
          {/* 달력 */}
          <div className="bg-bg rounded-[--radius-lg] shadow-md border border-border-light p-7 max-sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() =>
                  setCalMonth((p) => {
                    const d = new Date(p.year, p.month - 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })
                }
                className="p-2 hover:bg-bg-warm rounded-[--radius-sm]"
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
                className="p-2 hover:bg-bg-warm rounded-[--radius-sm]"
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
                const isPast = !isDateBookable(dateStr);
                const isSelected = dateStr === selectedDate;
                return (
                  <button
                    key={dateStr}
                    disabled={isPast}
                    onClick={() => setSelectedDate(dateStr)}
                    aria-label={`${calMonth.month + 1}월 ${day}일 ${isPast ? '예약 불가' : '예약 가능'}`}
                    aria-pressed={isSelected}
                    className={`py-3 min-h-[44px] rounded-[--radius-md] text-sm transition-all duration-200 ${
                      isPast
                        ? "text-text-muted/40 cursor-not-allowed"
                        : isSelected
                          ? "bg-primary text-white font-bold shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                          : "hover:bg-primary-bg active:scale-95 font-medium"
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
            <div className="bg-bg rounded-[--radius-lg] shadow-md border border-border-light p-7 max-sm:p-5">
              <h3 className="font-semibold mb-1">시간대 선택</h3>
              <p className="text-sm text-text-sub mb-3">
                쓰레기 수거량에 따라서 수거 시간대가 확정돼요.<br />
                매니저가 신청 내용 확인 후 견적과 함께 확정 안내를 드려요.
              </p>
              {slotsLoading ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {TIME_OPTIONS.map((opt) => {
                    const count = timeSlotCounts[opt] ?? -1;
                    const isFull = count === 0; // -1 = 미로드 (가능으로 표시), 0 = 마감
                    return (
                      <button
                        key={opt}
                        onClick={() => !isFull && setSelectedTime(opt)}
                        disabled={isFull}
                        aria-label={`${opt} ${isFull ? '마감' : '선택 가능'}`}
                        aria-pressed={opt === selectedTime}
                        className={`py-3.5 rounded-[--radius-md] text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                          isFull
                            ? "bg-fill-tint text-text-muted cursor-not-allowed"
                            : opt === selectedTime
                              ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                              : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
                        }`}
                      >
                        {opt}
                        {isFull && (
                          <span className="block text-xs mt-0.5 text-semantic-red/70">마감</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2: 품목 + 사진 업로드 */}
      {step === 2 && (
        <div className="space-y-3">
          {/* 선택된 품목 요약 */}
          {selectedItems.length > 0 && (
            <div className="bg-primary-bg rounded-[--radius-lg] p-4 mb-1">
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
                      className="w-10 h-10 rounded-[--radius-sm] bg-white/60 text-text-sub text-xs font-bold flex items-center justify-center"
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-semibold text-xs">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateItemQty(item.category, item.name, item.displayName, item.price, 1)}
                      className="w-10 h-10 rounded-[--radius-sm] bg-primary text-white text-xs font-bold flex items-center justify-center"
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
          <div className="bg-bg rounded-[--radius-lg] shadow-md border border-border-light p-5 max-sm:p-4">
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
                    className={`px-3 py-2 rounded-[--radius-md] text-xs font-medium transition-all duration-200 active:scale-[0.97] ${
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
            <div className="bg-bg rounded-[--radius-lg] shadow-md border border-border-light p-5 max-sm:p-4 space-y-2">
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
                          className="w-10 h-10 rounded-[--radius-sm] bg-bg-warm text-text-sub font-bold disabled:opacity-30 transition-all duration-200 hover:bg-bg-warm2 active:scale-90"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                        <button
                          onClick={() => updateItemQty(item.category, item.name, item.displayName, item.price, 1)}
                          className="w-10 h-10 rounded-[--radius-sm] bg-primary text-white font-bold transition-all duration-200 hover:bg-primary-dark active:scale-90"
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
                className="bg-bg rounded-[--radius-lg] shadow-md border border-border-light overflow-hidden transition-all duration-200 hover:shadow-hover"
              >
                <button
                  onClick={() =>
                    setOpenCat(openCat === cat.name ? null : cat.name)
                  }
                  className="w-full px-6 py-5 max-sm:px-4 max-sm:py-4 flex items-center justify-between text-left hover:bg-bg-warm/60 transition-colors duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[--radius-md] bg-primary-tint/50 flex items-center justify-center shrink-0">
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
                              className="w-10 h-10 rounded-[--radius-sm] bg-bg-warm text-text-sub font-bold disabled:opacity-30 transition-all duration-200 hover:bg-bg-warm2 active:scale-90"
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
                              className="w-10 h-10 rounded-[--radius-sm] bg-primary text-white font-bold transition-all duration-200 hover:bg-primary-dark active:scale-90"
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
          <div className="bg-bg rounded-[--radius-lg] shadow-md border border-border-light p-5 max-sm:p-4">
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
                  if (!customItemName.trim()) return;
                  updateItemQty("직접입력", customItemName.trim(), customItemName.trim(), 0, 1);
                  setCustomItemName("");
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
            <div className="bg-primary-bg rounded-[--radius-lg] border border-primary/20 p-5 max-sm:p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-primary">예상 견적 (사다리차 별도)</p>
                <p className="text-lg font-bold text-primary">
                  {formatPrice(previewQuote.estimateMin)}~{formatPrice(previewQuote.estimateMax)}원
                </p>
              </div>
              <p className="text-xs text-text-muted mt-1">
                품목 기준 예상 금액이며, 최종 견적은 매니저 확인 후 확정됩니다
              </p>
            </div>
          )}

          {/* 사진 업로드 */}
          <div className="bg-bg rounded-[--radius-lg] shadow-md border border-border-light p-7 max-sm:p-5 space-y-4">
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
                  <div key={i} className="relative aspect-square rounded-[--radius-md] overflow-hidden bg-bg-warm">
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
                className="w-full py-3 rounded-[--radius-md] border-2 border-dashed border-border text-sm text-text-sub font-medium hover:border-primary hover:text-primary transition-colors"
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

      {/* Step 3: 작업 환경 */}
      {step === 3 && (
        <div className="bg-bg rounded-[--radius-lg] shadow-md border border-border-light p-7 max-sm:p-5 space-y-8">
          <p className="text-sm text-text-sub">작업 환경을 알려주세요</p>
          <div>
            <p className="font-semibold mb-4">엘리베이터</p>
            <div className="flex gap-3">
              <button
                onClick={() => setHasElevator(true)}
                className={`flex-1 py-3.5 rounded-[--radius-md] text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                  hasElevator === true
                    ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                    : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
                }`}
              >
                사용 가능
              </button>
              <button
                onClick={() => setHasElevator(false)}
                className={`flex-1 py-3.5 rounded-[--radius-md] text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                  hasElevator === false
                    ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                    : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
                }`}
              >
                사용 불가
              </button>
            </div>
          </div>
          <div>
            <p className="font-semibold mb-4">주차</p>
            <div className="flex gap-3">
              <button
                onClick={() => setHasParking(true)}
                className={`flex-1 py-3.5 rounded-[--radius-md] text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                  hasParking === true
                    ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                    : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
                }`}
              >
                가능
              </button>
              <button
                onClick={() => setHasParking(false)}
                className={`flex-1 py-3.5 rounded-[--radius-md] text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                  hasParking === false
                    ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                    : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
                }`}
              >
                불가능
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: 사다리차 */}
      {step === 4 && (
        <div className="bg-bg rounded-[--radius-lg] shadow-md border border-border-light p-7 max-sm:p-5 space-y-5">
          <p className="text-sm text-text-sub">사다리차 필요여부를 알려주세요</p>
          <Checkbox
            checked={needLadder}
            onChange={(e) => setNeedLadder(e.target.checked)}
            label="사다리차가 필요해요"
          />

          {needLadder && (
            <>
              <div>
                <p className="text-sm font-semibold mb-3">층수</p>
                <div className="flex gap-3">
                  {["10층 미만", "10층 이상"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setLadderType(t)}
                      className={`flex-1 py-3.5 rounded-[--radius-md] text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                        ladderType === t
                          ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                          : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-3">예상 소요시간</p>
                <div className="grid grid-cols-4 max-sm:grid-cols-2 gap-2">
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
                      className={`py-3 rounded-[--radius-md] text-xs font-medium transition-all duration-200 active:scale-[0.97] ${
                        ladderHours === i
                          ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                          : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
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

      {/* Step 5: 견적 확인 + 예약 확정 */}
      {step === 5 && (
        <div className="space-y-5">
          {/* 수거 신청 요약 */}
          <div className="bg-bg rounded-[--radius-lg] shadow-md border border-border-light p-7 max-sm:p-5">
            <h3 className="font-semibold mb-3">수거 신청내용을 확인해주세요</h3>
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
            <div className="bg-bg rounded-[--radius-lg] shadow-md border border-border-light p-7 max-sm:p-5">
              <h3 className="font-semibold mb-3">견적 금액</h3>
              <div className="space-y-2 text-sm">
                {quote.breakdown.map((b, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-text-sub truncate max-w-[60%]">
                      {b.name} x{b.quantity}
                    </span>
                    <span>
                      {b.unitPrice === 0 ? "가격 미정" : `${formatPrice(b.subtotal)}원`}
                    </span>
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
                <div className="border-t-2 border-primary/20 pt-4 mt-3">
                  <div className="flex justify-between text-xl max-sm:text-lg font-extrabold text-primary">
                    <span>예상 견적</span>
                    <span>
                      {formatPrice(quote.estimateMin)} ~ {formatPrice(quote.estimateMax)}원
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-2">
                    수거 신청 후 즉시 매니저가 확인하여 일정과 견적을 확정합니다
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-bg rounded-[--radius-lg] shadow-sm border border-border-light p-8 flex flex-col items-center">
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
        {step < 4 ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canNext[step]}
            onClick={() => setStep(step + 1)}
          >
            다음
          </Button>
        ) : step === 4 ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => setStep(5)}
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
            {loading ? "" : "견적 요청하기"}
          </Button>
        )}
      </div>

      {/* 주소 검색 팝업 */}
      {showPostcode && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim p-4"
          role="dialog"
          aria-modal="true"
          aria-label="주소 검색"
          onKeyDown={(e) => { if (e.key === "Escape") setShowPostcode(false); }}
        >
          <div className="bg-white rounded-[--radius-lg] overflow-hidden w-full max-w-[28rem]">
            <ModalHeader
              title="주소 검색"
              onClose={() => setShowPostcode(false)}
            />
            <DaumPostcodeEmbed
              onComplete={(data) => {
                setAddress(data.roadAddress || data.jibunAddress);
                setShowPostcode(false);
                // 서비스 지역 자동 감지
                const detected = detectAreaFromAddress(data.sigungu, data.sido);
                if (detected) {
                  setSelectedArea(detected.name);
                  setAreaError(false);
                } else {
                  setSelectedArea("");
                  setAreaError(true);
                }
              }}
              style={{ height: 400 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BookingItem } from "@/types/booking";
import { detectAreaFromAddress } from "@/data/spot-areas";
import type { SpotCategory } from "@/data/spot-items";
import type { QuoteResult } from "@/types/booking";
import { track } from "@/lib/analytics";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { STEPS, QUOTE_PREVIEW_DEBOUNCE } from "./booking-constants";
import { StepIndicator } from "./StepIndicator";
import { CustomerInfoStep } from "./CustomerInfoStep";
import { DateTimeStep } from "./DateTimeStep";
import { ItemSelectionStep } from "./ItemSelectionStep";
import { WorkEnvironmentStep } from "./WorkEnvironmentStep";
import { LadderStep } from "./LadderStep";
import { QuoteConfirmStep } from "./QuoteConfirmStep";
import { VagueItemModal, PostcodeModal } from "./BookingModals";
import { NavigationButtons } from "./NavigationButtons";

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="text-center py-20"><LoadingSpinner size="lg" /></div>}>
      <BookingPageContent />
    </Suspense>
  );
}

function BookingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [editMode, setEditMode] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
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
    "10:00": -1, "12:00": -1, "14:00": -1, "16:00": -1,
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

  // 모호한 품목 경고 모달
  const [vagueModalOpen, setVagueModalOpen] = useState(false);
  const [vagueModalItemName, setVagueModalItemName] = useState("");
  const [vagueModalOnContinue, setVagueModalOnContinue] = useState<(() => void) | null>(null);

  // Step 3: 작업 환경
  const [hasElevator, setHasElevator] = useState<boolean | null>(null);
  const [hasParking, setHasParking] = useState<boolean | null>(null);
  const [hasGroundAccess, setHasGroundAccess] = useState<boolean | null>(null);

  // Step 4: 사다리차
  const [needLadder, setNeedLadder] = useState(false);
  const [ladderType, setLadderType] = useState("10층 미만");
  const [ladderHours, setLadderHours] = useState(0);

  // Step 5: 견적
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);
  const [editingMemo, setEditingMemo] = useState(false);

  // Step 5: 약관 동의
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [agreedToMarketing, setAgreedToMarketing] = useState(false);
  const [agreedToNightNotification, setAgreedToNightNotification] = useState(false);
  const [consentModal, setConsentModal] = useState<{ title: string; body: string } | null>(null);

  // localStorage 복원 (마운트 시 1회) — 수정 모드가 아닐 때만
  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    if (editId) { setDraftLoaded(true); return; } // 수정 모드면 draft 무시
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
      if (d.hasGroundAccess !== undefined) setHasGroundAccess(d.hasGroundAccess);
      if (d.needLadder !== undefined) setNeedLadder(d.needLadder);
      if (d.ladderType) setLadderType(d.ladderType);
      if (d.ladderHours !== undefined) setLadderHours(d.ladderHours);
      if (typeof d.step === "number" && d.step >= 0 && d.step < STEPS.length) setStep(d.step);
    } catch { /* 파싱 실패 무시 */ }
    setDraftLoaded(true);
  }, [editId]);

  // 수정 모드: 기존 예약 데이터 로드
  useEffect(() => {
    if (!editId) return;
    setEditLoading(true);
    const token = (() => { try { return localStorage.getItem("covering_spot_booking_token"); } catch { return null; } })();
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
    fetch(`/api/bookings/${editId}?_=1${tokenParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.booking) { alert("예약을 찾을 수 없습니다"); router.push("/booking/manage"); return; }
        const b = data.booking;
        setEditMode(true);
        setCustomerName(b.customerName || "");
        setPhone(b.phone || "");
        setAddress(b.address || "");
        setAddressDetail(b.addressDetail || "");
        setMemo(b.memo || "");
        setSelectedDate(b.date || "");
        setSelectedTime(b.timeSlot || "");
        setSelectedArea(b.area || "");
        if (b.items?.length) setSelectedItems(b.items);
        if (b.hasElevator != null) setHasElevator(b.hasElevator);
        if (b.hasParking != null) setHasParking(b.hasParking);
        if (b.hasGroundAccess != null) setHasGroundAccess(b.hasGroundAccess);
        if (b.needLadder != null) setNeedLadder(b.needLadder);
        if (b.ladderType) setLadderType(b.ladderType);
        setStep(0);
      })
      .catch(() => { alert("데이터 로드 실패"); router.push("/booking/manage"); })
      .finally(() => setEditLoading(false));
  }, [editId, router]);

  // localStorage 저장 (debounce 500ms) — 수정 모드에서는 저장하지 않음
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!draftLoaded || editMode) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem("covering_spot_booking_draft", JSON.stringify({
          customerName, phone, address, addressDetail, memo,
          selectedDate, selectedTime, selectedArea, selectedItems,
          hasElevator, hasParking, hasGroundAccess, needLadder, ladderType, ladderHours, step,
        }));
      } catch { /* quota 초과 무시 */ }
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [draftLoaded, customerName, phone, address, addressDetail, memo, selectedDate, selectedTime, selectedArea, selectedItems, hasElevator, hasParking, hasGroundAccess, needLadder, ladderType, ladderHours, step]);

  // 스텝 변경 트래킹
  const prevStepRef = useRef(step);
  useEffect(() => {
    if (step !== prevStepRef.current) {
      track("[CLICK] SpotBookingScreen_nextStep", { step: prevStepRef.current, stepName: STEPS[prevStepRef.current] });
      prevStepRef.current = step;
    }
  }, [step]);

  // 데이터 로드
  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  // 날짜 변경 시 시간 선택 초기화 + 슬롯 카운트를 미로드 상태로 리셋
  useEffect(() => {
    setSelectedTime("");
    setTimeSlotCounts({
      "10:00": -1, "12:00": -1, "14:00": -1, "16:00": -1,
    });
  }, [selectedDate]);

  // 날짜 선택 시 슬롯 가용성 조회 (선택된 품목의 총 적재량도 함께 전달)
  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    const totalLoadingCube = selectedItems.reduce(
      (sum, item) => sum + (item.loadingCube ?? 0) * item.quantity,
      0,
    );
    const cubeParam = totalLoadingCube > 0 ? `&loadingCube=${totalLoadingCube}` : "";
    fetch(`/api/slots?date=${selectedDate}${cubeParam}`)
      .then((r) => r.json())
      .then((data) => {
        const slots = data.slots || [];
        const counts: Record<string, number> = {};
        for (const s of slots) {
          counts[s.time] = s.available ? 1 : 0;
        }
        setTimeSlotCounts(counts);
      })
      .catch(() => {})
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, selectedItems]);

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
      track("[CLICK] SpotBookingScreen_uploadPhoto", { count: result.length });
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
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
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
          track("[VIEW] SpotBookingScreen_quotePreview", { itemCount: selectedItems.length, total: data.estimateMin });
        }
      } catch { /* 미리보기 실패 무시 */ }
    }, QUOTE_PREVIEW_DEBOUNCE);
    return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
  }, [step, selectedItems, selectedArea, needLadder, ladderType, ladderHours]);

  // 견적 계산
  const calcQuote = useCallback(async () => {
    if (!selectedArea || selectedItems.length === 0) return;
    setQuoteError(false);
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
      if (!res.ok) { setQuoteError(true); return; }
      const data = await res.json();
      setQuote(data);
    } catch {
      setQuoteError(true);
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
          hasGroundAccess,
          needLadder,
        }),
      }).catch(() => {
        /* 리드 저장 실패는 무시 */
      });
    }
  }, [step, leadSaved, customerName, phone, address, addressDetail, memo, selectedDate, selectedTime, selectedArea, selectedItems, hasElevator, hasParking, hasGroundAccess, needLadder]);

  // 품목 수량 변경
  function updateItemQty(
    cat: string,
    name: string,
    displayName: string,
    price: number,
    delta: number,
  ) {
    if (delta > 0) {
      track("[CLICK] SpotBookingScreen_selectItem", { category: cat, name, price });
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
        const spotCat = categories.find((c) => c.name === cat);
        const spotItem = spotCat?.items.find((i) => i.name === name);
        const loadingCube = spotItem?.loadingCube ?? 0;
        return [...prev, { category: cat, name, displayName, price, quantity: 1, loadingCube }];
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

  // 수거 신청 확정 (신규 / 수정)
  async function handleSubmit() {
    if (!quote) return;
    track(editMode ? "[CLICK] SpotBookingEditScreen_submit" : "[CLICK] SpotBookingScreen_submit", { itemCount: selectedItems.length, estimatedTotal: quote.estimateMin });
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
        if (!uploadRes.ok) {
          alert("사진 업로드에 실패했습니다. 다시 시도해주세요.");
          setLoading(false);
          return;
        }
        const uploadData = await uploadRes.json();
        photoUrls = uploadData.urls || [];
      }

      const bookingData = {
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
        hasGroundAccess,
        photos: photoUrls.length > 0 ? photoUrls : undefined,
        customerName,
        phone,
        address,
        addressDetail,
        memo,
        agreedToTerms,
        agreedToPrivacy,
        agreedToMarketing,
        agreedToNightNotification,
      };

      if (editMode && editId) {
        // 수정 모드: PUT — CustomerUpdateSchema.strict()에 허용된 필드만 전송
        const editData = {
          date: selectedDate,
          timeSlot: selectedTime,
          items: selectedItems,
          memo,
          photos: photoUrls.length > 0 ? photoUrls : undefined,
          address,
          addressDetail,
          needLadder,
          ladderType: needLadder ? ladderType : "",
          ladderHours: needLadder ? ladderHours : undefined,
        };
        const token = (() => { try { return localStorage.getItem("covering_spot_booking_token"); } catch { return null; } })();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["x-booking-token"] = token;
        const res = await fetch(`/api/bookings/${editId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(editData),
        });
        const data = await res.json();
        if (res.ok) {
          router.push("/booking/manage");
        } else {
          alert(data.error || "수정 실패");
        }
      } else {
        // 신규 모드: POST
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bookingData),
        });
        const data = await res.json();
        if (res.ok) {
          localStorage.removeItem("covering_spot_booking_draft");
          if (data.bookingToken) {
            localStorage.setItem("covering_spot_booking_token", data.bookingToken);
          }
          router.push(`/booking/complete?id=${data.booking.id}`);
        } else {
          alert(data.error || "신청 실패");
        }
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  // 모호한 품목 경고 핸들러
  function handleVagueItem(itemName: string, onContinue: () => void) {
    setVagueModalItemName(itemName);
    setVagueModalOnContinue(() => onContinue);
    setVagueModalOpen(true);
  }

  // 주소 검색 완료 핸들러
  function handlePostcodeComplete(selectedAddress: string, sigungu: string, sido: string) {
    setAddress(selectedAddress);
    setShowPostcode(false);
    const detected = detectAreaFromAddress(sigungu, sido);
    if (detected) {
      setSelectedArea(detected.name);
      setAreaError(false);
    } else {
      setSelectedArea("");
      setAreaError(true);
    }
  }

  // 스텝별 완료 조건
  const canNext = [
    customerName.trim().length >= 2 && phone.replace(/-/g, "").length >= 10 && address && !!selectedArea && !areaError,  // Step 0: 고객 정보 + 지역 자동감지
    selectedDate && selectedTime,                        // Step 1: 날짜/시간
    selectedItems.length > 0,                            // Step 2: 품목 (사진은 선택)
    hasElevator !== null && hasParking !== null && hasGroundAccess !== null,  // Step 3: 작업 환경
    true,                                                 // Step 4: 사다리차
    !!quote && agreedToTerms && agreedToPrivacy,          // Step 5: 견적 확인 + 필수 약관 동의
  ];

  if (editLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-text-sub">예약 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StepIndicator step={step} editMode={editMode} />

      {step === 0 && (
        <CustomerInfoStep
          customerName={customerName}
          setCustomerName={setCustomerName}
          phone={phone}
          setPhone={setPhone}
          address={address}
          addressDetail={addressDetail}
          setAddressDetail={setAddressDetail}
          memo={memo}
          setMemo={setMemo}
          selectedArea={selectedArea}
          areaError={areaError}
          onOpenPostcode={() => setShowPostcode(true)}
        />
      )}

      {step === 1 && (
        <DateTimeStep
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedTime={selectedTime}
          setSelectedTime={setSelectedTime}
          calMonth={calMonth}
          setCalMonth={setCalMonth}
          timeSlotCounts={timeSlotCounts}
          slotsLoading={slotsLoading}
        />
      )}

      {step === 2 && (
        <ItemSelectionStep
          categories={categories}
          openCat={openCat}
          setOpenCat={setOpenCat}
          selectedItems={selectedItems}
          updateItemQty={updateItemQty}
          getItemQty={getItemQty}
          itemSearch={itemSearch}
          setItemSearch={setItemSearch}
          customItemName={customItemName}
          setCustomItemName={setCustomItemName}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          photos={photos}
          photoPreviews={photoPreviews}
          fileInputRef={fileInputRef}
          handlePhotoChange={handlePhotoChange}
          removePhoto={removePhoto}
          previewQuote={previewQuote}
          onVagueItem={handleVagueItem}
        />
      )}

      {step === 3 && (
        <WorkEnvironmentStep
          hasElevator={hasElevator}
          setHasElevator={setHasElevator}
          hasParking={hasParking}
          setHasParking={setHasParking}
          hasGroundAccess={hasGroundAccess}
          setHasGroundAccess={setHasGroundAccess}
        />
      )}

      {step === 4 && (
        <LadderStep
          needLadder={needLadder}
          setNeedLadder={setNeedLadder}
          ladderType={ladderType}
          setLadderType={setLadderType}
        />
      )}

      {step === 5 && (
        <QuoteConfirmStep
          customerName={customerName}
          phone={phone}
          address={address}
          addressDetail={addressDetail}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          selectedArea={selectedArea}
          selectedItems={selectedItems}
          hasElevator={hasElevator}
          hasParking={hasParking}
          hasGroundAccess={hasGroundAccess}
          needLadder={needLadder}
          ladderType={ladderType}
          photos={photos}
          memo={memo}
          setMemo={setMemo}
          editingMemo={editingMemo}
          setEditingMemo={setEditingMemo}
          quote={quote}
          quoteError={quoteError}
          calcQuote={calcQuote}
          agreedToTerms={agreedToTerms}
          setAgreedToTerms={setAgreedToTerms}
          agreedToPrivacy={agreedToPrivacy}
          setAgreedToPrivacy={setAgreedToPrivacy}
          agreedToMarketing={agreedToMarketing}
          setAgreedToMarketing={setAgreedToMarketing}
          agreedToNightNotification={agreedToNightNotification}
          setAgreedToNightNotification={setAgreedToNightNotification}
          consentModal={consentModal}
          setConsentModal={setConsentModal}
        />
      )}

      <NavigationButtons
        step={step}
        setStep={setStep}
        canNext={canNext}
        loading={loading}
        editMode={editMode}
        selectedItems={selectedItems}
        onVagueItem={handleVagueItem}
        onSubmit={handleSubmit}
      />

      <VagueItemModal
        open={vagueModalOpen}
        itemName={vagueModalItemName}
        onClose={() => setVagueModalOpen(false)}
        onContinue={vagueModalOnContinue}
      />

      <PostcodeModal
        open={showPostcode}
        onClose={() => setShowPostcode(false)}
        onComplete={handlePostcodeComplete}
      />
    </div>
  );
}

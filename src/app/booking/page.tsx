"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { formatPhoneNumber, formatPrice, formatManWon } from "@/lib/format";

const STEPS = ["고객 정보", "날짜/시간", "품목/사진", "작업 환경", "사다리차", "견적 확인"];
const VAGUE_ITEM_KEYWORDS = ["잡동사니", "쓰레기", "박스들", "박스류", "물건들", "짐", "기타등등", "여러가지", "잡것", "잡아이"];

const CONSENT_CONTENTS: Record<string, { title: string; body: string }> = {
  terms: {
    title: "서비스 이용약관",
    body: `커버링 방문수거 서비스 이용약관

제1조 (목적)
본 약관은 커버링(이하 "회사")이 제공하는 방문수거 서비스의 이용에 관한 조건 및 절차를 규정합니다.

제2조 (서비스 내용)
회사는 고객이 신청한 대형폐기물 등 방문수거 서비스를 제공합니다. 수거 신청 후 매니저가 일정 및 견적을 확정하며, 방문 후 실제 작업량에 따라 최종 요금이 변동될 수 있습니다.

제3조 (예약 및 취소)
• 수거일 전날 낮 12시 이전까지 취소 가능합니다.
• 이후 취소 또는 당일 취소 시 취소 수수료가 발생할 수 있습니다.
• 기상 악화, 교통 상황 등 불가피한 사유로 수거 일정이 변경될 수 있으며, 이 경우 사전에 안내드립니다.

제4조 (요금)
• 견적은 신청 품목 기준 예상 금액이며, 실제 수거 시 추가 품목 발생 시 요금이 변동됩니다.
• 최종 요금은 작업 완료 후 확정되어 안내됩니다.

제5조 (면책)
고객이 제공한 정보(주소, 품목 등)가 부정확하여 발생한 불이익에 대해 회사는 책임을 지지 않습니다.`,
  },
  privacy: {
    title: "개인정보 수집·이용 동의",
    body: `개인정보 수집·이용 동의

수집 항목
• 이름, 연락처(휴대폰 번호), 주소(수거지)

수집·이용 목적
• 방문수거 서비스 예약 접수 및 확인
• 수거 일정·견적 안내 (문자, 전화)
• 서비스 완료 후 결제 안내

보유 및 이용 기간
• 서비스 완료일로부터 3년
• 단, 관계 법령에서 보관 의무를 규정한 경우 해당 기간까지 보관

동의 거부 권리
고객은 개인정보 수집·이용에 동의하지 않을 권리가 있습니다. 다만, 동의 거부 시 방문수거 서비스 이용이 불가합니다.`,
  },
  marketing: {
    title: "마케팅 정보 수신 동의",
    body: `마케팅 정보 수신 동의 (선택)

수신 내용
• 커버링의 신규 서비스 출시, 이벤트, 할인 혜택 안내
• 방문수거 관련 유용한 정보 및 팁

수신 방법
• 문자 메시지(SMS/카카오 알림톡)

수신 거부
• 동의 후에도 언제든지 수신 거부 가능합니다.
• 수신 거부 방법: 문자 내 수신거부 번호 회신 또는 고객센터 문의

본 동의는 선택 사항으로, 동의하지 않아도 방문수거 서비스 이용에는 지장이 없습니다.`,
  },
  night: {
    title: "야간 수신 동의 (21:00~익일 08:00)",
    body: `야간 수신 동의 (선택)

수신 시간대
• 야간: 21:00 ~ 익일 08:00

수신 내용
• 수거 예약 확인 및 일정 변경 알림
• 수거 완료 안내
• 기타 서비스 관련 중요 알림

안내 사항
• 야간 수신에 동의하지 않으면 해당 시간대 알림은 발송되지 않습니다.
• 단, 긴급한 수거 일정 변경 등의 경우 주간(08:00~21:00)에 별도 연락드릴 수 있습니다.

본 동의는 선택 사항으로, 동의하지 않아도 방문수거 서비스 이용에는 지장이 없습니다.`,
  },
};
const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const TIME_OPTIONS = ["10:00", "12:00", "14:00", "16:00"];
const TIME_LABELS: Record<string, string> = {
  "10:00": "오전 10~12시",
  "12:00": "오후 12~14시",
  "14:00": "오후 14~16시",
  "16:00": "오후 16~18시",
};
// 견적 미리보기 debounce용
const QUOTE_PREVIEW_DEBOUNCE = 800;

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

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

  // 스텝별 완료 조건
  const canNext = [
    customerName.trim().length >= 2 && phone.replace(/-/g, "").length >= 10 && address && !!selectedArea && !areaError,  // Step 0: 고객 정보 + 지역 자동감지
    selectedDate && selectedTime,                        // Step 1: 날짜/시간
    selectedItems.length > 0,                            // Step 2: 품목 (사진은 선택)
    hasElevator !== null && hasParking !== null && hasGroundAccess !== null,  // Step 3: 작업 환경
    true,                                                 // Step 4: 사다리차
    !!quote && agreedToTerms && agreedToPrivacy,          // Step 5: 견적 확인 + 필수 약관 동의
  ];

  const earliestBookable = getEarliestBookableDate();

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
        {editMode && step === 0 && (
          <p className="text-xs font-semibold text-semantic-orange mb-1">신청 수정</p>
        )}
        <h2 className="text-2xl font-bold tracking-[-0.5px]">
          {STEPS[step]}
        </h2>
      </div>

      {/* Step 0: 고객 정보 */}
      {step === 0 && (
        <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5 space-y-4">
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
              className={`w-full h-12 px-4 rounded-md border border-border text-base text-left transition-all duration-200 hover:border-brand-300 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none ${
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
          <div className="bg-primary-tint/30 rounded-md px-4 py-3 border border-primary/20">
            <p className="text-sm text-primary font-medium">
              수거 희망일 전날 낮 12시까지 신청 가능합니다
            </p>
          </div>
          {/* 달력 */}
          <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() =>
                  setCalMonth((p) => {
                    const d = new Date(p.year, p.month - 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })
                }
                className="p-2 hover:bg-bg-warm rounded-sm"
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
                className="p-2 hover:bg-bg-warm rounded-sm"
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
                    className={`py-3 min-h-[44px] rounded-md text-sm transition-all duration-200 ${
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
            <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5">
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
                <div className="grid grid-cols-3 max-sm:grid-cols-2 gap-3">
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
                        className={`py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                          isFull
                            ? "bg-fill-tint text-text-muted cursor-not-allowed"
                            : opt === selectedTime
                              ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                              : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
                        }`}
                      >
                        {TIME_LABELS[opt] || opt}
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
                    setVagueModalItemName(trimmed);
                    setVagueModalOnContinue(() => () => {
                      updateItemQty("직접입력", trimmed, trimmed, 0, 1);
                      setCustomItemName("");
                    });
                    setVagueModalOpen(true);
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
      )}

      {/* Step 3: 작업 환경 */}
      {step === 3 && (
        <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5 space-y-8">
          <p className="text-sm text-text-sub">작업 환경을 알려주세요</p>
          <div>
            <p className="font-semibold mb-4">엘리베이터</p>
            <div className="flex gap-3">
              <button
                onClick={() => setHasElevator(true)}
                className={`flex-1 py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                  hasElevator === true
                    ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                    : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
                }`}
              >
                사용 가능
              </button>
              <button
                onClick={() => setHasElevator(false)}
                className={`flex-1 py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
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
                className={`flex-1 py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                  hasParking === true
                    ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                    : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
                }`}
              >
                가능
              </button>
              <button
                onClick={() => setHasParking(false)}
                className={`flex-1 py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                  hasParking === false
                    ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                    : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
                }`}
              >
                불가능
              </button>
            </div>
          </div>
          <div>
            <p className="font-semibold mb-4">지상 출입 가능</p>
            <div className="flex gap-3">
              <button
                onClick={() => setHasGroundAccess(true)}
                className={`flex-1 py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                  hasGroundAccess === true
                    ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                    : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
                }`}
              >
                가능
              </button>
              <button
                onClick={() => setHasGroundAccess(false)}
                className={`flex-1 py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                  hasGroundAccess === false
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
        <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5 space-y-5">
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
                      className={`flex-1 py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
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
              <p className="text-xs text-text-muted mt-2">
                사다리차 소요시간은 품목에 따라 매니저가 확정합니다
              </p>
            </>
          )}
        </div>
      )}

      {/* Step 5: 견적 확인 + 예약 확정 */}
      {step === 5 && (
        <div className="space-y-4">
          {/* 수거 신청 요약 */}
          <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5">
            <h3 className="font-semibold text-base mb-5">수거 신청내용을 확인해주세요</h3>

            {/* 고객 정보 */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-sub shrink-0 w-20">고객명</span>
                <span className="font-medium">{customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub shrink-0 w-20">연락처</span>
                <span className="font-medium">{phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub shrink-0 w-20">주소</span>
                <span className="font-medium text-right max-w-[65%] break-words [overflow-wrap:anywhere]">
                  {address} {addressDetail}
                </span>
              </div>
            </div>

            {/* 수거 일정 */}
            <div className="border-t border-border-light mt-4 pt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-sub shrink-0 w-20">날짜</span>
                <span className="font-medium">{selectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub shrink-0 w-20">시간대</span>
                <span className="font-medium">{TIME_LABELS[selectedTime] || selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub shrink-0 w-20">지역</span>
                <span className="font-medium">{selectedArea}</span>
              </div>
            </div>

            {/* 품목 */}
            <div className="border-t border-border-light mt-4 pt-4">
              <span className="text-text-sub text-xs font-medium">품목 ({selectedItems.length}종)</span>
              <div className="mt-2 space-y-2">
                {selectedItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-bg-warm/50 rounded-md px-3 py-2.5">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-text-primary">
                        {item.category} - {item.name}
                      </span>
                      <span className="text-text-muted text-xs ml-1.5">x{item.quantity}</span>
                    </div>
                    <span className="text-sm font-semibold text-text-primary shrink-0 ml-3">
                      {item.price === 0 ? "가격 미정" : `${formatPrice(item.price * item.quantity)}원`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 작업 환경 */}
            <div className="border-t border-border-light mt-4 pt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-sub shrink-0 w-20">엘리베이터</span>
                <span className="font-medium">{hasElevator ? "사용 가능" : "사용 불가"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub shrink-0 w-20">주차</span>
                <span className="font-medium">{hasParking ? "가능" : "불가능"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub shrink-0 w-20">지상 출입</span>
                <span className="font-medium">{hasGroundAccess ? "가능" : "불가"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub shrink-0 w-20">사다리차</span>
                <span className="font-medium">
                  {needLadder ? `필요 (${ladderType})` : "불필요"}
                </span>
              </div>
              {photos.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-sub shrink-0 w-20">첨부 사진</span>
                  <span className="font-medium">{photos.length}장</span>
                </div>
              )}
            </div>

            {/* 요청사항 */}
            <div className="border-t border-border-light mt-4 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-text-sub text-sm">요청사항</span>
                <button
                  type="button"
                  onClick={() => setEditingMemo(!editingMemo)}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  {editingMemo ? "완료" : "수정"}
                </button>
              </div>
              {editingMemo ? (
                <div className="mt-2">
                  <TextArea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    rows={3}
                    maxLength={200}
                    placeholder="요청사항을 입력하세요 (선택)"
                  />
                </div>
              ) : (
                <p className="text-sm text-text-primary mt-1.5 whitespace-pre-wrap break-words">
                  {memo || "없음"}
                </p>
              )}
            </div>
          </div>

          {/* 견적 상세 */}
          {quote ? (
            <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5">
              <h3 className="font-semibold mb-3">견적 금액</h3>
              <div className="space-y-2 text-sm">
                {quote.breakdown.map((b, i) => {
                  // displayName에서 category - name 부분만 추출 (크기/무게/가격 제거)
                  const parts = b.name.split(" - ");
                  const shortName = parts.length >= 2 ? `${parts[0]} - ${parts[1]}` : b.name;
                  return (
                    <div key={i} className="flex justify-between">
                      <span className="text-text-sub">
                        {shortName} <span className="text-text-muted">x{b.quantity}</span>
                      </span>
                      <span className="font-medium">
                        {b.unitPrice === 0 ? "가격 미정" : `${formatPrice(b.subtotal)}원`}
                      </span>
                    </div>
                  );
                })}
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
                    <span className="text-text-sub">사다리차 (기본요금)</span>
                    <span className="font-medium">
                      {formatPrice(quote.ladderPrice)}원
                    </span>
                  </div>
                )}
                <div className="border-t-2 border-primary/20 pt-4 mt-3">
                  <div className="flex justify-between text-xl max-sm:text-lg font-extrabold text-primary">
                    <span>예상 견적</span>
                    <span>
                      {formatManWon(quote.estimateMin)} ~ {formatManWon(quote.estimateMax)}원
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-2">
                    수거 신청 후 즉시 매니저가 확인하여 일정과 견적을 확정합니다
                  </p>
                </div>
              </div>
            </div>
          ) : quoteError ? (
            <div className="bg-bg rounded-lg shadow-sm border border-border-light p-8 flex flex-col items-center gap-3">
              <p className="text-semantic-red text-sm font-medium">견적 계산에 실패했습니다</p>
              <button
                type="button"
                onClick={() => calcQuote()}
                className="text-primary text-sm font-medium hover:underline"
              >
                다시 시도하기
              </button>
            </div>
          ) : (
            <div className="bg-bg rounded-lg shadow-sm border border-border-light p-8 flex flex-col items-center">
              <LoadingSpinner size="lg" />
              <p className="text-text-muted mt-4 text-sm">견적을 계산하고 있습니다...</p>
            </div>
          )}

          {/* 약관 동의 */}
          {(() => {
            const allChecked = agreedToTerms && agreedToPrivacy && agreedToMarketing && agreedToNightNotification;
            const anyChecked = agreedToTerms || agreedToPrivacy || agreedToMarketing || agreedToNightNotification;
            const consentItems = [
              { key: "terms",    label: "서비스 이용약관",               required: true,  checked: agreedToTerms,              setter: setAgreedToTerms },
              { key: "privacy",  label: "개인정보 수집·이용",            required: true,  checked: agreedToPrivacy,            setter: setAgreedToPrivacy },
              { key: "marketing",label: "마케팅 정보 수신",              required: false, checked: agreedToMarketing,          setter: setAgreedToMarketing },
              { key: "night",    label: "야간 수신 (21:00~익일 08:00)", required: false, checked: agreedToNightNotification,  setter: setAgreedToNightNotification },
            ];
            return (
              <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5 space-y-4">
                <h3 className="font-semibold">약관 동의</h3>
                {/* 전체 동의 */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !allChecked;
                    setAgreedToTerms(next);
                    setAgreedToPrivacy(next);
                    setAgreedToMarketing(next);
                    setAgreedToNightNotification(next);
                  }}
                  className="w-full flex items-center gap-3 py-3 px-4 rounded-md bg-bg-warm hover:bg-primary-bg transition-colors text-left"
                >
                  <div className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-all ${
                    allChecked || anyChecked ? "bg-brand-400 border-brand-400" : "border-border-strong"
                  }`}>
                    {allChecked && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2 6 5 9 10 3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                    {!allChecked && anyChecked && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 6H9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    )}
                  </div>
                  <span className="font-semibold text-sm">모두 동의하기</span>
                </button>

                <div className="border-t border-border-light" />

                {/* 개별 항목 */}
                <div className="space-y-3">
                  {consentItems.map(({ key, label, required, checked, setter }) => (
                    <div key={key} className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setter(!checked)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <div className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-all ${
                          checked ? "bg-brand-400 border-brand-400" : "border-border-strong"
                        }`}>
                          {checked && (
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2 6 5 9 10 3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          )}
                        </div>
                        <span className="text-sm">
                          <span className={`text-xs font-semibold mr-1 ${required ? "text-semantic-red" : "text-text-muted"}`}>
                            {required ? "(필수)" : "(선택)"}
                          </span>
                          {label}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConsentModal(CONSENT_CONTENTS[key])}
                        className="text-xs text-text-muted shrink-0 ml-3 hover:text-primary transition-colors"
                      >
                        내용보기
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
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
            onClick={() => {
              if (step === 2) {
                const vagueItem = selectedItems.find((item) =>
                  item.category === "직접입력" &&
                  VAGUE_ITEM_KEYWORDS.some((kw) => item.name.includes(kw))
                );
                if (vagueItem) {
                  setVagueModalItemName(vagueItem.name);
                  setVagueModalOnContinue(() => () => setStep(step + 1));
                  setVagueModalOpen(true);
                  return;
                }
              }
              setStep(step + 1);
            }}
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
            {loading ? "" : editMode ? "수정 완료" : "최종 견적 요청하기"}
          </Button>
        )}
      </div>

      {/* 약관 내용 모달 */}
      {consentModal && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim p-4"
          role="dialog"
          aria-modal="true"
          aria-label={consentModal.title}
          onKeyDown={(e) => { if (e.key === "Escape") setConsentModal(null); }}
        >
          <div className="bg-white rounded-lg overflow-hidden w-full max-w-[28rem] max-h-[80vh] flex flex-col">
            <ModalHeader title={consentModal.title} onClose={() => setConsentModal(null)} />
            <div className="p-6 overflow-y-auto">
              <pre className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap font-sans">
                {consentModal.body}
              </pre>
            </div>
            <div className="p-4 border-t border-border-light">
              <Button variant="primary" size="md" fullWidth onClick={() => setConsentModal(null)}>
                확인
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 모호한 품목 경고 모달 */}
      {vagueModalOpen && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim p-4"
          role="dialog"
          aria-modal="true"
          aria-label="품목 입력 안내"
          onKeyDown={(e) => { if (e.key === "Escape") setVagueModalOpen(false); }}
        >
          <div className="bg-white rounded-lg overflow-hidden w-full max-w-[28rem]">
            <ModalHeader
              title="품목을 구체적으로 입력해주세요"
              onClose={() => setVagueModalOpen(false)}
            />
            <div className="p-6 space-y-4">
              <p className="text-sm text-text-primary leading-relaxed">
                &apos;{vagueModalItemName}&apos;처럼 뭉뚱그린 품목은 실제 수거 시 시간이 크게 늘어날 수 있습니다.
              </p>
              <p className="text-sm text-text-sub leading-relaxed">
                예시: 소파 1개, 장롱 2자 1개, 박스 10개 등 구체적으로 입력해주세요.
              </p>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={() => setVagueModalOpen(false)}
                >
                  다시 입력하기
                </Button>
                <Button
                  variant="tertiary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    setVagueModalOpen(false);
                    if (vagueModalOnContinue) vagueModalOnContinue();
                  }}
                >
                  이대로 진행
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 주소 검색 팝업 */}
      {showPostcode && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim p-4"
          role="dialog"
          aria-modal="true"
          aria-label="주소 검색"
          onKeyDown={(e) => { if (e.key === "Escape") setShowPostcode(false); }}
        >
          <div className="bg-white rounded-lg overflow-hidden w-full max-w-[28rem]">
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

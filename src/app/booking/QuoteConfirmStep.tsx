"use client";

import type { BookingItem, QuoteResult } from "@/types/booking";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { formatPrice, formatManWon } from "@/lib/format";
import { TIME_LABELS, CONSENT_CONTENTS } from "./booking-constants";

interface QuoteConfirmStepProps {
  customerName: string;
  phone: string;
  address: string;
  addressDetail: string;
  selectedDate: string;
  selectedTime: string;
  selectedArea: string;
  selectedItems: BookingItem[];
  hasElevator: boolean | null;
  hasParking: boolean | null;
  hasGroundAccess: boolean | null;
  needLadder: boolean;
  ladderType: string;
  photos: File[];
  memo: string;
  setMemo: (v: string) => void;
  editingMemo: boolean;
  setEditingMemo: (v: boolean) => void;
  quote: QuoteResult | null;
  quoteError: boolean;
  calcQuote: () => void;
  agreedToTerms: boolean;
  setAgreedToTerms: (v: boolean) => void;
  agreedToPrivacy: boolean;
  setAgreedToPrivacy: (v: boolean) => void;
  agreedToMarketing: boolean;
  setAgreedToMarketing: (v: boolean) => void;
  agreedToNightNotification: boolean;
  setAgreedToNightNotification: (v: boolean) => void;
  consentModal: { title: string; body: string } | null;
  setConsentModal: (v: { title: string; body: string } | null) => void;
}

export function QuoteConfirmStep({
  customerName,
  phone,
  address,
  addressDetail,
  selectedDate,
  selectedTime,
  selectedArea,
  selectedItems,
  hasElevator,
  hasParking,
  hasGroundAccess,
  needLadder,
  ladderType,
  photos,
  memo,
  setMemo,
  editingMemo,
  setEditingMemo,
  quote,
  quoteError,
  calcQuote,
  agreedToTerms,
  setAgreedToTerms,
  agreedToPrivacy,
  setAgreedToPrivacy,
  agreedToMarketing,
  setAgreedToMarketing,
  agreedToNightNotification,
  setAgreedToNightNotification,
  consentModal,
  setConsentModal,
}: QuoteConfirmStepProps) {
  const allChecked = agreedToTerms && agreedToPrivacy && agreedToMarketing && agreedToNightNotification;
  const anyChecked = agreedToTerms || agreedToPrivacy || agreedToMarketing || agreedToNightNotification;
  const consentItems = [
    { key: "terms",    label: "서비스 이용약관",               required: true,  checked: agreedToTerms,              setter: setAgreedToTerms },
    { key: "privacy",  label: "개인정보 수집·이용",            required: true,  checked: agreedToPrivacy,            setter: setAgreedToPrivacy },
    { key: "marketing",label: "마케팅 정보 수신",              required: false, checked: agreedToMarketing,          setter: setAgreedToMarketing },
    { key: "night",    label: "야간 수신 (21:00~익일 08:00)", required: false, checked: agreedToNightNotification,  setter: setAgreedToNightNotification },
  ];

  return (
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
    </div>
  );
}

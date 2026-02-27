"use client";

import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { formatPhoneNumber } from "@/lib/format";

interface CustomerInfoStepProps {
  customerName: string;
  setCustomerName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  address: string;
  addressDetail: string;
  setAddressDetail: (v: string) => void;
  memo: string;
  setMemo: (v: string) => void;
  selectedArea: string;
  areaError: boolean;
  onOpenPostcode: () => void;
}

export function CustomerInfoStep({
  customerName,
  setCustomerName,
  phone,
  setPhone,
  address,
  addressDetail,
  setAddressDetail,
  memo,
  setMemo,
  selectedArea,
  areaError,
  onOpenPostcode,
}: CustomerInfoStepProps) {
  return (
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
          onClick={onOpenPostcode}
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
  );
}

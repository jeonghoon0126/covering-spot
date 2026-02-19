"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";

const SOURCE_OPTIONS = ["카카오톡 상담", "전화 상담", "기타"];

const TIME_SLOTS = Array.from({ length: 10 }, (_, i) => {
  const hour = i + 9;
  return `${String(hour).padStart(2, "0")}:00`;
});

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatPrice(value: string): string {
  const num = value.replace(/\D/g, "");
  if (!num) return "";
  return Number(num).toLocaleString("ko-KR");
}

interface FormData {
  customerName: string;
  phone: string;
  address: string;
  addressDetail: string;
  itemsDescription: string;
  estimatedPrice: string;
  date: string;
  timeSlot: string;
  memo: string;
  source: string;
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
    itemsDescription: "",
    estimatedPrice: "",
    date: "",
    timeSlot: "",
    memo: "",
    source: "카카오톡 상담",
  });

  useEffect(() => {
    const t = sessionStorage.getItem("admin_token");
    if (!t) {
      sessionStorage.setItem("admin_return_url", window.location.pathname);
      router.push("/admin");
      return;
    }
    setToken(t);
  }, [router]);

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

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
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const priceNum = Number(form.estimatedPrice.replace(/\D/g, "")) || 0;

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
          itemsDescription: form.itemsDescription.trim(),
          estimatedPrice: priceNum,
          date: form.date,
          timeSlot: form.timeSlot,
          memo: form.memo.trim(),
          source: form.source,
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
            <TextField
              label="주소"
              required
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="서울시 강남구 테헤란로 123"
              error={!!errors.address}
              helperText={errors.address}
            />
            <TextField
              label="상세주소"
              value={form.addressDetail}
              onChange={(e) => updateField("addressDetail", e.target.value)}
              placeholder="101동 1001호 (선택)"
            />
          </div>
        </div>

        {/* 수거 정보 */}
        <div className="bg-bg rounded-lg p-5 border border-border-light">
          <h3 className="text-sm font-semibold text-text-sub mb-4">수거 정보</h3>
          <div className="space-y-4">
            <TextArea
              label="품목 및 수량"
              value={form.itemsDescription}
              onChange={(e) => updateField("itemsDescription", e.target.value)}
              placeholder={"카카오톡 상담 내용을 자유롭게 입력\n예: 소파 1개, 장롱 2개, 에어컨 실외기 1대"}
              rows={4}
            />

            <div className="flex flex-col">
              <label className="mb-2 text-sm font-semibold leading-[22px] text-text-primary">
                예상 견적 (원)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.estimatedPrice ? formatPrice(form.estimatedPrice) : ""}
                  onChange={(e) => updateField("estimatedPrice", e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="w-full h-12 rounded-md px-4 pr-10 text-base leading-6 outline-none transition-all duration-200 placeholder:text-text-muted border border-border bg-white text-text-primary focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-sub">원</span>
              </div>
            </div>

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
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 메모 + 출처 */}
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
                접수 출처
              </label>
              <select
                value={form.source}
                onChange={(e) => updateField("source", e.target.value)}
                className="w-full h-12 rounded-md px-4 text-base leading-6 outline-none transition-all duration-200 border border-border bg-white text-text-primary focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
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
    </div>
  );
}

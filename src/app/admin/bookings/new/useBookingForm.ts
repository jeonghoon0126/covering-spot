"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { detectAreaFromAddress } from "@/data/spot-areas";
import { safeSessionSet, safeLocalGet, safeLocalRemove } from "@/lib/storage";
import type { BookingItem } from "@/types/booking";

export interface FormData {
  customerName: string;
  phone: string;
  address: string;
  addressDetail: string;
  area: string;
  date: string;
  timeSlot: string;
  memo: string;
  adminMemo: string;
  source: string;
  hasGroundAccess: boolean;
  hasElevator: boolean;
  hasParking: boolean;
  needLadder: boolean;
  ladderType: string;
  ladderHours: number;
}

export interface FormErrors {
  customerName?: string;
  phone?: string;
  address?: string;
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

interface UseBookingFormReturn {
  token: string;
  submitting: boolean;
  errors: FormErrors;
  form: FormData;
  showPostcode: boolean;
  setShowPostcode: (v: boolean) => void;
  updateField: (field: keyof FormData, value: string) => void;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  handleSubmit: (
    e: React.FormEvent,
    selectedItems: BookingItem[],
    itemsTotal: number,
    priceOverride: string,
  ) => Promise<void>;
  handlePostcodeComplete: (data: { roadAddress: string; jibunAddress: string; sigungu: string; sido: string }) => void;
}

export function useBookingForm(): UseBookingFormReturn {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPostcode, setShowPostcode] = useState(false);

  const [form, setForm] = useState<FormData>({
    customerName: "",
    phone: "",
    address: "",
    addressDetail: "",
    area: "",
    date: "",
    timeSlot: "",
    memo: "",
    adminMemo: "",
    source: "카카오톡 상담",
    hasGroundAccess: false,
    hasElevator: false,
    hasParking: false,
    needLadder: false,
    ladderType: "",
    ladderHours: 0,
  });

  useEffect(() => {
    const t = safeLocalGet("admin_token");
    if (!t) {
      safeSessionSet("admin_return_url", window.location.pathname);
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

  function validate(selectedItems: BookingItem[]): boolean {
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

  async function handleSubmit(
    e: React.FormEvent,
    selectedItems: BookingItem[],
    itemsTotal: number,
    priceOverride: string,
  ) {
    e.preventDefault();
    if (!validate(selectedItems)) return;

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
          adminMemo: form.adminMemo.trim(),
          source: form.source,
          hasGroundAccess: form.hasGroundAccess,
          hasElevator: form.hasElevator,
          hasParking: form.hasParking,
          needLadder: form.needLadder,
          ladderType: form.ladderType,
          ladderHours: form.ladderHours,
        }),
      });

      if (res.status === 401) {
        safeLocalRemove("admin_token");
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

  function handlePostcodeComplete(data: {
    roadAddress: string;
    jibunAddress: string;
    sigungu: string;
    sido: string;
  }) {
    const addr = data.roadAddress || data.jibunAddress;
    updateField("address", addr);
    setShowPostcode(false);
    const detected = detectAreaFromAddress(data.sigungu, data.sido);
    updateField("area", detected ? detected.name : "");
  }

  return {
    token,
    submitting,
    errors,
    form,
    showPostcode,
    setShowPostcode,
    updateField,
    setForm,
    handleSubmit,
    handlePostcodeComplete,
  };
}

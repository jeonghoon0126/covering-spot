"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function DriverLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 이미 로그인된 상태면 대시보드로
  useEffect(() => {
    if (sessionStorage.getItem("driver_token")) {
      router.replace("/driver/dashboard");
    }
  }, [router]);

  function formatPhoneInput(raw: string): string {
    const digits = raw.replace(/[^\d]/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhone(formatPhoneInput(e.target.value));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 10) {
      setError("전화번호를 정확히 입력해주세요");
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/driver/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (res.ok && data.token) {
        sessionStorage.setItem("driver_token", data.token);
        sessionStorage.setItem("driver_name", data.driverName || "");
        router.push("/driver/dashboard");
      } else {
        setError(data.error || "인증 실패");
        inputRef.current?.focus();
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-warm flex items-center justify-center p-4">
      <div className="w-full max-w-[22rem]">
        <div className="bg-bg rounded-2xl shadow-md border border-border-light p-8">
          {/* 로고 영역 */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 9L12 3L21 9V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9Z"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-text">커버링 방문수거</h1>
            <p className="text-sm text-text-muted mt-1">기사 전용</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-sub mb-2">
                전화번호
              </label>
              <input
                ref={inputRef}
                type="tel"
                inputMode="numeric"
                placeholder="010-0000-0000"
                value={phone}
                onChange={handlePhoneChange}
                disabled={loading}
                autoFocus
                className={`w-full px-4 py-3 rounded-lg border text-sm bg-bg
                  placeholder:text-text-muted transition-colors outline-none
                  focus:ring-2 focus:ring-primary/20 focus:border-primary
                  ${error ? "border-semantic-red" : "border-border-light"}
                  ${loading ? "opacity-50" : ""}
                `}
              />
              {error && (
                <p className="mt-2 text-xs text-semantic-red">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || phone.replace(/[^\d]/g, "").length < 10}
              className="w-full py-3 rounded-lg bg-primary text-white text-sm font-semibold
                transition-all duration-200 active:scale-[0.98]
                disabled:opacity-40 disabled:cursor-not-allowed
                shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  확인 중
                </span>
              ) : (
                "로그인"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

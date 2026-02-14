"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        sessionStorage.setItem("admin_token", data.token);
        router.push("/admin/dashboard");
      } else {
        setError(data.error || "인증 실패");
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h1 className="text-xl font-bold text-center mb-1">커버링 스팟</h1>
          <p className="text-sm text-gray-500 text-center mb-8">관리자 로그인</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-[#2563EB]"
            />
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full py-3 rounded-xl bg-[#2563EB] text-white font-semibold text-sm disabled:opacity-40"
            >
              {loading ? "..." : "로그인"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

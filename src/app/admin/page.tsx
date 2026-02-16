"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

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
    <div className="min-h-screen bg-bg-warm flex items-center justify-center p-4">
      <div className="w-full max-w-[24rem]">
        <div className="bg-bg rounded-2xl shadow-md border border-border-light p-8">
          <h1 className="text-xl font-bold text-center mb-1">커버링 스팟</h1>
          <p className="text-sm text-text-sub text-center mb-8">관리자 로그인</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <TextField
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              error={!!error}
              helperText={error || undefined}
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={loading || !password.trim()}
              loading={loading}
            >
              {loading ? "" : "로그인"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

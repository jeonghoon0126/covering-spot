"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { safeSessionGet, safeSessionSet, safeSessionRemove } from "@/lib/storage";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  const handleGoogleResponse = useCallback(
    async (credential: string) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ googleToken: credential }),
        });
        const data = await res.json();
        if (res.ok && data.token) {
          safeSessionSet("admin_token", data.token);
          if (data.admin?.name) {
            safeSessionSet("admin_name", data.admin.name);
          }
          if (data.admin?.role) {
            safeSessionSet("admin_role", data.admin.role);
          }
          const returnUrl = safeSessionGet("admin_return_url");
          safeSessionRemove("admin_return_url");
          router.push(returnUrl || "/admin/dashboard");
        } else {
          setError(data.error || "인증 실패");
        }
      } catch {
        setError("네트워크 오류");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      const google = (window as unknown as Record<string, unknown>).google as {
        accounts: {
          id: {
            initialize: (c: Record<string, unknown>) => void;
            renderButton: (el: HTMLElement, c: Record<string, unknown>) => void;
          };
        };
      } | undefined;

      if (!google) return;

      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: Record<string, string>) => {
          if (response.credential) {
            handleGoogleResponse(response.credential);
          }
        },
        hosted_domain: "covering.app",
      });

      const btnEl = document.getElementById("google-signin-btn");
      if (btnEl) {
        google.accounts.id.renderButton(btnEl, {
          type: "standard",
          theme: "outline",
          size: "large",
          width: 320,
          text: "signin_with",
        });
        setGoogleReady(true);
      }
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [handleGoogleResponse]);

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
        safeSessionSet("admin_token", data.token);
        const returnUrl = safeSessionGet("admin_return_url");
        safeSessionRemove("admin_return_url");
        router.push(returnUrl || "/admin/dashboard");
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
        <div className="bg-bg rounded-lg shadow-md border border-border-light p-8">
          <h1 className="text-xl font-bold text-center mb-1">커버링 방문수거</h1>
          <p className="text-sm text-text-sub text-center mb-8">관리자 로그인</p>

          {/* Google 로그인 */}
          {GOOGLE_CLIENT_ID && (
            <>
              <div id="google-signin-btn" className={`flex justify-center ${googleReady ? "" : "min-h-[44px]"}`} />
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border-light" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-bg px-3 text-text-muted">또는</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <TextField
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus={!GOOGLE_CLIENT_ID}
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

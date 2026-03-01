"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { safeSessionRemove, safeLocalGet, safeLocalRemove } from "@/lib/storage";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "operator";
}

export default function AdminsPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [myId, setMyId] = useState("");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const t = safeLocalGet("admin_token");
    const role = safeLocalGet("admin_role");
    if (!t || role !== "admin") {
      safeSessionRemove("admin_return_url");
      router.push("/admin/dashboard");
      return;
    }
    setToken(t);

    // JWT payload에서 sub(id) 추출
    try {
      const payload = JSON.parse(atob(t.split(".")[1]));
      setMyId(payload.sub || "");
    } catch {
      // ignore
    }
  }, [router]);

  useEffect(() => {
    if (!token) return;
    fetchAdmins();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function fetchAdmins() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/admins", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        safeLocalRemove("admin_token");
        router.push("/admin");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "목록 조회 실패");
        return;
      }
      setAdmins(data.admins || []);
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  async function toggleRole(admin: AdminUser) {
    if (admin.id === myId) return;
    const newRole = admin.role === "admin" ? "operator" : "admin";
    setUpdating(admin.id);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: admin.id, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "역할 변경 실패");
        return;
      }
      setAdmins((prev) =>
        prev.map((a) => (a.id === admin.id ? { ...a, role: newRole } : a))
      );
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="min-h-screen bg-bg-warm">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[56rem] mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="p-1.5 text-text-sub hover:text-text-primary hover:bg-fill-tint rounded-md transition-colors"
            aria-label="뒤로"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="text-sm font-bold">관리자 설정</h1>
        </div>
      </div>

      <div className="max-w-[56rem] mx-auto px-4 py-6">
        <div className="bg-bg rounded-[--radius-lg] border border-border-light shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border-light">
            <h2 className="text-sm font-bold">관리자 계정 목록</h2>
            <p className="text-xs text-text-muted mt-0.5">역할 변경은 admin 권한이 있는 계정만 가능합니다.</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-text-muted text-sm">
              불러오는 중...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-semantic-red text-sm">
              {error}
            </div>
          ) : admins.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-text-muted text-sm">
              관리자 계정이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-border-light">
              {admins.map((admin) => {
                const isSelf = admin.id === myId;
                const isAdminRole = admin.role === "admin";
                return (
                  <div key={admin.id} className="flex items-center gap-4 px-5 py-3.5">
                    {/* 아바타 */}
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {(admin.name || admin.email).charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* 정보 */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {admin.name || "이름 없음"}
                        {isSelf && (
                          <span className="ml-1.5 text-[11px] text-text-muted font-normal">(나)</span>
                        )}
                      </p>
                      <p className="text-xs text-text-muted truncate">{admin.email}</p>
                    </div>

                    {/* 역할 배지 */}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      isAdminRole
                        ? "bg-primary/10 text-primary"
                        : "bg-fill-tint text-text-sub"
                    }`}>
                      {isAdminRole ? "Admin" : "Operator"}
                    </span>

                    {/* 역할 토글 버튼 */}
                    <button
                      onClick={() => toggleRole(admin)}
                      disabled={isSelf || updating === admin.id}
                      className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors shrink-0 ${
                        isSelf
                          ? "border-border-light text-text-muted opacity-40 cursor-not-allowed"
                          : isAdminRole
                          ? "border-semantic-orange/40 text-semantic-orange hover:bg-semantic-orange/10"
                          : "border-primary/40 text-primary hover:bg-primary/10"
                      } disabled:opacity-50`}
                    >
                      {updating === admin.id
                        ? "변경 중..."
                        : isAdminRole
                        ? "Operator로 변경"
                        : "Admin으로 변경"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

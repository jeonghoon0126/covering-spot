"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminLogo } from "@/components/ui/AdminLogo";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { safeSessionGet } from "@/lib/storage";

interface Notification {
  id: string;
  bookingId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  link: string;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  new_booking: "📥",
  status_change: "🔄",
  reschedule: "📅",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const token = safeSessionGet("admin_token");
    if (!token) { router.push("/admin"); return; }
    try {
      const res = await fetch("/api/admin/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { router.push("/admin"); return; }
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  async function handleMarkAllRead() {
    const token = safeSessionGet("admin_token");
    if (!token) return;
    await fetch("/api/admin/notifications", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  function handleClick(n: Notification) {
    if (!n.isRead) {
      const token = safeSessionGet("admin_token");
      if (token) {
        fetch("/api/admin/notifications", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ id: n.id }),
        }).catch(() => {});
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      }
    }
    router.push(n.link);
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-bg-warm">
      <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[42rem] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AdminLogo />
            <h1 className="text-lg font-bold">알림</h1>
            {unreadCount > 0 && (
              <span className="text-xs font-semibold text-white bg-semantic-red rounded-full px-2 py-0.5">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-primary font-medium hover:underline"
            >
              모두 읽음
            </button>
          )}
        </div>
      </div>

      <div className="max-w-[42rem] mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-center text-text-muted py-12 text-sm">알림이 없습니다</p>
        ) : (
          <div className="space-y-1">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3.5 rounded-lg border transition-all ${
                  n.isRead
                    ? "bg-bg border-border-light"
                    : "bg-primary-bg border-primary/20 shadow-sm"
                } hover:bg-fill-tint`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-base mt-0.5">{TYPE_ICONS[n.type] || "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${n.isRead ? "text-text-sub" : "font-semibold text-text-primary"}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    {n.body && (
                      <p className="text-xs text-text-muted mt-0.5 truncate">{n.body}</p>
                    )}
                    <p className="text-[11px] text-text-muted mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import DaumPostcodeEmbed from "react-daum-postcode";
import type { UnloadingPoint } from "@/types/booking";

/* ── 타입 ── */

export interface UnloadingModalProps {
  token: string;
  points: UnloadingPoint[];
  onClose: () => void;
  onRefresh: () => void;
  onToast: (msg: string, type?: "success" | "error" | "warning") => void;
}

/* ── 하차지 관리 모달 ── */

export default function UnloadingModal({
  token,
  points,
  onClose,
  onRefresh,
  onToast,
}: UnloadingModalProps) {
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 삭제 인라인 확인 (confirm() 대체)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // 주소 검색 팝업
  const [showAddrSearch, setShowAddrSearch] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  useEffect(() => setPortalMounted(true), []);
  // 인라인 수정
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [showEditAddrSearch, setShowEditAddrSearch] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function handleUpdate(id: string) {
    if (!editName.trim() || !editAddress.trim() || updating) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/admin/unloading-points", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, name: editName.trim(), address: editAddress.trim() }),
      });
      if (res.ok) {
        // 저장 요청한 id와 현재 editingId가 같을 때만 닫음 (저장 중 다른 항목 수정 시작한 경우 보호)
        setEditingId((current) => current === id ? null : current);
        onToast("수정 완료", "success");
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        onToast(data.error || "수정 실패", "error");
      }
    } catch {
      onToast("네트워크 오류", "error");
    } finally {
      setUpdating(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim() || !newAddress.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/unloading-points", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim(), address: newAddress.trim() }),
      });
      if (res.ok) {
        setNewName("");
        setNewAddress("");
        onToast("하차지가 추가되었습니다", "success");
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        onToast(data.error || "생성 실패");
      }
    } catch {
      onToast("네트워크 오류");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteConfirmId(null);
    setDeletingId(id);
    try {
      const res = await fetch("/api/admin/unloading-points", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        onToast("삭제 완료", "success");
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        onToast(data.error || "삭제 실패");
      }
    } catch {
      onToast("네트워크 오류");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(point: UnloadingPoint) {
    try {
      const res = await fetch("/api/admin/unloading-points", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: point.id, active: !point.active }),
      });
      if (res.ok) {
        onToast(point.active ? "비활성화되었습니다" : "활성화되었습니다", "success");
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        onToast(data.error || "변경 실패");
      }
    } catch {
      onToast("네트워크 오류");
    }
  }

  return (
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-label="하차지 관리"
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] max-w-[90vw] max-h-[80vh] bg-bg rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
          <h2 className="text-base font-bold">하차지 관리</h2>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {points.length === 0 ? (
            <div className="text-center text-sm text-text-muted py-8">
              등록된 하차지가 없습니다
            </div>
          ) : (
            points.map((p) => (
              <div
                key={p.id}
                className={`p-3 rounded-lg border transition-colors ${
                  p.active ? "border-border-light bg-bg" : "border-border-light bg-bg-warm opacity-60"
                }`}
              >
                {editingId === p.id ? (
                  /* 수정 모드 */
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="하차지 이름"
                      className="w-full text-sm px-2.5 py-1.5 border border-border rounded-lg bg-bg focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditAddrSearch(true)}
                      className="w-full text-sm px-2.5 py-1.5 border border-border rounded-lg bg-bg text-left truncate"
                    >
                      {editAddress || <span className="text-text-muted">주소 검색 (클릭)</span>}
                    </button>
                    <div className="flex gap-1.5 justify-end pt-0.5">
                      <button
                        onClick={() => { setEditingId(null); setEditName(""); setEditAddress(""); }}
                        className="text-xs px-3 py-1 rounded-lg border border-border text-text-muted hover:bg-fill-tint transition-colors"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => handleUpdate(p.id)}
                        disabled={updating || !editName.trim() || !editAddress.trim()}
                        className="text-xs px-3 py-1 rounded-lg bg-primary text-white font-semibold disabled:opacity-40 hover:bg-primary-dark transition-colors"
                      >
                        {updating ? "저장 중..." : "저장"}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 표시 모드 */
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-5 h-5 flex items-center justify-center text-purple-600 flex-shrink-0">◆</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="text-xs text-text-muted truncate">{p.address}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditingId(p.id); setEditName(p.name); setEditAddress(p.address); setDeleteConfirmId(null); }}
                        disabled={updating || editingId !== null}
                        className="text-xs px-2 py-0.5 rounded bg-fill-tint text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleToggleActive(p)}
                        disabled={editingId !== null}
                        className={`text-xs px-2 py-0.5 rounded disabled:opacity-40 ${
                          p.active ? "bg-semantic-green-tint text-semantic-green" : "bg-fill-tint text-text-muted"
                        }`}
                      >
                        {p.active ? "활성" : "비활성"}
                      </button>
                      {deleteConfirmId === p.id ? (
                        <>
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={deletingId === p.id}
                            className="text-xs font-semibold text-white bg-semantic-red px-2 py-0.5 rounded transition-colors"
                          >
                            삭제
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs text-text-muted px-1 py-0.5"
                          >
                            취소
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(p.id)}
                          disabled={deletingId === p.id || editingId !== null}
                          className="text-xs text-semantic-red hover:bg-semantic-red-tint px-1.5 py-0.5 rounded transition-colors disabled:opacity-40"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 추가 폼 */}
        <div className="border-t border-border-light px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="하차지 이름"
              className="w-24 text-sm px-2 py-1.5 border border-border rounded-lg bg-bg"
            />
            <button
              type="button"
              onClick={() => setShowAddrSearch(true)}
              className="flex-1 text-sm px-2 py-1.5 border border-border rounded-lg bg-bg text-left truncate"
            >
              {newAddress || <span className="text-text-muted">주소 검색 (클릭)</span>}
            </button>
            {showAddrSearch && portalMounted && createPortal(
              <div
                className="fixed inset-0 z-[9999] bg-black/50 flex items-end sm:items-center justify-center"
                onClick={() => setShowAddrSearch(false)}
              >
                <div
                  className="bg-bg rounded-t-2xl sm:rounded-xl w-full sm:w-[400px] sm:max-w-[calc(100vw-32px)]"
                  onClick={(e) => e.stopPropagation()}
                  style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
                >
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-border-light">
                    <span className="text-sm font-semibold">주소 검색</span>
                    <button
                      onClick={() => setShowAddrSearch(false)}
                      className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-fill-tint transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                  <DaumPostcodeEmbed
                    onComplete={(data) => {
                      setNewAddress(data.roadAddress || data.jibunAddress);
                      setShowAddrSearch(false);
                    }}
                    style={{ height: 420, width: '100%', display: 'block' }}
                  />
                </div>
              </div>,
              document.body
            )}
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !newAddress.trim()}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-40 hover:bg-primary-dark transition-colors"
            >
              {creating ? "..." : "추가"}
            </button>
          </div>
        </div>
      </div>
      {/* 수정 모드 주소 검색 portal */}
      {showEditAddrSearch && portalMounted && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => setShowEditAddrSearch(false)}
        >
          <div
            className="bg-bg rounded-t-2xl sm:rounded-xl w-full sm:w-[400px] sm:max-w-[calc(100vw-32px)]"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border-light">
              <span className="text-sm font-semibold">주소 검색</span>
              <button
                onClick={() => setShowEditAddrSearch(false)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-fill-tint transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <DaumPostcodeEmbed
              onComplete={(data) => {
                setEditAddress(data.roadAddress || data.jibunAddress);
                setShowEditAddrSearch(false);
              }}
              style={{ height: 420, width: '100%', display: 'block' }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

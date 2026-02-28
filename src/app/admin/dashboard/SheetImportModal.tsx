"use client";

import type { SheetImportRow } from "./dashboard-constants";

interface SheetImportModalProps {
  show: boolean;
  sheetURL: string;
  onSheetURLChange: (value: string) => void;
  sheetStep: "input" | "preview" | "done";
  onStepChange: (step: "input" | "preview" | "done") => void;
  sheetRows: SheetImportRow[];
  sheetLoading: boolean;
  sheetResult: { succeeded: number; failed: number; skipped: number } | null;
  onPreview: () => void;
  onImport: () => void;
  onClose: () => void;
}

export function SheetImportModal({
  show,
  sheetURL,
  onSheetURLChange,
  sheetStep,
  onStepChange,
  sheetRows,
  sheetLoading,
  sheetResult,
  onPreview,
  onImport,
  onClose,
}: SheetImportModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-[42rem] bg-bg rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[90dvh]">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
          <div>
            <h2 className="text-base font-bold">구글 시트 임포트</h2>
            <p className="text-xs text-text-muted mt-0.5">시트의 주문 데이터를 일괄 등록합니다</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-fill-tint text-text-muted">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* 모달 바디 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {sheetStep === "input" && (
            <div className="space-y-4">
              <div className="text-sm text-text-sub bg-fill-tint rounded-lg p-3 space-y-1.5">
                <p className="font-medium text-text-primary">시트 준비 방법</p>
                <p>1. 구글 시트를 열고 <strong>공유 → 링크가 있는 모든 사용자(뷰어)</strong>로 설정</p>
                <p>2. 첫 행에 헤더 입력: <code className="bg-bg rounded px-1">고객명, 전화번호, 주소</code> (필수) + <code className="bg-bg rounded px-1">상세주소, 수거일, 시간대, 평형, 예상금액, 품목설명, 메모</code> (선택)</p>
                <p>3. 아래에 시트 URL을 붙여넣기</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1.5">구글 시트 URL</label>
                <input
                  type="url"
                  value={sheetURL}
                  onChange={(e) => onSheetURLChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && sheetURL.trim()) onPreview(); }}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full h-11 px-3 border border-border rounded-lg text-sm text-text-primary bg-bg outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                onClick={onPreview}
                disabled={!sheetURL.trim() || sheetLoading}
                className="w-full h-11 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {sheetLoading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />미리보기 로딩 중...</>
                ) : "미리보기"}
              </button>
            </div>
          )}

          {sheetStep === "preview" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-semantic-green font-semibold">{sheetRows.filter(r => r.errors.length === 0).length}건 정상</span>
                  {sheetRows.filter(r => r.errors.length > 0).length > 0 && (
                    <span className="text-semantic-red font-semibold">{sheetRows.filter(r => r.errors.length > 0).length}건 오류 (스킵)</span>
                  )}
                </div>
                <button onClick={() => onStepChange("input")} className="text-xs text-text-muted hover:text-text-sub">URL 변경</button>
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-fill-tint sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left font-semibold text-text-sub w-8">#</th>
                        <th className="px-2 py-2 text-left font-semibold text-text-sub">고객명</th>
                        <th className="px-2 py-2 text-left font-semibold text-text-sub">전화번호</th>
                        <th className="px-2 py-2 text-left font-semibold text-text-sub">주소</th>
                        <th className="px-2 py-2 text-left font-semibold text-text-sub">수거일</th>
                        <th className="px-2 py-2 text-left font-semibold text-text-sub">비고</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {sheetRows.map((row) => (
                        <tr key={row.rowIndex} className={row.errors.length > 0 ? "bg-semantic-red-tint/40" : "hover:bg-fill-tint/50"}>
                          <td className="px-2 py-2 text-text-muted">{row.rowIndex}</td>
                          <td className="px-2 py-2 font-medium text-text-primary">{row.customerName || <span className="text-semantic-red">없음</span>}</td>
                          <td className="px-2 py-2 text-text-sub">{row.phone || <span className="text-semantic-red">없음</span>}</td>
                          <td className="px-2 py-2 text-text-sub max-w-[140px] truncate">{row.address || <span className="text-semantic-red">없음</span>}</td>
                          <td className="px-2 py-2 text-text-muted">{row.date || "–"}</td>
                          <td className="px-2 py-2">
                            {row.errors.length > 0
                              ? <span className="text-semantic-red">{row.errors.join(", ")}</span>
                              : <span className="text-semantic-green">✓</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {sheetRows.filter(r => r.errors.length === 0).length > 0 ? (
                <button
                  onClick={onImport}
                  disabled={sheetLoading}
                  className="w-full h-11 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {sheetLoading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />임포트 중...</>
                  ) : `${sheetRows.filter(r => r.errors.length === 0).length}건 가져오기`}
                </button>
              ) : (
                <p className="text-center text-sm text-semantic-red">가져올 수 있는 행이 없습니다. 시트 내용을 확인해주세요.</p>
              )}
            </div>
          )}

          {sheetStep === "done" && sheetResult && (
            <div className="space-y-4 py-4 text-center">
              <div className="text-4xl">{sheetResult.failed === 0 ? "✅" : "⚠️"}</div>
              <div>
                <p className="text-lg font-bold text-text-primary">{sheetResult.succeeded}건 등록 완료</p>
                {sheetResult.failed > 0 && <p className="text-sm text-semantic-red mt-1">{sheetResult.failed}건 실패</p>}
                {sheetResult.skipped > 0 && <p className="text-sm text-text-muted mt-1">{sheetResult.skipped}건 스킵 (필수 필드 누락)</p>}
              </div>
              <button onClick={onClose} className="w-full h-11 rounded-lg bg-primary text-white text-sm font-semibold">
                닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

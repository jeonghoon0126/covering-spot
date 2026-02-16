import type { ReactNode } from "react";

/* ── 31개 카테고리 듀오톤 아이콘 (28x28, blue palette) ── */
/* 색상: #3B82F6(primary), #93C5FD(mid), #DBEAFE(light), #EFF6FF(bg), #1E40AF(dark) */

export const categoryIcons: Record<string, ReactNode> = {
  /* ── 가구 ── */
  장롱: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="5" y="4" width="22" height="23" rx="3" fill="#93C5FD" />
      <rect x="6" y="5" width="10" height="21" rx="2" fill="#DBEAFE" />
      <rect x="16" y="5" width="10" height="21" rx="2" fill="#EFF6FF" />
      <line x1="16" y1="5" x2="16" y2="26" stroke="#3B82F6" strokeWidth="1.5" />
      <circle cx="13" cy="15" r="1.2" fill="#3B82F6" />
      <circle cx="19" cy="15" r="1.2" fill="#3B82F6" />
      <rect x="7" y="27" width="4" height="2" rx="1" fill="#1E40AF" />
      <rect x="21" y="27" width="4" height="2" rx="1" fill="#1E40AF" />
    </svg>
  ),
  소파: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="10" width="24" height="10" rx="3" fill="#DBEAFE" />
      <path d="M6 14c0-3.3 2.7-6 6-6h8c3.3 0 6 2.7 6 6" fill="#93C5FD" />
      <rect x="3" y="16" width="26" height="5" rx="2.5" fill="#3B82F6" />
      <rect x="6" y="21" width="3" height="3" rx="1" fill="#1E40AF" />
      <rect x="23" y="21" width="3" height="3" rx="1" fill="#1E40AF" />
      <path d="M8 16v-3a1 1 0 0 1 1-1h0a1 1 0 0 1 1 1v3" fill="#60A5FA" />
      <path d="M22 16v-3a1 1 0 0 1 1-1h0a1 1 0 0 1 1 1v3" fill="#60A5FA" />
    </svg>
  ),
  침대: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="3" y="18" width="26" height="4" rx="2" fill="#3B82F6" />
      <rect x="5" y="12" width="22" height="6" rx="2" fill="#93C5FD" />
      <rect x="6" y="9" width="7" height="5" rx="2.5" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1" />
      <rect x="15" y="9" width="7" height="5" rx="2.5" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1" />
      <rect x="5" y="22" width="2" height="3" rx="1" fill="#1E40AF" />
      <rect x="25" y="22" width="2" height="3" rx="1" fill="#1E40AF" />
    </svg>
  ),
  장식장: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="5" y="3" width="22" height="24" rx="3" fill="#93C5FD" />
      <rect x="7" y="5" width="18" height="9" rx="2" fill="#EFF6FF" />
      <rect x="7" y="16" width="18" height="9" rx="2" fill="#DBEAFE" />
      <line x1="16" y1="5" x2="16" y2="14" stroke="#3B82F6" strokeWidth="1" />
      <circle cx="14" cy="9.5" r="1" fill="#3B82F6" />
      <circle cx="18" cy="9.5" r="1" fill="#3B82F6" />
      <rect x="13" y="19.5" width="6" height="2" rx="1" fill="#3B82F6" />
      <rect x="8" y="27" width="4" height="2" rx="1" fill="#1E40AF" />
      <rect x="20" y="27" width="4" height="2" rx="1" fill="#1E40AF" />
    </svg>
  ),
  거실장: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="3" y="8" width="26" height="14" rx="3" fill="#93C5FD" />
      <rect x="4" y="9" width="12" height="12" rx="2" fill="#DBEAFE" />
      <rect x="16" y="9" width="12" height="12" rx="2" fill="#EFF6FF" />
      <rect x="6" y="11" width="8" height="6" rx="1" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="0.8" />
      <circle cx="22" cy="15" r="1" fill="#3B82F6" />
      <rect x="6" y="22" width="3" height="3" rx="1" fill="#1E40AF" />
      <rect x="23" y="22" width="3" height="3" rx="1" fill="#1E40AF" />
    </svg>
  ),
  식탁: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="3" y="10" width="26" height="4" rx="2" fill="#3B82F6" />
      <rect x="4" y="9" width="24" height="3" rx="1.5" fill="#60A5FA" />
      <rect x="6" y="14" width="3" height="12" rx="1.5" fill="#93C5FD" />
      <rect x="23" y="14" width="3" height="12" rx="1.5" fill="#93C5FD" />
      <rect x="12" y="14" width="3" height="12" rx="1.5" fill="#93C5FD" />
      <rect x="17" y="14" width="3" height="12" rx="1.5" fill="#93C5FD" />
      <ellipse cx="10" cy="8" rx="2" ry="1.5" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="0.8" />
      <ellipse cx="22" cy="8" rx="2" ry="1.5" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="0.8" />
    </svg>
  ),
  테이블: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="3" y="10" width="26" height="4" rx="2" fill="#3B82F6" />
      <rect x="4" y="9" width="24" height="3" rx="1.5" fill="#60A5FA" />
      <rect x="6" y="14" width="3" height="12" rx="1.5" fill="#93C5FD" />
      <rect x="23" y="14" width="3" height="12" rx="1.5" fill="#93C5FD" />
      <path d="M6 26h6M20 26h6" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  책상: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="3" y="10" width="26" height="3.5" rx="1.5" fill="#3B82F6" />
      <rect x="5" y="13.5" width="3" height="12" rx="1.5" fill="#93C5FD" />
      <rect x="24" y="13.5" width="3" height="12" rx="1.5" fill="#93C5FD" />
      <rect x="17" y="13.5" width="10" height="5" rx="1.5" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1" />
      <rect x="17" y="18.5" width="10" height="5" rx="1.5" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1" />
      <circle cx="22" cy="16" r="0.8" fill="#3B82F6" />
      <circle cx="22" cy="21" r="0.8" fill="#3B82F6" />
    </svg>
  ),
  캐비닛: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="5" y="4" width="22" height="22" rx="3" fill="#93C5FD" />
      <rect x="7" y="6" width="8" height="9" rx="2" fill="#DBEAFE" />
      <rect x="17" y="6" width="8" height="9" rx="2" fill="#DBEAFE" />
      <rect x="7" y="17" width="8" height="7" rx="2" fill="#EFF6FF" />
      <rect x="17" y="17" width="8" height="7" rx="2" fill="#EFF6FF" />
      <circle cx="13" cy="10.5" r="1" fill="#3B82F6" />
      <circle cx="23" cy="10.5" r="1" fill="#3B82F6" />
      <rect x="13" y="19.5" width="6" height="2" rx="1" fill="#3B82F6" />
      <rect x="8" y="26" width="4" height="2" rx="1" fill="#1E40AF" />
      <rect x="20" y="26" width="4" height="2" rx="1" fill="#1E40AF" />
    </svg>
  ),
  화장대: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="10" rx="8" ry="8" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1.2" />
      <ellipse cx="16" cy="10" rx="5.5" ry="5.5" fill="#EFF6FF" />
      <rect x="8" y="18" width="16" height="8" rx="2" fill="#93C5FD" />
      <rect x="10" y="20" width="5" height="4" rx="1" fill="#DBEAFE" />
      <rect x="17" y="20" width="5" height="4" rx="1" fill="#DBEAFE" />
      <circle cx="12.5" cy="22" r="0.8" fill="#3B82F6" />
      <circle cx="19.5" cy="22" r="0.8" fill="#3B82F6" />
      <rect x="10" y="26" width="3" height="2" rx="1" fill="#1E40AF" />
      <rect x="19" y="26" width="3" height="2" rx="1" fill="#1E40AF" />
    </svg>
  ),
  책장: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="5" y="3" width="22" height="25" rx="2" fill="#93C5FD" />
      <rect x="7" y="5" width="18" height="6" rx="1" fill="#DBEAFE" />
      <rect x="7" y="13" width="18" height="6" rx="1" fill="#EFF6FF" />
      <rect x="7" y="21" width="18" height="5" rx="1" fill="#DBEAFE" />
      <rect x="9" y="6" width="3" height="4" rx="0.5" fill="#3B82F6" />
      <rect x="13" y="7" width="2" height="3" rx="0.5" fill="#60A5FA" />
      <rect x="16" y="6" width="3" height="4" rx="0.5" fill="#3B82F6" />
      <rect x="10" y="14" width="4" height="4" rx="0.5" fill="#3B82F6" />
      <rect x="15" y="15" width="3" height="3" rx="0.5" fill="#60A5FA" />
      <rect x="9" y="22" width="2" height="3" rx="0.5" fill="#3B82F6" />
      <rect x="12" y="22" width="4" height="3" rx="0.5" fill="#60A5FA" />
    </svg>
  ),
  신발장: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="5" y="4" width="22" height="22" rx="3" fill="#93C5FD" />
      <rect x="7" y="6" width="18" height="5" rx="1.5" fill="#DBEAFE" />
      <rect x="7" y="13" width="18" height="5" rx="1.5" fill="#EFF6FF" />
      <rect x="7" y="20" width="18" height="4" rx="1.5" fill="#DBEAFE" />
      <path d="M10 8.5h4c1 0 2 0.5 2 1.5H10v-1.5z" fill="#3B82F6" />
      <path d="M18 15.5h4c1 0 1.5 0.5 1.5 1.5H18v-1.5z" fill="#3B82F6" />
      <rect x="8" y="26" width="4" height="2" rx="1" fill="#1E40AF" />
      <rect x="20" y="26" width="4" height="2" rx="1" fill="#1E40AF" />
    </svg>
  ),
  서랍장: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="5" y="3" width="22" height="24" rx="3" fill="#93C5FD" />
      <rect x="7" y="5" width="18" height="6" rx="2" fill="#DBEAFE" />
      <rect x="7" y="13" width="18" height="6" rx="2" fill="#EFF6FF" />
      <rect x="7" y="21" width="18" height="4" rx="2" fill="#DBEAFE" />
      <rect x="14" y="7" width="4" height="2" rx="1" fill="#3B82F6" />
      <rect x="14" y="15" width="4" height="2" rx="1" fill="#3B82F6" />
      <rect x="14" y="22" width="4" height="1.5" rx="0.75" fill="#3B82F6" />
      <rect x="8" y="27" width="4" height="2" rx="1" fill="#1E40AF" />
      <rect x="20" y="27" width="4" height="2" rx="1" fill="#1E40AF" />
    </svg>
  ),
  탁자: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="11" rx="10" ry="3" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1" />
      <ellipse cx="16" cy="11" rx="10" ry="3" fill="#3B82F6" opacity="0.3" />
      <rect x="14" y="14" width="4" height="10" rx="2" fill="#93C5FD" />
      <ellipse cx="16" cy="25" rx="7" ry="2" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1" />
    </svg>
  ),

  /* ── 주방/욕실 ── */
  주방: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="7" y="14" width="4" height="14" rx="2" fill="#93C5FD" />
      <path d="M8 4v6a3 3 0 0 0 3 3v0" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 4v6" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 4v6a3 3 0 0 1-3 3" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="20" y="4" width="6" height="24" rx="3" fill="#DBEAFE" />
      <path d="M23 4c-2.8 0-5 2.2-5 5v5a3 3 0 0 0 3 3h2" fill="#93C5FD" />
      <rect x="22" y="8" width="1.5" height="5" rx="0.75" fill="#3B82F6" />
    </svg>
  ),
  욕실: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="14" width="24" height="4" rx="2" fill="#3B82F6" />
      <rect x="6" y="6" width="4" height="8" rx="2" fill="#93C5FD" />
      <path d="M6 18c0 4 3 7 10 7s10-3 10-7" fill="#DBEAFE" />
      <path d="M6 18c0 4 3 7 10 7s10-3 10-7" stroke="#93C5FD" strokeWidth="1" />
      <rect x="8" y="25" width="2" height="4" rx="1" fill="#1E40AF" />
      <rect x="22" y="25" width="2" height="4" rx="1" fill="#1E40AF" />
      <circle cx="12" cy="10" r="1.5" fill="#DBEAFE" />
      <circle cx="16" cy="8" r="1" fill="#DBEAFE" />
    </svg>
  ),

  /* ── 생활/건강 ── */
  건강: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <path d="M16 28C9 22 4 17 4 12a6 6 0 0 1 12 0 6 6 0 0 1 12 0c0 5-5 10-12 16z" fill="#DBEAFE" />
      <path d="M16 28C9 22 4 17 4 12a6 6 0 0 1 12 0 6 6 0 0 1 12 0c0 5-5 10-12 16z" stroke="#93C5FD" strokeWidth="1.2" />
      <rect x="13" y="10" width="6" height="2" rx="1" fill="#3B82F6" />
      <rect x="15" y="8" width="2" height="6" rx="1" fill="#3B82F6" />
    </svg>
  ),
  반려동물: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <ellipse cx="10" cy="8" rx="3" ry="4" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1" />
      <ellipse cx="22" cy="8" rx="3" ry="4" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1" />
      <ellipse cx="6" cy="16" rx="2.5" ry="3.5" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1" />
      <ellipse cx="26" cy="16" rx="2.5" ry="3.5" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1" />
      <ellipse cx="16" cy="20" rx="7" ry="6" fill="#93C5FD" />
      <ellipse cx="16" cy="20" rx="4.5" ry="4" fill="#DBEAFE" />
    </svg>
  ),
  운동: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="2" y="11" width="6" height="10" rx="2" fill="#3B82F6" />
      <rect x="24" y="11" width="6" height="10" rx="2" fill="#3B82F6" />
      <rect x="6" y="13" width="4" height="6" rx="1.5" fill="#60A5FA" />
      <rect x="22" y="13" width="4" height="6" rx="1.5" fill="#60A5FA" />
      <rect x="10" y="14.5" width="12" height="3" rx="1.5" fill="#93C5FD" />
    </svg>
  ),
  악기: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <path d="M12 22V7l14-3v15" stroke="#93C5FD" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="8" cy="23" r="4" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.5" />
      <circle cx="22" cy="20" r="4" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.5" />
      <path d="M12 12l14-3" stroke="#3B82F6" strokeWidth="1.5" />
    </svg>
  ),

  /* ── 가전 ── */
  가전: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="7" y="2" width="18" height="28" rx="3" fill="#93C5FD" />
      <rect x="8" y="3" width="16" height="11" rx="2" fill="#DBEAFE" />
      <rect x="8" y="15" width="16" height="14" rx="2" fill="#EFF6FF" />
      <line x1="8" y1="14.5" x2="24" y2="14.5" stroke="#3B82F6" strokeWidth="1.5" />
      <rect x="11" y="7" width="1.5" height="4" rx="0.75" fill="#3B82F6" />
      <rect x="11" y="18" width="1.5" height="6" rx="0.75" fill="#3B82F6" />
    </svg>
  ),
  기타가전: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="4" width="24" height="24" rx="4" fill="#DBEAFE" />
      <rect x="5" y="5" width="22" height="22" rx="3" fill="#EFF6FF" />
      <circle cx="16" cy="16" r="6" fill="#93C5FD" />
      <circle cx="16" cy="16" r="3" fill="#DBEAFE" />
      <path d="M16 10v6l4 2" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  /* ── 사무/수납 ── */
  사무: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="6" width="18" height="14" rx="2" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1" />
      <rect x="4" y="6" width="18" height="3" rx="1" fill="#3B82F6" />
      <rect x="7" y="12" width="12" height="1.5" rx="0.75" fill="#93C5FD" />
      <rect x="7" y="15" width="8" height="1.5" rx="0.75" fill="#93C5FD" />
      <rect x="24" y="8" width="4" height="20" rx="1" fill="#93C5FD" />
      <rect x="22" y="10" width="2" height="16" rx="1" fill="#DBEAFE" />
      <circle cx="25" cy="12" r="0.8" fill="#3B82F6" />
    </svg>
  ),
  수납: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="5" y="3" width="22" height="9" rx="2" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1" />
      <rect x="5" y="13" width="22" height="9" rx="2" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="1" />
      <rect x="13" y="6.5" width="6" height="2" rx="1" fill="#3B82F6" />
      <rect x="13" y="16.5" width="6" height="2" rx="1" fill="#3B82F6" />
      <rect x="5" y="23" width="22" height="3" rx="1.5" fill="#93C5FD" />
      <rect x="8" y="26" width="3" height="2" rx="1" fill="#1E40AF" />
      <rect x="21" y="26" width="3" height="2" rx="1" fill="#1E40AF" />
    </svg>
  ),

  /* ── 유아/레저/공구/계절 ── */
  유아: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="10" r="5" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1.2" />
      <path d="M10 18c0-3.3 2.7-6 6-6s6 2.7 6 6v5a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3v-5z" fill="#93C5FD" />
      <circle cx="14" cy="9" r="1" fill="#3B82F6" />
      <circle cx="18" cy="9" r="1" fill="#3B82F6" />
      <path d="M14 12c0.5 0.8 3.5 0.8 4 0" stroke="#3B82F6" strokeWidth="1" strokeLinecap="round" />
      <rect x="8" y="26" width="3" height="2" rx="1" fill="#1E40AF" />
      <rect x="21" y="26" width="3" height="2" rx="1" fill="#1E40AF" />
    </svg>
  ),
  레저: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="11" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="7" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="1" />
      <circle cx="16" cy="16" r="3" fill="#93C5FD" />
      <circle cx="16" cy="16" r="1" fill="#3B82F6" />
      <path d="M16 5v4M16 23v4M5 16h4M23 16h4" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  공구: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <path d="M8 24l10-10" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" />
      <path d="M18 14l6-6a4 4 0 0 0-6-1l-1 1 3 3-2 2-3-3-1 1a4 4 0 0 0 1 6l3-3z" fill="#3B82F6" />
      <rect x="5" y="22" width="6" height="6" rx="1.5" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1" transform="rotate(-45 8 25)" />
    </svg>
  ),
  계절: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="5" fill="#DBEAFE" />
      <circle cx="16" cy="16" r="3" fill="#93C5FD" />
      <path d="M16 5v4M16 23v4M5 16h4M23 16h4M8.8 8.8l2.8 2.8M20.4 20.4l2.8 2.8M8.8 23.2l2.8-2.8M20.4 11.6l2.8-2.8" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M25 6l-4 2 2-4" fill="#60A5FA" />
    </svg>
  ),

  /* ── 포장/기타 ── */
  포장: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="5" y="8" width="22" height="18" rx="2" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1.2" />
      <path d="M5 12h22" stroke="#93C5FD" strokeWidth="1.2" />
      <rect x="13" y="8" width="6" height="18" fill="#93C5FD" opacity="0.4" />
      <rect x="5" y="8" width="22" height="4" rx="1" fill="#3B82F6" opacity="0.3" />
      <path d="M13 4l3 4 3-4" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  기타: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <path d="M16 3L28 10v12l-12 7L4 22V10l12-7z" fill="#DBEAFE" />
      <path d="M16 3L28 10v12l-12 7L4 22V10l12-7z" stroke="#93C5FD" strokeWidth="1.5" />
      <path d="M4 10l12 7 12-7" stroke="#3B82F6" strokeWidth="1.5" />
      <path d="M16 29V17" stroke="#3B82F6" strokeWidth="1.5" />
      <circle cx="16" cy="14" r="3" fill="#60A5FA" opacity="0.5" />
    </svg>
  ),
  잡동사니: (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="6" y="10" width="20" height="16" rx="2.5" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1.2" />
      <path d="M11 10V7a5 5 0 0 1 10 0v3" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="18" r="2" fill="#93C5FD" />
      <rect x="17" y="16" width="5" height="4" rx="1" fill="#93C5FD" />
      <circle cx="16" cy="22" r="1.5" fill="#3B82F6" opacity="0.5" />
    </svg>
  ),
};

/* ── 기본 아이콘 (매핑 없는 카테고리용) ── */
export const defaultCategoryIcon = (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
    <rect x="5" y="8" width="22" height="18" rx="2" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1.2" />
    <path d="M5 12h22" stroke="#93C5FD" strokeWidth="1.2" />
    <circle cx="16" cy="19" r="3" fill="#93C5FD" />
    <path d="M16 17v4M14 19h4" stroke="#3B82F6" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

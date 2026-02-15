## 커버링 스팟 - 현재 상태

배포: https://coveringspot.vercel.app
GitHub: beige-ian/waste-management-landing (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs)

### 최근 작업 (2026-02-15)

**전체 프로덕트 CDS 디자인시스템 준수 리디자인 (완료)**
- GNB: "커버링 스팟" → "커버링 방문 수거", 로고 아이콘 교체, 신청 조회 버튼화 ✅
- Hero: 텍스트 stagger 애니메이션 + wave 배경 + 신청 조회 링크 제거 ✅
- TrustBar: 과한 border 제거, bg-warm/60 톤으로 부드럽게 ✅
- SectionHeader: 모든 태그를 Chip 스타일(rounded-full, bg-primary-tint)로 통일 ✅
- ItemsCarousel: 8→16개 대표 품목, spot-items 실제 가격 반영, 제목 변경 ✅
- ItemPrices: 15개 Toss-level SVG 라인 아이콘, 전 품목 포함, pill 탭 UI ✅
- Compare: 테이블→수평 바차트 시각화, 절약 금액 하이라이트, 왜 차이 카드화 ✅
- Pricing: "왜 커버링인가요" → 2x2 카드 그리드 + SVG 아이콘 ✅
- CTASection: 수거신청 버튼 CTA 스타일 적용 ✅
- FloatingCTA: 투명도 강화(bg-white/70), 신청 조회 제거 ✅

**이전 작업**
- CDS 컴포넌트 라이브러리 27개 + booking/complete/manage/admin 페이지 적용
- Supabase PostgreSQL 마이그레이션 완료
- 홈페이지 UX 개선 (카운트업, FAQ 동적높이, 스크롤 최적화 등)

### 주요 파일 구조
```
src/app/booking/        → 예약 UI (page, complete, manage)
src/app/admin/          → 관리자 (page=로그인, dashboard, bookings/[id])
src/app/api/            → API Routes
src/lib/                → Supabase, 견적 계산, Slack 알림
src/data/               → 정적 데이터 (65지역, 470+품목, 사다리차)
src/components/sections/ → 홈페이지 섹션 (Hero, Process, Pricing 등)
src/components/ui/       → CDS 컴포넌트 라이브러리 (27개)
```

### Supabase
- Project ref: agqynwvbswolmrktjsbw
- URL: https://agqynwvbswolmrktjsbw.supabase.co
- DB 직접 연결 불가 (IPv6 전용) - PostgREST API만 사용

### 알려진 이슈
- Slack 채널이 테스트용. 운영 시 C0ACBEFKPDJ로 전환 필요
- DB 직접 연결 불가 (IPv6 + 차단) - SQL Editor 사용 필요

### TODO
1. 배포 검증 (예약 생성/조회/수정 테스트)
2. 운영 Slack 채널 전환
3. 고객 SMS/카톡 알림 (견적 확정 시)

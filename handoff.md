## 커버링 스팟 - 현재 상태

배포: https://coveringspot.vercel.app
커스텀 도메인: spot.covering.co.kr (Vercel에 등록됨, DNS CNAME 설정 필요)
GitHub: beige-ian/waste-management-landing (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs, Node 24.x)

### 최근 작업 (2026-02-18)

**Phase 8: 프로덕션 레벨 개선 + 기사 슬롯 관리 + 분석/AB 인프라 (세션 5)**
- Nav: 모바일 브랜드명 표시 (max-sm:hidden 제거, 14px 축소), Airbridge fallback 링크 제거
- Border-radius 전역 CSS 변수 통일 (~25곳): rounded-2xl/xl/[14px]/[16px]/[20px] → rounded-[--radius-sm/md/lg]
  - Nav, Hero, Process, FloatingCTA, AppDownload, FAQ, Compare, ItemPrices, Pricing, CTASection, ItemsCarousel, Footer, booking/layout
- 스플래시 컴포넌트: sessionStorage 기반 (새 세션마다 로고 fade-in 애니메이션, 같은 탭 새로고침 시 스킵)
  - src/components/Splash.tsx 신규, page.tsx 래핑
- 375px 모바일 줄바꿈 점검: booking 스텝 인디케이터 max-sm:gap-1 + w-7 축소
- 분석 이벤트 확장 (booking 퍼널 9개 이벤트 추가):
  - booking_start, booking_step_complete, booking_item_select, booking_photo_upload, booking_submit, booking_complete, booking_manage_view, booking_cancel, quote_preview
  - booking/page.tsx, complete/page.tsx, manage/page.tsx에 track() 호출 추가
- A/B 테스트 인프라 강화:
  - getActiveExperiments() 복수 실험 지원, middleware 루프 처리
  - ExperimentContext: Map<name, variant> 지원, getVariant(name) 메서드
  - ABTest.tsx 신규 컴포넌트 (variant별 렌더링 헬퍼)
  - analytics.ts: 모든 실험 쿠키 수집으로 변경
- 기사 마스터 데이터:
  - Supabase: drivers 테이블 생성 (id, name, phone, active, created_at)
  - blocked_slots에 driver_id FK 추가 (NULL=전체 차단)
  - db.ts: Driver CRUD (getDrivers, createDriver, updateDriver, deleteDriver)
  - GET/POST/PUT/DELETE /api/admin/drivers 엔드포인트
  - blocked-slots API: driverId 파라미터 지원
- 기사 슬롯 관리 UI:
  - /admin/calendar에 "슬롯" 탭 추가 (일간/주간/슬롯 3모드)
  - 기사 드롭다운 + 날짜 선택 → 07:00~24:00 타임라인 (18개 슬롯)
  - 클릭으로 차단/해제 토글, 예약 건수 표시
  - 기사 추가/수정/비활성화 UI (인라인 폼)
- 관리자 수동 예약 생성 (카톡 상담 공존):
  - /admin/bookings/new 페이지 신규
  - POST /api/admin/bookings 엔드포인트 추가
  - Booking에 source 필드 추가 (카카오톡 상담/전화 상담/기타)
  - dashboard 헤더에 "+ 새 예약" 버튼 추가

**Phase 7: 제품 종합 개선 16건 (세션 4)**
- 크리티컬 버그 수정: 인기 품목 8개 전부 name 불일치 → find() 실패 → 빈 화면
- 예약 플로우 UI 개선, 완료 페이지, AppDownload, Hero, 관리자 UX 등
- 캘린더 주간 뷰, 정산 LinkPay placeholder, 모바일 UI 글로벌 리뷰

### 주요 파일 구조
```
src/app/booking/        → 예약 UI (page, complete, manage)
src/app/admin/          → 관리자 (page=로그인, dashboard, calendar, bookings/[id], bookings/new)
src/app/api/            → API Routes (bookings, leads, quote, slots, push, admin/drivers, admin/blocked-slots 등)
src/lib/                → Supabase, 견적, Slack, SMS, 예약마감, 푸시, analytics
src/config/experiments.ts → A/B 테스트 실험 설정 (복수 실험 지원)
src/middleware.ts       → Rate limiting + A/B 쿠키 할당 (복수 실험)
src/data/               → 정적 데이터 (58지역, 470+품목, 사다리차)
src/components/         → CDS 컴포넌트 (Splash, ABTest, Nav, FloatingCTA 등)
```

### ⚠️ Tailwind v4 주의사항
globals.css의 `@theme inline`에 `--spacing-sm/md/2xl/4xl` 정의 → `max-w-sm`, `max-w-2xl` 등이 spacing 값으로 오염됨. 항상 `max-w-[42rem]` 형태의 명시값 사용 필수.

### Supabase
- Project ref: agqynwvbswolmrktjsbw
- URL: https://agqynwvbswolmrktjsbw.supabase.co
- DB 직접 연결 불가 (IPv6 전용) - PostgREST API만 사용
- 테이블: bookings, leads, admin_users, admin_audit_log, push_subscriptions, blocked_slots, drivers

### TODO (수동 작업)
1. ⚠️ **SMS/Push 알림 필수**: Vercel 환경변수 설정 (현재 미설정 → 견적확정 등 알림 미발송)
   - SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER
   - NEXT_PUBLIC_VAPID_PUBLIC_KEY=BKl0vAAD7grgyFTFx2J8OKO3EP1HMUyjcvjBNtsEj8ACl3vkmdY9FwgxkETl_d1PBv0f_H_vvOE9exH8TaQyqNM
   - VAPID_PRIVATE_KEY=K1e-xf9HOc4xjUZkEbyWh74v-B3ceqwLnTgsN1i4DhE
2. DNS CNAME 설정: spot.covering.co.kr → cname.vercel-dns.com
3. GCP OAuth Client ID 생성 + Vercel 환경변수: NEXT_PUBLIC_GOOGLE_CLIENT_ID
4. Google Search Console 인증 코드 적용 (layout.tsx placeholder)
5. Vercel 환경변수: NEXT_PUBLIC_SENTRY_DSN (Sentry 프로젝트 DSN)
6. Playwright 설치: npm i -D @playwright/test && npx playwright install
7. 결제 API 연동: src/lib/payment-link.ts placeholder → 실제 결제 링크 구현
8. 품목 가격 정기 점검: spot-items.ts 가격 주기적으로 스프레드시트와 대조 (모니터 500원 등)
9. GA4 Measurement ID 설정: Vercel 환경변수 NEXT_PUBLIC_GA4_ID
10. A/B 테스트 실험 등록: src/config/experiments.ts에 실험 추가 시 자동 활성화
11. E2E 테스트 확대: 현재 기본 4개 → 예약 플로우 E2E 추가 필요

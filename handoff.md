## 커버링 스팟 - 현재 상태

배포: https://coveringspot.vercel.app
커스텀 도메인: spot.covering.co.kr (Vercel에 등록됨, DNS CNAME 설정 필요)
GitHub: beige-ian/waste-management-landing (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs, Node 24.x)

### 최근 작업 (2026-02-18)

**Phase 7: 제품 종합 개선 16건 (세션 4)**
- 크리티컬 버그 수정: 인기 품목 8개 전부 name 불일치 → find() 실패 → 빈 화면 (전환율 직격)
  - spot-items.ts 실제 데이터 기준으로 cat/name 매핑 정확히 수정
- 예약 플로우 UI 개선 4건:
  - 검색-칩 간격 mb-1→mb-3, 미선택 칩 border 추가, "수거 신청 확정하기"→"견적 요청하기"
- 완료 페이지: 카카오톡 문의 버튼 추가, 귀중품 분리 안내 (VOC 대응)
- AppDownload: PWA 전 플랫폼 지원 (isMobile 조건 제거, Airbridge 링크→Chrome 안내)
- Hero: useScrollReveal에 initialVisible 파라미터 추가 → 최상단 요소 깜빡임 제거
- 관리자 예약 상세 UX 4건:
  - 견적 프리필 (estimateMin~Max placeholder + 예상 견적 적용 버튼)
  - 소요시간(duration) 선택 (30분/1시간/1.5시간/2시간)
  - 슬롯 충돌 실시간 경고 (quote_confirmed 시 재조회)
  - 수거 완료 사진 업로드 (/api/upload 재사용)
- DB 스키마: bookings 테이블에 confirmed_duration(int), completion_photos(jsonb) 추가
- 캘린더: 주간 뷰 추가 (월~일 7컬럼, Promise.all 병렬 fetch, 일간/주간 토글)
- 정산 LinkPay placeholder: payment-link.ts 생성, SMS 템플릿에 paymentUrl 파라미터 추가
- 모바일 UI 글로벌 리뷰: 터치 타겟 개선 (Nav, 카테고리 칩, 사진 삭제 버튼, 사다리차 등)
- 빌드 30 routes 성공, 테스트 28/28 통과

**시니어 코드 리뷰 + 크리티컬 보안 수정 (세션 3)**
- 전체 코드베이스 AI 코드 리뷰 수행 (API/클라이언트/인프라 3개 병렬 에이전트)
- 크리티컬 보안 이슈 7건 수정:
  1. booking-token.ts, admin/auth/route.ts: fallback secret 제거 → 환경변수 필수 + throw
  2. admin/auth/route.ts: 비밀번호 비교 timing-safe 전환 (crypto.timingSafeEqual)
  3. push/send/route.ts: 빈 문자열 auth bypass 차단 (ADMIN_PASSWORD 미설정 시 항상 거부)
  4. upload/route.ts: 파일 10개 제한, SVG/HTML 차단 (JPEG/PNG/WebP/HEIC만), 확장자 MIME 기반 추출
  5. bookings/[id]/route.ts PUT: Zod strict 스키마로 고객 수정 필드 제한 (admin 필드 차단)
  6. bookings/[id]/route.ts DELETE: pending 상태에서만 취소 가능
  7. db.ts: PostgREST .or() 필터 injection 방지 (특수문자 제거 sanitizer)
- GET /bookings/[id]: 비인증 요청 시 전화번호 중간 4자리 마스킹 (IDOR 대응)
- 빌드 30 routes 성공, 테스트 28/28 통과

**UI 애니메이션 + 디자인시스템 일관성 (세션 2)**
- 예약 완료 성공 애니메이션 강화: 체크 드로우 + 확산 링 2개 + 컨페티 8입자 + 반짝임 + 스태거 페이드업
- Process 섹션 아이콘 바운스: IntersectionObserver 기반 스크롤 진입 시 순차 바운스 + 반짝임
- AppDownload 섹션 신규: 푸터 앞 PWA 설치 섹션 (Android/iOS/폴백)
- FloatingCTA 하단 겹침 수정: nearBottom 300px 체크
- 시간대 선택 "N건 가능" 텍스트 제거 (마감 시만 "마감" 표시)
- 디자인시스템 일관성 수정 11건:
  - booking/page.tsx: 주소 버튼 포커스링 추가, 캘린더 네비 rounded 토큰화, 수량 버튼 radius 통일
  - admin/dashboard/page.tsx: 검색/날짜/셀렉트 input border+focus 패턴 통일, 체크박스 스타일 통일
  - booking/manage/page.tsx: 날짜 input focus 패턴 통일
- demo-animations.html 삭제 (불필요)
- 빌드 30 routes 성공, 테스트 28/28 통과

**전체 QA 수행 + 17개 이슈 수정**
- 🔴 Critical 2개: leads API Zod 검증 추가, 관리자 UI optimistic locking 적용
- 🟡 Medium 8개: push/send HMAC 인증, quote Zod 검증, 시간대 통일, useParams 전환, 스키마 필드 보완, rate limiting, 견적 프리뷰 사다리차 반영
- 🟢 Low 7개: Nav 로고 href, 카카오 HTTPS, sitemap 보완, PWAInstaller 삭제(dead code), formatPhoneNumber 공유유틸, 커스텀품목 "가격 미정" 표시
- 수정 파일: leads/route.ts, push/send/route.ts, quote/route.ts, dashboard/page.tsx, bookings/[id]/page.tsx, validation.ts, manage/page.tsx, middleware.ts, booking/page.tsx, Nav.tsx, constants.ts, sitemap.ts, complete/page.tsx
- 신규 파일: src/lib/format.ts (공유 formatPhoneNumber)
- 삭제 파일: src/components/PWAInstaller.tsx (dead code)
- 빌드 통과 (27 routes), 테스트 28/28 통과

**서비스 지역 확장 (BigQuery 기반)**
- 충남 천안/아산 추가 (기존 56 → 58개 지역)
- ⚠️ 천안/아산 가격은 평택/안성 기반 추정치 → 실제 운영가 확인 필요

**Scale/Infrastructure Improvements (Items #13-17)**

1. DB Pagination (Item #13)
   - src/lib/db.ts: getBookingsPaginated() 함수 추가 (status, dateFrom, dateTo, search, page, limit 지원)
   - api/admin/bookings/route.ts: GET에 pagination params 지원 (?page=1&limit=50&status=&dateFrom=&dateTo=&search=)
   - 응답에 total, page, limit 포함

2. Optimistic Locking (Item #14)
   - src/lib/db.ts: updateBooking()에 expectedUpdatedAt 파라미터 추가
   - api/admin/bookings/[id]/route.ts: body.expectedUpdatedAt 전달, 충돌 시 409 Conflict 반환

3. E2E Test Setup (Item #15)
   - playwright.config.ts: Playwright 설정 (localhost:3000, html reporter)
   - e2e/booking-flow.spec.ts: 기본 페이지 로딩 테스트 4개
   - package.json: "test:e2e" 스크립트 추가
   - tsconfig.json: e2e/, playwright.config.ts 제외

4. Sentry Monitoring (Item #16)
   - sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts 생성
   - next.config.ts: withSentryConfig 래핑
   - 환경변수 NEXT_PUBLIC_SENTRY_DSN 필요

5. Driver Assignment + Time Slot Blocking (Item #17)
   - Supabase: bookings 테이블에 driver_id, driver_name 컬럼 추가
   - Supabase: blocked_slots 테이블 생성 (id, date, time_start, time_end, reason, created_by, created_at)
   - src/types/booking.ts: driverId, driverName 필드 추가
   - src/lib/db.ts: BlockedSlot 인터페이스 + CRUD 함수 4개 추가, FIELD_MAP/rowToBooking/bookingToRow 업데이트
   - api/admin/blocked-slots/route.ts: GET/POST/DELETE 엔드포인트
   - api/slots/route.ts: blocked_slots 테이블 참조하여 차단된 슬롯 available=false 처리
   - api/admin/bookings/[id]/route.ts: driverId, driverName PUT 업데이트 지원

**Phase 6: 예약 마감 + 사진 흐름 + A/B 테스트 + PWA** (2026-02-16)
- 커밋 209e8b4: Phase 6 전체 (4개 Feature)

1. 전날 12시 마감 정책
   - src/lib/booking-utils.ts: getEarliestBookableDate(), isDateBookable()
   - booking/page.tsx: 클라이언트 검증 (날짜 비활성화 + 안내 배너)
   - api/slots, api/bookings: 서버 검증 (400 반환)

2. 사진 흐름 개편
   - 사진 필수 → 선택으로 변경 (PHOTO_REQUIRED_CATEGORIES 제거)
   - 품목 선택 시 견적 미리보기 (debounce 800ms, /api/quote 호출)

3. A/B 테스트 인프라
   - src/config/experiments.ts: 실험 설정 (현재 빈 배열)
   - src/middleware.ts: 쿠키 기반 variant 할당
   - src/contexts/ExperimentContext.tsx: React Context + useExperiment()
   - analytics.ts: 모든 이벤트에 experiment/variant 자동 주입
   - 의존성: js-cookie

4. PWA + 푸시 알림
   - public/manifest.json, public/sw.js, public/icons/
   - src/components/PWAInstaller.tsx: beforeinstallprompt + 설치 배너
   - src/app/offline/page.tsx: 오프라인 폴백
   - src/lib/push-subscription.ts: Web Push 구독
   - api/push/subscribe, api/push/send: 구독 저장 + 발송
   - Supabase: push_subscriptions 테이블 생성 완료
   - 의존성: web-push

### 주요 파일 구조
```
src/app/booking/        → 예약 UI (page, complete, manage)
src/app/admin/          → 관리자 (page=로그인, dashboard, calendar, driver, bookings/[id])
src/app/api/            → API Routes (bookings, leads, quote, slots, push 등)
src/lib/                → Supabase, 견적, Slack, SMS, 예약마감, 푸시
src/config/experiments.ts → A/B 테스트 실험 설정
src/middleware.ts       → A/B 쿠키 할당 미들웨어
src/data/               → 정적 데이터 (58지역, 470+품목, 사다리차)
src/components/         → CDS 컴포넌트 (PWAInstaller 삭제됨, Nav에 설치 통합)
```

### ⚠️ Tailwind v4 주의사항
globals.css의 `@theme inline`에 `--spacing-sm/md/2xl/4xl` 정의 → `max-w-sm`, `max-w-2xl` 등이 spacing 값으로 오염됨. 항상 `max-w-[42rem]` 형태의 명시값 사용 필수.

### Supabase
- Project ref: agqynwvbswolmrktjsbw
- URL: https://agqynwvbswolmrktjsbw.supabase.co
- DB 직접 연결 불가 (IPv6 전용) - PostgREST API만 사용
- 테이블: bookings, leads, admin_users, admin_audit_log, push_subscriptions, blocked_slots

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

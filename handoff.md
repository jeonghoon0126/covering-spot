## 커버링 방문수거 - 현재 상태

배포: https://coveringspot.vercel.app
커스텀 도메인: spot.covering.co.kr (Vercel에 등록됨, DNS CNAME 설정 필요)
GitHub: beige-ian/waste-management-landing (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs, Node 24.x)

### 최근 작업 (2026-02-20)

**Phase 8.2: QA 피드백 반영 + DRY 리팩터링 (세션 8)**
- FloatingCTA 모바일 CTA 축약: "카톡으로 신청하기" / "수거 신청하기" (PC 문구는 유지)
- 예상 견적 만원 단위: Math.floor(min)/Math.ceil(max) → "22만~27만원" (모바일 줄바꿈 해결)
- Step 6 견적 확인: 품목 상세 리스트 + 요청사항 표시 (수정 버튼 → Step 0 이동)
- SMS 내용 친절하게: 6개 상태별 템플릿 전면 재작성 (안내, 줄바꿈, 친절 어투)
- Push 알림 상세화: quote_confirmed에 최종 견적 금액 포함
- Admin 대시보드 모바일: 고객 전화번호 모바일 숨김, 구분자 · 사용, 만원 단위
- DRY 리팩터링: formatPrice/formatManWon → src/lib/format.ts로 통합 (5개 파일)
- 코드 리뷰: 🔴 Critical 0건, 🟡 Medium 3건(DRY, 인라인 Math.round, formatManWon(0) 엣지케이스)

**Phase 8.2: QA 피드백 반영 (세션 7)**
- FloatingCTA 트리거 개선: Hero CTA 버튼 스크롤아웃 시 즉시 표시 (hero-cta id 기반, fallback 유지)
- GNB 모바일 햄버거 메뉴: md:hidden 버튼 + 드롭다운 (서비스/가격/FAQ/고객후기/신청조회)
- 신청조회 조건부 표시: localStorage "covering_spot_booking_token" 있을 때만 GNB + 모바일 메뉴에 표시
- Step 6 CTA 텍스트: "견적 요청하기" → "최종 견적 요청하기"
- 접근성 개선: 햄버거 버튼 aria-expanded, 동적 aria-label 추가

### 주요 파일 구조
```
src/app/booking/        → 예약 UI (page, complete, manage)
src/app/admin/          → 관리자 (page=로그인, dashboard, calendar, bookings/[id], bookings/new)
src/app/api/            → API Routes (bookings, leads, quote, slots, push, admin/drivers, admin/blocked-slots 등)
src/lib/                → Supabase, 견적, Slack, SMS, 예약마감, 푸시, analytics
src/lib/format.ts       → 공용 포맷 유틸 (formatPhoneNumber, formatPrice, formatManWon)
src/config/experiments.ts → A/B 테스트 실험 설정 (복수 실험 지원)
src/middleware.ts       → Rate limiting + A/B 쿠키 할당 (복수 실험)
src/data/               → 정적 데이터 (58지역, 470+품목, 사다리차)
src/components/         → CDS 컴포넌트 (Splash, ABTest, Nav, FloatingCTA 등)
```

### ⚠️ Tailwind v4 주의사항
- `@theme inline`은 런타임 CSS 변수를 생성하지 않음. `rounded-[--radius-lg]` → var(--radius-lg) = 0px. 반드시 `rounded-lg` 등 빌트인 유틸리티 사용
- globals.css의 `@theme inline`에 `--spacing-sm/md/2xl/4xl` 정의 → `max-w-sm`, `max-w-2xl` 등이 spacing 값으로 오염됨. 항상 `max-w-[42rem]` 형태의 명시값 사용 필수

### Supabase
- Project ref: agqynwvbswolmrktjsbw
- URL: https://agqynwvbswolmrktjsbw.supabase.co
- DB 직접 연결 불가 (IPv6 전용) - PostgREST API만 사용
- 테이블: bookings, leads, admin_users, admin_audit_log, push_subscriptions, blocked_slots, drivers

### TODO (수동 작업)
1. ⚠️ **SMS/알림톡 + Push 알림 필수**: Vercel 환경변수 설정 (현재 미설정 → 견적확정 등 알림 미발송)
   - FLARELANE_API_KEY (FlareLane 프로젝트 API Key)
   - FLARELANE_PROJECT_ID (FlareLane 프로젝트 ID)
   - 알림톡 사용 시: FlareLane 콘솔에서 카카오 알림톡 템플릿 등록 필요
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

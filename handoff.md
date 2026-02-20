## 커버링 방문수거 - 현재 상태

배포: https://coveringspot.vercel.app
커스텀 도메인: spot.covering.co.kr (Vercel에 등록됨, DNS CNAME 설정 필요)
GitHub: jeonghoon0126/covering-spot (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs, Node 24.x)

### 최근 작업 (2026-02-20)

**Phase 10: 배차 시스템 — 지도 기반 배차 + 적재큐브 + 2시간 슬롯**
- 카카오맵 배차 뷰 (`/admin/dispatch`) 신규 구현
  - 지도 마커 (미배차:파란, 배차완료:초록, 수거중:노란)
  - 주문 클릭 → 사이드바 상세 + 기사 배차/해제
  - 기사별 적재 현황 패널 (게이지 바 + 초과 경고)
  - 미배차 주문 목록 + 빠른 배차 드롭다운
  - 모바일 바텀시트 (role/aria/ESC 접근성)
- SpotItem 470+ 품목에 `loadingCube(m³)` 데이터 적용
- Booking 타입: `totalLoadingCube`, `latitude`, `longitude` 추가
- Driver 차량 정보: `vehicleType`, `vehicleCapacity`, `licensePlate` 확장
- Geocoding 유틸 (카카오 REST API) + 예약 생성 시 자동 좌표 저장
- 고객 예약 슬롯 2시간 단위 변경 (09~11, 11~13, 13~15, 15~17, 17~19)
- 배차 API: 일괄 배차 + 기사별 적재 현황 조회
- 코드 리뷰 수정:
  - 보안: Zod parsed.data 사용, bookingIds 배열 크기 제한, phone 검증
  - 성능: Promise.allSettled 부분실패 처리, KakaoMap 선택 최적화
  - UX: 에러 상태+재시도, getToday KST 버그 수정, 바텀시트 접근성
- 상태: 커밋 완료(`b7c975e`), push 대기 (GitHub 인증 필요)

### 알려진 이슈
- GitHub push 인증 문제: beige-ian credential이 jeonghoon0126 repo에 접근 불가
  → PAT 설정 또는 gh auth login 필요
- 코드 리뷰 Medium (미수정, 이전 Phase부터 누적):
  - GET /api/bookings/{id} 토큰 없이 address/customerName 노출
  - reschedule 경로 Zod 검증 누락
  - admin/bookings POST Zod 스키마 없음
  - Rate Limiting 전체 부재
  - react-daum-postcode lazy loading 미적용
  - getAllBookings() 메모리 로드 (상태 카운트용)

### 주요 파일 구조
```
src/app/booking/        → 예약 UI (page, complete, manage)
src/app/admin/          → 관리자 (page=로그인, dashboard, calendar, dispatch, bookings/[id], bookings/new)
src/app/api/            → API Routes (bookings, leads, quote, slots, push, admin/drivers, admin/dispatch, admin/blocked-slots 등)
src/lib/                → Supabase, 견적, Slack, SMS, 예약마감, 푸시, analytics, geocode
src/lib/format.ts       → 공용 포맷 유틸 (formatPhoneNumber, formatPrice, formatManWon)
src/config/experiments.ts → A/B 테스트 실험 설정 (복수 실험 지원)
src/middleware.ts       → Rate limiting + A/B 쿠키 할당 (복수 실험)
src/data/               → 정적 데이터 (58지역, 470+품목+loadingCube, 사다리차)
src/components/         → CDS 컴포넌트 (Splash, ABTest, Nav, FloatingCTA, KakaoMap 등)
```

### ⚠️ Tailwind v4 주의사항
- `@theme inline`은 런타임 CSS 변수를 생성하지 않음. `rounded-[--radius-lg]` → var(--radius-lg) = 0px. 반드시 `rounded-lg` 등 빌트인 유틸리티 사용
- globals.css의 `@theme inline`에 `--spacing-sm/md/2xl/4xl` 정의 → `max-w-sm`, `max-w-2xl` 등이 spacing 값으로 오염됨. 항상 `max-w-[42rem]` 형태의 명시값 사용 필수

### Supabase
- Project ref: agqynwvbswolmrktjsbw
- URL: https://agqynwvbswolmrktjsbw.supabase.co
- DB 직접 연결 불가 (IPv6 전용) - PostgREST API만 사용
- 테이블: bookings, leads, admin_users, admin_audit_log, push_subscriptions, blocked_slots, drivers

### TODO
1. GitHub 인증 설정 후 `git push origin main` → Vercel 자동 배포
2. Vercel 환경변수 추가: `KAKAO_REST_API_KEY`, `NEXT_PUBLIC_KAKAO_JS_KEY`
3. SMS/알림톡 + Push 환경변수 설정 (Vercel)
4. DNS CNAME: spot.covering.co.kr → cname.vercel-dns.com
5. Rate Limiting 적용 (최소 인증 엔드포인트)

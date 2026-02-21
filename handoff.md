## 커버링 방문수거 - 현재 상태

배포: https://coveringspot.vercel.app
커스텀 도메인: spot.covering.co.kr (Vercel에 등록됨, DNS CNAME 설정 필요)
GitHub: jeonghoon0126/covering-spot (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs, Node 24.x)
CI/CD: GitHub Actions (.github/workflows/deploy.yml) — push to main 시 자동 배포

### 최근 작업 (2026-02-22) — 고객 SMS 알림

**배차·수거 3개 트리거 고객 SMS 연결**

수정 파일:
- `src/lib/sms-notify.ts`: `dispatched` 템플릿 추가 ("기사가 배정되었어요!")
- `src/lib/db.ts`: `getBookingPhonesByIds(ids)` — 배차 ID 목록으로 phone 일괄 조회
- `src/app/api/driver/bookings/[id]/route.ts`: SELECT에 `phone` 추가, 상태 변경 성공 후 fire-and-forget SMS
- `src/app/api/admin/dispatch/route.ts`: 수동배차 성공 후 고객 `dispatched` SMS
- `src/app/api/admin/dispatch-auto/route.ts`: 자동배차 PUT 적용 후 고객 `dispatched` SMS

트리거:
1. 드라이버 수거 시작 (`in_progress`) → 고객 SMS
2. 드라이버 수거 완료 (`completed`) → 고객 SMS
3. 수동/자동 배차 확정 (`dispatched`) → 고객 SMS

설계: SMS 실패가 배차 실패를 유발하지 않음 (fire-and-forget + 구조화된 에러 로그)

### 최근 작업 (2026-02-21) — 세션 2

**배차 GNB 반응형 + 하차지 버그 + 기사 workDays + 보안 수정**

수정 파일:
- `src/app/admin/dispatch/page.tsx`
  - GNB Row2: 필터에 `flex-1 min-w-0` 추가, 범례 `hidden sm:flex` → `hidden lg:flex` (태블릿 오버플로우 제거)
  - date input: `w-36 sm:w-auto` (모바일 고정폭)
  - "오늘" 버튼: `hidden sm:block` (모바일 숨김)
  - 날짜 이동 버튼에 `aria-label` 추가 (a11y)
- `src/app/api/admin/unloading-points/route.ts`
  - CreateSchema/UpdateSchema: `.trim()` 추가 (공백만 입력 방어)
  - UpdateSchema: `.refine()` 추가 — 수정 필드 최소 1개 필수
  - DELETE: 존재하지 않는 ID → 404 반환 (기존: 항상 200)
- `src/lib/db.ts`
  - `deleteUnloadingPoint`: `.delete().eq().select("id")` 패턴으로 변경 → 실제 삭제 여부 boolean 반환
- `src/app/api/admin/dispatch-auto/route.ts`
  - workDays 필터링: `KO_DAYS` + `dayOfWeek` 계산 → 해당 요일 미근무 기사 자동 제외
- `src/lib/optimizer/tsp.ts`
  - `insertUnloadingStops` 라스트픽업 과적재 버그 수정 (이전 세션)
  - 단일 주문 > 차량 용량 시 `console.warn` 추가

### 알려진 이슈 (2026-02-21 추가)
- ~~**단일 주문 > 차량 용량**: 현재 경고 로그만 출력.~~ ✅ 수정 완료 — `dispatch-auto/route.ts`에서 `maxVehicleCapacity` 계산 후 초과 주문 선분리 → `unassigned`에 사유 포함
- **driverSlotFilters + workDays 조합**: 제약 있는 기사가 workDays로 제외되면 해당 슬롯 주문이 제약 없는 기사에게 조용히 넘어감 (의도된 동작인지 확인 필요)
- **dispatch-auto Zod 에러 메시지**: driverSlotFilters UUID 오류 시에도 "date 파라미터 필요" 출력 (오해 소지)
- **모바일 date input w-36 (144px)**: Android Chrome 실기 확인 필요

### 최근 작업 (2026-02-21) — 세션 1

**보안 수정 + 드래그앤드롭 + Kakao Directions ETA**

수정/신규 파일:
- `src/app/api/bookings/[id]/route.ts`
  - GET: 토큰 없을 때 address, addressDetail, customerName 마스킹 추가 (OWASP A01 대응)
  - PUT (reschedule): date 형식 검증 추가 (YYYY-MM-DD regex + timeSlot 길이 제한)
- `src/app/api/admin/dispatch/route-order/route.ts` (신규)
  - `PUT /api/admin/dispatch/route-order` — 경로 순서 일괄 업데이트
  - Zod UUID 검증, max 50건 제한, Promise.allSettled 부분 실패 안전 처리
- `src/app/admin/dispatch/page.tsx`
  - `@dnd-kit/core + sortable` 드래그앤드롭 추가
  - `AutoDispatchPreview`: 기사별 주문 순서 드래그 변경 → `handleAutoReorder` → `autoResult` 업데이트
  - `SortableBookingRow`, `DragHandle` 서브컴포넌트 추가
  - ETA 배지: `estimatedDuration`, `estimatedDistance` 표시 (Kakao API 실패 시 숨김)
  - `formatDuration`, `formatDistance` import
- `src/lib/kakao-directions.ts` (신규)
  - `getRouteETA(points)` — Kakao Mobility 길찾기 API 래퍼 (5초 타임아웃, graceful null 반환)
  - `formatDuration`, `formatDistance` 유틸
- `src/app/api/admin/dispatch-auto/route.ts`
  - POST: 좌표 없는 주문(lat/lng null) 자동 `unassigned` 분류 (0,0 좌표 오염 방지)
  - POST: ETA 병렬 계산 후 `DriverPlan.estimatedDuration/estimatedDistance` 추가
  - PUT: UUID 검증 강화, 기사별 병렬화 (for...of → Promise.allSettled 중첩), succeeded=0 시 500 반환
- `src/lib/optimizer/types.ts`
  - `DriverPlan`에 `estimatedDuration?`, `estimatedDistance?` 옵셔널 필드 추가

**이전 작업 (배차/기사 UX 버그 수정 + 코드 품질)**
- 배차 페이지: alert/confirm → toast + 인라인 확인 UI
- 기사 대시보드: KST 버그, 낙관적 업데이트, pendingAction 인라인 확인
- 하차지 + 자동배차 + CVRP 엔진 전체 구현
- 기사 전용 뷰 (전화번호 로그인 → 당일 배차)

### 알려진 이슈
- DNS CNAME: spot.covering.co.kr → cname.vercel-dns.com 설정 필요
- 코드 리뷰 Low (미수정):
  - 기사 11명 이상 시 색상 중복 (10색 팔레트)
  - 모바일 바텀시트 포커스 트랩 없음
  - booking token 만료 없음 (고정 HMAC)
  - `dispatch/route-order`: bookingId 소유권 확인 없음 (admin-only라 위험도 낮음)
  - `dispatch-auto PUT`: driverName 클라이언트 입력 (driverId로 DB 조회 권장)
  - ETA 계산에 하차지 미포함 (경유지 추가 가능하나 좌표 필요)
- 누적 Medium (이전 Phase부터):
  - Rate Limiting 전체 부재 (driver 엔드포인트만 적용)
  - getAllBookings() 메모리 로드 (상태 카운트용)
  - items.price 클라이언트 조작 가능 (서버 재계산 권장)

### 주요 파일 구조
```
src/app/admin/dispatch/page.tsx       → 배차 관리 (자동배차 + 하차지 + 수동배차 + DnD)
src/components/admin/KakaoMap.tsx     → 카카오맵 (마커 + 하차지 + 폴리라인)
src/lib/optimizer/                    → CVRP 엔진 (cluster, tsp, haversine, auto-dispatch)
src/lib/kakao-directions.ts           → Kakao Mobility 길찾기 API (ETA)
src/app/api/admin/dispatch-auto/      → 자동배차 API (미리보기 + 적용)
src/app/api/admin/dispatch/route-order/ → 경로 순서 업데이트 API
src/app/api/admin/unloading-points/   → 하차지 CRUD API
src/app/api/admin/dispatch/           → 수동 배차 API
src/app/api/admin/drivers/            → 기사 API
src/lib/db.ts                         → Supabase CRUD
src/lib/geocode.ts                    → 카카오 지오코딩
```

### Supabase
- Project ref: agqynwvbswolmrktjsbw
- URL: https://agqynwvbswolmrktjsbw.supabase.co
- DB 직접 연결 불가 (IPv6 전용) - PostgREST API만 사용
- 테이블: bookings, drivers, leads, admin_users, admin_audit_log, push_subscriptions, blocked_slots, unloading_points

### ⚠️ Tailwind v4 주의사항
- `@theme inline`에 `--spacing-sm/md/2xl/4xl` 정의 → `max-w-sm`, `max-w-2xl` 등이 spacing 값으로 오염됨. 항상 `max-w-[42rem]` 형태 사용

### TODO
1. DNS CNAME: spot.covering.co.kr → cname.vercel-dns.com
2. ~~기사 전용 뷰~~ ✅ 완료
3. ~~드래그앤드롭 경로 순서 변경~~ ✅ 완료
4. ~~실시간 교통 정보 반영 (Kakao Directions API)~~ ✅ 완료 (ETA 표시)
5. ~~GET /api/bookings/{id} address/customerName 노출 이슈~~ ✅ 완료 (마스킹 추가)
6. ~~배차 GNB 반응형~~ ✅ 완료
7. ~~하차지 등록 버그 (DELETE 404, PUT 빈 수정, trim 검증)~~ ✅ 완료
8. ~~기사 workDays 자동배차 적용~~ ✅ 완료
9. ~~단일 주문 > 차량 용량 → `unassigned` 처리~~ ✅ 완료
10. Rate Limiting (driver 엔드포인트 외 전체 미적용)
11. ~~배차·수거 고객 SMS (dispatched / in_progress / completed)~~ ✅ 완료

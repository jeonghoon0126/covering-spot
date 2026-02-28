## 커버링 방문수거 - 현재 상태

배포: https://coveringspot.vercel.app
커스텀 도메인: spot.covering.co.kr (Vercel에 등록됨, DNS CNAME 설정 필요)
GitHub: jeonghoon0126/covering-spot (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs, Node 24.x)
CI/CD: GitHub Actions (.github/workflows/deploy.yml) — push to main 시 자동 배포
Vercel Token (GitHub Secret): [~/.claude/rules/api-keys.md 참조]
GitHub PAT (jeonghoon0126): [~/.claude/rules/api-keys.md 참조]

### 최근 작업 (2026-02-24) — 세션 8 (예약 변경 요청 상태 도입 및 안정화)

**일정 변경 요청 기능 (change_requested) 안정화 및 보완**
- `src/app/booking/manage/page.tsx`
  - 캘린더 시간 선택 시 `confirmedTime` 대신 올바른 `timeSlot` 필드에 저장되도록 폼 로직 수정
- **상태 전이 통제 (ALLOWED_TRANSITIONS) 동기화**
  - Customer API (PUT, DELETE) 및 Admin API에서 `change_requested` 상태 전이가 관리자와 동기화되도록 수정
- **UI 및 알림 전파 검증**
  - 어드민 UI (대시보드, 캘린더, 상세페이지) 및 고객 UI 내 상태 라벨 렌더링 검증 완료
  - `src/lib/slack-notify.ts`의 `STATUS_LABELS`에 해당 상태값을 지정하여 Slack 알림 정상 발송

**QA & 환경 검증 (세션 8 완료 시점)**
- 전체 소스코드 빌드 무결성 점검 통과 (Next.js `npm run build` 타입/의존성 에러 없음 확인)
- 커스텀 도메인 `spot.covering.co.kr` 설정 점검 결과, 아직 CNAME (`cname.vercel-dns.com`) 연결이 완료되지 않았거나 외부 DNS 전파가 이루어지지 않음 (`NXDOMAIN` 응답 상태). 도메인 구입처(호스팅사) 설정 재확인이 필요함.

---

### 최근 작업 (2026-02-24) — 세션 7 (구글 시트 임포트)

**구글 시트 → 주문 자동 임포트 구현 (TODO #12)**
- `src/app/api/admin/bookings/sheet-import/route.ts` (신규)
  - `POST` with `{ url, dryRun }` — 공개 시트 CSV 파싱 → 주문 일괄 생성
  - `dryRun: true`: 미리보기 (행 파싱 + 유효/오류 분류)
  - `dryRun: false`: 실제 등록 (createBooking + Slack 알림 fire-and-forget)
  - 헤더 유연 매핑: 고객명/이름/성함, 전화번호/연락처, 수거일/날짜 등
  - `source: "구글시트 임포트"` 태깅
- `src/app/admin/dashboard/page.tsx`
  - 헤더에 "시트 임포트" 버튼 추가
  - 3단계 모달: URL 입력 → 미리보기 테이블 (유효/오류 행 색상 구분) → 결과 표시

**시트 컬럼 형식** (헤더 첫 행 필수):
```
고객명(필수), 전화번호(필수), 주소(필수), 상세주소, 수거일, 시간대, 평형, 예상금액, 품목설명, 메모
```
공유 설정: "링크가 있는 모든 사용자 → 뷰어" 필수

---

### 최근 작업 (2026-02-23) — 세션 6 (CI/CD 복구 + 신규 운영사 요구사항)

**CI/CD 복구**
- GitHub Actions Run #21~40 (02/21~02/22): `vercel pull` 단계에서 일괄 실패 — VERCEL_TOKEN 만료 원인
- `.github/workflows/deploy.yml` 수정: `vercel pull` 복원 + `env:` 스코프를 job 레벨로 이동
- GitHub Secret `VERCEL_TOKEN` 업데이트: 신규 `vcp_` 토큰 (beige@covering.app / beige's projects)
  - 방법: jeonghoon0126 PAT으로 GitHub API → repo public key → libsodium 암호화 → PUT
- Run #43: 전체 ✅ 성공 (vercel pull → build → deploy 정상)

**신규 운영사 요구사항 (유대현님 — 2026-02-23 수집)**

우선순위별 정리:
1. **[HIGH] 구글 시트 → 주문 자동 임포트**: 기존 시트에 있는 주문 데이터를 배차 시스템으로 자동 생성
2. **[MID] 초기 적재량 설정**: 전날 하차 안 한 차량의 현재 적재 상태 반영 후 배차 시작
3. **[MID] 기사별 출발지/퇴근지 등록**: 마지막 수거 후 집 또는 하차지로 귀가 동선 반영

배경:
- 현재 알바 기사 다수 (정규직은 우정훈 1명) — 요일/시간대별 스케줄 모두 다름 → workDays/슬롯으로 대응 가능
- 런치 서비스 포함 시 30~40건/일 피크 → 수기 동선 짜는 게 불가능
- 차량 적재량 관리: 매일 저녁 각 차량 적재 상태를 기사/관리자가 확인하고 있음
- 퇴근 전 하차지 경유가 이상적이나 물리적으로 불가한 경우 있음

현재 시스템으로 가능한 것:
- 기사 등록 (이름/적재량/근무요일/시간대 슬롯) ✅
- 자동배차 군집 분배 + 카카오 이동시간 ✅
- 하차지 경유 + 적재량 초과 시 자동 하차 삽입 ✅

### 최근 작업 (2026-02-22) — 세션 5 (구간별 ETA + 대시보드 정렬/탭 수정)

**수정 파일 (6개)**
- `src/lib/kakao-directions.ts`
  - `RouteSection` 타입 추가 (구간별 duration/distance)
  - `RouteETA`에 `sections: RouteSection[]` 추가 — Kakao API의 구간별 leg 데이터
  - `getRouteETA` 반환값에 sections 포함 (waypoints API: 각 leg, 2점 API: 전체 1구간 fallback)
- `src/lib/optimizer/types.ts`
  - `RouteSegment` 타입 추가 (fromBookingId, fromUnloadingId, travelSecs, distanceMeters, departureTime, arrivalTime, isUnloadingLeg)
  - `DriverPlan`에 `segments?: RouteSegment[]` 옵셔널 추가
- `src/app/api/admin/dispatch-auto/route.ts`
  - `planWithETA`에서 구간별 출발/도착 시각 계산 추가
  - 시작 시각 = 첫 수거지의 confirmedTime ?? timeSlot ?? "10:00"
  - 수거 서비스 시간(BASE_SERVICE_SECS + loadCube * CUBE_SECS_PER_M3) 반영 후 출발
  - Kakao sections[i] = points[i]→points[i+1] 매핑으로 정확한 구간 분리
- `src/app/admin/dispatch/page.tsx`
  - AutoDispatchPreview: Kakao 실측 데이터 우선 표시, fallback 하버사인
  - 구간 표시: "HH:MM → HH:MM · X분 · X.Xkm" (text-primary-dark, 실측)
  - 하버사인 fallback: "↓ 이동 약 X분 · Y.Ykm" (text-text-muted, 추정)
- `src/lib/db.ts`
  - `getBookingsPaginated`: 정렬 `created_at DESC` → `date ASC, created_at DESC` (수거 예정일 오름차순)
- `src/app/admin/dashboard/page.tsx`
  - 기본 activeTab: `"all"` → `"quote_confirmed"` (실무에서 견적확정 탭이 주요 작업 대상)

### 최근 작업 (2026-02-22) — 세션 4 (슬롯 관리 이전 + 캘린더 KST 버그)

**수정 파일 (2개)**
- `src/app/admin/calendar/page.tsx`
  - `addDays`/`getWeekStart`: `toISOString()` UTC → 로컬 날짜 포맷으로 수정 (< 버튼 2일 이동, > 무반응, 오늘 오인식 버그 수정)
  - 슬롯 관리 기능 전체 제거 (viewMode "daily"|"weekly"로 단순화, 약 200줄 제거)
- `src/app/admin/driver/page.tsx`
  - 슬롯 차단 관리 섹션 신규 추가 (기사 목록 하단)
  - 날짜 네비게이션, 기사 선택, 시간대별 예약 현황 + 차단/해제 기능
  - toastTimer unmount cleanup 추가 (메모리 누수 방지)

### 최근 작업 (2026-02-22) — 세션 3 (종합 버그 리뷰 + 입력 검증 강화)

**수정 파일 (2개)**
- `src/app/api/bookings/[id]/route.ts`
  - reschedule timeSlot: `length > 20` → `["10:00","12:00","14:00","16:00"]` enum 검증
  - reschedule confirmedTime: 고객 직접 변경 불가 (admin 전용 필드로 제한)
  - 날짜/시간 변경 시 confirmedTime null 초기화 (관리자 재확인 유도)
- `src/app/api/admin/bookings/[id]/route.ts`
  - Zod 검증 후 `body.*` 대신 `parsed.data.*` 사용 전체 통일
  - status check, allowedUpdates, audit log 모두 parsed.data 기준으로 변경

**종합 버그 리뷰 결과 (에이전트 2개 병렬 실행)**
- ETA 하차지 경유: 이미 수정됨 (dispatch-auto에서 unloadingCoordMap 삽입 정상)
- items 가격 조작: BookingCreateSchema에 min(0) 검증 있음 (false alarm)
- dispatch rollback 미검증: 에러 발생 시 로그 부재이나 기능 영향 없음 (수정 보류)
- geocoding 실패 시 주문 생성: 의도된 동작 (comment로 명시됨)

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

### 최근 작업 (2026-02-24) — 세션 9 (기존 기술 부채 및 보안 결함 전면 해소)

**보안 및 성능 전면 개편 로직 투입**
- `src/lib/server-price.ts`: `enforceServerItems` 유틸리티 신규 작성
- `src/lib/quote-calculator.ts`: 클라이언트에서 전달받는 임의 가격(테스트/조작) 대신 서버의 기준 DB(`spot-items.ts`)에 맞춰 단가와 예상 견적을 **강제 재계산**하도록 보안 수정. 단위 테스트(Vitest) 더미 데이터도 실제 단가 기준으로 갱신
- `src/app/api/bookings/route.ts`: 고객의 예약 POST 생성 시, 서버 재계산 단가로 덮어쓰기 로직 연동 완료 (단가 및 적재량 큐브 변조 방지)

---

### 주요 파일 구조
```
src/app/admin/dispatch/page.tsx       → 배차 관리 (자동배차 + 하차지 + 수동배차 + DnD + 골든앵글 무한 색상 분배 + 바텀시트 포커스트랩)
src/components/admin/KakaoMap.tsx     → 카카오맵 (마커 + 하차지 + 폴리라인)
src/lib/optimizer/                    → CVRP 엔진 (cluster, tsp, haversine, auto-dispatch)
src/lib/kakao-directions.ts           → Kakao Mobility 길찾기 API (ETA)
src/lib/quote-calculator.ts           → 주문/견적 재계산 로직
src/lib/server-price.ts               → [신규] 서버 단가 덮어쓰기 보안 유틸
...
```

### ⚠️ Tailwind v4 주의사항
- `@theme inline`에 `--spacing-sm/md/2xl/4xl` 정의 → `max-w-sm`, `max-w-2xl` 등이 spacing 값으로 오염됨. 항상 `max-w-[42rem]` 형태 사용

### TODO
1. DNS CNAME: spot.covering.co.kr → cname.vercel-dns.com (2026.02.24 검증 결과, 현재 `NXDOMAIN` 미전파 상태)
2. ~~Rate Limiting (전체 엔드포인트 누락 등)~~ ✅ 완료 (middleware 통제 완료)
3. ~~단일 주문 > 차량 용량 초과 등 배차 로직 예외 처리~~ ✅ 완료

### 알려진 이슈 (기존 부채 모두 해소됨)
- ~~기사 11명 이상 시 색상 중복 (10색 팔레트)~~ ✅ 이미 HSL(Golden Angle, 137.5도) 알고리즘으로 무한/비중복 색상 생성 로직 적용 확인 완료
- ~~모바일 바텀시트 포커스 트랩 없음~~ ✅ 배차 페이지 바텀시트에 a11y focus trap 이미 구현 확인
- ~~booking token 만료 없음 (고정 HMAC)~~ ✅ `booking-token.ts`에 이미 30일 윈도우 인덱스 만료/재발급 로직이 적용되어 있음
- ~~`dispatch-auto PUT`: driverName 클라이언트 입력 의존 위험~~ ✅ 이미 Node.js 서버 단에서 `allDrivers`를 fetch하여 `driverNameMap` 서버 조회 방식으로 변조 원천 차단 확인
- ~~getAllBookings() 전체 로드 메모리 누수~~ ✅ 대시보드 카운트에서는 별도의 가벼운 `getBookingStatusCounts()` 쿼리를 사용하도록 이미 최적화됨
- ~~items.price 클라이언트 조작 가능~~ ✅ 세션 9에서 서버 단가 강제 재계산(`server-price.ts` -> `enforceServerItems`) 연동으로 완벽 방어 완료
- DNS CNAME 미전파 (최상단 TODO와 동일)

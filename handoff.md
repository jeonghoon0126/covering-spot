## 커버링 방문수거 - 현재 상태

배포: https://coveringspot.vercel.app
커스텀 도메인: spot.covering.co.kr (Vercel에 등록됨, DNS CNAME 설정 필요)
GitHub: jeonghoon0126/covering-spot (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs, Node 24.x)
CI/CD: GitHub Actions (.github/workflows/deploy.yml) — push to main 시 자동 배포

### 최근 작업 (2026-02-21)

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

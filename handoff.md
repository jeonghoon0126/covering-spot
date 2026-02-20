## 커버링 방문수거 - 현재 상태

배포: https://coveringspot.vercel.app
커스텀 도메인: spot.covering.co.kr (Vercel에 등록됨, DNS CNAME 설정 필요)
GitHub: jeonghoon0126/covering-spot (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs, Node 24.x)
CI/CD: GitHub Actions (.github/workflows/deploy.yml) — push to main 시 자동 배포

### 최근 작업 (2026-02-21)

**하차지 + 자동배차 + 동선 최적화 전체 구현 (c1a355c)**

1. 하차지(UnloadingPoint) 관리
   - Supabase `unloading_points` 테이블 생성
   - CRUD API: GET/POST/PUT/DELETE `/api/admin/unloading-points`
   - 주소 입력 → 자동 지오코딩 (카카오 API)
   - 배차 페이지 내 하차지 관리 모달 (추가/삭제/활성 토글)

2. CVRP 자동배차 엔진 (순수 TypeScript, `src/lib/optimizer/`)
   - K-Means++ 지리적 클러스터링 (기사 수만큼 클러스터)
   - Nearest Neighbor + 2-opt TSP 경로 최적화
   - 하차지 자동 삽입 (누적 적재량 > 차량 용량 시)
   - 기사-클러스터 매칭 (큰 용량 기사 → 큰 클러스터)

3. 자동배차 API (`/api/admin/dispatch-auto`)
   - POST: 미리보기 (plan 반환, 적용 안 함)
   - PUT: 일괄 적용 (driverId + routeOrder 설정)

4. 배차 페이지 UI
   - "자동배차" 버튼 + "하차지 관리" 버튼
   - 자동배차 미리보기 패널 (기사별 루트 + 하차지 삽입 + 미배차 경고)
   - 레그별 적재량 바 (하차지 기준으로 레그 분할)
   - KakaoMap: ◆ 하차지 다이아몬드 마커 + 기사 색상 경로 폴리라인

5. 기타 개선
   - 예약 확인 페이지(step 5) 가독성 개선 (섹션 구분, 품목 카드)
   - 사다리차 필요여부 표시 추가
   - 배차 카드 기사 이름: 기사 색상 칩으로 개선
   - `bookings.route_order` 컬럼 추가

**이전 작업**
- 배차 페이지 크리티컬 버그 수정 + UX 개선 (e92da29, 55b1e84)
- 배차 UI/UX 전면 개선 (44c1a4e): 좌우 분할, 기사별 색상, 일괄 배차

**테스트 데이터**
- 기사 3명: 유대현(1톤), 김민수(1.4톤), 박정호(2.5톤)
- 더미 예약 20건: 2/20(12건) + 2/21(8건), 서울 전역, 좌표 포함

### 알려진 이슈
- DNS CNAME: spot.covering.co.kr → cname.vercel-dns.com 설정 필요
- 코드 리뷰 Low (미수정):
  - 기사 11명 이상 시 색상 중복 (10색 팔레트)
  - 모바일 바텀시트 포커스 트랩 없음
  - alert() 대신 토스트 사용 권장
- 누적 Medium (이전 Phase부터):
  - GET /api/bookings/{id} 토큰 없이 address/customerName 노출
  - Rate Limiting 전체 부재
  - getAllBookings() 메모리 로드 (상태 카운트용)

### 주요 파일 구조
```
src/app/admin/dispatch/page.tsx    → 배차 관리 (자동배차 + 하차지 + 수동배차)
src/components/admin/KakaoMap.tsx   → 카카오맵 (마커 + 하차지 + 폴리라인)
src/lib/optimizer/                  → CVRP 엔진 (cluster, tsp, haversine, auto-dispatch)
src/app/api/admin/dispatch-auto/   → 자동배차 API (미리보기 + 적용)
src/app/api/admin/unloading-points/ → 하차지 CRUD API
src/app/api/admin/dispatch/        → 수동 배차 API
src/app/api/admin/drivers/         → 기사 API
src/lib/db.ts                      → Supabase CRUD
src/lib/geocode.ts                 → 카카오 지오코딩
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
2. Rate Limiting 적용 (최소 인증 엔드포인트)
3. 기사 전용 뷰: 전화번호 로그인 → 당일 배차 주문만 표시
4. 드래그앤드롭 경로 순서 변경
5. 실시간 교통 정보 반영 (Kakao Directions API)

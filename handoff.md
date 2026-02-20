## 커버링 방문수거 - 현재 상태

배포: https://coveringspot.vercel.app
커스텀 도메인: spot.covering.co.kr (Vercel에 등록됨, DNS CNAME 설정 필요)
GitHub: jeonghoon0126/covering-spot (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs, Node 24.x)
CI/CD: GitHub Actions (.github/workflows/deploy.yml) — push to main 시 자동 배포

### 최근 작업 (2026-02-21)

**배차 페이지 2차 수정 — 버그 + UX 개선**
- 지도 마커 안 보이는 버그 수정 (KakaoMap initializeMap 이중 초기화 방지)
- 옵티미스틱 배차 업데이트 (배차/일괄배차/해제 시 스피너 없이 즉시 반영)
  - fetchData({ silent: true }) 패턴: 로딩 없이 백그라운드 동기화
  - 재배차 시 기존 기사 stats 차감 로직 포함
  - API 실패 시 fetchData() 전체 새로고침으로 롤백
- 기사 적재 현황: 좌측 패널 하단 → 지도 우측 상단 접이식 오버레이로 이동
- 배차 해제 버튼: X 아이콘 + 빨간 배경(bg-semantic-red-tint)으로 직관성 개선
- 헤더: justify-between → gap-3 flex-wrap (왼쪽 정렬)

**이전 작업 (2026-02-20)**
- 배차 페이지 크리티컬 버그 수정 (55b1e84): client-side exception, Zod nullable, CSS injection 방어, renderMarkers 최적화, AbortController, 시간대 버그, 중복 클릭 방지, 마커 라벨, 모바일 바텀시트
- 배차 UI/UX 전면 개선 (44c1a4e): 좌우 분할, 기사별 색상 마커, 시간대 그룹핑, 일괄 배차, panTo, 모바일 탭

**테스트 데이터**
- 기사 3명: 유대현(1톤), 김민수(1.4톤), 박정호(2.5톤)
- 더미 예약 20건: 2/20(12건) + 2/21(8건), 서울 전역, 좌표 포함

**이전 작업**
- KakaoMap 에러 핸들링 + 10초 타임아웃 + 도메인 등록 안내
- GitHub Actions 자동 배포 설정 (VERCEL_TOKEN secret)
- Kakao JS 키 설정 완료 (09507c43a23b7b222172585c4bfc1016)

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
src/app/admin/dispatch/page.tsx  → 배차 관리 (좌우분할, 일괄배차)
src/components/admin/KakaoMap.tsx → 카카오맵 (forwardRef, HEX색상, panTo)
src/app/api/admin/dispatch/      → 배차 API (GET 조회, POST 일괄배차)
src/app/api/admin/drivers/       → 기사 API (CRUD)
src/lib/db.ts                    → Supabase CRUD
src/lib/geocode.ts               → 카카오 지오코딩
```

### Supabase
- Project ref: agqynwvbswolmrktjsbw
- URL: https://agqynwvbswolmrktjsbw.supabase.co
- DB 직접 연결 불가 (IPv6 전용) - PostgREST API만 사용
- 테이블: bookings, drivers, leads, admin_users, admin_audit_log, push_subscriptions, blocked_slots

### ⚠️ Tailwind v4 주의사항
- `@theme inline`에 `--spacing-sm/md/2xl/4xl` 정의 → `max-w-sm`, `max-w-2xl` 등이 spacing 값으로 오염됨. 항상 `max-w-[42rem]` 형태 사용

### TODO
1. DNS CNAME: spot.covering.co.kr → cname.vercel-dns.com
2. Rate Limiting 적용 (최소 인증 엔드포인트)
3. 하차지(언로딩 포인트): 기사 루트 중간에 하차지 추가, 적재량 비움 후 재수거 (다음 스프린트)
4. 배차 드래그앤드롭 또는 경로 최적화 (향후)

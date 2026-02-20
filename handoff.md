## 커버링 방문수거 - 현재 상태

배포: https://coveringspot.vercel.app
커스텀 도메인: spot.covering.co.kr (Vercel에 등록됨, DNS CNAME 설정 필요)
GitHub: jeonghoon0126/covering-spot (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs, Node 24.x)
CI/CD: GitHub Actions (.github/workflows/deploy.yml) — push to main 시 자동 배포

### 최근 작업 (2026-02-20)

**배차 페이지 크리티컬 버그 수정 (55b1e84)**
- 마커/카드 클릭 시 client-side exception 수정 (useCallback 안정화)
- 배차 해제 실패 수정 (Zod driverId/driverName nullable 허용)
- CSS injection 방어 (sanitizeColor + 개별 style 속성)
- renderMarkers 최적화 (selectedIdRef 패턴, 선택 시 전체 재생성 방지)
- fetchData race condition 방지 (AbortController)
- 시간대 버그 수정 (formatDateShort, moveDate 순수 날짜 연산)
- 배차 중복 클릭 방지 (dispatching 가드 전체 적용)
- 지도 마커에 고객명 라벨 표시 + 줌 반응형
- 모바일 탭 전환 시 바텀시트 닫기

**배차 UI/UX 전면 개선 (44c1a4e)**
- 좌우 분할 레이아웃: 왼쪽 주문리스트(400px) + 오른쪽 지도
- 기사별 고유 색상 마커 (10색 팔레트, 미배차=파란)
- 시간대별 주문 그룹핑 (10~12시, 12~14시, 14~16시, 15~17시)
- 체크박스 다중 선택 + 일괄 배차 (기존 API 활용)
- 주문 카드 클릭 → 지도 panTo 연동 (KakaoMap forwardRef)
- KakaoMap: HEX 색상 직접 전달, panTo useImperativeHandle
- 모바일: 지도/목록 탭 전환 + 바텀시트 상세
- 기사 적재 현황: 왼쪽 패널 하단 세로 카드 (색상 도트 포함)

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
3. 배차 드래그앤드롭 또는 경로 최적화 (향후)

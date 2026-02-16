## 커버링 스팟 - 현재 상태

배포: https://coveringspot.vercel.app
GitHub: beige-ian/waste-management-landing (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs)

### 최근 작업 (2026-02-16)

**전역 아이콘 듀오톤 + 디자인 시스템 일관성 개선 (완료)**
- Pricing 4개 feature 아이콘: 라인 → 듀오톤 블루 SVG (chat, clock, home, dollar)
- Process 4개 스텝 아이콘: 신규 듀오톤 SVG 추가 (clipboard, truck, checkbox, receipt)
- complete 페이지 2개 상태 아이콘: 듀오톤 업그레이드 (green check, orange clock)
- ItemPrices: 호버/클릭 애니메이션 추가 (group-hover, icon-pop keyframe)
- /booking, /booking/manage: bg-white → bg-bg + border, ▲▼ → SVG 셰브론, raw checkbox/textarea → CDS 컴포넌트
- Compare: "카톡으로 간편한 견적" → "합리적이고 투명한 견적"
- 캐러셀: 피아노/악기 이미지 404 수정

**ItemPrices 아이콘 듀오톤 업그레이드 (완료, 11aa9e6)**
- 15종 라인 아이콘 → 블루 듀오톤 컬러 SVG 일러스트레이션으로 전면 교체

### 주요 파일 구조
```
src/app/booking/        → 예약 UI (page, complete, manage)
src/app/admin/          → 관리자 (page=로그인, dashboard, bookings/[id])
src/app/api/            → API Routes (bookings, leads, quote, slots 등)
src/lib/                → Supabase, 견적 계산, Slack 알림
src/data/               → 정적 데이터 (65지역, 470+품목, 사다리차)
src/components/sections/ → 홈페이지 섹션 (Hero, Process, Pricing 등)
src/components/ui/       → CDS 컴포넌트 라이브러리 (27개)
```

### ⚠️ Tailwind v4 주의사항
globals.css의 `@theme inline`에 `--spacing-sm/md/2xl/4xl` 정의 → `max-w-sm`, `max-w-2xl` 등이 spacing 값으로 오염됨. 항상 `max-w-[42rem]` 형태의 명시값 사용 필수.

### Supabase
- Project ref: agqynwvbswolmrktjsbw
- URL: https://agqynwvbswolmrktjsbw.supabase.co
- DB 직접 연결 불가 (IPv6 전용) - PostgREST API만 사용
- 테이블: bookings, leads (RLS 활성화)

### 알려진 이슈
- Slack 채널이 테스트용. 운영 시 C0ACBEFKPDJ로 전환 필요
- DB 직접 연결 불가 (IPv6 + 차단) - SQL Editor 사용 필요

### TODO
1. 배포 검증 (예약 생성/조회/수정 테스트)
2. 운영 Slack 채널 전환
3. 고객 SMS/카톡 알림 (견적 확정 시)

## 커버링 스팟 - 현재 상태

배포: https://coveringspot.vercel.app
GitHub: beige-ian/waste-management-landing (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs)

### 최근 작업 (2026-02-15)

**Supabase 마이그레이션 (진행 중)**
- Google Sheets DB → Supabase PostgreSQL 전환
- Google Drive 사진 → Supabase Storage 전환
- 코드 변경 완료, DB 테이블 생성 대기

Supabase 프로젝트 정보:
- Project ref: agqynwvbswolmrktjsbw
- URL: https://agqynwvbswolmrktjsbw.supabase.co
- DB host: db.agqynwvbswolmrktjsbw.supabase.co:5432
- DB user: postgres
- DB password: pmjeonghoon4189 (인증 실패 - 확인 필요)
- Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFncXlud3Zic3dvbG1ya3Rqc2J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTkyMzAsImV4cCI6MjA3OTI5NTIzMH0.JQvmiY0KhHqYUExI3Vjtrr0cSh4-JNWEVk4Wc71VNFo
- Publishable Key: sb_publishable_giMljHW9ULyAagWDPXpOPw_Zta4nc3v
- MCP: https://mcp.supabase.com/mcp?project_ref=agqynwvbswolmrktjsbw

코드 변경 완료 항목:
- src/lib/supabase.ts (신규) - Supabase 클라이언트
- src/lib/sheets-db.ts - Google Sheets → Supabase PostgREST
- src/app/api/upload/route.ts - Google Drive → Supabase Storage
- .env.local - Google 키 제거, Supabase 키 추가
- googleapis 패키지 제거, @supabase/supabase-js 설치
- 빌드 성공 확인

남은 작업:
1. Supabase에 bookings 테이블 생성 (DB 비밀번호 확인 필요)
2. Supabase Storage booking-photos 버킷 생성
3. Vercel 환경변수 업데이트 (Google → Supabase)
4. 배포 + 검증

**Phase 2 UI 개선 (완료, 커밋 완료)**
- Slack 알림에 관리자 페이지 액션 버튼 추가
- Nav: floating glass GNB, 앱 다운로드 버튼 (https://abr.ge/u7gjoq)
- FloatingCTA: 무료 견적 받기 + 온라인 예약하기 (2버튼)
- Hero: 신청조회 버튼 제거 (Nav에만 유지)
- Pricing: 단일 카드 테이블 레이아웃
- Compare: 영수증 스타일 테이블
- Footer: 실제 사업자 정보
- Process: 수거 신청/커버링 방문/수거 완료/정산
- 캐러셀: 에어컨 이미지 수정

### 주요 파일 구조
```
src/app/booking/        → 예약 UI (page, complete, manage)
src/app/admin/          → 관리자 (page=로그인, dashboard, bookings/[id])
src/app/api/            → API Routes
  api/bookings/         → 예약 CRUD
  api/admin/            → 관리자 API (auth, bookings)
  api/upload/           → 사진 업로드 (Supabase Storage)
src/lib/supabase.ts     → Supabase 클라이언트
src/lib/sheets-db.ts    → Supabase CRUD (snake_case ↔ camelCase 매핑)
src/lib/quote-calculator.ts → 견적 계산 (레인지: min/max)
src/lib/slack-notify.ts → Slack 알림 (생성/수정/삭제/견적확정/상태변경)
src/data/               → 정적 데이터 (65지역, 470+품목, 사다리차)
src/types/booking.ts    → TypeScript 인터페이스
src/components/sections/ → 홈페이지 섹션 (Hero, Process, Pricing 등)
src/hooks/              → 커스텀 훅 (useScrollReveal, useScrollPosition, useCarousel)
```

### DB 스키마 (bookings)
```
id: UUID (PK, gen_random_uuid)
date, time_slot, area: TEXT
items: JSONB (BookingItem[])
total_price, crew_size, ladder_price: INTEGER
need_ladder, has_elevator, has_parking: BOOLEAN
ladder_type: TEXT (nullable)
ladder_hours: INTEGER (nullable)
customer_name, phone, address, address_detail, memo, status, admin_memo: TEXT
created_at, updated_at: TIMESTAMPTZ
estimate_min, estimate_max: INTEGER
final_price: INTEGER (nullable)
photos: JSONB (string[])
```

### 상태 워크플로우
```
pending → quote_confirmed → in_progress → completed → payment_requested → payment_completed
       → cancelled / rejected
```

### Vercel 환경변수 (업데이트 필요)
현재 (제거 필요): GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, BOOKING_SPREADSHEET_ID, BOOKING_SHEET_NAME
추가 필요: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY
유지: SLACK_BOT_TOKEN, SLACK_CHANNEL_ID, ADMIN_PASSWORD

### 알려진 이슈
- Slack 채널이 테스트용. 운영 시 C0ACBEFKPDJ로 전환 필요
- DB 비밀번호 인증 실패 - 사용자에게 재확인 필요

### TODO
1. Supabase DB 테이블 + Storage 버킷 생성
2. Vercel 환경변수 업데이트 + 배포
3. 운영 Slack 채널 전환
4. 고객 SMS/카톡 알림 (견적 확정 시)

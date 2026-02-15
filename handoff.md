## 커버링 스팟 - 현재 상태

배포: https://coveringspot.vercel.app
GitHub: beige-ian/waste-management-landing (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs)

### 최근 작업 (2026-02-15)

**CDS 디자인 시스템 통합 (완료)**
- Figma MCP로 디자인 토큰 추출 (Typography/Spacing/Ratio/Interaction) ✅
- `.design-system.json` - CDS 전체 토큰 저장 (Primitive→Semantic→Component) ✅
- `globals.css` - brand 컬러팔레트, 시맨틱 컬러, CDS 스페이싱 토큰 반영 ✅
- Hero 채팅 애니메이션, FloatingCTA 리뉴얼, 브랜드 컬러 #1AA3FF 전역 적용 ✅

**Supabase 마이그레이션 (완료)**
- Google Sheets DB → Supabase PostgreSQL 전환 ✅
- bookings 테이블 생성 완료 ✅ (Management API로 DDL 실행)

Supabase 프로젝트 정보:
- Project ref: agqynwvbswolmrktjsbw
- URL: https://agqynwvbswolmrktjsbw.supabase.co
- Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFncXlud3Zic3dvbG1ya3Rqc2J3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzcxOTIzMCwiZXhwIjoyMDc5Mjk1MjMwfQ.1phGup7t3YQrFCZg9LaN2qKJfpyuUV8CrPiAHPqtJuc
- Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFncXlud3Zic3dvbG1ya3Rqc2J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTkyMzAsImV4cCI6MjA3OTI5NTIzMH0.JQvmiY0KhHqYUExI3Vjtrr0cSh4-JNWEVk4Wc71VNFo
- DB 직접 연결 불가 (IPv6 전용 + 인증 차단)
- Pooler 미지원 (Tenant not found)

### 주요 파일 구조
```
src/app/booking/        → 예약 UI (page, complete, manage)
src/app/admin/          → 관리자 (page=로그인, dashboard, bookings/[id])
src/app/api/            → API Routes
  api/bookings/         → 예약 CRUD
  api/admin/            → 관리자 API (auth, bookings)
  api/upload/           → 사진 업로드 (Supabase Storage)
src/lib/supabase.ts     → Supabase 클라이언트 (service_role)
src/lib/sheets-db.ts    → Supabase CRUD (snake_case ↔ camelCase 매핑)
src/lib/quote-calculator.ts → 견적 계산 (레인지: min/max)
src/lib/slack-notify.ts → Slack 알림 (생성/수정/삭제/견적확정/상태변경)
src/data/               → 정적 데이터 (65지역, 470+품목, 사다리차)
src/types/booking.ts    → TypeScript 인터페이스
src/components/sections/ → 홈페이지 섹션 (Hero, Process, Pricing 등)
```

### DB 스키마 (bookings - 생성 완료)
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

### Vercel 환경변수 (업데이트 완료)
- NEXT_PUBLIC_SUPABASE_URL ✅
- SUPABASE_SERVICE_ROLE_KEY ✅
- SLACK_BOT_TOKEN ✅
- SLACK_CHANNEL_ID ✅
- ADMIN_PASSWORD ✅
- (Google 관련 4개 제거됨)

### 알려진 이슈
- Slack 채널이 테스트용. 운영 시 C0ACBEFKPDJ로 전환 필요
- DB 직접 연결 불가 (IPv6 + 차단) - SQL Editor 사용 필요

### 디자인 시스템 참조
- `.design-system.json` - CDS 전체 토큰 (타이포/스페이싱/컬러/레이아웃그리드/비율/인터랙션)
- Figma: https://www.figma.com/design/QGO304gR4NUFzJkMbHEPz7
- Radius 토큰은 아직 미추출 (Figma node 504:9551)

### TODO
1. 배포 검증 (예약 생성/조회/수정 테스트)
2. 운영 Slack 채널 전환
3. 고객 SMS/카톡 알림 (견적 확정 시)
4. Radius 토큰 Figma에서 추출 후 반영
5. 컴포넌트 MCP 연동 (사용자 제공 예정)

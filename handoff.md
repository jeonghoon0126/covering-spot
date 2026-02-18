## 커버링 스팟 - 현재 상태

배포: https://coveringspot.vercel.app
커스텀 도메인: spot.covering.co.kr (Vercel에 등록됨, DNS CNAME 설정 필요)
GitHub: beige-ian/waste-management-landing (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs, Node 24.x)

### Vercel 프로젝트 정리 (2026-02-16)
- covering_spot: 프로덕션 (빌드 성공, GitHub 연동)
- waste-management-landing: GitHub 연동 해제됨 (레거시, 프레임워크가 Vite로 잘못 설정되어 빌드 실패 반복)

### 최근 작업 (2026-02-16)

**Phase 5: 캘린더 뷰 + 기사님 페이지 + SEO + 리네이밍**
- 커밋 043119b: Admin UX 개선 + SEO 전문 세팅
- 커밋 36a589c: 캘린더 뷰 + 기사님 전용 페이지 추가
- 커밋 b02da67: sheets-db.ts → db.ts 리네임

주요 변경:
- /admin/calendar: 일간 타임라인 (09:00-18:00, 30분 간격, 슬롯 가용성 표시)
- /admin/driver: 기사님 전용 (모바일 퍼스트, 전화/지도 딥링크, 퀵 상태변경)
- SEO: JSON-LD (LocalBusiness, FAQPage), OG/Twitter, 40+ keywords, robots.txt, sitemap
- 상세 페이지 isLocked: in_progress 이후 견적/시간/품목 수정 차단

### 주요 파일 구조
```
src/app/booking/        → 예약 UI (page, complete, manage)
src/app/admin/          → 관리자 (page=로그인, dashboard, calendar, driver, bookings/[id])
src/app/api/            → API Routes (bookings, leads, quote, slots, items/popular, audit 등)
src/lib/                → Supabase, 견적 계산, Slack 알림, SMS 알림, Google Auth
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
- 테이블: bookings, leads, admin_users, admin_audit_log (RLS 활성화)

### Admin 인증
- 비밀번호 로그인 (레거시): ADMIN_PASSWORD 환경변수
- Google OAuth: NEXT_PUBLIC_GOOGLE_CLIENT_ID 환경변수 (미설정 시 Google 버튼 미표시)
- 토큰 형식: Legacy `{exp}:{hmac}` / Google `{exp}:{adminId}:{email}:{hmac}`
- @covering.app 도메인만 허용, 자동 등록

### 알려진 이슈
- Slack 채널이 테스트용. 운영 시 C0ACBEFKPDJ로 전환 필요
- DB 직접 연결 불가 (IPv6 + 차단) - SQL Editor 사용 필요

### TODO (수동 작업)
1. DNS CNAME 설정: spot.covering.co.kr → cname.vercel-dns.com
2. GCP OAuth Client ID 생성 (covering-app-ccd23 프로젝트, JS origins에 coveringspot.vercel.app + localhost:3000)
3. Vercel 환경변수 추가: NEXT_PUBLIC_GOOGLE_CLIENT_ID
4. Solapi 크레덴셜 확보 후 Vercel 환경변수: SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER
5. admin_users에 실제 사용할 @covering.app 이메일 INSERT
6. Google Search Console 인증 코드 적용 (layout.tsx placeholder)
7. waste-management-landing Vercel 프로젝트 삭제 가능 (더 이상 사용 안 함)

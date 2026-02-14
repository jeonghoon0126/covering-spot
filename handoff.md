## 커버링 스팟 - 현재 상태

배포: https://coveringspot.vercel.app
GitHub: beige-ian/waste-management-landing (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs)

### 최근 작업
- 방문 수거 시스템 v2 리디자인 + 프로덕션 배포 완료 (2026-02-14)
  - 상담형 워크플로우 전환 (고객 신청 → CS팀 견적 확정 → 수거 → 정산)
  - 8단계 상태 관리 (pending→quote_confirmed→in_progress→completed→payment)
  - 견적 레인지 표시 (estimateMin~Max) + CS팀 최종 견적 확정
  - 사진 업로드 (Google Drive) + 작업환경 입력 (엘리베이터/주차)
  - 관리자 대시보드 (/admin) - 로그인/목록/상세/상태변경/견적확정/메모
  - Slack 알림 확장 (견적확정/상태변경 알림)
  - 고객 폼 6단계 리디자인 (시간→오전/오후/종일)
  - E2E 테스트 통과 (예약 생성/관리자 조회/견적확정/삭제)

### 주요 파일 구조
```
src/app/booking/        → 예약 UI (page, complete, manage)
src/app/admin/          → 관리자 (page=로그인, dashboard, bookings/[id])
src/app/api/            → API Routes
  api/bookings/         → 예약 CRUD
  api/admin/            → 관리자 API (auth, bookings)
  api/upload/           → 사진 업로드 (Google Drive)
src/lib/sheets-db.ts    → Google Sheets CRUD (26컬럼 A~Z)
src/lib/quote-calculator.ts → 견적 계산 (레인지: min/max)
src/lib/slack-notify.ts → Slack 알림 (생성/수정/삭제/견적확정/상태변경)
src/data/               → 정적 데이터 (65지역, 470+품목, 사다리차)
src/types/booking.ts    → TypeScript 인터페이스
```

### 상태 워크플로우
```
pending → quote_confirmed → in_progress → completed → payment_requested → payment_completed
       → cancelled / rejected
```

### Vercel 환경변수 (설정 완료)
- GOOGLE_SERVICE_ACCOUNT_EMAIL
- GOOGLE_PRIVATE_KEY
- BOOKING_SPREADSHEET_ID (1LxSTq1MzxjGN4UBGzNQ2WZJVGFntwWP6NDViwH32v7w)
- BOOKING_SHEET_NAME (bookings)
- SLACK_BOT_TOKEN
- SLACK_CHANNEL_ID (C0ABAM4DCQ5 - 테스트 채널)
- ADMIN_PASSWORD (covering2026admin)

### 알려진 이슈
- Slack 채널이 테스트용 (#제품팀_150l봉투). 운영 시 C0ACBEFKPDJ로 전환 필요
- 사진 업로드는 Google Drive 사용 (서비스 계정 권한). 별도 폴더 ID 미설정

### TODO
- 운영 Slack 채널 전환
- 고객 SMS/카톡 알림 (견적 확정 시)
- 사진 업로드용 Google Drive 폴더 생성 + UPLOAD_DRIVE_FOLDER_ID 설정

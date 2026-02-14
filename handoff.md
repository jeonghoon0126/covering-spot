## 커버링 스팟 - 현재 상태

배포: https://coveringspot.vercel.app
GitHub: beige-ian/waste-management-landing (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs)

### 최근 작업
- 온라인 예약 시스템 구현 + 프로덕션 배포 완료 (2026-02-14)
  - 5단계 예약 폼 (/booking)
  - Google Sheets DB 연동 (bookings 시트)
  - Slack 알림 (#제품팀_150l봉투)
  - E2E 테스트 통과 (예약 생성/중복방지/삭제)

### 주요 파일 구조
```
src/app/booking/        → 예약 UI (page, complete, manage)
src/app/api/            → API Routes (slots, items, areas, quote, bookings)
src/lib/sheets-db.ts    → Google Sheets CRUD
src/lib/quote-calculator.ts → 견적 계산
src/lib/slack-notify.ts → Slack Block Kit 알림
src/data/               → 정적 데이터 (56지역, 303품목, 사다리차)
src/types/booking.ts    → TypeScript 인터페이스
```

### Vercel 환경변수 (설정 완료)
- GOOGLE_SERVICE_ACCOUNT_EMAIL
- GOOGLE_PRIVATE_KEY
- BOOKING_SPREADSHEET_ID (1LxSTq1MzxjGN4UBGzNQ2WZJVGFntwWP6NDViwH32v7w)
- BOOKING_SHEET_NAME (bookings)
- SLACK_BOT_TOKEN
- SLACK_CHANNEL_ID (C0ABAM4DCQ5)

### 알려진 이슈
- 없음 (E2E 테스트 통과)

### TODO
- 예약 관리 페이지에 수정 기능 추가 (현재 취소만 가능)
- 관리자 대시보드 (예약 확정/완료 처리)
- 예약 확정 시 고객 SMS/카톡 알림

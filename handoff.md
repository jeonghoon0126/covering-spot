## 커버링 스팟 - 현재 상태

배포: https://coveringspot.vercel.app
GitHub: beige-ian/waste-management-landing (main 브랜치)
Vercel 프로젝트: covering_spot (framework: nextjs)

### 최근 작업 (2026-02-15)

**홈페이지/UX 전체 개선 (완료)**
- TrustBar: 카운트업 애니메이션 (IntersectionObserver + ease-out cubic) ✅
- FloatingCTA: 모바일/PC에 "신청 조회" 진입점 추가 ✅
- Hero: "기존 신청 조회하기" 링크 추가 ✅
- Pricing: "왜 커버링인가요" 호버 효과 ✅
- ItemPrices: 탭 전환 렉 수정 (double rAF → setTimeout) ✅
- FAQ: 하드코딩 maxHeight → ref 기반 동적 높이 ✅
- 예약 폼: 스텝 인디케이터에 스텝명 라벨 추가 (데스크톱) ✅
- useScrollPosition: rAF throttle로 스크롤 성능 최적화 ✅
- globals.css: 트랜지션 변수 통일 (ease-smooth, duration-*) ✅

**CDS 컴포넌트 라이브러리 구축 + 프로덕트 적용 (완료)**
- Figma MCP로 30개 노드 추출 → 27개 React 컴포넌트 구현 ✅
- booking/complete/manage/admin 페이지에 CDS 컴포넌트 적용 ✅
- 예약 폼: Kakao Daum Postcode 주소 검색, 전화번호 포맷팅, 유효성 검사 ✅

**Supabase 마이그레이션 (완료)**
- Google Sheets DB → Supabase PostgreSQL 전환 ✅

Supabase 프로젝트 정보:
- Project ref: agqynwvbswolmrktjsbw
- URL: https://agqynwvbswolmrktjsbw.supabase.co
- Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFncXlud3Zic3dvbG1ya3Rqc2J3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzcxOTIzMCwiZXhwIjoyMDc5Mjk1MjMwfQ.1phGup7t3YQrFCZg9LaN2qKJfpyuUV8CrPiAHPqtJuc
- Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFncXlud3Zic3dvbG1ya3Rqc2J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTkyMzAsImV4cCI6MjA3OTI5NTIzMH0.JQvmiY0KhHqYUExI3Vjtrr0cSh4-JNWEVk4Wc71VNFo
- DB 직접 연결 불가 (IPv6 전용 + 인증 차단)

### 주요 파일 구조
```
src/app/booking/        → 예약 UI (page, complete, manage)
src/app/admin/          → 관리자 (page=로그인, dashboard, bookings/[id])
src/app/api/            → API Routes
src/lib/                → Supabase, 견적 계산, Slack 알림
src/data/               → 정적 데이터 (65지역, 470+품목, 사다리차)
src/types/booking.ts    → TypeScript 인터페이스
src/components/sections/ → 홈페이지 섹션 (Hero, Process, Pricing 등)
src/components/ui/       → CDS 컴포넌트 라이브러리 (27개)
```

### CDS 컴포넌트 라이브러리 (src/components/ui/)
```
버튼: Button, IconButton, LinkButton, NavButton, ActionButton, OptionButton
폼: TextField, TextArea, Dropdown, Radio, Checkbox, Counter, SegmentedField
UI: Divider, Chip, Label, DotBadge, NumberBadge
인디케이터: LoadingSpinner, IndicatorDot, IndicatorNumber
컨테이너: GeneralHeader, ModalHeader, Banner, CasualBanner, MessageItem, MessageBox
```

### 디자인 시스템 참조
- `.design-system.json` - CDS 전체 토큰 (타이포/스페이싱/컬러/레이아웃그리드/비율/Radius/인터랙션)
- Figma: https://www.figma.com/design/QGO304gR4NUFzJkMbHEPz7
- Figma MCP: localhost:3845 (피그마 데스크탑 앱 필요)

### 알려진 이슈
- Slack 채널이 테스트용. 운영 시 C0ACBEFKPDJ로 전환 필요
- DB 직접 연결 불가 (IPv6 + 차단) - SQL Editor 사용 필요

### TODO
1. 배포 검증 (예약 생성/조회/수정 테스트)
2. 운영 Slack 채널 전환
3. 고객 SMS/카톡 알림 (견적 확정 시)
4. Figma 디자인 시스템 누락 컴포넌트 있으면 사용자에게 MCP 링크 요청

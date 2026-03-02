# covering-spot 프로젝트 컨텍스트

## 프로젝트 정보
- GitHub: https://github.com/jeonghoon0126/covering-spot
- 로컬: /Users/wjh/covering-spot
- 배포: Vercel 자동배포 (main push 시)
- Supabase: ref=agqynwvbswolmrktjsbw, Token: sbp_2d9bd53a4d9d657642598b0cdbf1b4ff79f92b8c
  주의: PostgREST만 사용 (Vercel Lambda IPv6 미지원)

### 노션 문서 (API 변경 시 반드시 업데이트)
- API 명세서: https://www.notion.so/API-3135e589dc9f813aa201e0602f392199 (page_id: 3135e589-dc9f-813a-a201-e0602f392199)
  - API 라우트 추가/수정/삭제 시 → 해당 섹션 즉시 업데이트
  - 배포 완료 후 → "배포 히스토리" 섹션에 날짜·커밋·변경 내용 추가
- 부모 페이지: 2a15e589-dc9f-80f3-8ac2-efddb8156bf6 (DB 스키마와 같은 위치)

### 노션 업데이트 규칙 (위반 금지)
1. /api/admin/* 또는 /api/* 파일 추가·수정·삭제 → API 명세서 해당 섹션 업데이트
2. git push 완료 후 → 배포 히스토리 섹션에 한 줄 추가 (날짜 | 커밋 | 변경 요약)
3. 노션 업데이트는 코드 push와 같은 세션에서 즉시 처리 (나중으로 미루기 금지)

## Covering-specific API 키

### Mixpanel
- API Secret: e4006f1d77d820bb5ef065d8d7a31a93, Project ID: 3160293

### 채널톡
- x-access-key: 6996a4aae53084de2ef1 / x-access-secret: 202b66502294066fbbe655a035e3fd37

### Airbridge
- API 토큰: 041f3a7b4d8c46fab54a0808888906f8 / 트래킹링크: 8df53a0a8fdb44608effa4e1d293245d
- 앱: coveringprod, Actuals API: POST https://api.airbridge.io/reports/api/v7/apps/coveringprod/actuals/query
- 비동기: taskId 반환 → GET polling (status=SUCCESS면 actuals.data.rows)

### Grafana
- URL: https://grafana.covering.app/, Token: glsa_IvkCCVSYkni9nEumX8Tdw1rsEqqVYY6n_0de7cd34
- 서비스 계정 토큰 (beige-service-account, Editor): glsa_ARAhQ0CPu0QyhQwevMRCQJz8kyRq1bSJ_55a3aa85
- 수정 가능 폴더: Product만 (uid: af92ernp3skxsc) ← 다른 폴더 절대 금지
- 데이터소스: BigQuery (uid: ff6963jbsw35sd)
- BQ 주의: GROUP BY/ORDER BY에 alias 금지(숫자 1,2,3) / timeseries는 TIMESTAMP() 변환 / format 필드 제거
- 워크플로우: BQ 테스트 후 패널 생성 (테스트 없이 만들기 금지)

### Slack (커바니_방문수거)
- 웹훅: https://hooks.slack.com/services/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
- Bot Token: xoxb-974992099777-10506719154145-bajhbtUDvIWKWwMXopwBDV1y
- 채널: C0ACBEFKPDJ (#pj_대형대량폐기물-수거-견적-진행상황)
- 시트: 1Y8ztdzT-Y08-XOkKSX-jryLJFT4r1ID4nuzRcN9ddTU

### 백오피스
- API: https://admin-api.covering.app (GET만, Access Token만)
- 로그인: beige@covering.app / 579b1ce9

## 두발히어로 API
- PROD: https://partner-api.prod.dhero.kr, Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2RlIjoiY292ZXJpbmcyMCIsImlhdCI6MTc1NTY0ODk3NH0.xC_9y3JZgBg5ocE8zqwDsRqNIF208_8Abrw3VZDi3eA
- DEV: https://partner-api.dev.dhero.kr, Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2RlIjoiY292ZXJpbmcyMCIsImlhdCI6MTc1NTY0ODkwNX0.JH6eb6VZo8I3jrnMqqVUi-_2MUPIgZzj2Z59bq4tiEA
- Spot Code: 10558, POST /deliveries (memoFromCustomer 사용)

## 배포 전 코드리뷰 QA (코딩 직후 자동으로, 별도 요청 없이, 생략 절대 금지)

구현 완료 후 git push 전에 반드시 아래 체크리스트를 직접 실행 (확인만 아닌 실제 코드 검증):

1. 요구사항 완전성: 요청된 모든 기능이 구현됐는지 파일별 diff 확인
2. 타입 일관성: 새 status/필드 추가 시 → types/, validation.ts, 모든 STATUS_LABELS/COLORS/MESSAGES 전파 여부
3. API 계층 일관성: 고객 API / 어드민 API / DB 스키마 모두 동기화됐는지
4. UI 누락 체크: 새 status가 모든 페이지(admin/dashboard, admin/calendar, admin/bookings/[id], booking/manage)에 반영됐는지
5. Slack 알림 누락: 새 상태 변경에 대한 알림 함수가 호출되는지
6. 빌드 에러: `npm run build` 실행해서 TypeScript 컴파일 에러 없는지 확인 (빌드 통과 후 push)

위반 시: 한 번이라도 누락되면 반드시 이 정책을 다시 읽고 추가 수정 후 재빌드

## 배포 후 필수 체크리스트 (git push 직후 자동으로, 별도 요청 없이, 생략 금지)

1. 배포 브리핑: 배포 트리거 방식 + 배포 URL + 롤백 커밋 명시
2. GitHub Actions 실행 결과 모니터링 → success/failure 보고 (curl GitHub API로 확인)
3. 서비스 헬스체크 (API 엔드포인트 curl로 정상 응답 확인)
4. 테스트 체크리스트 (수동 검증 항목 명시)

## 데이터 파이프라인 (Apps Script)
- 에어브릿지 광고비: 1dgfG3NvzF1RQWnCCRR6vnA_2DqxSMgQWmTJfn4hcS6GZDjHD4L4v8UZj
- 채널톡 CX: 11OE242xNpJ9CeMpG977CqHOGYE5isAedkD8vNqfRqnQlx_Hm64A8cSmu
- clasp: export PATH="/tmp/node-v20.11.0-darwin-arm64/bin:$PATH" && clasp clone {script_id}
  토큰 갱신: ~/.clasprc.json refresh_token 사용 (재인증 불필요)

## 150L 봉투 배송 자동화
- Sheets: 1om1j9IHFfzwc4Zmlu7oSfP4wW1hAmyd6QiiV9TuNOkQ
- Script: 16gPpayPje7VEuVUVPjcVA2jG4gC2kbzdMPlWW3WcW7vjmdniQpweWG-H
- 웹앱: https://script.google.com/macros/s/AKfycbyiR7R15K_DCpue6WfZCOTcffU2P4k1Fswv9iTgMlbAS6ULXzPKpnl6fJ9uAWYTVc94aQ/exec
- Google Sheets 서비스 계정: google-sheets@covering-app-ccd23.iam.gserviceaccount.com, 키: ~/.config/gcloud/sheets-service-account.json

---

# BigQuery & 데이터 분석

## 설정
프로젝트: covering-app-ccd23, 데이터셋: secure_dataset
테이블: PostgreSQL view_user → BQ user / view_order → BQ order / 나머지 동일명
동기화: 준실시간 스트림 (분 단위 공백 없음), 약 30~40분 딜레이 (2026-02-27 재실측 — 개발자 "1시간 배치" 언급과 유사, 분석 쿼리엔 무관하나 실시간 모니터링엔 부적합)
클라이언트: `from google.cloud import bigquery; client = bigquery.Client(project="covering-app-ccd23")`
gcloud: /Users/wjh/google-cloud-sdk/bin/gcloud
PostgreSQL PROD DB 직접 접근 금지 / 한글 컬럼명 금지

## 핵심 필터
```sql
-- 활성 사용자
WHERE withdrawal_date IS NULL

-- 유료 주문 (생활쓰레기)
WHERE name = 'DEFAULT_GARBAGE'
  AND payment_policy_id IS NOT NULL
  AND deleted_date IS NULL
  AND status IN ('PAYMENT_COMPLETED', 'COMPLETED', 'CHECK_COMPLETED')

-- 대형폐기물(150L): is_medium_pickup_bag = true
-- 방문수거: name = 'BBEGI_PARTNER_PICKUP_ORDER'
-- 취소 시각: order_status_log.created_date WHERE status='USER_CANCELED'
-- (order.updated_date는 배차 해지로 덮어써짐 → 사용 금지)
```

## 쿼리 부하 원칙
날짜 범위 3개월 제한 / LIMIT / SELECT * 금지 / CTE 사용 / 인덱스 컬럼(created_date, user_id) 우선
쿼리 넣을 때 데이터 추출 정책을 주석으로 작성 (처음 보는 사람도 이해할 수 있도록)

## 주요 테이블
- secure_dataset: user, order, user_coupon, coupon_policy, order_receipt_v2, order_status_log
- ads_data.daily_cost: 에어브릿지 광고비 (매일 09:00 KST 싱크)
- ads_data.user_acquisition_channel: 에어브릿지 유저 어트리뷰션 (2026-02-11 시작, user_id/ad_channel/ad_campaign/signup_date)
- ads_data.daily_cost_creative: 크리에이티브별 광고 성과
- cx_data.channel_talk_*: 채널톡 CX (매일 06:00 KST 싱크)
- product.brand_msg_experiment_users (user_id, variant, segment)
- product.brand_msg_daily

## order_receipt_v2 주의
- 결제 금액 컬럼: total_amount (price 아님)
- 결제 완료 필터: payment_status = 'COMPLETED' (PAID 아님)
- order 테이블과 JOIN: order_receipt_v2.order_id = order.id

## 에어브릿지 어트리뷰션 (CAC/LTV) 주의사항
- user_acquisition_channel은 2026-02-11부터 적재 시작 → 그 이전 데이터 없음
- CAC 계산 시 daily_cost와 user_acquisition_channel 기간 반드시 일치시킬 것
  (불일치 시 CAC 수십만원으로 과대계산됨 — 실제로 Meta 25만원 오류 발생)
- 채널 매핑: facebook.business + instagram → Meta / google.adwords → Google / apple.searchads → Apple / tiktok → TikTok
- 신뢰할 수 있는 CAC/LTV 분석 가능 시점: 2026-03-13 이후 (D30 전환 반영)

## 정합성 체크 패턴 (user_acquisition_channel)
```python
# 일별 적재 현황 / orphan / 중복 / 설치→가입율 동시 체크
# 설치→가입율 정상 범위: Google 20~25%, Meta 25~30%, Apple 28~33%, TikTok 20~25%
```

## Mixpanel
- 로그인 전 이벤트: device_id 사용 (distinct_id는 로그인 시 user_id로 변경 → 금지)
- 가입 이벤트: SignupCompletedScreen (1/19 이전) / CoveringBagOfferScreen (1/19 이후) 둘 다
- 주차 기준: DATE_TRUNC(DATE(created_date, 'Asia/Seoul'), WEEK(MONDAY))

## 분석 원칙 (PO 프레임워크)
현상 확인 → 문제 정의 → 가설 수립 → 검증 → 실험/액션
데이터 사이언티스트 수준 엄밀성 + 초등학생도 이해하는 쉬운 설명
항상 데이터를 신뢰할 수 있는지 검증 후 사용 / 사용자 가설이 틀리면 즉시 솔직하게 말할 것

## 분석 보고 구조 (절대 생략 금지)
0. 요약 3~5줄
1. 가설 + 배경
2. ✅ 채택 / ❌ 기각 / 🟡 불확실
3. 로우데이터 10-20행 + 집계 테이블 + ASCII 막대(█░)
4. p-value + "우연일 확률 X%"
5. 일상 언어 해석 (전문용어는 괄호 안에만)
시각화: 터미널은 ASCII █░, 노션은 테이블

## A/B 테스트 DID
- ITT: Variant 전체 vs Control (노출 효과, 편향 없음)
- Per-Protocol: 실제 사용자 vs Control (선택 편향 주의)
- DID = (Variant After - Before) - (Control After - Before)
- Before 동질성 검증 먼저 / ITT 음수인데 Per-Protocol 양수면 선택 편향 의심

## 브랜드 메시지 실험
- Wave 1 발송: 02/11, 24,000명 (V1 방문수거 + V2 대형폐기물 × 3세그먼트 × 4,000명)
- 재분석: D14(02/25), D30(03/13)

## order 테이블 수거 지연
pickup_end_time이 06:00 아니면 지연. 저빈도 유저 지연 → 리텐션 -6.28%p (p=0.0049, 유의)

## 터미널 출력 형식 (ASCII)

```
제목 (━━ 라인으로 구분)
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ① 지표명                                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

    Before  █████████████████░░░░░░░░░░░░░░  33.0%
    After   █████████████████████████████░░  56.9%
            0%              50%            100%

    [원천: BigQuery secure_dataset.XXX]
    - 조건: 필터 조건 명시
    - 기간: 분석 기간 명시
```

구조: 제목 → 지표별 섹션(┏┗ 박스) → ASCII 막대(█=채움, ░=빈칸) → 원천 소스 → 요약 테이블 → 결론

## PO 분석 요청 프레임워크

```
[배경] 왜 이게 궁금한지 한 줄
[가설] 내 예상 + 반드시 실제 데이터로 뒷받침 (느낌/추측 금지)
[검증] 가설 맞으면 나와야 할 데이터
[반증] 가설 틀리면 나와야 할 데이터 / 다른 설명 가능한 요인
[액션] 결과에 따라 할 행동
```

원칙: 검증 + 반증 동시에 분석 (편향 방지) / 통계적 유의성 항상 포함 / 결론은 의사결정 가능한 형태로

## Grafana 패널 필수 규칙

패널 생성/수정 시 description 필드에 반드시 명세 포함 (생략 절대 금지):
- 목적: 이 패널이 왜 필요한지 한 줄
- 지표 정의: 분모/분자, 계산 공식, 코호트 기준
- 데이터 정책: 원천 테이블, 필터 조건, 상태값
- 기존 대비 변경점 (있을 경우)
- 주의사항/한계 (관측기간 미도래, 외부 테이블 등)

참고: 제품팀 KR 패널 디스크립션 수준으로 상세하게 작성

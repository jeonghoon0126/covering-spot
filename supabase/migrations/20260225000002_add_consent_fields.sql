-- 수거 신청 시 약관 동의 항목 저장
-- agreed_to_terms: 서비스 이용약관 동의 (필수)
-- agreed_to_privacy: 개인정보 수집·이용 동의 (필수)
-- agreed_to_marketing: 마케팅 정보 수신 동의 (선택)
-- agreed_to_night_notification: 야간 수신 동의 21:00~익일08:00 (선택)

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS agreed_to_terms BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS agreed_to_privacy BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS agreed_to_marketing BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS agreed_to_night_notification BOOLEAN NOT NULL DEFAULT false;

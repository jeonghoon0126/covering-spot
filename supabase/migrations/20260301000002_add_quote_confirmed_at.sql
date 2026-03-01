-- 견적 확정 타임스탬프: 자동 만료(7일) 기준으로 사용
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS quote_confirmed_at TIMESTAMPTZ;

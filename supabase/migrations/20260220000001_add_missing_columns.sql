-- Phase 9: bookingToRow()가 사용하는 7개 컬럼이 DB에 누락된 문제 수정
-- 원인: init.sql에 27개 컬럼만 정의, db.ts bookingToRow()는 34개 필드 매핑
-- 영향: admin 수동 예약 생성 실패, Slack 스레딩 불가

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confirmed_time TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confirmed_duration INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completion_photos JSONB NOT NULL DEFAULT '[]';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS slack_thread_ts TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT;

-- 복수 타임슬롯 선택 지원: 고객이 신청 시 선호 시간대를 복수로 선택할 수 있도록
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preferred_slots TEXT[] DEFAULT '{}';

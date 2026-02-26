-- 차량 마스터 테이블
-- 기사와 분리된 독립 도메인. 차량 자체의 속성(용량, 종류, 번호판)만 관리.
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                        -- 식별용 이름 (예: "1톤 A", "2.5톤 B")
  type TEXT NOT NULL DEFAULT '1톤',          -- '1톤' | '1.4톤' | '2.5톤' | '5톤'
  capacity NUMERIC(5,2) NOT NULL DEFAULT 4.8, -- 적재량 (m³)
  license_plate TEXT,                        -- 차량번호 (선택)
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_vehicles_active ON vehicles(active);

-- 차량 이용불가 기간 테이블
-- 수리, 검사 등으로 특정 기간 차량을 배차에서 제외할 때 사용.
CREATE TABLE IF NOT EXISTS vehicle_unavailable_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,                  -- YYYY-MM-DD
  end_date TEXT NOT NULL,                    -- YYYY-MM-DD (inclusive)
  reason TEXT NOT NULL DEFAULT '',           -- 사유 (예: "정기점검", "수리")
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE vehicle_unavailable_periods DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_vup_vehicle_id ON vehicle_unavailable_periods(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vup_dates ON vehicle_unavailable_periods(start_date, end_date);

-- 기사-차량 일별 배정 테이블
-- 특정일에 어떤 기사가 어떤 차량을 운행하는지 매칭.
-- UNIQUE 제약: 한 기사는 하루에 차량 1대, 한 차량은 하루에 기사 1명.
CREATE TABLE IF NOT EXISTS driver_vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                        -- YYYY-MM-DD
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(driver_id, date),
  UNIQUE(vehicle_id, date)
);
ALTER TABLE driver_vehicle_assignments DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_dva_date ON driver_vehicle_assignments(date);
CREATE INDEX IF NOT EXISTS idx_dva_driver_id ON driver_vehicle_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_dva_vehicle_id ON driver_vehicle_assignments(vehicle_id);

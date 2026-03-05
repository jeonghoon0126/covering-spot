-- 이벤트 추적 테이블 (Mixpanel 이벤트를 DB에도 적재 → Grafana 대시보드용)
CREATE TABLE IF NOT EXISTS spot_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name text NOT NULL,
  properties jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spot_events_name ON spot_events(event_name);
CREATE INDEX IF NOT EXISTS idx_spot_events_created ON spot_events(created_at);

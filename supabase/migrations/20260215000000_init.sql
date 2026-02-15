CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  area TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total_price INTEGER NOT NULL DEFAULT 0,
  crew_size INTEGER NOT NULL DEFAULT 1,
  need_ladder BOOLEAN NOT NULL DEFAULT false,
  ladder_type TEXT,
  ladder_hours INTEGER,
  ladder_price INTEGER NOT NULL DEFAULT 0,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  address_detail TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  has_elevator BOOLEAN NOT NULL DEFAULT false,
  has_parking BOOLEAN NOT NULL DEFAULT false,
  estimate_min INTEGER NOT NULL DEFAULT 0,
  estimate_max INTEGER NOT NULL DEFAULT 0,
  final_price INTEGER,
  photos JSONB NOT NULL DEFAULT '[]',
  admin_memo TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;

import { NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require("pg");

const CREATE_TABLE_SQL = `
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
`;

const PROJECT_REF = "agqynwvbswolmrktjsbw";
const DB_PASSWORD = "pmjeonghoon4189";
const IPV6_ADDR = "2406:da14:271:990b:c9d0:c824:f419:ad79";

async function tryConnect(config: Record<string, unknown>, label: string) {
  const client = new Client(config);
  try {
    await client.connect();
    await client.query(CREATE_TABLE_SQL);
    const check = await client.query(
      "SELECT count(*) FROM information_schema.tables WHERE table_name = 'bookings'",
    );
    await client.end();
    return { success: true, label, rows: check.rows };
  } catch (e) {
    try { await client.end(); } catch {}
    return { success: false, label, error: String(e).slice(0, 200) };
  }
}

export async function GET() {
  const ssl = { rejectUnauthorized: false };
  const timeout = 10000;

  // Try multiple connection methods in parallel
  const attempts = await Promise.all([
    // 1. Direct hostname
    tryConnect({
      host: `db.${PROJECT_REF}.supabase.co`,
      port: 5432, user: "postgres", password: DB_PASSWORD,
      database: "postgres", ssl, connectionTimeoutMillis: timeout,
    }, "direct-hostname"),

    // 2. IPv6 address directly
    tryConnect({
      host: IPV6_ADDR,
      port: 5432, user: "postgres", password: DB_PASSWORD,
      database: "postgres", ssl, connectionTimeoutMillis: timeout,
    }, "direct-ipv6"),

    // 3. Pooler ap-northeast-1
    tryConnect({
      host: `aws-0-ap-northeast-1.pooler.supabase.com`,
      port: 6543, user: `postgres.${PROJECT_REF}`, password: DB_PASSWORD,
      database: "postgres", ssl, connectionTimeoutMillis: timeout,
    }, "pooler-ne1-tx"),

    // 4. Pooler ap-northeast-2
    tryConnect({
      host: `aws-0-ap-northeast-2.pooler.supabase.com`,
      port: 6543, user: `postgres.${PROJECT_REF}`, password: DB_PASSWORD,
      database: "postgres", ssl, connectionTimeoutMillis: timeout,
    }, "pooler-ne2-tx"),

    // 5. Pooler ap-southeast-1
    tryConnect({
      host: `aws-0-ap-southeast-1.pooler.supabase.com`,
      port: 6543, user: `postgres.${PROJECT_REF}`, password: DB_PASSWORD,
      database: "postgres", ssl, connectionTimeoutMillis: timeout,
    }, "pooler-se1-tx"),

    // 6. Pooler session mode
    tryConnect({
      host: `aws-0-ap-northeast-1.pooler.supabase.com`,
      port: 5432, user: `postgres.${PROJECT_REF}`, password: DB_PASSWORD,
      database: "postgres", ssl, connectionTimeoutMillis: timeout,
    }, "pooler-ne1-session"),

    // 7. Fly pooler nrt
    tryConnect({
      host: `fly-0-nrt.pooler.supabase.com`,
      port: 6543, user: `postgres.${PROJECT_REF}`, password: DB_PASSWORD,
      database: "postgres", ssl, connectionTimeoutMillis: timeout,
    }, "fly-nrt"),

    // 8. Fly pooler icn
    tryConnect({
      host: `fly-0-icn.pooler.supabase.com`,
      port: 6543, user: `postgres.${PROJECT_REF}`, password: DB_PASSWORD,
      database: "postgres", ssl, connectionTimeoutMillis: timeout,
    }, "fly-icn"),
  ]);

  const success = attempts.find((a) => a.success);
  if (success) {
    return NextResponse.json({ success: true, method: success.label, attempts });
  }

  return NextResponse.json({ success: false, attempts }, { status: 500 });
}

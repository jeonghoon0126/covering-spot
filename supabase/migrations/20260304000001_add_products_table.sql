-- products 테이블: 품목별 상세 정보 (치수, 무게, 별칭 포함)
-- spot_items는 견적 계산에 연결된 기존 테이블로 유지.
-- products는 향후 AI 품목 인식, 검색 자동완성 등에 활용할 보조 테이블.

CREATE TABLE IF NOT EXISTS public.products (
  id           INTEGER PRIMARY KEY,
  category     TEXT NOT NULL,
  name         TEXT NOT NULL,
  display_name TEXT,
  width        NUMERIC,
  depth        NUMERIC,
  height       NUMERIC,
  volume       NUMERIC,
  unit_price   INTEGER NOT NULL,
  weight       NUMERIC,
  item_group   TEXT,
  aliases      TEXT[]
);

-- RLS: 읽기는 anon 포함 누구나 허용, 쓰기는 service_role만
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_read" ON public.products
  FOR SELECT USING (true);

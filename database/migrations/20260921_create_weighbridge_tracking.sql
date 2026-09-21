-- ==============================================================================
-- MIGRATION: Tạo bảng weighbridge_tracking cho Sổ Theo Dõi Phiếu Cân
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Dán toàn bộ script này và bấm RUN.
-- ==============================================================================

-- 1. Tạo bảng chuyên biệt cho sổ theo dõi phiếu cân (weighbridge_tracking)
CREATE TABLE IF NOT EXISTS public.weighbridge_tracking (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stt INTEGER,
    time_str TEXT,
    plate_number TEXT NOT NULL,
    tttp NUMERIC(10,2) DEFAULT 0,
    limit_weight NUMERIC(10,2) DEFAULT 0,
    ticket_no TEXT,
    source_ticket_no TEXT,
    cargo_type TEXT,
    weight_1 NUMERIC(12,2) DEFAULT 0,
    weight_2 NUMERIC(12,2) DEFAULT 0,
    weight_net NUMERIC(12,2) NOT NULL DEFAULT 0,
    weight_tons NUMERIC(10,3) NOT NULL DEFAULT 0,
    direction TEXT DEFAULT 'Xuất',
    barge_name TEXT,
    order_no TEXT,
    customer TEXT,
    date1_obj TIMESTAMPTZ,
    date2_obj TIMESTAMPTZ,
    notes TEXT,
    is_recovered BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tạo các chỉ mục (Indexes) để tăng tốc tối đa việc lọc và tìm kiếm
CREATE INDEX IF NOT EXISTS idx_weighbridge_tracking_date1 ON public.weighbridge_tracking (date1_obj DESC);
CREATE INDEX IF NOT EXISTS idx_weighbridge_tracking_plate ON public.weighbridge_tracking (plate_number);
CREATE INDEX IF NOT EXISTS idx_weighbridge_tracking_ticket ON public.weighbridge_tracking (ticket_no);
CREATE INDEX IF NOT EXISTS idx_weighbridge_tracking_order ON public.weighbridge_tracking (order_no);
CREATE INDEX IF NOT EXISTS idx_weighbridge_tracking_customer ON public.weighbridge_tracking (customer);
CREATE INDEX IF NOT EXISTS idx_weighbridge_tracking_time_str ON public.weighbridge_tracking (time_str);
CREATE INDEX IF NOT EXISTS idx_weighbridge_tracking_recovered ON public.weighbridge_tracking (is_recovered);

-- 3. Cấu hình Row Level Security (RLS) cho phép ứng dụng client (anon key) thực hiện CRUD
ALTER TABLE public.weighbridge_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read weighbridge_tracking" ON public.weighbridge_tracking;
CREATE POLICY "Allow anon read weighbridge_tracking" ON public.weighbridge_tracking 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert weighbridge_tracking" ON public.weighbridge_tracking;
CREATE POLICY "Allow anon insert weighbridge_tracking" ON public.weighbridge_tracking 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update weighbridge_tracking" ON public.weighbridge_tracking;
CREATE POLICY "Allow anon update weighbridge_tracking" ON public.weighbridge_tracking 
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow anon delete weighbridge_tracking" ON public.weighbridge_tracking;
CREATE POLICY "Allow anon delete weighbridge_tracking" ON public.weighbridge_tracking 
    FOR DELETE USING (true);

-- ==============================================================================
-- MIGRATION: Tạo bảng weighbridge_allocation_tracking cho Sổ Theo Dõi Phân Bổ Tải Trọng
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Dán toàn bộ script này và bấm RUN.
-- ==============================================================================

-- 1. Tạo bảng chuyên biệt cho sổ theo dõi phân bổ tải trọng sà lan
CREATE TABLE IF NOT EXISTS public.weighbridge_allocation_tracking (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    barge_id BIGINT,
    barge_name TEXT,
    vessel_id BIGINT,
    vessel_name TEXT,
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
    order_no TEXT,
    customer TEXT,
    date1_obj TIMESTAMPTZ,
    date2_obj TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tạo các chỉ mục (Indexes) để tăng tốc truy vấn, tìm kiếm và lọc theo sà lan/ngày
CREATE INDEX IF NOT EXISTS idx_wb_alloc_tracking_barge_id ON public.weighbridge_allocation_tracking (barge_id);
CREATE INDEX IF NOT EXISTS idx_wb_alloc_tracking_date1 ON public.weighbridge_allocation_tracking (date1_obj DESC);
CREATE INDEX IF NOT EXISTS idx_wb_alloc_tracking_plate ON public.weighbridge_allocation_tracking (plate_number);
CREATE INDEX IF NOT EXISTS idx_wb_alloc_tracking_ticket ON public.weighbridge_allocation_tracking (ticket_no);
CREATE INDEX IF NOT EXISTS idx_wb_alloc_tracking_order ON public.weighbridge_allocation_tracking (order_no);
CREATE INDEX IF NOT EXISTS idx_wb_alloc_tracking_created_at ON public.weighbridge_allocation_tracking (created_at DESC);

-- 3. Cấu hình Row Level Security (RLS) cho phép ứng dụng client (anon key) thực hiện CRUD
ALTER TABLE public.weighbridge_allocation_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read weighbridge_allocation_tracking" ON public.weighbridge_allocation_tracking;
CREATE POLICY "Allow anon read weighbridge_allocation_tracking" ON public.weighbridge_allocation_tracking 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert weighbridge_allocation_tracking" ON public.weighbridge_allocation_tracking;
CREATE POLICY "Allow anon insert weighbridge_allocation_tracking" ON public.weighbridge_allocation_tracking 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update weighbridge_allocation_tracking" ON public.weighbridge_allocation_tracking;
CREATE POLICY "Allow anon update weighbridge_allocation_tracking" ON public.weighbridge_allocation_tracking 
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow anon delete weighbridge_allocation_tracking" ON public.weighbridge_allocation_tracking;
CREATE POLICY "Allow anon delete weighbridge_allocation_tracking" ON public.weighbridge_allocation_tracking 
    FOR DELETE USING (true);

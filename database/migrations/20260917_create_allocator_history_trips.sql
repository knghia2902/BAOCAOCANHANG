-- ==============================================================================
-- MIGRATION: Tạo bảng allocator_history_trips và chỉ mục tối ưu hóa hiệu năng
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Dán toàn bộ file này và bấm RUN.
-- ==============================================================================

-- 1. Tạo bảng chuyên biệt cho lịch sử phân bổ tải trọng
CREATE TABLE IF NOT EXISTS public.allocator_history_trips (
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

-- 2. Tạo các chỉ mục (Indexes) để tăng tốc truy vấn lọc theo ngày, biển số, lệnh, khách hàng
CREATE INDEX IF NOT EXISTS idx_allocator_history_date1 ON public.allocator_history_trips (date1_obj DESC);
CREATE INDEX IF NOT EXISTS idx_allocator_history_plate ON public.allocator_history_trips (plate_number);
CREATE INDEX IF NOT EXISTS idx_allocator_history_ticket ON public.allocator_history_trips (ticket_no);
CREATE INDEX IF NOT EXISTS idx_allocator_history_order ON public.allocator_history_trips (order_no);
CREATE INDEX IF NOT EXISTS idx_allocator_history_customer ON public.allocator_history_trips (customer);
CREATE INDEX IF NOT EXISTS idx_allocator_history_time_str ON public.allocator_history_trips (time_str);
CREATE INDEX IF NOT EXISTS idx_allocator_history_recovered ON public.allocator_history_trips (is_recovered);

-- 3. Cấu hình Row Level Security (RLS) cho phép client (anon key) thực hiện CRUD
ALTER TABLE public.allocator_history_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read allocator_history_trips" ON public.allocator_history_trips;
CREATE POLICY "Allow anon read allocator_history_trips" ON public.allocator_history_trips 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert allocator_history_trips" ON public.allocator_history_trips;
CREATE POLICY "Allow anon insert allocator_history_trips" ON public.allocator_history_trips 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update allocator_history_trips" ON public.allocator_history_trips;
CREATE POLICY "Allow anon update allocator_history_trips" ON public.allocator_history_trips 
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow anon delete allocator_history_trips" ON public.allocator_history_trips;
CREATE POLICY "Allow anon delete allocator_history_trips" ON public.allocator_history_trips 
    FOR DELETE USING (true);

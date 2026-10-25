-- ==============================================================================
-- MIGRATION: Bổ sung trường thông tin cố định Nguồn tàu (Master Data Fields)
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Dán script này và bấm RUN.
-- ==============================================================================

-- 1. Bổ sung các cột lưu thông tin cố định của Nguồn tàu vào bảng weighbridge_vessels
ALTER TABLE public.weighbridge_vessels 
    ADD COLUMN IF NOT EXISTS customer TEXT,
    ADD COLUMN IF NOT EXISTS cargo_type TEXT,
    ADD COLUMN IF NOT EXISTS cargo_code TEXT;

-- 2. Thêm chỉ mục để tăng tốc độ tìm kiếm theo khách hàng và loại hàng
CREATE INDEX IF NOT EXISTS idx_weighbridge_vessels_customer ON public.weighbridge_vessels (customer);
CREATE INDEX IF NOT EXISTS idx_weighbridge_vessels_cargo_type ON public.weighbridge_vessels (cargo_type);

-- 3. Cập nhật quyền truy cập bảng cho authenticated users
GRANT ALL ON TABLE public.weighbridge_vessels TO authenticated;
GRANT ALL ON TABLE public.weighbridge_vessels TO anon;
GRANT ALL ON TABLE public.weighbridge_vessels TO service_role;

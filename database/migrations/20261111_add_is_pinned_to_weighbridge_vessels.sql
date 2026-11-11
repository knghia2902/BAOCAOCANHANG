-- ==============================================================================
-- MIGRATION: Bổ sung trường is_pinned cho bảng weighbridge_vessels để ghim tàu đặc biệt
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Dán script này và bấm RUN.
-- ==============================================================================

-- 1. Thêm cột is_pinned vào bảng weighbridge_vessels
ALTER TABLE public.weighbridge_vessels 
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- 2. Thêm chỉ mục để tăng tốc độ truy vấn các tàu được ghim
CREATE INDEX IF NOT EXISTS idx_weighbridge_vessels_is_pinned ON public.weighbridge_vessels (is_pinned);

-- 3. Đảm bảo cấp quyền truy cập bảng cho người dùng
GRANT ALL ON TABLE public.weighbridge_vessels TO authenticated;
GRANT ALL ON TABLE public.weighbridge_vessels TO anon;
GRANT ALL ON TABLE public.weighbridge_vessels TO service_role;

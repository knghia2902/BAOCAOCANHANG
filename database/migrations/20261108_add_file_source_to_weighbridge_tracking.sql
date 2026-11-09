-- ==============================================================================
-- MIGRATION: Bổ sung cột file_source (Đầu cân 1 / Đầu cân 2) cho Sổ Theo Dõi
-- Quy tắc phân tách:
--   - Đầu cân 1 (FILE_1): Số phiếu có định dạng xxxxxx/26A (kết thúc bằng /..A)
--   - Đầu cân 2 (FILE_2): Số phiếu có định dạng xxxxxx/26B (kết thúc bằng /..B)
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Dán toàn bộ script này và bấm RUN.
-- ==============================================================================

-- 1. Thêm cột file_source: 'FILE_1' (Đầu cân 1 - 26A), 'FILE_2' (Đầu cân 2 - 26B), 'MANUAL'
ALTER TABLE public.weighbridge_tracking
    ADD COLUMN IF NOT EXISTS file_source TEXT;

-- 2. Cập nhật dữ liệu theo định dạng số phiếu xxxxxx/26A (FILE_1) và xxxxxx/26B (FILE_2)
UPDATE public.weighbridge_tracking
SET file_source = CASE
    WHEN upper(coalesce(ticket_no, source_ticket_no, '')) ~ '/\s*\d*A(\M|$)' OR upper(coalesce(ticket_no, source_ticket_no, '')) ~ '\d+A$' THEN 'FILE_1'
    WHEN upper(coalesce(ticket_no, source_ticket_no, '')) ~ '/\s*\d*B(\M|$)' OR upper(coalesce(ticket_no, source_ticket_no, '')) ~ '\d+B$' THEN 'FILE_2'
    WHEN upper(coalesce(direction, '')) LIKE '%NHAP%' OR upper(coalesce(direction, '')) LIKE '%NHẬP%' THEN 'FILE_1'
    ELSE 'FILE_2'
END;

-- 3. Chỉ mục tăng tốc lọc theo đầu cân
CREATE INDEX IF NOT EXISTS idx_weighbridge_tracking_file_source ON public.weighbridge_tracking (file_source);

-- 4. Làm mới schema cache của PostgREST
NOTIFY pgrst, 'reload schema';

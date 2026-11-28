-- ==============================================================================
-- MIGRATION: TẠO BẢNG THEO DÕI CONTAINER EASTWOOD (HẠ CONT / LOAD CONT / TRẢ CONT)
-- Ngày tạo: 2026-11-28
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Dán toàn bộ script và bấm RUN.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.eastwood_container_events (
    id TEXT PRIMARY KEY,
    flow_type TEXT NOT NULL CHECK (flow_type IN ('HA_CONT', 'LOAD_CONT', 'TRA_CONT')),
    container_no TEXT NOT NULL,
    so_phieu TEXT DEFAULT '',
    ma_lenh TEXT DEFAULT '',
    plate_number TEXT DEFAULT '',
    romooc_no TEXT DEFAULT '',
    seal_no TEXT DEFAULT '',
    board_type TEXT DEFAULT '', -- 'Có ván' | 'Không ván' | ''
    gross_weight_kg NUMERIC DEFAULT 0,
    tare_weight_kg NUMERIC DEFAULT 0,
    net_weight_kg NUMERIC DEFAULT 0,
    actual_date TEXT NOT NULL, -- YYYY-MM-DD (Ngày thực tế cân ra)
    report_date TEXT NOT NULL, -- YYYY-MM-DD (Ngày báo cáo theo ca 06:00 sáng)
    weigh_in_date TEXT DEFAULT '',
    weigh_in_time TEXT DEFAULT '',
    weigh_out_date TEXT DEFAULT '',
    weigh_out_time TEXT DEFAULT '',
    event_datetime TEXT NOT NULL, -- YYYY-MM-DDTHH:mm:ss (Ngày giờ thực tế dùng tính trạng thái bãi)
    barge_info TEXT DEFAULT '',
    vessel_name TEXT DEFAULT '',
    source_factory TEXT DEFAULT '',
    warehouse_note TEXT DEFAULT '',
    remark TEXT DEFAULT '',
    raw_note TEXT DEFAULT '',
    customer_name TEXT DEFAULT 'EASTWOOD',
    cargo_type TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ew_cont_events_container_no ON public.eastwood_container_events(container_no);
CREATE INDEX IF NOT EXISTS idx_ew_cont_events_flow_type ON public.eastwood_container_events(flow_type);
CREATE INDEX IF NOT EXISTS idx_ew_cont_events_report_date ON public.eastwood_container_events(report_date);
CREATE INDEX IF NOT EXISTS idx_ew_cont_events_actual_date ON public.eastwood_container_events(actual_date);
CREATE INDEX IF NOT EXISTS idx_ew_cont_events_event_dt ON public.eastwood_container_events(event_datetime);

-- Bật Row Level Security (RLS) tương thích Mode A (đăng nhập nội bộ)
ALTER TABLE public.eastwood_container_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.eastwood_container_events TO anon, authenticated;
GRANT ALL ON TABLE public.eastwood_container_events TO service_role;

DROP POLICY IF EXISTS "Allow all operations on eastwood_container_events" ON public.eastwood_container_events;
DROP POLICY IF EXISTS "Mode A - Internal manage eastwood_container_events" ON public.eastwood_container_events;

CREATE POLICY "Mode A - Internal manage eastwood_container_events"
    ON public.eastwood_container_events
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

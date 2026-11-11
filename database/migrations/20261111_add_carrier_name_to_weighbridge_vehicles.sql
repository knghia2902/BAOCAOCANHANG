-- ==============================================================================
-- MIGRATION: Bổ sung trường carrier_name cho bảng weighbridge_vehicles
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Dán script này và bấm RUN.
-- ==============================================================================

ALTER TABLE public.weighbridge_vehicles 
    ADD COLUMN IF NOT EXISTS carrier_name TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_weighbridge_vehicles_carrier_name ON public.weighbridge_vehicles (carrier_name);

GRANT ALL ON TABLE public.weighbridge_vehicles TO authenticated;
GRANT ALL ON TABLE public.weighbridge_vehicles TO anon;
GRANT ALL ON TABLE public.weighbridge_vehicles TO service_role;

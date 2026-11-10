-- Migration: Expand warehouse_configs check constraint to support Bách Khoa at Kho 4
-- Created at: 2026-11-10

-- 1. Drop old restrictive CHECK constraint on warehouse_id if exists
ALTER TABLE public.warehouse_configs 
DROP CONSTRAINT IF EXISTS warehouse_configs_warehouse_id_check;

-- 2. Add updated CHECK constraint supporting KHO 4 - BK (or general warehouse keys)
ALTER TABLE public.warehouse_configs 
ADD CONSTRAINT warehouse_configs_warehouse_id_check 
CHECK (warehouse_id IN ('KHO 1', 'KHO 2', 'KHO 3', 'KHO 4', 'KHO 4 - BK'));

-- 3. Seed initial default config for Bách Khoa at Kho 4 (initial stock = 0 tons)
INSERT INTO public.warehouse_configs (warehouse_id, initial_stock, initial_date, current_customer, daily_remarks)
VALUES
    ('KHO 4 - BK', 0, '', 'BÁCH KHOA', '{}'::jsonb)
ON CONFLICT (warehouse_id) DO NOTHING;

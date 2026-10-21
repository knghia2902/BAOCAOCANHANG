-- Migration: Create 4-Warehouse Daily Morning Inventory tables
-- Created at: 2026-10-21

-- 1. Table: warehouse_inventory_tickets (Stores IMPORT, EXPORT, and DIRECT weighbridge tickets)
CREATE TABLE IF NOT EXISTS public.warehouse_inventory_tickets (
    id TEXT PRIMARY KEY,
    so_phieu TEXT NOT NULL,
    ma_lenh TEXT DEFAULT '',
    report_date TEXT NOT NULL, -- YYYY-MM-DD (after 06:00 AM shift cutoff)
    weigh_in_date TEXT DEFAULT '',
    weigh_in_time TEXT DEFAULT '',
    weigh_out_date TEXT NOT NULL,
    weigh_out_time TEXT NOT NULL,
    flow_type TEXT NOT NULL CHECK (flow_type IN ('IMPORT', 'EXPORT', 'DIRECT')),
    warehouse_id TEXT CHECK (warehouse_id IN ('KHO 1', 'KHO 2', 'KHO 3', 'KHO 4') OR warehouse_id IS NULL),
    customer_name TEXT DEFAULT '',
    cargo_type TEXT DEFAULT '',
    vehicle_plate TEXT NOT NULL,
    carrier_name TEXT DEFAULT '',
    gross_weight NUMERIC DEFAULT 0,
    tare_weight NUMERIC DEFAULT 0,
    net_weight NUMERIC DEFAULT 0, -- Stored in Tons (e.g. 42.20)
    factory_weight NUMERIC DEFAULT NULL, -- KL Phiếu nhà máy (Tons) for IMPORT
    barge_info TEXT DEFAULT '', -- Loai Salan for EXPORT / DIRECT
    vessel_name TEXT DEFAULT '', -- Tàu mẹ / Đích đến for EXPORT / DIRECT
    source_or_remark TEXT DEFAULT '', -- Tai Xe (Factory name for IMPORT, Direct source for DIRECT)
    raw_note TEXT DEFAULT '', -- Ghi Chu gốc
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_inv_tickets_report_date ON public.warehouse_inventory_tickets(report_date);
CREATE INDEX IF NOT EXISTS idx_warehouse_inv_tickets_warehouse_id ON public.warehouse_inventory_tickets(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inv_tickets_flow_type ON public.warehouse_inventory_tickets(flow_type);

-- 2. Table: warehouse_configs (Stores initial stock, current customer, and daily remarks for KHO 1..4)
CREATE TABLE IF NOT EXISTS public.warehouse_configs (
    warehouse_id TEXT PRIMARY KEY CHECK (warehouse_id IN ('KHO 1', 'KHO 2', 'KHO 3', 'KHO 4')),
    initial_stock NUMERIC DEFAULT 0,
    initial_date TEXT DEFAULT '',
    current_customer TEXT DEFAULT '',
    daily_remarks JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default 4 warehouses if not exists
INSERT INTO public.warehouse_configs (warehouse_id, initial_stock, initial_date, current_customer, daily_remarks)
VALUES
    ('KHO 1', 0, '', 'GỖ BÌNH ĐỊNH', '{}'::jsonb),
    ('KHO 2', 0, '', 'GỖ BÌNH ĐỊNH', '{}'::jsonb),
    ('KHO 3', 0, '', 'GỖ BÌNH ĐỊNH', '{}'::jsonb),
    ('KHO 4', 0, '', 'EASTWOOD', '{}'::jsonb)
ON CONFLICT (warehouse_id) DO NOTHING;

-- 3. Table: warehouse_vehicles (Stores SO XE -> NHÀ XE lookup from Data sheet)
CREATE TABLE IF NOT EXISTS public.warehouse_vehicles (
    vehicle_plate TEXT PRIMARY KEY,
    display_plate TEXT NOT NULL,
    carrier_name TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and allow public/authenticated access (consistent with existing tables)
ALTER TABLE public.warehouse_inventory_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_vehicles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'warehouse_inventory_tickets' AND policyname = 'Allow all operations on warehouse_inventory_tickets'
    ) THEN
        CREATE POLICY "Allow all operations on warehouse_inventory_tickets"
            ON public.warehouse_inventory_tickets FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'warehouse_configs' AND policyname = 'Allow all operations on warehouse_configs'
    ) THEN
        CREATE POLICY "Allow all operations on warehouse_configs"
            ON public.warehouse_configs FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'warehouse_vehicles' AND policyname = 'Allow all operations on warehouse_vehicles'
    ) THEN
        CREATE POLICY "Allow all operations on warehouse_vehicles"
            ON public.warehouse_vehicles FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

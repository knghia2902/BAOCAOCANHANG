-- Migration: Add composite & lookup indexes for Wave 2 query performance (Phase 24 - LOW-1)
-- Hướng dẫn: Dán toàn bộ nội dung file này vào Supabase SQL Editor và bấm Run.

-- 1. Bảng warehouse_inventory_tickets: tối ưu sắp xếp mặc định (report_date ASC, weigh_out_time ASC) và tra cứu số phiếu
DO $$
BEGIN
    IF to_regclass('public.warehouse_inventory_tickets') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_warehouse_tickets_report_date_weigh_out
            ON public.warehouse_inventory_tickets (report_date ASC, weigh_out_time ASC);
        CREATE INDEX IF NOT EXISTS idx_warehouse_tickets_so_phieu
            ON public.warehouse_inventory_tickets (so_phieu);
    END IF;
END $$;

-- 2. Bảng weighbridge_allocation_tracking: tối ưu truy vấn lịch sử phân bổ theo sà lan mới nhất
DO $$
BEGIN
    IF to_regclass('public.weighbridge_allocation_tracking') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_allocation_tracking_barge_created
            ON public.weighbridge_allocation_tracking (barge_id, created_at DESC);
    END IF;
END $$;

-- 3. Bảng weighbridge_trucks: tối ưu truy vấn danh sách phiếu cân theo sà lan (bao gồm getTrucksByBargeIds)
DO $$
BEGIN
    IF to_regclass('public.weighbridge_trucks') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_weighbridge_trucks_barge_created
            ON public.weighbridge_trucks (barge_id, created_at ASC, id ASC);
    END IF;
END $$;

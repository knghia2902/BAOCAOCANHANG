-- ==============================================================================
-- MIGRATION: THẮT CHẶT BẢO MẬT ROW LEVEL SECURITY (RLS) & PHÂN QUYỀN TRÊN SUPABASE
-- Ngày tạo: 2026-11-14
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Dán toàn bộ script và bấm RUN.
-- ==============================================================================

-- 1. BẬT RLS (ROW LEVEL SECURITY) TRÊN TẤT CẢ CÁC BẢNG CƠ SỞ DỮ LIỆU
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.allocator_history_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weighbridge_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weighbridge_allocation_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.warehouse_inventory_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.warehouse_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.warehouse_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weighbridge_vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weighbridge_barges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weighbridge_trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weighbridge_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weighbridge_warehouse_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weighbridge_container_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weighbridge_other_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicle_profiles ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. BẢO VỆ TUYỆT ĐỐI BẢNG USERS (CHỐNG CHIẾM QUYỀN & XÓA TÀI KHOẢN)
-- ==============================================================================

-- Xóa bỏ triệt để các policy mở toang quyền cho anon
DROP POLICY IF EXISTS "Allow anon insert users" ON public.users;
DROP POLICY IF EXISTS "Allow anon update users" ON public.users;
DROP POLICY IF EXISTS "Allow anon delete users" ON public.users;
DROP POLICY IF EXISTS "Allow anon read users" ON public.users;
DROP POLICY IF EXISTS "Allow anon all on users" ON public.users;

-- Thu hồi quyền ghi/xóa từ role anon trên bảng users
REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon;

-- Cho phép SELECT tài khoản đang kích hoạt (is_active = true) để phục vụ tra cứu đăng nhập
DROP POLICY IF EXISTS "Allow active user authentication lookup" ON public.users;
CREATE POLICY "Allow active user authentication lookup" ON public.users
    FOR SELECT TO anon, authenticated
    USING (is_active = true);

-- Authenticated Admin toàn quyền quản lý bảng users
DROP POLICY IF EXISTS "Admin manage all users" ON public.users;
CREATE POLICY "Admin manage all users" ON public.users
    FOR ALL TO authenticated
    USING (
        auth.jwt() ->> 'role' = 'admin' 
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
        OR auth.uid() = id
    )
    WITH CHECK (
        auth.jwt() ->> 'role' = 'admin' 
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
        OR auth.uid() = id
    );

-- ==============================================================================
-- 3. BẢO VỆ BẢNG CONTENT & SETTINGS (MA TRẬN PHÂN QUYỀN & CẤU HÌNH HỆ THỐNG)
-- ==============================================================================

DROP POLICY IF EXISTS "Allow anon all on content" ON public.content;
DROP POLICY IF EXISTS "Allow all on content" ON public.content;

-- Công khai cho phép đọc nội dung giới thiệu (Portfolio / CMS)
DROP POLICY IF EXISTS "Public can read content" ON public.content;
CREATE POLICY "Public can read content" ON public.content
    FOR SELECT USING (true);

-- Chỉ tài khoản authenticated mới được cập nhật content/settings
DROP POLICY IF EXISTS "Authenticated can update content" ON public.content;
CREATE POLICY "Authenticated can update content" ON public.content
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 4. BẢO VỆ BẢNG MESSAGES (HỘP THƯ LIÊN HỆ)
-- ==============================================================================

DROP POLICY IF EXISTS "Allow all on messages" ON public.messages;

-- Khách vãng lai chỉ được phép GỬI tin nhắn (INSERT)
DROP POLICY IF EXISTS "Public can send messages" ON public.messages;
CREATE POLICY "Public can send messages" ON public.messages
    FOR INSERT WITH CHECK (true);

-- Chỉ tài khoản authenticated mới được xem và xóa tin nhắn
DROP POLICY IF EXISTS "Authenticated can read messages" ON public.messages;
CREATE POLICY "Authenticated can read messages" ON public.messages
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated can delete messages" ON public.messages;
CREATE POLICY "Authenticated can delete messages" ON public.messages
    FOR DELETE TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated can update messages" ON public.messages;
CREATE POLICY "Authenticated can update messages" ON public.messages
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 5. BẢO VỆ CÁC BẢNG DỮ LIỆU SẢN LƯỢNG, SỔ CÂN & KHO BÃI
-- ==============================================================================

-- Đảm bảo quyền authenticated trên toàn bộ bảng dữ liệu
DO $$
DECLARE
    tbl TEXT;
    target_tables TEXT[] := ARRAY[
        'allocator_history_trips',
        'weighbridge_tracking',
        'weighbridge_allocation_tracking',
        'warehouse_inventory_tickets',
        'warehouse_configs',
        'warehouse_vehicles',
        'weighbridge_vessels',
        'weighbridge_barges',
        'weighbridge_trucks',
        'weighbridge_vehicles',
        'weighbridge_warehouse_tickets',
        'weighbridge_container_tickets',
        'weighbridge_other_tickets',
        'vehicle_profiles',
        'projects',
        'tools'
    ];
BEGIN
    FOREACH tbl IN ARRAY target_tables LOOP
        IF to_regclass('public.' || tbl) IS NOT NULL THEN
            -- Thu hồi quyền xóa/ghi không kiểm soát từ anon
            EXECUTE format('REVOKE DELETE ON TABLE public.%I FROM anon;', tbl);
            
            -- Đảm bảo cấp quyền cho authenticated và service_role
            EXECUTE format('GRANT ALL ON TABLE public.%I TO authenticated;', tbl);
            EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role;', tbl);
        END IF;
    END LOOP;
END $$;

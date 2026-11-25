-- ==============================================================================
-- MIGRATION: BẢO MẬT ROW LEVEL SECURITY (RLS) & PHÂN QUYỀN TRÊN SUPABASE
-- Ngày tạo: 2026-11-14 (Cập nhật tương thích đăng nhập nội bộ: 2026-11-25)
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Dán toàn bộ script và bấm RUN.
-- ==============================================================================
--
-- KIẾN TRÚC 2 CHẾ ĐỘ (2 MODES) — ĐỌC KỸ TRƯỚC KHI CHẠY:
--
-- [MODE A — ĐANG KÍCH HOẠT MẶC ĐỊNH TRONG SCRIPT NÀY]
--   Tương thích với cơ chế đăng nhập nội bộ hiện tại qua bảng `public.users`
--   (không tạo Supabase Auth JWT, nên Postgres nhận diện session là role `anon`).
--   • Bật RLS (`ENABLE ROW LEVEL SECURITY`) trên toàn bộ 19 bảng dữ liệu.
--   • Tạo các policy rõ ràng, idempotent cho `anon` và `authenticated` để KHÔNG
--     làm hỏng các thao tác của tài khoản `admin` nội bộ (CRUD tài khoản trên
--     `public.users`, lưu `role_permissions` vào `public.content`, quản lý hộp
--     thư `public.messages` và toàn bộ các bảng nghiệp vụ cân hàng / kho bãi).
--   • Bổ sung hàm RPC `SECURITY DEFINER`:
--     `public.verify_internal_user(p_username text, p_password_hash text)`
--     làm lớp đệm sẵn sàng cho bước cô lập cột `password_hash` trong tương lai.
--   • Dọn dẹp các trường mật khẩu cũ còn sót trong `public.content.settings`.
--
-- [MODE B — KHỐI COMMENT Ở CUỐI FILE (STRICT SUPABASE AUTH JWT)]
--   Chứa toàn bộ lệnh `REVOKE ... FROM anon` và policy `TO authenticated` nghiêm
--   ngặt (chống truy cập trực tiếp bằng anon key).
--   CHỈ BỎ COMMENT VÀ CHẠY MODE B SAU KHI toàn bộ tài khoản (bao gồm `admin` và
--   nhân viên) đã được migrate sang Supabase Auth (`auth.users`) và đăng nhập
--   bằng JWT hợp lệ.
-- ==============================================================================

-- ==============================================================================
-- PHẦN 1: BẬT ROW LEVEL SECURITY (RLS) TRÊN TOÀN BỘ 19 BẢNG
-- ==============================================================================
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
-- PHẦN 2 (MODE A - ACTIVE): CHÍNH SÁCH RLS TƯƠNG THÍCH ĐĂNG NHẬP NỘI BỘ
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 2.1. Bảng `public.users` (Tài khoản nội bộ & Quản trị người dùng)
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO anon, authenticated;
GRANT ALL ON TABLE public.users TO service_role;

-- Dọn các policy cũ có thể xung đột
DROP POLICY IF EXISTS "Allow anon read users" ON public.users;
DROP POLICY IF EXISTS "Allow anon insert users" ON public.users;
DROP POLICY IF EXISTS "Allow anon update users" ON public.users;
DROP POLICY IF EXISTS "Allow anon delete users" ON public.users;
DROP POLICY IF EXISTS "Allow anon all on users" ON public.users;
DROP POLICY IF EXISTS "Allow active user authentication lookup" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read users" ON public.users;
DROP POLICY IF EXISTS "Admin can manage all users" ON public.users;
DROP POLICY IF EXISTS "Admin manage all users" ON public.users;
DROP POLICY IF EXISTS "Mode A - Internal users select" ON public.users;
DROP POLICY IF EXISTS "Mode A - Internal users insert" ON public.users;
DROP POLICY IF EXISTS "Mode A - Internal users update" ON public.users;
DROP POLICY IF EXISTS "Mode A - Internal users delete" ON public.users;

CREATE POLICY "Mode A - Internal users select" ON public.users
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Mode A - Internal users insert" ON public.users
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Mode A - Internal users update" ON public.users
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Mode A - Internal users delete" ON public.users
    FOR DELETE TO anon, authenticated
    USING (true);

-- ------------------------------------------------------------------------------
-- 2.2. Bảng `public.content` (CMS, Settings & Ma trận `role_permissions`)
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content TO anon, authenticated;
GRANT ALL ON TABLE public.content TO service_role;

DROP POLICY IF EXISTS "Allow anon all on content" ON public.content;
DROP POLICY IF EXISTS "Allow all on content" ON public.content;
DROP POLICY IF EXISTS "Public can view content" ON public.content;
DROP POLICY IF EXISTS "Public can read content" ON public.content;
DROP POLICY IF EXISTS "Authenticated users can update content" ON public.content;
DROP POLICY IF EXISTS "Authenticated users can insert content" ON public.content;
DROP POLICY IF EXISTS "Authenticated can update content" ON public.content;
DROP POLICY IF EXISTS "Mode A - Public read content" ON public.content;
DROP POLICY IF EXISTS "Mode A - Internal manage content" ON public.content;

CREATE POLICY "Mode A - Public read content" ON public.content
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Mode A - Internal manage content" ON public.content
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Dọn sạch các khóa mật khẩu cũ còn sót trong `content.settings` (nếu có)
UPDATE public.content
SET settings = settings - 'password' - 'password_hash' - 'accounts'
WHERE id = 'main'
  AND settings IS NOT NULL
  AND (settings ? 'password' OR settings ? 'password_hash' OR settings ? 'accounts');

-- ------------------------------------------------------------------------------
-- 2.3. Bảng `public.messages` (Hộp thư liên hệ)
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messages TO anon, authenticated;
GRANT ALL ON TABLE public.messages TO service_role;

DROP POLICY IF EXISTS "Allow all on messages" ON public.messages;
DROP POLICY IF EXISTS "Public can send messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated can read messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated can update messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated can delete messages" ON public.messages;
DROP POLICY IF EXISTS "Mode A - Public send messages" ON public.messages;
DROP POLICY IF EXISTS "Mode A - Internal manage messages" ON public.messages;

CREATE POLICY "Mode A - Public send messages" ON public.messages
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Mode A - Internal manage messages" ON public.messages
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 2.4. 16 Bảng dữ liệu nghiệp vụ (Portfolio, Điều phối, Sổ cân, Kho bãi)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
    target_tables TEXT[] := ARRAY[
        'projects',
        'tools',
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
        'vehicle_profiles'
    ];
BEGIN
    FOREACH tbl IN ARRAY target_tables LOOP
        IF to_regclass('public.' || tbl) IS NOT NULL THEN
            -- Đảm bảo quyền DML cho chế độ đăng nhập nội bộ (Mode A)
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO anon, authenticated;', tbl);
            EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role;', tbl);

            -- Xóa policy Mode A cũ (nếu chạy lại script) để đảm bảo idempotent
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Mode A - Internal app access', tbl);

            -- Tạo policy rõ ràng thay vì tắt RLS
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
                'Mode A - Internal app access',
                tbl
            );
        END IF;
    END LOOP;
END $$;

-- ==============================================================================
-- PHẦN 3: RPC SECURITY DEFINER HỖ TRỢ XÁC THỰC NỘI BỘ (CÔ LẬP PASSWORD_HASH)
-- ==============================================================================
-- Hàm tùy chọn giúp frontend gọi `supabase.rpc('verify_internal_user', ...)`
-- mà KHÔNG cần trả về cột `password_hash` ra trình duyệt. Sẵn sàng để chuyển đổi
-- dần trước khi bật Mode B.
CREATE OR REPLACE FUNCTION public.verify_internal_user(
    p_username TEXT,
    p_password_hash TEXT
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    role TEXT,
    display_name TEXT,
    avatar TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.username::TEXT,
        u.role::TEXT,
        u.display_name::TEXT,
        u.avatar::TEXT,
        COALESCE(u.is_active, TRUE),
        u.created_at
    FROM public.users u
    WHERE LOWER(TRIM(u.username)) = LOWER(TRIM(p_username))
      AND COALESCE(u.is_active, TRUE) = TRUE
      AND u.password_hash = p_password_hash
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_internal_user(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_internal_user(TEXT, TEXT) TO anon, authenticated, service_role;

-- ==============================================================================
-- PHẦN 4 (MODE B - COMMENTED OUT): STRICT SUPABASE AUTH JWT HARDENING
-- ==============================================================================
-- CẢNH BÁO: CHỈ BỎ COMMENT KHỐI DƯỚI ĐÂY SAU KHI TOÀN BỘ TÀI KHOẢN ĐÃ ĐƯỢC
-- MIGRATE SANG SUPABASE AUTH (`auth.users`) VÀ FRONTEND ĐĂNG NHẬP BẰNG JWT.
-- Nếu chạy khối này khi vẫn đang dùng đăng nhập nội bộ `public.users`, role
-- `anon` sẽ bị chặn ghi/xóa và tài khoản `admin` nội bộ sẽ không thao tác được.
-- ==============================================================================
--
-- -- B.1. Khóa chặt bảng `public.users` khỏi role `anon`
-- DROP POLICY IF EXISTS "Mode A - Internal users select" ON public.users;
-- DROP POLICY IF EXISTS "Mode A - Internal users insert" ON public.users;
-- DROP POLICY IF EXISTS "Mode A - Internal users update" ON public.users;
-- DROP POLICY IF EXISTS "Mode A - Internal users delete" ON public.users;
--
-- REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon;
--
-- DROP POLICY IF EXISTS "Mode B - Allow active user authentication lookup" ON public.users;
-- CREATE POLICY "Mode B - Allow active user authentication lookup" ON public.users
--     FOR SELECT TO authenticated
--     USING (is_active = true);
--
-- DROP POLICY IF EXISTS "Mode B - Admin manage all users" ON public.users;
-- CREATE POLICY "Mode B - Admin manage all users" ON public.users
--     FOR ALL TO authenticated
--     USING (
--         auth.jwt() ->> 'role' = 'admin'
--         OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
--         OR auth.uid() = id
--     )
--     WITH CHECK (
--         auth.jwt() ->> 'role' = 'admin'
--         OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
--         OR auth.uid() = id
--     );
--
-- -- B.2. Khóa chặt bảng `public.content` (Public chỉ được SELECT, Authenticated được ghi)
-- DROP POLICY IF EXISTS "Mode A - Public read content" ON public.content;
-- DROP POLICY IF EXISTS "Mode A - Internal manage content" ON public.content;
--
-- REVOKE INSERT, UPDATE, DELETE ON TABLE public.content FROM anon;
--
-- DROP POLICY IF EXISTS "Mode B - Public can read content" ON public.content;
-- CREATE POLICY "Mode B - Public can read content" ON public.content
--     FOR SELECT TO anon, authenticated
--     USING (true);
--
-- DROP POLICY IF EXISTS "Mode B - Authenticated can manage content" ON public.content;
-- CREATE POLICY "Mode B - Authenticated can manage content" ON public.content
--     FOR ALL TO authenticated
--     USING (true)
--     WITH CHECK (true);
--
-- -- B.3. Khóa chặt bảng `public.messages` (Public chỉ được INSERT, Authenticated xem/sửa/xóa)
-- DROP POLICY IF EXISTS "Mode A - Public send messages" ON public.messages;
-- DROP POLICY IF EXISTS "Mode A - Internal manage messages" ON public.messages;
--
-- REVOKE SELECT, UPDATE, DELETE ON TABLE public.messages FROM anon;
--
-- DROP POLICY IF EXISTS "Mode B - Public can send messages" ON public.messages;
-- CREATE POLICY "Mode B - Public can send messages" ON public.messages
--     FOR INSERT TO anon, authenticated
--     WITH CHECK (true);
--
-- DROP POLICY IF EXISTS "Mode B - Authenticated can read messages" ON public.messages;
-- CREATE POLICY "Mode B - Authenticated can read messages" ON public.messages
--     FOR SELECT TO authenticated
--     USING (true);
--
-- DROP POLICY IF EXISTS "Mode B - Authenticated can update messages" ON public.messages;
-- CREATE POLICY "Mode B - Authenticated can update messages" ON public.messages
--     FOR UPDATE TO authenticated
--     USING (true)
--     WITH CHECK (true);
--
-- DROP POLICY IF EXISTS "Mode B - Authenticated can delete messages" ON public.messages;
-- CREATE POLICY "Mode B - Authenticated can delete messages" ON public.messages
--     FOR DELETE TO authenticated
--     USING (true);
--
-- -- B.4. Khóa chặt 16 bảng nghiệp vụ (Chỉ `authenticated` & `service_role` được ghi/xóa)
-- DO $$
-- DECLARE
--     tbl TEXT;
--     target_tables TEXT[] := ARRAY[
--         'projects',
--         'tools',
--         'allocator_history_trips',
--         'weighbridge_tracking',
--         'weighbridge_allocation_tracking',
--         'warehouse_inventory_tickets',
--         'warehouse_configs',
--         'warehouse_vehicles',
--         'weighbridge_vessels',
--         'weighbridge_barges',
--         'weighbridge_trucks',
--         'weighbridge_vehicles',
--         'weighbridge_warehouse_tickets',
--         'weighbridge_container_tickets',
--         'weighbridge_other_tickets',
--         'vehicle_profiles'
--     ];
-- BEGIN
--     FOREACH tbl IN ARRAY target_tables LOOP
--         IF to_regclass('public.' || tbl) IS NOT NULL THEN
--             EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Mode A - Internal app access', tbl);
--             EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE public.%I FROM anon;', tbl);
--             EXECUTE format('GRANT ALL ON TABLE public.%I TO authenticated, service_role;', tbl);
--             EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Mode B - Authenticated manage', tbl);
--             EXECUTE format(
--                 'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
--                 'Mode B - Authenticated manage',
--                 tbl
--             );
--         END IF;
--     END LOOP;
-- END $$;
--
-- -- Ghi chú cho bảng portfolio công khai (`projects`, `tools`) khi bật Mode B:
-- -- Nếu trang chủ công khai cần hiển thị `projects` / `tools` cho khách chưa đăng nhập,
-- -- hãy cấp thêm SELECT cho `anon`:
-- -- GRANT SELECT ON TABLE public.projects, public.tools TO anon;
-- -- DROP POLICY IF EXISTS "Mode B - Public read projects" ON public.projects;
-- -- CREATE POLICY "Mode B - Public read projects" ON public.projects FOR SELECT TO anon USING (true);
-- -- DROP POLICY IF EXISTS "Mode B - Public read tools" ON public.tools;
-- -- CREATE POLICY "Mode B - Public read tools" ON public.tools FOR SELECT TO anon USING (true);

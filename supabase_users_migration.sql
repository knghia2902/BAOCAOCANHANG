-- ==============================================================================
-- SCRIPT TẠO BẢNG USERS VÀ DI CHUYỂN DỮ LIỆU TỪ BẢNG CONTENT (SUPABASE)
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Tạo truy vấn mới -> Dán và bấm RUN.
-- ==============================================================================

-- 1. Bật extension pgcrypto (để hỗ trợ hash và UUID nếu chưa có)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tạo bảng users
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'staff',
    display_name VARCHAR(255),
    avatar TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index tăng tốc truy vấn username khi đăng nhập
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);

-- 3. Cấu hình Row Level Security (RLS) để cho phép client anon truy vấn
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Tạo các policy cho phép ứng dụng frontend (dùng anon key) đọc và quản lý users
DROP POLICY IF EXISTS "Allow anon read users" ON public.users;
CREATE POLICY "Allow anon read users" ON public.users 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert users" ON public.users;
CREATE POLICY "Allow anon insert users" ON public.users 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update users" ON public.users;
CREATE POLICY "Allow anon update users" ON public.users 
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow anon delete users" ON public.users;
CREATE POLICY "Allow anon delete users" ON public.users 
    FOR DELETE USING (true);

-- 4. TỰ ĐỘNG MIGRATE TÀI KHOẢN HIỆN CÓ TỪ BẢNG content (NẾU CÓ)
DO $$
DECLARE
    main_settings JSONB;
    admin_user TEXT;
    admin_pass TEXT;
    admin_name TEXT;
    admin_avatar TEXT;
    admin_hash TEXT;
BEGIN
    -- Lấy settings từ bảng content
    SELECT settings INTO main_settings FROM public.content WHERE id = 'main';

    IF main_settings IS NOT NULL THEN
        -- 4.1. Di chuyển tài khoản Admin chính
        admin_user := main_settings->>'username';
        admin_pass := main_settings->>'password';
        admin_name := COALESCE(main_settings->>'displayName', 'Admin');
        admin_avatar := COALESCE(main_settings->>'avatar', '');

        IF admin_user IS NOT NULL AND admin_pass IS NOT NULL THEN
            -- Hash SHA-256 mật khẩu của admin nếu chưa hash
            admin_hash := encode(digest(admin_pass, 'sha256'), 'hex');

            INSERT INTO public.users (username, password_hash, role, display_name, avatar)
            VALUES (LOWER(TRIM(admin_user)), admin_hash, 'admin', admin_name, admin_avatar)
            ON CONFLICT (username) DO NOTHING;
        END IF;

        -- 4.2. Di chuyển danh sách tài khoản trong settings.accounts
        IF jsonb_typeof(main_settings->'accounts') = 'array' THEN
            INSERT INTO public.users (username, password_hash, role, display_name, avatar)
            SELECT 
                LOWER(TRIM(acc->>'username')),
                acc->>'password',
                COALESCE(acc->>'role', 'staff'),
                COALESCE(acc->>'displayName', acc->>'username'),
                COALESCE(acc->>'avatar', '')
            FROM jsonb_array_elements(main_settings->'accounts') AS acc
            WHERE acc->>'username' IS NOT NULL AND acc->>'password' IS NOT NULL
            ON CONFLICT (username) DO NOTHING;
        END IF;
    END IF;
END $$;

-- ==============================================================================
-- SCRIPT B?O M?T V� KH�A ROW LEVEL SECURITY (RLS) - C?NG NGUY�N NG?C
-- H�?ng d?n: M? Supabase Dashboard -> SQL Editor -> D�n to�n b? script v� b?m RUN.
-- ==============================================================================

-- 1. THU H?I C�C CH�NH S�CH M? R?NG CHO ROLE 'anon' TR�N B?NG USERS
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read users" ON public.users;
DROP POLICY IF EXISTS "Allow anon insert users" ON public.users;
DROP POLICY IF EXISTS "Allow anon update users" ON public.users;
DROP POLICY IF EXISTS "Allow anon delete users" ON public.users;

-- Ch�nh s�ch m?i cho b?ng users:
-- Ch? ng�?i d�ng �? x�c th?c (authenticated) m?i ��?c xem danh s�ch user
CREATE POLICY "Authenticated users can read users" ON public.users
    FOR SELECT TO authenticated
    USING (true);

-- Ch? admin m?i c� quy?n th�m/s?a/x�a user (ho?c t�i kho?n t? s?a th�ng tin ch�nh m?nh)
CREATE POLICY "Admin can manage all users" ON public.users
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

-- 2. KH�A C�C CH�NH S�CH M? TR�N B?NG ALLOCATOR_HISTORY_TRIPS
ALTER TABLE IF EXISTS public.allocator_history_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read allocator_history_trips" ON public.allocator_history_trips;
DROP POLICY IF EXISTS "Allow anon insert allocator_history_trips" ON public.allocator_history_trips;
DROP POLICY IF EXISTS "Allow anon update allocator_history_trips" ON public.allocator_history_trips;
DROP POLICY IF EXISTS "Allow anon delete allocator_history_trips" ON public.allocator_history_trips;

-- Ng�?i d�ng authenticated ��?c xem v� l�u chuy?n xe
CREATE POLICY "Authenticated users can select trips" ON public.allocator_history_trips
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert trips" ON public.allocator_history_trips
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Staff and admin can update trips" ON public.allocator_history_trips
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Staff and admin can delete trips" ON public.allocator_history_trips
    FOR DELETE TO authenticated
    USING (true);

-- 3. KH�A CH�NH S�CH B?O M?T TR�N B?NG CONTENT V� SETTINGS
ALTER TABLE IF EXISTS public.content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all on content" ON public.content;
DROP POLICY IF EXISTS "Allow all on content" ON public.content;

-- Kh�ch truy c?p c�ng khai ch? ��?c xem (SELECT) n?i dung gi?i thi?u portfolio
CREATE POLICY "Public can view content" ON public.content
    FOR SELECT USING (true);

-- Ch? authenticated users m?i ��?c l�u ho?c ch?nh s?a content
CREATE POLICY "Authenticated users can update content" ON public.content
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can insert content" ON public.content
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- 4. B?O M?T B?NG VEHICLE_PROFILES V� WEIGHBRIDGE_OTHER_TICKETS
ALTER TABLE IF EXISTS public.vehicle_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all on vehicle_profiles" ON public.vehicle_profiles;

CREATE POLICY "Authenticated users can manage vehicle_profiles" ON public.vehicle_profiles
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

ALTER TABLE IF EXISTS public.weighbridge_other_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all on weighbridge_other_tickets" ON public.weighbridge_other_tickets;

CREATE POLICY "Authenticated users can manage weighbridge_other_tickets" ON public.weighbridge_other_tickets
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. L�M S?CH PASSWORD TRONG CONTENT.SETTINGS
-- X�a b? c�c tr�?ng password_hash ho?c m?t kh?u nh�ng trong content.settings
UPDATE public.content 
SET settings = settings - 'password' - 'password_hash' - 'accounts'
WHERE id = 'main' AND (settings ? 'password' OR settings ? 'password_hash' OR settings ? 'accounts');

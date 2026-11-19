import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '@/services/storage/AuthService';
import { supabase } from '@/supabase';

vi.mock('@/supabase', () => {
    const mockBuilder = {
        select: vi.fn(() => mockBuilder),
        update: vi.fn(() => mockBuilder),
        insert: vi.fn(() => mockBuilder),
        delete: vi.fn(() => mockBuilder),
        eq: vi.fn(() => mockBuilder),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null })
    };

    return {
        supabase: {
            from: vi.fn(() => mockBuilder),
            auth: {
                signInWithPassword: vi.fn(),
                signOut: vi.fn(),
                getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
                updateUser: vi.fn()
            }
        }
    };
});

describe('AuthService - Session Validation & Role Tampering Protection', () => {
    let authService: AuthService;

    beforeEach(() => {
        vi.clearAllMocks();
        authService = new AuthService();
    });

    it('returns null when username is empty or whitespace', async () => {
        const result = await authService.validateSession('');
        expect(result).toBeNull();

        const resultWhitespace = await authService.validateSession('   ');
        expect(resultWhitespace).toBeNull();
    });

    it('returns demo admin user when username is demo', async () => {
        const result = await authService.validateSession('demo');
        expect(result).not.toBeNull();
        expect(result?.username).toBe('demo');
        expect(result?.role).toBe('admin');
        expect(result?.isActive).toBe(true);
    });

    it('returns user data and role from Supabase when user exists and is active', async () => {
        const mockBuilder: any = (supabase.from as any)('users');
        mockBuilder.maybeSingle.mockResolvedValueOnce({
            data: {
                id: 'user-uuid-1',
                username: 'staff1',
                role: 'staff',
                display_name: 'Staff One',
                avatar: 'avatar.png',
                is_active: true,
                created_at: '2026-01-01T00:00:00Z'
            },
            error: null
        });

        const result = await authService.validateSession('staff1');
        expect(result).not.toBeNull();
        expect(result?.username).toBe('staff1');
        expect(result?.role).toBe('staff');
        expect(result?.displayName).toBe('Staff One');
        expect(result?.isActive).toBe(true);
        expect(mockBuilder.eq).toHaveBeenCalledWith('username', 'staff1');
    });

    it('returns null when user exists but has is_active = false', async () => {
        const mockBuilder: any = (supabase.from as any)('users');
        mockBuilder.maybeSingle.mockResolvedValueOnce({
            data: {
                id: 'user-uuid-2',
                username: 'blocked_user',
                role: 'operator',
                display_name: 'Blocked User',
                is_active: false
            },
            error: null
        });

        const result = await authService.validateSession('blocked_user');
        expect(result).toBeNull();
    });

    it('returns null when user does not exist in database', async () => {
        const mockBuilder: any = (supabase.from as any)('users');
        mockBuilder.maybeSingle.mockResolvedValueOnce({
            data: null,
            error: null
        });

        const result = await authService.validateSession('unknown_user');
        expect(result).toBeNull();
    });
});

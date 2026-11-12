import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsService } from '@/services/storage/SettingsService';
import { supabase } from '@/supabase';

vi.mock('@/supabase', () => {
    const mockBuilder = {
        select: vi.fn(() => mockBuilder),
        update: vi.fn(() => mockBuilder),
        eq: vi.fn(() => mockBuilder),
        single: vi.fn().mockResolvedValue({ data: null, error: null })
    };

    return {
        supabase: {
            from: vi.fn(() => mockBuilder)
        }
    };
});

describe('SettingsService - Cache & Single-RTT Update', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        SettingsService.invalidateCache();
    });

    it('merges patch with warm cache in 1 RTT without extra SELECT and refreshes cache', async () => {
        SettingsService.setSettingsCache({ existing_key: 'keep', staff_tools: ['converter'] });
        const mockBuilder: any = (supabase.from as any)('content');
        mockBuilder.eq.mockResolvedValueOnce({ error: null });

        const ok = await SettingsService.updateSettings({ staff_tools: ['converter', 'merger'] });

        expect(ok).toBe(true);
        expect(mockBuilder.select).not.toHaveBeenCalled();
        expect(mockBuilder.update).toHaveBeenCalledWith({
            settings: {
                existing_key: 'keep',
                staff_tools: ['converter', 'merger']
            }
        });
        expect(mockBuilder.eq).toHaveBeenCalledWith('id', 'main');

        const cached = await SettingsService.getSettings();
        expect(cached).toEqual({
            existing_key: 'keep',
            staff_tools: ['converter', 'merger']
        });
        expect(mockBuilder.select).not.toHaveBeenCalled();
    });

    it('fetches settings first when cache is empty, then merges patch and updates', async () => {
        const mockBuilder: any = (supabase.from as any)('content');
        mockBuilder.single.mockResolvedValueOnce({
            data: { settings: { theme: 'light', role_permissions: { admin: { canCreate: true } } } },
            error: null
        });

        const ok = await SettingsService.updateSettings({ staff_tools: ['weighbridge'] });

        expect(ok).toBe(true);
        expect(mockBuilder.select).toHaveBeenCalledWith('settings');
        expect(mockBuilder.update).toHaveBeenCalledWith({
            settings: {
                theme: 'light',
                role_permissions: { admin: { canCreate: true } },
                staff_tools: ['weighbridge']
            }
        });

        const cached = await SettingsService.getSettings();
        expect(cached.theme).toBe('light');
        expect(cached.staff_tools).toEqual(['weighbridge']);
    });

    it('returns false and preserves previous cache when Supabase update fails', async () => {
        SettingsService.setSettingsCache({ existing_key: 'original' });
        const mockBuilder: any = (supabase.from as any)('content');
        mockBuilder.eq.mockResolvedValueOnce({ error: { message: 'Update failed' } });

        const ok = await SettingsService.updateSettings({ existing_key: 'mutated' });

        expect(ok).toBe(false);
        const cached = await SettingsService.getSettings();
        expect(cached).toEqual({ existing_key: 'original' });
    });
});

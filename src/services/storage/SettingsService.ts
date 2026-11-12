import { supabase } from '@/supabase';

let settingsPromise: Promise<any> | null = null;
let settingsCache: { data: any; timestamp: number } | null = null;
const SETTINGS_TTL = 30_000; // 30 seconds TTL

export const SettingsService = {
    /**
     * Lấy settings từ bảng content với bộ đệm in-memory và gom các yêu cầu đồng thời (deduplication)
     */
    async getSettings(forceRefresh = false): Promise<any> {
        if (!forceRefresh && settingsCache && (Date.now() - settingsCache.timestamp < SETTINGS_TTL)) {
            return settingsCache.data;
        }
        if (settingsPromise) {
            return settingsPromise;
        }
        settingsPromise = (async () => {
            try {
                const { data, error } = await supabase
                    .from('content')
                    .select('settings')
                    .eq('id', 'main')
                    .single();
                if (!error && data?.settings) {
                    settingsCache = { data: data.settings, timestamp: Date.now() };
                    return data.settings;
                }
                return settingsCache?.data || null;
            } finally {
                settingsPromise = null;
            }
        })();
        return settingsPromise;
    },

    /**
     * Cập nhật cache khi đã có dữ liệu settings từ truy vấn khác (VD: ContentService.loadAll)
     */
    setSettingsCache(settings: any) {
        if (settings) {
            settingsCache = { data: settings, timestamp: Date.now() };
        }
    },

    /**
     * Cập nhật một phần settings (merge với cache hiện tại hoặc tải mới nếu chưa có cache) chỉ với 1 RTT
     */
    async updateSettings(patch: Record<string, any>): Promise<boolean> {
        try {
            const current = (settingsCache && (Date.now() - settingsCache.timestamp < SETTINGS_TTL))
                ? settingsCache.data
                : (await SettingsService.getSettings());
            const newSettings = {
                ...(current || {}),
                ...patch
            };
            const { error } = await supabase
                .from('content')
                .update({ settings: newSettings })
                .eq('id', 'main');
            if (!error) {
                SettingsService.setSettingsCache(newSettings);
                return true;
            }
            return false;
        } catch (e) {
            console.error('[SettingsService] Error updating settings:', e);
            return false;
        }
    },

    /**
     * Xóa cache khi có cập nhật settings
     */
    invalidateCache() {
        settingsCache = null;
        settingsPromise = null;
    }
};

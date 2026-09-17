import { supabase } from '../../supabase';
import { authStore } from '../../stores/auth';

export interface ActivityLog {
    id: string;
    timestamp: string;
    username: string;
    displayName: string;
    role: string;
    action: string;
    details: string;
}

export class LogService {
    static readonly TABLE_NAME = 'activity_logs';

    /**
     * Records a new activity log entry in the dedicated activity_logs table
     */
    static async logAction(action: string, details: string): Promise<boolean> {
        try {
            const username = authStore.user || 'system';
            const displayName = authStore.displayName || 'Hệ thống';
            const role = authStore.role || 'system';

            // 1. Try writing directly to dedicated activity_logs table
            const { error: insertError } = await supabase
                .from(LogService.TABLE_NAME)
                .insert([{
                    username,
                    display_name: displayName,
                    role,
                    action,
                    details
                }]);

            if (!insertError) {
                return true;
            }

            console.warn('[LogService] Dedicated table insert failed, falling back to content.stats:', insertError.message);

            // 2. Fallback to legacy content.stats.logs if table not yet created
            const { data, error: fetchError } = await supabase
                .from('content')
                .select('stats')
                .eq('id', 'main')
                .single();

            if (fetchError) {
                console.error('[LogService] Failed to fetch stats for fallback:', fetchError);
                return false;
            }

            const currentStats = data?.stats || {};
            const logs: ActivityLog[] = currentStats.logs || [];

            const newLog: ActivityLog = {
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
                timestamp: new Date().toISOString(),
                username,
                displayName,
                role,
                action,
                details
            };

            const updatedLogs = [newLog, ...logs].slice(0, 300);
            const newStats = {
                ...currentStats,
                logs: updatedLogs
            };

            const { error: updateError } = await supabase
                .from('content')
                .update({ stats: newStats })
                .eq('id', 'main');

            if (updateError) {
                console.error('[LogService] Failed to update stats with fallback log:', updateError);
                return false;
            }

            return true;
        } catch (e) {
            console.error('[LogService] Error logging action:', e);
            return false;
        }
    }

    /**
     * Retrieve activity logs from the Supabase database
     */
    static async getLogs(limit: number = 500): Promise<ActivityLog[]> {
        try {
            // 1. Try fetching from dedicated activity_logs table
            const { data: tableData, error: tableError } = await supabase
                .from(LogService.TABLE_NAME)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (!tableError && tableData) {
                return tableData.map((row: any) => ({
                    id: String(row.id),
                    timestamp: row.created_at,
                    username: row.username || 'system',
                    displayName: row.display_name || row.username || 'Hệ thống',
                    role: row.role || 'system',
                    action: row.action || '',
                    details: row.details || ''
                }));
            }

            if (tableError) {
                console.warn('[LogService] Table fetch failed, falling back to content.stats.logs:', tableError.message);
            }

            // 2. Fallback to content.stats.logs
            const { data, error } = await supabase
                .from('content')
                .select('stats')
                .eq('id', 'main')
                .single();

            if (error) {
                console.error('[LogService] Failed to fetch fallback logs:', error);
                return [];
            }

            return data?.stats?.logs || [];
        } catch (e) {
            console.error('[LogService] Error fetching logs:', e);
            return [];
        }
    }
}

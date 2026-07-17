import { supabase } from '../../supabase';
import { authStore } from '../../stores/auth';

export interface ActivityLog {
    id: string;
    timestamp: string;
    username: string;
    displayName: string;
    role: 'admin' | 'staff' | 'system';
    action: string;
    details: string;
}

export class LogService {
    /**
     * Records a new activity log entry in the Supabase database under content.stats.logs
     */
    static async logAction(action: string, details: string): Promise<boolean> {
        try {
            // 1. Fetch current stats
            const { data, error: fetchError } = await supabase
                .from('content')
                .select('stats')
                .eq('id', 'main')
                .single();

            if (fetchError) {
                console.error('[LogService] Failed to fetch stats:', fetchError);
                return false;
            }

            const currentStats = data?.stats || {};
            const logs: ActivityLog[] = currentStats.logs || [];

            // 2. Create new log entry
            const newLog: ActivityLog = {
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
                timestamp: new Date().toISOString(),
                username: authStore.user || 'system',
                displayName: authStore.displayName || 'Hệ thống',
                role: authStore.role || 'system',
                action,
                details
            };

            // 3. Prepend and limit to 300 logs
            const updatedLogs = [newLog, ...logs].slice(0, 300);
            const newStats = {
                ...currentStats,
                logs: updatedLogs
            };

            // 4. Save back to Supabase
            const { error: updateError } = await supabase
                .from('content')
                .update({ stats: newStats })
                .eq('id', 'main');

            if (updateError) {
                console.error('[LogService] Failed to update stats with logs:', updateError);
                return false;
            }

            return true;
        } catch (e) {
            console.error('[LogService] Error logging action:', e);
            return false;
        }
    }

    /**
     * Retrieve all activity logs from the Supabase database
     */
    static async getLogs(): Promise<ActivityLog[]> {
        try {
            const { data, error } = await supabase
                .from('content')
                .select('stats')
                .eq('id', 'main')
                .single();

            if (error) {
                console.error('[LogService] Failed to fetch logs:', error);
                return [];
            }

            return data?.stats?.logs || [];
        } catch (e) {
            console.error('[LogService] Error fetching logs:', e);
            return [];
        }
    }
}

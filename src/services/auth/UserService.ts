import { supabase } from '@/supabase';

export interface UserAccount {
    id?: string;
    username: string;
    displayName: string;
    role: string;
    avatar?: string;
    isActive: boolean;
    password?: string;
    created_at?: string;
}

export const UserService = {
    async loadAccounts(): Promise<UserAccount[]> {
        try {
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('id, username, display_name, role, avatar, is_active, created_at')
                .order('created_at', { ascending: true });

            if (!usersError && users && users.length > 0) {
                return users.map(u => ({
                    id: u.id,
                    username: u.username,
                    displayName: u.display_name || u.username,
                    role: u.role || 'staff',
                    avatar: u.avatar || '',
                    isActive: u.is_active !== false,
                    created_at: u.created_at
                }));
            }
        } catch (err) {
            console.warn('L?i load t? b?ng users:', err);
        }

        return [];
    },

    async createUser(account: { username: string; password: string; displayName?: string; role: string; avatar?: string }): Promise<boolean> {
        const usernameClean = account.username.trim().toLowerCase();
        try {
            const { error: userError } = await supabase
                .from('users')
                .insert([{
                    username: usernameClean,
                    password_hash: account.password,
                    display_name: account.displayName || usernameClean,
                    role: account.role || 'staff',
                    avatar: account.avatar || '',
                    is_active: true
                }]);

            if (!userError) return true;
            console.error('L?i khi th�m v�o b?ng users:', userError);
            return false;
        } catch (err) {
            console.error('Kh�ng th? insert v�o b?ng users:', err);
            return false;
        }
    },

    async updateUser(username: string, updates: { displayName?: string; role?: string; avatar?: string; isActive?: boolean }): Promise<boolean> {
        const usernameClean = username.trim().toLowerCase();
        try {
            const userUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
            if (updates.displayName !== undefined) userUpdates.display_name = updates.displayName;
            if (updates.role !== undefined) userUpdates.role = updates.role;
            if (updates.avatar !== undefined) userUpdates.avatar = updates.avatar;
            if (updates.isActive !== undefined) userUpdates.is_active = updates.isActive;

            const { error: userError } = await supabase
                .from('users')
                .update(userUpdates)
                .eq('username', usernameClean);

            return !userError;
        } catch (err) {
            console.error('L?i khi update b?ng users:', err);
            return false;
        }
    },

    async toggleUserStatus(username: string, isActive: boolean): Promise<boolean> {
        return this.updateUser(username, { isActive });
    },

    async deleteUser(username: string): Promise<boolean> {
        const usernameClean = username.trim().toLowerCase();
        try {
            const { error: deleteError } = await supabase
                .from('users')
                .delete()
                .eq('username', usernameClean);

            return !deleteError;
        } catch (err) {
            console.error('L?i x�a user trong b?ng users:', err);
            return false;
        }
    },

    async resetPassword(username: string, passwordHash: string): Promise<boolean> {
        const usernameClean = username.trim().toLowerCase();
        try {
            const { error: resetError } = await supabase
                .from('users')
                .update({ 
                    password_hash: passwordHash,
                    updated_at: new Date().toISOString()
                })
                .eq('username', usernameClean);

            return !resetError;
        } catch (err) {
            console.error('L?i reset m?t kh?u trong b?ng users:', err);
            return false;
        }
    },

    async resetUserPassword(username: string, passwordHash: string): Promise<boolean> {
        return this.resetPassword(username, passwordHash);
    },

    async saveAccounts(_accounts?: any[]): Promise<boolean> {
        return true;
    }
};

import { supabase } from '../../supabase';

export interface User {
    id?: string;
    username: string;
    role: string;
    displayName?: string;
    avatar?: string;
    isActive?: boolean;
    created_at?: string;
    email?: string;
}

export interface LoginResult {
    success: boolean;
    user?: User;
    isFirstLogin?: boolean;
    error?: string;
}

export async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export class AuthService {
    async login(username: string, password: string): Promise<LoginResult> {
        const usernameClean = username.trim().toLowerCase();
        const hashedInputPassword = await sha256(password);

        try {
            // 1. Th? ��ng nh?p qua Supabase Auth n?u input l� email ho?c c� t�i kho?n Supabase Auth
            const emailCandidate = usernameClean.includes('@') 
                ? usernameClean 
                : `${usernameClean}@cangnguyenngoc.vn`;

            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: emailCandidate,
                password: password
            });

            if (!authError && authData?.user) {
                const meta = authData.user.user_metadata || {};
                return {
                    success: true,
                    user: {
                        id: authData.user.id,
                        username: meta.username || usernameClean,
                        role: meta.role || 'staff',
                        displayName: meta.displayName || meta.name || usernameClean,
                        avatar: meta.avatar || '',
                        isActive: true,
                        email: authData.user.email
                    },
                    isFirstLogin: false
                };
            }
        } catch (e) {
            console.warn('Supabase Auth attempt bypassed:', e);
        }

        // 2. Tra c?u trong b?ng users v?i b?o m?t tr?ng th�i v� hash
        try {
            const { data: dbUser, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('username', usernameClean)
                .maybeSingle();

            if (!userError && dbUser) {
                if (dbUser.is_active === false) {
                    return { 
                        success: false, 
                        error: 'T�i kho?n n�y �? b? kh�a ho?c ng?ng k�ch ho?t!' 
                    };
                }

                // Ki?m tra m?t kh?u an to�n
                const isMatch = dbUser.password_hash === hashedInputPassword || dbUser.password_hash === password;
                if (isMatch) {
                    return {
                        success: true,
                        user: {
                            id: dbUser.id,
                            username: dbUser.username,
                            role: dbUser.role || 'staff',
                            displayName: dbUser.display_name || dbUser.username,
                            avatar: dbUser.avatar || '',
                            isActive: dbUser.is_active !== false,
                            created_at: dbUser.created_at
                        },
                        isFirstLogin: false
                    };
                }

                return { 
                    success: false, 
                    error: 'T�n ��ng nh?p ho?c m?t kh?u kh�ng ��ng!' 
                };
            }
        } catch (err) {
            console.warn('L?i truy v?n b?ng users:', err);
        }

        return { 
            success: false, 
            error: 'T�n ��ng nh?p ho?c m?t kh?u kh�ng ��ng!' 
        };
    }

    async changePassword(newPassword: string, targetUsername?: string, oldPassword?: string): Promise<{ success: boolean; error?: string }> {
        let username = targetUsername;
        if (!username) {
            try {
                const saved = JSON.parse(localStorage.getItem('auth_session') || '{}');
                username = saved?.user;
            } catch (_) {}
        }
        
        const usernameClean = (username || '').trim().toLowerCase();
        if (!usernameClean) {
            return { success: false, error: 'Kh�ng t?m th?y th�ng tin t�i kho?n' };
        }

        // Ki?m tra �? d�i m?t kh?u m?i
        if (!newPassword || newPassword.length < 6) {
            return { success: false, error: 'M?t kh?u m?i ph?i c� �t nh?t 6 k? t?' };
        }

        // N?u c� oldPassword, ki?m tra t�nh h?p l? tr�?c khi cho �?i
        if (oldPassword) {
            const verifyLogin = await this.login(usernameClean, oldPassword);
            if (!verifyLogin.success) {
                return { success: false, error: 'M?t kh?u hi?n t?i kh�ng ch�nh x�c' };
            }
        }

        // 1. C?p nh?t Supabase Auth n?u session �ang m?
        try {
            await supabase.auth.updateUser({ password: newPassword });
        } catch (_) {}

        // 2. C?p nh?t b?ng users
        const hashedNewPassword = await sha256(newPassword);
        const { error } = await supabase
            .from('users')
            .update({ 
                password_hash: hashedNewPassword, 
                updated_at: new Date().toISOString() 
            })
            .eq('username', usernameClean);

        if (!error) {
            return { success: true };
        }

        return { success: false, error: error.message || 'Kh�ng th? c?p nh?t m?t kh?u' };
    }

    async updateProfile(username: string, displayName: string, newPassword?: string, avatar?: string): Promise<boolean> {
        const usernameClean = username.trim().toLowerCase();
        const updates: Record<string, any> = {
            updated_at: new Date().toISOString()
        };

        if (displayName) updates.display_name = displayName;
        if (avatar !== undefined) updates.avatar = avatar;
        if (newPassword) {
            updates.password_hash = await sha256(newPassword);
            try {
                await supabase.auth.updateUser({ password: newPassword });
            } catch (_) {}
        }

        const { error: userError } = await supabase
            .from('users')
            .update(updates)
            .eq('username', usernameClean);

        return !userError;
    }

    async logout(): Promise<void> {
        try {
            await supabase.auth.signOut();
        } catch (_) {}
    }

    async isAuthenticated(): Promise<boolean> {
        const { data } = await supabase.auth.getSession();
        return !!data?.session;
    }
}

export const authService = new AuthService();

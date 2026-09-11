import { supabase } from '../../supabase';

export interface User {
    id?: string;
    username: string;
    role: string;
    displayName?: string;
    avatar?: string;
    created_at?: string;
}

export async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export class AuthService {
    async login(username: string, password: string): Promise<{ success: boolean; user?: User; isFirstLogin?: boolean }> {
        const usernameClean = username.trim().toLowerCase();
        const hashedInputPassword = await sha256(password);

        try {
            // 1. Kiểm tra trong bảng users riêng biệt trên database
            const { data: dbUser, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('username', usernameClean)
                .maybeSingle();

            if (!userError && dbUser) {
                // Kiểm tra mật khẩu (hỗ trợ cả mật khẩu hash sha256 hoặc plain text cũ)
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
                            created_at: dbUser.created_at
                        },
                        isFirstLogin: false
                    };
                }
            }
        } catch (err) {
            console.warn('Lỗi truy vấn bảng users, thử kiểm tra bảng content fallback:', err);
        }

        // 2. Fallback: Kiểm tra trong settings của bảng content (nếu chưa chạy SQL tạo bảng users hoặc chưa migrate)
        try {
            const { data, error } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .maybeSingle();

            if (!error && data?.settings) {
                const settings = data.settings;

                // 2.1. Kiểm tra tài khoản admin chính
                if (usernameClean === settings.username?.toLowerCase() && password === settings.password) {
                    return {
                        success: true,
                        user: {
                            username: settings.username,
                            role: 'admin',
                            displayName: settings.displayName || 'Admin',
                            avatar: settings.avatar || ''
                        },
                        isFirstLogin: settings.is_first
                    };
                }

                // 2.2. Kiểm tra danh sách tài khoản phụ trong settings.accounts
                const accounts = settings.accounts || [];
                const matchedAccount = accounts.find((acc: any) => 
                    acc.username?.toLowerCase() === usernameClean && 
                    (acc.password === hashedInputPassword || acc.password === password)
                );

                if (matchedAccount) {
                    return {
                        success: true,
                        user: {
                            username: matchedAccount.username,
                            role: matchedAccount.role || 'staff',
                            displayName: matchedAccount.displayName || matchedAccount.username,
                            avatar: matchedAccount.avatar || ''
                        },
                        isFirstLogin: false
                    };
                }
            }
        } catch (e) {
            console.error('Lỗi khi fallback kiểm tra tài khoản:', e);
        }

        return { success: false };
    }

    async changePassword(newPassword: string, targetUsername?: string): Promise<boolean> {
        let username = targetUsername;
        if (!username) {
            try {
                const saved = JSON.parse(localStorage.getItem('auth_session') || '{}');
                username = saved?.user;
            } catch (_) {}
        }
        
        const usernameClean = (username || '').trim().toLowerCase();
        const hashedNewPassword = await sha256(newPassword);

        // Cập nhật trong bảng users
        if (usernameClean) {
            await supabase
                .from('users')
                .update({ 
                    password_hash: hashedNewPassword, 
                    updated_at: new Date().toISOString() 
                })
                .eq('username', usernameClean);
        }

        // Cập nhật dự phòng trong content.settings
        try {
            const { data: current, error: fetchError } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .maybeSingle();

            if (!fetchError && current?.settings) {
                const newSettings = {
                    ...current.settings,
                    password: newPassword,
                    is_first: false
                };

                await supabase
                    .from('content')
                    .update({ settings: newSettings })
                    .eq('id', 'main');
            }
        } catch (_) {}

        return true;
    }

    async updateProfile(username: string, displayName: string, newPassword?: string, avatar?: string): Promise<boolean> {
        const usernameClean = username.trim().toLowerCase();
        const updates: Record<string, any> = {
            updated_at: new Date().toISOString()
        };

        if (displayName) updates.display_name = displayName;
        if (avatar !== undefined) updates.avatar = avatar;
        if (newPassword) updates.password_hash = await sha256(newPassword);

        // 1. Cập nhật trong bảng users
        const { error: userError } = await supabase
            .from('users')
            .update(updates)
            .eq('username', usernameClean);

        // 2. Cập nhật đồng bộ trong settings (đảm bảo không bị lệch dữ liệu cũ)
        try {
            const { data: current, error: fetchError } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .maybeSingle();

            if (!fetchError && current?.settings) {
                const settings = current.settings;

                if (usernameClean === settings.username?.toLowerCase()) {
                    const newSettings = { ...settings };
                    if (displayName) newSettings.displayName = displayName;
                    if (newPassword) {
                        newSettings.password = newPassword;
                        newSettings.is_first = false;
                    }
                    if (avatar !== undefined) newSettings.avatar = avatar;

                    await supabase
                        .from('content')
                        .update({ settings: newSettings })
                        .eq('id', 'main');
                } else if (settings.accounts) {
                    const updatedAccounts = await Promise.all(settings.accounts.map(async (acc: any) => {
                        if (acc.username?.toLowerCase() === usernameClean) {
                            const updatedAcc = { ...acc };
                            if (displayName) updatedAcc.displayName = displayName;
                            if (newPassword) updatedAcc.password = await sha256(newPassword);
                            if (avatar !== undefined) updatedAcc.avatar = avatar;
                            return updatedAcc;
                        }
                        return acc;
                    }));

                    await supabase
                        .from('content')
                        .update({ settings: { ...settings, accounts: updatedAccounts } })
                        .eq('id', 'main');
                }
            }
        } catch (_) {}

        return !userError;
    }

    async isAuthenticated(): Promise<boolean> {
        return true;
    }
}

export const authService = new AuthService();

import { supabase } from '../../supabase';

export interface User {
    id?: string;
    username: string;
    role: string;
    displayName?: string;
    avatar?: string;
    isActive?: boolean;
    created_at?: string;
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
            // 1. Kiểm tra trực tiếp trong bảng users trên database
            const { data: dbUser, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('username', usernameClean)
                .maybeSingle();

            if (!userError && dbUser) {
                // KIỂM TRA TRẠNG THÁI TÀI KHOẢN (is_active)
                if (dbUser.is_active === false) {
                    return { 
                        success: false, 
                        error: 'Tài khoản này đã bị khóa hoặc ngừng kích hoạt!' 
                    };
                }

                // Kiểm tra mật khẩu (so khớp SHA-256 hash hoặc mật khẩu gốc cũ nếu có)
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

                // Tìm thấy tài khoản trong bảng users nhưng sai mật khẩu -> Ngắt ngay, không fallback
                return { 
                    success: false, 
                    error: 'Tên đăng nhập hoặc mật khẩu không đúng!' 
                };
            }
        } catch (err) {
            console.warn('Lỗi truy vấn bảng users, thử kiểm tra bảng content fallback:', err);
        }

        // 2. Fallback dự phòng: Chỉ chạy khi bảng users chưa tồn tại hoặc không tìm thấy
        try {
            const { data, error } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .maybeSingle();

            if (!error && data?.settings) {
                const settings = data.settings;

                // 2.1. Kiểm tra tài khoản admin chính cũ trong settings
                if (usernameClean === settings.username?.toLowerCase() && password === settings.password) {
                    return {
                        success: true,
                        user: {
                            username: settings.username,
                            role: 'admin',
                            displayName: settings.displayName || 'Admin',
                            avatar: settings.avatar || '',
                            isActive: true
                        },
                        isFirstLogin: settings.is_first
                    };
                }

                // 2.2. Kiểm tra danh sách accounts cũ trong settings
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
                            avatar: matchedAccount.avatar || '',
                            isActive: true
                        },
                        isFirstLogin: false
                    };
                }
            }
        } catch (e) {
            console.error('Lỗi khi fallback kiểm tra tài khoản:', e);
        }

        return { 
            success: false, 
            error: 'Tên đăng nhập hoặc mật khẩu không đúng!' 
        };
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

        // Cập nhật trực tiếp trong bảng users
        if (usernameClean) {
            const { error } = await supabase
                .from('users')
                .update({ 
                    password_hash: hashedNewPassword, 
                    updated_at: new Date().toISOString() 
                })
                .eq('username', usernameClean);

            if (!error) return true;
        }

        return false;
    }

    async updateProfile(username: string, displayName: string, newPassword?: string, avatar?: string): Promise<boolean> {
        const usernameClean = username.trim().toLowerCase();
        const updates: Record<string, any> = {
            updated_at: new Date().toISOString()
        };

        if (displayName) updates.display_name = displayName;
        if (avatar !== undefined) updates.avatar = avatar;
        if (newPassword) updates.password_hash = await sha256(newPassword);

        // Cập nhật trực tiếp trong bảng users
        const { error: userError } = await supabase
            .from('users')
            .update(updates)
            .eq('username', usernameClean);

        return !userError;
    }

    async isAuthenticated(): Promise<boolean> {
        return true;
    }
}

export const authService = new AuthService();

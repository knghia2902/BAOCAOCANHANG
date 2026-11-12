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
    private async trySupabaseAuthLogin(emailCandidate: string, password: string, usernameFallback: string): Promise<LoginResult | null> {
        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: emailCandidate,
                password
            });

            if (!authError && authData?.user) {
                const meta = authData.user.user_metadata || {};
                return {
                    success: true,
                    user: {
                        id: authData.user.id,
                        username: meta.username || usernameFallback,
                        role: meta.role || 'staff',
                        displayName: meta.displayName || meta.name || usernameFallback,
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
        return null;
    }

    private async tryPublicUsersLogin(usernameClean: string, password: string, hashedInputPassword: string): Promise<LoginResult | null> {
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
                        error: 'Tài khoản này đã bị khóa hoặc ngừng kích hoạt!'
                    };
                }

                // Kiểm tra mật khẩu an toàn
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
                    error: 'Tên đăng nhập hoặc mật khẩu không đúng!'
                };
            }
        } catch (err) {
            console.warn('Lỗi truy vấn bảng users:', err);
        }
        return null;
    }

    async login(username: string, password: string): Promise<LoginResult> {
        const usernameClean = username.trim().toLowerCase();
        const hashedInputPassword = await sha256(password);

        // Nếu nhập email -> ưu tiên Supabase Auth; nếu nhập username nội bộ -> tra bảng public.users trước để tránh 1 RTT lỗi 400
        if (usernameClean.includes('@')) {
            const authRes = await this.trySupabaseAuthLogin(usernameClean, password, usernameClean);
            if (authRes) return authRes;

            const dbRes = await this.tryPublicUsersLogin(usernameClean, password, hashedInputPassword);
            if (dbRes) return dbRes;
        } else {
            const dbRes = await this.tryPublicUsersLogin(usernameClean, password, hashedInputPassword);
            if (dbRes) return dbRes;

            const authRes = await this.trySupabaseAuthLogin(`${usernameClean}@cangnguyenngoc.vn`, password, usernameClean);
            if (authRes) return authRes;
        }

        return {
            success: false,
            error: 'Tên đăng nhập hoặc mật khẩu không đúng!'
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
            return { success: false, error: 'Không tìm thấy thông tin tài khoản' };
        }

        // Kiểm tra độ dài mật khẩu mới
        if (!newPassword || newPassword.length < 6) {
            return { success: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự' };
        }

        // Nếu có oldPassword, kiểm tra tính hợp lệ trước khi cho đổi
        if (oldPassword) {
            const verifyLogin = await this.login(usernameClean, oldPassword);
            if (!verifyLogin.success) {
                return { success: false, error: 'Mật khẩu hiện tại không chính xác' };
            }
        }

        // 1. Cập nhật Supabase Auth nếu session đang mở
        try {
            await supabase.auth.updateUser({ password: newPassword });
        } catch (_) {}

        // 2. Cập nhật bảng users
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

        return { success: false, error: error.message || 'Không thể cập nhật mật khẩu' };
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

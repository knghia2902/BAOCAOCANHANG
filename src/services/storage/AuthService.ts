import { supabase } from '../../supabase';

export interface User {
    username: string;
    role: 'admin' | 'staff';
    displayName?: string;
    avatar?: string;
}

export async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export class AuthService {
    async login(username: string, password: string): Promise<{ success: boolean; user?: User; isFirstLogin?: boolean }> {
        const { data, error } = await supabase.from('content').select('settings').eq('id', 'main').single();

        if (error || !data?.settings) return { success: false };

        const settings = data.settings;
        
        // 1. Check primary legacy admin account
        if (username === settings.username && password === settings.password) {
            return { 
                success: true, 
                user: { 
                    username, 
                    role: 'admin', 
                    displayName: settings.displayName || 'Admin',
                    avatar: settings.avatar || ''
                },
                isFirstLogin: settings.is_first 
            };
        }

        // 2. Check secondary accounts list inside settings.accounts
        const accounts = settings.accounts || [];
        const hashedInputPassword = await sha256(password);
        
        const matchedAccount = accounts.find((acc: any) => acc.username === username && acc.password === hashedInputPassword);
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

        return { success: false };
    }

    async changePassword(newPassword: string): Promise<boolean> {
        const { data: current, error: fetchError } = await supabase.from('content').select('settings').eq('id', 'main').single();
        if (fetchError || !current?.settings) return false;

        const newSettings = {
            ...current.settings,
            password: newPassword,
            is_first: false
        };

        const { error } = await supabase
            .from('content')
            .update({ settings: newSettings })
            .eq('id', 'main');

        return !error;
    }

    async updateProfile(username: string, displayName: string, newPassword?: string, avatar?: string): Promise<boolean> {
        const { data: current, error: fetchError } = await supabase.from('content').select('settings').eq('id', 'main').single();
        if (fetchError || !current?.settings) return false;

        const settings = current.settings;
        let isUpdated = false;

        // If the user is the primary admin
        if (username === settings.username) {
            const newSettings = { ...settings };
            if (displayName) {
                newSettings.displayName = displayName;
            }
            if (newPassword) {
                newSettings.password = newPassword;
                newSettings.is_first = false;
            }
            if (avatar !== undefined) {
                newSettings.avatar = avatar;
            }
            const { error } = await supabase
                .from('content')
                .update({ settings: newSettings })
                .eq('id', 'main');
            return !error;
        }

        // If the user is a staff account (or other secondary admin account)
        const accounts = settings.accounts || [];
        const updatedAccounts = await Promise.all(accounts.map(async (acc: any) => {
            if (acc.username === username) {
                isUpdated = true;
                const updatedAcc = { ...acc };
                if (displayName) {
                    updatedAcc.displayName = displayName;
                }
                if (newPassword) {
                    updatedAcc.password = await sha256(newPassword);
                }
                if (avatar !== undefined) {
                    updatedAcc.avatar = avatar;
                }
                return updatedAcc;
            }
            return acc;
        }));

        if (!isUpdated) return false;

        const newSettings = {
            ...settings,
            accounts: updatedAccounts
        };
        
        const { error } = await supabase
            .from('content')
            .update({ settings: newSettings })
            .eq('id', 'main');
        return !error;
    }

    async isAuthenticated(): Promise<boolean> {
        // Simplified for this demo - in a real app, use Supabase Auth session
        return true;
    }
}

export const authService = new AuthService();



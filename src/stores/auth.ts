import { reactive, watch } from 'vue';
import { authService } from '../services/storage/AuthService';

interface AuthState {
    isAuthenticated: boolean;
    user: string | null;
    role: string | null;
    displayName: string | null;
    avatar: string | null;
    isFirstLogin: boolean;
    rolePermissions: Record<string, { tools: string[]; canWrite: boolean; canDelete: boolean }>;
}

import { LogService } from '../services/storage/LogService';

const STORAGE_KEY = 'auth_session';

const savedState = localStorage.getItem(STORAGE_KEY);
const saved = savedState ? JSON.parse(savedState) : null;
const initialState: AuthState = {
    isAuthenticated: saved?.isAuthenticated ?? false,
    user: saved?.user ?? null,
    role: saved?.role ?? (saved?.isAuthenticated ? 'admin' : null),
    displayName: saved?.displayName ?? (saved?.isAuthenticated ? 'Admin' : null),
    avatar: saved?.avatar ?? null,
    isFirstLogin: saved?.isFirstLogin ?? false,
    rolePermissions: saved?.rolePermissions ?? {
        admin: { tools: ['converter', 'merger', 'weighbridge', 'allocator', 'vehicles', 'ocr'], canWrite: true, canDelete: true },
        staff: { tools: ['converter', 'merger', 'ocr'], canWrite: true, canDelete: false },
        operator: { tools: ['weighbridge', 'allocator', 'vehicles'], canWrite: true, canDelete: false },
        viewer: { tools: ['weighbridge', 'allocator', 'vehicles'], canWrite: false, canDelete: false }
    }
};

export const authStore = reactive<AuthState>(initialState);

// Persistence for Session (keep login on refresh)
watch(authStore, (state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
});

import { ContentService } from '../services/ContentService';

export const login = async (username: string, pass: string) => {
    const res = await authService.login(username, pass);
    if (res.success && res.user) {
        authStore.isAuthenticated = true;
        authStore.user = res.user.username;
        authStore.role = res.user.role;
        authStore.displayName = res.user.displayName || res.user.username;
        authStore.avatar = res.user.avatar || null;
        authStore.isFirstLogin = res.isFirstLogin || false;
        
        try {
            const perms = await ContentService.loadRolePermissions();
            authStore.rolePermissions = perms;
        } catch (e) {
            console.error('Failed to load role permissions on login:', e);
        }
        
        // Log login action
        await LogService.logAction('Đăng nhập', 'Đăng nhập thành công vào hệ thống');
        return true;
    }
    return false;
};

export const logout = () => {
    if (authStore.user) {
        LogService.logAction('Đăng xuất', 'Đăng xuất khỏi hệ thống');
    }
    authStore.isAuthenticated = false;
    authStore.user = null;
    authStore.role = null;
    authStore.displayName = null;
    authStore.avatar = null;
    authStore.isFirstLogin = false;
};

export const updateStoreProfile = (displayName: string, avatarUrl?: string) => {
    authStore.displayName = displayName;
    if (avatarUrl !== undefined) {
        authStore.avatar = avatarUrl;
    }
};

export const hasPermission = (toolId: string) => {
    if (!authStore.isAuthenticated) return false;
    if (authStore.role === 'admin') return true;
    const perm = authStore.rolePermissions?.[authStore.role || ''];
    return perm ? perm.tools.includes(toolId) : false;
};

export const canWrite = () => {
    if (!authStore.isAuthenticated) return false;
    if (authStore.role === 'admin') return true;
    const perm = authStore.rolePermissions?.[authStore.role || ''];
    return perm ? perm.canWrite : false;
};

export const canDelete = () => {
    if (!authStore.isAuthenticated) return false;
    if (authStore.role === 'admin') return true;
    const perm = authStore.rolePermissions?.[authStore.role || ''];
    return perm ? perm.canDelete : false;
};



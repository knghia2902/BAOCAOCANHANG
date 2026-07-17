import { reactive, watch } from 'vue';
import { authService } from '../services/storage/AuthService';

interface AuthState {
    isAuthenticated: boolean;
    user: string | null;
    role: string | null;
    displayName: string | null;
    avatar: string | null;
    isFirstLogin: boolean;
    rolePermissions: Record<string, { 
        tools: string[]; 
        canCreate: boolean; 
        canUpdate: boolean; 
        canDelete: boolean;
        detailPermissions?: Record<string, string[]>;
    }>;
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
        admin: { 
            tools: ['converter', 'merger', 'weighbridge', 'allocator', 'vehicles', 'ocr'], 
            canCreate: true, 
            canUpdate: true, 
            canDelete: true,
            detailPermissions: {
                weighbridge: ['wb_vessel_manage', 'wb_truck_manage', 'wb_print_export', 'wb_layout_config'],
                allocator: ['al_barge_manage', 'al_rules_manage', 'al_export'],
                vehicles: ['veh_barge_profile', 'veh_crew_profile', 'veh_registry_insurance'],
                minutes: ['min_create', 'min_export']
            }
        },
        staff: { 
            tools: ['converter', 'merger', 'ocr'], 
            canCreate: true, 
            canUpdate: true, 
            canDelete: false,
            detailPermissions: {
                weighbridge: ['wb_print_export'],
                allocator: ['al_export'],
                vehicles: ['veh_barge_profile', 'veh_crew_profile'],
                minutes: ['min_create', 'min_export']
            }
        },
        operator: { 
            tools: ['weighbridge', 'allocator', 'vehicles'], 
            canCreate: true, 
            canUpdate: true, 
            canDelete: false,
            detailPermissions: {
                weighbridge: ['wb_vessel_manage', 'wb_truck_manage', 'wb_print_export'],
                allocator: ['al_barge_manage', 'al_export'],
                vehicles: ['veh_barge_profile', 'veh_crew_profile', 'veh_registry_insurance'],
                minutes: ['min_create', 'min_export']
            }
        },
        viewer: { 
            tools: ['weighbridge', 'allocator', 'vehicles'], 
            canCreate: false, 
            canUpdate: false, 
            canDelete: false,
            detailPermissions: {
                weighbridge: ['wb_print_export'],
                allocator: ['al_export'],
                vehicles: ['veh_barge_profile'],
                minutes: ['min_export']
            }
        }
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

export const canCreate = () => {
    if (!authStore.isAuthenticated) return false;
    if (authStore.role === 'admin') return true;
    const perm = authStore.rolePermissions?.[authStore.role || ''];
    return perm ? perm.canCreate : false;
};

export const canUpdate = () => {
    if (!authStore.isAuthenticated) return false;
    if (authStore.role === 'admin') return true;
    const perm = authStore.rolePermissions?.[authStore.role || ''];
    return perm ? perm.canUpdate : false;
};

export const canWrite = () => {
    return canCreate() || canUpdate();
};

export const canDelete = () => {
    if (!authStore.isAuthenticated) return false;
    if (authStore.role === 'admin') return true;
    const perm = authStore.rolePermissions?.[authStore.role || ''];
    return perm ? perm.canDelete : false;
};

export const hasDetailPermission = (toolId: string, permissionId: string, _action?: string): boolean => {
    if (!authStore.isAuthenticated) return false;
    if (authStore.role === 'admin') return true;
    const perm = authStore.rolePermissions?.[authStore.role || ''];
    if (!perm) return false;
    if (!perm.tools.includes(toolId)) return false;
    if (!perm.detailPermissions) return true;
    const toolPerms = perm.detailPermissions[toolId];
    if (!toolPerms) return true;
    return toolPerms.includes(permissionId);
};




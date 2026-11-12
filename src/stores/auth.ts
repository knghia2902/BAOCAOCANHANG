import { reactive, watch } from 'vue';
import { authService } from '../services/storage/AuthService';
import { DemoSandboxService } from '../services/storage/DemoSandboxService';
import { LogService } from '../services/storage/LogService';
import { ContentService } from '../services/ContentService';
import { SettingsService } from '../services/storage/SettingsService';
import { invalidateVesselsCache } from '../services/weighbridge/WeighbridgeService';
import { AllocatorService } from '../services/excel/AllocatorService';
import { WarehouseInventoryService } from '../services/excel/WarehouseInventoryService';

interface AuthState {
    isAuthenticated: boolean;
    user: string | null;
    role: string | null;
    displayName: string | null;
    avatar: string | null;
    isFirstLogin: boolean;
    isDemoMode?: boolean;
    rolePermissions: Record<string, { 
        tools: string[]; 
        canCreate: boolean; 
        canUpdate: boolean; 
        canDelete: boolean;
        detailPermissions?: Record<string, string[]>;
    }>;
}

const STORAGE_KEY = 'auth_session';

function invalidateAllSessionCaches() {
    try {
        SettingsService.invalidateCache();
        invalidateVesselsCache();
        AllocatorService.invalidateCache();
        WarehouseInventoryService.clearPlaceMapCache();
    } catch (_) {}
}

let saved: any = null;
try {
    // Nếu phiên demo đã hết hạn (portfolio_login_expiry), DemoSandboxService.isDemoMode() sẽ dọn dẹp auth_session
    const demoCurrentlyValid = DemoSandboxService.isDemoMode();
    const savedState = localStorage.getItem(STORAGE_KEY);
    saved = savedState ? JSON.parse(savedState) : null;
    if (saved?.isDemoMode && !demoCurrentlyValid) {
        saved = null;
    }
} catch (e) {
    console.warn('Could not parse saved auth session:', e);
}

const DEFAULT_ROLE_PERMISSIONS: AuthState['rolePermissions'] = {
    admin: { 
        tools: ['converter', 'merger', 'weighbridge', 'allocator', 'vehicles', 'ocr'], 
        canCreate: true, 
        canUpdate: true, 
        canDelete: true,
        detailPermissions: {
            weighbridge: ['wb_vessel_manage', 'wb_truck_manage', 'wb_print_export', 'wb_layout_config'],
            allocator: ['al_barge_manage', 'al_rules_manage', 'al_data_manage', 'al_export'],
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
};

const initialState: AuthState = {
    isAuthenticated: saved?.isAuthenticated ?? false,
    user: saved?.user ?? null,
    role: saved?.role ?? (saved?.isAuthenticated ? 'admin' : null),
    displayName: saved?.displayName ?? (saved?.isAuthenticated ? 'Admin' : null),
    avatar: saved?.avatar ?? null,
    isFirstLogin: saved?.isFirstLogin ?? false,
    isDemoMode: saved?.isDemoMode ?? false,
    rolePermissions: saved?.rolePermissions ?? DEFAULT_ROLE_PERMISSIONS
};

export const authStore = reactive<AuthState>(initialState);

// Đồng bộ tức thời (flush: 'sync') để tránh race condition giữa authStore và localStorage.getItem('auth_session')
watch(
    authStore,
    (state) => {
        try {
            if (!state.isAuthenticated && !state.user) {
                localStorage.removeItem(STORAGE_KEY);
            } else {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            }
        } catch (_) {}
    },
    { flush: 'sync' }
);

/** Đăng nhập chế độ Thử Nghiệm (Demo Sandbox Mode) */
export const loginAsDemo = (): { success: boolean } => {
    DemoSandboxService.reset();
    invalidateAllSessionCaches();

    authStore.isAuthenticated = true;
    authStore.user = 'demo';
    authStore.role = 'admin'; // Cấp toàn quyền admin để người test trải nghiệm trọn vẹn
    authStore.displayName = 'Khách Trải Nghiệm (Demo)';
    authStore.avatar = '';
    authStore.isFirstLogin = false;
    authStore.isDemoMode = true;
    authStore.rolePermissions = {
        admin: {
            tools: ['converter', 'merger', 'weighbridge', 'allocator', 'vehicles', 'ocr'],
            canCreate: true,
            canUpdate: true,
            canDelete: true,
            detailPermissions: {
                weighbridge: ['wb_vessel_manage', 'wb_truck_manage', 'wb_print_export', 'wb_layout_config'],
                allocator: ['al_barge_manage', 'al_rules_manage', 'al_data_manage', 'al_export'],
                vehicles: ['veh_barge_profile', 'veh_crew_profile', 'veh_registry_insurance'],
                minutes: ['min_create', 'min_export']
            }
        }
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(authStore));
    } catch (_) {}

    return { success: true };
};

export const login = async (username: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    if (username.trim().toLowerCase() === 'demo') {
        return loginAsDemo();
    }

    // Đảm bảo thoát hoàn toàn chế độ Demo TRƯỚC KHI gọi authService.login để truy vấn bảng users đi vào Supabase thật
    if (authStore.isDemoMode || DemoSandboxService.isDemoMode()) {
        DemoSandboxService.reset();
        authStore.isDemoMode = false;
        authStore.isAuthenticated = false;
        authStore.user = null;
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem('portfolio_user');
        } catch (_) {}
        invalidateAllSessionCaches();
    }

    const res = await authService.login(username, pass);
    if (res.success && res.user) {
        invalidateAllSessionCaches();
        authStore.isDemoMode = false;
        authStore.isAuthenticated = true;
        authStore.user = res.user.username;
        authStore.role = res.user.role;
        authStore.displayName = res.user.displayName || res.user.username;
        authStore.avatar = res.user.avatar || null;
        authStore.isFirstLogin = res.isFirstLogin || false;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(authStore));
        } catch (_) {}

        try {
            const perms = await ContentService.loadRolePermissions();
            authStore.rolePermissions = perms;
        } catch (e) {
            console.error('Failed to load role permissions on login:', e);
        }

        // Log login action
        await LogService.logAction('Đăng nhập', 'Đăng nhập thành công vào hệ thống');
        return { success: true };
    }
    return { success: false, error: res.error || 'Tên đăng nhập hoặc mật khẩu không đúng!' };
};

export const logout = async () => {
    const wasDemo = !!authStore.isDemoMode || DemoSandboxService.isDemoMode();
    const hadRealUser = !!authStore.user && !wasDemo;

    if (wasDemo) {
        DemoSandboxService.reset();
    }

    // Đặt lại trạng thái authStore và xóa localStorage TRƯỚC khi await để không bị race condition
    authStore.isAuthenticated = false;
    authStore.user = null;
    authStore.role = null;
    authStore.displayName = null;
    authStore.avatar = null;
    authStore.isFirstLogin = false;
    authStore.isDemoMode = false;
    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('portfolio_user');
    } catch (_) {}

    invalidateAllSessionCaches();

    if (hadRealUser) {
        LogService.logAction('Đăng xuất', 'Đăng xuất khỏi hệ thống');
    }
    await authService.logout();
};

// Cross-tab logout and session synchronization
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY) {
            try {
                const updated = event.newValue ? JSON.parse(event.newValue) : null;
                if (!updated || !updated.isAuthenticated) {
                    authStore.isAuthenticated = false;
                    authStore.user = null;
                    authStore.role = null;
                    authStore.displayName = null;
                    authStore.avatar = null;
                    authStore.isDemoMode = false;
                    invalidateAllSessionCaches();
                } else if (
                    updated.user !== authStore.user ||
                    !!updated.isDemoMode !== !!authStore.isDemoMode
                ) {
                    authStore.isAuthenticated = !!updated.isAuthenticated;
                    authStore.user = updated.user ?? null;
                    authStore.role = updated.role ?? null;
                    authStore.displayName = updated.displayName ?? null;
                    authStore.avatar = updated.avatar ?? null;
                    authStore.isDemoMode = !!updated.isDemoMode;
                    invalidateAllSessionCaches();
                }
            } catch (_) {}
        }
    });
}

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

export const hasDetailPermission = (toolId: string, permissionId: string, action?: string): boolean => {
    if (!authStore.isAuthenticated) return false;
    if (authStore.role === 'admin') return true;
    const perm = authStore.rolePermissions?.[authStore.role || ''];
    if (!perm) return false;
    if (!perm.tools.includes(toolId)) return false;
    if (!perm.detailPermissions) return true;
    const toolPerms = perm.detailPermissions[toolId];
    if (!toolPerms) return true;
    
    // Backwards compatibility: if bare permissionId is present, all actions are allowed
    if (toolPerms.includes(permissionId)) {
        return true;
    }
    
    if (action) {
        const act = action === 'read' ? 'read' : action === 'create' ? 'create' : action === 'update' ? 'update' : action === 'delete' ? 'delete' : action;
        return toolPerms.includes(`${permissionId}:${act}`);
    }
    
    return toolPerms.some(p => p.startsWith(`${permissionId}:`));
};

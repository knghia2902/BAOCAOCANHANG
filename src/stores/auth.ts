import { reactive, watch } from 'vue';
import { authService } from '../services/storage/AuthService';
import { DemoSandboxService } from '../services/storage/DemoSandboxService';
import { LogService } from '../services/storage/LogService';
import { ContentService } from '../services/ContentService';
import { SettingsService } from '../services/storage/SettingsService';
import { invalidateVesselsCache } from '../services/weighbridge/WeighbridgeService';
import { AllocatorService } from '../services/excel/AllocatorService';
import { WarehouseInventoryService } from '../services/excel/WarehouseInventoryService';

export interface RolePermissionConfig {
    label?: string;
    tools: string[];
    description?: string;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    detailPermissions?: Record<string, string[]>;
}

interface AuthState {
    isAuthenticated: boolean;
    user: string | null;
    role: string | null;
    displayName: string | null;
    avatar: string | null;
    isFirstLogin: boolean;
    isDemoMode?: boolean;
    rolePermissions: Record<string, RolePermissionConfig>;
}

export const DEFAULT_ROLE_LABELS: Record<string, string> = {
    admin: 'Quản trị viên',
    staff: 'Nhân viên văn phòng',
    operator: 'Nhân viên vận hành',
    viewer: 'Giám sát (Chỉ xem)'
};

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

export const DEFAULT_ROLE_PERMISSIONS: Record<string, RolePermissionConfig> = {
    admin: {
        label: DEFAULT_ROLE_LABELS.admin,
        tools: ['vessel_source', 'allocator', 'warehouse', 'weighbridge', 'split', 'vehicles', 'minutes', 'categories', 'converter', 'merger', 'ocr'],
        description: 'Quản trị viên toàn quyền hệ thống',
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        detailPermissions: {
            vessel_source: ['vs_vessel_manage', 'vs_barge_manage'],
            allocator: ['al_data_manage', 'al_export'],
            warehouse: ['wh_import', 'wh_export', 'wh_config', 'wh_customer_manage', 'wh_delete_tickets'],
            weighbridge: ['wb_vessel_manage', 'wb_truck_manage', 'wb_print_export', 'wb_layout_config'],
            split: ['split_manage', 'split_export'],
            vehicles: ['veh_barge_profile'],
            minutes: ['min_create', 'min_export'],
            categories: ['cat_vehicles', 'cat_customers', 'cat_warehouses', 'cat_goods']
        }
    },
    staff: {
        label: DEFAULT_ROLE_LABELS.staff,
        tools: ['converter', 'merger', 'ocr', 'minutes', 'categories'],
        description: 'Nhân viên văn phòng, xử lý tài liệu Excel/PDF và biên bản',
        canCreate: true,
        canUpdate: true,
        canDelete: false,
        detailPermissions: {
            minutes: ['min_create', 'min_export'],
            categories: ['cat_vehicles:read', 'cat_customers:read', 'cat_warehouses:read', 'cat_goods:read']
        }
    },
    operator: {
        label: DEFAULT_ROLE_LABELS.operator,
        tools: ['vessel_source', 'allocator', 'warehouse', 'weighbridge', 'split', 'vehicles', 'minutes', 'categories'],
        description: 'Nhân viên vận hành, quản lý nguồn tàu, dữ liệu cân và báo cáo',
        canCreate: true,
        canUpdate: true,
        canDelete: false,
        detailPermissions: {
            vessel_source: ['vs_vessel_manage', 'vs_barge_manage'],
            allocator: ['al_data_manage', 'al_export'],
            warehouse: ['wh_import', 'wh_export', 'wh_customer_manage'],
            weighbridge: ['wb_vessel_manage', 'wb_truck_manage', 'wb_print_export'],
            split: ['split_manage', 'split_export'],
            vehicles: ['veh_barge_profile'],
            minutes: ['min_create', 'min_export'],
            categories: [
                'cat_vehicles:read', 'cat_vehicles:create', 'cat_vehicles:update',
                'cat_customers:read', 'cat_customers:create', 'cat_customers:update',
                'cat_warehouses:read', 'cat_warehouses:create', 'cat_warehouses:update',
                'cat_goods:read', 'cat_goods:create', 'cat_goods:update'
            ]
        }
    },
    viewer: {
        label: DEFAULT_ROLE_LABELS.viewer,
        tools: ['vessel_source', 'allocator', 'warehouse', 'weighbridge', 'split', 'vehicles', 'categories'],
        description: 'Tài khoản giám sát, chỉ xem dữ liệu và báo cáo sản lượng',
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        detailPermissions: {
            vessel_source: ['vs_vessel_manage:read', 'vs_barge_manage:read'],
            allocator: ['al_export:read'],
            warehouse: ['wh_export:read'],
            weighbridge: ['wb_print_export:read'],
            split: ['split_export:read'],
            vehicles: ['veh_barge_profile:read'],
            categories: ['cat_vehicles:read', 'cat_customers:read', 'cat_warehouses:read', 'cat_goods:read']
        }
    }
};

const initialState: AuthState = {
    isAuthenticated: !!saved?.isAuthenticated && !!saved?.user && !!saved?.role,
    user: saved?.user ?? null,
    role: saved?.role ?? null,
    displayName: saved?.displayName ?? null,
    avatar: saved?.avatar ?? null,
    isFirstLogin: saved?.isFirstLogin ?? false,
    isDemoMode: saved?.isDemoMode ?? false,
    rolePermissions: saved?.rolePermissions ?? DEFAULT_ROLE_PERMISSIONS
};

export const authStore = reactive<AuthState>(initialState);

export const getRoleLabel = (
    roleKey: string,
    permsMap?: Record<string, RolePermissionConfig>
): string => {
    return (permsMap ?? authStore.rolePermissions)?.[roleKey]?.label?.trim() || DEFAULT_ROLE_LABELS[roleKey] || roleKey;
};

export const refreshRolePermissions = async (): Promise<boolean> => {
    if (!authStore.isAuthenticated || !authStore.user || authStore.isDemoMode) {
        return false;
    }
    try {
        const perms = await ContentService.loadRolePermissions();
        if (perms && typeof perms === 'object') {
            authStore.rolePermissions = perms;
            return true;
        }
        return false;
    } catch (e) {
        console.error('Failed to refresh role permissions:', e);
        return false;
    }
};

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
        admin: JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS.admin))
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
    if (!perm) return false;
    if (toolId === 'utilities') {
        return perm.tools.includes('converter') || perm.tools.includes('merger') || perm.tools.includes('ocr');
    }
    return perm.tools.includes(toolId);
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
    if (!perm.detailPermissions) return false;
    const toolPerms = perm.detailPermissions[toolId];
    if (!toolPerms || !Array.isArray(toolPerms) || toolPerms.length === 0) return false;
    
    // Strict delete check: if action is delete and role's canDelete is false, deny immediately
    if (action === 'delete' && !perm.canDelete) {
        return false;
    }
    
    if (action) {
        const act = action === 'read' ? 'read' : action === 'create' ? 'create' : action === 'update' ? 'update' : action === 'delete' ? 'delete' : action;
        
        // Exact match or wildcard match
        if (toolPerms.includes(`${permissionId}:${act}`) || toolPerms.includes(`${permissionId}:*`)) {
            return true;
        }

        // Backwards compatibility: if bare permissionId is present in toolPerms,
        // it grants access to standard actions subject to role-level action flags
        if (toolPerms.includes(permissionId)) {
            if (act === 'delete' && !perm.canDelete) return false;
            if (act === 'create' && perm.canCreate === false) return false;
            if (act === 'update' && perm.canUpdate === false) return false;
            return true;
        }

        return false;
    }
    
    // No specific action provided: check if permissionId itself or any action of it exists
    if (toolPerms.includes(permissionId) || toolPerms.includes(`${permissionId}:*`)) {
        return true;
    }
    
    return toolPerms.some(p => p.startsWith(`${permissionId}:`));
};

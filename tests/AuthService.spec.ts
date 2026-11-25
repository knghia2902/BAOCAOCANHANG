import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '@/services/storage/AuthService';
import { supabase } from '@/supabase';
import {
    authStore,
    DEFAULT_ROLE_PERMISSIONS as STORE_DEFAULT_ROLE_PERMISSIONS,
    DEFAULT_ROLE_LABELS as STORE_DEFAULT_ROLE_LABELS,
    getRoleLabel as storeGetRoleLabel,
    refreshRolePermissions,
    hasDetailPermission
} from '@/stores/auth';
import {
    DEFAULT_ROLE_PERMISSIONS as SERVICE_DEFAULT_ROLE_PERMISSIONS,
    DEFAULT_ROLE_LABELS as SERVICE_DEFAULT_ROLE_LABELS,
    getRoleLabel as serviceGetRoleLabel,
    canAccessWorkspaceTab
} from '@/services/auth/PermissionService';
import { ContentService } from '@/services/ContentService';

vi.mock('@/supabase', () => {
    const mockBuilder = {
        select: vi.fn(() => mockBuilder),
        update: vi.fn(() => mockBuilder),
        insert: vi.fn(() => mockBuilder),
        delete: vi.fn(() => mockBuilder),
        eq: vi.fn(() => mockBuilder),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null })
    };

    return {
        supabase: {
            from: vi.fn(() => mockBuilder),
            auth: {
                signInWithPassword: vi.fn(),
                signOut: vi.fn(),
                getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
                updateUser: vi.fn()
            }
        }
    };
});

describe('AuthService - Session Validation & Role Tampering Protection', () => {
    let authService: AuthService;

    beforeEach(() => {
        vi.clearAllMocks();
        authService = new AuthService();
    });

    it('returns null when username is empty or whitespace', async () => {
        const result = await authService.validateSession('');
        expect(result).toBeNull();

        const resultWhitespace = await authService.validateSession('   ');
        expect(resultWhitespace).toBeNull();
    });

    it('returns demo admin user when username is demo', async () => {
        const result = await authService.validateSession('demo');
        expect(result).not.toBeNull();
        expect(result?.username).toBe('demo');
        expect(result?.role).toBe('admin');
        expect(result?.isActive).toBe(true);
    });

    it('returns user data and role from Supabase when user exists and is active', async () => {
        const mockBuilder: any = (supabase.from as any)('users');
        mockBuilder.maybeSingle.mockResolvedValueOnce({
            data: {
                id: 'user-uuid-1',
                username: 'staff1',
                role: 'staff',
                display_name: 'Staff One',
                avatar: 'avatar.png',
                is_active: true,
                created_at: '2026-01-01T00:00:00Z'
            },
            error: null
        });

        const result = await authService.validateSession('staff1');
        expect(result).not.toBeNull();
        expect(result?.username).toBe('staff1');
        expect(result?.role).toBe('staff');
        expect(result?.displayName).toBe('Staff One');
        expect(result?.isActive).toBe(true);
        expect(mockBuilder.eq).toHaveBeenCalledWith('username', 'staff1');
    });

    it('returns null when user exists but has is_active = false', async () => {
        const mockBuilder: any = (supabase.from as any)('users');
        mockBuilder.maybeSingle.mockResolvedValueOnce({
            data: {
                id: 'user-uuid-2',
                username: 'blocked_user',
                role: 'operator',
                display_name: 'Blocked User',
                is_active: false
            },
            error: null
        });

        const result = await authService.validateSession('blocked_user');
        expect(result).toBeNull();
    });

    it('returns null when user does not exist in database', async () => {
        const mockBuilder: any = (supabase.from as any)('users');
        mockBuilder.maybeSingle.mockResolvedValueOnce({
            data: null,
            error: null
        });

        const result = await authService.validateSession('unknown_user');
        expect(result).toBeNull();
    });
});

describe('Permission Schema & Authorization Guards', () => {
    const resetAuthState = (
        role: string | null,
        rolePermissions = JSON.parse(JSON.stringify(STORE_DEFAULT_ROLE_PERMISSIONS))
    ) => {
        authStore.isAuthenticated = !!role;
        authStore.user = role ? `test_${role}` : null;
        authStore.role = role;
        authStore.rolePermissions = rolePermissions;
    };

    beforeEach(() => {
        resetAuthState(null);
    });

    it('keeps DEFAULT_ROLE_PERMISSIONS strictly synchronized between auth store and PermissionService', () => {
        expect(STORE_DEFAULT_ROLE_PERMISSIONS).toBe(SERVICE_DEFAULT_ROLE_PERMISSIONS);
        expect(STORE_DEFAULT_ROLE_PERMISSIONS).toEqual(SERVICE_DEFAULT_ROLE_PERMISSIONS);
        expect(STORE_DEFAULT_ROLE_LABELS).toBe(SERVICE_DEFAULT_ROLE_LABELS);
        expect(storeGetRoleLabel).toBe(serviceGetRoleLabel);
        expect(Object.keys(STORE_DEFAULT_ROLE_PERMISSIONS).sort()).toEqual([
            'admin',
            'operator',
            'staff',
            'viewer'
        ]);
        expect(STORE_DEFAULT_ROLE_PERMISSIONS.admin.label).toBe('Quản trị viên');
        expect(STORE_DEFAULT_ROLE_PERMISSIONS.staff.label).toBe('Nhân viên văn phòng');
        expect(STORE_DEFAULT_ROLE_PERMISSIONS.operator.label).toBe('Nhân viên vận hành');
        expect(STORE_DEFAULT_ROLE_PERMISSIONS.viewer.label).toBe('Giám sát (Chỉ xem)');
        expect(STORE_DEFAULT_ROLE_PERMISSIONS.admin.tools).toContain('vessel_source');
        expect(STORE_DEFAULT_ROLE_PERMISSIONS.admin.tools).toContain('categories');
        expect(STORE_DEFAULT_ROLE_PERMISSIONS.admin.detailPermissions?.allocator).toEqual(['al_data_manage', 'al_export']);
        expect(STORE_DEFAULT_ROLE_PERMISSIONS.admin.detailPermissions?.vehicles).toEqual(['veh_barge_profile']);
        expect(STORE_DEFAULT_ROLE_PERMISSIONS.operator.detailPermissions?.allocator).toEqual(['al_data_manage', 'al_export']);
        expect(STORE_DEFAULT_ROLE_PERMISSIONS.operator.detailPermissions?.vehicles).toEqual(['veh_barge_profile']);
        expect(STORE_DEFAULT_ROLE_PERMISSIONS.staff.tools).toEqual([
            'converter',
            'merger',
            'ocr',
            'minutes',
            'categories'
        ]);
    });

    it('resolves role labels via DEFAULT_ROLE_LABELS and getRoleLabel', () => {
        expect(STORE_DEFAULT_ROLE_LABELS).toEqual({
            admin: 'Quản trị viên',
            staff: 'Nhân viên văn phòng',
            operator: 'Nhân viên vận hành',
            viewer: 'Giám sát (Chỉ xem)'
        });

        // Uses custom label from authStore.rolePermissions (trimmed)
        resetAuthState('ke_toan_kho', {
            ke_toan_kho: {
                label: '  Kế toán kho  ',
                tools: ['warehouse'],
                canCreate: true,
                canUpdate: true,
                canDelete: false
            },
            staff: {
                label: '   ',
                tools: ['minutes'],
                canCreate: false,
                canUpdate: false,
                canDelete: false
            }
        });
        expect(storeGetRoleLabel('ke_toan_kho')).toBe('Kế toán kho');
        // Blank custom label falls back to DEFAULT_ROLE_LABELS
        expect(storeGetRoleLabel('staff')).toBe('Nhân viên văn phòng');
        // Unknown role without custom label falls back to raw roleKey
        expect(storeGetRoleLabel('custom_unknown')).toBe('custom_unknown');

        // Explicit permsMap overrides authStore.rolePermissions
        const customMap = {
            admin: {
                label: 'Giám đốc hệ thống',
                tools: ['warehouse'],
                canCreate: true,
                canUpdate: true,
                canDelete: true
            }
        };
        expect(storeGetRoleLabel('admin', customMap)).toBe('Giám đốc hệ thống');
        expect(storeGetRoleLabel('operator', customMap)).toBe('Nhân viên vận hành');
        expect(storeGetRoleLabel('ke_toan_kho', customMap)).toBe('ke_toan_kho');
    });

    it('refreshes rolePermissions only for authenticated non-demo sessions', async () => {
        const loadSpy = vi.spyOn(ContentService, 'loadRolePermissions');

        // Unauthenticated -> no-op
        authStore.isAuthenticated = false;
        authStore.user = null;
        authStore.isDemoMode = false;
        expect(await refreshRolePermissions()).toBe(false);
        expect(loadSpy).not.toHaveBeenCalled();

        // Demo mode -> no-op
        authStore.isAuthenticated = true;
        authStore.user = 'demo';
        authStore.isDemoMode = true;
        expect(await refreshRolePermissions()).toBe(false);
        expect(loadSpy).not.toHaveBeenCalled();

        // Authenticated real user -> loads and updates authStore.rolePermissions
        const updatedPerms = {
            ...JSON.parse(JSON.stringify(STORE_DEFAULT_ROLE_PERMISSIONS)),
            ke_toan: {
                label: 'Kế toán',
                tools: ['warehouse'],
                canCreate: true,
                canUpdate: true,
                canDelete: false,
                detailPermissions: { warehouse: ['wh_export:read'] }
            }
        };
        loadSpy.mockResolvedValueOnce(updatedPerms);
        authStore.isAuthenticated = true;
        authStore.user = 'staff1';
        authStore.role = 'staff';
        authStore.isDemoMode = false;

        expect(await refreshRolePermissions()).toBe(true);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(authStore.rolePermissions.ke_toan?.label).toBe('Kế toán');

        // Error handling -> returns false cleanly
        loadSpy.mockRejectedValueOnce(new Error('Network error'));
        expect(await refreshRolePermissions()).toBe(false);

        loadSpy.mockRestore();
    });

    it('maps canAccessWorkspaceTab 1-to-1 and enforces default deny for unknown keys', () => {
        // Unauthenticated user is always denied
        expect(canAccessWorkspaceTab('scale-data')).toBe(false);
        expect(canAccessWorkspaceTab('vessel-source')).toBe(false);

        // Admin has access to all workspace tabs
        resetAuthState('admin');
        expect(canAccessWorkspaceTab('vessel-source')).toBe(true);
        expect(canAccessWorkspaceTab('scale-data')).toBe(true);
        expect(canAccessWorkspaceTab('category-goods')).toBe(true);

        // Single-tool isolation checks (strict 1-to-1 mapping)
        const tabToToolCases: Array<[string, string]> = [
            ['vessel-source', 'vessel_source'],
            ['scale-data', 'allocator'],
            ['report-inventory', 'warehouse'],
            ['report-shipment', 'weighbridge'],
            ['report-deheus', 'split'],
            ['vehicles', 'vehicles'],
            ['minutes', 'minutes']
        ];

        for (const [tabKey, toolId] of tabToToolCases) {
            resetAuthState('custom_role', {
                custom_role: {
                    tools: [toolId],
                    canCreate: false,
                    canUpdate: false,
                    canDelete: false,
                    detailPermissions: {}
                }
            });

            expect(canAccessWorkspaceTab(tabKey)).toBe(true);
            for (const [otherTab] of tabToToolCases) {
                if (otherTab !== tabKey) {
                    expect(canAccessWorkspaceTab(otherTab)).toBe(false);
                }
            }
            expect(canAccessWorkspaceTab('category-vehicles')).toBe(false);
            expect(canAccessWorkspaceTab('unknown-tab')).toBe(false);
        }

        // Category tabs require categories tool + corresponding cat_*:read detail permission
        const categoryCases: Array<[string, string]> = [
            ['category-vehicles', 'cat_vehicles'],
            ['category-customers', 'cat_customers'],
            ['category-warehouses', 'cat_warehouses'],
            ['category-goods', 'cat_goods']
        ];

        for (const [tabKey, permId] of categoryCases) {
            resetAuthState('cat_reader', {
                cat_reader: {
                    tools: ['categories'],
                    canCreate: false,
                    canUpdate: false,
                    canDelete: false,
                    detailPermissions: {
                        categories: [`${permId}:read`]
                    }
                }
            });

            expect(canAccessWorkspaceTab(tabKey)).toBe(true);
            for (const [otherTab] of categoryCases) {
                if (otherTab !== tabKey) {
                    expect(canAccessWorkspaceTab(otherTab)).toBe(false);
                }
            }
        }

        // Default deny for unknown tab keys on non-admin roles
        resetAuthState('operator');
        expect(canAccessWorkspaceTab('non-existent-tab')).toBe(false);
        expect(canAccessWorkspaceTab('')).toBe(false);
    });

    it('enforces strict delete and action checks in hasDetailPermission', () => {
        // Strict delete check: even with explicit :delete or :*, canDelete: false MUST deny
        resetAuthState('operator', {
            operator: {
                tools: ['categories', 'warehouse'],
                canCreate: true,
                canUpdate: true,
                canDelete: false,
                detailPermissions: {
                    categories: ['cat_vehicles:read', 'cat_vehicles:create', 'cat_vehicles:delete', 'cat_goods:*'],
                    warehouse: ['wh_delete_tickets']
                }
            }
        });

        expect(hasDetailPermission('categories', 'cat_vehicles', 'read')).toBe(true);
        expect(hasDetailPermission('categories', 'cat_vehicles', 'create')).toBe(true);
        expect(hasDetailPermission('categories', 'cat_vehicles', 'update')).toBe(false);
        expect(hasDetailPermission('categories', 'cat_vehicles', 'delete')).toBe(false);
        expect(hasDetailPermission('categories', 'cat_goods', 'update')).toBe(true);
        expect(hasDetailPermission('categories', 'cat_goods', 'delete')).toBe(false);
        expect(hasDetailPermission('warehouse', 'wh_delete_tickets', 'delete')).toBe(false);

        // Bare permission respects canCreate / canUpdate / canDelete flags
        resetAuthState('readonly_legacy', {
            readonly_legacy: {
                tools: ['vessel_source'],
                canCreate: false,
                canUpdate: false,
                canDelete: false,
                detailPermissions: {
                    vessel_source: ['vs_vessel_manage']
                }
            }
        });
        expect(hasDetailPermission('vessel_source', 'vs_vessel_manage', 'read')).toBe(true);
        expect(hasDetailPermission('vessel_source', 'vs_vessel_manage', 'create')).toBe(false);
        expect(hasDetailPermission('vessel_source', 'vs_vessel_manage', 'update')).toBe(false);
        expect(hasDetailPermission('vessel_source', 'vs_vessel_manage', 'delete')).toBe(false);

        // Role with canDelete: true and explicit permission allows delete
        resetAuthState('manager', {
            manager: {
                tools: ['categories'],
                canCreate: true,
                canUpdate: true,
                canDelete: true,
                detailPermissions: {
                    categories: ['cat_vehicles:delete']
                }
            }
        });
        expect(hasDetailPermission('categories', 'cat_vehicles', 'delete')).toBe(true);

        // Missing parent tool denies even if detailPermissions has entries
        resetAuthState('no_parent_tool', {
            no_parent_tool: {
                tools: [],
                canCreate: true,
                canUpdate: true,
                canDelete: true,
                detailPermissions: {
                    categories: ['cat_vehicles:*']
                }
            }
        });
        expect(hasDetailPermission('categories', 'cat_vehicles', 'read')).toBe(false);
    });
});

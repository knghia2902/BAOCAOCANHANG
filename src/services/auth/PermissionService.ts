import { SettingsService } from '@/services/storage/SettingsService';
import {
    authStore,
    hasPermission,
    hasDetailPermission,
    DEFAULT_ROLE_PERMISSIONS,
    DEFAULT_ROLE_LABELS,
    getRoleLabel,
    type RolePermissionConfig
} from '@/stores/auth';

export { DEFAULT_ROLE_PERMISSIONS, DEFAULT_ROLE_LABELS, getRoleLabel };
export type { RolePermissionConfig };

export const PermissionService = {
    async loadStaffTools(): Promise<string[]> {
        try {
            const settings = await SettingsService.getSettings();
            if (!settings) return ['converter', 'merger', 'weighbridge', 'allocator', 'ocr'];
            return settings.staff_tools || ['converter', 'merger', 'weighbridge', 'allocator', 'ocr'];
        } catch (e) {
            console.error('Error loading staff tools config', e);
            return ['converter', 'merger', 'weighbridge', 'allocator', 'ocr'];
        }
    },

    async saveStaffTools(tools: string[]): Promise<boolean> {
        try {
            return await SettingsService.updateSettings({ staff_tools: tools });
        } catch (e) {
            console.error('Error saving staff tools config', e);
            return false;
        }
    },

    async loadRolePermissions(): Promise<Record<string, RolePermissionConfig>> {
        try {
            const settings = await SettingsService.getSettings();
            if (!settings) return DEFAULT_ROLE_PERMISSIONS;
            return settings.role_permissions || DEFAULT_ROLE_PERMISSIONS;
        } catch (e) {
            console.error('Error loading role permissions config', e);
            return DEFAULT_ROLE_PERMISSIONS;
        }
    },

    async saveRolePermissions(rolePermissions: Record<string, RolePermissionConfig>): Promise<boolean> {
        try {
            return await SettingsService.updateSettings({ role_permissions: rolePermissions });
        } catch (e) {
            console.error('Error saving role permissions config', e);
            return false;
        }
    }
};

export function canAccessWorkspaceTab(key: string): boolean {
    if (!authStore.isAuthenticated) return false;
    if (authStore.role === 'admin') return true;

    switch (key) {
        case 'vessel-source':
            return hasPermission('vessel_source');
        case 'scale-data':
            return hasPermission('allocator');
        case 'report-inventory':
            return hasPermission('warehouse');
        case 'report-shipment':
            return hasPermission('weighbridge');
        case 'report-deheus':
            return hasPermission('split');
        case 'vehicles':
            return hasPermission('vehicles');
        case 'minutes':
            return hasPermission('minutes');
        case 'category-vehicles':
            return hasDetailPermission('categories', 'cat_vehicles', 'read');
        case 'category-customers':
            return hasDetailPermission('categories', 'cat_customers', 'read');
        case 'category-warehouses':
            return hasDetailPermission('categories', 'cat_warehouses', 'read');
        case 'category-goods':
            return hasDetailPermission('categories', 'cat_goods', 'read');
        default:
            return false;
    }
}

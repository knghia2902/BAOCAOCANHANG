import { SettingsService } from '@/services/storage/SettingsService';
import { authStore, hasPermission, hasDetailPermission } from '@/stores/auth';

export interface RolePermissionConfig {
    tools: string[];
    description?: string;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    detailPermissions?: Record<string, string[]>;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<string, RolePermissionConfig> = {
    admin: {
        tools: ['vessel_source', 'allocator', 'warehouse', 'weighbridge', 'split', 'vehicles', 'minutes', 'categories', 'converter', 'merger', 'ocr'],
        description: 'Quản trị viên toàn quyền hệ thống',
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        detailPermissions: {
            vessel_source: ['vs_vessel_manage', 'vs_barge_manage'],
            allocator: ['al_barge_manage', 'al_rules_manage', 'al_data_manage', 'al_export'],
            warehouse: ['wh_import', 'wh_export', 'wh_config', 'wh_customer_manage', 'wh_delete_tickets'],
            weighbridge: ['wb_vessel_manage', 'wb_truck_manage', 'wb_print_export', 'wb_layout_config'],
            split: ['split_manage', 'split_export'],
            vehicles: ['veh_barge_profile', 'veh_crew_profile', 'veh_registry_insurance'],
            minutes: ['min_create', 'min_export'],
            categories: ['cat_vehicles', 'cat_customers', 'cat_warehouses', 'cat_goods']
        }
    },
    staff: {
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
        tools: ['vessel_source', 'allocator', 'warehouse', 'weighbridge', 'split', 'vehicles', 'minutes', 'categories'],
        description: 'Nhân viên vận hành, quản lý nguồn tàu, dữ liệu cân và báo cáo',
        canCreate: true,
        canUpdate: true,
        canDelete: false,
        detailPermissions: {
            vessel_source: ['vs_vessel_manage', 'vs_barge_manage'],
            allocator: ['al_barge_manage', 'al_data_manage', 'al_export'],
            warehouse: ['wh_import', 'wh_export', 'wh_customer_manage'],
            weighbridge: ['wb_vessel_manage', 'wb_truck_manage', 'wb_print_export'],
            split: ['split_manage', 'split_export'],
            vehicles: ['veh_barge_profile', 'veh_crew_profile', 'veh_registry_insurance'],
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

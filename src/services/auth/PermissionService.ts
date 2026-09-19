import { supabase } from '@/supabase';

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
        tools: ['converter', 'merger', 'weighbridge', 'allocator', 'vehicles', 'ocr', 'minutes'],
        description: 'Qu?n tr? vi�n to�n quy?n h? th?ng',
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
        tools: ['converter', 'merger', 'ocr', 'minutes'],
        description: 'Nh�n vi�n v�n ph?ng, x? l? t�i li?u Excel/PDF',
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
        tools: ['weighbridge', 'allocator', 'vehicles', 'minutes'],
        description: 'Nh�n vi�n v?n h�nh, in phi?u c�n xe v� c?p nh?t chuy?n h�ng s� lan',
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
        description: 'T�i kho?n gi�m s�t, ch? xem b�o c�o s?n l�?ng',
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

export const PermissionService = {
    async loadStaffTools(): Promise<string[]> {
        try {
            const { data, error } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();
            if (error || !data?.settings) return ['converter', 'merger', 'weighbridge', 'allocator', 'ocr'];
            return data.settings.staff_tools || ['converter', 'merger', 'weighbridge', 'allocator', 'ocr'];
        } catch (e) {
            console.error('Error loading staff tools config', e);
            return ['converter', 'merger', 'weighbridge', 'allocator', 'ocr'];
        }
    },

    async saveStaffTools(tools: string[]): Promise<boolean> {
        try {
            const { data: current, error: fetchError } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();
            if (fetchError || !current?.settings) return false;
            
            const newSettings = {
                ...current.settings,
                staff_tools: tools
            };
            const { error } = await supabase
                .from('content')
                .update({ settings: newSettings })
                .eq('id', 'main');
            return !error;
        } catch (e) {
            console.error('Error saving staff tools config', e);
            return false;
        }
    },

    async loadRolePermissions(): Promise<Record<string, RolePermissionConfig>> {
        try {
            const { data, error } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();
            if (error || !data?.settings) return DEFAULT_ROLE_PERMISSIONS;
            return data.settings.role_permissions || DEFAULT_ROLE_PERMISSIONS;
        } catch (e) {
            console.error('Error loading role permissions config', e);
            return DEFAULT_ROLE_PERMISSIONS;
        }
    },

    async saveRolePermissions(rolePermissions: Record<string, RolePermissionConfig>): Promise<boolean> {
        try {
            const { data: current, error: fetchError } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();
            if (fetchError || !current?.settings) return false;
            
            const newSettings = {
                ...current.settings,
                role_permissions: rolePermissions
            };
            const { error } = await supabase
                .from('content')
                .update({ settings: newSettings })
                .eq('id', 'main');
            return !error;
        } catch (e) {
            console.error('Error saving role permissions config', e);
            return false;
        }
    }
};

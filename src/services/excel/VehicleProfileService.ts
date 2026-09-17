import { supabase } from '@/supabase';

export interface VehicleProfile {
    id: number;
    vehicle_name: string;
    site: 'NguyenNgoc' | 'PhuMy';
    vessel_name?: string;
    tonnage?: number | null;
    hp?: number | null;
    gcn_no?: string;
    gcn_issued_date?: string;
    gcn_expiry_date?: string;
    gcn_images?: string[];
    dk_no?: string;
    dk_issued_date?: string;
    dk_expiry_date?: string;
    dk_images?: string[];
    bh_no?: string;
    bh_issued_date?: string;
    bh_expiry_date?: string;
    bh_images?: string[];
    captain?: string;
    captain_grade?: string;
    captain_cccd?: string;
    chief_engineer?: string;
    chief_engineer_grade?: string;
    chief_engineer_cccd?: string;
    sailors?: string;
    sailors_cccd?: string;
    has_crew_book?: boolean;
    crew_images?: string[];
    arrival_time?: string;
    departure_time?: string;
    last_port?: string;
    khai_he_thong?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export const VehicleProfileService = {
    async getProfiles(site?: 'NguyenNgoc' | 'PhuMy'): Promise<VehicleProfile[]> {
        try {
            let query = supabase
                .from('vehicle_profiles')
                .select('*')
                .order('vehicle_name', { ascending: true });
            
            if (site) {
                query = query.eq('site', site);
            }
            
            const { data, error } = await query;
            if (error) {
                console.error('Error fetching vehicle_profiles:', error);
                return [];
            }
            return (data as VehicleProfile[]) || [];
        } catch (err) {
            console.error('Failed to get vehicle profiles:', err);
            return [];
        }
    },

    async createProfile(profile: Partial<VehicleProfile>): Promise<VehicleProfile | null> {
        try {
            const payload = {
                ...profile,
                updated_at: new Date().toISOString()
            };
            const { data, error } = await supabase
                .from('vehicle_profiles')
                .insert([payload])
                .select()
                .single();
            
            if (error) {
                console.error('Error creating vehicle_profile:', error);
                return null;
            }
            return data as VehicleProfile;
        } catch (err) {
            console.error('Failed to create vehicle profile:', err);
            return null;
        }
    },

    async updateProfile(id: number, profile: Partial<VehicleProfile>): Promise<boolean> {
        try {
            const payload = {
                ...profile,
                updated_at: new Date().toISOString()
            };
            const { error } = await supabase
                .from('vehicle_profiles')
                .update(payload)
                .eq('id', id);
            
            if (error) {
                console.error('Error updating vehicle_profile:', error);
                return false;
            }
            return true;
        } catch (err) {
            console.error('Failed to update vehicle profile:', err);
            return false;
        }
    },

    async deleteProfile(id: number): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('vehicle_profiles')
                .delete()
                .eq('id', id);
            
            if (error) {
                console.error('Error deleting vehicle_profile:', error);
                return false;
            }
            return true;
        } catch (err) {
            console.error('Failed to delete vehicle profile:', err);
            return false;
        }
    },

    async upsertProfiles(profiles: Partial<VehicleProfile>[]): Promise<boolean> {
        try {
            const payload = profiles.map(p => ({
                ...p,
                updated_at: new Date().toISOString()
            }));
            const { error } = await supabase
                .from('vehicle_profiles')
                .upsert(payload, { onConflict: 'vehicle_name' });
            
            if (error) {
                console.error('Error upserting vehicle_profiles:', error);
                return false;
            }
            return true;
        } catch (err) {
            console.error('Failed to upsert vehicle profiles:', err);
            return false;
        }
    }
};

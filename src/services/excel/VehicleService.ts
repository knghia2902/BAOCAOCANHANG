import { supabase } from '@/supabase';
import { dbContext } from '@/services/storage/DBContext';

export interface VehicleRecord {
    id?: number;
    plateNumber: string;
    moocNumber: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export class VehicleService {
    static readonly TABLE_NAME = 'weighbridge_vehicles';
    static readonly INDEXED_KEY = 'allocator_vehicles';

    static normalizePlate(plate: string | null | undefined): string {
        if (!plate) return '';
        return String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    /**
     * Fetch all vehicles from weighbridge_vehicles (falls back to IndexedDB/settings if table not ready)
     */
    static async getVehicles(): Promise<VehicleRecord[]> {
        try {
            // 1. Query dedicated table
            const { data, error } = await supabase
                .from(VehicleService.TABLE_NAME)
                .select('*')
                .order('plate_number', { ascending: true });

            if (!error && data && data.length > 0) {
                const list: VehicleRecord[] = data.map((row: any) => ({
                    id: row.id,
                    plateNumber: row.plate_number || '',
                    moocNumber: row.mooc_number || '',
                    notes: row.notes || '',
                    created_at: row.created_at,
                    updated_at: row.updated_at
                }));

                // Cache to IndexedDB
                try {
                    await dbContext.set(VehicleService.INDEXED_KEY, list);
                } catch (e) {
                    console.warn('[VehicleService] Failed to cache vehicles to IndexedDB:', e);
                }

                return list;
            }

            if (error) {
                console.warn('[VehicleService] Query failed, using local cache:', error.message);
            }
        } catch (e) {
            console.warn('[VehicleService] Error fetching vehicles from remote:', e);
        }

        // 2. Fallback to IndexedDB
        try {
            const cached = await dbContext.get<VehicleRecord[]>(VehicleService.INDEXED_KEY);
            if (cached && Array.isArray(cached) && cached.length > 0) {
                return cached;
            }
        } catch (_) {}

        // 3. Fallback to content.settings
        try {
            const { data: contentData } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();

            const remote = contentData?.settings?.allocator_vehicles;
            if (Array.isArray(remote)) {
                return remote;
            }
        } catch (_) {}

        return [];
    }

    /**
     * Add a single vehicle
     */
    static async addVehicle(vehicle: { plateNumber: string; moocNumber: string; notes?: string }): Promise<VehicleRecord | null> {
        const plate = vehicle.plateNumber.trim().toUpperCase();
        const mooc = vehicle.moocNumber.trim().toUpperCase();

        try {
            const { data, error } = await supabase
                .from(VehicleService.TABLE_NAME)
                .insert([{
                    plate_number: plate,
                    mooc_number: mooc,
                    notes: vehicle.notes || ''
                }])
                .select()
                .single();

            if (!error && data) {
                const record: VehicleRecord = {
                    id: data.id,
                    plateNumber: data.plate_number,
                    moocNumber: data.mooc_number,
                    notes: data.notes,
                    created_at: data.created_at,
                    updated_at: data.updated_at
                };
                return record;
            }
        } catch (e) {
            console.error('[VehicleService] Error adding vehicle:', e);
        }
        return null;
    }

    /**
     * Update an existing vehicle by plate number
     */
    static async updateVehicle(oldPlate: string, vehicle: { plateNumber: string; moocNumber: string; notes?: string }): Promise<boolean> {
        const newPlate = vehicle.plateNumber.trim().toUpperCase();
        const newMooc = vehicle.moocNumber.trim().toUpperCase();

        try {
            const { error } = await supabase
                .from(VehicleService.TABLE_NAME)
                .update({
                    plate_number: newPlate,
                    mooc_number: newMooc,
                    notes: vehicle.notes || '',
                    updated_at: new Date().toISOString()
                })
                .eq('plate_number', oldPlate.trim().toUpperCase());

            return !error;
        } catch (e) {
            console.error('[VehicleService] Error updating vehicle:', e);
            return false;
        }
    }

    /**
     * Delete a vehicle by plate number
     */
    static async deleteVehicle(plateNumber: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from(VehicleService.TABLE_NAME)
                .delete()
                .eq('plate_number', plateNumber.trim().toUpperCase());

            return !error;
        } catch (e) {
            console.error('[VehicleService] Error deleting vehicle:', e);
            return false;
        }
    }

    /**
     * Clear all vehicles
     */
    static async clearAllVehicles(): Promise<boolean> {
        try {
            const { error } = await supabase
                .from(VehicleService.TABLE_NAME)
                .delete()
                .neq('id', 0);

            await dbContext.set(VehicleService.INDEXED_KEY, []);
            return !error;
        } catch (e) {
            console.error('[VehicleService] Error clearing vehicles:', e);
            return false;
        }
    }

    /**
     * Bulk upsert vehicles (for Excel import or initial migration)
     */
    static async bulkUpsertVehicles(vehicles: { plateNumber: string; moocNumber: string; notes?: string }[]): Promise<{ count: number; error: any }> {
        if (!vehicles || vehicles.length === 0) return { count: 0, error: null };

        // Deduplicate vehicles by normalized plate number
        const map = new Map<string, { plate_number: string; mooc_number: string; notes: string }>();
        for (const v of vehicles) {
            const norm = VehicleService.normalizePlate(v.plateNumber);
            if (!norm || norm === 'SOXE') continue; // Skip empty or header rows
            map.set(norm, {
                plate_number: v.plateNumber.trim().toUpperCase(),
                mooc_number: v.moocNumber ? v.moocNumber.trim().toUpperCase() : '',
                notes: v.notes || ''
            });
        }

        const rows = Array.from(map.values());
        try {
            const { error } = await supabase
                .from(VehicleService.TABLE_NAME)
                .upsert(rows, { onConflict: 'plate_number' });

            if (!error) {
                // Update cache
                const all = await VehicleService.getVehicles();
                await dbContext.set(VehicleService.INDEXED_KEY, all);
                return { count: rows.length, error: null };
            }
            return { count: 0, error };
        } catch (e) {
            return { count: 0, error: e };
        }
    }
}

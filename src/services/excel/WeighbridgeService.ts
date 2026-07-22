import { supabase } from '@/supabase';
import { dbContext } from '@/services/storage/DBContext';

export interface Vessel {
    id: number;
    name: string;
    created_at?: string;
    barges?: Barge[];
}

export interface CustomFieldConfig {
    id: string;
    label: string;
    visible: boolean;
    column: 'left' | 'right';
    order: number;
}

export interface PrintElement {
    id: string;
    type: 'text' | 'field' | 'line' | 'rect';
    x: number; // in mm
    y: number; // in mm
    width: number; // in mm
    height: number; // in mm
    text?: string;
    label?: string; // (for type='field')
    fieldId?: string;
    labelWidth?: number; // in mm (for type='field')
    fontSize?: number; // in pt
    fontWeight?: 'normal' | 'bold' | 'black';
    fontStyle?: 'normal' | 'italic';
    align?: 'left' | 'center' | 'right';
    borderStyle?: 'solid' | 'dashed' | 'double';
}

export interface BargeConfig {
    [key: string]: any;
    goods: string;
    goodsCode: string;
    owner: string;
    operator: string;
    xn: string;
    ticketPrefix: string;
    ticketSeed: string | number;
    chinhpham: number | string;
    phupham: number | string;
    ketluan: string;
    locked?: boolean;
    orderNo?: string;
    printFields?: CustomFieldConfig[];
    printElements?: PrintElement[];
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
    ticketTitle?: string;
    signatures?: string[];
    goodsList?: string[];
    updatedAt?: number;
    // Hồ sơ phương tiện (NNP QL HỒ SƠ PHƯƠNG TIỆN CẢNG)
    tonnage?: number;
    hp?: number;
    gcnNo?: string;
    gcnIssuedDate?: string;
    gcnExpiryDate?: string;
    dkNo?: string;
    dkIssuedDate?: string;
    dkExpiryDate?: string;
    bhNo?: string;
    bhIssuedDate?: string;
    bhExpiryDate?: string;
    // Crew & Movement details
    captain?: string;
    captainGrade?: string;
    chiefEngineer?: string;
    chiefEngineerGrade?: string;
    sailors?: string;
    hasCrewBook?: boolean;
    arrivalTime?: string;
    departureTime?: string;
    lastPort?: string;
}

export interface Barge {
    id: number;
    vessel_id: number;
    name: string;
    config: BargeConfig;
    created_at?: string;
    trucks?: Truck[];
}

export interface Truck {
    id: number;
    barge_id: number;
    ticketNo: string;
    plateNumber: string;
    driver: string;
    weight1: number;
    weight2: number;
    weightNet: number;
    dateIn: string;
    dateOut: string;
    note: string;
    created_at?: string;
    sourceTicketNo?: string; // Original CSV ticketNo used for sync dedup (not persisted to DB)
}

// Local IndexedDB cache helpers
async function getLocalVessels(): Promise<Vessel[]> {
    return (await dbContext.get<Vessel[]>('wb_vessels')) || [];
}

async function saveLocalVessels(vessels: Vessel[]) {
    await dbContext.set('wb_vessels', vessels);
}

export const WeighbridgeService = {
    /**
     * Fetch all vessels along with their barges
     */
    async getVessels(): Promise<Vessel[]> {
        const local = await getLocalVessels();
        try {
            const { data, error } = await supabase
                .from('weighbridge_vessels')
                .select('*, barges:weighbridge_barges(*)')
                .order('created_at', { ascending: true });

            if (error) {
                console.warn('Supabase fetch failed, loading local vessels:', error);
                return local;
            }

            const formatted = (data || []).map((vessel: any) => {
                const barges = (vessel.barges || []).map((remoteBarge: any) => {
                    // Search if local has a newer config
                    const localVessel = local.find(v => v.id === vessel.id);
                    const localBarge = localVessel?.barges?.find(b => b.id === remoteBarge.id);
                    if (localBarge && localBarge.config) {
                        const localTime = localBarge.config.updatedAt || 0;
                        const remoteTime = remoteBarge.config?.updatedAt || 0;
                        if (localTime > remoteTime) {
                            console.log(`Preserving newer local config for barge ${remoteBarge.name} (${remoteBarge.id})`);
                            // Sync local config back to Supabase in the background
                            WeighbridgeService.updateBargeConfig(remoteBarge.id, localBarge.config).catch(err => {
                                console.warn('Background sync config failed:', err);
                            });
                            return {
                                ...remoteBarge,
                                config: localBarge.config
                            };
                        }
                    }
                    return remoteBarge;
                }).sort((a: any, b: any) => {
                    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return dateA - dateB;
                });
                return {
                    ...vessel,
                    barges
                };
            });

            // Cache locally
            await saveLocalVessels(formatted);
            return formatted;
        } catch (e) {
            console.warn('Network offline or error fetching vessels, loading local vessels:', e);
            return await getLocalVessels();
        }
    },

    /**
     * Create a new vessel
     */
    async createVessel(name: string): Promise<Vessel | null> {
        const newVessel: Vessel = {
            id: Date.now(),
            name: name.trim().toUpperCase(),
            barges: []
        };
        try {
            const { data, error } = await supabase
                .from('weighbridge_vessels')
                .insert([{ id: newVessel.id, name: newVessel.name }])
                .select()
                .single();

            if (error) {
                console.warn('Supabase create vessel failed, saving locally:', error);
                const local = await getLocalVessels();
                local.push(newVessel);
                await saveLocalVessels(local);
                return newVessel;
            }
            const syncedVessel = { ...data, barges: [] };
            const local = await getLocalVessels();
            local.push(syncedVessel);
            await saveLocalVessels(local);
            return syncedVessel;
        } catch (e) {
            console.warn('Supabase offline, saving vessel locally:', e);
            const local = await getLocalVessels();
            local.push(newVessel);
            await saveLocalVessels(local);
            return newVessel;
        }
    },

    /**
     * Update vessel name
     */
    async updateVessel(id: number, name: string): Promise<boolean> {
        const cleanName = name.trim().toUpperCase();
        
        const local = await getLocalVessels();
        const vessel = local.find(v => v.id === id);
        if (vessel) {
            vessel.name = cleanName;
            await saveLocalVessels(local);
        }

        try {
            const { error } = await supabase
                .from('weighbridge_vessels')
                .update({ name: cleanName })
                .eq('id', id);

            if (error) {
                console.warn('Supabase update vessel failed, kept local change:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, updated vessel locally:', e);
            return true;
        }
    },

    /**
     * Delete a vessel
     */
    async deleteVessel(id: number): Promise<boolean> {
        const local = await getLocalVessels();
        const vessel = local.find(v => v.id === id);
        if (vessel) {
            if (vessel.barges) {
                for (const barge of vessel.barges) {
                    await dbContext.delete(`wb_trucks_${barge.id}`);
                }
            }
            const updated = local.filter(v => v.id !== id);
            await saveLocalVessels(updated);
        }

        try {
            const { error } = await supabase
                .from('weighbridge_vessels')
                .delete()
                .eq('id', id);

            if (error) {
                console.warn('Supabase delete vessel failed, kept local deletion:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, deleted vessel locally:', e);
            return true;
        }
    },

    /**
     * Create a new barge
     */
    async createBarge(vesselId: number, name: string, customOrderNo?: string): Promise<Barge | null> {
        const local = await getLocalVessels();

        let nextOrderNo = '';
        if (customOrderNo !== undefined) {
            nextOrderNo = customOrderNo;
        } else {
            // Calculate next orderNo sequentially based on max orderNo across all barges
            let maxNum = 0;
            for (const vessel of local) {
                if (vessel.barges) {
                    for (const barge of vessel.barges) {
                        const orderStr = barge.config?.orderNo || '';
                        const match = orderStr.match(/(\d+)$/);
                        if (match) {
                            const num = parseInt(match[1] || '', 10);
                            if (num > maxNum) {
                                maxNum = num;
                            }
                        } else {
                            const num = parseInt(orderStr, 10);
                            if (!isNaN(num) && num > maxNum) {
                                maxNum = num;
                            }
                        }
                    }
                }
            }
            nextOrderNo = String(maxNum + 1);
        }

        const defaultConfig: BargeConfig = {
            goods: '',
            goodsCode: '',
            owner: '',
            operator: '',
            xn: 'XUẤT KHẨU',
            ticketPrefix: 'PC-',
            ticketSeed: 1,
            chinhpham: '------------',
            phupham: '------------',
            ketluan: '[ ] Đạt\n[ ] Không đạt',
            orderNo: nextOrderNo,
            updatedAt: Date.now()
        };
        const newBarge: Barge = {
            id: Date.now(),
            vessel_id: vesselId,
            name: name.trim().toUpperCase(),
            config: defaultConfig,
            trucks: []
        };

        const vessel = local.find(v => v.id === vesselId);
        if (vessel) {
            if (!vessel.barges) vessel.barges = [];
            vessel.barges.push(newBarge);
            await saveLocalVessels(local);
        }

        try {
            const { data, error } = await supabase
                .from('weighbridge_barges')
                .insert([{
                    id: newBarge.id,
                    vessel_id: vesselId,
                    name: newBarge.name,
                    config: defaultConfig
                }])
                .select()
                .single();

            if (error) {
                console.warn('Supabase create barge failed, saved locally:', error);
                return newBarge;
            }
            return { ...data, config: data.config || defaultConfig };
        } catch (e) {
            console.warn('Supabase offline, created barge locally:', e);
            return newBarge;
        }
    },

    /**
     * Update barge name
     */
    async updateBarge(id: number, name: string): Promise<boolean> {
        const cleanName = name.trim().toUpperCase();
        
        const local = await getLocalVessels();
        let found = false;
        for (const vessel of local) {
            const barge = vessel.barges?.find(b => b.id === id);
            if (barge) {
                barge.name = cleanName;
                found = true;
                break;
            }
        }
        if (found) {
            await saveLocalVessels(local);
        }

        try {
            const { error } = await supabase
                .from('weighbridge_barges')
                .update({ name: cleanName })
                .eq('id', id);

            if (error) {
                console.warn('Supabase update barge failed, kept local change:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, updated barge locally:', e);
            return true;
        }
    },

    /**
     * Update barge config
     */
    async updateBargeConfig(id: number, config: BargeConfig): Promise<boolean> {
        const local = await getLocalVessels();
        
        // 1. Fetch current config from Supabase to perform a safe merge
        let remoteConfig: BargeConfig = {} as BargeConfig;
        try {
            const { data, error } = await supabase
                .from('weighbridge_barges')
                .select('config')
                .eq('id', id)
                .single();
            if (!error && data && data.config) {
                remoteConfig = data.config;
            }
        } catch (e) {
            console.warn('Failed to fetch remote config for merge:', e);
        }
        
        // 2. Perform merge
        const finalConfig = { ...remoteConfig, ...config, updatedAt: Date.now() };
        
        // 3. Update local cache
        let found = false;
        for (const vessel of local) {
            const barge = vessel.barges?.find(b => b.id === id);
            if (barge) {
                barge.config = finalConfig;
                found = true;
                break;
            }
        }
        if (found) {
            await saveLocalVessels(local);
        }

        // 4. Update Supabase
        try {
            const { error } = await supabase
                .from('weighbridge_barges')
                .update({ config: finalConfig })
                .eq('id', id);

            if (error) {
                console.warn('Supabase update config failed, kept local change:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, updated config locally:', e);
            return true;
        }
    },

    /**
     * Delete a barge
     */
    async deleteBarge(id: number): Promise<boolean> {
        const local = await getLocalVessels();
        let found = false;
        for (const vessel of local) {
            if (vessel.barges) {
                const initialLength = vessel.barges.length;
                vessel.barges = vessel.barges.filter(b => b.id !== id);
                if (vessel.barges.length !== initialLength) {
                    found = true;
                    break;
                }
            }
        }
        if (found) {
            await saveLocalVessels(local);
            await dbContext.delete(`wb_trucks_${id}`);
        }

        try {
            const { error } = await supabase
                .from('weighbridge_barges')
                .delete()
                .eq('id', id);

            if (error) {
                console.warn('Supabase delete barge failed, kept local deletion:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, deleted barge locally:', e);
            return true;
        }
    },

    /**
     * Get all trucks for a specific barge
     */
    async getTrucks(bargeId: number): Promise<Truck[]> {
        const getLocalTrucks = async () => {
            return (await dbContext.get<Truck[]>(`wb_trucks_${bargeId}`)) || [];
        };

        try {
            const { data, error } = await supabase
                .from('weighbridge_trucks')
                .select('*')
                .eq('barge_id', bargeId)
                .order('created_at', { ascending: true });

            if (error) {
                console.warn('Supabase fetch trucks failed, loading locally:', error);
                return await getLocalTrucks();
            }

            const formatted = (data || []).map((t: any) => ({
                id: t.id,
                barge_id: t.barge_id,
                ticketNo: t.ticket_no,
                plateNumber: t.plate_number,
                driver: t.driver || '',
                weight1: Number(t.weight_1),
                weight2: Number(t.weight_2),
                weightNet: Number(t.weight_net),
                dateIn: t.date_in || '',
                dateOut: t.date_out || '',
                note: t.note || '',
                created_at: t.created_at
            }));

            await dbContext.set(`wb_trucks_${bargeId}`, formatted);
            return formatted;
        } catch (e) {
            console.warn('Supabase offline, loading trucks locally:', e);
            return await getLocalTrucks();
        }
    },

    /**
     * Delete all trucks for a barge (used when overwriting)
     */
    async deleteAllTrucksForBarge(bargeId: number): Promise<boolean> {
        await dbContext.delete(`wb_trucks_${bargeId}`);
        try {
            const { error } = await supabase
                .from('weighbridge_trucks')
                .delete()
                .eq('barge_id', bargeId);
            if (error) {
                console.warn('Supabase delete all trucks for barge failed:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, deleted all trucks locally:', e);
            return true;
        }
    },

    /**
     * Upsert multiple trucks (used in Excel import or bulk edits)
     */
    async saveTrucks(bargeId: number, trucks: any[]): Promise<boolean> {
        await dbContext.set(`wb_trucks_${bargeId}`, trucks);

        try {
            if (trucks.length === 0) return true;

            const dbTrucks = trucks.map(t => ({
                id: t.id,
                barge_id: bargeId,
                ticket_no: t.ticketNo,
                plate_number: t.plateNumber,
                driver: t.driver || null,
                weight_1: t.weight1,
                weight_2: t.weight2,
                weight_net: t.weightNet,
                date_in: t.dateIn || null,
                date_out: t.dateOut || null,
                note: t.note || null
            }));

            const { error } = await supabase
                .from('weighbridge_trucks')
                .upsert(dbTrucks);

            if (error) {
                console.warn('Supabase save trucks failed, kept local cache:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, saved trucks locally:', e);
            return true;
        }
    },

    /**
     * Save or update a single truck
     */
    async saveSingleTruck(bargeId: number, truck: any): Promise<boolean> {
        const localTrucks = (await dbContext.get<Truck[]>(`wb_trucks_${bargeId}`)) || [];
        const index = localTrucks.findIndex(t => t.id === truck.id);
        if (index !== -1) {
            localTrucks[index] = { ...truck, barge_id: bargeId };
        } else {
            localTrucks.push({ ...truck, barge_id: bargeId });
        }
        await dbContext.set(`wb_trucks_${bargeId}`, localTrucks);

        try {
            const dbTruck = {
                id: truck.id,
                barge_id: bargeId,
                ticket_no: truck.ticketNo,
                plate_number: truck.plateNumber,
                driver: truck.driver || null,
                weight_1: truck.weight1,
                weight_2: truck.weight2,
                weight_net: truck.weightNet,
                date_in: truck.dateIn || null,
                date_out: truck.dateOut || null,
                note: truck.note || null
            };

            const { error } = await supabase
                .from('weighbridge_trucks')
                .upsert([dbTruck]);

            if (error) {
                console.warn('Supabase save single truck failed, kept local change:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, saved single truck locally:', e);
            return true;
        }
    },

    /**
     * Delete a single truck
     */
    async deleteTruck(id: number): Promise<boolean> {
        const localVessels = await getLocalVessels();
        const bargeIds: number[] = [];
        for (const vessel of localVessels) {
            if (vessel.barges) {
                vessel.barges.forEach(b => bargeIds.push(b.id));
            }
        }
        
        for (const bargeId of bargeIds) {
            const localTrucks = await dbContext.get<Truck[]>(`wb_trucks_${bargeId}`);
            if (localTrucks) {
                const initialLength = localTrucks.length;
                const updated = localTrucks.filter(t => t.id !== id);
                if (updated.length !== initialLength) {
                    await dbContext.set(`wb_trucks_${bargeId}`, updated);
                    break;
                }
            }
        }

        try {
            const { error } = await supabase
                .from('weighbridge_trucks')
                .delete()
                .eq('id', id);

            if (error) {
                console.warn('Supabase delete truck failed, kept local deletion:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, deleted truck locally:', e);
            return true;
        }
    },

    /**
     * Clear all trucks for a specific barge
     */
    async clearBargeTrucks(bargeId: number): Promise<boolean> {
        await dbContext.set(`wb_trucks_${bargeId}`, []);

        try {
            const { error } = await supabase
                .from('weighbridge_trucks')
                .delete()
                .eq('barge_id', bargeId);

            if (error) {
                console.warn('Supabase clear trucks failed, cleared locally:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, cleared trucks locally:', e);
            return true;
        }
    }
};

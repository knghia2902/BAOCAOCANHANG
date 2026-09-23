import { supabase } from '@/supabase';

export interface AllocationTrackingRow {
    id?: number;
    barge_id?: number | null;
    barge_name?: string;
    vessel_id?: number | null;
    vessel_name?: string;
    stt?: number;
    time_str?: string;
    plate_number: string;
    tttp?: number;
    limit_weight?: number;
    ticket_no?: string;
    source_ticket_no?: string;
    cargo_type?: string;
    weight_1?: number;
    weight_2?: number;
    weight_net: number;
    weight_tons: number;
    direction?: string;
    order_no?: string;
    customer?: string;
    date1_obj?: string | null;
    date2_obj?: string | null;
    notes?: string;
    created_at?: string;
}

export interface AllocationTrackingItem {
    id?: number;
    bargeId?: number | null;
    bargeName?: string;
    vesselId?: number | null;
    vesselName?: string;
    stt: number;
    timeStr: string;
    plateNumber: string;
    tttp: number;
    limit: number;
    ticketNo: string;
    sourceTicketNo?: string;
    cargoType: string;
    weightTons: number;
    notes: string;
    isNew?: boolean;
    customer: string;
    weight1: number;
    weight2: number;
    weightNet: number;
    direction: string;
    date1Obj: Date;
    date2Obj: Date;
    orderNo?: string;
}

export class AllocationTrackingService {
    public static readonly TABLE_NAME = 'weighbridge_allocation_tracking';

    /**
     * Chuyển đổi từ row trong cơ sở dữ liệu sang đối tượng ứng dụng
     */
    static rowToTrip(row: AllocationTrackingRow): AllocationTrackingItem {
        const d1 = row.date1_obj ? new Date(row.date1_obj) : new Date();
        const d2 = row.date2_obj ? new Date(row.date2_obj) : d1;
        return {
            id: row.id,
            bargeId: row.barge_id,
            bargeName: row.barge_name || '',
            vesselId: row.vessel_id,
            vesselName: row.vessel_name || '',
            stt: row.stt || 0,
            timeStr: row.time_str || '',
            plateNumber: row.plate_number || '',
            tttp: Number(row.tttp || 0),
            limit: Number(row.limit_weight || 0),
            ticketNo: row.ticket_no || '',
            sourceTicketNo: row.source_ticket_no || '',
            cargoType: row.cargo_type || '',
            weight1: Number(row.weight_1 || 0),
            weight2: Number(row.weight_2 || 0),
            weightNet: Number(row.weight_net || 0),
            weightTons: Number(row.weight_tons || 0),
            direction: row.direction || 'Xuất',
            orderNo: row.order_no || '',
            customer: row.customer || '',
            date1Obj: isNaN(d1.getTime()) ? new Date() : d1,
            date2Obj: isNaN(d2.getTime()) ? new Date() : d2,
            notes: row.notes || ''
        };
    }

    /**
     * Chuyển đổi từ đối tượng ứng dụng sang row trong cơ sở dữ liệu
     */
    static tripToRow(trip: any, bargeId?: number | null, bargeName?: string, vesselId?: number | null, vesselName?: string): Partial<AllocationTrackingRow> {
        let date1Iso: string | null = null;
        let date2Iso: string | null = null;
        try {
            if (trip.date1Obj) {
                const d = new Date(trip.date1Obj);
                if (!isNaN(d.getTime())) date1Iso = d.toISOString();
            }
        } catch (e) {}
        try {
            if (trip.date2Obj) {
                const d = new Date(trip.date2Obj);
                if (!isNaN(d.getTime())) date2Iso = d.toISOString();
            }
        } catch (e) {}

        const net = Number(trip.weightNet || 0);
        const tons = typeof trip.weightTons === 'number' && !isNaN(trip.weightTons) 
            ? trip.weightTons 
            : Number((net / 1000).toFixed(3));

        return {
            barge_id: bargeId !== undefined ? bargeId : (trip.bargeId || null),
            barge_name: bargeName || trip.bargeName || '',
            vessel_id: vesselId !== undefined ? vesselId : (trip.vesselId || null),
            vessel_name: vesselName || trip.vesselName || '',
            stt: Number(trip.stt || 0),
            time_str: String(trip.timeStr || ''),
            plate_number: String(trip.plateNumber || '').trim(),
            tttp: Number(trip.tttp || 0),
            limit_weight: Number(trip.limit || 0),
            ticket_no: String(trip.ticketNo || '').trim(),
            source_ticket_no: String(trip.sourceTicketNo || '').trim(),
            cargo_type: String(trip.cargoType || ''),
            weight_1: Number(trip.weight1 || 0),
            weight_2: Number(trip.weight2 || 0),
            weight_net: net,
            weight_tons: tons,
            direction: String(trip.direction || 'Xuất'),
            order_no: String(trip.orderNo || ''),
            customer: String(trip.customer || ''),
            date1_obj: date1Iso,
            date2_obj: date2Iso,
            notes: String(trip.notes || '')
        };
    }

    /**
     * Lấy danh sách các chuyến xe theo sà lan hoặc tất cả
     */
    static async getTrips(options?: { bargeId?: number | null; days?: number }): Promise<AllocationTrackingItem[]> {
        const allRows: AllocationTrackingRow[] = [];
        let from = 0;
        const pageSize = 1000;

        try {
            let query = supabase
                .from(AllocationTrackingService.TABLE_NAME)
                .select('*');

            if (options?.bargeId) {
                query = query.eq('barge_id', options.bargeId);
            }

            if (options?.days) {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - options.days);
                query = query.gte('date1_obj', cutoff.toISOString());
            }

            query = query.order('created_at', { ascending: false });

            while (true) {
                const { data, error } = await query.range(from, from + pageSize - 1);

                if (error) {
                    if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
                        console.warn(`[AllocationTrackingService] Bảng '${AllocationTrackingService.TABLE_NAME}' chưa được tạo trên Supabase.`);
                        return [];
                    }
                    console.error('Lỗi khi lấy dữ liệu chuyến xe phân bổ:', error);
                    throw error;
                }

                if (!data || data.length === 0) break;
                allRows.push(...(data as AllocationTrackingRow[]));
                from += data.length;
                if (data.length < pageSize) break;
            }

            return allRows.map(this.rowToTrip);
        } catch (e) {
            console.error('Lỗi truy vấn AllocationTrackingService.getTrips:', e);
            return [];
        }
    }

    /**
     * Chèn danh sách chuyến xe đã phân bổ vào bảng riêng
     */
    static async insertTrips(
        trips: any[], 
        bargeId?: number | null, 
        bargeName?: string,
        vesselId?: number | null,
        vesselName?: string
    ): Promise<{ count: number; data?: AllocationTrackingItem[]; error: any }> {
        if (!trips || trips.length === 0) return { count: 0, data: [], error: null };

        const rows = trips.map(t => this.tripToRow(t, bargeId, bargeName, vesselId, vesselName));
        const CHUNK_SIZE = 500;
        let insertedCount = 0;
        const insertedRows: AllocationTrackingRow[] = [];

        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            const { data, error } = await supabase
                .from(AllocationTrackingService.TABLE_NAME)
                .insert(chunk)
                .select('*');

            if (error) {
                console.error(`Lỗi chèn đợt ${i} - ${i + chunk.length}:`, error);
                if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
                    return {
                        count: insertedCount,
                        error: new Error(`Bảng '${AllocationTrackingService.TABLE_NAME}' chưa được tạo trên Supabase. Vui lòng chạy file SQL migration mới trong Supabase SQL Editor.`)
                    };
                }
                return { count: insertedCount, error };
            }
            if (data && Array.isArray(data)) {
                insertedRows.push(...(data as AllocationTrackingRow[]));
            }
            insertedCount += chunk.length;
        }

        const insertedItems = insertedRows.map(r => this.rowToTrip(r));
        return { count: insertedCount, data: insertedItems, error: null };
    }

    /**
     * Xóa 1 chuyến xe theo ID
     */
    static async deleteTrip(id: number): Promise<boolean> {
        if (!id) return false;
        try {
            const { error } = await supabase
                .from(AllocationTrackingService.TABLE_NAME)
                .delete()
                .eq('id', id);
            return !error;
        } catch {
            return false;
        }
    }

    /**
     * Xóa toàn bộ chuyến xe trong sổ theo dõi (hoặc theo sà lan)
     */
    static async clearAll(bargeId?: number | null): Promise<boolean> {
        try {
            let query = supabase.from(AllocationTrackingService.TABLE_NAME).delete();
            if (bargeId) {
                query = query.eq('barge_id', bargeId);
            } else {
                query = query.neq('id', 0);
            }
            const { error } = await query;
            return !error;
        } catch {
            return false;
        }
    }
}

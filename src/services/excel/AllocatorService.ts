import { supabase } from '@/supabase';

export interface AllocatorTripRow {
    id?: number;
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
    barge_name?: string;
    order_no?: string;
    customer?: string;
    date1_obj?: string | null;
    date2_obj?: string | null;
    notes?: string;
    is_recovered?: boolean;
    created_at?: string;
}

export interface AllocatorTripItem {
    id?: number;
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
    bargeName: string;
    date1Obj: Date;
    date2Obj: Date;
    orderNo?: string;
    isRecovered?: boolean;
}

export class AllocatorService {
    public static readonly TABLE_NAME = 'weighbridge_tracking';

    /**
     * Chuyển đổi từ row trong cơ sở dữ liệu sang đối tượng ứng dụng
     */
    static rowToTrip(row: AllocatorTripRow): AllocatorTripItem {
        const d1 = row.date1_obj ? new Date(row.date1_obj) : new Date();
        const d2 = row.date2_obj ? new Date(row.date2_obj) : d1;
        return {
            id: row.id,
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
            bargeName: row.barge_name || '',
            orderNo: row.order_no || '',
            customer: row.customer || '',
            date1Obj: isNaN(d1.getTime()) ? new Date() : d1,
            date2Obj: isNaN(d2.getTime()) ? new Date() : d2,
            notes: row.notes || '',
            isRecovered: !!row.is_recovered
        };
    }

    /**
     * Chuyển đổi từ đối tượng ứng dụng sang row trong cơ sở dữ liệu
     */
    static tripToRow(trip: any): Partial<AllocatorTripRow> {
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
            barge_name: String(trip.bargeName || ''),
            order_no: String(trip.orderNo || ''),
            customer: String(trip.customer || ''),
            date1_obj: date1Iso,
            date2_obj: date2Iso,
            notes: String(trip.notes || ''),
            is_recovered: !!trip.isRecovered
        };
    }

    /**
     * Lấy các chuyến xe trong N ngày gần nhất (mặc định 30 ngày)
     */
    static async getRecentTrips(days = 30): Promise<AllocatorTripItem[]> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffIso = cutoff.toISOString();

        const allRows: AllocatorTripRow[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
            const { data, error } = await supabase
                .from(AllocatorService.TABLE_NAME)
                .select('*')
                .gte('date1_obj', cutoffIso)
                .order('date1_obj', { ascending: false })
                .range(from, from + pageSize - 1);

            if (error) {
                if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
                    console.warn(`[AllocatorService] Bảng '${AllocatorService.TABLE_NAME}' chưa được tạo trên Supabase.`);
                    return [];
                }
                console.error('Lỗi khi lấy dữ liệu chuyến xe gần đây:', error);
                throw error;
            }

            if (!data || data.length === 0) break;
            allRows.push(...(data as AllocatorTripRow[]));
            from += data.length;
            if (data.length < pageSize) break;
        }

        return allRows.map(this.rowToTrip);
    }

    /**
     * Lấy toàn bộ lịch sử các chuyến xe (kèm callback tiến độ tải)
     */
    static async getAllTrips(onProgress?: (loaded: number) => void): Promise<AllocatorTripItem[]> {
        const allRows: AllocatorTripRow[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
            const { data, error } = await supabase
                .from(AllocatorService.TABLE_NAME)
                .select('*')
                .order('date1_obj', { ascending: false })
                .range(from, from + pageSize - 1);

            if (error) {
                if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
                    console.warn(`[AllocatorService] Bảng '${AllocatorService.TABLE_NAME}' chưa được tạo trên Supabase.`);
                    return [];
                }
                console.error('Lỗi khi tải toàn bộ lịch sử:', error);
                throw error;
            }

            if (!data || data.length === 0) break;
            allRows.push(...(data as AllocatorTripRow[]));
            from += data.length;
            if (onProgress) onProgress(allRows.length);
            if (data.length < pageSize) break;
        }

        return allRows.map(this.rowToTrip);
    }

    /**
     * Lấy các chuyến xe theo ngày cụ thể (YYYY-MM-DD)
     */
    static async getTripsByDate(ymd: string): Promise<AllocatorTripItem[]> {
        if (!ymd) return [];
        // Tạo khoảng thời gian từ đầu ngày đến cuối ngày theo giờ Việt Nam (+07:00)
        const startIso = `${ymd}T00:00:00+07:00`;
        const endIso = `${ymd}T23:59:59.999+07:00`;

        const allRows: AllocatorTripRow[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
            const { data, error } = await supabase
                .from(AllocatorService.TABLE_NAME)
                .select('*')
                .gte('date1_obj', startIso)
                .lte('date1_obj', endIso)
                .order('date1_obj', { ascending: false })
                .range(from, from + pageSize - 1);

            if (error) {
                if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
                    console.warn(`[AllocatorService] Bảng '${AllocatorService.TABLE_NAME}' chưa được tạo trên Supabase.`);
                    return [];
                }
                console.error(`Lỗi khi lấy chuyến xe ngày ${ymd}:`, error);
                throw error;
            }

            if (!data || data.length === 0) break;
            allRows.push(...(data as AllocatorTripRow[]));
            from += data.length;
            if (data.length < pageSize) break;
        }

        return allRows.map(this.rowToTrip);
    }

    /**
     * Chèn danh sách chuyến xe mới (phân đợt 500 bản ghi để tối ưu hiệu năng)
     */
    static async insertTrips(trips: any[]): Promise<{ count: number; data?: AllocatorTripItem[]; error: any }> {
        if (!trips || trips.length === 0) return { count: 0, data: [], error: null };

        const rows = trips.map(this.tripToRow);
        const CHUNK_SIZE = 500;
        let insertedCount = 0;
        const insertedRows: AllocatorTripRow[] = [];

        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            const { data, error } = await supabase
                .from(AllocatorService.TABLE_NAME)
                .insert(chunk)
                .select('*');

            if (error) {
                console.error(`Lỗi chèn đợt ${i} - ${i + chunk.length}:`, error);
                if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
                    return {
                        count: insertedCount,
                        error: new Error(`Bảng '${AllocatorService.TABLE_NAME}' chưa được tạo trên Supabase. Vui lòng chạy file migration SQL 'database/migrations/20260921_create_weighbridge_tracking.sql' trong Supabase SQL Editor.`)
                    };
                }
                return { count: insertedCount, error };
            }
            if (data && Array.isArray(data)) {
                insertedRows.push(...(data as AllocatorTripRow[]));
            }
            insertedCount += chunk.length;
        }

        const insertedItems = insertedRows.map(r => this.rowToTrip(r));
        return { count: insertedCount, data: insertedItems, error: null };
    }

    /**
     * Cập nhật mã lệnh cho một chuyến xe
     */
    static async updateTripOrderNo(identifier: { id?: number; ticketNo?: string; stt?: number }, orderNo: string): Promise<boolean> {
        let query = supabase.from(AllocatorService.TABLE_NAME).update({ order_no: orderNo });
        if (identifier.id) {
            query = query.eq('id', identifier.id);
        } else if (identifier.ticketNo) {
            query = query.eq('ticket_no', identifier.ticketNo);
        } else if (identifier.stt) {
            query = query.eq('stt', identifier.stt);
        } else {
            return false;
        }

        const { error } = await query;
        if (error) {
            console.error('Lỗi khi cập nhật mã lệnh:', error);
            return false;
        }
        return true;
    }

    /**
     * Xóa một bản ghi chuyến xe
     */
    static async deleteTrip(identifier: { id?: number; ticketNo?: string; stt?: number }): Promise<boolean> {
        let query = supabase.from(AllocatorService.TABLE_NAME).delete();
        if (identifier.id) {
            query = query.eq('id', identifier.id);
        } else if (identifier.ticketNo) {
            query = query.eq('ticket_no', identifier.ticketNo);
        } else if (identifier.stt) {
            query = query.eq('stt', identifier.stt);
        } else {
            return false;
        }

        const { error } = await query;
        if (error) {
            console.error('Lỗi khi xóa bản ghi:', error);
            return false;
        }
        return true;
    }
}

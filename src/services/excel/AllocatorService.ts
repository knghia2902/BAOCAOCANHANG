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
    file_source?: string | null;
    created_at?: string;
}

export type ScaleHead = 'FILE_1' | 'FILE_2';

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
    fileSource?: 'FILE_1' | 'FILE_2' | 'MANUAL' | '';
}

export class AllocatorService {
    public static readonly TABLE_NAME = 'weighbridge_tracking';

    /** Bộ đệm bộ nhớ và cờ ghi nhớ */
    private static tripsCache: AllocatorTripItem[] | null = null;
    private static tripsCacheTime = 0;
    private static tripsInFlight: Promise<AllocatorTripItem[]> | null = null;
    private static readonly TRIPS_CACHE_TTL = 30_000;

    /** Cờ ghi nhớ khi bảng chưa có cột file_source (chưa chạy migration 20261108) */
    private static fileSourceColumnMissing = false;
    private static scaleHeadSynced = false;

    public static invalidateCache() {
        AllocatorService.tripsCache = null;
        AllocatorService.tripsCacheTime = 0;
    }

    /**
     * Nhận diện Đầu cân từ định dạng Số phiếu:
     * - Đầu cân 1 (FILE_1): xxxxxx/26A (hoặc kết thúc bằng /..A, ..26A)
     * - Đầu cân 2 (FILE_2): xxxxxx/26B (hoặc kết thúc bằng /..B, ..26B)
     */
    static detectScaleHeadFromTicketNo(ticketNo?: string | null): ScaleHead | null {
        const raw = String(ticketNo || '').trim().toUpperCase();
        if (!raw) return null;
        if (/\/\s*\d*A\b/.test(raw) || /\d+A$/.test(raw)) return 'FILE_1';
        if (/\/\s*\d*B\b/.test(raw) || /\d+B$/.test(raw)) return 'FILE_2';
        return null;
    }

    /**
     * Xác định chuyến xe / phiếu cân thuộc Đầu cân nào:
     * 1. Ưu tiên cao nhất: Định dạng số phiếu xxxxxx/26A -> FILE_1 (Đầu cân 1), xxxxxx/26B -> FILE_2 (Đầu cân 2)
     * 2. Tiếp theo: fileSource đã gán ('FILE_1' | 'FILE_2')
     * 3. Dự phòng (khi phiếu không có hậu tố A/B và chưa có fileSource): suy ra từ cột Xuất/Nhập
     */
    static resolveScaleHead(trip: {
        ticketNo?: string | null;
        sourceTicketNo?: string | null;
        soPhieu?: string | null;
        fileSource?: string | null;
        direction?: string | null;
    }): ScaleHead {
        const byTicket =
            this.detectScaleHeadFromTicketNo(trip.ticketNo) ||
            this.detectScaleHeadFromTicketNo(trip.sourceTicketNo) ||
            this.detectScaleHeadFromTicketNo(trip.soPhieu);
        if (byTicket) return byTicket;
        if (trip.fileSource === 'FILE_1' || trip.fileSource === 'FILE_2') return trip.fileSource;
        const dir = String(trip.direction || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();
        return dir.includes('NHAP') ? 'FILE_1' : 'FILE_2';
    }

    /**
     * Chuyển đổi từ row trong cơ sở dữ liệu sang đối tượng ứng dụng
     */
    static rowToTrip(row: AllocatorTripRow): AllocatorTripItem {
        const d1 = row.date1_obj ? new Date(row.date1_obj) : new Date();
        const d2 = row.date2_obj ? new Date(row.date2_obj) : d1;
        const detectedByTicket =
            AllocatorService.detectScaleHeadFromTicketNo(row.ticket_no) ||
            AllocatorService.detectScaleHeadFromTicketNo(row.source_ticket_no);
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
            isRecovered: !!row.is_recovered,
            fileSource:
                detectedByTicket ||
                (row.file_source === 'FILE_1' || row.file_source === 'FILE_2' || row.file_source === 'MANUAL'
                    ? row.file_source
                    : '')
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

        const row: Partial<AllocatorTripRow> = {
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
        const resolvedSource =
            AllocatorService.detectScaleHeadFromTicketNo(trip.ticketNo) ||
            AllocatorService.detectScaleHeadFromTicketNo(trip.sourceTicketNo) ||
            (trip.fileSource === 'FILE_1' || trip.fileSource === 'FILE_2' || trip.fileSource === 'MANUAL'
                ? trip.fileSource
                : undefined);
        if (resolvedSource) {
            row.file_source = resolvedSource;
        }
        return row;
    }

    /** Đồng bộ ngầm cột file_source trên Supabase theo số phiếu xxxxxx/26A (FILE_1) và xxxxxx/26B (FILE_2) */
    static async syncScaleHeadByTicketNo(): Promise<void> {
        if (AllocatorService.fileSourceColumnMissing || AllocatorService.scaleHeadSynced) return;
        AllocatorService.scaleHeadSynced = true;
        try {
            const q1 = supabase.from(AllocatorService.TABLE_NAME).update({ file_source: 'FILE_1' });
            const q2 = supabase.from(AllocatorService.TABLE_NAME).update({ file_source: 'FILE_2' });
            if (typeof (q1 as any)?.ilike === 'function' && typeof (q2 as any)?.ilike === 'function') {
                await Promise.all([
                    (q1 as any).ilike('ticket_no', '%/%A').neq('file_source', 'FILE_1'),
                    (q2 as any).ilike('ticket_no', '%/%B').neq('file_source', 'FILE_2')
                ]);
            }
        } catch (_) {}
    }

    /** Lỗi PostgREST khi bảng chưa có cột file_source */
    private static isMissingFileSourceColumn(error: any): boolean {
        const msg = String(error?.message || '');
        return msg.includes('file_source') && (error?.code === 'PGRST204' || msg.includes('column'));
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
     * Lấy toàn bộ lịch sử các chuyến xe (kèm callback tiến độ tải và bộ đệm in-memory)
     */
    static async getAllTrips(onProgress?: (loaded: number) => void, forceRefresh = false): Promise<AllocatorTripItem[]> {
        const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
        if (!isTest && !forceRefresh && AllocatorService.tripsCache && (Date.now() - AllocatorService.tripsCacheTime < AllocatorService.TRIPS_CACHE_TTL)) {
            if (onProgress) onProgress(AllocatorService.tripsCache.length);
            return AllocatorService.tripsCache;
        }
        if (!isTest && AllocatorService.tripsInFlight) {
            return AllocatorService.tripsInFlight;
        }

        const fetchPromise = (async () => {
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

            void this.syncScaleHeadByTicketNo();
            const result = allRows.map(this.rowToTrip);
            if (!isTest) {
                AllocatorService.tripsCache = result;
                AllocatorService.tripsCacheTime = Date.now();
            }
            return result;
        })();

        if (!isTest) {
            AllocatorService.tripsInFlight = fetchPromise.finally(() => {
                AllocatorService.tripsInFlight = null;
            });
            return AllocatorService.tripsInFlight;
        }
        return fetchPromise;
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

        const stripFileSource = (r: Partial<AllocatorTripRow>) => {
            const { file_source: _ignored, ...rest } = r;
            return rest;
        };
        let rows = trips.map(t => this.tripToRow(t));
        if (AllocatorService.fileSourceColumnMissing) rows = rows.map(stripFileSource);
        const CHUNK_SIZE = 500;
        let insertedCount = 0;
        const insertedRows: AllocatorTripRow[] = [];

        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            let chunk = rows.slice(i, i + CHUNK_SIZE);
            let { data, error } = await supabase
                .from(AllocatorService.TABLE_NAME)
                .insert(chunk)
                .select('*');

            // Fallback: bảng chưa có cột file_source -> bỏ cột và chèn lại (phân loại sẽ dựa theo Xuất/Nhập)
            if (error && this.isMissingFileSourceColumn(error)) {
                console.warn(
                    `[AllocatorService] Bảng '${AllocatorService.TABLE_NAME}' chưa có cột file_source. Vui lòng chạy migration 'database/migrations/20261108_add_file_source_to_weighbridge_tracking.sql'.`
                );
                AllocatorService.fileSourceColumnMissing = true;
                rows = rows.map(stripFileSource);
                chunk = rows.slice(i, i + CHUNK_SIZE);
                ({ data, error } = await supabase
                    .from(AllocatorService.TABLE_NAME)
                    .insert(chunk)
                    .select('*'));
            }

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
        if (insertedCount > 0) {
            AllocatorService.invalidateCache();
        }
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
        AllocatorService.invalidateCache();
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
        AllocatorService.invalidateCache();
        return true;
    }
}

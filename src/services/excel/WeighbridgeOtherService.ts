import { supabase } from '@/supabase';
import { dbContext } from '@/services/storage/DBContext';
import * as ExcelJS from 'exceljs';
import type { WarehouseTicket, ContainerTicket } from '@/types/excel';

export class WeighbridgeOtherService {
    /**
     * Parses Excel file buffer into raw rows and extracts tickets based on mapping
     */
    async parseExcelFile(
        fileBuffer: ArrayBuffer,
        type: 'warehouse' | 'container'
    ): Promise<any[]> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            throw new Error('File Excel không có dữ liệu hoặc trống!');
        }

        const rawRows: any[][] = [];
        worksheet.eachRow({ includeEmpty: true }, (row) => {
            const rowValues: any[] = [];
            const values = (row.values as any[]) || [];
            // values[1] is column A, copy to 0-based array
            for (let col = 1; col < values.length; col++) {
                const val = values[col];
                if (val && typeof val === 'object') {
                    if ('result' in val) {
                        rowValues.push((val as any).result);
                    } else if ('text' in val) {
                        rowValues.push((val as any).text);
                    } else if (val instanceof Date) {
                        rowValues.push(val);
                    } else {
                        rowValues.push(val.toString());
                    }
                } else {
                    rowValues.push(val);
                }
            }
            rawRows.push(rowValues);
        });

        if (rawRows.length === 0) {
            throw new Error('File Excel rỗng!');
        }

        // Fuzzy match headers
        const keywords: Record<string, string[]> = {
            ticketNo: ["số phiếu", "phiếu số", "phieu", "ticket", "mã phiếu", "ma phieu", "so phieu"],
            plateNumber: ["số xe", "biển số", "biển xe", "xe", "sks", "số kiểm soát", "plate", "phương tiện"],
            weight1: ["lần 1", "trọng lượng 1", "tl 1", "cân 1", "lần một", "gross", "tổng"],
            weight2: ["lần 2", "trọng lượng 2", "tl 2", "cân 2", "lần hai", "tare", "xe", "xác"],
            weightNet: ["hàng", "khối lượng hàng", "trọng lượng hàng", "tịnh", "net", "khối lượng tịnh", "kl tịnh"],
            dateIn: ["giờ vào", "ngày vào", "vào", "thời gian vào", "ngày giờ vào", "time in"],
            dateOut: ["giờ ra", "ngày ra", "ra", "thời gian ra", "ngày giờ ra", "time out"],
            driver: ["tài xế", "tài", "lái xe", "tên tài xế", "driver"],
            note: ["ghi chú", "note", "diễn giải", "ghi chú thêm"],
            containerNo: ["container", "số container", "số cont", "cont no", "cont"],
            goodsName: ["hàng hóa", "loại hàng", "tên hàng", "mặt hàng", "goods"]
        };

        let headerRowIndex = -1;
        let maxMatches = 0;

        for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
            const row = rawRows[r];
            if (!row || !Array.isArray(row)) continue;

            let matches = 0;
            row.forEach((cell) => {
                if (cell === null || cell === undefined) return;
                const val = String(cell).toLowerCase().trim();

                Object.values(keywords).forEach((kwList) => {
                    if (kwList.some((kw) => val.includes(kw))) {
                        matches++;
                    }
                });
            });

            if (matches > maxMatches) {
                maxMatches = matches;
                headerRowIndex = r;
            }
        }

        if (headerRowIndex === -1) {
            headerRowIndex = 0;
        }

        const headerRow = rawRows[headerRowIndex];
        if (!headerRow) {
            throw new Error('Không đọc được tiêu đề Excel!');
        }

        const mapping: Record<string, number> = {};
        Object.keys(keywords).forEach(field => {
            mapping[field] = -1;
        });

        headerRow.forEach((cell, idx) => {
            if (cell === null || cell === undefined) return;
            const nameLower = String(cell).toLowerCase().trim();

            Object.keys(keywords).forEach((field) => {
                if (mapping[field] !== -1) return;
                if (keywords[field].some((kw) => nameLower.includes(kw))) {
                    mapping[field] = idx;
                }
            });
        });

        // Validation constraints check (T-05-02-01 limit file processing)
        if (rawRows.length > 50000) {
            throw new Error('Tệp quá lớn, số lượng dòng tối đa cho phép là 50,000!');
        }

        // Required columns validation
        const required = ['plateNumber', 'weightNet'];
        const missing = required.filter(f => mapping[f] === -1);
        if (missing.length > 0) {
            throw new Error('File Excel thiếu các cột bắt buộc: Biển số xe hoặc Khối lượng tịnh!');
        }

        const tickets: any[] = [];
        const startRow = headerRowIndex + 1;

        for (let r = startRow; r < rawRows.length; r++) {
            const row = rawRows[r];
            if (!row || row.length === 0) continue;

            const plateRaw = mapping.plateNumber !== -1 ? row[mapping.plateNumber] : null;
            if (plateRaw === undefined || plateRaw === null || String(plateRaw).trim() === '') continue;

            const plate = String(plateRaw).trim().toUpperCase();

            // Extract weights cleanly (T-05-02-02 sanitize inputs)
            const w1 = mapping.weight1 !== -1 && row[mapping.weight1] !== undefined && row[mapping.weight1] !== null
                ? parseFloat(String(row[mapping.weight1]).replace(/[^0-9.-]/g, '')) || 0
                : 0;

            const w2 = mapping.weight2 !== -1 && row[mapping.weight2] !== undefined && row[mapping.weight2] !== null
                ? parseFloat(String(row[mapping.weight2]).replace(/[^0-9.-]/g, '')) || 0
                : 0;

            let wNet = 0;
            if (mapping.weightNet !== -1 && row[mapping.weightNet] !== undefined && row[mapping.weightNet] !== null) {
                wNet = parseFloat(String(row[mapping.weightNet]).replace(/[^0-9.-]/g, '')) || 0;
            }
            if (wNet === 0) {
                wNet = Math.abs(w1 - w2);
            }

            const dIn = mapping.dateIn !== -1 && row[mapping.dateIn] ? this.parseExcelDate(row[mapping.dateIn]) : null;
            const dOut = mapping.dateOut !== -1 && row[mapping.dateOut] ? this.parseExcelDate(row[mapping.dateOut]) : null;

            const driver = mapping.driver !== -1 && row[mapping.driver] ? String(row[mapping.driver]).trim() : null;
            const note = mapping.note !== -1 && row[mapping.note] ? String(row[mapping.note]).trim() : null;

            let ticketNo = mapping.ticketNo !== -1 && row[mapping.ticketNo] !== undefined && row[mapping.ticketNo] !== null
                ? String(row[mapping.ticketNo]).trim()
                : '';

            if (!ticketNo) {
                // Generate a deterministic temporary unique number
                ticketNo = `TK-${Date.now()}-${r}`;
            }

            if (type === 'warehouse') {
                const goodsName = mapping.goodsName !== -1 && row[mapping.goodsName] ? String(row[mapping.goodsName]).trim() : null;
                const ticket: WarehouseTicket = {
                    ticketNo,
                    plateNumber: plate,
                    driver: driver || undefined,
                    weight1: w1 || undefined,
                    weight2: w2 || undefined,
                    weightNet: wNet,
                    dateIn: dIn || undefined,
                    dateOut: dOut || undefined,
                    goodsName: goodsName || undefined,
                    note: note || undefined
                };
                tickets.push(ticket);
            } else {
                const containerNo = mapping.containerNo !== -1 && row[mapping.containerNo] ? String(row[mapping.containerNo]).trim() : null;
                const goodsName = mapping.goodsName !== -1 && row[mapping.goodsName] ? String(row[mapping.goodsName]).trim() : null;
                const ticket: ContainerTicket = {
                    ticketNo,
                    plateNumber: plate,
                    driver: driver || undefined,
                    weight1: w1 || undefined,
                    weight2: w2 || undefined,
                    weightNet: wNet,
                    dateIn: dIn || undefined,
                    dateOut: dOut || undefined,
                    containerNo: containerNo || undefined,
                    goodsName: goodsName || undefined,
                    note: note || undefined
                };
                tickets.push(ticket);
            }
        }

        return tickets;
    }

    private parseExcelDate(val: any): string | null {
        if (!val) return null;
        if (val instanceof Date) {
            return val.toISOString();
        }
        if (typeof val === 'number') {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            return date.toISOString();
        }
        const str = String(val).trim();
        const dMyHm = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{1,2})/);
        if (dMyHm) {
            const date = new Date(
                parseInt(dMyHm[3] || '0'),
                parseInt(dMyHm[2] || '1') - 1,
                parseInt(dMyHm[1] || '1'),
                parseInt(dMyHm[4] || '0'),
                parseInt(dMyHm[5] || '0')
            );
            if (!isNaN(date.getTime())) return date.toISOString();
        }
        const iso = str.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
        if (iso) return new Date(str).toISOString();

        const parsed = Date.parse(str);
        if (!isNaN(parsed)) return new Date(parsed).toISOString();

        return null;
    }

    /**
     * Get warehouse tickets with filters
     */
    async getWarehouseTickets(filters?: {
        ticketNo?: string;
        plateNumber?: string;
        goodsName?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<WarehouseTicket[]> {
        const getLocal = async () => {
            return (await dbContext.get<WarehouseTicket[]>('wb_warehouse_tickets')) || [];
        };

        try {
            let query = supabase
                .from('weighbridge_warehouse_tickets')
                .select('*')
                .order('created_at', { ascending: false });

            if (filters) {
                if (filters.ticketNo) query = query.ilike('ticket_no', `%${filters.ticketNo}%`);
                if (filters.plateNumber) query = query.ilike('plate_number', `%${filters.plateNumber}%`);
                if (filters.goodsName) query = query.ilike('goods_name', `%${filters.goodsName}%`);
                if (filters.startDate) query = query.gte('date_out', filters.startDate);
                if (filters.endDate) query = query.lte('date_out', filters.endDate);
            }

            const { data, error } = await query;
            if (error) {
                console.warn('Supabase fetch warehouse tickets failed, loading locally:', error);
                return await getLocal();
            }

            const formatted: WarehouseTicket[] = (data || []).map((t) => ({
                id: t.id,
                ticketNo: t.ticket_no,
                plateNumber: t.plate_number,
                driver: t.driver || undefined,
                weight1: t.weight_1 ? Number(t.weight_1) : undefined,
                weight2: t.weight_2 ? Number(t.weight_2) : undefined,
                weightNet: Number(t.weight_net),
                dateIn: t.date_in || undefined,
                dateOut: t.date_out || undefined,
                goodsName: t.goods_name || undefined,
                note: t.note || undefined,
                createdAt: t.created_at
            }));

            await dbContext.set('wb_warehouse_tickets', formatted);
            return formatted;
        } catch (e) {
            console.warn('Supabase offline, loading warehouse tickets locally:', e);
            return await getLocal();
        }
    }

    /**
     * Get container tickets with filters
     */
    async getContainerTickets(filters?: {
        ticketNo?: string;
        plateNumber?: string;
        containerNo?: string;
        goodsName?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<ContainerTicket[]> {
        const getLocal = async () => {
            return (await dbContext.get<ContainerTicket[]>('wb_container_tickets')) || [];
        };

        try {
            let query = supabase
                .from('weighbridge_container_tickets')
                .select('*')
                .order('created_at', { ascending: false });

            if (filters) {
                if (filters.ticketNo) query = query.ilike('ticket_no', `%${filters.ticketNo}%`);
                if (filters.plateNumber) query = query.ilike('plate_number', `%${filters.plateNumber}%`);
                if (filters.containerNo) query = query.ilike('container_no', `%${filters.containerNo}%`);
                if (filters.goodsName) query = query.ilike('goods_name', `%${filters.goodsName}%`);
                if (filters.startDate) query = query.gte('date_out', filters.startDate);
                if (filters.endDate) query = query.lte('date_out', filters.endDate);
            }

            const { data, error } = await query;
            if (error) {
                console.warn('Supabase fetch container tickets failed, loading locally:', error);
                return await getLocal();
            }

            const formatted: ContainerTicket[] = (data || []).map((t) => ({
                id: t.id,
                ticketNo: t.ticket_no,
                plateNumber: t.plate_number,
                driver: t.driver || undefined,
                weight1: t.weight_1 ? Number(t.weight_1) : undefined,
                weight2: t.weight_2 ? Number(t.weight_2) : undefined,
                weightNet: Number(t.weight_net),
                dateIn: t.date_in || undefined,
                dateOut: t.date_out || undefined,
                containerNo: t.container_no || undefined,
                goodsName: t.goods_name || undefined,
                note: t.note || undefined,
                createdAt: t.created_at
            }));

            await dbContext.set('wb_container_tickets', formatted);
            return formatted;
        } catch (e) {
            console.warn('Supabase offline, loading container tickets locally:', e);
            return await getLocal();
        }
    }

    /**
     * Save warehouse tickets using bulk upsert with chunk size 100
     */
    async saveWarehouseTickets(tickets: WarehouseTicket[]): Promise<{ success: boolean; error?: any }> {
        const local = (await dbContext.get<WarehouseTicket[]>('wb_warehouse_tickets')) || [];
        // Local merge with duplicate overwrite
        tickets.forEach((ticket) => {
            const index = local.findIndex((t) => t.ticketNo === ticket.ticketNo);
            if (index !== -1) {
                local[index] = { ...local[index], ...ticket };
            } else {
                local.push(ticket);
            }
        });
        await dbContext.set('wb_warehouse_tickets', local);

        try {
            if (tickets.length === 0) return { success: true };

            const dbRows = tickets.map((t) => ({
                ticket_no: t.ticketNo,
                plate_number: t.plateNumber,
                driver: t.driver || null,
                weight_1: t.weight1 || null,
                weight_2: t.weight2 || null,
                weight_net: t.weightNet,
                date_in: t.dateIn || null,
                date_out: t.dateOut || null,
                goods_name: t.goodsName || null,
                note: t.note || null
            }));

            const chunkSize = 100;
            for (let i = 0; i < dbRows.length; i += chunkSize) {
                const chunk = dbRows.slice(i, i + chunkSize);
                const { error } = await supabase
                    .from('weighbridge_warehouse_tickets')
                    .upsert(chunk, { onConflict: 'ticket_no' });

                if (error) {
                    throw error;
                }
            }

            return { success: true };
        } catch (e) {
            console.warn('Supabase save warehouse tickets failed:', e);
            return { success: false, error: e };
        }
    }

    /**
     * Save container tickets using bulk upsert with chunk size 100
     */
    async saveContainerTickets(tickets: ContainerTicket[]): Promise<{ success: boolean; error?: any }> {
        const local = (await dbContext.get<ContainerTicket[]>('wb_container_tickets')) || [];
        // Local merge with duplicate overwrite
        tickets.forEach((ticket) => {
            const index = local.findIndex((t) => t.ticketNo === ticket.ticketNo);
            if (index !== -1) {
                local[index] = { ...local[index], ...ticket };
            } else {
                local.push(ticket);
            }
        });
        await dbContext.set('wb_container_tickets', local);

        try {
            if (tickets.length === 0) return { success: true };

            const dbRows = tickets.map((t) => ({
                ticket_no: t.ticketNo,
                plate_number: t.plateNumber,
                driver: t.driver || null,
                weight_1: t.weight1 || null,
                weight_2: t.weight2 || null,
                weight_net: t.weightNet,
                date_in: t.dateIn || null,
                date_out: t.dateOut || null,
                container_no: t.containerNo || null,
                goods_name: t.goodsName || null,
                note: t.note || null
            }));

            const chunkSize = 100;
            for (let i = 0; i < dbRows.length; i += chunkSize) {
                const chunk = dbRows.slice(i, i + chunkSize);
                const { error } = await supabase
                    .from('weighbridge_container_tickets')
                    .upsert(chunk, { onConflict: 'ticket_no' });

                if (error) {
                    throw error;
                }
            }

            return { success: true };
        } catch (e) {
            console.warn('Supabase save container tickets failed:', e);
            return { success: false, error: e };
        }
    }

    /**
     * Delete warehouse ticket
     */
    async deleteWarehouseTicket(id: number): Promise<boolean> {
        const local = (await dbContext.get<WarehouseTicket[]>('wb_warehouse_tickets')) || [];
        const filtered = local.filter((t) => t.id !== id);
        await dbContext.set('wb_warehouse_tickets', filtered);

        try {
            const { error } = await supabase
                .from('weighbridge_warehouse_tickets')
                .delete()
                .eq('id', id);
            return !error;
        } catch (e) {
            return true;
        }
    }

    /**
     * Delete container ticket
     */
    async deleteContainerTicket(id: number): Promise<boolean> {
        const local = (await dbContext.get<ContainerTicket[]>('wb_container_tickets')) || [];
        const filtered = local.filter((t) => t.id !== id);
        await dbContext.set('wb_container_tickets', filtered);

        try {
            const { error } = await supabase
                .from('weighbridge_container_tickets')
                .delete()
                .eq('id', id);
            return !error;
        } catch (e) {
            return true;
        }
    }

    /**
     * Clear all warehouse tickets
     */
    async clearAllWarehouseTickets(): Promise<boolean> {
        await dbContext.delete('wb_warehouse_tickets');
        try {
            const { error } = await supabase
                .from('weighbridge_warehouse_tickets')
                .delete()
                .neq('id', 0); // deletes everything
            return !error;
        } catch (e) {
            return true;
        }
    }

    /**
     * Clear all container tickets
     */
    async clearAllContainerTickets(): Promise<boolean> {
        await dbContext.delete('wb_container_tickets');
        try {
            const { error } = await supabase
                .from('weighbridge_container_tickets')
                .delete()
                .neq('id', 0); // deletes everything
            return !error;
        } catch (e) {
            return true;
        }
    }
}

export const weighbridgeOtherService = new WeighbridgeOtherService();

import { supabase } from '@/supabase';
import { dbContext } from '@/services/storage/DBContext';
import * as ExcelJS from 'exceljs';
import type { WarehouseTicket, ContainerTicket } from '@/types/excel';

function parseCSVToRows(text: string): string[][] {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    return lines.map(line => {
        const row: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' || char === "'") {
                if (inQuotes && line[i + 1] === char) {
                    current += char;
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if ((char === ',' || char === ';' || char === '\t') && !inQuotes) {
                row.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        row.push(current.trim());
        return row;
    });
}

function removeAccents(str: string): string {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
}

export class WeighbridgeOtherService {
    /**
     * Parses Excel/CSV file buffer into raw rows and extracts tickets based on mapping
     */
    async parseExcelFile(
        fileBuffer: ArrayBuffer,
        type: 'warehouse' | 'container',
        fileName: string = ''
    ): Promise<any[]> {
        let rawRows: any[][] = [];
        const ext = fileName.split('.').pop()?.toLowerCase();

        if (ext === 'csv') {
            const text = new TextDecoder('utf-8').decode(fileBuffer);
            rawRows = parseCSVToRows(text);
        } else {
            try {
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(fileBuffer);
                const worksheet = workbook.worksheets[0];
                if (worksheet) {
                    worksheet.eachRow({ includeEmpty: true }, (row) => {
                        const rowValues: any[] = [];
                        const values = (row.values as any[]) || [];
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
                }
            } catch (err) {
                const text = new TextDecoder('utf-8').decode(fileBuffer);
                rawRows = parseCSVToRows(text);
            }
        }

        if (rawRows.length === 0) {
            throw new Error('File Excel rỗng!');
        }

        // Smart header row search
        let headerRowIndex = -1;
        let maxScore = 0;

        for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
            const row = rawRows[r];
            if (!row || !Array.isArray(row)) continue;

            let score = 0;
            row.forEach((cell) => {
                if (cell === null || cell === undefined) return;
                const rawVal = String(cell).toLowerCase().trim();
                const cleanVal = removeAccents(rawVal);
                if (!cleanVal) return;

                if (cleanVal.includes('phieu') || cleanVal.includes('ticket') || cleanVal.includes('stt')) score += 2;
                if (cleanVal.includes('xe') || cleanVal.includes('bien') || cleanVal.includes('sks') || cleanVal.includes('plate')) score += 3;
                if (cleanVal.includes('hang') || cleanVal.includes('kl') || cleanVal.includes('net') || cleanVal.includes('tinh') || cleanVal.includes('gross') || cleanVal.includes('tare')) score += 3;
                if (cleanVal.includes('tai') || cleanVal.includes('lai') || cleanVal.includes('driver')) score += 1;
                if (cleanVal.includes('vao') || cleanVal.includes('ra') || cleanVal.includes('ngay') || cleanVal.includes('gio') || cleanVal.includes('time')) score += 1;
                if (cleanVal.includes('cont')) score += 2;
            });

            if (score > maxScore) {
                maxScore = score;
                headerRowIndex = r;
            }
        }

        if (headerRowIndex === -1) {
            headerRowIndex = 0;
        }

        const headerRow = rawRows[headerRowIndex] || [];

        // Match columns specifically using prioritized matcher functions (unaccented normalized matching)
        const findCol = (matchers: ((s: string) => boolean)[]): number => {
            for (const matcher of matchers) {
                for (let idx = 0; idx < headerRow.length; idx++) {
                    const cell = headerRow[idx];
                    if (cell === null || cell === undefined) continue;
                    const rawStr = String(cell).toLowerCase().trim();
                    const cleanStr = removeAccents(rawStr);
                    if (matcher(rawStr) || matcher(cleanStr)) return idx;
                }
            }
            return -1;
        };

        const plateCol = findCol([
            s => s.includes('bien so') || s.includes('bien xe') || s.includes('so kiem soat') || s.includes('sks') || s.includes('plate'),
            s => s.includes('so xe'),
            s => s.includes('xe') && !s.includes('lai xe') && !s.includes('loai xe') && !s.includes('ten xe') && !s.includes('xac xe') && !s.includes('sa lan') && !s.includes('salan'),
            s => s.includes('phuong tien')
        ]);

        const goodsNameCol = findCol([
            s => s.includes('loai hang') || s.includes('ten hang') || s.includes('hang hoa') || s.includes('mat hang') || s.includes('goods'),
            s => s.includes('loai') && s.includes('hang')
        ]);

        const wNetCol = findCol([
            s => s.includes('kl tinh') || s.includes('kl hang') || s.includes('khoi luong tinh') || s.includes('khoi luong hang') || s.includes('trong luong hang') || s.includes('trong luong tinh'),
            s => (s.includes('kl') && s.includes('hang')) || (s.includes('khoi luong') && s.includes('hang')) || (s.includes('trong luong') && s.includes('hang')),
            s => s.includes('tinh') || s.includes('net'),
            s => (s.includes('khoi luong') || s.includes('trong luong')) && !s.includes('1') && !s.includes('2') && !s.includes('gross') && !s.includes('tare')
        ]);

        const w1Col = findCol([
            s => s.includes('lan 1') || s.includes('can 1') || s.includes('lan mot') || s.includes('gross') || s.includes('tl 1') || s.includes('kl 1') || s.includes('kl can lan 1'),
            s => s.includes('tong') || s.includes('bi')
        ]);

        const w2Col = findCol([
            s => s.includes('lan 2') || s.includes('can 2') || s.includes('lan hai') || s.includes('tare') || s.includes('tl 2') || s.includes('kl 2') || s.includes('kl can lan 2'),
            s => s.includes('xac xe') || s.includes('xac')
        ]);

        const driverCol = findCol([
            s => s.includes('tai xe') || s.includes('lai xe') || s.includes('ten tai') || s.includes('driver'),
            s => s.includes('tai')
        ]);

        const ticketNoCol = findCol([
            s => s.includes('so phieu') || s.includes('ma phieu') || s.includes('ticket') || s.includes('phieu') || s.includes('so p'),
            s => s.includes('stt')
        ]);

        const containerNoCol = findCol([
            s => s.includes('container') || s.includes('so cont') || s.includes('cont no') || s.includes('cont')
        ]);

        const dateInCol = findCol([
            s => s.includes('gio vao') || s.includes('ngay vao') || s.includes('time in'),
            s => s.includes('ngay can lan 1') || s.includes('ngay 1') || s.includes('can lan 1')
        ]);

        const timeInCol = findCol([
            s => s.includes('gio can lan 1') || s.includes('gio can 1') || s.includes('time 1')
        ]);

        const dateOutCol = findCol([
            s => s.includes('gio ra') || s.includes('ngay ra') || s.includes('time out'),
            s => s.includes('ngay can lan 2') || s.includes('ngay 2') || s.includes('can lan 2')
        ]);

        const timeOutCol = findCol([
            s => s.includes('gio can lan 2') || s.includes('gio can 2') || s.includes('time 2')
        ]);

        const noteCol = findCol([
            s => s.includes('ghi chu') || s.includes('note') || s.includes('dien giai')
        ]);

        // Validation constraints check (T-05-02-01 limit file processing)
        if (rawRows.length > 50000) {
            throw new Error('Tệp quá lớn, số lượng dòng tối đa cho phép là 50,000!');
        }

        // Required columns validation
        if (plateCol === -1) {
            const detectedHeaders = headerRow.map(c => String(c || '').trim()).filter(Boolean).join(', ');
            throw new Error(`File Excel thiếu cột 'Biển số xe'! Các cột tìm thấy trong tệp: [${detectedHeaders || 'Không có'}]`);
        }

        if (wNetCol === -1 && (w1Col === -1 || w2Col === -1)) {
            const detectedHeaders = headerRow.map(c => String(c || '').trim()).filter(Boolean).join(', ');
            throw new Error(`File Excel thiếu cột 'Khối lượng tịnh' hoặc cặp 'Trọng lượng lần 1' và 'lần 2'! Các cột tìm thấy: [${detectedHeaders || 'Không có'}]`);
        }

        const tickets: any[] = [];
        const startRow = headerRowIndex + 1;

        for (let r = startRow; r < rawRows.length; r++) {
            const row = rawRows[r];
            if (!row || row.length === 0) continue;

            const plateRaw = plateCol !== -1 ? row[plateCol] : null;
            if (plateRaw === undefined || plateRaw === null || String(plateRaw).trim() === '') continue;

            const plate = String(plateRaw).trim().toUpperCase();

            // Extract weights cleanly (T-05-02-02 sanitize inputs)
            const w1 = w1Col !== -1 && row[w1Col] !== undefined && row[w1Col] !== null
                ? parseFloat(String(row[w1Col]).replace(/[^0-9.-]/g, '')) || 0
                : 0;

            const w2 = w2Col !== -1 && row[w2Col] !== undefined && row[w2Col] !== null
                ? parseFloat(String(row[w2Col]).replace(/[^0-9.-]/g, '')) || 0
                : 0;

            let wNet = 0;
            if (wNetCol !== -1 && row[wNetCol] !== undefined && row[wNetCol] !== null) {
                wNet = parseFloat(String(row[wNetCol]).replace(/[^0-9.-]/g, '')) || 0;
            }
            if (wNet === 0) {
                wNet = Math.abs(w1 - w2);
            }

            const valTimeIn = timeInCol !== -1 ? row[timeInCol] : null;
            const valTimeOut = timeOutCol !== -1 ? row[timeOutCol] : null;

            const dIn = dateInCol !== -1 && row[dateInCol] ? this.parseExcelDate(row[dateInCol], valTimeIn) : null;
            const dOut = dateOutCol !== -1 && row[dateOutCol] ? this.parseExcelDate(row[dateOutCol], valTimeOut) : null;

            const driver = driverCol !== -1 && row[driverCol] ? String(row[driverCol]).trim() : null;
            const note = noteCol !== -1 && row[noteCol] ? String(row[noteCol]).trim() : null;

            let ticketNo = ticketNoCol !== -1 && row[ticketNoCol] !== undefined && row[ticketNoCol] !== null
                ? String(row[ticketNoCol]).trim()
                : '';

            if (!ticketNo) {
                // Generate a deterministic temporary unique number
                ticketNo = `TK-${Date.now()}-${r}`;
            }

            if (type === 'warehouse') {
                const goodsName = goodsNameCol !== -1 && row[goodsNameCol] ? String(row[goodsNameCol]).trim() : null;
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
                const containerNo = containerNoCol !== -1 && row[containerNoCol] ? String(row[containerNoCol]).trim() : null;
                const goodsName = goodsNameCol !== -1 && row[goodsNameCol] ? String(row[goodsNameCol]).trim() : null;
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

    private parseExcelDate(val: any, valTime?: any): string | null {
        if (!val) return null;
        let str = '';
        const timeStr = valTime ? String(valTime).trim() : '';

        if (val instanceof Date) {
            const d = String(val.getDate()).padStart(2, '0');
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const y = val.getFullYear();
            const h = String(val.getHours()).padStart(2, '0');
            const min = String(val.getMinutes()).padStart(2, '0');
            str = `${d}/${m}/${y} ${timeStr || `${h}:${min}`}`;
        } else if (typeof val === 'number') {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            const h = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            str = `${d}/${m}/${y} ${timeStr || `${h}:${min}`}`;
        } else {
            str = String(val).trim() + (timeStr ? ' ' + timeStr : '');
        }

        const dMyHm = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
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

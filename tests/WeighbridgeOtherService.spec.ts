import { describe, it, expect, vi, beforeEach } from 'vitest';
import { weighbridgeOtherService } from '@/services/excel/WeighbridgeOtherService';
import { supabase } from '@/supabase';
import { dbContext } from '@/services/storage/DBContext';
import * as ExcelJS from 'exceljs';

// Mock Supabase
vi.mock('@/supabase', () => {
    const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        neq: vi.fn().mockResolvedValue({ data: [], error: null }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        then: vi.fn((cb) => Promise.resolve(cb({ data: [], error: null })))
    };
    
    // Make then function act like a promise resolve
    mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.delete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
        neq: vi.fn().mockResolvedValue({ error: null })
    });
    mockQueryBuilder.order.mockImplementation(function(this: any) {
        return {
            then: (cb: any) => Promise.resolve(cb({
                data: [
                    {
                        id: 1,
                        ticket_no: 'TK001',
                        plate_number: '51C-12345',
                        weight_net: 15000,
                        goods_name: 'Lúa mì',
                        container_no: 'CONT123'
                    }
                ],
                error: null
            }))
        };
    });

    return {
        supabase: {
            from: vi.fn(() => mockQueryBuilder)
        }
    };
});

// Mock DBContext
vi.mock('@/services/storage/DBContext', () => {
    const store = new Map();
    return {
        dbContext: {
            get: vi.fn(async (key: string) => store.get(key)),
            set: vi.fn(async (key: string, value: any) => { store.set(key, value); }),
            delete: vi.fn(async (key: string) => { store.delete(key); }),
            clear: vi.fn(async () => { store.clear(); })
        }
    };
});

describe('WeighbridgeOtherService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully parse a simulated Warehouse Excel file', async () => {
        // Create a real exceljs workbook in memory to test parsing
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Sheet1');
        
        // Add header row
        sheet.addRow([
            'Phiếu Số',
            'Số Xe',
            'Cân Lần 1',
            'Cân Lần 2',
            'Khối Lượng Hàng',
            'Giờ Vào',
            'Giờ Ra',
            'Mặt Hàng',
            'Ghi Chú'
        ]);

        // Add data rows
        sheet.addRow([
            'TK-W01',
            '72C-99999',
            24000,
            10000,
            14000,
            '2026-07-27 08:00',
            '2026-07-27 08:30',
            'Gạo Lứt',
            'Hàng nhập kho A'
        ]);

        const buffer = await workbook.xlsx.writeBuffer();
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        const result = await weighbridgeOtherService.parseExcelFile(arrayBuffer, 'warehouse');
        
        expect(result).toHaveLength(1);
        expect(result[0].ticketNo).toBe('TK-W01');
        expect(result[0].plateNumber).toBe('72C-99999');
        expect(result[0].weightNet).toBe(14000);
        expect(result[0].goodsName).toBe('Gạo Lứt');
        expect(result[0].note).toBe('Hàng nhập kho A');
    });

    it('should successfully parse a simulated Container Excel file', async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Sheet1');
        
        sheet.addRow([
            'Số Phiếu',
            'Biển Số',
            'Cân 1',
            'Cân 2',
            'Tịnh',
            'Ngày Vào',
            'Ngày Ra',
            'Số Container',
            'Loại Hàng',
            'Ghi Chú'
        ]);

        sheet.addRow([
            'TK-C01',
            '51R-88888',
            35000,
            15000,
            20000,
            '2026-07-27 09:00',
            '2026-07-27 09:45',
            'CONT-ABCD-999',
            'Hạt nhựa',
            'Cont xuất cảng'
        ]);

        const buffer = await workbook.xlsx.writeBuffer();
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        const result = await weighbridgeOtherService.parseExcelFile(arrayBuffer, 'container');
        
        expect(result).toHaveLength(1);
        expect(result[0].ticketNo).toBe('TK-C01');
        expect(result[0].plateNumber).toBe('51R-88888');
        expect(result[0].weightNet).toBe(20000);
        expect(result[0].containerNo).toBe('CONT-ABCD-999');
        expect(result[0].goodsName).toBe('Hạt nhựa');
    });

    it('should save warehouse tickets in chunks of 100 to Supabase', async () => {
        const mockTickets = Array.from({ length: 250 }, (_, idx) => ({
            ticketNo: `TK-W-${idx}`,
            plateNumber: '51C-11111',
            weightNet: 10000
        }));

        const result = await weighbridgeOtherService.saveWarehouseTickets(mockTickets);
        expect(result.success).toBe(true);

        const fromSpy = vi.spyOn(supabase, 'from');
        expect(fromSpy).toHaveBeenCalledWith('weighbridge_warehouse_tickets');
    });

    it('should fetch warehouse tickets and format fields correctly', async () => {
        const result = await weighbridgeOtherService.getWarehouseTickets();
        expect(result).toHaveLength(1);
        expect(result[0].ticketNo).toBe('TK001');
        expect(result[0].plateNumber).toBe('51C-12345');
        expect(result[0].goodsName).toBe('Lúa mì');
    });
});

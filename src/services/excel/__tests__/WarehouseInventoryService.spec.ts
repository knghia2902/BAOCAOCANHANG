import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockStore = new Map<string, any>();

vi.mock('@/services/storage/DBContext', () => ({
    dbContext: {
        get: vi.fn(async (key: string) => mockStore.get(key)),
        set: vi.fn(async (key: string, val: any) => { mockStore.set(key, val); }),
        delete: vi.fn(async (key: string) => { mockStore.delete(key); }),
        clear: vi.fn(async () => { mockStore.clear(); })
    }
}));

vi.mock('@/supabase', () => {
    const chain: any = {
        select: () => chain,
        eq: () => chain,
        neq: () => Promise.resolve({ data: [], error: null }),
        order: () => chain,
        range: () => Promise.resolve({ data: [], error: null }),
        single: () => Promise.resolve({ data: { settings: {} }, error: null }),
        upsert: () => Promise.resolve({ data: [], error: null }),
        update: () => chain,
        delete: () => chain,
        then: (resolve: any) => resolve({ data: [], error: null })
    };
    return {
        supabase: {
            from: () => chain
        }
    };
});

import {
    WarehouseInventoryService,
    computeReportDate,
    normalizeWarehouseId,
    classifyWeighbridgeRow,
    computeWarehouseFinalTable,
    sanitizeCustomerName,
    sanitizeDailyRemarks,
    parseToIsoDate,
    getTicketCustomerGroup
} from '../WarehouseInventoryService';
import type { WarehouseConfig, WarehouseInventoryTicket } from '@/types/excel';

describe('WarehouseInventoryService', () => {
    describe('sanitizeCustomerName & sanitizeDailyRemarks', () => {
        it('cleans date strings, 1899/1900 artifacts and restores fallback', () => {
            expect(sanitizeCustomerName('Sat Dec 30 1899 00:00:00 GMT+0706', 'EASTWOOD')).toBe('EASTWOOD');
            expect(sanitizeCustomerName(new Date(0), 'EASTWOOD')).toBe('EASTWOOD');
            expect(sanitizeCustomerName('2026-10-22', 'GỖ BÌNH ĐỊNH')).toBe('GỖ BÌNH ĐỊNH');
            expect(sanitizeCustomerName('', 'EASTWOOD')).toBe('EASTWOOD');
            expect(sanitizeCustomerName('EASTWOOD', 'DEFAULT')).toBe('EASTWOOD');
            expect(sanitizeCustomerName('GỖ BÌNH ĐỊNH', 'DEFAULT')).toBe('GỖ BÌNH ĐỊNH');
        });

        it('rejects weight numbers like 100080 in parseToIsoDate and purges corrupted dailyRemarks', () => {
            expect(parseToIsoDate(100080)).toBe('');
            expect(parseToIsoDate('100080')).toBe('');
            expect(parseToIsoDate('2026-05-28')).toBe('2026-05-28');

            const { cleaned, hadInvalid } = sanitizeDailyRemarks({
                '100080-01-01': 'Thu May 28 2026 07:00:00 GMT+0700 (Indochina Time)',
                '102140-01-01': 'Tue May 26 2026 07:00:00 GMT+0700 (Indochina Time)',
                '2026-05-28': 'Thu May 28 2026 07:00:00 GMT+0700 (Indochina Time)',
                '2026-01-05': 'Xuất hết hàng kho 1,2'
            });
            expect(hadInvalid).toBe(true);
            expect(cleaned).toEqual({
                '2026-01-05': 'Xuất hết hàng kho 1,2'
            });
        });
    });

    describe('getTicketCustomerGroup', () => {
        it('identifies Kho 4 vs Kho 1-2-3 customer groups for both direct and warehouse tickets', () => {
            const ticketWh4: WarehouseInventoryTicket = {
                id: '1', soPhieu: '1', reportDate: '2026-10-20', weighOutDate: '2026-10-20',
                weighOutTime: '10:00', flowType: 'IMPORT', warehouseId: 'KHO 4', customerName: 'EASTWOOD',
                cargoType: 'Viên nén', vehiclePlate: '50H1', carrierName: 'NN', grossWeight: 50, tareWeight: 10, netWeight: 40
            };
            expect(getTicketCustomerGroup(ticketWh4)).toBe('KHO_4');

            const ticketWh1: WarehouseInventoryTicket = {
                id: '2', soPhieu: '2', reportDate: '2026-10-20', weighOutDate: '2026-10-20',
                weighOutTime: '10:00', flowType: 'IMPORT', warehouseId: 'KHO 1', customerName: 'GBD',
                cargoType: 'Viên nén', vehiclePlate: '50H2', carrierName: 'NN', grossWeight: 50, tareWeight: 10, netWeight: 40
            };
            expect(getTicketCustomerGroup(ticketWh1)).toBe('KHO_123');

            const ticketDirectEW: WarehouseInventoryTicket = {
                id: '3', soPhieu: '3', reportDate: '2026-10-20', weighOutDate: '2026-10-20',
                weighOutTime: '10:00', flowType: 'DIRECT', warehouseId: null, customerName: 'EASTWOOD',
                cargoType: 'Viên nén', vehiclePlate: '50H3', carrierName: 'NN', grossWeight: 50, tareWeight: 10, netWeight: 40
            };
            expect(getTicketCustomerGroup(ticketDirectEW)).toBe('KHO_4');

            const ticketDirectGBD: WarehouseInventoryTicket = {
                id: '4', soPhieu: '4', reportDate: '2026-10-20', weighOutDate: '2026-10-20',
                weighOutTime: '10:00', flowType: 'DIRECT', warehouseId: null, customerName: 'GỖ BÌNH ĐỊNH',
                cargoType: 'Viên nén', vehiclePlate: '50H4', carrierName: 'NN', grossWeight: 50, tareWeight: 10, netWeight: 40
            };
            expect(getTicketCustomerGroup(ticketDirectGBD)).toBe('KHO_123');
        });
    });

    describe('normalizeWarehouseId', () => {
        it('normalizes warehouse names and sheet names accurately', () => {
            expect(normalizeWarehouseId('Kho 1')).toBe('KHO 1');
            expect(normalizeWarehouseId('KHO 2')).toBe('KHO 2');
            expect(normalizeWarehouseId('IMPORT KHO 3')).toBe('KHO 3');
            expect(normalizeWarehouseId('EXPORT KH 3')).toBe('KHO 3');
            expect(normalizeWarehouseId('Kho 4')).toBe('KHO 4');
            expect(normalizeWarehouseId('CHƠN THÀNH')).toBeNull();
            expect(normalizeWarehouseId('TG 15767 (105)')).toBeNull();
        });
    });

    describe('computeReportDate (06:00 AM shift cutoff)', () => {
        it('assigns tickets weighed out between 00:00 and 05:59:59 to previous day (D - 1)', () => {
            expect(computeReportDate('21/10/2026', '05:59:59')).toBe('2026-10-20');
            expect(computeReportDate('21/10/2026', '00:15:00')).toBe('2026-10-20');
            expect(computeReportDate('01/10/2026', '04:30:00')).toBe('2026-09-30');
        });

        it('keeps tickets weighed out at or after 06:00:00 on the same calendar day D', () => {
            expect(computeReportDate('20/10/2026', '06:00:00')).toBe('2026-10-20');
            expect(computeReportDate('20/10/2026', '18:45:12')).toBe('2026-10-20');
            expect(computeReportDate('2026-10-20', '23:59:00')).toBe('2026-10-20');
        });
    });

    describe('classifyWeighbridgeRow (3-way classification)', () => {
        const vehicleMap = {
            '50H23564': {
                vehiclePlate: '50H23564',
                displayPlate: '50H-235.64',
                carrierName: 'NGUYÊN NGỌC'
            }
        };

        it('classifies Nhap into KHO 1..4 as IMPORT and captures factory name from Tai Xe', () => {
            const ticket = classifyWeighbridgeRow({
                soPhieu: '1001',
                maLenh: '',
                soXe: '50H23564/51R18269',
                khachHang: 'EASTWOOD',
                kl1: 58200,
                kl2: 16000,
                klHang: 42200,
                ngay1: '20/10/2026',
                gio1: '14:10:00',
                ngay2: '20/10/2026',
                gio2: '14:35:00',
                xuatNhap: 'Nhap',
                loaiHang: 'Viên nén gỗ',
                loaiSalan: 'KHO 4',
                taiXe: 'VỮNG BỀN',
                ghiChu: '42.10'
            }, vehicleMap);

            expect(ticket).not.toBeNull();
            expect(ticket?.flowType).toBe('IMPORT');
            expect(ticket?.warehouseId).toBe('KHO 4');
            expect(ticket?.netWeight).toBe(42.2);
            expect(ticket?.carrierName).toBe('NGUYÊN NGỌC');
            expect(ticket?.sourceOrRemark).toBe('VỮNG BỀN');
            expect(ticket?.factoryWeight).toBe(42.1);
            expect(ticket?.reportDate).toBe('2026-10-20');
        });

        it('classifies Xuat with Tai Xe = KHO 1..4 as EXPORT from warehouse to barge', () => {
            const ticket = classifyWeighbridgeRow({
                soPhieu: '2002',
                maLenh: '138/04/G.38',
                soXe: '50H23564',
                khachHang: 'EASTWOOD',
                kl1: 48000,
                kl2: 16030,
                klHang: 31970,
                ngay1: '21/10/2026',
                gio1: '05:10:00',
                ngay2: '21/10/2026',
                gio2: '05:30:00',
                xuatNhap: 'Xuat',
                loaiHang: 'Viên nén gỗ',
                loaiSalan: 'DONA 04( 138/04/G.38)',
                taiXe: 'Kho 4',
                ghiChu: ''
            }, vehicleMap);

            expect(ticket).not.toBeNull();
            expect(ticket?.flowType).toBe('EXPORT');
            expect(ticket?.warehouseId).toBe('KHO 4');
            expect(ticket?.netWeight).toBe(31.97);
            expect(ticket?.bargeInfo).toBe('DONA 04( 138/04/G.38)');
            // 05:30 AM on 21/10/2026 belongs to 20/10/2026 shift
            expect(ticket?.reportDate).toBe('2026-10-20');
        });

        it('classifies Xuat with Tai Xe != KHO 1..4 as DIRECT (Đi thẳng / Xá thẳng)', () => {
            const ticket = classifyWeighbridgeRow({
                soPhieu: '3003',
                maLenh: '142/01/G.38',
                soXe: '50H23564',
                khachHang: 'EASTWOOD',
                kl1: 55000,
                kl2: 15000,
                klHang: 40000,
                ngay1: '20/10/2026',
                gio1: '10:00:00',
                ngay2: '20/10/2026',
                gio2: '10:20:00',
                xuatNhap: 'Xuat',
                loaiHang: 'Viên nén gỗ',
                loaiSalan: 'TÂY NAM 05 (142/01/G.38)',
                taiXe: 'CHƠN THÀNH',
                ghiChu: ''
            }, vehicleMap);

            expect(ticket).not.toBeNull();
            expect(ticket?.flowType).toBe('DIRECT');
            expect(ticket?.warehouseId).toBeNull();
            expect(ticket?.netWeight).toBe(40);
            expect(ticket?.sourceOrRemark).toBe('CHƠN THÀNH');
        });

        it('ignores non-warehouse agricultural Nhap rows (e.g. BẮP from barge)', () => {
            const ticket = classifyWeighbridgeRow({
                soPhieu: '4004',
                maLenh: '105',
                soXe: '61C12345',
                khachHang: 'DE HEUS',
                kl1: 45000,
                kl2: 15000,
                klHang: 30000,
                ngay1: '20/10/2026',
                gio1: '09:00:00',
                ngay2: '20/10/2026',
                gio2: '09:15:00',
                xuatNhap: 'Nhap',
                loaiHang: 'BẮP',
                loaiSalan: 'TG 15767 (105)',
                taiXe: 'TÀI XẾ A',
                ghiChu: ''
            }, vehicleMap);

            expect(ticket).toBeNull();
        });
    });

    describe('computeWarehouseFinalTable (Continuous cumulative stock)', () => {
        it('accumulates stock continuously across days and customer changes without resetting', () => {
            const config: WarehouseConfig = {
                warehouseId: 'KHO 1',
                initialStock: 100,
                initialDate: '2026-10-18',
                currentCustomer: 'EASTWOOD',
                dailyRemarks: {
                    '2026-10-20': 'Xuất tàu MV. HENG SHUN'
                }
            };

            const tickets: WarehouseInventoryTicket[] = [
                {
                    id: '1',
                    soPhieu: '101',
                    reportDate: '2026-10-19',
                    weighOutDate: '2026-10-19',
                    weighOutTime: '10:00:00',
                    flowType: 'IMPORT',
                    warehouseId: 'KHO 1',
                    customerName: 'GỖ BÌNH ĐỊNH',
                    cargoType: 'Viên nén gỗ',
                    vehiclePlate: '50H11111',
                    carrierName: 'NGUYÊN NGỌC',
                    grossWeight: 50,
                    tareWeight: 10,
                    netWeight: 40
                },
                {
                    id: '2',
                    soPhieu: '102',
                    reportDate: '2026-10-20',
                    weighOutDate: '2026-10-20',
                    weighOutTime: '11:00:00',
                    flowType: 'IMPORT',
                    warehouseId: 'KHO 1',
                    customerName: 'EASTWOOD',
                    cargoType: 'Viên nén gỗ',
                    vehiclePlate: '50H22222',
                    carrierName: 'NGUYÊN NGỌC',
                    grossWeight: 60,
                    tareWeight: 10,
                    netWeight: 50
                },
                {
                    id: '3',
                    soPhieu: '103',
                    reportDate: '2026-10-20',
                    weighOutDate: '2026-10-20',
                    weighOutTime: '15:00:00',
                    flowType: 'EXPORT',
                    warehouseId: 'KHO 1',
                    customerName: 'EASTWOOD',
                    cargoType: 'Viên nén gỗ',
                    vehiclePlate: '50H33333',
                    carrierName: 'NGUYÊN NGỌC',
                    grossWeight: 45,
                    tareWeight: 15,
                    netWeight: 30,
                    bargeInfo: 'DONA 04',
                    vesselName: 'MV. HENG SHUN'
                }
            ];

            const result = computeWarehouseFinalTable('KHO 1', tickets, config);
            expect(result.openingStockBeforeFilter).toBe(100);
            expect(result.rows).toHaveLength(2);
            // Day 1 (2026-10-19): 100 + 40 - 0 = 140
            expect(result.rows[0]?.reportDate).toBe('2026-10-19');
            expect(result.rows[0]?.remainingStockTons).toBe(140);
            expect(result.rows[0]?.remark).toBe('');
            // Day 2 (2026-10-20): 140 + 50 - 30 = 160
            expect(result.rows[1]?.reportDate).toBe('2026-10-20');
            expect(result.rows[1]?.remainingStockTons).toBe(160);
            expect(result.rows[1]?.remark).toBe('Xuất tàu MV. HENG SHUN');
            expect(result.closingStockTons).toBe(160);
        });
    });

    describe('Multi-sheet Excel Report Exporters (INV-05)', () => {
        beforeEach(async () => {
            await WarehouseInventoryService.clearWarehouseTickets('ALL');
            await WarehouseInventoryService.saveConfig({
                warehouseId: 'KHO 4',
                initialStock: 250,
                initialDate: '2026-10-01',
                currentCustomer: 'EASTWOOD',
                dailyRemarks: { '2026-10-20': 'Xuất tàu MV. HENG SHUN' }
            });
            await WarehouseInventoryService.saveTicketsBulk([
                {
                    id: 'IMP_K4_1',
                    soPhieu: '9001',
                    reportDate: '2026-10-20',
                    weighOutDate: '2026-10-20',
                    weighOutTime: '09:00:00',
                    flowType: 'IMPORT',
                    warehouseId: 'KHO 4',
                    customerName: 'EASTWOOD',
                    cargoType: 'Viên nén gỗ',
                    vehiclePlate: '50H23564',
                    carrierName: 'NGUYÊN NGỌC',
                    grossWeight: 55,
                    tareWeight: 15,
                    netWeight: 40
                },
                {
                    id: 'EXP_K4_1',
                    soPhieu: '9002',
                    reportDate: '2026-10-20',
                    weighOutDate: '2026-10-20',
                    weighOutTime: '14:00:00',
                    flowType: 'EXPORT',
                    warehouseId: 'KHO 4',
                    customerName: 'EASTWOOD',
                    cargoType: 'Viên nén gỗ',
                    vehiclePlate: '50H23564',
                    carrierName: 'NGUYÊN NGỌC',
                    grossWeight: 45,
                    tareWeight: 15,
                    netWeight: 30,
                    bargeInfo: 'DONA 04',
                    vesselName: 'MV. HENG SHUN'
                }
            ]);
        });

        it('exports Single-Warehouse workbook with IMPORT 4, EXPORT 4, FINAL 4, XÁ THẲNG (without Data sheet) and live formulas', async () => {
            const { buffer, filename } = await WarehouseInventoryService.exportSingleWarehouseWorkbook('KHO 4');
            expect(filename).toContain('KHO 4');
            expect(buffer.byteLength).toBeGreaterThan(1000);

            const ExcelJS = await import('exceljs');
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(buffer);

            const sheetNames = wb.worksheets.map(s => s.name);
            expect(sheetNames).toEqual(['IMPORT 4', 'EXPORT 4', 'FINAL 4', 'XÁ THẲNG']);

            const importSheet = wb.getWorksheet('IMPORT 4')!;
            const row6Headers = Array.from({ length: 14 }, (_, i) => String(importSheet.getRow(6).getCell(i + 1).value || ''));
            expect(row6Headers).toEqual([
                'STT (No)',
                'Ngày nhập\nDate',
                'Số phiếu (Serial)',
                'Số xe (Truck no)',
                'T.Lượng vào (Weight in)',
                'T.Lượng ra (Weight out)',
                'T.Lượng hàng (N.Weight)',
                'Ngày cân vào',
                'Ngày cân ra',
                'Cân Nhà Máy',
                'Chênh lệch',
                'Ghi chú',
                'Ghi chú 2',
                'Nhà xe'
            ]);

            const exportSheet = wb.getWorksheet('EXPORT 4')!;
            const exportRow7Headers = Array.from({ length: 14 }, (_, i) => String(exportSheet.getRow(7).getCell(i + 1).value || ''));
            expect(exportRow7Headers).toEqual([
                'STT (No)',
                'Ngày xuất\n(Date)',
                'Số phiếu (Serial)',
                'Số xe (Truck no)',
                'T.Lượng vào (Weight in)',
                'T.Lượng ra (Weight out)',
                'T.Lượng hàng (N.Weight)',
                'Nhập/Xuất (In/Out)',
                'Kho (Warehouse)',
                'Ngày cân vào',
                'Ngày cân ra',
                'Salan',
                'Tàu',
                'Ghi chú'
            ]);
            expect(exportSheet.getRow(9).getCell(1).value).toBe('TỔNG CỘNG');
            const exportTotalG = exportSheet.getRow(9).getCell(7).value as any;
            expect(exportTotalG.formula).toBe('SUBTOTAL(9,G8:G8)');
            expect(exportTotalG.result).toBe(30000);

            const finalSheet = wb.getWorksheet('FINAL 4')!;
            const finalRow7Headers = Array.from({ length: 6 }, (_, i) => String(finalSheet.getRow(7).getCell(i + 1).value || ''));
            expect(finalRow7Headers).toEqual([
                'Ngày\nDate',
                'Trọng lượng nhập \nImported weight',
                'Trọng lượng xuất \nExported weight',
                'Tồn cuối \nStock',
                'Xá thẳng',
                'Ghi chú\nRemarks '
            ]);
            const row9ImportCell = finalSheet.getRow(9).getCell(2).value as any;
            const row9StockCell = finalSheet.getRow(9).getCell(4).value as any;
            expect(row9ImportCell.formula).toContain("SUMIFS('IMPORT 4'");
            expect(row9ImportCell.result).toBe(40000);
            expect(row9StockCell.formula).toBe('D8+B9-C9');
            // 250,000 + 40,000 - 30,000 = 260,000 kg
            expect(row9StockCell.result).toBe(260000);

            const directSheet = wb.getWorksheet('XÁ THẲNG')!;
            const directRow7Headers = Array.from({ length: 14 }, (_, i) => String(directSheet.getRow(7).getCell(i + 1).value || ''));
            expect(directRow7Headers).toEqual([
                'STT (No)',
                'Ngày nhập\nDate',
                'Số phiếu (Serial)',
                'Số xe (Truck no)',
                'T.Lượng vào (Weight in)',
                'T.Lượng ra (Weight out)',
                'T.Lượng hàng (N.Weight)',
                'Ngày cân vào',
                'Ngày cân ra',
                'Cân Nhà Máy',
                'Chênh lệch',
                'Ghi chú',
                'Nơi nhận',
                'Tàu'
            ]);
        }, 30000);

        it('exports Combined 1-2-3 Warehouse workbook with horizontal FINAL layout', async () => {
            const { buffer, filename } = await WarehouseInventoryService.exportCombined123WarehouseWorkbook();
            expect(filename).toContain('GBD');
            expect(buffer.byteLength).toBeGreaterThan(1000);

            const ExcelJS = await import('exceljs');
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(buffer);

            const sheetNames = wb.worksheets.map(s => s.name);
            expect(sheetNames).toEqual([
                'FINAL',
                'IMPORT 1',
                'EXPORT 1',
                'IMPORT 2',
                'EXPORT 2',
                'IMPORT KHO 3',
                'EXPORT KH 3',
                'XÁ THẲNG'
            ]);
            expect(wb.getWorksheet('Data')).toBeUndefined();

            const import1Sheet = wb.getWorksheet('IMPORT 1')!;
            expect(import1Sheet.getRow(13).getCell(1).value).toContain('STT');
            expect(import1Sheet.getRow(13).getCell(18).value).toContain('Ghi chú');

            const export1Sheet = wb.getWorksheet('EXPORT 1')!;
            expect(export1Sheet.getRow(7).getCell(1).value).toContain('STT');
            expect(export1Sheet.getRow(7).getCell(14).value).toContain('Nhà xe');

            const directSheet = wb.getWorksheet('XÁ THẲNG')!;
            expect(directSheet.getRow(12).getCell(1).value).toContain('STT');
            expect(directSheet.getRow(12).getCell(19).value).toContain('Nhà xe');
        }, 30000);

        it('clears only Kho 4 direct tickets when target is DIRECT_KHO4', async () => {
            await WarehouseInventoryService.clearWarehouseTickets('ALL');
            await WarehouseInventoryService.saveTicketsBulk([
                {
                    id: 'DIR_K4', soPhieu: '1', reportDate: '2026-10-20', weighOutDate: '2026-10-20',
                    weighOutTime: '10:00', flowType: 'DIRECT', warehouseId: 'KHO 4', customerName: 'EASTWOOD',
                    cargoType: 'Viên nén', vehiclePlate: '50H1', carrierName: 'NN', grossWeight: 50, tareWeight: 10, netWeight: 40
                },
                {
                    id: 'DIR_GBD', soPhieu: '2', reportDate: '2026-10-20', weighOutDate: '2026-10-20',
                    weighOutTime: '10:00', flowType: 'DIRECT', warehouseId: 'KHO 1', customerName: 'GỖ BÌNH ĐỊNH',
                    cargoType: 'Viên nén', vehiclePlate: '50H2', carrierName: 'NN', grossWeight: 50, tareWeight: 10, netWeight: 40
                }
            ]);

            await WarehouseInventoryService.clearWarehouseTickets('DIRECT_KHO4');
            const remaining = await WarehouseInventoryService.getAllTickets();
            expect(remaining).toHaveLength(1);
            expect(remaining[0]?.id).toBe('DIR_GBD');
        });
    });
});

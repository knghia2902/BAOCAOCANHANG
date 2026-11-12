import { describe, it, expect } from 'vitest';
import { SettlementExcelExporter } from '../SettlementExcelExporter';
import {
    DEFAULT_GREEN_WOOD_CONTRACT,
    computeSettlementSummary
} from '@/services/settlement/BargeDemurrageService';
import type { SettlementTicketFlows } from '@/types/settlement';

describe('SettlementExcelExporter', () => {
    function buildMockSummary() {
        return computeSettlementSummary({
            vesselName: 'EPOCH WIND',
            contract: DEFAULT_GREEN_WOOD_CONTRACT,
            fuelTierId: 'tier_3', // 25,001 - 30,000
            dailyFuelPrices: [
                { date: '2026-10-19', price: 28800 },
                { date: '2026-10-20', price: 28800 },
                { date: '2026-10-21', price: 28800 },
                { date: '2026-10-22', price: 29250 },
                { date: '2026-10-23', price: 29250 },
                { date: '2026-10-24', price: 29250 },
                { date: '2026-10-25', price: 29250 },
                { date: '2026-10-26', price: 29250 },
                { date: '2026-10-27', price: 29250 },
                { date: '2026-10-28', price: 29250 },
                { date: '2026-10-29', price: 30240 },
                { date: '2026-10-30', price: 30240 }
            ],
            barges: [
                {
                    bargeId: 1,
                    bargeName: 'CT 10487',
                    arrivalTime: '2026-10-18T11:30',
                    departureTime: '2026-10-28T10:30',
                    dischargedTons: 1016.36,
                    area: 'Nguyên Ngọc'
                },
                {
                    bargeId: 2,
                    bargeName: 'SG 8282',
                    arrivalTime: '2026-10-21T16:30',
                    departureTime: '2026-10-28T13:30',
                    dischargedTons: 1495.52,
                    area: 'Nguyên Ngọc'
                }
            ],
            totalExportWarehouseTons: 8181.13,
            totalDirectBargeTons: 2319.49,
            totalCustomsTons: 10500.62,
            truckingDetails: [
                { serviceId: 'truck_binh_phuoc', quantityTons: 61.2 },
                { serviceId: 'truck_tan_hiep', quantityTons: 172.5 },
                { serviceId: 'truck_tan_khanh', quantityTons: 35.8 }
            ]
        });
    }

    function buildMockFlows(): SettlementTicketFlows {
        return {
            exportWarehouseTickets: [
                {
                    dateOut: '2026-10-20 08:30',
                    ticketNo: 'XK-001',
                    plateNumber: '51C-12345',
                    bargeName: 'CT 10487',
                    yard: 'KHO 4',
                    weight1: 42000,
                    weight2: 14000,
                    weightNet: 28000,
                    note: 'Xuất kho ra sà lan'
                }
            ],
            directBargeTickets: [
                {
                    dateOut: '2026-10-21 10:00',
                    ticketNo: 'SL-002',
                    plateNumber: '61C-67890',
                    bargeName: 'SG 8282',
                    yard: 'XE SANG SÀ LAN',
                    weight1: 45000,
                    weight2: 15000,
                    weightNet: 30000,
                    note: 'Xe sang sà lan trực tiếp'
                }
            ],
            truckRoadTickets: [
                {
                    dateOut: '2026-10-19 07:00',
                    ticketNo: 'TR-003',
                    plateNumber: '93C-11223',
                    warehouseName: 'Green Wood Bình Phước',
                    area: 'Đồng Xoài - Bình Phước',
                    weightNet: 30600,
                    unitPrice: 147200
                }
            ]
        };
    }

    it('should build a workbook with exact 8 sheets in port settlement order', () => {
        const summary = buildMockSummary();
        const flows = buildMockFlows();
        const workbook = SettlementExcelExporter.buildSettlementWorkbook(summary, flows);

        const sheetNames = workbook.worksheets.map(ws => ws.name);
        expect(sheetNames).toEqual([
            'DNTT 1',
            'Giá dầu',
            'BK SALAN',
            'EXPORT XUẤT KHO',
            'WL XUẤT SALAN',
            'LƯU SÀ LAN',
            'DNTT 2',
            'TRUCK '
        ]);
    });

    it('should preserve live formulas in DNTT 1, Giá dầu, LƯU SÀ LAN, and Weightlists', () => {
        const summary = buildMockSummary();
        const flows = buildMockFlows();
        const workbook = SettlementExcelExporter.buildSettlementWorkbook(summary, flows);

        // 1. Check DNTT 1 formulas & cross-sheet demurrage link
        const dntt1 = workbook.getWorksheet('DNTT 1')!;
        let hasSumFormula = false;
        let hasDemurrageRef = false;
        dntt1.eachRow(row => {
            row.eachCell(cell => {
                const v = cell.value as any;
                if (v && typeof v === 'object' && v.formula) {
                    if (String(v.formula).startsWith('SUM(')) hasSumFormula = true;
                    if (String(v.formula).includes("'LƯU SÀ LAN'!K")) hasDemurrageRef = true;
                }
            });
        });
        expect(hasSumFormula).toBe(true);
        expect(hasDemurrageRef).toBe(true);

        // 2. Check LƯU SÀ LAN rounding formula and amount calculation
        const demurrageSheet = workbook.getWorksheet('LƯU SÀ LAN')!;
        const row5 = demurrageSheet.getRow(5); // First barge: CT 10487
        const roundedDaysFormula = (row5.getCell(9).value as any).formula;
        expect(roundedDaysFormula).toContain('IF(H5>0,INT(H5)');
        expect((row5.getCell(11).value as any).result).toBe(9147240);

        // Total row at row 7 (5 + 2 barges)
        const totalRow = demurrageSheet.getRow(7);
        expect((totalRow.getCell(11).value as any).formula).toBe('SUM(K5:K6)');
        expect((totalRow.getCell(11).value as any).result).toBe(9147240);

        // 3. Check Giá dầu AVERAGE formula
        const fuelSheet = workbook.getWorksheet('Giá dầu')!;
        let hasAverageFormula = false;
        fuelSheet.eachRow(row => {
            const v = row.getCell(3).value as any;
            if (v && typeof v === 'object' && String(v.formula).includes('AVERAGE(')) {
                hasAverageFormula = true;
                expect(v.result).toBe(29303);
            }
        });
        expect(hasAverageFormula).toBe(true);

        // 4. Check Weightlists SUBTOTAL formula
        const exportSheet = workbook.getWorksheet('EXPORT XUẤT KHO')!;
        let hasSubtotal = false;
        exportSheet.eachRow(row => {
            const v = row.getCell(9).value as any;
            if (v && typeof v === 'object' && String(v.formula).includes('SUBTOTAL(9,')) {
                hasSubtotal = true;
                expect(v.result).toBe(28000);
            }
        });
        expect(hasSubtotal).toBe(true);
    });

    it('should serialize cleanly to a valid xlsx buffer', async () => {
        const summary = buildMockSummary();
        const workbook = SettlementExcelExporter.buildSettlementWorkbook(summary);
        const buffer = await workbook.xlsx.writeBuffer();
        expect(buffer.byteLength).toBeGreaterThan(5000);
    });
});

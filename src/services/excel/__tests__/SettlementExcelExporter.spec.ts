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

    describe('buildVesselShipmentThreeSheetWorkbook', () => {
        const mockVessel = {
            id: 1,
            name: 'EVER VANTAGE',
            dischargePort: 'NHA BE',
            customerCode: 'EW',
            cargoName: 'WOOD PELLETS IN BULK',
            billOfLading: 'BL-EV-001',
            dateStart: '2026-11-06T08:00:00Z',
            dateEnd: '2026-11-12T18:00:00Z'
        };

        const mockBarges = [
            {
                id: 101,
                name: 'VL 9999',
                portOfLoading: 'NGUYÊN NGỌC',
                dateStart: '2026-11-08T09:00:00Z',
                dateEnd: '2026-11-09T15:00:00Z',
                customsDeclarationWeight: 1200000,
                truckCount: 1,
                totalWeight: 35000,
                config: { orderNo: '175' }
            },
            {
                id: 102,
                name: 'SG 8888',
                portOfLoading: 'NGUYÊN NGỌC',
                dateStart: '2026-11-06T09:00:00Z',
                dateEnd: '2026-11-07T12:00:00Z',
                customsDeclarationWeight: 1500000,
                truckCount: 2,
                totalWeight: 60000,
                config: { orderNo: '174' }
            }
        ];

        const mockTrucks = [
            // Warehouse export ticket
            {
                id: 1,
                ticketNo: 'WH-001',
                licensePlate: '50H-11111',
                bargeName: 'SG 8888',
                warehouse: 'KHO 4',
                flowType: 'EXPORT',
                weightIn: 14000,
                weightOut: 44000,
                weightNet: 30000,
                timeOut: '2026-11-06T10:30:00Z'
            },
            // Direct barge ticket (xá thẳng) with factory weight in note
            {
                id: 2,
                ticketNo: 'DIR-002',
                licensePlate: '50H-22222',
                bargeName: 'SG 8888',
                warehouse: 'XE SANG SÀ LAN',
                flowType: 'DIRECT',
                weightIn: 45000,
                weightOut: 15000,
                weightNet: 30000,
                note: '30050', // Cân nhà máy trong ghi chú
                timeOut: '2026-11-06T14:45:00Z'
            },
            // Warehouse ticket for second barge
            {
                id: 3,
                ticketNo: 'WH-003',
                licensePlate: '50H-33333',
                bargeName: 'VL 9999',
                warehouse: 'KHO 2',
                flowType: 'EXPORT',
                weightIn: 13000,
                weightOut: 48000,
                weightNet: 35000,
                timeOut: '2026-11-08T11:00:00Z'
            }
        ];

        it('should build exactly 3 sheets with exact names and Cambria font', () => {
            const wb = SettlementExcelExporter.buildVesselShipmentThreeSheetWorkbook(
                mockVessel,
                mockBarges,
                mockTrucks
            );

            expect(wb.worksheets.map(w => w.name)).toEqual([
                'BK SALAN',
                'XUẤT KHO',
                'XÁ THẲNG'
            ]);
        });

        it('should partition tickets accurately into warehouse and direct sheets', () => {
            const wb = SettlementExcelExporter.buildVesselShipmentThreeSheetWorkbook(
                mockVessel,
                mockBarges,
                mockTrucks
            );

            const wsWarehouse = wb.getWorksheet('XUẤT KHO')!;
            const wsDirect = wb.getWorksheet('XÁ THẲNG')!;

            // Check warehouse sheet has tickets WH-001 and WH-003
            const whTicketNos: string[] = [];
            wsWarehouse.eachRow(row => {
                const val = row.getCell(3).value; // Column C: Số phiếu
                if (val && typeof val === 'string' && val.startsWith('WH-')) {
                    whTicketNos.push(val);
                }
            });
            expect(whTicketNos).toEqual(['WH-001', 'WH-003']);

            // Check direct sheet has ticket DIR-002
            const dirTicketNos: string[] = [];
            wsDirect.eachRow(row => {
                const val = row.getCell(3).value; // Column C: Số phiếu
                if (val && typeof val === 'string' && val.startsWith('DIR-')) {
                    dirTicketNos.push(val);
                }
            });
            expect(dirTicketNos).toEqual(['DIR-002']);
        });

        it('should sort barges by orderNo ascending and set Day from dateStart in BK SALAN', () => {
            const wb = SettlementExcelExporter.buildVesselShipmentThreeSheetWorkbook(
                mockVessel,
                mockBarges,
                mockTrucks
            );

            const wsBk = wb.getWorksheet('BK SALAN')!;
            // Row 14 should be SG 8888 (order 174), Row 15 should be VL 9999 (order 175)
            expect(wsBk.getCell('C14').value).toBe('SG 8888');
            expect(wsBk.getCell('G14').value).toBe('06/11/2026'); // dateStart of SG 8888
            expect(wsBk.getCell('C15').value).toBe('VL 9999');
            expect(wsBk.getCell('G15').value).toBe('08/11/2026'); // dateStart of VL 9999
        });

        it('should link vessel info cross-sheet via formula and calculate factory difference', () => {
            const wb = SettlementExcelExporter.buildVesselShipmentThreeSheetWorkbook(
                mockVessel,
                mockBarges,
                mockTrucks
            );

            const wsWarehouse = wb.getWorksheet('XUẤT KHO')!;
            const wsDirect = wb.getWorksheet('XÁ THẲNG')!;

            // Check cross-sheet reference to BK SALAN
            expect((wsWarehouse.getCell('D14').value as any)?.formula).toBe("'BK SALAN'!D9");
            expect((wsDirect.getCell('D13').value as any)?.formula).toBe("'BK SALAN'!D9");

            // Check XÁ THẲNG headers: column 13 must be Salan
            expect(wsDirect.getRow(17).getCell(13).value).toBe('Salan');

            // Check factory weight parsed from note and placed in Column J (Cân Nhà Máy)
            const row18 = wsDirect.getRow(18);
            expect(row18.getCell(10).value).toBe(30050); // Cân nhà máy
            expect(row18.getCell(13).value).toBe('SG 8888'); // Salan column has barge name

            // Check difference formula in direct sheet (=G{r}-J{r})
            let foundDiffFormula = false;
            wsDirect.eachRow(row => {
                const cellK = row.getCell(11); // Column K: Chênh lệch
                const val = cellK.value as any;
                if (val && typeof val === 'object' && val.formula && val.formula.includes('-J')) {
                    foundDiffFormula = true;
                    expect(val.formula).toMatch(/^=?G\d+-J\d+$/);
                }
            });
            expect(foundDiffFormula).toBe(true);
        });

        it('should serialize 3-sheet workbook cleanly to buffer > 5000 bytes', async () => {
            const wb = SettlementExcelExporter.buildVesselShipmentThreeSheetWorkbook(
                mockVessel,
                mockBarges,
                mockTrucks
            );
            const buffer = await wb.xlsx.writeBuffer();
            expect(buffer.byteLength).toBeGreaterThan(5000);
        });

        it('should format filename as BAO_CAO_LO_HANG_[TEN_TAU]_[NGAY].xlsx', async () => {
            const pad = (n: number) => String(n).padStart(2, '0');
            const now = new Date();
            const dateStr = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`;
            const expectedFilename = `BAO_CAO_LO_HANG_EVER_VANTAGE_${dateStr}.xlsx`;

            // Spy on downloadSettlementExcel
            let downloadedFilename = '';
            const origDownload = SettlementExcelExporter.downloadSettlementExcel;
            SettlementExcelExporter.downloadSettlementExcel = async (_wb, name) => {
                downloadedFilename = name;
            };

            try {
                const fname = await SettlementExcelExporter.exportVesselShipmentThreeSheetReport(
                    mockVessel,
                    mockBarges,
                    mockTrucks
                );
                expect(fname).toBe(expectedFilename);
                expect(downloadedFilename).toBe(expectedFilename);
            } finally {
                SettlementExcelExporter.downloadSettlementExcel = origDownload;
            }
        });
    });
});

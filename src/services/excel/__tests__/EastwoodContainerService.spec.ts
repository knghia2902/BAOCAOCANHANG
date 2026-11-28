import { describe, it, expect } from 'vitest';
import {
    extractContainerNumbers,
    detectBoardType,
    classifyEastwoodContainerRow,
    computeContainerStatuses,
    computeContainerDailyReport,
    parseContainerListFromText,
    buildBaselineContainerEvents,
    isBaselineContainerEvent
} from '../EastwoodContainerService';
import {
    classifyWeighbridgeRow,
    parseWeighbridgeCsvText,
    type RawWeighbridgeRow
} from '../WarehouseInventoryService';

const makeRow = (overrides: Partial<RawWeighbridgeRow>): RawWeighbridgeRow => ({
    soPhieu: '019094/26',
    maLenh: '',
    soXe: '61H 08373',
    khachHang: 'CÔNG TY EASTWOOD',
    kl1: 61320,
    kl2: 20170,
    klHang: 41150,
    ngay1: '27/11/2026',
    gio1: '7:34:12',
    ngay2: '27/11/2026',
    gio2: '7:47:20',
    xuatNhap: 'Nhap',
    loaiHang: 'Viên Nén Gỗ (FSC Mix 1%)',
    loaiSalan: '4 - Hạ Cont- Không Ván',
    taiXe: 'CT03',
    ghiChu: 'WHLU2904564/TTLU2975023',
    ...overrides
});

describe('EastwoodContainerService', () => {
    it('extracts single and multiple ISO container numbers from note', () => {
        expect(extractContainerNumbers('WHLU2904564/TTLU2975023')).toEqual(['WHLU2904564', 'TTLU2975023']);
        expect(extractContainerNumbers('  whlu 2945985  ')).toEqual(['WHLU2945985']);
        expect(extractContainerNumbers('38170')).toEqual([]);
    });

    it('detects board type (Có ván / Không ván)', () => {
        expect(detectBoardType('4 - Hạ Cont- Không Ván')).toBe('Không ván');
        expect(detectBoardType('KHÔNG VÁN')).toBe('Không ván');
        expect(detectBoardType('VÁN')).toBe('Có ván');
        expect(detectBoardType('CÓ VÁN')).toBe('Có ván');
        expect(detectBoardType('CT03')).toBe('');
    });

    it('splits dual-container HẠ CONT ticket into 2 events with summed weight intact', () => {
        const events = classifyEastwoodContainerRow(makeRow({}));
        expect(events).toHaveLength(2);
        expect(events[0]!.flowType).toBe('HA_CONT');
        expect(events[0]!.containerNo).toBe('WHLU2904564');
        expect(events[1]!.containerNo).toBe('TTLU2975023');
        expect(events[0]!.boardType).toBe('Không ván');
        expect(events[0]!.netWeightKg + events[1]!.netWeightKg).toBe(41150);
        expect(events[0]!.actualDate).toBe('2026-11-27');
        expect(events[0]!.reportDate).toBe('2026-11-27');
    });

    it('classifies LẤY CONT RỖNG even with 0 kg or 10 kg scale noise', () => {
        const zeroEvents = classifyEastwoodContainerRow(
            makeRow({
                soPhieu: '019096/26',
                kl1: 20170,
                kl2: 20170,
                klHang: 0,
                xuatNhap: 'Xuat',
                loaiSalan: 'LẤY CONT RỖNG',
                taiXe: '',
                ghiChu: 'OOLU2904703/WHLU2791196'
            })
        );
        expect(zeroEvents).toHaveLength(2);
        expect(zeroEvents[0]!.flowType).toBe('TRA_CONT');
        expect(zeroEvents[0]!.netWeightKg).toBe(0);

        const noiseEvents = classifyEastwoodContainerRow(
            makeRow({
                soPhieu: '019112/26',
                kl1: 20600,
                kl2: 20590,
                klHang: 10,
                xuatNhap: 'Xuat',
                loaiSalan: 'LẤY CONT RỖNG',
                taiXe: '',
                ghiChu: 'CBHU5778748/WHLU2649366'
            })
        );
        expect(noiseEvents).toHaveLength(2);
        expect(noiseEvents[0]!.flowType).toBe('TRA_CONT');
    });

    it('classifies LOAD CONT and applies 06:00 AM shift cutoff for reportDate while keeping actualDate', () => {
        const events = classifyEastwoodContainerRow(
            makeRow({
                soPhieu: '010114/26',
                maLenh: '18',
                soXe: '61C 23903',
                kl1: 38610,
                kl2: 17760,
                klHang: 20850,
                ngay1: '11/07/2026',
                gio1: '04:28:56',
                ngay2: '11/07/2026',
                gio2: '05:04:37',
                xuatNhap: 'Xuat',
                loaiSalan: '2 - TG 15292 - LXH Số:2026NX/T03/NN',
                taiXe: 'KHÔNG VÁN',
                ghiChu: 'WHLU2945985'
            })
        );
        expect(events).toHaveLength(1);
        expect(events[0]!.flowType).toBe('LOAD_CONT');
        expect(events[0]!.containerNo).toBe('WHLU2945985');
        expect(events[0]!.boardType).toBe('Không ván');
        expect(events[0]!.actualDate).toBe('2026-07-11');
        expect(events[0]!.reportDate).toBe('2026-07-10'); // 05:04 < 06:00 -> previous shift day
        expect(events[0]!.eventDatetime).toBe('2026-07-11T05:04:37');
    });

    it('ignores non-Eastwood customers completely', () => {
        const events = classifyEastwoodContainerRow(
            makeRow({ khachHang: 'CÔNG TY GỖ BÌNH ĐỊNH' })
        );
        expect(events).toHaveLength(0);
    });

    it('excludes Eastwood container tickets from WarehouseInventoryService classifyWeighbridgeRow while keeping normal Kho 4 & Direct', () => {
        const haWh = classifyWeighbridgeRow(makeRow({}));
        expect(haWh).toBeNull();

        const loadWh = classifyWeighbridgeRow(
            makeRow({
                xuatNhap: 'Xuat',
                loaiSalan: '2 - TG 15292',
                taiXe: 'KHÔNG VÁN',
                ghiChu: 'WHLU2945985'
            })
        );
        expect(loadWh).toBeNull();

        const traNoiseWh = classifyWeighbridgeRow(
            makeRow({
                kl1: 20600,
                kl2: 20590,
                klHang: 10,
                xuatNhap: 'Xuat',
                loaiSalan: 'LẤY CONT RỖNG',
                taiXe: '',
                ghiChu: 'CBHU5778748/WHLU2649366'
            })
        );
        expect(traNoiseWh).toBeNull();

        // Normal Eastwood Kho 4 import still works
        const normalKho4 = classifyWeighbridgeRow(
            makeRow({
                loaiSalan: 'KHO 4',
                taiXe: 'CT07',
                ghiChu: '39920'
            })
        );
        expect(normalKho4?.flowType).toBe('IMPORT');
        expect(normalKho4?.warehouseId).toBe('KHO 4');

        // Normal Eastwood direct export still works
        const normalDirect = classifyWeighbridgeRow(
            makeRow({
                xuatNhap: 'Xuat',
                loaiSalan: '2 - TG 15292',
                taiXe: 'CT02',
                ghiChu: '38170'
            })
        );
        expect(normalDirect?.flowType).toBe('DIRECT');
    });

    it('computes TRẠNG THÁI by actual datetime and REPORT by shift reportDate', () => {
        const ha = classifyEastwoodContainerRow(
            makeRow({
                soPhieu: 'P1',
                ngay1: '27/11/2026',
                gio1: '07:00:00',
                ngay2: '27/11/2026',
                gio2: '07:30:00',
                ghiChu: 'WHLU2904564'
            })
        );
        const loadAfterMidnight = classifyEastwoodContainerRow(
            makeRow({
                soPhieu: 'P2',
                xuatNhap: 'Xuat',
                loaiSalan: '2 - TG 15292',
                taiXe: 'VÁN',
                ghiChu: 'WHLU2904564',
                ngay1: '28/11/2026',
                gio1: '02:00:00',
                ngay2: '28/11/2026',
                gio2: '02:30:00',
                kl1: 38000,
                kl2: 17000,
                klHang: 21000
            })
        );

        const all = [...ha, ...loadAfterMidnight];

        // TRẠNG THÁI uses actual datetime (2026-11-28T02:30:00 > 2026-11-27T07:30:00)
        const statuses = computeContainerStatuses(all);
        expect(statuses.summary.emptyCount).toBe(1);
        expect(statuses.summary.loadedCount).toBe(0);
        expect(statuses.rows[0]!.status).toBe('EMPTY_YARD');
        expect(statuses.rows[0]!.latestLoadContDatetime).toBe('2026-11-28T02:30:00');
        expect(statuses.rows[0]!.latestBoardType).toBe('Có ván');

        // REPORT groups both under shift date 2026-11-27 (because 02:30 < 06:00)
        const report = computeContainerDailyReport(all);
        expect(report.rows).toHaveLength(1);
        expect(report.rows[0]!.reportDate).toBe('2026-11-27');
        expect(report.rows[0]!.containerIn).toBe(1);
        expect(report.rows[0]!.containerLoad).toBe(1);
        expect(report.rows[0]!.loadWeightKg).toBe(21000);
    });

    it('parses 1-column CSV/text container list with header, duplicates, and whitespace', () => {
        const csv = [
            'ContainerNo.',
            'WHLU2904564',
            '  oolu 1218606  ',
            'WHLU2904564',
            '',
            'INVALID_HEADER',
            'CBHU5778748'
        ].join('\n');

        const res = parseContainerListFromText(csv);
        expect(res.containers).toEqual(['WHLU2904564', 'OOLU1218606', 'CBHU5778748']);
        expect(res.duplicateCount).toBe(1);
        expect(res.ignoredCount).toBe(2);
    });

    it('tracks baseline EMPTY_YARD & RETURNED containers in TRẠNG THÁI without polluting REPORT, and transitions cleanly from 26/11/2026', () => {
        const baselineEmpty = buildBaselineContainerEvents(
            ['WHLU2904564', 'OOLU1218606'],
            'EMPTY_YARD',
            '2026-11-25'
        );
        const baselineReturned = buildBaselineContainerEvents(
            ['CBHU5778748'],
            'RETURNED',
            '2026-11-25'
        );

        expect(baselineEmpty.every(isBaselineContainerEvent)).toBe(true);
        expect(baselineReturned.every(isBaselineContainerEvent)).toBe(true);

        // Before 26/11/2026 weighbridge tickets: TRẠNG THÁI shows 2 empty + 1 returned, zero warnings, REPORT is empty
        const initialStatuses = computeContainerStatuses([...baselineEmpty, ...baselineReturned]);
        expect(initialStatuses.summary).toEqual({
            loadedCount: 0,
            emptyCount: 2,
            returnedCount: 1,
            totalTracked: 3
        });
        expect(initialStatuses.rows.every(r => !r.hasWarning)).toBe(true);
        expect(computeContainerDailyReport([...baselineEmpty, ...baselineReturned]).rows).toHaveLength(0);

        // On 26/11/2026: 1 empty cont is returned (TRA_CONT), 1 previously returned cont comes back loaded (HA_CONT)
        const traOn26 = classifyEastwoodContainerRow(
            makeRow({
                soPhieu: '019200/26',
                kl1: 20100,
                kl2: 20100,
                klHang: 0,
                ngay1: '26/11/2026',
                gio1: '08:00:00',
                ngay2: '26/11/2026',
                gio2: '08:05:00',
                xuatNhap: 'Xuat',
                loaiSalan: 'LẤY CONT RỖNG',
                taiXe: '',
                ghiChu: 'WHLU2904564'
            })
        );
        const haOn26 = classifyEastwoodContainerRow(
            makeRow({
                soPhieu: '019201/26',
                kl1: 41000,
                kl2: 20000,
                klHang: 21000,
                ngay1: '26/11/2026',
                gio1: '09:00:00',
                ngay2: '26/11/2026',
                gio2: '09:15:00',
                xuatNhap: 'Nhap',
                loaiSalan: '4 - Hạ Cont- Không Ván',
                taiXe: 'CT03',
                ghiChu: 'CBHU5778748'
            })
        );

        const combined = [...baselineEmpty, ...baselineReturned, ...traOn26, ...haOn26];
        const nextStatuses = computeContainerStatuses(combined);
        expect(nextStatuses.summary).toEqual({
            loadedCount: 1,   // CBHU5778748 returned to port loaded
            emptyCount: 1,    // OOLU1218606 still empty on yard
            returnedCount: 1, // WHLU2904564 returned on 26/11
            totalTracked: 3
        });

        // REPORT only reflects 26/11/2026 real activity (1 IN, 1 OUT)
        const nextReport = computeContainerDailyReport(combined);
        expect(nextReport.rows).toHaveLength(1);
        expect(nextReport.rows[0]!.reportDate).toBe('2026-11-26');
        expect(nextReport.rows[0]!.containerIn).toBe(1);
        expect(nextReport.rows[0]!.containerOut).toBe(1);
        expect(nextReport.rows[0]!.containerLoad).toBe(0);
    });

    it('parses Scale Head 1 single-date-column format ("Ngay can" without 1/2) for both KHO 4 imports and Eastwood HẠ CONT / LẤY CONT RỖNG', () => {
        const csvText = [
            'So phieu,So xe,Khach hang,KL can lan 1,KL can lan 2,KL hang,Ngay can,Gio can lan 1,Gio can lan 2,Xuat/Nhap,Loai Hang,Loai Salan,Tai Xe,Ghi Chu',
            '019093/26,50H 11173,CÔNG TY EASTWOOD,60170,20070,40100,26/11/2026,7:14:44,7:56:06,Nhap,Viên Nén Gỗ (FSC Mix 1%),KHO 4,CT07,39920',
            '019094/26,61H 08373,CÔNG TY EASTWOOD,61320,20170,41150,26/11/2026,7:34:12,7:47:20,Nhap,Viên Nén Gỗ (FSC Mix 1%),4 - Hạ Cont- Không Ván,CT03,WHLU2904564/TTLU2975023',
            '019096/26,61H 08373,CÔNG TY EASTWOOD,20170,20170,0,26/11/2026,7:48:40,7:48:49,Xuat,Viên Nén Gỗ (FSC Mix 1%),LẤY CONT RỖNG,,OOLU2904703/WHLU2791196'
        ].join('\n');

        const parsedRows = parseWeighbridgeCsvText(csvText);
        expect(parsedRows).toHaveLength(3);
        expect(parsedRows[0]!.ngay1).toBe('26/11/2026');
        expect(parsedRows[0]!.ngay2).toBe('26/11/2026');

        // Row 1 -> WarehouseInventory KHO 4 IMPORT
        const wh0 = classifyWeighbridgeRow(parsedRows[0]!);
        expect(wh0?.flowType).toBe('IMPORT');
        expect(wh0?.warehouseId).toBe('KHO 4');
        expect(wh0?.reportDate).toBe('2026-11-26');

        // Row 2 -> 2 HA_CONT events
        const contHa = classifyEastwoodContainerRow(parsedRows[1]!);
        expect(contHa).toHaveLength(2);
        expect(contHa[0]!.flowType).toBe('HA_CONT');
        expect(contHa[0]!.actualDate).toBe('2026-11-26');

        // Row 3 -> 2 TRA_CONT events
        const contTra = classifyEastwoodContainerRow(parsedRows[2]!);
        expect(contTra).toHaveLength(2);
        expect(contTra[0]!.flowType).toBe('TRA_CONT');
        expect(contTra[0]!.actualDate).toBe('2026-11-26');
    });
});

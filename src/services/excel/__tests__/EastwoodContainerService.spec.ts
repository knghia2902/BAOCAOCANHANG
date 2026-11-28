import { describe, it, expect } from 'vitest';
import {
    extractContainerNumbers,
    detectBoardType,
    classifyEastwoodContainerRow,
    computeContainerStatuses,
    computeContainerDailyReport
} from '../EastwoodContainerService';
import {
    classifyWeighbridgeRow,
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
});

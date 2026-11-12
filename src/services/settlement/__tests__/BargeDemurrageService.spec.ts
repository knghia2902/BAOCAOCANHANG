import { describe, it, expect } from 'vitest';
import {
    calculateBargeDemurrage,
    calculateAverageFuelPrice,
    resolveFuelTier,
    computeSettlementSummary,
    DEFAULT_FUEL_TIERS
} from '../BargeDemurrageService';
import { numberToVietnameseWords, numberToEnglishWords } from '../numberToWords';

describe('BargeDemurrageService & NumberToWords (EPOCH WIND Benchmark)', () => {
    describe('numberToWords', () => {
        it('converts amounts to standard financial Vietnamese words', () => {
            const v1 = numberToVietnameseWords(9879019);
            expect(v1).toContain('Chín triệu tám trăm bảy mươi chín nghìn');
            expect(v1).toContain('đồng chẵn.');

            const v2 = numberToVietnameseWords(1839679691);
            expect(v2).toContain('Một tỷ tám trăm ba mươi chín triệu sáu trăm bảy mươi chín nghìn sáu trăm chín mươi mốt đồng chẵn.');
        });

        it('converts amounts to standard international English words', () => {
            const e1 = numberToEnglishWords(9879019);
            expect(e1).toContain('Nine million');
            expect(e1).toContain('Dong.');

            const e2 = numberToEnglishWords(1839679691);
            expect(e2).toContain('One billion');
            expect(e2).toContain('eight hundred thirty-nine million');
            expect(e2).toContain('Dong.');
        });
    });

    describe('calculateBargeDemurrage - Sheet LƯU SÀ LAN', () => {
        it('calculates CT 10487 matching Excel sample: 10 days, 3 excess days, 9,147,240 VND', () => {
            // Arrival: 2026-10-19 07:53:00, Departure: 2026-10-29 08:15:00
            const res = calculateBargeDemurrage(
                '2026-10-19T07:53:00',
                '2026-10-29T08:15:00',
                1016.36,
                7,
                3000
            );

            expect(res.totalDays).toBe(10);
            expect(res.excessDaysRaw).toBe(3);
            expect(res.excessDaysRounded).toBe(3);
            expect(res.amount).toBe(9147240);
        });

        it('calculates SG 8282 within free days (6.9 days < 7) resulting in 0 excess days and 0 amount', () => {
            // Arrival: 2026-10-22 14:23:00, Departure: 2026-10-29 12:00:00
            const res = calculateBargeDemurrage(
                '2026-10-22T14:23:00',
                '2026-10-29T12:00:00',
                1485.94,
                7,
                3000
            );

            expect(res.totalDays).toBe(6.9);
            expect(res.excessDaysRaw).toBe(-0.1);
            expect(res.excessDaysRounded).toBe(0);
            expect(res.amount).toBe(0);
        });

        it('rounds 0.3 excess days to 0.5 days', () => {
            // Excess = 7.3 - 7 = 0.3 -> rounded = 0.5
            const res = calculateBargeDemurrage(
                '2026-10-19T00:00:00',
                '2026-10-26T07:12:00', // 7.3 days
                1000,
                7,
                3000
            );
            expect(res.totalDays).toBe(7.3);
            expect(res.excessDaysRounded).toBe(0.5);
            expect(res.amount).toBe(0.5 * 3000 * 1000);
        });

        it('rounds 0.7 excess days to 1.0 day', () => {
            // Excess = 7.7 - 7 = 0.7 -> rounded = 1.0
            const res = calculateBargeDemurrage(
                '2026-10-19T00:00:00',
                '2026-10-26T16:48:00', // 7.7 days
                1000,
                7,
                3000
            );
            expect(res.totalDays).toBe(7.7);
            expect(res.excessDaysRounded).toBe(1.0);
            expect(res.amount).toBe(1.0 * 3000 * 1000);
        });
    });

    describe('Fuel Price & Contract Tiers', () => {
        it('calculates average fuel price and resolves tier 25,001 - 30,000 for EPOCH WIND', () => {
            const prices = [
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
            ];

            const avg = calculateAverageFuelPrice(prices);
            expect(avg).toBe(29303);

            const tier = resolveFuelTier(avg, DEFAULT_FUEL_TIERS);
            expect(tier.label).toBe('25,001 - 30,000');
            expect(tier.id).toBe('tier_3');
        });
    });

    describe('computeSettlementSummary (Full Pipeline)', () => {
        it('matches DNTT 1 unit prices and demurrage amount for EPOCH WIND', () => {
            const summary = computeSettlementSummary({
                vesselName: 'EPOCH WIND',
                totalExportWarehouseTons: 8181.13,
                totalDirectBargeTons: 2319.49,
                totalCustomsTons: 10490.0,
                barges: [
                    {
                        bargeId: 1,
                        bargeName: 'CT 10487',
                        arrivalTime: '2026-10-19T07:53:00',
                        departureTime: '2026-10-29T08:15:00',
                        dischargedTons: 1016.36
                    },
                    {
                        bargeId: 2,
                        bargeName: 'SG 8282',
                        arrivalTime: '2026-10-22T14:23:00',
                        departureTime: '2026-10-29T12:00:00',
                        dischargedTons: 1485.94
                    }
                ]
            });

            expect(summary.fuelTier.label).toBe('25,001 - 30,000');

            // Item 1: Xuất kho Nhà Bè -> 181,000 VND/tấn
            const item1 = summary.itemsDntt1.find(i => i.serviceName.includes('LƯU KHO Nguyên Ngọc'));
            expect(item1?.unitPrice).toBe(181000);
            expect(item1?.quantity).toBe(8181.13);
            expect(item1?.amount).toBe(Math.round(8181.13 * 181000));

            // Item 2: Xe sang sà lan Nhà Bè -> 136,000 VND/tấn
            const item2 = summary.itemsDntt1.find(i => i.serviceName.includes('KHÔNG lưu kho'));
            expect(item2?.unitPrice).toBe(136000);
            expect(item2?.quantity).toBe(2319.49);

            // Item 3: Hải quan -> 3,500 VND/tấn
            const item3 = summary.itemsDntt1.find(i => i.serviceName.includes('hải quan'));
            expect(item3?.unitPrice).toBe(3500);

            // Item 4: Phí lưu phương tiện = 9,147,240 VND
            const item4 = summary.itemsDntt1.find(i => i.serviceName.includes('lưu phương tiện'));
            expect(item4?.amount).toBe(9147240);

            // VAT 8%
            expect(summary.vatRate).toBe(0.08);
            expect(summary.totalAmountDntt1).toBe(summary.subTotalDntt1 + summary.vatAmountDntt1);
            expect(summary.amountInWordsViDntt1).toBeTruthy();
            expect(summary.amountInWordsEnDntt1).toBeTruthy();
        });
    });
});

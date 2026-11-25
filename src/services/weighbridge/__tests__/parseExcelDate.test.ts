import { describe, it, expect } from 'vitest';
import { WeighbridgeOtherService } from '../WeighbridgeOtherService';

describe('WeighbridgeOtherService.parseExcelDate & Date Disambiguation', () => {
    const service = new WeighbridgeOtherService();

    it('parses Vietnamese DD/MM/YYYY HH:mm when day <= 12 without inverting to MM/DD/YYYY', () => {
        expect(service.parseExcelDate('12/07/2026 08:04')).toBe('2026-07-12T08:04');
        expect(service.parseExcelDate('12/07/2026', '09:51')).toBe('2026-07-12T09:51');
        expect(service.parseExcelDate('05/07/2026 14:30')).toBe('2026-07-05T14:30');
    });

    it('parses Vietnamese DD/MM/YYYY HH:mm when day > 12', () => {
        expect(service.parseExcelDate('13/07/2026 23:01')).toBe('2026-07-13T23:01');
        expect(service.parseExcelDate('25/07/2026 10:15')).toBe('2026-07-25T10:15');
    });

    it('auto-swaps unambiguous US MM/DD/YYYY when second part > 12', () => {
        expect(service.parseExcelDate('07/13/2026 23:01')).toBe('2026-07-13T23:01');
        expect(service.parseExcelDate('7/25/2026 08:04')).toBe('2026-07-25T08:04');
    });

    it('disambiguates ambiguous dates using ticket month hint (expectedMonth = 7 from 0000566/0726)', () => {
        const ticketNo = '0000566/0726';
        const match = ticketNo.match(/\/(\d{2})(\d{2})$/);
        const expectedMonth = match && match[1] ? parseInt(match[1], 10) : undefined;
        expect(expectedMonth).toBe(7);

        // US formatted string "07/12/2026 08:04" (month=7, day=12) with expectedMonth=7
        expect(service.parseExcelDate('07/12/2026 08:04', undefined, expectedMonth)).toBe('2026-07-12T08:04');
        expect(service.parseExcelDate('7/12/2026 09:51', undefined, expectedMonth)).toBe('2026-07-12T09:51');

        // VN formatted string "12/07/2026 08:04" (day=12, month=7) with expectedMonth=7
        expect(service.parseExcelDate('12/07/2026 08:04', undefined, expectedMonth)).toBe('2026-07-12T08:04');

        // US-locale Excel Date object where typed "12/07/2026 08:04" became Dec 7, 2026 (UTC)
        const usExcelUtcDate = new Date(Date.UTC(2026, 11, 7, 8, 4));
        expect(service.parseExcelDate(usExcelUtcDate, undefined, expectedMonth)).toBe('2026-07-12T08:04');

        // Also check local Date(2026, 11, 7, 8, 4) disambiguation logic (used in WeighbridgePrinter.vue)
        const localDate = new Date(2026, 11, 7, 8, 4);
        let mNum = localDate.getMonth() + 1;
        let dNum = localDate.getDate();
        if (expectedMonth && dNum <= 12 && mNum <= 12 && dNum !== mNum && mNum !== expectedMonth && dNum === expectedMonth) {
            const tmp = mNum;
            mNum = dNum;
            dNum = tmp;
        }
        const formattedLocal = `${localDate.getFullYear()}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}T${String(localDate.getHours()).padStart(2, '0')}:${String(localDate.getMinutes()).padStart(2, '0')}`;
        expect(formattedLocal).toBe('2026-07-12T08:04');
    });
});

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/storage/DBContext', () => ({
    dbContext: {
        get: vi.fn(async () => undefined),
        set: vi.fn(async () => {}),
        delete: vi.fn(async () => {}),
        clear: vi.fn(async () => {})
    }
}));

vi.mock('@/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            upsert: vi.fn().mockReturnThis()
        }))
    }
}));

import {
    normalizeMainPlate,
    normalizeDateTimeMinute,
    isSameScaleTicket,
    deduplicateBargeTrucks
} from '@/services/excel/WeighbridgeService';

describe('WeighbridgeSyncDedup', () => {
    it('identifies the same trip when barge ticketNo was re-numbered while allocator ticket has original ticketNo', () => {
        const bargeTruck = {
            id: 'barge_truck_1',
            ticketNo: '000001/1026', // Auto-regenerated in WeighbridgePrinter
            plateNumber: '61H-16907',
            weight1: 42500,
            weight2: 14500,
            weightNet: 28000,
            dateIn: '2026-10-15T08:12',
            dateOut: '2026-10-15T08:30',
            yard: 'Bãi 1'
        };

        const allocatorTicketNumeric = {
            id: 'alloc_1',
            ticketNo: '105', // Original scale ticket number
            plateNumber: '61H-16907',
            weight1: 42500,
            weight2: 14500,
            weightNet: 28000,
            dateInStr: '15/10/2026',
            timeInStr: '08:12',
            dateOutStr: '15/10/2026',
            timeOutStr: '08:30',
            date1Obj: '2026-10-15T08:12:00',
            date2Obj: '2026-10-15T08:30:00'
        };

        const allocatorTicketSerial = {
            ...allocatorTicketNumeric,
            ticketNo: '010782/26B'
        };

        expect(isSameScaleTicket(bargeTruck, allocatorTicketNumeric)).toBe(true);
        expect(isSameScaleTicket(bargeTruck, allocatorTicketSerial)).toBe(true);
    });

    it('matches plates with/without trailer and timestamps differing only in seconds', () => {
        expect(normalizeMainPlate('61H-169.07/61R-55588')).toBe('61H16907');
        expect(normalizeMainPlate('61H-16907 / 61R55588')).toBe('61H16907');
        expect(normalizeDateTimeMinute('2026-10-15T08:30')).toBe('2026-10-15T08:30');
        expect(normalizeDateTimeMinute('2026-10-15T08:30:45.000Z')).toBe('2026-10-15T08:30');

        const ticketA = {
            ticketNo: '000002/1026',
            plateNumber: '61H-16907',
            weight1: 41200,
            weight2: 13200,
            weightNet: 28000,
            dateIn: '2026-10-15T08:10',
            dateOut: '2026-10-15T08:30'
        };

        const ticketB = {
            ticketNo: '108',
            plateNumber: '61H-169.07/61R-55588',
            weight1: 41200,
            weight2: 13200,
            weightNet: 28000,
            date1Obj: '2026-10-15T08:10:19.000Z',
            date2Obj: '2026-10-15T08:30:45.000Z'
        };

        expect(isSameScaleTicket(ticketA, ticketB)).toBe(true);
    });

    it('distinguishes 2 different trips of the same plate on the same day', () => {
        const trip1 = {
            ticketNo: '000001/1026',
            plateNumber: '61H-16907',
            weight1: 42500,
            weight2: 14500,
            weightNet: 28000,
            dateIn: '2026-10-15T08:12',
            dateOut: '2026-10-15T08:30'
        };

        const trip2DifferentTime = {
            ticketNo: '109',
            plateNumber: '61H-16907',
            weight1: 42500,
            weight2: 14500,
            weightNet: 28000,
            dateIn: '2026-10-15T14:10',
            dateOut: '2026-10-15T14:35'
        };

        const trip3DifferentWeight = {
            ticketNo: '110',
            plateNumber: '61H-16907',
            weight1: 43100,
            weight2: 14500,
            weightNet: 28600,
            dateIn: '2026-10-15T08:12',
            dateOut: '2026-10-15T08:30'
        };

        expect(isSameScaleTicket(trip1, trip2DifferentTime)).toBe(false);
        expect(isSameScaleTicket(trip1, trip3DifferentWeight)).toBe(false);
    });

    it('deduplicates barge trucks, preserves yard and sourceTicketNo, and returns exact removedIds', () => {
        const rawTrucks: Array<Record<string, any>> = [
            {
                id: 'id-first',
                ticketNo: '000001/1026',
                plateNumber: '61H-16907',
                weight1: 42500,
                weight2: 14500,
                weightNet: 28000,
                dateIn: '2026-10-15T08:12',
                dateOut: '2026-10-15T08:30',
                yard: 'Bãi 2'
            },
            {
                id: 'id-dup-1',
                ticketNo: '105',
                plateNumber: '61H-16907/61R-55588',
                weight1: 42500,
                weight2: 14500,
                weightNet: 28000,
                dateIn: '2026-10-15T08:12:15',
                dateOut: '2026-10-15T08:30:40',
                yard: ''
            },
            {
                id: 'id-second',
                ticketNo: '000002/1026',
                plateNumber: '51C-88899',
                weight1: 38000,
                weight2: 13000,
                weightNet: 25000,
                dateIn: '2026-10-15T09:00',
                dateOut: '2026-10-15T09:20',
                yard: 'Bãi 1'
            },
            {
                id: 'id-dup-2',
                ticketNo: '000001/1026',
                plateNumber: '61H-16907',
                weight1: 42500,
                weight2: 14500,
                weightNet: 28000,
                dateIn: '2026-10-15T08:12',
                dateOut: '2026-10-15T08:30',
                yard: ''
            }
        ];

        const { uniqueTrucks, removedIds } = deduplicateBargeTrucks(rawTrucks);

        expect(uniqueTrucks).toHaveLength(2);
        expect(removedIds).toEqual(['id-dup-1', 'id-dup-2']);
        expect(uniqueTrucks[0]!.id).toBe('id-first');
        expect(uniqueTrucks[0]!.yard).toBe('Bãi 2');
        expect(uniqueTrucks[0]!.sourceTicketNo).toBe('105');
        expect(uniqueTrucks[1]!.id).toBe('id-second');
    });
});

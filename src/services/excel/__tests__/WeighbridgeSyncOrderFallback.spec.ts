import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRange = vi.fn();
const mockOrder = vi.fn(() => ({ range: mockRange }));
const mockEq = vi.fn((_col: string, _val: string) => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn((_table: string) => ({ select: mockSelect }));

vi.mock('@/supabase', () => ({
    supabase: {
        from: (table: string) => mockFrom(table)
    }
}));

import { AllocatorService } from '@/services/excel/AllocatorService';

describe('AllocatorService.resolveOrderNoFromActiveBarges', () => {
    const sampleVessels = [
        {
            status: 'in_progress',
            barges: [
                { name: 'SG 8019', order_no: '106', config: { orderNo: '106', locked: true } },
                { name: 'SG 8019', order_no: '151', config: { orderNo: '151', locked: true } },
                { name: 'SG 8019', order_no: '208', config: { orderNo: '208', locked: false } },
                { name: 'AG 26989', order_no: '213', config: { orderNo: '213', locked: false } }
            ]
        },
        {
            status: 'done',
            barges: [
                { name: 'SG 8019', order_no: '92', config: { orderNo: '92', locked: false } },
                { name: 'CT 10487', order_no: '212', config: { orderNo: '212', locked: false } }
            ]
        }
    ];

    it('resolves orderNo uniquely for an active unlocked barge when older voyages are locked or done', () => {
        expect(AllocatorService.resolveOrderNoFromActiveBarges('SG 8019', sampleVessels)).toBe('208');
        expect(AllocatorService.resolveOrderNoFromActiveBarges('sg8019', sampleVessels)).toBe('208');
        expect(AllocatorService.resolveOrderNoFromActiveBarges('1 - SG 8019 - LXH Số:2026/T29/NN', sampleVessels)).toBe('208');
    });

    it('returns empty string for warehouse names or port dust', () => {
        expect(AllocatorService.resolveOrderNoFromActiveBarges('KHO 4', sampleVessels)).toBe('');
        expect(AllocatorService.resolveOrderNoFromActiveBarges('HÀNG BỤI', sampleVessels)).toBe('');
        expect(AllocatorService.resolveOrderNoFromActiveBarges('CẦU CẢNG', sampleVessels)).toBe('');
    });

    it('ignores barges belonging to done vessels or locked barges', () => {
        expect(AllocatorService.resolveOrderNoFromActiveBarges('CT 10487', sampleVessels)).toBe('');
    });

    it('returns empty string when multiple active unlocked barges share the same name with different order numbers', () => {
        const ambiguousVessels = [
            {
                status: 'in_progress',
                barges: [
                    { name: 'SG 8019', config: { orderNo: '208', locked: false } },
                    { name: 'SG 8019', config: { orderNo: '220', locked: false } }
                ]
            }
        ];
        expect(AllocatorService.resolveOrderNoFromActiveBarges('SG 8019', ambiguousVessels)).toBe('');
    });
});

describe('AllocatorService.getTripsByOrderNo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('queries weighbridge_tracking filtered by order_no and maps rows to AllocatorTripItem', async () => {
        mockRange.mockResolvedValueOnce({
            data: [
                {
                    id: 5926,
                    stt: 1,
                    time_str: '01:17:48\n18/11/2026',
                    plate_number: '61E 03479',
                    ticket_no: '018743/26B',
                    source_ticket_no: '018743/26B',
                    cargo_type: 'BẮP',
                    weight_1: 19770,
                    weight_2: 67990,
                    weight_net: 48220,
                    weight_tons: 48.22,
                    direction: 'Nhap',
                    barge_name: 'SG 8019',
                    order_no: '208',
                    customer: 'CÔNG TY TNHH DE HEUS',
                    date1_obj: '2026-11-17T18:17:48+00:00',
                    date2_obj: '2026-11-17T19:48:35+00:00',
                    notes: ''
                }
            ],
            error: null
        });

        const trips = await AllocatorService.getTripsByOrderNo('208');
        expect(mockFrom).toHaveBeenCalledWith('weighbridge_tracking');
        expect(mockEq).toHaveBeenCalledWith('order_no', '208');
        expect(trips).toHaveLength(1);
        expect(trips[0]?.ticketNo).toBe('018743/26B');
        expect(trips[0]?.orderNo).toBe('208');
        expect(trips[0]?.weightNet).toBe(48220);
    });

    it('returns empty array when orderNo is blank', async () => {
        const trips = await AllocatorService.getTripsByOrderNo('   ');
        expect(trips).toEqual([]);
        expect(mockFrom).not.toHaveBeenCalled();
    });
});

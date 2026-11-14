import { describe, it, expect } from 'vitest';
import type { Barge } from '@/services/excel/WeighbridgeService';

describe('VesselSourceManager - Barge Sorting Logic', () => {
    // Sắp xếp: Sà lan mới tạo / mới nhập luôn được đưa lên phía trên
    const sortBargesList = (list: Barge[]): Barge[] => {
        return [...list].sort((a, b) => {
            if (a.created_at && b.created_at) {
                const timeA = new Date(a.created_at).getTime();
                const timeB = new Date(b.created_at).getTime();
                if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
                    return timeB - timeA;
                }
            }
            const idA = Number(a.id || 0);
            const idB = Number(b.id || 0);
            if (idA !== idB) return idB - idA;

            const orderA = parseInt(String(a.config?.orderNo || a.order_no || '').replace(/\D/g, ''), 10) || 0;
            const orderB = parseInt(String(b.config?.orderNo || b.order_no || '').replace(/\D/g, ''), 10) || 0;
            return orderB - orderA;
        });
    };

    it('places newly created barges with higher IDs / later created_at on top', () => {
        const mockBarges: Barge[] = [
            {
                id: 100,
                vessel_id: 1,
                name: 'Sà lan cũ',
                created_at: '2026-11-10T08:00:00Z',
                config: { goods: '', goodsCode: '', owner: '', operator: '', xn: '', ticketPrefix: '', ticketSeed: '', chinhpham: '', phupham: '', ketluan: '', orderNo: '10' }
            },
            {
                id: 200,
                vessel_id: 1,
                name: 'Sà lan mới 1',
                created_at: '2026-11-14T08:00:00Z',
                config: { goods: '', goodsCode: '', owner: '', operator: '', xn: '', ticketPrefix: '', ticketSeed: '', chinhpham: '', phupham: '', ketluan: '', orderNo: '15' }
            },
            {
                id: 300,
                vessel_id: 1,
                name: 'Sà lan mới nhất vừa nhập',
                created_at: '2026-11-14T10:00:00Z',
                config: { goods: '', goodsCode: '', owner: '', operator: '', xn: '', ticketPrefix: '', ticketSeed: '', chinhpham: '', phupham: '', ketluan: '', orderNo: '16' }
            }
        ];

        const sorted = sortBargesList(mockBarges);
        expect(sorted[0].name).toBe('Sà lan mới nhất vừa nhập');
        expect(sorted[1].name).toBe('Sà lan mới 1');
        expect(sorted[2].name).toBe('Sà lan cũ');
    });

    it('falls back to numeric orderNo when created_at is identical or missing', () => {
        const mockBarges: Barge[] = [
            {
                id: 1,
                vessel_id: 1,
                name: 'Sà lan Lệnh 205',
                config: { goods: '', goodsCode: '', owner: '', operator: '', xn: '', ticketPrefix: '', ticketSeed: '', chinhpham: '', phupham: '', ketluan: '', orderNo: '205' }
            },
            {
                id: 1,
                vessel_id: 1,
                name: 'Sà lan Lệnh 208',
                config: { goods: '', goodsCode: '', owner: '', operator: '', xn: '', ticketPrefix: '', ticketSeed: '', chinhpham: '', phupham: '', ketluan: '', orderNo: '208' }
            }
        ];

        const sorted = sortBargesList(mockBarges);
        expect(sorted[0].name).toBe('Sà lan Lệnh 208');
        expect(sorted[1].name).toBe('Sà lan Lệnh 205');
    });
});

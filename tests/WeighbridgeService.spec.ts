import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeighbridgeService } from '@/services/excel/WeighbridgeService';
import { supabase } from '@/supabase';
import { dbContext } from '@/services/storage/DBContext';

// Mock DBContext
const localStore = new Map<string, any>();
vi.mock('@/services/storage/DBContext', () => {
    return {
        dbContext: {
            get: vi.fn(async (key: string) => localStore.get(key)),
            set: vi.fn(async (key: string, value: any) => { localStore.set(key, value); }),
            delete: vi.fn(async (key: string) => { localStore.delete(key); }),
            clear: vi.fn(async () => { localStore.clear(); })
        }
    };
});

// Mock Supabase
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/supabase', () => {
    const mockBuilder = {
        select: vi.fn(() => mockBuilder),
        order: vi.fn(() => mockBuilder),
        insert: vi.fn(() => mockBuilder),
        update: vi.fn(() => mockBuilder),
        eq: vi.fn(() => mockBuilder),
        single: vi.fn().mockResolvedValue({ data: null, error: null })
    };

    return {
        supabase: {
            from: vi.fn(() => mockBuilder)
        }
    };
});

describe('WeighbridgeService - Vessel Status Lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStore.clear();
    });

    it('T1: transforms vessels without status into status: in_progress', async () => {
        const mockVesselsFromDb = [
            { id: 101, name: 'TAU CU 1', barges: [] },
            { id: 102, name: 'TAU CU 2', status: 'done', barges: [] }
        ];

        const mockBuilder: any = (supabase.from as any)('weighbridge_vessels');
        mockBuilder.order.mockResolvedValueOnce({ data: mockVesselsFromDb, error: null });

        const vessels = await WeighbridgeService.getVessels();
        expect(vessels).toHaveLength(2);
        expect(vessels[0].status).toBe('in_progress');
        expect(vessels[1].status).toBe('done');
    });

    it('T2: createVessel assigns status: in_progress', async () => {
        const mockBuilder: any = (supabase.from as any)('weighbridge_vessels');
        mockBuilder.insert.mockReturnValue(mockBuilder);
        mockBuilder.select.mockReturnValue(mockBuilder);
        mockBuilder.single.mockResolvedValueOnce({
            data: { id: 201, name: 'TAU MOI', status: 'in_progress' },
            error: null
        });

        const created = await WeighbridgeService.createVessel('TAU MOI');
        expect(created).not.toBeNull();
        expect(created?.status).toBe('in_progress');
        expect(created?.name).toBe('TAU MOI');
    });

    it('T3: updateVesselStatus to done updates local cache and calls Supabase update', async () => {
        localStore.set('wb_vessels', [
            { id: 301, name: 'TAU A', status: 'in_progress', barges: [] }
        ]);

        const mockBuilder: any = (supabase.from as any)('weighbridge_vessels');
        mockBuilder.update.mockReturnValue(mockBuilder);
        mockBuilder.eq.mockResolvedValueOnce({ data: null, error: null });

        const result = await WeighbridgeService.updateVesselStatus(301, 'done');
        expect(result).toBe(true);
        expect(mockBuilder.update).toHaveBeenCalledWith({ status: 'done' });
        expect(mockBuilder.eq).toHaveBeenCalledWith('id', 301);

        const cached = localStore.get('wb_vessels');
        expect(cached[0].status).toBe('done');
    });

    it('T4: updateVesselStatus to in_progress updates local cache and calls Supabase update', async () => {
        localStore.set('wb_vessels', [
            { id: 401, name: 'TAU B', status: 'done', barges: [] }
        ]);

        const mockBuilder: any = (supabase.from as any)('weighbridge_vessels');
        mockBuilder.update.mockReturnValue(mockBuilder);
        mockBuilder.eq.mockResolvedValueOnce({ data: null, error: null });

        const result = await WeighbridgeService.updateVesselStatus(401, 'in_progress');
        expect(result).toBe(true);
        expect(mockBuilder.update).toHaveBeenCalledWith({ status: 'in_progress' });
        expect(mockBuilder.eq).toHaveBeenCalledWith('id', 401);

        const cached = localStore.get('wb_vessels');
        expect(cached[0].status).toBe('in_progress');
    });

    it('T5: updateVesselStatus handles Supabase network error gracefully and keeps local update', async () => {
        localStore.set('wb_vessels', [
            { id: 501, name: 'TAU OFFLINE', status: 'in_progress', barges: [] }
        ]);

        const mockBuilder: any = (supabase.from as any)('weighbridge_vessels');
        mockBuilder.update.mockReturnValue(mockBuilder);
        mockBuilder.eq.mockRejectedValueOnce(new Error('Network error / offline'));

        const result = await WeighbridgeService.updateVesselStatus(501, 'done');
        expect(result).toBe(true);

        const cached = localStore.get('wb_vessels');
        expect(cached[0].status).toBe('done');
    });

    it('T6: createVessel assigns customer, cargo_type, and cargo_code', async () => {
        const mockBuilder: any = (supabase.from as any)('weighbridge_vessels');
        mockBuilder.insert.mockReturnValue(mockBuilder);
        mockBuilder.select.mockReturnValue(mockBuilder);
        mockBuilder.single.mockResolvedValueOnce({
            data: { id: 601, name: 'TAU C', status: 'in_progress', customer: 'DE HEUS', cargo_type: 'BẮP HẠT', cargo_code: 'BH' },
            error: null
        });

        const created = await WeighbridgeService.createVessel('TAU C', 'DE HEUS', 'BẮP HẠT', 'BH');
        expect(created).not.toBeNull();
        expect(created?.customer).toBe('DE HEUS');
        expect(created?.cargo_type).toBe('BẮP HẠT');
        expect(created?.cargo_code).toBe('BH');
    });

    it('T7: getVessels enforces 100% inheritance from vessel to child barge config', async () => {
        const mockVesselsFromDb = [
            {
                id: 701,
                name: 'TAU ME',
                customer: 'DE HEUS VN',
                cargo_type: 'BÃ ĐẬU NÀNH',
                cargo_code: 'BDN',
                barges: [
                    {
                        id: 7001,
                        name: 'SALAN 01',
                        config: { owner: 'CU', goods: 'CU', goodsCode: 'CU' }
                    }
                ]
            }
        ];

        const mockBuilder: any = (supabase.from as any)('weighbridge_vessels');
        mockBuilder.order.mockResolvedValueOnce({ data: mockVesselsFromDb, error: null });

        const vessels = await WeighbridgeService.getVessels();
        expect(vessels[0].barges![0].config.owner).toBe('DE HEUS VN');
        expect(vessels[0].barges![0].config.goods).toBe('BÃ ĐẬU NÀNH');
        expect(vessels[0].barges![0].config.goodsCode).toBe('BDN');
    });

    it('T8: getMasterData and saveMasterData works correctly', async () => {
        const initial = await WeighbridgeService.getMasterData();
        expect(initial.customers.length).toBeGreaterThan(0);
        expect(initial.goods.length).toBeGreaterThan(0);

        const updated = {
            customers: ['KHACH HANG MOI'],
            goods: [{ name: 'HANG MOI', code: 'HM' }]
        };
        const ok = await WeighbridgeService.saveMasterData(updated);
        expect(ok).toBe(true);

        const loaded = await WeighbridgeService.getMasterData();
        expect(loaded.customers).toContain('KHACH HANG MOI');
    });

    it('T9: getGlobalTicketTemplate and saveGlobalTicketTemplate works correctly', async () => {
        const tpl = await WeighbridgeService.getGlobalTicketTemplate();
        expect(tpl.printElements.length).toBeGreaterThan(0);
        expect(tpl.companyName).toBeDefined();

        tpl.ticketTitle = 'PHIẾU CÂN XE CHUẨN';
        const ok = await WeighbridgeService.saveGlobalTicketTemplate(tpl);
        expect(ok).toBe(true);

        const loaded = await WeighbridgeService.getGlobalTicketTemplate();
        expect(loaded.ticketTitle).toBe('PHIẾU CÂN XE CHUẨN');
    });
});

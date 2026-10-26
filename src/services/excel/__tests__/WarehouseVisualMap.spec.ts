import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockStore = new Map<string, any>();

vi.mock('@/services/storage/DBContext', () => ({
    dbContext: {
        get: vi.fn(async (key: string) => mockStore.get(key)),
        set: vi.fn(async (key: string, val: any) => { mockStore.set(key, val); }),
        delete: vi.fn(async (key: string) => { mockStore.delete(key); }),
        clear: vi.fn(async () => { mockStore.clear(); })
    }
}));

vi.mock('@/supabase', () => {
    const chain: any = {
        select: () => chain,
        eq: () => chain,
        single: () => Promise.resolve({ data: { settings: {} }, error: null }),
        update: () => chain,
        then: (resolve: any) => resolve({ data: [], error: null })
    };
    return {
        supabase: {
            from: () => chain
        }
    };
});

import {
    WarehouseInventoryService,
    snapMapVertex,
    createWarehousePresetPolygons,
    getDefaultVisualMapState
} from '../WarehouseInventoryService';

describe('WarehouseVisualMap Geometry & State Helpers', () => {
    beforeEach(() => {
        mockStore.clear();
    });

    it('initializes default visual map state matching TVPL reference layout', () => {
        const state = getDefaultVisualMapState();
        expect(state.title).toBe('TVPL - Sơ đồ kho cảng Nguyên Ngọc');
        expect(state.containerYard.loadedConts).toBe(0);
        expect(state.containerYard.emptyConts).toBe(784);

        expect(state.warehouses['KHO 1'].areaM2).toBe(1080);
        expect(state.warehouses['KHO 1'].totalBays).toBe(6);
        expect(state.warehouses['KHO 1'].polygons.length).toBe(1);

        expect(state.warehouses['KHO 2'].areaM2).toBe(1980);
        expect(state.warehouses['KHO 2'].totalBays).toBe(11);
        expect(state.warehouses['KHO 2'].polygons.length).toBe(1);

        expect(state.warehouses['KHO 3'].areaM2).toBe(1980);
        expect(state.warehouses['KHO 3'].totalBays).toBe(11);
        expect(state.warehouses['KHO 3'].polygons.length).toBe(1);

        expect(state.warehouses['KHO 4'].areaM2).toBe(5000);
        expect(state.warehouses['KHO 4'].totalBays).toBe(12);
        expect(state.warehouses['KHO 4'].showConveyor).toBe(true);
        expect(state.warehouses['KHO 4'].polygons.length).toBe(4);
    });

    it('snaps vertices to walls and integer bay lines when within threshold', () => {
        const s1 = snapMapVertex({ xRatio: 0.015, bayY: 3.92 }, 11, true);
        expect(s1.xRatio).toBe(0);
        expect(s1.bayY).toBe(4);

        const s2 = snapMapVertex({ xRatio: 0.985, bayY: 10.9 }, 11, true);
        expect(s2.xRatio).toBe(1);
        expect(s2.bayY).toBe(11);

        const s3 = snapMapVertex({ xRatio: 0.49, bayY: 2.53 }, 6, true);
        expect(s3.xRatio).toBe(0.5);
        expect(s3.bayY).toBe(2.5);

        const s4 = snapMapVertex({ xRatio: -0.5, bayY: 15 }, 12, false);
        expect(s4.xRatio).toBe(0);
        expect(s4.bayY).toBe(12);
    });

    it('generates valid preset polygons for FULL, ANGLED_AISLE, and STEPPED_AISLE', () => {
        const full = createWarehousePresetPolygons('KHO 1', 6, 'FULL');
        expect(full).toHaveLength(1);
        expect(full[0]!.vertices).toHaveLength(4);

        const angled = createWarehousePresetPolygons('KHO 3', 11, 'ANGLED_AISLE');
        expect(angled).toHaveLength(1);
        expect(angled[0]!.vertices.length).toBeGreaterThanOrEqual(8);

        const stepped = createWarehousePresetPolygons('KHO 2', 11, 'STEPPED_AISLE');
        expect(stepped).toHaveLength(1);
        expect(stepped[0]!.vertices.length).toBeGreaterThanOrEqual(10);
    });

    it('saves and loads visual map state via WarehouseInventoryService', async () => {
        const state = getDefaultVisualMapState();
        state.containerYard.loadedConts = 12;
        state.containerYard.emptyConts = 650;
        await WarehouseInventoryService.saveVisualMapState(state);

        const loaded = await WarehouseInventoryService.getVisualMapState();
        expect(loaded.containerYard.loadedConts).toBe(12);
        expect(loaded.containerYard.emptyConts).toBe(650);
    });
});

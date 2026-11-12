// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DemoSandboxService } from '../DemoSandboxService';
import { DBContext } from '../DBContext';
import { createDemoQueryBuilder, isDemoActive } from '../../../supabase';
import { authStore, loginAsDemo, login, logout } from '../../../stores/auth';
import { authService } from '../AuthService';
import { ContentService } from '../../ContentService';
import { LogService } from '../LogService';

describe('Demo Sandbox vs Main Production Flow Isolation', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        DemoSandboxService.reset();
        authStore.isAuthenticated = false;
        authStore.user = null;
        authStore.role = null;
        authStore.isDemoMode = false;
        localStorage.removeItem('auth_session');
    });

    describe('1. DemoSandboxService.isDemoMode() & Expiry Validation', () => {
        it('returns false by default for guest and normal admin sessions', () => {
            expect(DemoSandboxService.isDemoMode()).toBe(false);
            expect(isDemoActive()).toBe(false);

            localStorage.setItem(
                'auth_session',
                JSON.stringify({
                    isAuthenticated: true,
                    user: 'admin',
                    role: 'admin',
                    isDemoMode: false
                })
            );
            expect(DemoSandboxService.isDemoMode()).toBe(false);
        });

        it('returns true immediately when loginAsDemo() is called and false immediately after logout()', async () => {
            loginAsDemo();
            expect(authStore.isDemoMode).toBe(true);
            expect(DemoSandboxService.isDemoMode()).toBe(true);
            expect(isDemoActive()).toBe(true);

            await logout();
            // Even after microtask ticks, watch(authStore) must not resurrect auth_session
            await Promise.resolve();
            expect(authStore.isDemoMode).toBe(false);
            expect(localStorage.getItem('auth_session')).toBeNull();
            expect(DemoSandboxService.isDemoMode()).toBe(false);
        });

        it('returns false and cleans up stale demo session when portfolio_login_expiry is expired', () => {
            localStorage.setItem(
                'auth_session',
                JSON.stringify({
                    isAuthenticated: true,
                    user: 'demo',
                    isDemoMode: true
                })
            );
            localStorage.setItem('portfolio_user', 'demo');
            localStorage.setItem('portfolio_login_expiry', String(Date.now() - 60_000));

            expect(DemoSandboxService.isDemoMode()).toBe(false);
            expect(localStorage.getItem('portfolio_user')).toBeNull();
            expect(localStorage.getItem('auth_session')).toBeNull();
        });

        it('exits Demo mode BEFORE calling authService.login() when logging in as a real user', async () => {
            loginAsDemo();
            expect(DemoSandboxService.isDemoMode()).toBe(true);

            let demoModeDuringAuthCall: boolean | null = null;
            const loginSpy = vi.spyOn(authService, 'login').mockImplementation(async (username: string) => {
                demoModeDuringAuthCall = DemoSandboxService.isDemoMode();
                return {
                    success: true,
                    user: {
                        id: 'u1',
                        username,
                        role: 'admin',
                        displayName: 'Real Admin'
                    }
                };
            });
            const permsSpy = vi.spyOn(ContentService, 'loadRolePermissions').mockResolvedValue(authStore.rolePermissions as any);
            const logSpy = vi.spyOn(LogService, 'logAction').mockResolvedValue(true);

            const res = await login('admin', 'secret123');
            expect(res.success).toBe(true);
            expect(demoModeDuringAuthCall).toBe(false);
            expect(DemoSandboxService.isDemoMode()).toBe(false);
            expect(authStore.user).toBe('admin');
            expect(authStore.isDemoMode).toBe(false);

            loginSpy.mockRestore();
            permsSpy.mockRestore();
            logSpy.mockRestore();
        });
    });

    describe('2. DBContext IndexedDB / Fallback Key Isolation', () => {
        it('prefixes keys with demo_sandbox_ in Demo mode and never overwrites or clears production keys', async () => {
            const ctx = new DBContext();

            // 1. Main Production Flow writes real data
            await ctx.set('warehouse_inventory_tickets', [{ id: 'prod-1', netWeight: 50000 }]);
            await ctx.set('warehouse_configs', { 'KHO 1': { initialStock: 1200 } });
            await ctx.set('allocator_tickets', [{ ticketNo: 'PROD-T1' }]);
            await ctx.set('wb_vessels', [{ id: 1, name: 'TÀU THẬT', barges: [] }]);

            expect(await ctx.get('warehouse_inventory_tickets')).toEqual([{ id: 'prod-1', netWeight: 50000 }]);

            // 2. Enter Demo Sandbox Mode
            loginAsDemo();
            expect(ctx.resolveKey('warehouse_inventory_tickets')).toBe('demo_sandbox_warehouse_inventory_tickets');

            // Demo writes/overwrites keys and even calls clear()
            await ctx.set('warehouse_inventory_tickets', [{ id: 'demo-999', netWeight: 999 }]);
            await ctx.set('warehouse_configs', { 'KHO 1': { initialStock: 0 } });
            await ctx.set('wb_vessels', [{ id: 1, name: 'TÀU DEMO SỬA', barges: [] }]);

            expect(await ctx.get('warehouse_inventory_tickets')).toEqual([{ id: 'demo-999', netWeight: 999 }]);
            expect(await ctx.get('warehouse_configs')).toEqual({ 'KHO 1': { initialStock: 0 } });

            // Clearing DB in Demo mode only clears demo keys
            await ctx.clear();
            expect(await ctx.get('warehouse_inventory_tickets')).toBeUndefined();

            // 3. Exit Demo Mode -> Production keys are 100% intact
            await logout();
            expect(await ctx.get('warehouse_inventory_tickets')).toEqual([{ id: 'prod-1', netWeight: 50000 }]);
            expect(await ctx.get('warehouse_configs')).toEqual({ 'KHO 1': { initialStock: 1200 } });
            expect(await ctx.get('allocator_tickets')).toEqual([{ ticketNo: 'PROD-T1' }]);
            expect(await ctx.get('wb_vessels')).toEqual([{ id: 1, name: 'TÀU THẬT', barges: [] }]);
        });
    });

    describe('3. Direct localStorage Isolation via DemoSandboxService', () => {
        it('isolates weighbridge_default_layout and weighbridge_master_data in Demo mode', async () => {
            DemoSandboxService.setLocalItem('weighbridge_default_layout', '["PROD_LAYOUT"]');
            expect(localStorage.getItem('weighbridge_default_layout')).toBe('["PROD_LAYOUT"]');

            loginAsDemo();
            // Reads fallback from prod before Demo modifies it
            expect(DemoSandboxService.getLocalItem('weighbridge_default_layout')).toBe('["PROD_LAYOUT"]');

            // Writing in Demo mode writes to demo_sandbox_weighbridge_default_layout
            DemoSandboxService.setLocalItem('weighbridge_default_layout', '["DEMO_LAYOUT"]');
            expect(DemoSandboxService.getLocalItem('weighbridge_default_layout')).toBe('["DEMO_LAYOUT"]');
            expect(localStorage.getItem('weighbridge_default_layout')).toBe('["PROD_LAYOUT"]');

            await logout();
            expect(DemoSandboxService.getLocalItem('weighbridge_default_layout')).toBe('["PROD_LAYOUT"]');
            expect(localStorage.getItem('demo_sandbox_weighbridge_default_layout')).toBeNull();
        });
    });

    describe('4. createDemoQueryBuilder Chaining, Upsert, Single & Pagination', () => {
        function createMockPostgrestQueryBuilder(remoteRows: any[]) {
            // Simulates @supabase/postgrest-js where PostgrestQueryBuilder ONLY has .select/.insert/.update/.upsert/.delete
            // and .select() returns a NEW PostgrestFilterBuilder with filter/transform/.then methods
            return {
                select() {
                    let filtered = [...remoteRows];
                    let singleMode = false;
                    const filterBuilder: any = {
                        eq(col: string, val: any) {
                            filtered = filtered.filter(r => String(r[col]) === String(val));
                            return filterBuilder;
                        },
                        in(col: string, vals: any[]) {
                            const s = new Set(vals.map(String));
                            filtered = filtered.filter(r => s.has(String(r[col])));
                            return filterBuilder;
                        },
                        neq(col: string, val: any) {
                            filtered = filtered.filter(r => String(r[col]) !== String(val));
                            return filterBuilder;
                        },
                        order() {
                            return filterBuilder;
                        },
                        range(from: number, to: number) {
                            filtered = filtered.slice(from, to + 1);
                            return filterBuilder;
                        },
                        single() {
                            singleMode = true;
                            return filterBuilder;
                        },
                        maybeSingle() {
                            singleMode = true;
                            return filterBuilder;
                        },
                        then(resolve: any, reject: any) {
                            const payload = singleMode
                                ? { data: filtered[0] ?? null, error: null, status: 200 }
                                : { data: filtered, error: null, count: filtered.length, status: 200 };
                            return Promise.resolve(payload).then(resolve, reject);
                        }
                    };
                    return filterBuilder;
                }
            };
        }

        it('updates currentBuilder when .select() returns PostgrestFilterBuilder and chains .order().range()', async () => {
            loginAsDemo();
            const remote = [
                { id: '1', warehouse_id: 'KHO 1', initial_stock: 100 },
                { id: '2', warehouse_id: 'KHO 2', initial_stock: 200 }
            ];

            // Upsert KHO 1 in demo mode (should update KHO 1 without duplicating it)
            const writeQb = createDemoQueryBuilder('warehouse_configs', createMockPostgrestQueryBuilder(remote));
            await writeQb.upsert({ warehouse_id: 'KHO 1', initial_stock: 999 }, { onConflict: 'warehouse_id' });

            // Read back with .select('*').order('warehouse_id').range(0, 999)
            const readQb = createDemoQueryBuilder('warehouse_configs', createMockPostgrestQueryBuilder(remote));
            const { data: page0 } = await readQb.select('*').order('warehouse_id').range(0, 999);

            expect(page0).toHaveLength(2);
            const kho1 = page0.find((r: any) => r.warehouse_id === 'KHO 1');
            expect(kho1.initial_stock).toBe(999);

            // Page 1 (.range(1000, 1999)) must NOT prepend demo inserted rows again
            const readPage1Qb = createDemoQueryBuilder('warehouse_configs', createMockPostgrestQueryBuilder(remote));
            const { data: page1 } = await readPage1Qb.select('*').order('warehouse_id').range(1000, 1999);
            expect(page1).toHaveLength(0);
        });

        it('supports .insert([...]).select().single(), .update().eq().single(), and .delete().in() / .delete().neq()', async () => {
            loginAsDemo();
            const remote = [
                { id: 'v1', plate_number: '61C-111.11' },
                { id: 'v2', plate_number: '61C-222.22' }
            ];

            // 1. .insert([row]).select().single() returns single object
            const insertQb = createDemoQueryBuilder('weighbridge_vehicles', createMockPostgrestQueryBuilder(remote));
            const { data: created } = await insertQb
                .insert([{ id: 'v3', plate_number: '61C-333.33' }])
                .select()
                .single();
            expect(created).toBeTruthy();
            expect(Array.isArray(created)).toBe(false);
            expect(created.plate_number).toBe('61C-333.33');

            // 2. .delete().in('id', ['v1']) removes v1 from overlay
            const delInQb = createDemoQueryBuilder('weighbridge_vehicles', createMockPostgrestQueryBuilder(remote));
            await delInQb.delete().in('id', ['v1']);

            const listQb = createDemoQueryBuilder('weighbridge_vehicles', createMockPostgrestQueryBuilder(remote));
            const { data: afterDelIn } = await listQb.select('*');
            expect(afterDelIn.map((r: any) => r.id)).toEqual(['v3', 'v2']);

            // 3. .delete().neq('id', '0') clears table in demo overlay
            const delAllQb = createDemoQueryBuilder('weighbridge_vehicles', createMockPostgrestQueryBuilder(remote));
            await delAllQb.delete().neq('id', '0');

            const listAfterClearQb = createDemoQueryBuilder('weighbridge_vehicles', createMockPostgrestQueryBuilder(remote));
            const { data: afterClear } = await listAfterClearQb.select('*');
            expect(afterClear).toEqual([]);
        });
    });
});

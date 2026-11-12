import { createClient } from '@supabase/supabase-js';
import { DemoSandboxService } from './services/storage/DemoSandboxService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase URL or Anon Key');
}

export const rawSupabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Kiểm tra xem phiên làm việc hiện tại có đang ở Chế độ Thử Nghiệm (Demo Sandbox) hay không.
 * Sử dụng DemoSandboxService.isDemoMode() (kiểm tra cả auth_session, user === 'demo' và thời hạn phiên).
 */
export function isDemoActive(): boolean {
    return DemoSandboxService.isDemoMode();
}

const CHAINABLE_METHODS = new Set([
    'ilike',
    'like',
    'gte',
    'lte',
    'gt',
    'lt',
    'is',
    'not',
    'or',
    'filter',
    'order',
    'limit',
    'csv',
    'returns',
    'throwOnError',
    'abortSignal'
]);

/**
 * Tạo Proxy chặn toàn bộ các lệnh ghi (INSERT, UPDATE, DELETE, UPSERT) lên Supabase
 * khi đang ở chế độ Demo Sandbox. Dữ liệu thử nghiệm chỉ lưu vào bộ nhớ tạm của người test.
 */
export function createDemoQueryBuilder(tableName: string, originalBuilder: any) {
    let currentBuilder: any = originalBuilder;
    let operation: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
    let writePayload: any = null;
    let upsertConflictKey: string | undefined;
    let matchField: string | undefined;
    let matchVal: any = undefined;
    let inField: string | undefined;
    let inVals: any[] | undefined;
    let neqField: string | undefined;
    let neqVal: any = undefined;
    let isSingle = false;
    let isMaybeSingle = false;
    let rangeFrom: number | undefined;
    let rangeTo: number | undefined;
    const filters: Array<(row: any) => boolean> = [];

    const proxyBuilder: any = new Proxy(originalBuilder, {
        get(_target, prop) {
            if (prop === 'insert') {
                return (payload: any) => {
                    operation = 'insert';
                    writePayload = payload;
                    return proxyBuilder;
                };
            }

            if (prop === 'upsert') {
                return (payload: any, opts?: { onConflict?: string }) => {
                    operation = 'upsert';
                    writePayload = payload;
                    upsertConflictKey = opts?.onConflict;
                    return proxyBuilder;
                };
            }

            if (prop === 'update') {
                return (payload: any) => {
                    operation = 'update';
                    writePayload = payload;
                    return proxyBuilder;
                };
            }

            if (prop === 'delete') {
                return () => {
                    operation = 'delete';
                    return proxyBuilder;
                };
            }

            if (prop === 'select') {
                return (...args: any[]) => {
                    if (operation === 'select' && currentBuilder && typeof currentBuilder.select === 'function') {
                        const res = currentBuilder.select(...args);
                        if (res && typeof res === 'object') {
                            currentBuilder = res;
                        }
                    }
                    return proxyBuilder;
                };
            }

            if (prop === 'single') {
                return (...args: any[]) => {
                    isSingle = true;
                    if (operation === 'select' && currentBuilder && typeof currentBuilder.single === 'function') {
                        const res = currentBuilder.single(...args);
                        if (res && typeof res === 'object') {
                            currentBuilder = res;
                        }
                    }
                    return proxyBuilder;
                };
            }

            if (prop === 'maybeSingle') {
                return (...args: any[]) => {
                    isMaybeSingle = true;
                    if (operation === 'select' && currentBuilder && typeof currentBuilder.maybeSingle === 'function') {
                        const res = currentBuilder.maybeSingle(...args);
                        if (res && typeof res === 'object') {
                            currentBuilder = res;
                        }
                    }
                    return proxyBuilder;
                };
            }

            if (prop === 'range') {
                return (from: number, to: number) => {
                    rangeFrom = from;
                    rangeTo = to;
                    if (operation === 'select' && currentBuilder && typeof currentBuilder.range === 'function') {
                        const res = currentBuilder.range(from, to);
                        if (res && typeof res === 'object') {
                            currentBuilder = res;
                        }
                    }
                    return proxyBuilder;
                };
            }

            if (prop === 'eq') {
                return (col: string, val: any) => {
                    matchField = col;
                    matchVal = val;
                    filters.push((row: any) => row && String(row[col] ?? '') === String(val ?? ''));
                    if (operation === 'select' && currentBuilder && typeof currentBuilder.eq === 'function') {
                        const res = currentBuilder.eq(col, val);
                        if (res && typeof res === 'object') {
                            currentBuilder = res;
                        }
                    }
                    return proxyBuilder;
                };
            }

            if (prop === 'match') {
                return (query: Record<string, any>) => {
                    if (query && typeof query === 'object') {
                        const entries = Object.entries(query);
                        const firstEntry = entries[0];
                        if (firstEntry) {
                            matchField = firstEntry[0];
                            matchVal = firstEntry[1];
                        }
                        filters.push((row: any) =>
                            row && entries.every(([k, v]) => String(row[k] ?? '') === String(v ?? ''))
                        );
                    }
                    if (operation === 'select' && currentBuilder && typeof currentBuilder.match === 'function') {
                        const res = currentBuilder.match(query);
                        if (res && typeof res === 'object') {
                            currentBuilder = res;
                        }
                    }
                    return proxyBuilder;
                };
            }

            if (prop === 'in') {
                return (col: string, vals: any[]) => {
                    inField = col;
                    inVals = Array.isArray(vals) ? vals : [];
                    const set = new Set(inVals.map(v => String(v)));
                    filters.push((row: any) => row && set.has(String(row[col] ?? '')));
                    if (operation === 'select' && currentBuilder && typeof currentBuilder.in === 'function') {
                        const res = currentBuilder.in(col, vals);
                        if (res && typeof res === 'object') {
                            currentBuilder = res;
                        }
                    }
                    return proxyBuilder;
                };
            }

            if (prop === 'neq') {
                return (col: string, val: any) => {
                    neqField = col;
                    neqVal = val;
                    filters.push((row: any) => !row || String(row[col] ?? '') !== String(val ?? ''));
                    if (operation === 'select' && currentBuilder && typeof currentBuilder.neq === 'function') {
                        const res = currentBuilder.neq(col, val);
                        if (res && typeof res === 'object') {
                            currentBuilder = res;
                        }
                    }
                    return proxyBuilder;
                };
            }

            if (typeof prop === 'string' && CHAINABLE_METHODS.has(prop)) {
                return (...args: any[]) => {
                    if (operation === 'select' && currentBuilder && typeof currentBuilder[prop] === 'function') {
                        const res = currentBuilder[prop](...args);
                        if (res && typeof res === 'object') {
                            currentBuilder = res;
                        }
                    }
                    return proxyBuilder;
                };
            }

            // Xử lý khi query được await hoặc gọi .then(...)
            if (prop === 'then') {
                return (resolve: any, reject: any) => {
                    if (operation === 'insert' || operation === 'upsert') {
                        const inserted = DemoSandboxService.addInserted(tableName, writePayload, upsertConflictKey);
                        const dataResult = (isSingle || isMaybeSingle || !Array.isArray(writePayload))
                            ? (inserted[0] ?? null)
                            : inserted;
                        return Promise.resolve({
                            data: dataResult,
                            error: null,
                            count: inserted.length,
                            status: 201,
                            statusText: 'Created (Demo Sandbox)'
                        }).then(resolve, reject);
                    }

                    if (operation === 'update') {
                        DemoSandboxService.addUpdated(tableName, writePayload, matchField, matchVal);
                        const dataResult = (isSingle || isMaybeSingle) ? writePayload : [writePayload];
                        return Promise.resolve({
                            data: dataResult,
                            error: null,
                            count: 1,
                            status: 200,
                            statusText: 'OK (Demo Sandbox)'
                        }).then(resolve, reject);
                    }

                    if (operation === 'delete') {
                        if (inField && inVals) {
                            DemoSandboxService.addDeletedMany(tableName, inField, inVals);
                        } else if (neqField !== undefined) {
                            DemoSandboxService.addDeleteNeq(tableName, neqField, neqVal);
                        } else {
                            DemoSandboxService.addDeleted(tableName, matchField || 'id', matchVal);
                        }
                        return Promise.resolve({
                            data: null,
                            error: null,
                            count: 1,
                            status: 200,
                            statusText: 'OK (Demo Sandbox)'
                        }).then(resolve, reject);
                    }

                    // For 'select': Chạy query đọc từ Supabase thật để lấy dữ liệu ban đầu, sau đó hòa trộn với dữ liệu demo
                    if (currentBuilder && typeof currentBuilder.then === 'function') {
                        return currentBuilder.then((res: any) => {
                            if (res && Array.isArray(res.data)) {
                                const merged = DemoSandboxService.applyOverlay(tableName, res.data, {
                                    rangeFrom,
                                    rangeTo
                                });
                                const finalData = (isSingle || isMaybeSingle) ? (merged[0] ?? null) : merged;
                                return {
                                    ...res,
                                    data: finalData,
                                    count: merged.length
                                };
                            }

                            if (res && res.data && typeof res.data === 'object') {
                                const merged = DemoSandboxService.applyOverlay(tableName, [res.data], { filters });
                                return {
                                    ...res,
                                    data: merged[0] ?? null,
                                    error: merged.length > 0 ? null : res.error
                                };
                            }

                            if (res && res.data === null) {
                                const merged = DemoSandboxService.applyOverlay(tableName, [], {
                                    filters,
                                    rangeFrom,
                                    rangeTo
                                });
                                if (merged.length > 0) {
                                    return {
                                        ...res,
                                        data: (isSingle || isMaybeSingle) ? merged[0] : merged,
                                        error: null,
                                        count: merged.length,
                                        status: 200
                                    };
                                }
                            }

                            return res;
                        }).then(resolve, reject);
                    }

                    const fallbackMerged = DemoSandboxService.applyOverlay(tableName, [], {
                        filters,
                        rangeFrom,
                        rangeTo
                    });
                    return Promise.resolve({
                        data: (isSingle || isMaybeSingle) ? (fallbackMerged[0] ?? null) : fallbackMerged,
                        error: null,
                        count: fallbackMerged.length,
                        status: 200,
                        statusText: 'OK (Demo Sandbox)'
                    }).then(resolve, reject);
                };
            }

            if (currentBuilder && prop in currentBuilder) {
                const orig = Reflect.get(currentBuilder, prop, currentBuilder);
                if (typeof orig === 'function') {
                    return (...args: any[]) => {
                        const res = orig.apply(currentBuilder, args);
                        if (res && typeof res === 'object' && typeof res.then !== 'function') {
                            currentBuilder = res;
                            return proxyBuilder;
                        }
                        if (res && typeof res === 'object') {
                            currentBuilder = res;
                            return proxyBuilder;
                        }
                        return res;
                    };
                }
                return orig;
            }

            return undefined;
        }
    });

    return proxyBuilder;
}

/**
 * Proxy Storage giả lập để demo upload ảnh / tài liệu mà không đẩy lên cloud
 */
function createDemoStorage(realStorage: any) {
    return new Proxy(realStorage, {
        get(target, prop) {
            if (prop === 'from') {
                return (bucket: string) => {
                    const realBucket = target.from(bucket);
                    return new Proxy(realBucket, {
                        get(bTarget, bProp) {
                            if (bProp === 'upload') {
                                return async (path: string) => {
                                    return {
                                        data: { path: `demo/${path}` },
                                        error: null
                                    };
                                };
                            }
                            if (bProp === 'remove') {
                                return async () => ({ data: [], error: null });
                            }
                            if (bProp === 'getPublicUrl') {
                                return () => ({
                                    data: {
                                        publicUrl:
                                            'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=200&q=80'
                                    }
                                });
                            }
                            const val = Reflect.get(bTarget, bProp, bTarget);
                            return typeof val === 'function' ? val.bind(bTarget) : val;
                        }
                    });
                };
            }
            const val = Reflect.get(target, prop, target);
            return typeof val === 'function' ? val.bind(target) : val;
        }
    });
}

/**
 * Supabase client được bảo vệ bởi Proxy Sandbox:
 * - Khi đăng nhập bình thường: 100% kết nối Supabase production.
 * - Khi ở tài khoản Demo: Chặn mọi thao tác ghi dữ liệu, chỉ lưu tạm vào máy người dùng.
 */
export const supabase = new Proxy(rawSupabase, {
    get(target, prop) {
        if (prop === 'from') {
            return (tableName: string) => {
                if (isDemoActive()) {
                    return createDemoQueryBuilder(tableName, target.from(tableName));
                }
                return target.from(tableName);
            };
        }
        if (prop === 'storage') {
            if (isDemoActive()) {
                return createDemoStorage(target.storage);
            }
            return target.storage;
        }
        const val = Reflect.get(target, prop, target);
        return typeof val === 'function' ? val.bind(target) : val;
    }
});

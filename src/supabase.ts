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
 * Đọc trực tiếp từ localStorage 'auth_session' để đảm bảo không bị circular dependency.
 */
function isDemoActive(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const session = localStorage.getItem('auth_session');
        if (session) {
            const parsed = JSON.parse(session);
            return !!parsed?.isDemoMode;
        }
    } catch (_) {}
    return false;
}

/**
 * Tạo Proxy chặn toàn bộ các lệnh ghi (INSERT, UPDATE, DELETE, UPSERT) lên Supabase
 * khi đang ở chế độ Demo Sandbox. Dữ liệu thử nghiệm chỉ lưu vào bộ nhớ tạm của người test.
 */
function createDemoQueryBuilder(tableName: string, originalBuilder: any) {
    let operation = 'select'; // 'select' | 'insert' | 'update' | 'delete' | 'upsert'
    let writePayload: any = null;
    let matchField: string | undefined;
    let matchVal: any = undefined;

    const proxyBuilder: any = new Proxy(originalBuilder, {
        get(target, prop, receiver) {
            if (prop === 'insert' || prop === 'upsert') {
                return (payload: any) => {
                    operation = 'insert';
                    writePayload = payload;
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

            if (prop === 'eq' || prop === 'match') {
                return (col: string, val: any) => {
                    matchField = col;
                    matchVal = val;
                    if (typeof target[prop] === 'function') {
                        target[prop](col, val);
                    }
                    return proxyBuilder;
                };
            }

            // Xử lý khi query được await hoặc gọi .then(...)
            if (prop === 'then') {
                return (resolve: any, reject: any) => {
                    if (operation === 'insert') {
                        const inserted = DemoSandboxService.addInserted(tableName, writePayload);
                        const dataResult = Array.isArray(writePayload) ? inserted : inserted[0];
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
                        return Promise.resolve({
                            data: [writePayload],
                            error: null,
                            count: 1,
                            status: 200,
                            statusText: 'OK (Demo Sandbox)'
                        }).then(resolve, reject);
                    }

                    if (operation === 'delete') {
                        DemoSandboxService.addDeleted(tableName, matchField || 'id', matchVal);
                        return Promise.resolve({
                            data: null,
                            error: null,
                            count: 1,
                            status: 200,
                            statusText: 'OK (Demo Sandbox)'
                        }).then(resolve, reject);
                    }

                    // For 'select': Chạy query đọc từ Supabase thật để lấy dữ liệu ban đầu, sau đó hòa trộn với dữ liệu demo
                    return target.then((res: any) => {
                        if (res && res.data && Array.isArray(res.data)) {
                            const merged = DemoSandboxService.applyOverlay(tableName, res.data);
                            return {
                                ...res,
                                data: merged,
                                count: merged.length
                            };
                        }
                        return res;
                    }).then(resolve, reject);
                };
            }

            const orig = Reflect.get(target, prop, receiver);
            if (typeof orig === 'function') {
                return (...args: any[]) => {
                    const res = orig.apply(target, args);
                    if (res && typeof res === 'object') {
                        return proxyBuilder;
                    }
                    return res;
                };
            }
            return orig;
        }
    });

    return proxyBuilder;
}

/**
 * Proxy Storage giả lập để demo upload ảnh / tài liệu mà không đẩy lên cloud
 */
function createDemoStorage(realStorage: any) {
    return new Proxy(realStorage, {
        get(target, prop, receiver) {
            if (prop === 'from') {
                return (bucket: string) => {
                    const realBucket = target.from(bucket);
                    return new Proxy(realBucket, {
                        get(bTarget, bProp, bReceiver) {
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
                            return Reflect.get(bTarget, bProp, bReceiver);
                        }
                    });
                };
            }
            return Reflect.get(target, prop, receiver);
        }
    });
}

/**
 * Supabase client được bảo vệ bởi Proxy Sandbox:
 * - Khi đăng nhập bình thường: 100% kết nối Supabase production.
 * - Khi ở tài khoản Demo: Chặn mọi thao tác ghi dữ liệu, chỉ lưu tạm vào máy người dùng.
 */
export const supabase = new Proxy(rawSupabase, {
    get(target, prop, receiver) {
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
        return Reflect.get(target, prop, receiver);
    }
});

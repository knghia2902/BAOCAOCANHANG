import { openDB, type DBSchema } from 'idb';
import { DemoSandboxService, DEMO_SANDBOX_PREFIX } from './DemoSandboxService';

interface MyDB extends DBSchema {
    keyval: {
        key: string;
        value: any;
    };
}

const DB_NAME = 'ngocanh-portfolio-db';
const STORE_NAME = 'keyval';

export class DBContext {
    private dbPromise;
    private useLocalStorageFallback = false;
    private demoMemoryStore = new Map<string, any>();
    private demoDeletedKeys = new Set<string>();
    private trackedDemoKeys = new Set<string>();

    constructor() {
        if (typeof indexedDB === 'undefined') {
            this.useLocalStorageFallback = true;
            this.dbPromise = Promise.resolve(null as any);
        } else {
            try {
                this.dbPromise = openDB<MyDB>(DB_NAME, 1, {
                    upgrade(db) {
                        db.createObjectStore(STORE_NAME);
                    },
                });
                this.dbPromise.catch((err) => {
                    console.warn('IndexedDB failed to initialize. Falling back to localStorage.', err);
                    this.useLocalStorageFallback = true;
                });
            } catch (e) {
                console.warn('IndexedDB open failed. Falling back to localStorage.', e);
                this.useLocalStorageFallback = true;
                this.dbPromise = Promise.resolve(null as any);
            }
        }

        DemoSandboxService.onReset(() => {
            void this.clearDemoData();
        });
    }

    /**
     * Trả về khóa lưu trữ thực tế:
     * - Luồng chính (Production): giữ nguyên `key`
     * - Chế độ Demo Sandbox: tự động gắn tiền tố `demo_sandbox_` để không ghi đè IndexedDB/localStorage thật
     */
    resolveKey(key: string): string {
        return DemoSandboxService.resolveKey(key);
    }

    async get<T>(key: string): Promise<T | undefined> {
        const effectiveKey = this.resolveKey(key);
        const isDemo = DemoSandboxService.isDemoMode();

        if (isDemo) {
            if (this.demoDeletedKeys.has(effectiveKey)) {
                return undefined;
            }
            if (this.demoMemoryStore.has(effectiveKey)) {
                const cached = this.demoMemoryStore.get(effectiveKey);
                return cached !== undefined ? (JSON.parse(JSON.stringify(cached)) as T) : undefined;
            }
        }

        if (this.useLocalStorageFallback) {
            return this.getLocalStorage<T>(effectiveKey);
        }
        try {
            const db = await this.dbPromise;
            return await db.get(STORE_NAME, effectiveKey);
        } catch (e) {
            console.warn(`IndexedDB get failed for key "${effectiveKey}". Falling back to localStorage.`, e);
            this.useLocalStorageFallback = true;
            return this.getLocalStorage<T>(effectiveKey);
        }
    }

    async set(key: string, val: any) {
        const effectiveKey = this.resolveKey(key);
        const cleanVal = val !== undefined ? JSON.parse(JSON.stringify(val)) : val;

        if (DemoSandboxService.isDemoMode()) {
            this.trackedDemoKeys.add(effectiveKey);
            this.demoDeletedKeys.delete(effectiveKey);
            this.demoMemoryStore.set(effectiveKey, cleanVal);
        }

        if (this.useLocalStorageFallback) {
            this.setLocalStorage(effectiveKey, cleanVal);
            return;
        }
        try {
            const db = await this.dbPromise;
            await db.put(STORE_NAME, cleanVal, effectiveKey);
        } catch (e) {
            console.warn(`IndexedDB set failed for key "${effectiveKey}". Falling back to localStorage.`, e);
            this.useLocalStorageFallback = true;
            this.setLocalStorage(effectiveKey, cleanVal);
        }
    }

    async delete(key: string) {
        const effectiveKey = this.resolveKey(key);

        if (DemoSandboxService.isDemoMode()) {
            this.demoMemoryStore.delete(effectiveKey);
            this.demoDeletedKeys.add(effectiveKey);
        }

        if (this.useLocalStorageFallback) {
            this.deleteLocalStorage(effectiveKey);
            return;
        }
        try {
            const db = await this.dbPromise;
            await db.delete(STORE_NAME, effectiveKey);
        } catch (e) {
            console.warn(`IndexedDB delete failed for key "${effectiveKey}". Falling back to localStorage.`, e);
            this.useLocalStorageFallback = true;
            this.deleteLocalStorage(effectiveKey);
        }
    }

    async clear() {
        if (DemoSandboxService.isDemoMode()) {
            await this.clearDemoData();
            return;
        }
        if (this.useLocalStorageFallback) {
            this.clearLocalStorage(false);
            return;
        }
        try {
            const db = await this.dbPromise;
            await db.clear(STORE_NAME);
        } catch (e) {
            console.warn('IndexedDB clear failed. Falling back to localStorage.', e);
            this.useLocalStorageFallback = true;
            this.clearLocalStorage(false);
        }
    }

    /**
     * Xóa toàn bộ dữ liệu thử nghiệm (`demo_sandbox_*`) trong IndexedDB và localStorage
     * mà tuyệt đối không chạm tới dữ liệu thật của luồng chính.
     */
    async clearDemoData() {
        this.demoMemoryStore.clear();
        for (const k of this.trackedDemoKeys) {
            this.demoDeletedKeys.add(k);
        }
        const keysSnapshot = Array.from(this.trackedDemoKeys);
        this.trackedDemoKeys.clear();

        this.clearLocalStorage(true);

        if (this.useLocalStorageFallback) {
            return;
        }
        try {
            const db = await this.dbPromise;
            const keysToDelete = new Set<string>(keysSnapshot);
            if (typeof db.getAllKeys === 'function') {
                const allKeys = await db.getAllKeys(STORE_NAME);
                for (const k of allKeys) {
                    if (typeof k === 'string' && k.startsWith(DEMO_SANDBOX_PREFIX)) {
                        keysToDelete.add(k);
                    }
                }
            }
            await Promise.all(
                Array.from(keysToDelete).map(k => db.delete(STORE_NAME, k))
            );
        } catch (_) {}
    }

    private getLocalStorage<T>(key: string): T | undefined {
        try {
            const val = localStorage.getItem(`${DB_NAME}_${key}`);
            if (val === null) return undefined;
            return JSON.parse(val) as T;
        } catch (e) {
            console.error('localStorage get failed:', e);
            return undefined;
        }
    }

    private setLocalStorage(key: string, val: any) {
        try {
            const cleanVal = val !== undefined ? JSON.parse(JSON.stringify(val)) : val;
            localStorage.setItem(`${DB_NAME}_${key}`, JSON.stringify(cleanVal));
        } catch (e) {
            console.error('localStorage set failed:', e);
        }
    }

    private deleteLocalStorage(key: string) {
        try {
            localStorage.removeItem(`${DB_NAME}_${key}`);
        } catch (e) {
            console.error('localStorage delete failed:', e);
        }
    }

    private clearLocalStorage(demoOnly = false) {
        try {
            const prefix = demoOnly
                ? `${DB_NAME}_${DEMO_SANDBOX_PREFIX}`
                : `${DB_NAME}_`;
            const demoPrefix = `${DB_NAME}_${DEMO_SANDBOX_PREFIX}`;
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k) continue;
                if (demoOnly) {
                    if (k.startsWith(prefix)) {
                        keysToRemove.push(k);
                    }
                } else if (k.startsWith(prefix) && !k.startsWith(demoPrefix)) {
                    keysToRemove.push(k);
                }
            }
            for (const k of keysToRemove) {
                localStorage.removeItem(k);
            }
        } catch (e) {
            console.error('localStorage clear failed:', e);
        }
    }
}

export const dbContext = new DBContext();

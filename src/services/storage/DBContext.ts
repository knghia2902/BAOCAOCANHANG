import { openDB, type DBSchema } from 'idb';

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

    constructor() {
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
            this.dbPromise = Promise.reject(e);
        }
    }

    async get<T>(key: string): Promise<T | undefined> {
        if (this.useLocalStorageFallback) {
            return this.getLocalStorage<T>(key);
        }
        try {
            const db = await this.dbPromise;
            return await db.get(STORE_NAME, key);
        } catch (e) {
            console.warn(`IndexedDB get failed for key "${key}". Falling back to localStorage.`, e);
            this.useLocalStorageFallback = true;
            return this.getLocalStorage<T>(key);
        }
    }

    async set(key: string, val: any) {
        if (this.useLocalStorageFallback) {
            this.setLocalStorage(key, val);
            return;
        }
        try {
            const db = await this.dbPromise;
            const cleanVal = val !== undefined ? JSON.parse(JSON.stringify(val)) : val;
            await db.put(STORE_NAME, cleanVal, key);
        } catch (e) {
            console.warn(`IndexedDB set failed for key "${key}". Falling back to localStorage.`, e);
            this.useLocalStorageFallback = true;
            this.setLocalStorage(key, val);
        }
    }

    async delete(key: string) {
        if (this.useLocalStorageFallback) {
            this.deleteLocalStorage(key);
            return;
        }
        try {
            const db = await this.dbPromise;
            await db.delete(STORE_NAME, key);
        } catch (e) {
            console.warn(`IndexedDB delete failed for key "${key}". Falling back to localStorage.`, e);
            this.useLocalStorageFallback = true;
            this.deleteLocalStorage(key);
        }
    }

    async clear() {
        if (this.useLocalStorageFallback) {
            this.clearLocalStorage();
            return;
        }
        try {
            const db = await this.dbPromise;
            await db.clear(STORE_NAME);
        } catch (e) {
            console.warn('IndexedDB clear failed. Falling back to localStorage.', e);
            this.useLocalStorageFallback = true;
            this.clearLocalStorage();
        }
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

    private clearLocalStorage() {
        try {
            const prefix = `${DB_NAME}_`;
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(prefix)) {
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

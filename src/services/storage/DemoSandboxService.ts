/**
 * DemoSandboxService
 * Quản lý bộ nhớ đệm giả lập (Sandbox) cho tài khoản Demo.
 * Giúp người dùng thử nghiệm 100% tính năng (Thêm, Sửa, Xóa, Nạp Excel...)
 * nhưng hoàn toàn chặn mọi lệnh ghi lên Supabase, giữ an toàn tuyệt đối cho dữ liệu thật.
 */

interface DemoTableStore {
    inserted: any[];
    updated: Map<string, any>; // id/ticketNo -> fields
    deletedIds: Set<string>;
}

const STORAGE_PREFIX = 'demo_sandbox_';

class DemoSandboxManager {
    private stores = new Map<string, DemoTableStore>();

    private getStore(tableName: string): DemoTableStore {
        if (!this.stores.has(tableName)) {
            // Khôi phục từ sessionStorage nếu có
            let initial: DemoTableStore = {
                inserted: [],
                updated: new Map(),
                deletedIds: new Set()
            };
            try {
                const saved = sessionStorage.getItem(`${STORAGE_PREFIX}${tableName}`);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    initial = {
                        inserted: parsed.inserted || [],
                        updated: new Map(Object.entries(parsed.updated || {})),
                        deletedIds: new Set(parsed.deletedIds || [])
                    };
                }
            } catch (_) {}

            this.stores.set(tableName, initial);
        }
        return this.stores.get(tableName)!;
    }

    private persist(tableName: string) {
        try {
            const store = this.getStore(tableName);
            const serializable = {
                inserted: store.inserted,
                updated: Object.fromEntries(store.updated),
                deletedIds: Array.from(store.deletedIds)
            };
            sessionStorage.setItem(`${STORAGE_PREFIX}${tableName}`, JSON.stringify(serializable));
        } catch (_) {}
    }

    /** Ghi nhận các bản ghi mới thêm trong phiên Demo */
    addInserted(tableName: string, rows: any | any[]): any[] {
        const store = this.getStore(tableName);
        const list = Array.isArray(rows) ? rows : [rows];
        const withIds = list.map((item, idx) => ({
            id: item.id || `demo_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
            created_at: item.created_at || new Date().toISOString(),
            ...item
        }));
        store.inserted.push(...withIds);
        this.persist(tableName);
        return withIds;
    }

    /** Ghi nhận bản ghi cập nhật trong phiên Demo */
    addUpdated(tableName: string, updates: any, matchField?: string, matchVal?: any) {
        const store = this.getStore(tableName);
        const key = matchVal !== undefined ? String(matchVal) : String(updates.id || updates.ticket_no || updates.plate_number || 'default');
        
        // Cập nhật cả trong danh sách đã insert nếu có
        for (let i = 0; i < store.inserted.length; i++) {
            const row = store.inserted[i];
            const rowKey = matchField ? String(row[matchField]) : String(row.id || row.ticket_no || row.ticketNo);
            if (rowKey === key || (matchVal && String(row[matchField || 'id']) === String(matchVal))) {
                store.inserted[i] = { ...row, ...updates };
            }
        }

        const prev = store.updated.get(key) || {};
        store.updated.set(key, { ...prev, ...updates });
        this.persist(tableName);
    }

    /** Ghi nhận bản ghi đã xóa trong phiên Demo */
    addDeleted(tableName: string, matchField: string, matchVal: any) {
        const store = this.getStore(tableName);
        const valStr = String(matchVal);
        store.deletedIds.add(valStr);

        // Xóa khỏi danh sách inserted nếu có
        store.inserted = store.inserted.filter(item => {
            const itemVal = item[matchField] !== undefined ? String(item[matchField]) : String(item.id || item.ticket_no);
            return itemVal !== valStr;
        });

        this.persist(tableName);
    }

    /** Trộn dữ liệu gốc từ Supabase với dữ liệu thử nghiệm trong bộ nhớ */
    applyOverlay<T = any>(tableName: string, remoteData: T[]): T[] {
        const store = this.getStore(tableName);
        if (!store.inserted.length && !store.updated.size && !store.deletedIds.size) {
            return remoteData;
        }

        // 1. Loại bỏ các dòng đã xóa trong phiên demo
        let result = (remoteData || []).filter((item: any) => {
            const id = String(item.id ?? '');
            const ticketNo = String(item.ticket_no ?? item.ticketNo ?? '');
            const plate = String(item.plate_number ?? item.plateNumber ?? '');
            return !store.deletedIds.has(id) && !store.deletedIds.has(ticketNo) && !store.deletedIds.has(plate);
        });

        // 2. Cập nhật các dòng đã sửa trong phiên demo
        result = result.map((item: any) => {
            const id = String(item.id ?? '');
            const ticketNo = String(item.ticket_no ?? item.ticketNo ?? '');
            const plate = String(item.plate_number ?? item.plateNumber ?? '');
            
            const patch = store.updated.get(id) || store.updated.get(ticketNo) || store.updated.get(plate);
            return patch ? { ...item, ...patch } : item;
        });

        // 3. Thêm các dòng mới thêm trong phiên demo lên đầu
        return [...store.inserted, ...result];
    }

    /** Xóa sạch toàn bộ dữ liệu demo (khôi phục về dữ liệu gốc) */
    reset() {
        this.stores.clear();
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (k && k.startsWith(STORAGE_PREFIX)) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(k => sessionStorage.removeItem(k));
        } catch (_) {}
    }
}

export const DemoSandboxService = new DemoSandboxManager();

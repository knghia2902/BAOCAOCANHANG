/**
 * DemoSandboxService
 * Quản lý bộ nhớ đệm giả lập (Sandbox) cho tài khoản Demo.
 * Giúp người dùng thử nghiệm 100% tính năng (Thêm, Sửa, Xóa, Nạp Excel...)
 * nhưng hoàn toàn chặn mọi lệnh ghi lên Supabase và cô lập IndexedDB/localStorage,
 * giữ an toàn tuyệt đối cho dữ liệu thật ở luồng chính (Production).
 */

interface DemoTableStore {
    inserted: any[];
    updated: Map<string, any>; // id/ticketNo/conflictKey -> fields
    deletedIds: Set<string>;
    clearedAll?: boolean;
}

export interface OverlayOptions {
    filters?: Array<(row: any) => boolean>;
    rangeFrom?: number;
    rangeTo?: number;
}

export const DEMO_SANDBOX_PREFIX = 'demo_sandbox_';
const STORAGE_PREFIX = DEMO_SANDBOX_PREFIX;
const IDB_FALLBACK_DEMO_PREFIX = `ngocanh-portfolio-db_${DEMO_SANDBOX_PREFIX}`;

function extractRowIdentifiers(item: any, conflictKey?: string): string[] {
    if (!item || typeof item !== 'object') return [];
    const keys: string[] = [];
    if (conflictKey) {
        const cols = conflictKey.split(',').map(c => c.trim()).filter(Boolean);
        const firstCol = cols[0];
        if (cols.length === 1 && firstCol) {
            const val = item[firstCol];
            if (val !== undefined && val !== null && val !== '') {
                keys.push(String(val));
            }
        } else if (cols.length > 1) {
            const composite = cols.map(c => String(item[c] ?? '')).join('::');
            if (composite.replace(/:/g, '') !== '') {
                keys.push(composite);
            }
        }
    }
    const candidateFields = [
        'id',
        'ticket_no',
        'ticketNo',
        'plate_number',
        'plateNumber',
        'warehouse_id',
        'warehouseId',
        'vehicle_plate',
        'vehiclePlate'
    ];
    for (const f of candidateFields) {
        const v = item[f];
        if (v !== undefined && v !== null && String(v) !== '') {
            keys.push(String(v));
        }
    }
    if (item.barge_id !== undefined && item.source_ticket_no !== undefined) {
        keys.push(`${item.barge_id}::${item.source_ticket_no}`);
    }
    return Array.from(new Set(keys));
}

class DemoSandboxManager {
    private stores = new Map<string, DemoTableStore>();
    private resetCallbacks: Array<() => void> = [];

    /**
     * Kiểm tra phiên hiện tại có đang ở Chế độ Thử Nghiệm (Demo Sandbox) hay không.
     * Kiểm tra chặt chẽ trạng thái xác thực, user === 'demo' và thời hạn phiên (portfolio_login_expiry / expiresAt).
     */
    isDemoMode(): boolean {
        if (typeof window === 'undefined') return false;
        try {
            // 1. Kiểm tra thời hạn đăng nhập (portfolio_login_expiry) nếu có
            const rawExpiry = localStorage.getItem('portfolio_login_expiry');
            if (rawExpiry !== null && rawExpiry !== '') {
                const expiryTime = Number(rawExpiry);
                if (!Number.isNaN(expiryTime) && Date.now() > expiryTime) {
                    localStorage.removeItem('portfolio_login_expiry');
                    if (localStorage.getItem('portfolio_user') === 'demo') {
                        localStorage.removeItem('portfolio_user');
                    }
                    const expiredSessionRaw = localStorage.getItem('auth_session');
                    if (expiredSessionRaw) {
                        try {
                            const parsedSession = JSON.parse(expiredSessionRaw);
                            if (parsedSession?.isDemoMode || parsedSession?.user === 'demo') {
                                localStorage.removeItem('auth_session');
                            }
                        } catch (_) {}
                    }
                    return false;
                }
            }

            // 2. Kiểm tra từ auth_session chuẩn
            const session = localStorage.getItem('auth_session');
            if (session) {
                const parsed = JSON.parse(session);
                if (parsed && typeof parsed === 'object') {
                    const sessionExpiry = parsed.expiresAt ?? parsed.loginExpiry;
                    if (sessionExpiry !== undefined && sessionExpiry !== null && sessionExpiry !== '') {
                        const expNum = Number(sessionExpiry);
                        if (!Number.isNaN(expNum) && Date.now() > expNum) {
                            localStorage.removeItem('auth_session');
                            return false;
                        }
                    }
                    if (parsed.isAuthenticated === false) {
                        return false;
                    }
                    if (parsed.user && parsed.user !== 'demo') {
                        return false;
                    }
                    if (parsed.isDemoMode === true) {
                        return true;
                    }
                }
            }

            // 3. Tương thích ngược nếu có cờ portfolio_user === 'demo'
            if (localStorage.getItem('portfolio_user') === 'demo') {
                return true;
            }
        } catch (_) {}
        return false;
    }

    /**
     * Chuẩn hóa khóa lưu trữ (IndexedDB / localStorage):
     * Tự động gắn tiền tố `demo_sandbox_` khi đang ở chế độ Demo.
     */
    resolveKey(key: string): string {
        if (this.isDemoMode() && !key.startsWith(STORAGE_PREFIX)) {
            return `${STORAGE_PREFIX}${key}`;
        }
        return key;
    }

    /**
     * Đọc localStorage có cô lập Demo (nếu ở Demo chưa ghi đè thì đọc giá trị mặc định của hệ thống)
     */
    getLocalItem(key: string): string | null {
        if (typeof window === 'undefined') return null;
        try {
            if (this.isDemoMode()) {
                const demoVal = localStorage.getItem(this.resolveKey(key));
                if (demoVal !== null) return demoVal;
            }
            return localStorage.getItem(key);
        } catch (_) {
            return null;
        }
    }

    /**
     * Ghi localStorage có cô lập Demo (khi ở Demo chỉ ghi vào khóa `demo_sandbox_*`)
     */
    setLocalItem(key: string, value: string): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(this.resolveKey(key), value);
        } catch (_) {}
    }

    /**
     * Xóa localStorage có cô lập Demo
     */
    removeLocalItem(key: string): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(this.resolveKey(key));
        } catch (_) {}
    }

    /**
     * Đăng ký callback dọn dẹp khi reset Demo Sandbox (ví dụ: DBContext dọn các khóa demo trong IndexedDB)
     */
    onReset(cb: () => void): void {
        this.resetCallbacks.push(cb);
    }

    private getStore(tableName: string): DemoTableStore {
        if (!this.stores.has(tableName)) {
            let initial: DemoTableStore = {
                inserted: [],
                updated: new Map(),
                deletedIds: new Set(),
                clearedAll: false
            };
            try {
                const saved = sessionStorage.getItem(`${STORAGE_PREFIX}${tableName}`);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    initial = {
                        inserted: parsed.inserted || [],
                        updated: new Map(Object.entries(parsed.updated || {})),
                        deletedIds: new Set(parsed.deletedIds || []),
                        clearedAll: !!parsed.clearedAll
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
                deletedIds: Array.from(store.deletedIds),
                clearedAll: !!store.clearedAll
            };
            sessionStorage.setItem(`${STORAGE_PREFIX}${tableName}`, JSON.stringify(serializable));
        } catch (_) {}
    }

    /** Ghi nhận các bản ghi mới thêm hoặc upsert trong phiên Demo */
    addInserted(tableName: string, rows: any | any[], conflictKey?: string): any[] {
        const store = this.getStore(tableName);
        const list = Array.isArray(rows) ? rows : [rows];
        const withIds = list.map((item, idx) => ({
            id: item?.id || `demo_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
            created_at: item?.created_at || new Date().toISOString(),
            ...item
        }));

        const keyToIdx = new Map<string, number>();
        for (let i = 0; i < store.inserted.length; i++) {
            const existingKeys = extractRowIdentifiers(store.inserted[i], conflictKey);
            for (const k of existingKeys) {
                if (!keyToIdx.has(k)) keyToIdx.set(k, i);
            }
        }

        for (const newRow of withIds) {
            const rowKeys = extractRowIdentifiers(newRow, conflictKey);
            let existingIdx = -1;
            for (const k of rowKeys) {
                store.deletedIds.delete(k);
                const prevPatch = store.updated.get(k) || {};
                store.updated.set(k, { ...prevPatch, ...newRow });
                if (existingIdx === -1 && keyToIdx.has(k)) {
                    existingIdx = keyToIdx.get(k)!;
                }
            }

            // Nếu đã tồn tại trong store.inserted (theo conflictKey hoặc id/natural key) thì cập nhật tại chỗ O(1) tránh nhân đôi
            if (existingIdx !== -1) {
                store.inserted[existingIdx] = { ...store.inserted[existingIdx], ...newRow };
                for (const k of rowKeys) {
                    keyToIdx.set(k, existingIdx);
                }
            } else {
                const newIdx = store.inserted.length;
                store.inserted.push(newRow);
                for (const k of rowKeys) {
                    keyToIdx.set(k, newIdx);
                }
            }
        }

        this.persist(tableName);
        return withIds;
    }

    /** Ghi nhận bản ghi cập nhật trong phiên Demo */
    addUpdated(tableName: string, updates: any, matchField?: string, matchVal?: any) {
        const store = this.getStore(tableName);
        const key = matchVal !== undefined
            ? String(matchVal)
            : String(updates?.id || updates?.ticket_no || updates?.plate_number || updates?.warehouse_id || 'default');

        for (let i = 0; i < store.inserted.length; i++) {
            const row = store.inserted[i];
            const rowKey = matchField ? String(row[matchField]) : String(row.id || row.ticket_no || row.ticketNo);
            if (rowKey === key || (matchVal !== undefined && String(row[matchField || 'id']) === String(matchVal))) {
                store.inserted[i] = { ...row, ...updates };
            }
        }

        const prev = store.updated.get(key) || {};
        store.updated.set(key, { ...prev, ...updates });
        this.persist(tableName);
    }

    /** Ghi nhận bản ghi đã xóa trong phiên Demo */
    addDeleted(tableName: string, matchField: string, matchVal: any) {
        this.addDeletedMany(tableName, matchField, [matchVal]);
    }

    /** Ghi nhận nhiều bản ghi đã xóa (.delete().in(...)) trong phiên Demo */
    addDeletedMany(tableName: string, matchField: string, matchVals: any[]) {
        const store = this.getStore(tableName);
        const valSet = new Set(matchVals.filter(v => v !== undefined && v !== null).map(v => String(v)));
        if (valSet.size === 0) return;

        for (const v of valSet) {
            store.deletedIds.add(v);
        }

        store.inserted = store.inserted.filter(item => {
            const itemVal = item[matchField] !== undefined ? String(item[matchField]) : String(item.id || item.ticket_no);
            return !valSet.has(itemVal);
        });

        this.persist(tableName);
    }

    /** Ghi nhận lệnh xóa toàn bảng (.delete().neq(col, val)) trong phiên Demo */
    addDeleteNeq(tableName: string, matchField: string, matchVal: any) {
        const store = this.getStore(tableName);
        const valStr = String(matchVal);
        store.clearedAll = true;
        store.inserted = store.inserted.filter(item => {
            const itemVal = item[matchField] !== undefined ? String(item[matchField]) : String(item.id ?? '');
            return itemVal === valStr;
        });
        this.persist(tableName);
    }

    /** Trộn dữ liệu gốc từ Supabase với dữ liệu thử nghiệm trong bộ nhớ */
    applyOverlay<T = any>(tableName: string, remoteData: T[], options?: OverlayOptions): T[] {
        const store = this.getStore(tableName);
        const hasChanges = store.inserted.length > 0 || store.updated.size > 0 || store.deletedIds.size > 0 || store.clearedAll;
        if (!hasChanges) {
            return remoteData || [];
        }

        const baseRemote = store.clearedAll ? [] : (remoteData || []);

        // Tập khóa của các dòng trong store.inserted để tránh trùng lặp khi upsert dòng đã có trên remote
        const insertedKeySet = new Set<string>();
        for (const ins of store.inserted) {
            for (const k of extractRowIdentifiers(ins)) {
                insertedKeySet.add(k);
            }
        }

        // 1. Loại bỏ các dòng đã xóa trong phiên demo hoặc đã được thay thế trong store.inserted
        let result = baseRemote.filter((item: any) => {
            const itemKeys = extractRowIdentifiers(item);
            if (itemKeys.some(k => store.deletedIds.has(k))) {
                return false;
            }
            if (itemKeys.some(k => insertedKeySet.has(k))) {
                return false;
            }
            return true;
        });

        // 2. Cập nhật các dòng đã sửa trong phiên demo
        result = result.map((item: any) => {
            const itemKeys = extractRowIdentifiers(item);
            let mergedItem = item;
            for (const k of itemKeys) {
                const patch = store.updated.get(k);
                if (patch) {
                    mergedItem = { ...mergedItem, ...patch };
                }
            }
            if (store.updated.has('main') && (tableName === 'content' || (item as any)?.id === undefined)) {
                mergedItem = { ...mergedItem, ...store.updated.get('main') };
            }
            return mergedItem;
        });

        // 3. Thêm các dòng mới thêm trong phiên demo lên đầu (chỉ ở trang đầu khi phân trang .range)
        const shouldPrependInserted = !options?.rangeFrom || options.rangeFrom === 0;
        let prepended = shouldPrependInserted ? [...store.inserted] : [];
        if (options?.filters && options.filters.length > 0) {
            prepended = prepended.filter(row => options.filters!.every(fn => fn(row)));
            result = result.filter(row => options.filters!.every(fn => fn(row)));
        }

        return [...prepended, ...result];
    }

    /** Xóa sạch toàn bộ dữ liệu demo (khôi phục về dữ liệu gốc) */
    reset() {
        this.stores.clear();
        try {
            if (typeof sessionStorage !== 'undefined') {
                const sessionKeysToRemove: string[] = [];
                for (let i = 0; i < sessionStorage.length; i++) {
                    const k = sessionStorage.key(i);
                    if (k && k.startsWith(STORAGE_PREFIX)) {
                        sessionKeysToRemove.push(k);
                    }
                }
                sessionKeysToRemove.forEach(k => sessionStorage.removeItem(k));
            }
        } catch (_) {}

        try {
            if (typeof localStorage !== 'undefined') {
                const localKeysToRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith(STORAGE_PREFIX) || k.startsWith(IDB_FALLBACK_DEMO_PREFIX))) {
                        localKeysToRemove.push(k);
                    }
                }
                localKeysToRemove.forEach(k => localStorage.removeItem(k));
            }
        } catch (_) {}

        for (const cb of this.resetCallbacks) {
            try {
                cb();
            } catch (_) {}
        }
    }
}

export const DemoSandboxService = new DemoSandboxManager();

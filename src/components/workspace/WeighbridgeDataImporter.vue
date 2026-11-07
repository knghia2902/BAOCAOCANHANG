<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useToast } from '@/composables/useToast';
import { dbContext } from '@/services/storage/DBContext';
import { supabase } from '@/supabase';
import { authStore, hasDetailPermission } from '@/stores/auth';
import { LogService } from '@/services/storage/LogService';
import { AllocatorService } from '@/services/excel/AllocatorService';
import { VehicleService } from '@/services/excel/VehicleService';
import { WeighbridgeService, normalizeMainPlate, isSameScaleTicket, deduplicateBargeTrucks } from '@/services/excel/WeighbridgeService';
import {
    WarehouseInventoryService,
    classifyWeighbridgeRow,
    parseWeighbridgeFile,
    normalizeWeightToKg,
    parseToIsoDate,
    parseToTimeStr,
    formatIsoToDmy,
    type RawWeighbridgeRow
} from '@/services/excel/WarehouseInventoryService';
import type { WarehouseId, WarehouseInventoryTicket } from '@/types/excel';
import WeighbridgeOtherManager from '@/components/tools/WeighbridgeOtherManager.vue';

const emit = defineEmits<{
    (e: 'view-inventory'): void;
    (e: 'view-shipment'): void;
    (e: 'view-deheus'): void;
}>();

const { addToast } = useToast();

interface CSVRecord {
    id?: string;
    ticketNo: string;
    sourceTicketNo?: string;
    plateNumber: string;
    customer: string;
    weight1: number;
    weight2: number;
    weightNet: number; // in kg
    dateInStr: string;
    timeInStr: string;
    dateOutStr: string;
    timeOutStr: string;
    date1Obj?: string | Date | null;
    date2Obj?: string | Date | null;
    direction: string; // Xuat/Nhap
    cargoType: string;
    bargeName: string;
    driverName: string;
    notes: string;
    orderNo?: string;
    fileSource?: 'FILE_1' | 'FILE_2' | 'MANUAL';
}

interface SplitTrip {
    id?: number;
    stt: number;
    timeStr: string;
    plateNumber: string;
    tttp: number;
    limit: number;
    ticketNo: string;
    sourceTicketNo?: string;
    cargoType: string;
    weightTons: number;
    notes: string;
    customer: string;
    weight1: number;
    weight2: number;
    weightNet: number;
    direction: string;
    bargeName: string;
    date1Obj: Date;
    date2Obj: Date;
    orderNo?: string;
}

// Main view tabs (như trước đây: 1. Phiếu cân | 2. Sổ theo dõi | 3. Cân Kho & Container)
const activeMainTab = ref<'source' | 'history' | 'other_tickets'>('source');
const sourceQuickFilter = ref<'all' | 'has_order' | 'file1' | 'file2'>('all');

// File inputs & loading states
const file1InputRef = ref<HTMLInputElement | null>(null);
const file2InputRef = ref<HTMLInputElement | null>(null);
const multiFileInputRef = ref<HTMLInputElement | null>(null);

const file1Name = ref('');
const file2Name = ref('');
const file1Stats = ref({ total: 0, orderCount: 0, whImportCount: 0, netKg: 0 });
const file2Stats = ref({ total: 0, orderCount: 0, whExportCount: 0, whDirectCount: 0, netKg: 0 });

const loadingFile1 = ref(false);
const loadingFile2 = ref(false);
const loadingMulti = ref(false);
const isSavingToHistory = ref(false);
const compiling = ref(false);
const isInitLoading = ref(false);
const syncStatus = ref<'synced' | 'saving' | 'error'>('synced');

// Core data states (allocator_tickets & allocator_history_trips)
const csvRecords = ref<CSVRecord[]>([]);
const existingTrips = ref<SplitTrip[]>([]);
const vehiclesList = ref<{ plateNumber: string; moocNumber: string }[]>([]);

// Pagination & search & sort
const itemsPerPage = ref(20);
const sourceCurrentPage = ref(1);
const sourceSearchQuery = ref('');
const sourceSortKey = ref<string>('');
const sourceSortDesc = ref<boolean>(false);

const historyCurrentPage = ref(1);
const historySearchQuery = ref('');
const historySortKey = ref<string>('');
const historySortDesc = ref<boolean>(false);

watch(itemsPerPage, () => {
    sourceCurrentPage.value = 1;
    historyCurrentPage.value = 1;
});

watch([sourceSearchQuery, sourceQuickFilter], () => {
    sourceCurrentPage.value = 1;
});

watch(historySearchQuery, () => {
    historyCurrentPage.value = 1;
});

// BroadcastChannel sync (chuẩn CargoAllocator.vue & WeighbridgePrinter.vue)
const syncChannel = new BroadcastChannel('allocator_sync_channel');
let isSyncingFromChannel = false;

syncChannel.onmessage = async (event) => {
    try {
        isSyncingFromChannel = true;
        if (event.data.type === 'tickets') {
            const saved = await dbContext.get<CSVRecord[]>('allocator_tickets');
            if (saved && Array.isArray(saved)) {
                if (JSON.stringify(csvRecords.value) !== JSON.stringify(saved)) {
                    csvRecords.value = saved;
                }
            }
        } else if (event.data.type === 'history') {
            const savedHistory = await dbContext.get<SplitTrip[]>('allocator_history_trips');
            if (savedHistory && Array.isArray(savedHistory)) {
                if (JSON.stringify(existingTrips.value) !== JSON.stringify(savedHistory)) {
                    existingTrips.value = savedHistory;
                }
            }
        } else if (event.data.type === 'vehicles') {
            const savedVehicles = await dbContext.get<any[]>('allocator_vehicles');
            if (savedVehicles && Array.isArray(savedVehicles)) {
                vehiclesList.value = savedVehicles;
            }
        } else if (event.data.type === 'sync_response') {
            addToast(event.data.message, event.data.status || 'success');
        }
    } catch (e) {
        console.error('Lỗi đồng bộ kênh allocator_sync_channel:', e);
    } finally {
        await nextTick();
        isSyncingFromChannel = false;
    }
};

onUnmounted(() => {
    try {
        syncChannel.close();
    } catch (_) {}
});

// Confirm dialog state
interface ConfirmDialogState {
    show: boolean;
    title: string;
    message: string;
    type: 'warning' | 'danger' | 'info' | 'success';
    okText?: string;
    cancelText?: string;
    onOk?: () => void;
    onCancel?: () => void;
}

const confirmDialog = ref<ConfirmDialogState>({
    show: false,
    title: '',
    message: '',
    type: 'info'
});

function showConfirm(options: Omit<ConfirmDialogState, 'show'>) {
    return new Promise<boolean>((resolve) => {
        confirmDialog.value = {
            show: true,
            title: options.title,
            message: options.message,
            type: options.type,
            okText: options.okText || 'Xác nhận',
            cancelText: options.cancelText || 'Hủy',
            onOk: () => {
                confirmDialog.value.show = false;
                resolve(true);
            },
            onCancel: () => {
                confirmDialog.value.show = false;
                resolve(false);
            }
        };
    });
}

// Helpers for plate & date formatting (giữ nguyên như CargoAllocator.vue)
function normalizePlate(plate: string | null | undefined): string {
    if (!plate) return '';
    return String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function formatPlate(plate: string | null | undefined): string {
    if (!plate) return '';
    const clean = String(plate).trim().toUpperCase().replace(/\s+/g, '');
    let mainPlate = clean;
    let existingMooc = '';
    if (clean.includes('/')) {
        const parts = clean.split('/');
        mainPlate = parts[0] || '';
        existingMooc = parts[1] || '';
    }

    let formattedMain = mainPlate;
    if (!mainPlate.includes('-')) {
        const match = mainPlate.match(/^([0-9]{2}[A-Z]{1,2})([0-9]+)$/);
        if (match) {
            formattedMain = match[1] + '-' + match[2];
        }
    }

    const normalized = normalizePlate(mainPlate);
    const matches = vehiclesList.value.filter(v => normalizePlate(v.plateNumber) === normalized);
    const vehicle = matches.find(v => v.moocNumber && v.moocNumber.trim() !== '') || matches[0];
    const targetMooc = vehicle && vehicle.moocNumber ? vehicle.moocNumber : existingMooc;

    if (targetMooc) {
        const cleanMooc = targetMooc.trim().toUpperCase().replace(/\s+/g, '');
        let formattedMooc = cleanMooc;
        if (!cleanMooc.includes('-')) {
            const match = cleanMooc.match(/^([0-9]{2}[A-Z]{1,2})([0-9]+)$/);
            if (match) {
                formattedMooc = match[1] + '-' + match[2];
            }
        }
        return `${formattedMain}/${formattedMooc}`;
    }

    return formattedMain;
}

function parseDateTime(dateStr: string, timeStr: string): Date {
    try {
        if (!dateStr) return new Date();
        if (dateStr.includes(' ') && !timeStr) {
            const parts = dateStr.split(' ');
            dateStr = parts[0] || '';
            timeStr = parts[1] || '';
        }
        const normalizedDate = dateStr.replace(/-/g, '/');
        const dParts = normalizedDate.split('/');
        let day = 1;
        let month = 0;
        let year = new Date().getFullYear();

        if (dParts.length >= 3) {
            const p0 = dParts[0] || '';
            const p1 = dParts[1] || '';
            const p2 = dParts[2] || '';
            if (p0.length === 4) {
                year = parseInt(p0, 10);
                month = parseInt(p1 || '1', 10) - 1;
                day = parseInt(p2 || '1', 10);
            } else {
                day = parseInt(p0 || '1', 10);
                month = parseInt(p1 || '1', 10) - 1;
                year = parseInt(p2 || '0', 10);
                if (year < 100) year += 2000;
            }
        }

        let hour = 0;
        let minute = 0;
        let second = 0;
        if (timeStr) {
            const tParts = timeStr.split(':');
            hour = parseInt(tParts[0] || '0', 10);
            minute = parseInt(tParts[1] || '0', 10);
            second = parseInt(tParts[2] || '0', 10);
        }
        const d = new Date(year, month, day, hour, minute, second);
        return isNaN(d.getTime()) ? new Date() : d;
    } catch (_) {
        return new Date();
    }
}

function ensureDate(d: any): Date {
    if (d instanceof Date) return d;
    if (!d) return new Date();
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toLocalISOString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

function formatExcelDate(date: any): string {
    const d = ensureDate(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
}

function formatExcelDateTimeCombined(date: any): string {
    const d = ensureDate(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hh}:${mm}`;
}

// Convert RawWeighbridgeRow to CSVRecord
function convertRawRowToCSVRecord(r: RawWeighbridgeRow, sourceTag: 'FILE_1' | 'FILE_2'): CSVRecord | null {
    const ticketNo = String(r.soPhieu || '').trim();
    const plateNumber = String(r.soXe || '').trim();
    if (!plateNumber) return null;

    const weight1 = normalizeWeightToKg(r.kl1);
    const weight2 = normalizeWeightToKg(r.kl2);
    let weightNet = normalizeWeightToKg(r.klHang);
    if (weightNet <= 0 && weight1 > 0 && weight2 > 0) {
        weightNet = Math.abs(weight1 - weight2);
    }
    if (weightNet <= 0) return null;

    const dInIso = parseToIsoDate(r.ngay1 || r.ngay2);
    const dOutIso = parseToIsoDate(r.ngay2 || r.ngay1);
    const dateInStr = formatIsoToDmy(dInIso) || String(r.ngay1 || '').trim();
    const dateOutStr = formatIsoToDmy(dOutIso) || String(r.ngay2 || '').trim();
    const timeInStr = parseToTimeStr(r.gio1) || String(r.gio1 || '').trim();
    const timeOutStr = parseToTimeStr(r.gio2) || String(r.gio2 || '').trim();

    return {
        id: `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ticketNo,
        sourceTicketNo: ticketNo,
        plateNumber,
        customer: String(r.khachHang || '').trim(),
        weight1,
        weight2,
        weightNet,
        dateInStr,
        timeInStr,
        dateOutStr,
        timeOutStr,
        date1Obj: dInIso ? `${dInIso}T${timeInStr || '00:00:00'}` : null,
        date2Obj: dOutIso ? `${dOutIso}T${timeOutStr || '00:00:00'}` : null,
        direction: String(r.xuatNhap || (sourceTag === 'FILE_1' ? 'Nhap' : 'Xuat')).trim(),
        cargoType: String(r.loaiHang || '').trim(),
        bargeName: String(r.loaiSalan || '').trim(),
        driverName: String(r.taiXe || '').trim(),
        notes: String(r.ghiChu || '').trim(),
        orderNo: String(r.maLenh || '').trim(),
        fileSource: sourceTag
    };
}

// Check duplicates in Sổ theo dõi (existingTrips)
function getHistoryDuplicates(records: CSVRecord[]): { dupRecords: CSVRecord[]; description: string } {
    const dupRecords: CSVRecord[] = [];
    records.forEach(rec => {
        const isDup = existingTrips.value.some(et => {
            if (isSameScaleTicket(rec, et)) return true;
            if (rec.plateNumber && et.plateNumber) {
                const recDate = parseDateTime(rec.dateInStr, rec.timeInStr);
                const etDate = ensureDate(et.date1Obj);
                return (
                    normalizeMainPlate(rec.plateNumber) === normalizeMainPlate(et.plateNumber) &&
                    Math.abs(Number(rec.weightNet || 0) - Number(et.weightNet || 0)) <= 0.01 &&
                    formatExcelDate(recDate) === formatExcelDate(etDate)
                );
            }
            return false;
        });
        if (isDup) dupRecords.push(rec);
    });

    const desc = dupRecords
        .slice(0, 15)
        .map(r =>
            r.ticketNo
                ? `- Phiếu ${r.ticketNo} (${formatPlate(r.plateNumber)} - Lệnh: ${r.orderNo || '-'})`
                : `- Xe ${formatPlate(r.plateNumber)} (${r.weightNet.toLocaleString()} kg)`
        )
        .join('\n');
    return { dupRecords, description: dupRecords.length > 15 ? `${desc}\n... và ${dupRecords.length - 15} phiếu khác` : desc };
}

// Merge tickets into csvRecords (dedup by ticketNo / physical scale signature)
function mergeTickets(newRecords: CSVRecord[]): { added: number; updated: number; skipped: number } {
    const { uniqueTrucks: currentList } = deduplicateBargeTrucks([...csvRecords.value]);
    let added = 0;
    let updated = 0;
    let skipped = 0;

    newRecords.forEach(rec => {
        const matchIdx = currentList.findIndex(x => isSameScaleTicket(x, rec));
        const id = rec.id || 'ticket_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const mergedRec: CSVRecord = { ...rec, id };

        if (matchIdx !== -1) {
            const existing = currentList[matchIdx]!;
            const preservedId = existing.id || id;
            const nextRec: CSVRecord = {
                ...existing,
                ...rec,
                id: preservedId,
                ticketNo: rec.ticketNo || existing.ticketNo || '',
                orderNo: rec.orderNo || existing.orderNo || '',
                fileSource: rec.fileSource || existing.fileSource
            };
            if (
                existing.ticketNo === nextRec.ticketNo &&
                existing.plateNumber === nextRec.plateNumber &&
                existing.weightNet === nextRec.weightNet &&
                (existing.orderNo || '') === (nextRec.orderNo || '') &&
                (existing.notes || '') === (nextRec.notes || '')
            ) {
                skipped++;
            } else {
                currentList[matchIdx] = nextRec;
                updated++;
            }
        } else {
            currentList.push(mergedRec);
            added++;
        }
    });

    csvRecords.value = currentList;
    return { added, updated, skipped };
}

// Save & Load allocator_tickets from Supabase & IndexedDB
let saveSupabaseTimer: any = null;
let isSavingSupabase = false;

async function doExecuteSaveTicketsToSupabase() {
    syncStatus.value = 'saving';
    try {
        const { data: current, error: fetchError } = await supabase
            .from('content')
            .select('settings')
            .eq('id', 'main')
            .single();

        if (fetchError) throw fetchError;
        const currentSettings = current?.settings || {};

        const cleanTickets = (csvRecords.value || []).map(r => ({
            id: r.id,
            ticketNo: r.ticketNo,
            sourceTicketNo: r.sourceTicketNo || r.ticketNo || '',
            plateNumber: r.plateNumber,
            customer: r.customer || '',
            weight1: r.weight1,
            weight2: r.weight2,
            weightNet: r.weightNet,
            dateInStr: r.dateInStr || '',
            timeInStr: r.timeInStr || '',
            dateOutStr: r.dateOutStr || '',
            timeOutStr: r.timeOutStr || '',
            date1Obj: r.date1Obj || (r.dateInStr ? toLocalISOString(parseDateTime(r.dateInStr, r.timeInStr)) : null),
            date2Obj: r.date2Obj || (r.dateOutStr ? toLocalISOString(parseDateTime(r.dateOutStr, r.timeOutStr)) : null),
            direction: r.direction || '',
            cargoType: r.cargoType || '',
            bargeName: r.bargeName || '',
            driverName: r.driverName || '',
            notes: r.notes || '',
            orderNo: r.orderNo || '',
            fileSource: r.fileSource || ''
        }));

        const updatedSettings: any = {
            ...currentSettings,
            allocator_tickets: cleanTickets
        };
        delete updatedSettings.allocator_generated_trips;

        const { error: updateError } = await supabase
            .from('content')
            .update({ settings: updatedSettings })
            .eq('id', 'main');

        if (updateError) throw updateError;
        syncStatus.value = 'synced';
    } catch (e) {
        console.error('Lỗi khi lưu dữ liệu lên Supabase:', e);
        syncStatus.value = 'error';
    }
}

function saveTicketsToSupabase(): Promise<void> {
    return new Promise((resolve) => {
        if (saveSupabaseTimer) clearTimeout(saveSupabaseTimer);
        saveSupabaseTimer = setTimeout(async () => {
            if (isSavingSupabase) {
                saveSupabaseTimer = setTimeout(() => {
                    saveTicketsToSupabase().then(resolve);
                }, 300);
                return;
            }
            isSavingSupabase = true;
            try {
                await doExecuteSaveTicketsToSupabase();
            } finally {
                isSavingSupabase = false;
                resolve();
            }
        }, 150);
    });
}

// Auto-save watch on csvRecords & existingTrips
watch(
    csvRecords,
    async (newVal) => {
        if (isSyncingFromChannel || isInitLoading.value) return;
        try {
            await dbContext.set('allocator_tickets', newVal);
            syncChannel.postMessage({ type: 'tickets' });
        } catch (e) {
            console.error('Lỗi khi lưu allocator_tickets vào IndexedDB:', e);
        }
    },
    { deep: true }
);

watch(
    existingTrips,
    async (newVal) => {
        if (isSyncingFromChannel || isInitLoading.value) return;
        try {
            await dbContext.set('allocator_history_trips', newVal);
            syncChannel.postMessage({ type: 'history' });
        } catch (e) {
            console.error('Lỗi khi lưu allocator_history_trips vào IndexedDB:', e);
        }
    },
    { deep: true }
);

async function loadInitialData() {
    isInitLoading.value = true;
    try {
        // 1. Load local cache immediately
        const [localTickets, localHistory, localVehicles] = await Promise.all([
            dbContext.get<CSVRecord[]>('allocator_tickets'),
            dbContext.get<SplitTrip[]>('allocator_history_trips'),
            dbContext.get<any[]>('allocator_vehicles')
        ]);
        if (localTickets && Array.isArray(localTickets)) csvRecords.value = localTickets;
        if (localHistory && Array.isArray(localHistory)) existingTrips.value = localHistory;
        if (localVehicles && Array.isArray(localVehicles)) vehiclesList.value = localVehicles;

        // 2. Sync from Supabase
        const { data, error } = await supabase
            .from('content')
            .select('settings')
            .eq('id', 'main')
            .single();

        if (!error && data?.settings) {
            isSyncingFromChannel = true;
            const remoteTickets = data.settings.allocator_tickets;
            if (Array.isArray(remoteTickets)) {
                const { uniqueTrucks: dedupedRemote } = deduplicateBargeTrucks(remoteTickets as CSVRecord[]);
                csvRecords.value = dedupedRemote;
                await dbContext.set('allocator_tickets', dedupedRemote);
            }

            try {
                const allTrips = await AllocatorService.getAllTrips();
                if (allTrips && allTrips.length > 0) {
                    existingTrips.value = allTrips as SplitTrip[];
                    await dbContext.set('allocator_history_trips', allTrips);
                }
            } catch (_) {}

            try {
                const remoteVehicles = await VehicleService.getVehicles();
                if (Array.isArray(remoteVehicles) && remoteVehicles.length > 0) {
                    vehiclesList.value = remoteVehicles;
                    await dbContext.set('allocator_vehicles', remoteVehicles);
                }
            } catch (_) {}

            syncStatus.value = 'synced';
        }
    } catch (e) {
        console.warn('Lỗi tải dữ liệu ban đầu:', e);
    } finally {
        await nextTick();
        isSyncingFromChannel = false;
        isInitLoading.value = false;
    }
}

onMounted(() => {
    loadInitialData();
});

/**
 * CORE PIPELINE: Xử lý nạp File 1 hoặc File 2
 * - File 1: Nhập hàng vào kho & Nhập thẳng (từ sà lan tại Cảng về nhà máy)
 * - File 2: Xuất hàng từ kho xuống sà lan tại Cảng, và từ nhà máy xuống sà lan tại Cảng
 * - Các xe có cột "Ma lenh" sẽ dùng để làm Báo cáo lô hàng (nạp vào allocator_tickets & đồng bộ sà lan theo Mã lệnh)
 * - Các xe thuộc Kho 1..4 (IMPORT / EXPORT / DIRECT) tự động cập nhật Báo cáo tồn kho 4 kho (WarehouseInventoryService)
 */
async function processWeighbridgeUpload(files: FileList | File[], sourceRole: 'FILE_1' | 'FILE_2' | 'AUTO') {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;

    const isFile1 = sourceRole === 'FILE_1';
    const isFile2 = sourceRole === 'FILE_2';
    if (isFile1) loadingFile1.value = true;
    else if (isFile2) loadingFile2.value = true;
    else loadingMulti.value = true;

    try {
        const vehicleMap = await WarehouseInventoryService.getVehicles();
        const configs = await WarehouseInventoryService.getConfigs();
        let vessels: any[] = [];
        try {
            vessels = await WeighbridgeService.getVessels();
        } catch (_) {}

        const allRawRows: { row: RawWeighbridgeRow; tag: 'FILE_1' | 'FILE_2' }[] = [];

        for (const f of fileArr) {
            const rows = await parseWeighbridgeFile(f);
            const nameLower = f.name.toLowerCase();
            let resolvedTag: 'FILE_1' | 'FILE_2' = 'FILE_1';
            if (sourceRole === 'FILE_1') {
                resolvedTag = 'FILE_1';
                file1Name.value = f.name;
            } else if (sourceRole === 'FILE_2') {
                resolvedTag = 'FILE_2';
                file2Name.value = f.name;
            } else {
                const isCc2 = nameLower.includes('cc2') || nameLower.includes('cc 2') || nameLower.includes('xuat');
                resolvedTag = isCc2 ? 'FILE_2' : 'FILE_1';
                if (resolvedTag === 'FILE_1') file1Name.value = f.name;
                else file2Name.value = f.name;
            }

            rows.forEach(r => allRawRows.push({ row: r, tag: resolvedTag }));
        }

        if (allRawRows.length === 0) {
            addToast('Không tìm thấy dòng phiếu cân hợp lệ nào trong tệp đã chọn!', 'error');
            return;
        }

        // 1. Phân loại vào Báo cáo Tồn kho 4 Kho (IMPORT / EXPORT / DIRECT)
        const classifiedWhTickets: WarehouseInventoryTicket[] = [];
        const updatedWhSet = new Set<WarehouseId>();
        let impCount = 0;
        let expCount = 0;
        let dirCount = 0;

        for (const item of allRawRows) {
            const raw = { ...item.row };
            // Nếu người dùng nạp qua ô File 1 hoặc File 2 mà cột Xuat/Nhap bị trống, gán mặc định theo luồng file
            if (!String(raw.xuatNhap || '').trim()) {
                raw.xuatNhap = item.tag === 'FILE_1' ? 'Nhap' : 'Xuat';
            }

            const whTicket = classifyWeighbridgeRow(raw, vehicleMap, vessels);
            if (whTicket) {
                classifiedWhTickets.push(whTicket);
                if (whTicket.flowType === 'IMPORT') impCount++;
                else if (whTicket.flowType === 'EXPORT') expCount++;
                else if (whTicket.flowType === 'DIRECT') dirCount++;

                if (whTicket.warehouseId) {
                    updatedWhSet.add(whTicket.warehouseId);
                    if (whTicket.customerName && configs[whTicket.warehouseId]) {
                        configs[whTicket.warehouseId].currentCustomer = whTicket.customerName;
                    }
                }
            }
        }

        let whDupCount = 0;
        if (classifiedWhTickets.length > 0) {
            const whStats = await WarehouseInventoryService.saveTicketsBulkWithStats(classifiedWhTickets, {
                preserveExistingFields: true
            });
            whDupCount = whStats.duplicateCount;
            for (const whId of updatedWhSet) {
                await WarehouseInventoryService.saveConfig(configs[whId]);
            }
        }

        // 2. Chuyển đổi các dòng sang CSVRecord cho Bảng Phiếu Cân & Báo cáo lô hàng
        // Quy tắc của người dùng:
        // - Các xe có cột "Ma lenh" (Mã lệnh) từ cả File 1 (nhập kho & nhập thẳng từ sà lan tại Cảng về nhà máy)
        //   và File 2 (xuất từ kho xuống sà lan tại Cảng & từ nhà máy xuống sà lan tại Cảng) dùng để làm Báo cáo lô hàng.
        // - Đồng thời hiển thị đầy đủ trên bảng Phiếu cân (như trước đây) để tra cứu, kiểm tra và lưu Sổ theo dõi.
        const convertedRecords: CSVRecord[] = [];
        let orderNoCount = 0;
        let totalNetKg = 0;

        for (const item of allRawRows) {
            const rec = convertRawRowToCSVRecord(item.row, item.tag);
            if (!rec) continue;
            convertedRecords.push(rec);
            totalNetKg += rec.weightNet || 0;
            if (rec.orderNo && rec.orderNo.trim() !== '') {
                orderNoCount++;
            }
        }

        if (sourceRole === 'FILE_1') {
            file1Stats.value = {
                total: convertedRecords.length,
                orderCount: orderNoCount,
                whImportCount: impCount,
                netKg: totalNetKg
            };
        } else if (sourceRole === 'FILE_2') {
            file2Stats.value = {
                total: convertedRecords.length,
                orderCount: orderNoCount,
                whExportCount: expCount,
                whDirectCount: dirCount,
                netKg: totalNetKg
            };
        }

        // Kiểm tra trùng với Sổ Theo Dõi (như CargoAllocator.vue trước đây)
        let finalRecordsToMerge = convertedRecords;
        const { dupRecords, description } = getHistoryDuplicates(convertedRecords);
        if (dupRecords.length > 0) {
            const skipDups = await showConfirm({
                title: 'Phát hiện phiếu cân trùng trong Sổ Theo Dõi',
                message: `Phát hiện ${dupRecords.length} phiếu cân trong tệp vừa chọn đã tồn tại trong Sổ Theo Dõi:\n\n${description}\n\n- Nhấn "Bỏ qua trùng": Chỉ nạp các xe mới vào bảng Phiếu cân.\n- Nhấn "Nhập tất cả": Nạp toàn bộ các dòng trong tệp.`,
                type: 'warning',
                okText: 'Bỏ qua trùng',
                cancelText: 'Nhập tất cả'
            });
            if (skipDups) {
                finalRecordsToMerge = convertedRecords.filter(r => !dupRecords.some(dr => isSameScaleTicket(r, dr)));
            }
        }

        const { added, updated, skipped } = mergeTickets(finalRecordsToMerge);
        await saveTicketsToSupabase();

        // Phát tín hiệu đồng bộ sang Báo cáo lô hàng (WeighbridgePrinter) & Phân bổ De Heus
        syncChannel.postMessage({ type: 'tickets' });

        // Tạo thông báo tổng hợp rõ ràng
        const summaryParts: string[] = [
            `Phiếu cân: +${added} mới, ${updated} cập nhật (${orderNoCount} xe có Mã lệnh làm Báo cáo lô hàng)`
        ];
        if (classifiedWhTickets.length > 0) {
            summaryParts.push(
                `Tồn kho: ${classifiedWhTickets.length} xe (Nhập kho: ${impCount}, Xuất kho: ${expCount}, Đi thẳng: ${dirCount}${whDupCount > 0 ? `, gộp trùng: ${whDupCount}` : ''})`
            );
        }
        if (skipped > 0) {
            summaryParts.push(`Bỏ qua trùng: ${skipped}`);
        }

        addToast(summaryParts.join(' • '), 'success');
        await LogService.logAction(
            `Import ${sourceRole === 'FILE_1' ? 'File 1 (Nhập kho & Nhập thẳng)' : sourceRole === 'FILE_2' ? 'File 2 (Xuất kho & Xuất thẳng)' : 'File phiếu cân'}`,
            summaryParts.join(' | ')
        );
    } catch (err: any) {
        console.error('Lỗi khi nạp file phiếu cân:', err);
        addToast('Lỗi khi đọc file phiếu cân: ' + (err?.message || err), 'error');
    } finally {
        loadingFile1.value = false;
        loadingFile2.value = false;
        loadingMulti.value = false;
        if (file1InputRef.value) file1InputRef.value.value = '';
        if (file2InputRef.value) file2InputRef.value.value = '';
        if (multiFileInputRef.value) multiFileInputRef.value.value = '';
    }
}

const handleFile1Change = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
        processWeighbridgeUpload(input.files, 'FILE_1');
    }
};

const handleFile2Change = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
        processWeighbridgeUpload(input.files, 'FILE_2');
    }
};

const handleMultiFileChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
        processWeighbridgeUpload(input.files, 'AUTO');
    }
};

// Computed filters & sorting for Tab 1 (Phiếu cân)
function compareValues(a: any, b: any, key: string, desc: boolean): number {
    let valA = a[key];
    let valB = b[key];
    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (key === 'dateObj' || key === 'date1Obj' || key === 'date2Obj') {
        const timeA = valA ? new Date(valA).getTime() : 0;
        const timeB = valB ? new Date(valB).getTime() : 0;
        return desc ? timeB - timeA : timeA - timeB;
    }

    if (key === 'dateInStr' || key === 'dateOutStr') {
        const parseD = (s: string) => {
            if (!s) return 0;
            const p = s.split('/');
            if (p.length === 3) {
                return new Date(parseInt(p[2]!, 10), parseInt(p[1]!, 10) - 1, parseInt(p[0]!, 10)).getTime();
            }
            return new Date(s).getTime() || 0;
        };
        const timeA = parseD(valA);
        const timeB = parseD(valB);
        return desc ? timeB - timeA : timeA - timeB;
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
        return desc ? valB - valA : valA - valB;
    }

    const strA = String(valA).trim().toLowerCase();
    const strB = String(valB).trim().toLowerCase();
    if (strA < strB) return desc ? 1 : -1;
    if (strA > strB) return desc ? -1 : 1;
    return 0;
}

function toggleSourceSort(key: string) {
    if (sourceSortKey.value === key) {
        sourceSortDesc.value = !sourceSortDesc.value;
    } else {
        sourceSortKey.value = key;
        sourceSortDesc.value = false;
    }
    sourceCurrentPage.value = 1;
}

function toggleHistorySort(key: string) {
    if (historySortKey.value === key) {
        historySortDesc.value = !historySortDesc.value;
    } else {
        historySortKey.value = key;
        historySortDesc.value = false;
    }
    historyCurrentPage.value = 1;
}

const ticketsWithOrderCount = computed(() => {
    return csvRecords.value.filter(t => t.orderNo && String(t.orderNo).trim() !== '').length;
});

const file1TicketsCount = computed(() => {
    return csvRecords.value.filter(
        t => t.fileSource === 'FILE_1' || (!t.fileSource && String(t.direction || '').toUpperCase().includes('NHAP'))
    ).length;
});

const file2TicketsCount = computed(() => {
    return csvRecords.value.filter(
        t => t.fileSource === 'FILE_2' || (!t.fileSource && String(t.direction || '').toUpperCase().includes('XUAT'))
    ).length;
});

const filteredSourceTickets = computed(() => {
    let list = csvRecords.value;

    if (sourceQuickFilter.value === 'has_order') {
        list = list.filter(t => t.orderNo && String(t.orderNo).trim() !== '');
    } else if (sourceQuickFilter.value === 'file1') {
        list = list.filter(
            t => t.fileSource === 'FILE_1' || (!t.fileSource && String(t.direction || '').toUpperCase().includes('NHAP'))
        );
    } else if (sourceQuickFilter.value === 'file2') {
        list = list.filter(
            t => t.fileSource === 'FILE_2' || (!t.fileSource && String(t.direction || '').toUpperCase().includes('XUAT'))
        );
    }

    if (sourceSearchQuery.value.trim()) {
        const q = sourceSearchQuery.value.toLowerCase().trim();
        list = list.filter(
            t =>
                (t.plateNumber && t.plateNumber.toLowerCase().includes(q)) ||
                (t.ticketNo && t.ticketNo.toLowerCase().includes(q)) ||
                (t.orderNo && t.orderNo.toLowerCase().includes(q)) ||
                (t.customer && t.customer.toLowerCase().includes(q)) ||
                (t.cargoType && t.cargoType.toLowerCase().includes(q)) ||
                (t.bargeName && t.bargeName.toLowerCase().includes(q)) ||
                (t.driverName && t.driverName.toLowerCase().includes(q)) ||
                (t.dateInStr && t.dateInStr.toLowerCase().includes(q)) ||
                (t.dateOutStr && t.dateOutStr.toLowerCase().includes(q))
        );
    }

    if (sourceSortKey.value) {
        list = [...list].sort((a, b) => compareValues(a, b, sourceSortKey.value, sourceSortDesc.value));
    }

    return list;
});

const pagedSourceTickets = computed(() => {
    const start = (sourceCurrentPage.value - 1) * itemsPerPage.value;
    return filteredSourceTickets.value.slice(start, start + itemsPerPage.value);
});

const sourceTotalPages = computed(() => {
    return Math.max(1, Math.ceil(filteredSourceTickets.value.length / itemsPerPage.value));
});

const totalCsvWeightTons = computed(() => {
    const kg = filteredSourceTickets.value.reduce((acc, r) => {
        let net = r.weightNet || 0;
        if (net <= 0 && r.weight1 && r.weight2) {
            net = Math.abs(r.weight1 - r.weight2);
        }
        return acc + net;
    }, 0);
    return kg / 1000;
});

// History (Tab 2: Sổ theo dõi) computed
const filteredHistoryTrips = computed(() => {
    let list = existingTrips.value;
    if (historySearchQuery.value.trim()) {
        const q = historySearchQuery.value.toLowerCase().trim();
        list = list.filter(
            t =>
                (t.plateNumber && t.plateNumber.toLowerCase().includes(q)) ||
                (t.ticketNo && t.ticketNo.toLowerCase().includes(q)) ||
                (t.orderNo && t.orderNo.toLowerCase().includes(q)) ||
                (t.customer && t.customer.toLowerCase().includes(q)) ||
                (t.cargoType && t.cargoType.toLowerCase().includes(q)) ||
                (t.bargeName && t.bargeName.toLowerCase().includes(q))
        );
    }
    if (historySortKey.value) {
        list = [...list].sort((a, b) => compareValues(a, b, historySortKey.value, historySortDesc.value));
    }
    return list;
});

const pagedHistoryTrips = computed(() => {
    const start = (historyCurrentPage.value - 1) * itemsPerPage.value;
    return filteredHistoryTrips.value.slice(start, start + itemsPerPage.value);
});

const historyTotalPages = computed(() => {
    return Math.max(1, Math.ceil(filteredHistoryTrips.value.length / itemsPerPage.value));
});

const historyTotalWeightTons = computed(() => {
    return filteredHistoryTrips.value.reduce(
        (sum, t) => sum + (typeof t.weightTons === 'number' ? t.weightTons : Number(t.weightNet) / 1000 || 0),
        0
    );
});

// CRUD Phiếu cân (Thêm / Sửa / Xóa / Xóa hết)
const showTicketDialog = ref(false);
const editingTicket = ref<CSVRecord | null>(null);
const dialogTicket = ref<CSVRecord>({
    id: '',
    ticketNo: '',
    plateNumber: '',
    customer: '',
    weight1: 0,
    weight2: 0,
    weightNet: 0,
    dateInStr: '',
    timeInStr: '',
    dateOutStr: '',
    timeOutStr: '',
    direction: 'Xuat',
    cargoType: '',
    bargeName: '',
    driverName: '',
    notes: '',
    orderNo: ''
});

function openAddTicketDialog() {
    editingTicket.value = null;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    dialogTicket.value = {
        id: '',
        ticketNo: 'PC' + Date.now().toString().slice(-6),
        plateNumber: '',
        customer: '',
        weight1: 0,
        weight2: 0,
        weightNet: 0,
        dateInStr: dateStr,
        timeInStr: timeStr,
        dateOutStr: dateStr,
        timeOutStr: timeStr,
        direction: 'Xuat',
        cargoType: 'Viên Nén Gỗ',
        bargeName: '',
        driverName: '',
        notes: '',
        orderNo: '',
        fileSource: 'MANUAL'
    };
    showTicketDialog.value = true;
}

function openEditTicketDialog(ticket: CSVRecord) {
    editingTicket.value = ticket;
    dialogTicket.value = { ...ticket };
    showTicketDialog.value = true;
}

async function saveTicket() {
    const isNew = !editingTicket.value || !editingTicket.value.id;
    if (authStore.role !== 'admin' && !hasDetailPermission('allocator', 'al_barge_manage', isNew ? 'create' : 'update')) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    if (!dialogTicket.value.plateNumber.trim()) {
        addToast('Vui lòng nhập biển số xe!', 'info');
        return;
    }
    if (dialogTicket.value.weightNet === 0 && dialogTicket.value.weight1 > 0 && dialogTicket.value.weight2 > 0) {
        dialogTicket.value.weightNet = Math.abs(dialogTicket.value.weight1 - dialogTicket.value.weight2);
    }
    if (dialogTicket.value.weightNet <= 0) {
        addToast('Vui lòng nhập khối lượng hàng hợp lệ!', 'info');
        return;
    }

    const currentList = [...csvRecords.value];
    if (editingTicket.value && editingTicket.value.id) {
        const idx = currentList.findIndex(t => t.id === editingTicket.value!.id);
        if (idx !== -1) {
            currentList[idx] = { ...dialogTicket.value };
            addToast('Đã cập nhật phiếu cân thành công!', 'success');
            await LogService.logAction('Sửa phiếu cân', 'Cập nhật phiếu cân: ' + dialogTicket.value.plateNumber);
        }
    } else {
        const id = 'ticket_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        currentList.push({
            ...dialogTicket.value,
            id
        });
        addToast('Đã thêm phiếu cân mới thành công!', 'success');
        await LogService.logAction('Thêm phiếu cân', 'Thêm phiếu cân mới: ' + dialogTicket.value.plateNumber);
    }

    csvRecords.value = currentList;
    showTicketDialog.value = false;
    await saveTicketsToSupabase();
}

async function deleteTicket(ticket: CSVRecord) {
    if (authStore.role !== 'admin' && !hasDetailPermission('allocator', 'al_barge_manage', 'delete')) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const ok = await showConfirm({
        title: 'Xóa phiếu cân',
        message: `Bạn có chắc chắn muốn xóa phiếu cân ${ticket.ticketNo || ticket.plateNumber} không?`,
        type: 'danger',
        okText: 'Xóa',
        cancelText: 'Hủy'
    });
    if (ok) {
        csvRecords.value = csvRecords.value.filter(t => t.id !== ticket.id);
        addToast('Đã xóa phiếu cân!', 'info');
        await LogService.logAction('Xóa phiếu cân', 'Xóa phiếu cân: ' + (ticket.ticketNo || ticket.plateNumber));
        await saveTicketsToSupabase();
    }
}

async function clearAllTickets() {
    if (authStore.role !== 'admin' && !hasDetailPermission('allocator', 'al_barge_manage', 'delete')) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const ok = await showConfirm({
        title: 'Xóa tất cả phiếu cân',
        message: 'Bạn có chắc chắn muốn xóa toàn bộ danh sách phiếu cân hiện tại ở Tab 1 không?',
        type: 'danger',
        okText: 'Xóa hết',
        cancelText: 'Hủy'
    });
    if (ok) {
        csvRecords.value = [];
        file1Name.value = '';
        file2Name.value = '';
        file1Stats.value = { total: 0, orderCount: 0, whImportCount: 0, netKg: 0 };
        file2Stats.value = { total: 0, orderCount: 0, whExportCount: 0, whDirectCount: 0, netKg: 0 };
        addToast('Đã xóa sạch danh sách phiếu cân!', 'info');
        await LogService.logAction('Xóa tất cả phiếu cân', 'Xóa toàn bộ danh sách phiếu cân');
        await saveTicketsToSupabase();
    }
}

// Lưu toàn bộ phiếu cân ở Tab 1 vào Sổ Theo Dõi (Tab 2) và làm sạch Tab 1
async function saveSourceTicketsToHistory() {
    if (isSavingToHistory.value) return;
    if (authStore.role !== 'admin' && !hasDetailPermission('allocator', 'al_data_manage', 'create')) {
        addToast('Bạn không có quyền lưu dữ liệu vào Sổ Theo Dõi!', 'error');
        return;
    }
    if (csvRecords.value.length === 0) {
        addToast('Không có phiếu cân nào để lưu!', 'info');
        return;
    }

    const confirmSave = await showConfirm({
        title: 'Lưu vào Sổ Theo Dõi',
        message: `Bạn có chắc chắn muốn lưu toàn bộ ${csvRecords.value.length} phiếu cân này vào Sổ Theo Dõi?\n\nSau khi lưu thành công, danh sách phiếu cân ở Tab 1 sẽ được làm sạch.`,
        type: 'info',
        okText: 'Lưu & Làm sạch',
        cancelText: 'Hủy'
    });
    if (!confirmSave) return;

    isSavingToHistory.value = true;
    try {
        const tripsToSave: SplitTrip[] = csvRecords.value.map((rec, idx) => {
            const d1 = parseDateTime(rec.dateInStr, rec.timeInStr);
            const d2 = parseDateTime(rec.dateOutStr, rec.timeOutStr);
            return {
                stt: idx + 1,
                timeStr: rec.timeInStr ? `${rec.timeInStr}\n${rec.dateInStr}` : rec.dateInStr || '',
                plateNumber: rec.plateNumber || '',
                tttp: 0,
                limit: 0,
                ticketNo: rec.ticketNo || '',
                sourceTicketNo: rec.ticketNo || '',
                cargoType: rec.cargoType || '',
                weightTons: Number((rec.weightNet / 1000).toFixed(2)),
                notes: rec.notes || '',
                customer: rec.customer || '',
                weight1: Number(rec.weight1) || 0,
                weight2: Number(rec.weight2) || 0,
                weightNet: Number(rec.weightNet) || 0,
                direction: rec.direction || '',
                bargeName: rec.bargeName || '',
                date1Obj: d1,
                date2Obj: d2,
                orderNo: rec.orderNo || ''
            };
        });

        const insertRes = await AllocatorService.insertTrips(tripsToSave);
        if (insertRes.error) {
            addToast('Lỗi khi lưu vào cơ sở dữ liệu: ' + (insertRes.error.message || 'Thất bại'), 'error');
            return;
        }

        const savedItems =
            insertRes.data && insertRes.data.length === tripsToSave.length ? insertRes.data : tripsToSave;
        existingTrips.value = [...savedItems, ...existingTrips.value];
        await dbContext.set('allocator_history_trips', existingTrips.value);

        csvRecords.value = [];
        await doExecuteSaveTicketsToSupabase();

        activeMainTab.value = 'history';
        addToast(`Đã lưu thành công ${tripsToSave.length} phiếu cân vào Sổ Theo Dõi!`, 'success');
        await LogService.logAction('Lưu Sổ Theo Dõi', `Lưu ${tripsToSave.length} phiếu cân vào sổ theo dõi`);
    } catch (err: any) {
        console.error('Lỗi khi lưu vào Sổ Theo Dõi:', err);
        addToast('Lỗi khi lưu vào Sổ Theo Dõi: ' + (err?.message || err), 'error');
    } finally {
        isSavingToHistory.value = false;
    }
}

// Sửa Mã lệnh / Xóa bản ghi trong Sổ Theo Dõi (Tab 2)
async function editHistoryTripOrderNo(trip: SplitTrip) {
    if (authStore.role !== 'admin' && !hasDetailPermission('allocator', 'al_data_manage', 'update')) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const currentOrderNo = trip.orderNo || '';
    const newOrderNo = prompt(`Nhập Mã lệnh mới cho xe "${trip.plateNumber}":`, currentOrderNo);
    if (newOrderNo === null) return;

    trip.orderNo = newOrderNo.trim();
    const idx = existingTrips.value.findIndex(
        t => (trip.id && t.id === trip.id) || (t.ticketNo && t.ticketNo === trip.ticketNo) || t.stt === trip.stt
    );
    if (idx !== -1) {
        existingTrips.value[idx] = { ...trip };
    }

    const ok = await AllocatorService.updateTripOrderNo(
        { id: trip.id, ticketNo: trip.ticketNo, stt: trip.stt },
        trip.orderNo
    );
    if (ok) {
        await dbContext.set('allocator_history_trips', existingTrips.value);
        addToast('Cập nhật mã lệnh thành công!', 'success');
    } else {
        addToast('Lỗi khi cập nhật mã lệnh trên máy chủ!', 'error');
    }
}

async function deleteHistoryTrip(trip: SplitTrip) {
    if (authStore.role !== 'admin' && !hasDetailPermission('allocator', 'al_data_manage', 'delete')) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const proceed = await showConfirm({
        title: 'Xóa bản ghi lịch sử',
        message: `Bạn có chắc chắn muốn xóa xe "${trip.plateNumber}" khỏi Sổ theo dõi?`,
        type: 'danger',
        okText: 'Xóa',
        cancelText: 'Hủy'
    });
    if (!proceed) return;

    const ok = await AllocatorService.deleteTrip({ id: trip.id, ticketNo: trip.ticketNo, stt: trip.stt });
    if (ok) {
        existingTrips.value = existingTrips.value.filter(
            t => (trip.id ? t.id !== trip.id : true) && (!t.ticketNo || t.ticketNo !== trip.ticketNo) && t.stt !== trip.stt
        );
        await dbContext.set('allocator_history_trips', existingTrips.value);
        addToast('Đã xóa bản ghi khỏi Sổ theo dõi!', 'success');
    } else {
        addToast('Lỗi khi xóa bản ghi trên máy chủ!', 'error');
    }
}

async function clearHistory() {
    if (authStore.role !== 'admin' && !hasDetailPermission('allocator', 'al_data_manage', 'delete')) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const ok = await showConfirm({
        title: 'Xóa sạch Sổ Theo Dõi',
        message: 'Bạn có chắc chắn muốn xóa toàn bộ lịch sử trong Sổ Theo Dõi không? Hành động này không thể hoàn tác!',
        type: 'danger',
        okText: 'Xóa hết lịch sử',
        cancelText: 'Hủy'
    });
    if (ok) {
        const { error } = await supabase.from(AllocatorService.TABLE_NAME).delete().neq('id', 0);
        if (error) {
            addToast('Lỗi khi xóa bảng lịch sử trên máy chủ: ' + error.message, 'error');
            return;
        }
        existingTrips.value = [];
        await dbContext.set('allocator_history_trips', []);
        addToast('Đã xóa sạch lịch sử Sổ Theo Dõi!', 'info');
    }
}

// Xuất Excel Tab 1 (Phiếu cân) & Tab 2 (Sổ theo dõi)
async function exportSourceTickets() {
    if (filteredSourceTickets.value.length === 0) {
        addToast('Không có phiếu cân nào để xuất!', 'info');
        return;
    }
    compiling.value = true;
    try {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Phiếu cân');

        const headers = [
            'STT',
            'Số phiếu',
            'Mã lệnh',
            'Biển số xe',
            'Khách hàng',
            'Cân lần 1',
            'Cân lần 2',
            'KL hàng (kg)',
            'Loại hàng',
            'Ngày vào',
            'Giờ vào',
            'Ngày ra',
            'Giờ ra',
            'Xuất/Nhập',
            'Sà lan / Kho',
            'Tài xế / Nơi đi',
            'Ghi chú'
        ];
        const headerRow = sheet.getRow(1);
        headers.forEach((h, i) => {
            headerRow.getCell(i + 1).value = h;
        });
        headerRow.font = { name: 'Arial', size: 10, bold: true };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        filteredSourceTickets.value.forEach((r, idx) => {
            const row = sheet.getRow(idx + 2);
            row.getCell(1).value = idx + 1;
            row.getCell(2).value = r.ticketNo;
            row.getCell(3).value = r.orderNo || '';
            row.getCell(4).value = formatPlate(r.plateNumber);
            row.getCell(5).value = r.customer;
            row.getCell(6).value = r.weight1;
            row.getCell(7).value = r.weight2;
            row.getCell(8).value = r.weightNet;
            row.getCell(9).value = r.cargoType;
            row.getCell(10).value = r.dateInStr;
            row.getCell(11).value = r.timeInStr;
            row.getCell(12).value = r.dateOutStr;
            row.getCell(13).value = r.timeOutStr;
            row.getCell(14).value = r.direction;
            row.getCell(15).value = r.bargeName;
            row.getCell(16).value = r.driverName;
            row.getCell(17).value = r.notes;
            row.font = { name: 'Arial', size: 10 };
        });

        sheet.columns.forEach((col: any) => {
            col.width = 18;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'PHIẾU_CÂN_THỰC_TẾ.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addToast('Đã xuất phiếu cân thực tế thành công!', 'success');
    } catch (error) {
        console.error(error);
        addToast('Lỗi khi xuất tệp Excel!', 'error');
    } finally {
        compiling.value = false;
    }
}

async function exportHistoryTrips() {
    const dataToExport = filteredHistoryTrips.value;
    if (dataToExport.length === 0) {
        addToast('Không có dữ liệu lịch sử để xuất!', 'info');
        return;
    }
    compiling.value = true;
    try {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Sổ theo dõi');

        const headers = [
            'STT',
            'Số phiếu',
            'Mã lệnh',
            'Biển số xe',
            'Khách hàng',
            'Cân lần 1',
            'Cân lần 2',
            'KL hàng (kg)',
            'Loại hàng',
            'Ngày vào',
            'Giờ vào',
            'Ngày ra',
            'Giờ ra',
            'Xuất/Nhập',
            'Sà lan',
            'Ghi chú'
        ];
        const headerRow = sheet.getRow(1);
        headers.forEach((h, i) => {
            headerRow.getCell(i + 1).value = h;
        });
        headerRow.font = { name: 'Arial', size: 10, bold: true };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 24;

        dataToExport.forEach((trip, idx) => {
            const row = sheet.getRow(idx + 2);
            row.getCell(1).value = idx + 1;
            row.getCell(2).value = trip.ticketNo || '';
            row.getCell(3).value = trip.orderNo || '';
            row.getCell(4).value = formatPlate(trip.plateNumber);
            row.getCell(5).value = trip.customer || '';
            row.getCell(6).value = trip.weight1 || 0;
            row.getCell(7).value = trip.weight2 || 0;
            row.getCell(8).value = trip.weightNet || (trip.weightTons ? trip.weightTons * 1000 : 0);
            row.getCell(9).value = trip.cargoType || '';

            let d1Str = '';
            let t1Str = '';
            let d2Str = '';
            let t2Str = '';
            if (trip.date1Obj) {
                const dt = new Date(trip.date1Obj);
                if (!isNaN(dt.getTime())) {
                    d1Str = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
                    t1Str = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                }
            }
            if (trip.date2Obj) {
                const dt = new Date(trip.date2Obj);
                if (!isNaN(dt.getTime())) {
                    d2Str = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
                    t2Str = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                }
            }
            if (!t1Str && trip.timeStr) t1Str = trip.timeStr;

            row.getCell(10).value = d1Str;
            row.getCell(11).value = t1Str;
            row.getCell(12).value = d2Str;
            row.getCell(13).value = t2Str;
            row.getCell(14).value = trip.direction || '';
            row.getCell(15).value = trip.bargeName || '';
            row.getCell(16).value = trip.notes || '';
            row.font = { name: 'Arial', size: 10 };
        });

        sheet.columns.forEach((col: any) => {
            col.width = 18;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'SỔ_THEO_DÕI_XẾP_HÀNG_HÓA.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addToast('Đã xuất Sổ theo dõi thành công!', 'success');
    } catch (error) {
        console.error(error);
        addToast('Có lỗi xảy ra khi tạo tệp Excel!', 'error');
    } finally {
        compiling.value = false;
    }
}
</script>

<template>
    <div class="h-full flex flex-col gap-3.5 font-display min-h-0">
        <!-- Card 1: Tab Switcher + Lối tắt báo cáo (Chuẩn DESIGN.md Mục 6) -->
        <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] py-2.5 px-4 soft-shadow border border-primary/5 gap-3 shrink-0">
            <div class="flex items-center gap-3">
                <div class="text-xs font-black uppercase tracking-wider text-primary">Phân Hệ Dữ Liệu Cân Hàng & Sổ Theo Dõi</div>
            </div>

            <!-- Tab Switcher nhỏ gọn chuẩn DESIGN.md Mục 6 -->
            <div class="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0 h-8 items-center">
                <button
                    type="button"
                    @click="activeMainTab = 'source'"
                    :class="[
                        'px-3 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all cursor-pointer flex items-center gap-1',
                        activeMainTab === 'source'
                            ? 'bg-primary text-white shadow-soft'
                            : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                    ]"
                >
                    <span>1. Phiếu cân ({{ csvRecords.length }})</span>
                </button>
                <button
                    type="button"
                    @click="activeMainTab = 'history'"
                    :class="[
                        'px-3 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all cursor-pointer flex items-center gap-1',
                        activeMainTab === 'history'
                            ? 'bg-primary text-white shadow-soft'
                            : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                    ]"
                >
                    <span>2. Sổ theo dõi ({{ existingTrips.length }})</span>
                </button>
                <button
                    type="button"
                    @click="activeMainTab = 'other_tickets'"
                    :class="[
                        'px-3 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all cursor-pointer flex items-center gap-1',
                        activeMainTab === 'other_tickets'
                            ? 'bg-primary text-white shadow-soft'
                            : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                    ]"
                >
                    <span>3. Cân Kho & Container</span>
                </button>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <!-- Lối tắt chuyển nhanh sang 3 báo cáo (Nút Toolbar Mục 6 DESIGN.md) -->
                <button
                    type="button"
                    @click="emit('view-shipment')"
                    class="h-7 px-3 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-[8px] hover:bg-primary/20 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Mở Báo cáo lô hàng (các xe có Mã lệnh)"
                >
                    <span class="material-symbols-outlined text-sm">monitoring</span>
                    Báo cáo lô hàng
                </button>
                <button
                    type="button"
                    @click="emit('view-inventory')"
                    class="h-7 px-3 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-[8px] hover:bg-primary/20 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Mở Báo cáo tồn kho 4 kho"
                >
                    <span class="material-symbols-outlined text-sm">warehouse</span>
                    Báo cáo tồn kho
                </button>
                <button
                    type="button"
                    @click="emit('view-deheus')"
                    class="h-7 px-3 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-[8px] hover:bg-primary/20 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Mở Báo cáo Phân bổ De Heus"
                >
                    <span class="material-symbols-outlined text-sm">call_split</span>
                    Phân bổ De Heus
                </button>
            </div>
        </div>

        <!-- Chế độ 3: Lịch sử cân Kho & Container (như trước đây) -->
        <div v-if="activeMainTab === 'other_tickets'" class="flex-1 min-h-0 flex flex-col overflow-hidden">
            <WeighbridgeOtherManager />
        </div>

        <!-- Chế độ 1 & 2: Phiếu cân & Sổ theo dõi -->
        <template v-else>
            <!-- Card 2: 2 Khối Import File Phiếu Cân (File 1 & File 2 theo đúng quy tắc của người dùng) -->
            <div v-if="activeMainTab === 'source'" class="grid grid-cols-1 lg:grid-cols-2 gap-3.5 shrink-0">
                <!-- Khối File 1: Nhập hàng vào kho & Nhập thẳng (từ sà lan tại Cảng về nhà máy) -->
                <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div class="flex items-start gap-3 min-w-0 flex-1">
                        <div class="size-10 rounded-2xl bg-primary text-white flex items-center justify-center font-display font-black text-sm shadow-soft shrink-0">
                            1
                        </div>
                        <div class="min-w-0 flex-1">
                            <h3 class="text-xs font-display font-black text-[#1e293b] uppercase">
                                File 1: Nhập hàng vào kho & Nhập thẳng
                            </h3>
                            <p v-if="file1Name" class="text-xs text-slate-500 font-semibold mt-0.5 truncate" :title="file1Name">
                                Đã nạp: {{ file1Name }}
                            </p>
                            <div class="flex flex-wrap items-center gap-2.5 mt-1.5 text-xs font-bold">
                                <span class="text-slate-500">
                                    Tổng: <strong class="text-[#1e293b] font-black">{{ file1Stats.total }} xe</strong>
                                </span>
                                <span class="text-slate-300">•</span>
                                <span class="text-slate-500">
                                    Có Mã lệnh: <strong class="text-teal-600 font-black">{{ file1Stats.orderCount }} xe</strong>
                                </span>
                                <span class="text-slate-300">•</span>
                                <span class="text-slate-500">
                                    Nhập kho: <strong class="text-primary font-black">{{ file1Stats.whImportCount }} xe</strong>
                                </span>
                            </div>
                        </div>
                    </div>

                    <label class="border-2 border-dashed border-primary/25 hover:border-primary bg-[#f1f5f9]/70 hover:bg-primary/5 rounded-2xl px-4 py-3 flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0 group">
                        <input
                            ref="file1InputRef"
                            type="file"
                            multiple
                            accept=".csv,.xlsx,.xls"
                            @change="handleFile1Change"
                            class="hidden"
                        />
                        <span v-if="loadingFile1" class="material-symbols-outlined text-primary text-lg animate-spin">
                            sync
                        </span>
                        <span
                            v-else
                            class="material-symbols-outlined text-primary text-lg group-hover:scale-110 transition-transform"
                        >
                            upload_file
                        </span>
                        <span class="text-xs font-display font-black text-primary">
                            Chọn File 1 (.csv/.xlsx)
                        </span>
                    </label>
                </div>

                <!-- Khối File 2: Xuất hàng từ kho xuống sà lan tại Cảng & từ nhà máy xuống sà lan tại Cảng -->
                <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div class="flex items-start gap-3 min-w-0 flex-1">
                        <div class="size-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-display font-black text-sm shadow-soft shrink-0">
                            2
                        </div>
                        <div class="min-w-0 flex-1">
                            <h3 class="text-xs font-display font-black text-[#1e293b] uppercase">
                                File 2: Xuất kho & Xuất thẳng xuống sà lan
                            </h3>
                            <p v-if="file2Name" class="text-xs text-slate-500 font-semibold mt-0.5 truncate" :title="file2Name">
                                Đã nạp: {{ file2Name }}
                            </p>
                            <div class="flex flex-wrap items-center gap-2.5 mt-1.5 text-xs font-bold">
                                <span class="text-slate-500">
                                    Tổng: <strong class="text-[#1e293b] font-black">{{ file2Stats.total }} xe</strong>
                                </span>
                                <span class="text-slate-300">•</span>
                                <span class="text-slate-500">
                                    Có Mã lệnh: <strong class="text-teal-600 font-black">{{ file2Stats.orderCount }} xe</strong>
                                </span>
                                <span class="text-slate-300">•</span>
                                <span class="text-slate-500">
                                    Xuất kho / Thẳng:
                                    <strong class="text-teal-600 font-black">
                                        {{ file2Stats.whExportCount + file2Stats.whDirectCount }} xe
                                    </strong>
                                </span>
                            </div>
                        </div>
                    </div>

                    <label class="border-2 border-dashed border-teal-400/50 hover:border-teal-600 bg-teal-50/40 hover:bg-teal-50 rounded-2xl px-4 py-3 flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0 group">
                        <input
                            ref="file2InputRef"
                            type="file"
                            multiple
                            accept=".csv,.xlsx,.xls"
                            @change="handleFile2Change"
                            class="hidden"
                        />
                        <span v-if="loadingFile2" class="material-symbols-outlined text-teal-600 text-lg animate-spin">
                            sync
                        </span>
                        <span
                            v-else
                            class="material-symbols-outlined text-teal-600 text-lg group-hover:scale-110 transition-transform"
                        >
                            directions_boat
                        </span>
                        <span class="text-xs font-display font-black text-teal-700">
                            Chọn File 2 (.csv/.xlsx)
                        </span>
                    </label>
                </div>
            </div>

            <!-- Card 3: Toolbar + Bảng Dữ Liệu Đầy Đủ Như Trước Đây (DESIGN.md Mục 6) -->
            <div class="flex-1 bg-white rounded-[24px] p-4 md:p-5 pb-3 soft-shadow border border-primary/5 flex flex-col gap-3.5 min-h-0 overflow-hidden">
                <!-- Toolbar chuẩn DESIGN.md Mục 6 -->
                <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-gray-100 pb-3 shrink-0">
                    <!-- Left: Filter Chips (Tab 1) hoặc Tiêu đề Sổ theo dõi (Tab 2) -->
                    <div class="flex flex-wrap items-center gap-2">
                        <template v-if="activeMainTab === 'source'">
                            <div class="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0 h-8 items-center">
                                <button
                                    type="button"
                                    @click="sourceQuickFilter = 'all'"
                                    :class="[
                                        'px-2.5 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all cursor-pointer',
                                        sourceQuickFilter === 'all'
                                            ? 'bg-primary text-white shadow-soft'
                                            : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                                    ]"
                                >
                                    Tất cả ({{ csvRecords.length }})
                                </button>
                                <button
                                    type="button"
                                    @click="sourceQuickFilter = 'has_order'"
                                    :class="[
                                        'px-2.5 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all cursor-pointer',
                                        sourceQuickFilter === 'has_order'
                                            ? 'bg-teal-600 text-white shadow-soft'
                                            : 'text-teal-700 hover:bg-white/50'
                                    ]"
                                    title="Các xe có cột Mã lệnh sẽ dùng để làm Báo cáo lô hàng"
                                >
                                    Có Mã lệnh ({{ ticketsWithOrderCount }})
                                </button>
                                <button
                                    type="button"
                                    @click="sourceQuickFilter = 'file1'"
                                    :class="[
                                        'px-2.5 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all cursor-pointer',
                                        sourceQuickFilter === 'file1'
                                            ? 'bg-primary text-white shadow-soft'
                                            : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                                    ]"
                                >
                                    File 1: Nhập ({{ file1TicketsCount }})
                                </button>
                                <button
                                    type="button"
                                    @click="sourceQuickFilter = 'file2'"
                                    :class="[
                                        'px-2.5 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all cursor-pointer',
                                        sourceQuickFilter === 'file2'
                                            ? 'bg-primary text-white shadow-soft'
                                            : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                                    ]"
                                >
                                    File 2: Xuất ({{ file2TicketsCount }})
                                </button>
                            </div>
                        </template>

                        <template v-else>
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-display font-black text-primary uppercase">
                                    Sổ theo dõi lịch sử phương tiện ({{ filteredHistoryTrips.length }} chuyến)
                                </span>
                            </div>
                        </template>
                    </div>

                    <!-- Right: Search Input + Action Buttons chuẩn Mục 6 DESIGN.md -->
                    <div class="flex flex-wrap items-center gap-1.5 xl:justify-end">
                        <!-- Search Input -->
                        <div v-if="activeMainTab === 'source'" class="relative w-full sm:w-[220px] h-7 flex items-center">
                            <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">
                                search
                            </span>
                            <input
                                type="text"
                                v-model="sourceSearchQuery"
                                placeholder="Tìm số phiếu, mã lệnh, số xe..."
                                class="w-full h-7 pl-8 pr-7 bg-white border border-slate-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary"
                            />
                            <button
                                v-if="sourceSearchQuery"
                                @click="sourceSearchQuery = ''"
                                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary flex items-center"
                            >
                                <span class="material-symbols-outlined text-xs">close</span>
                            </button>
                        </div>

                        <div v-else class="relative w-full sm:w-[220px] h-7 flex items-center">
                            <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">
                                search
                            </span>
                            <input
                                type="text"
                                v-model="historySearchQuery"
                                placeholder="Tìm kiếm sổ theo dõi..."
                                class="w-full h-7 pl-8 pr-7 bg-white border border-slate-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary"
                            />
                            <button
                                v-if="historySearchQuery"
                                @click="historySearchQuery = ''"
                                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary flex items-center"
                            >
                                <span class="material-symbols-outlined text-xs">close</span>
                            </button>
                        </div>

                        <!-- Actions for Tab 1: Phiếu cân -->
                        <template v-if="activeMainTab === 'source'">
                            <div class="h-7 px-2.5 bg-teal-50 rounded-[8px] border border-teal-200 text-teal-700 flex items-center font-bold text-xs">
                                KL: {{ totalCsvWeightTons.toFixed(2) }}t
                            </div>

                            <input
                                ref="multiFileInputRef"
                                type="file"
                                multiple
                                accept=".csv,.xlsx,.xls"
                                @change="handleMultiFileChange"
                                class="hidden"
                            />
                            <button
                                type="button"
                                @click="multiFileInputRef?.click()"
                                :disabled="loadingMulti"
                                class="h-7 px-3 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-[8px] hover:bg-primary/20 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
                                title="Import gộp 1 hoặc nhiều file phiếu cân (.csv, .xlsx)"
                            >
                                <span class="material-symbols-outlined text-[14px]">upload_file</span>
                                {{ loadingMulti ? 'Đang đọc...' : 'Import' }}
                            </button>

                            <button
                                type="button"
                                @click="openAddTicketDialog"
                                class="h-7 px-3 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-[8px] hover:bg-primary/20 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <span class="material-symbols-outlined text-[14px]">add</span>
                                Thêm
                            </button>

                            <button
                                type="button"
                                @click="clearAllTickets"
                                :disabled="csvRecords.length === 0"
                                class="h-7 px-3 bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-[8px] hover:bg-red-100 active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                            >
                                <span class="material-symbols-outlined text-[14px]">delete</span>
                                Xóa hết
                            </button>

                            <button
                                type="button"
                                @click="saveSourceTicketsToHistory"
                                :disabled="csvRecords.length === 0 || isSavingToHistory"
                                class="h-7 px-3 bg-teal-600 text-white border border-teal-600 text-xs font-bold rounded-[8px] hover:bg-teal-700 active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 shadow-sm cursor-pointer"
                                title="Lưu toàn bộ phiếu cân vào Sổ Theo Dõi và làm sạch danh sách ở Tab 1"
                            >
                                <span v-if="isSavingToHistory" class="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                <span v-else class="material-symbols-outlined text-[14px]">save</span>
                                {{ isSavingToHistory ? 'Đang lưu...' : 'Lưu vào Sổ Theo Dõi' }}
                            </button>

                            <button
                                type="button"
                                @click="exportSourceTickets"
                                :disabled="csvRecords.length === 0 || compiling"
                                class="h-7 px-3 bg-primary text-white border border-primary text-xs font-bold rounded-[8px] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                            >
                                <span class="material-symbols-outlined text-[14px]">download</span>
                                Xuất Excel
                            </button>
                        </template>

                        <!-- Actions for Tab 2: Sổ theo dõi -->
                        <template v-else>
                            <div class="h-7 px-2.5 bg-teal-50 rounded-[8px] border border-teal-200 text-teal-700 flex items-center font-bold text-xs">
                                KL: {{ historyTotalWeightTons.toFixed(2) }}t
                            </div>
                            <button
                                v-if="authStore.role === 'admin'"
                                type="button"
                                @click="clearHistory"
                                :disabled="existingTrips.length === 0"
                                class="h-7 px-3 bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-[8px] hover:bg-red-100 active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                            >
                                <span class="material-symbols-outlined text-[14px]">delete_forever</span>
                                Xóa lịch sử
                            </button>
                            <button
                                type="button"
                                @click="exportHistoryTrips"
                                :disabled="existingTrips.length === 0 || compiling"
                                class="h-7 px-3 bg-primary text-white border border-primary text-xs font-bold rounded-[8px] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                            >
                                <span v-if="compiling" class="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                <span v-else class="material-symbols-outlined text-[14px]">download</span>
                                Xuất Excel
                            </button>
                        </template>
                    </div>
                </div>

                <!-- BẢNG TAB 1: DANH SÁCH PHIẾU CÂN (Đầy đủ cột như trước đây) -->
                <div v-if="activeMainTab === 'source'" class="flex-1 flex flex-col gap-3 min-h-0">
                    <div
                        v-if="filteredSourceTickets.length > 0"
                        class="flex-1 overflow-auto border border-gray-100 rounded-[16px] min-h-0 custom-scroll"
                    >
                        <table class="w-full text-left border-collapse text-xs font-bold min-w-[1480px] whitespace-nowrap">
                            <thead class="bg-gray-50 border-b border-gray-100 sticky top-0 z-10 text-gray-500 select-none">
                                <tr>
                                    <th class="py-2.5 px-3 w-12 text-center">STT</th>
                                    <th
                                        @click="toggleSourceSort('ticketNo')"
                                        class="py-2.5 px-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div class="flex items-center gap-1">
                                            <span>Số phiếu</span>
                                            <span class="material-symbols-outlined text-[12px] text-gray-400">
                                                {{
                                                    sourceSortKey === 'ticketNo'
                                                        ? sourceSortDesc
                                                            ? 'arrow_downward'
                                                            : 'arrow_upward'
                                                        : 'unfold_more'
                                                }}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        @click="toggleSourceSort('orderNo')"
                                        class="py-2.5 px-3 text-center cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div class="flex items-center justify-center gap-1">
                                            <span>Mã lệnh (Lô hàng)</span>
                                            <span class="material-symbols-outlined text-[12px] text-gray-400">
                                                {{
                                                    sourceSortKey === 'orderNo'
                                                        ? sourceSortDesc
                                                            ? 'arrow_downward'
                                                            : 'arrow_upward'
                                                        : 'unfold_more'
                                                }}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        @click="toggleSourceSort('plateNumber')"
                                        class="py-2.5 px-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div class="flex items-center gap-1">
                                            <span>Số xe</span>
                                            <span class="material-symbols-outlined text-[12px] text-gray-400">
                                                {{
                                                    sourceSortKey === 'plateNumber'
                                                        ? sourceSortDesc
                                                            ? 'arrow_downward'
                                                            : 'arrow_upward'
                                                        : 'unfold_more'
                                                }}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        @click="toggleSourceSort('customer')"
                                        class="py-2.5 px-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div class="flex items-center gap-1">
                                            <span>Khách hàng</span>
                                            <span class="material-symbols-outlined text-[12px] text-gray-400">
                                                {{
                                                    sourceSortKey === 'customer'
                                                        ? sourceSortDesc
                                                            ? 'arrow_downward'
                                                            : 'arrow_upward'
                                                        : 'unfold_more'
                                                }}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        @click="toggleSourceSort('cargoType')"
                                        class="py-2.5 px-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div class="flex items-center gap-1">
                                            <span>Loại hàng</span>
                                            <span class="material-symbols-outlined text-[12px] text-gray-400">
                                                {{
                                                    sourceSortKey === 'cargoType'
                                                        ? sourceSortDesc
                                                            ? 'arrow_downward'
                                                            : 'arrow_upward'
                                                        : 'unfold_more'
                                                }}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        @click="toggleSourceSort('weight1')"
                                        class="py-2.5 px-3 text-right cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div class="flex items-center justify-end gap-1">
                                            <span>TL1 (kg)</span>
                                            <span class="material-symbols-outlined text-[12px] text-gray-400">
                                                {{
                                                    sourceSortKey === 'weight1'
                                                        ? sourceSortDesc
                                                            ? 'arrow_downward'
                                                            : 'arrow_upward'
                                                        : 'unfold_more'
                                                }}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        @click="toggleSourceSort('weight2')"
                                        class="py-2.5 px-3 text-right cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div class="flex items-center justify-end gap-1">
                                            <span>TL2 (kg)</span>
                                            <span class="material-symbols-outlined text-[12px] text-gray-400">
                                                {{
                                                    sourceSortKey === 'weight2'
                                                        ? sourceSortDesc
                                                            ? 'arrow_downward'
                                                            : 'arrow_upward'
                                                        : 'unfold_more'
                                                }}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        @click="toggleSourceSort('weightNet')"
                                        class="py-2.5 px-3 text-right cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div class="flex items-center justify-end gap-1">
                                            <span>KL hàng (kg)</span>
                                            <span class="material-symbols-outlined text-[12px] text-gray-400">
                                                {{
                                                    sourceSortKey === 'weightNet'
                                                        ? sourceSortDesc
                                                            ? 'arrow_downward'
                                                            : 'arrow_upward'
                                                        : 'unfold_more'
                                                }}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        @click="toggleSourceSort('dateInStr')"
                                        class="py-2.5 px-3 text-center cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div class="flex items-center justify-center gap-1">
                                            <span>Ngày vào</span>
                                            <span class="material-symbols-outlined text-[12px] text-gray-400">
                                                {{
                                                    sourceSortKey === 'dateInStr'
                                                        ? sourceSortDesc
                                                            ? 'arrow_downward'
                                                            : 'arrow_upward'
                                                        : 'unfold_more'
                                                }}
                                            </span>
                                        </div>
                                    </th>
                                    <th class="py-2.5 px-3 text-center">Giờ vào</th>
                                    <th
                                        @click="toggleSourceSort('dateOutStr')"
                                        class="py-2.5 px-3 text-center cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div class="flex items-center justify-center gap-1">
                                            <span>Ngày ra</span>
                                            <span class="material-symbols-outlined text-[12px] text-gray-400">
                                                {{
                                                    sourceSortKey === 'dateOutStr'
                                                        ? sourceSortDesc
                                                            ? 'arrow_downward'
                                                            : 'arrow_upward'
                                                        : 'unfold_more'
                                                }}
                                            </span>
                                        </div>
                                    </th>
                                    <th class="py-2.5 px-3 text-center">Giờ ra</th>
                                    <th class="py-2.5 px-3 text-center">Xuất/Nhập</th>
                                    <th
                                        @click="toggleSourceSort('bargeName')"
                                        class="py-2.5 px-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div class="flex items-center gap-1">
                                            <span>Sà lan / Kho</span>
                                            <span class="material-symbols-outlined text-[12px] text-gray-400">
                                                {{
                                                    sourceSortKey === 'bargeName'
                                                        ? sourceSortDesc
                                                            ? 'arrow_downward'
                                                            : 'arrow_upward'
                                                        : 'unfold_more'
                                                }}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        @click="toggleSourceSort('driverName')"
                                        class="py-2.5 px-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div class="flex items-center gap-1">
                                            <span>Tài xế / Nguồn</span>
                                            <span class="material-symbols-outlined text-[12px] text-gray-400">
                                                {{
                                                    sourceSortKey === 'driverName'
                                                        ? sourceSortDesc
                                                            ? 'arrow_downward'
                                                            : 'arrow_upward'
                                                        : 'unfold_more'
                                                }}
                                            </span>
                                        </div>
                                    </th>
                                    <th class="py-2.5 px-3 text-center w-24">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100 text-[#1e293b]/90">
                                <tr
                                    v-for="(ticket, idx) in pagedSourceTickets"
                                    :key="ticket.id || idx"
                                    class="hover:bg-gray-50 transition-colors"
                                >
                                    <td class="py-2 px-3 text-center font-bold text-gray-400">
                                        {{ (sourceCurrentPage - 1) * itemsPerPage + idx + 1 }}
                                    </td>
                                    <td class="py-2 px-3 font-semibold text-gray-700 font-mono">
                                        {{ ticket.ticketNo || '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-center">
                                        <span
                                            v-if="ticket.orderNo && String(ticket.orderNo).trim()"
                                            class="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-teal-50 text-teal-600 border border-teal-200/70"
                                            title="Xe có Mã lệnh ➔ Dùng làm Báo cáo lô hàng"
                                        >
                                            {{ ticket.orderNo }}
                                        </span>
                                        <span v-else class="text-gray-300">-</span>
                                    </td>
                                    <td class="py-2 px-3 font-black text-gray-900 font-mono">
                                        {{ formatPlate(ticket.plateNumber) }}
                                    </td>
                                    <td class="py-2 px-3 truncate max-w-[140px] text-gray-600" :title="ticket.customer">
                                        {{ ticket.customer || '-' }}
                                    </td>
                                    <td class="py-2 px-3 truncate max-w-[130px]" :title="ticket.cargoType">
                                        {{ ticket.cargoType || '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-right font-mono text-gray-700">
                                        {{ ticket.weight1 ? ticket.weight1.toLocaleString() : '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-right font-mono text-gray-700">
                                        {{ ticket.weight2 ? ticket.weight2.toLocaleString() : '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-right font-black text-primary font-mono">
                                        {{ ticket.weightNet.toLocaleString() }}
                                    </td>
                                    <td class="py-2 px-3 text-center text-gray-600 font-mono">
                                        {{ ticket.dateInStr || '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-center text-primary font-mono font-bold">
                                        {{ ticket.timeInStr || '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-center text-gray-600 font-mono">
                                        {{ ticket.dateOutStr || '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-center text-primary font-mono font-bold">
                                        {{ ticket.timeOutStr || '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-center">
                                        <span
                                            :class="[
                                                'px-2 py-0.5 rounded-full text-xs font-bold',
                                                String(ticket.direction || '').toUpperCase().includes('NHAP')
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'bg-teal-50 text-teal-600'
                                            ]"
                                        >
                                            {{ ticket.direction || '-' }}
                                        </span>
                                    </td>
                                    <td class="py-2 px-3 font-bold text-[#1e293b] truncate max-w-[140px]" :title="ticket.bargeName">
                                        {{ ticket.bargeName || '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-gray-500 truncate max-w-[120px]" :title="ticket.driverName">
                                        {{ ticket.driverName || '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-center">
                                        <div class="flex items-center justify-center gap-1.5">
                                            <button
                                                type="button"
                                                @click="openEditTicketDialog(ticket)"
                                                class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                                title="Sửa phiếu cân"
                                            >
                                                <span class="material-symbols-outlined text-xs">edit</span>
                                            </button>
                                            <button
                                                type="button"
                                                @click="deleteTicket(ticket)"
                                                class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                                title="Xóa phiếu cân"
                                            >
                                                <span class="material-symbols-outlined text-xs">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div
                        v-else
                        class="flex-1 flex flex-col items-center justify-center p-8 text-gray-400 italic text-center gap-2 border border-dashed border-gray-100 rounded-[16px]"
                    >
                        <span class="material-symbols-outlined text-4xl text-gray-300">inventory_2</span>
                        <p class="text-xs font-semibold max-w-[460px] leading-relaxed not-italic text-slate-500">
                            {{
                                csvRecords.length === 0
                                    ? 'Chưa có phiếu cân nào.'
                                    : 'Không tìm thấy phiếu cân nào khớp bộ lọc!'
                            }}
                        </p>
                    </div>

                    <!-- Source Pagination -->
                    <div class="flex items-center justify-between gap-4 pt-2 border-t border-gray-50 text-xs font-semibold text-gray-500 shrink-0">
                        <div class="flex items-center gap-4">
                            <div>
                                Tổng: <span class="font-black text-gray-700">{{ filteredSourceTickets.length }}</span> xe
                                (Có Mã lệnh: <span class="font-black text-teal-600">{{ ticketsWithOrderCount }}</span>)
                            </div>
                            <span class="w-[1px] h-3 bg-gray-200"></span>
                            <div class="flex items-center gap-1.5">
                                <span>Hiển thị:</span>
                                <select
                                    v-model.number="itemsPerPage"
                                    class="px-2 py-1 bg-white border border-gray-200 rounded-[8px] text-xs font-bold focus:outline-none focus:border-primary cursor-pointer text-gray-700"
                                >
                                    <option :value="10">10</option>
                                    <option :value="20">20</option>
                                    <option :value="50">50</option>
                                    <option :value="100">100</option>
                                </select>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <template v-if="sourceTotalPages > 1">
                                <button
                                    type="button"
                                    @click="sourceCurrentPage = Math.max(1, sourceCurrentPage - 1)"
                                    :disabled="sourceCurrentPage === 1"
                                    class="size-7 rounded-lg hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-700 border border-gray-100"
                                >
                                    <span class="material-symbols-outlined text-base">chevron_left</span>
                                </button>
                                <span class="text-xs font-bold text-gray-500">
                                    Trang {{ sourceCurrentPage }} / {{ sourceTotalPages }}
                                </span>
                                <button
                                    type="button"
                                    @click="sourceCurrentPage = Math.min(sourceTotalPages, sourceCurrentPage + 1)"
                                    :disabled="sourceCurrentPage === sourceTotalPages"
                                    class="size-7 rounded-lg hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-700 border border-gray-100"
                                >
                                    <span class="material-symbols-outlined text-base">chevron_right</span>
                                </button>
                            </template>
                        </div>
                    </div>
                </div>

                <!-- BẢNG TAB 2: SỔ THEO DÕI (Giữ nguyên đầy đủ như trước đây) -->
                <div v-else class="flex-1 flex flex-col gap-3 min-h-0">
                    <div
                        v-if="filteredHistoryTrips.length > 0"
                        class="flex-1 overflow-auto border border-gray-100 rounded-[16px] min-h-0 custom-scroll"
                    >
                        <table class="w-full text-left border-collapse text-xs font-bold min-w-[1350px] whitespace-nowrap">
                            <thead class="bg-gray-50 border-b border-gray-100 sticky top-0 z-10 text-gray-500 select-none">
                                <tr>
                                    <th class="py-2.5 px-3 w-12 text-center">STT</th>
                                    <th
                                        @click="toggleHistorySort('ticketNo')"
                                        class="py-2.5 px-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        Số phiếu
                                    </th>
                                    <th
                                        @click="toggleHistorySort('orderNo')"
                                        class="py-2.5 px-3 text-center cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        Mã lệnh
                                    </th>
                                    <th
                                        @click="toggleHistorySort('plateNumber')"
                                        class="py-2.5 px-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        Số xe
                                    </th>
                                    <th
                                        @click="toggleHistorySort('customer')"
                                        class="py-2.5 px-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        Khách hàng
                                    </th>
                                    <th
                                        @click="toggleHistorySort('cargoType')"
                                        class="py-2.5 px-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        Loại hàng
                                    </th>
                                    <th
                                        @click="toggleHistorySort('weight1')"
                                        class="py-2.5 px-3 text-right cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        TL1 (kg)
                                    </th>
                                    <th
                                        @click="toggleHistorySort('weight2')"
                                        class="py-2.5 px-3 text-right cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        TL2 (kg)
                                    </th>
                                    <th
                                        @click="toggleHistorySort('weightNet')"
                                        class="py-2.5 px-3 text-right cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        KL hàng (kg)
                                    </th>
                                    <th
                                        @click="toggleHistorySort('date1Obj')"
                                        class="py-2.5 px-3 text-center cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        Thời gian vào
                                    </th>
                                    <th
                                        @click="toggleHistorySort('date2Obj')"
                                        class="py-2.5 px-3 text-center cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        Thời gian ra
                                    </th>
                                    <th
                                        @click="toggleHistorySort('bargeName')"
                                        class="py-2.5 px-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        Tên sà lan / Kho
                                    </th>
                                    <th class="py-2.5 px-3">Ghi chú</th>
                                    <th class="py-2.5 px-3 text-center w-20">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100 text-[#1e293b]/90">
                                <tr
                                    v-for="(trip, idx) in pagedHistoryTrips"
                                    :key="trip.id || trip.stt || idx"
                                    class="hover:bg-gray-50 transition-colors"
                                >
                                    <td class="py-2 px-3 text-center font-bold text-gray-400">
                                        {{ (historyCurrentPage - 1) * itemsPerPage + idx + 1 }}
                                    </td>
                                    <td class="py-2 px-3 font-semibold text-gray-700 font-mono">
                                        {{ trip.ticketNo || '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-center font-semibold text-teal-600 font-mono">
                                        {{ trip.orderNo || '-' }}
                                    </td>
                                    <td class="py-2 px-3 font-bold text-gray-900 font-mono">
                                        {{ formatPlate(trip.plateNumber) }}
                                    </td>
                                    <td class="py-2 px-3 truncate max-w-[140px] text-gray-600" :title="trip.customer">
                                        {{ trip.customer || '-' }}
                                    </td>
                                    <td class="py-2 px-3 truncate max-w-[120px]" :title="trip.cargoType">
                                        {{ trip.cargoType || '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-right font-mono text-gray-700">
                                        {{ trip.weight1 ? trip.weight1.toLocaleString() : '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-right font-mono text-gray-700">
                                        {{ trip.weight2 ? trip.weight2.toLocaleString() : '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-right font-black text-primary font-mono">
                                        {{
                                            (
                                                trip.weightNet || (trip.weightTons ? trip.weightTons * 1000 : 0)
                                            ).toLocaleString()
                                        }}
                                    </td>
                                    <td class="py-2 px-3 text-center text-gray-500 font-mono">
                                        {{
                                            trip.date1Obj
                                                ? formatExcelDateTimeCombined(trip.date1Obj)
                                                : trip.timeStr || '-'
                                        }}
                                    </td>
                                    <td class="py-2 px-3 text-center text-gray-500 font-mono">
                                        {{ trip.date2Obj ? formatExcelDateTimeCombined(trip.date2Obj) : '-' }}
                                    </td>
                                    <td class="py-2 px-3 truncate max-w-[130px] text-gray-600" :title="trip.bargeName">
                                        {{ trip.bargeName || '-' }}
                                    </td>
                                    <td class="py-2 px-3 truncate max-w-[140px] text-gray-400" :title="trip.notes">
                                        {{ trip.notes || '-' }}
                                    </td>
                                    <td class="py-2 px-3 text-center">
                                        <div class="flex items-center justify-center gap-1.5">
                                            <button
                                                type="button"
                                                @click="editHistoryTripOrderNo(trip)"
                                                class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                                title="Sửa Mã lệnh"
                                            >
                                                <span class="material-symbols-outlined text-xs">edit</span>
                                            </button>
                                            <button
                                                type="button"
                                                @click="deleteHistoryTrip(trip)"
                                                class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                                title="Xóa"
                                            >
                                                <span class="material-symbols-outlined text-xs">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div
                        v-else
                        class="flex-1 flex flex-col items-center justify-center p-8 text-gray-400 italic text-center gap-2 border border-dashed border-gray-100 rounded-[16px]"
                    >
                        <span class="material-symbols-outlined text-4xl text-gray-300">inventory_2</span>
                        <p class="text-xs font-semibold max-w-[320px] leading-relaxed">
                            {{
                                existingTrips.length === 0
                                    ? 'Sổ theo dõi chưa có dữ liệu.'
                                    : 'Không tìm thấy bản ghi nào khớp bộ lọc!'
                            }}
                        </p>
                    </div>

                    <!-- History Pagination -->
                    <div class="flex items-center justify-between gap-4 pt-2 border-t border-gray-50 text-xs font-semibold text-gray-500 shrink-0">
                        <div class="flex items-center gap-4">
                            <div>
                                Tổng: <span class="font-black text-gray-700">{{ filteredHistoryTrips.length }}</span>
                            </div>
                            <span class="w-[1px] h-3 bg-gray-200"></span>
                            <div class="flex items-center gap-1.5">
                                <span>Hiển thị:</span>
                                <select
                                    v-model.number="itemsPerPage"
                                    class="px-2 py-1 bg-white border border-gray-200 rounded-[8px] text-xs font-bold focus:outline-none focus:border-primary cursor-pointer text-gray-700"
                                >
                                    <option :value="10">10</option>
                                    <option :value="20">20</option>
                                    <option :value="50">50</option>
                                    <option :value="100">100</option>
                                </select>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <template v-if="historyTotalPages > 1">
                                <button
                                    type="button"
                                    @click="historyCurrentPage = Math.max(1, historyCurrentPage - 1)"
                                    :disabled="historyCurrentPage === 1"
                                    class="size-7 rounded-lg hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-700 border border-gray-100"
                                >
                                    <span class="material-symbols-outlined text-base">chevron_left</span>
                                </button>
                                <span class="text-xs font-bold text-gray-500">
                                    Trang {{ historyCurrentPage }} / {{ historyTotalPages }}
                                </span>
                                <button
                                    type="button"
                                    @click="historyCurrentPage = Math.min(historyTotalPages, historyCurrentPage + 1)"
                                    :disabled="historyCurrentPage === historyTotalPages"
                                    class="size-7 rounded-lg hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-700 border border-gray-100"
                                >
                                    <span class="material-symbols-outlined text-base">chevron_right</span>
                                </button>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <!-- DIALOG: ADD/EDIT TICKET -->
        <Teleport to="body">
            <div
                v-if="showTicketDialog"
                class="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 font-display no-print"
                @click.self="showTicketDialog = false"
            >
                <div class="bg-white rounded-[24px] soft-shadow border border-primary/5 w-full max-w-lg overflow-hidden flex flex-col">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-black text-[#1e293b] flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-primary text-base">receipt_long</span>
                                {{ editingTicket ? 'Chỉnh sửa phiếu cân' : 'Thêm phiếu cân thủ công' }}
                            </h3>
                            <p class="text-xs text-gray-400">
                                Các xe có nhập "Mã lệnh" sẽ được đồng bộ sang Báo cáo lô hàng
                            </p>
                        </div>
                        <button
                            type="button"
                            @click="showTicketDialog = false"
                            class="size-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-all"
                        >
                            <span class="material-symbols-outlined text-base">close</span>
                        </button>
                    </div>

                    <div class="p-5 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Số xe (Biển số) *
                                </label>
                                <input
                                    v-model="dialogTicket.plateNumber"
                                    type="text"
                                    placeholder="Ví dụ: 61H-16907"
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-bold focus:outline-none uppercase"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold text-teal-600 uppercase tracking-wider">
                                    Mã lệnh (Ma lenh - Lô hàng)
                                </label>
                                <input
                                    v-model="dialogTicket.orderNo"
                                    type="text"
                                    placeholder="Ví dụ: 1, 2, L123..."
                                    class="px-3.5 py-2.5 rounded-2xl bg-teal-50/60 border border-teal-200 focus:border-teal-600 focus:bg-white text-xs font-mono font-bold text-teal-700 focus:outline-none"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Số phiếu cân
                                </label>
                                <input
                                    v-model="dialogTicket.ticketNo"
                                    type="text"
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-semibold focus:outline-none"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Sà lan / Kho (Loai Salan)
                                </label>
                                <input
                                    v-model="dialogTicket.bargeName"
                                    type="text"
                                    placeholder="Ví dụ: KHO 4, SG 9988..."
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-semibold focus:outline-none"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    KL cân lần 1 (kg)
                                </label>
                                <input
                                    v-model.number="dialogTicket.weight1"
                                    type="number"
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-semibold focus:outline-none"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    KL cân lần 2 (kg)
                                </label>
                                <input
                                    v-model.number="dialogTicket.weight2"
                                    type="number"
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-semibold focus:outline-none"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5 col-span-2">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Khối lượng hàng thực tế (Net - kg) *
                                </label>
                                <input
                                    v-model.number="dialogTicket.weightNet"
                                    type="number"
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-black text-primary focus:outline-none"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Khách hàng
                                </label>
                                <input
                                    v-model="dialogTicket.customer"
                                    type="text"
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-semibold focus:outline-none"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Loại hàng hóa
                                </label>
                                <input
                                    v-model="dialogTicket.cargoType"
                                    type="text"
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-semibold focus:outline-none"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Ngày cân vào (DD/MM/YYYY)
                                </label>
                                <input
                                    v-model="dialogTicket.dateInStr"
                                    type="text"
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-semibold focus:outline-none"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Giờ cân vào (HH:mm:ss)
                                </label>
                                <input
                                    v-model="dialogTicket.timeInStr"
                                    type="text"
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-semibold focus:outline-none"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Ngày cân ra (DD/MM/YYYY)
                                </label>
                                <input
                                    v-model="dialogTicket.dateOutStr"
                                    type="text"
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-semibold focus:outline-none"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Giờ cân ra (HH:mm:ss)
                                </label>
                                <input
                                    v-model="dialogTicket.timeOutStr"
                                    type="text"
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-semibold focus:outline-none"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Xuất / Nhập
                                </label>
                                <select
                                    v-model="dialogTicket.direction"
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-semibold focus:outline-none cursor-pointer"
                                >
                                    <option value="Nhap">Nhap (File 1)</option>
                                    <option value="Xuat">Xuat (File 2)</option>
                                </select>
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Tài xế / Nguồn
                                </label>
                                <input
                                    v-model="dialogTicket.driverName"
                                    type="text"
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-semibold focus:outline-none"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5 col-span-2">
                                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Ghi chú
                                </label>
                                <input
                                    v-model="dialogTicket.notes"
                                    type="text"
                                    class="px-3.5 py-2.5 rounded-2xl bg-[#f1f5f9] border border-transparent focus:border-primary/30 focus:bg-white text-xs font-semibold focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div class="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            @click="showTicketDialog = false"
                            class="px-4 py-2 bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl text-xs transition-all cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            @click="saveTicket"
                            class="px-5 py-2 bg-primary text-white font-bold rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none text-xs transition-all cursor-pointer"
                        >
                            Lưu phiếu cân
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Confirm Modal -->
        <Teleport to="body">
            <div
                v-if="confirmDialog.show"
                class="fixed inset-0 z-[999] flex items-center justify-center bg-[#1e293b]/40 backdrop-blur-sm p-4 font-display"
                @click.self="confirmDialog.onCancel && confirmDialog.onCancel()"
            >
                <div class="w-full max-w-[480px] bg-white rounded-[24px] border border-gray-100 shadow-2xl p-6 flex flex-col gap-4">
                    <div class="flex items-center gap-3">
                        <div
                            class="size-10 rounded-full flex items-center justify-center shrink-0"
                            :class="[
                                confirmDialog.type === 'danger'
                                    ? 'bg-red-50 text-red-600'
                                    : confirmDialog.type === 'warning'
                                      ? 'bg-amber-50 text-amber-600'
                                      : 'bg-primary/10 text-primary'
                            ]"
                        >
                            <span class="material-symbols-outlined text-xl">
                                {{
                                    confirmDialog.type === 'danger'
                                        ? 'error'
                                        : confirmDialog.type === 'warning'
                                          ? 'warning'
                                          : 'info'
                                }}
                            </span>
                        </div>
                        <h3 class="text-sm font-black text-gray-900 leading-tight">
                            {{ confirmDialog.title }}
                        </h3>
                    </div>

                    <div class="text-xs font-semibold text-gray-700 leading-relaxed whitespace-pre-wrap max-h-[280px] overflow-y-auto pr-1">
                        {{ confirmDialog.message }}
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-50">
                        <button
                            type="button"
                            @click="confirmDialog.onCancel && confirmDialog.onCancel()"
                            class="h-9 px-4 rounded-2xl text-xs font-bold text-gray-600 hover:bg-gray-50 border border-gray-200 cursor-pointer"
                        >
                            {{ confirmDialog.cancelText }}
                        </button>
                        <button
                            type="button"
                            @click="confirmDialog.onOk && confirmDialog.onOk()"
                            class="h-9 px-4 rounded-2xl text-xs font-bold text-white cursor-pointer"
                            :class="[
                                confirmDialog.type === 'danger'
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : confirmDialog.type === 'warning'
                                      ? 'bg-amber-500 hover:bg-amber-600'
                                      : 'bg-primary hover:bg-primary/95'
                            ]"
                        >
                            {{ confirmDialog.okText }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.custom-scroll::-webkit-scrollbar {
    width: 5px;
    height: 5px;
}
.custom-scroll::-webkit-scrollbar-thumb {
    background: rgba(74, 120, 194, 0.2);
    border-radius: 9999px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(74, 120, 194, 0.4);
}
</style>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useToast } from '@/composables/useToast';
import { dbContext } from '@/services/storage/DBContext';
import { supabase } from '@/supabase';
import { authStore, hasDetailPermission } from '@/stores/auth';
import VehicleManager from '@/components/tools/VehicleManager.vue';
import GoodsManager from '@/components/tools/GoodsManager.vue';
import WeighbridgeOtherManager from '@/components/tools/WeighbridgeOtherManager.vue';
import { LogService } from '@/services/storage/LogService';
import { AllocatorService } from '@/services/excel/AllocatorService';
import { VehicleService } from '@/services/excel/VehicleService';

const { addToast } = useToast();

interface Barge {
    id: number;
    name: string;
    vesselId: number;
    config?: {
        locked?: boolean;
        orderNo?: string;
    };
}

interface Vessel {
    id: number;
    name: string;
    barges?: Barge[];
}

const props = defineProps<{
    activeSubView?: string;
    activeVesselId?: number | null;
    activeBargeId?: number | null;
    vesselsList?: Vessel[];
}>();

// Local navigation selection state
const activeVesselId = ref<number | null>(null);
const activeBargeId = ref<number | 'vehicles' | null>(null);
const activeSubViewMode = ref<'allocator' | 'vehicles' | 'goods' | 'other_tickets'>('allocator');

const formatDateTimeStr = (isoString: string): string => {
    if (!isoString) return '';
    try {
        const str = String(isoString).trim();

        // 1. Direct YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm regex extraction
        const match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[T\s]+(\d{1,2}):(\d{1,2})/);
        if (match && match[1] && match[2] && match[3] && match[4] && match[5]) {
            const y = match[1];
            const m = match[2];
            const d = match[3];
            const h = match[4];
            const min = match[5];
            return `${h.padStart(2, '0')}:${min.padStart(2, '0')} ${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
        }

        // 2. Direct DD/MM/YYYY HH:mm regex extraction
        const matchDmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[T\s]+(\d{1,2}):(\d{1,2})/);
        if (matchDmy && matchDmy[1] && matchDmy[2] && matchDmy[3] && matchDmy[4] && matchDmy[5]) {
            const d = matchDmy[1];
            const m = matchDmy[2];
            const y = matchDmy[3];
            const h = matchDmy[4];
            const min = matchDmy[5];
            return `${h.padStart(2, '0')}:${min.padStart(2, '0')} ${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
        }

        // 3. Fallback: Parse using local Date (replacing T with space to force local parsing)
        const localStr = str.replace('T', ' ');
        const date = new Date(localStr);
        if (isNaN(date.getTime())) return isoString;
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${h}:${min} ${d}/${m}/${y}`;
    } catch(e) {
        return isoString;
    }
};

const formatNumber = (num: number): string => {
    return Number(num).toLocaleString('en-US');
};

const activeBarge = computed(() => {
    if (!activeBargeId.value || activeBargeId.value === 'vehicles') return null;
    for (const v of vessels.value) {
        if (v.barges) {
            const b = v.barges.find(barge => barge.id === activeBargeId.value);
            if (b) {
                return {
                    ...b,
                    vesselName: v.name
                };
            }
        }
    }
    return null;
});


// Types
interface CSVRecord {
    id?: string;
    ticketNo: string;
    plateNumber: string;
    customer: string;
    weight1: number;
    weight2: number;
    weightNet: number; // in kg
    dateInStr: string;
    timeInStr: string;
    dateOutStr: string;
    timeOutStr: string;
    direction: string; // Xuat/Nhap
    cargoType: string;
    bargeName: string;
    driverName: string;
    notes: string;
    orderNo?: string;
}

interface CapacityConfig {
    code: number;
    tttp: number;      // Trọng tải cho phép (tấn)
    limit: number;     // Trọng lượng hàng cho phép (tấn)
}


interface SplitTrip {
    stt: number;
    timeStr: string;
    plateNumber: string;
    tttp: number;
    limit: number;
    ticketNo: string;
    sourceTicketNo?: string; // Original CSV ticketNo for ALL splits (not just first)
    cargoType: string;
    weightTons: number;
    notes: string;
    isNew?: boolean;
    // New fields to match "Ánh phân bổ bằng tay.csv"
    customer: string;
    weight1: number;
    weight2: number;
    weightNet: number;
    direction: string;
    bargeName: string;
    date1Obj: Date;
    date2Obj: Date;
    orderNo?: string;
    id?: number;
    isRecovered?: boolean;
}

// Local State
const csvFile = ref<File | null>(null);
const ticketFileInput = ref<HTMLInputElement | null>(null);
const importOrderNo = ref('');



function triggerTicketFileInput() {
    ticketFileInput.value?.click();
}
const csvRecords = ref<CSVRecord[]>([]);
const generatedTrips = ref<SplitTrip[]>([]);
const existingTrips = ref<SplitTrip[]>([]);
const isSavingToHistory = ref(false);
const isInitLoading = ref(false);

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

function handleConfirmOk() {
    if (confirmDialog.value.onOk) {
        confirmDialog.value.onOk();
    }
}

function handleConfirmCancel() {
    if (confirmDialog.value.onCancel) {
        confirmDialog.value.onCancel();
    }
}
const vehiclesList = ref<{ plateNumber: string; moocNumber: string; }[]>([]);

// Types & Channel Sync
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
                if (JSON.stringify(vehiclesList.value) !== JSON.stringify(savedVehicles)) {
                    vehiclesList.value = savedVehicles;
                }
            }
        } else if (event.data.type === 'sync_response') {
            addToast(event.data.message, event.data.status);
        }
    } catch (e) {
        console.error('Lỗi khi đồng bộ giữa các tab:', e);
    } finally {
        isSyncingFromChannel = false;
    }
};

onUnmounted(() => {
    try {
        syncChannel.close();
    } catch (e) {
        console.error('Lỗi khi đóng sync channel:', e);
    }
});

const loadingCSV = ref(false);
const compiling = ref(false);

// Capacity configuration standards
const standardTTTPLimit = ref(10.0);
const standardCurbMin = ref(1.5);
const standardCurbMax = ref(3.0);

function createSeededRandom(seedStr: string) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    let seed = hash;
    return function() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
}

function getRandomLimit(tttp: number, plate: string): number {
    const seed = plate ? plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : 'DEFAULT';
    const rand = createSeededRandom(seed);
    const minCurb = standardCurbMin.value;
    const maxCurb = standardCurbMax.value;
    const curbWeight = minCurb + rand() * (maxCurb - minCurb);
    return Math.round((tttp - curbWeight) * 100) / 100;
}

const vehicleLimitCache = new Map<string, { tttp: number; limit: number }>();

// Algorithmic parameters
const distStrategy = ref<'even' | 'max' | 'random'>('random');
const spacingStrategy = ref<'even' | 'forward' | 'backward'>('even');
const timeIntervalMinutes = ref(90);

const ticketPrefix = ref('');
const ticketSuffix = ref('/mmyy');
const ticketStart = ref(1);
const ticketPadding = ref(6);
const useAutoTicketNo = ref(true);

const canEditRules = computed(() => {
    return authStore.role === 'admin' || hasDetailPermission('allocator', 'al_rules_manage', 'update');
});

const previewTicketNo = computed(() => {
    const num = String(ticketStart.value).padStart(ticketPadding.value, '0');
    const dateObj = new Date();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yy = String(dateObj.getFullYear()).slice(-2);
    
    let suffixPattern = ticketSuffix.value || '';
    if (suffixPattern.toLowerCase().includes('mmyy')) {
        suffixPattern = suffixPattern.replace(/mmyy/i, `${mm}${yy}`);
    } else {
        suffixPattern = suffixPattern
            .replace(/mm/g, mm)
            .replace(/yy/g, yy);
    }
    
    return ticketPrefix.value + num + suffixPattern;
});

watch(ticketPrefix, async (newVal) => {
    try {
        await dbContext.set('allocator_ticket_prefix', newVal);
    } catch (e) {}
});

watch(ticketSuffix, async (newVal) => {
    try {
        await dbContext.set('allocator_ticket_suffix', newVal);
    } catch (e) {}
});

watch(ticketStart, async (newVal) => {
    try {
        await dbContext.set('allocator_ticket_start', newVal);
    } catch (e) {}
});

watch(ticketPadding, async (newVal) => {
    try {
        await dbContext.set('allocator_ticket_padding', newVal);
    } catch (e) {}
});

watch(useAutoTicketNo, async (newVal) => {
    try {
        await dbContext.set('allocator_use_auto_ticket', newVal);
    } catch (e) {}
});


watch(standardTTTPLimit, async (newVal) => {
    vehicleLimitCache.clear();
    try {
        await dbContext.set('allocator_standard_limit', newVal);
    } catch (e) {
        console.error('Lỗi khi lưu hạn mức tiêu chuẩn vào IndexedDB:', e);
    }
}, { immediate: true });

watch(standardCurbMin, async (newVal) => {
    vehicleLimitCache.clear();
    try {
        await dbContext.set('allocator_curb_min', newVal);
    } catch (e) {
        console.error('Lỗi khi lưu xác xe tối thiểu vào IndexedDB:', e);
    }
});

watch(standardCurbMax, async (newVal) => {
    vehicleLimitCache.clear();
    try {
        await dbContext.set('allocator_curb_max', newVal);
    } catch (e) {
        console.error('Lỗi khi lưu xác xe tối đa vào IndexedDB:', e);
    }
});

watch(csvRecords, () => {
    vehicleLimitCache.clear();
});

watch(distStrategy, async (newVal) => {
    try {
        await dbContext.set('allocator_dist_strategy', newVal);
    } catch (e) {}
});

watch(spacingStrategy, async (newVal) => {
    try {
        await dbContext.set('allocator_spacing_strategy', newVal);
    } catch (e) {}
});

watch(timeIntervalMinutes, async (newVal) => {
    try {
        await dbContext.set('allocator_time_interval', newVal);
    } catch (e) {}
});

// Auto-save settings on change

// Pagination
const itemsPerPage = ref(20);
watch(itemsPerPage, () => {
    sourceCurrentPage.value = 1;
    historyCurrentPage.value = 1;
});

// Parse CSV text safely
function parseCSVText(text: string): CSVRecord[] {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    
    const parseLine = (line: string): string[] => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(cur.trim());
                cur = '';
            } else {
                cur += char;
            }
        }
        result.push(cur.trim());
        return result;
    };
    
    // Parse headers and strip BOM if any
    const headers = parseLine(lines[0] || '').map(h => h.replace(/^\uFEFF/, '').trim());
    
    // Map headers to indexes
    const idxTicket = headers.findIndex(h => h.toLowerCase().includes('phieu'));
    const idxPlate = headers.findIndex(h => h.toLowerCase().includes('xe'));
    const idxCustomer = headers.findIndex(h => h.toLowerCase().includes('khach'));
    const idxWeight1 = headers.findIndex(h => h.toLowerCase().includes('lan 1'));
    const idxWeight2 = headers.findIndex(h => h.toLowerCase().includes('lan 2'));
    const idxWeightNet = headers.findIndex(h => h.toLowerCase().includes('kl') && h.toLowerCase().includes('hang'));
    const idxDate1 = headers.findIndex(h => h.toLowerCase().includes('ngay can lan 1'));
    const idxTime1 = headers.findIndex(h => h.toLowerCase().includes('gio can lan 1'));
    const idxDate2 = headers.findIndex(h => h.toLowerCase().includes('ngay can lan 2'));
    const idxTime2 = headers.findIndex(h => h.toLowerCase().includes('gio can lan 2'));
    const idxDirection = headers.findIndex(h => h.toLowerCase().includes('xuat/nhap'));
    const idxCargoType = headers.findIndex(h => h.toLowerCase().includes('loai hang'));
    const idxBarge = headers.findIndex(h => h.toLowerCase().includes('salan') || h.toLowerCase().includes('sa lan'));
    const idxDriver = headers.findIndex(h => h.toLowerCase().includes('tai xe') || h.toLowerCase().includes('tài xế'));
    const idxNotes = headers.findIndex(h => h.toLowerCase().includes('ghi chu') || h.toLowerCase().includes('ghi chú'));
    const idxOrderNo = headers.findIndex(h => h.toLowerCase().includes('lenh') || h.toLowerCase().includes('lệnh') || h.toLowerCase().includes('order'));

    const records: CSVRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = parseLine(lines[i] || '');
        if (parts.length < Math.max(idxTicket, idxPlate, idxWeightNet)) continue;
        
        const plate = parts[idxPlate] || '';
        if (!plate) continue;

        records.push({
            id: 'ticket_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
            ticketNo: parts[idxTicket] || '',
            plateNumber: plate,
            customer: (idxCustomer !== -1 ? parts[idxCustomer] : '') || '',
            weight1: idxWeight1 !== -1 ? parseFloat(parts[idxWeight1] || '0') || 0 : 0,
            weight2: idxWeight2 !== -1 ? parseFloat(parts[idxWeight2] || '0') || 0 : 0,
            weightNet: idxWeightNet !== -1 ? parseFloat(parts[idxWeightNet] || '0') || 0 : 0,
            dateInStr: (idxDate1 !== -1 ? parts[idxDate1] : '') || '',
            timeInStr: (idxTime1 !== -1 ? parts[idxTime1] : '') || '',
            dateOutStr: (idxDate2 !== -1 ? parts[idxDate2] : '') || '',
            timeOutStr: (idxTime2 !== -1 ? parts[idxTime2] : '') || '',
            direction: (idxDirection !== -1 ? parts[idxDirection] : '') || '',
            cargoType: (idxCargoType !== -1 ? parts[idxCargoType] : '') || '',
            bargeName: (idxBarge !== -1 ? parts[idxBarge] : '') || '',
            driverName: (idxDriver !== -1 ? parts[idxDriver] : '') || '',
            notes: (idxNotes !== -1 ? parts[idxNotes] : '') || '',
            orderNo: (idxOrderNo !== -1 ? parts[idxOrderNo] : '') || ''
        });
    }
    return records;
}

// Normalize plate numbers to compare easily
function normalizePlate(plate: string | null | undefined): string {
    if (!plate) return '';
    return String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Format plate numbers to standard display: e.g. "61H-16907"
function formatPlate(plate: string | null | undefined): string {
    if (!plate) return '';
    let clean = String(plate).trim().toUpperCase().replace(/\s+/g, '');
    
    // If it already contains a slash, extract the main plate number and existing mooc
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
    
    // Look up mooc in vehiclesList
    const normalized = normalizePlate(mainPlate);
    const matches = vehiclesList.value.filter(v => normalizePlate(v.plateNumber) === normalized);
    const vehicle = matches.find(v => v.moocNumber && v.moocNumber.trim() !== '') || matches[0];
    
    const targetMooc = (vehicle && vehicle.moocNumber) ? vehicle.moocNumber : existingMooc;
    
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

// Convert DD/MM/YYYY or YYYY-MM-DD and HH:mm:ss strings to Date object
function parseDateTime(dateStr: string, timeStr: string): Date {
    try {
        if (!dateStr) return new Date();
        
        // If dateStr contains both date and time
        if (dateStr.includes(' ') && !timeStr) {
            const parts = dateStr.split(' ');
            dateStr = parts[0] || '';
            timeStr = parts[1] || '';
        }
        
        // Replace dashes with slashes
        const normalizedDate = dateStr.replace(/-/g, '/');
        const dParts = normalizedDate.split('/');
        
        let day = 1;
        let month = 0;
        let year = new Date().getFullYear();

        if (dParts.length >= 3) {
            const p0 = dParts[0] || '';
            const p1 = dParts[1] || '';
            const p2 = dParts[2] || '';
            // Check if first part is 4-digit year (YYYY/MM/DD)
            if (p0.length === 4) {
                year = parseInt(p0, 10);
                month = parseInt(p1 || '1', 10) - 1;
                day = parseInt(p2 || '1', 10);
            } else {
                // DD/MM/YYYY
                day = parseInt(p0 || '1', 10);
                month = parseInt(p1 || '1', 10) - 1;
                year = parseInt(p2 || '0', 10);
                if (year < 100) {
                    year += 2000;
                }
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
    } catch (e) {
        return new Date();
    }
}

function ensureDate(d: any): Date {
    if (d instanceof Date) return d;
    if (!d) return new Date();
    // Handle serialized Supabase timestamps or string dates safely
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatExcelDate(date: any): string {
    const d = ensureDate(date);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function formatExcelDateTimeCombined(date: any): string {
    const d = ensureDate(date);
    const hour24 = d.getHours();
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${hour12}:${min} ${ampm}`;
}

function getHistoryDuplicates(records: CSVRecord[]): { dupRecords: CSVRecord[], description: string } {
    const dupRecords: CSVRecord[] = [];
    records.forEach(rec => {
        const isDup = existingTrips.value.some(et => {
            if (rec.ticketNo && et.ticketNo && rec.ticketNo === et.ticketNo) {
                return true;
            }
            // Check by plate + weight + date only if ticket number is missing
            if (!rec.ticketNo && rec.plateNumber) {
                const recDate = parseDateTime(rec.dateInStr, rec.timeInStr);
                const etDate = ensureDate(et.date1Obj);
                return normalizePlate(rec.plateNumber) === normalizePlate(et.plateNumber) &&
                       rec.weightNet === et.weightNet &&
                       formatExcelDate(recDate) === formatExcelDate(etDate);
            }
            return false;
        });
        if (isDup) {
            dupRecords.push(rec);
        }
    });
    
    const desc = dupRecords.map(r => r.ticketNo ? `- Phiếu ${r.ticketNo} (${formatPlate(r.plateNumber)})` : `- Xe ${formatPlate(r.plateNumber)} (${r.weightNet.toLocaleString()} kg)`).join('\n');
    return { dupRecords, description: desc };
}

// Handle Ticket Import (accepts CSV and Excel)
async function handleTicketImport(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    
    csvFile.value = file;
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (ext === 'csv') {
        loadingCSV.value = true;
        try {
            const text = await file.text();
            const newRecords = parseCSVText(text);
            
            let finalRecords = newRecords;
            const { dupRecords, description } = getHistoryDuplicates(newRecords);
            if (dupRecords.length > 0) {
                const proceed = await showConfirm({
                    title: 'Trùng lặp dữ liệu tệp nhập',
                    message: `Phát hiện ${dupRecords.length} phiếu cân trong tệp tải lên đã tồn tại trong Sổ Theo Dõi:\n\n${description}\n\n- Nhấn OK: Để BỎ QUA các dòng trùng này và chỉ nhập các dòng mới.\n- Nhấn Hủy (Cancel): Để nhập TẤT CẢ các dòng.`,
                    type: 'warning',
                    okText: 'Bỏ qua trùng',
                    cancelText: 'Nhập tất cả'
                });
                if (proceed) {
                    // Filter out duplicates
                    finalRecords = newRecords.filter(r => !dupRecords.some(dr => {
                        if (r.ticketNo && dr.ticketNo) return r.ticketNo === dr.ticketNo;
                        return r.plateNumber === dr.plateNumber && r.weightNet === dr.weightNet && r.dateInStr === dr.dateInStr;
                    }));
                }
            }
            
            const { added, updated, skipped } = mergeTickets(finalRecords);
            regenerateAllocatedTrips();
            addToast(`Import CSV: ${added} mới, ${updated} cập nhật, ${skipped} bỏ qua (trùng)`, 'success');
            await LogService.logAction('Import CSV', `Import CSV: ${added} mới, ${updated} cập nhật`);
            await saveTicketsToSupabase();
        } catch (error) {
            console.error(error);
            addToast('Lỗi khi đọc file CSV!', 'error');
        } finally {
            loadingCSV.value = false;
        }
    } else if (ext === 'xlsx' || ext === 'xls') {
        await handleTicketExcelUpload(file, importOrderNo.value);
    } else {
        addToast('Định dạng tệp không được hỗ trợ (chỉ hỗ trợ .csv, .xlsx, .xls)', 'error');
    }
}

// Handle Excel tickets file upload
async function handleTicketExcelUpload(file: File, manualOrderNo: string = '') {
    loadingCSV.value = true;
    try {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const arrayBuffer = await file.arrayBuffer();
        await workbook.xlsx.load(arrayBuffer);
        
        const sheet = workbook.worksheets[0];
        if (!sheet) {
            addToast('Không tìm thấy sheet nào trong file Excel!', 'error');
            return;
        }
        
        let headerRowIdx = -1;
        let headers: string[] = [];
        
        for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
            const row = sheet.getRow(r);
            const rowValues = [];
            let hasKeywords = false;
            for (let c = 1; c <= Math.min(25, row.cellCount); c++) {
                const val = String(row.getCell(c).value || '').trim();
                rowValues.push(val);
                if (
                    val.toLowerCase().includes('phieu') || 
                    val.toLowerCase().includes('xe') || 
                    (val.toLowerCase().includes('kl') && val.toLowerCase().includes('hang'))
                ) {
                    hasKeywords = true;
                }
            }
            if (hasKeywords) {
                headerRowIdx = r;
                headers = rowValues;
                break;
            }
        }
        
        if (headerRowIdx === -1) {
            addToast('Không tìm thấy dòng tiêu đề phù hợp trong file Excel!', 'info');
            return;
        }
        
        // Map headers to column indexes
        const idxTicket = headers.findIndex(h => h.toLowerCase().includes('phieu'));
        const idxPlate = headers.findIndex(h => h.toLowerCase().includes('xe'));
        const idxCustomer = headers.findIndex(h => h.toLowerCase().includes('khach'));
        const idxWeight1 = headers.findIndex(h => h.toLowerCase().includes('lan 1'));
        const idxWeight2 = headers.findIndex(h => h.toLowerCase().includes('lan 2'));
        const idxWeightNet = headers.findIndex(h => h.toLowerCase().includes('kl') && h.toLowerCase().includes('hang'));
        const idxDate1 = headers.findIndex(h => h.toLowerCase().includes('ngay can lan 1') || h.toLowerCase().includes('ngày cân lần 1') || h.toLowerCase() === 'ngay can 1' || h.toLowerCase() === 'ngày cân 1');
        const idxTime1 = headers.findIndex(h => h.toLowerCase().includes('gio can lan 1') || h.toLowerCase().includes('giờ cân lần 1') || h.toLowerCase() === 'gio can 1' || h.toLowerCase() === 'giờ cân 1');
        const idxDate2 = headers.findIndex(h => h.toLowerCase().includes('ngay can lan 2') || h.toLowerCase().includes('ngày cân lần 2') || h.toLowerCase() === 'ngay can 2' || h.toLowerCase() === 'ngày cân 2');
        const idxTime2 = headers.findIndex(h => h.toLowerCase().includes('gio can lan 2') || h.toLowerCase().includes('giờ cân lần 2') || h.toLowerCase() === 'gio can 2' || h.toLowerCase() === 'giờ cân 2');
        const idxDirection = headers.findIndex(h => h.toLowerCase().includes('xuat/nhap') || h.toLowerCase().includes('xuất/nhập'));
        const idxCargoType = headers.findIndex(h => h.toLowerCase().includes('loai hang') || h.toLowerCase().includes('loại hàng'));
        const idxBarge = headers.findIndex(h => h.toLowerCase().includes('salan') || h.toLowerCase().includes('sa lan'));
        const idxDriver = headers.findIndex(h => h.toLowerCase().includes('tai xe') || h.toLowerCase().includes('tài xế'));
        const idxNotes = headers.findIndex(h => h.toLowerCase().includes('ghi chu') || h.toLowerCase().includes('ghi chú'));
        const idxOrderNo = headers.findIndex(h => h.toLowerCase().includes('lenh') || h.toLowerCase().includes('lệnh') || h.toLowerCase().includes('order'));
        
        const newRecords: CSVRecord[] = [];
        
        for (let r = headerRowIdx + 1; r <= sheet.rowCount; r++) {
            const row = sheet.getRow(r);
            const getVal = (idx: number) => {
                if (idx === -1) return '';
                const cell = row.getCell(idx + 1);
                if (cell.value && typeof cell.value === 'object') {
                    if ((cell.value as any).result !== undefined) {
                        return String((cell.value as any).result);
                    }
                    if (cell.value instanceof Date) {
                        return cell.value.toLocaleDateString('vi-VN');
                    }
                }
                return cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
            };
            
            const plate = getVal(idxPlate);
            if (!plate) continue;
            
            newRecords.push({
                ticketNo: getVal(idxTicket),
                plateNumber: plate,
                customer: getVal(idxCustomer),
                weight1: parseFloat(getVal(idxWeight1)) || 0,
                weight2: parseFloat(getVal(idxWeight2)) || 0,
                weightNet: parseFloat(getVal(idxWeightNet)) || 0,
                dateInStr: getVal(idxDate1),
                timeInStr: getVal(idxTime1),
                dateOutStr: getVal(idxDate2),
                timeOutStr: getVal(idxTime2),
                direction: getVal(idxDirection),
                cargoType: getVal(idxCargoType),
                bargeName: getVal(idxBarge),
                driverName: getVal(idxDriver),
                notes: getVal(idxNotes),
                orderNo: manualOrderNo.trim() || getVal(idxOrderNo)
            });
        }
        
        if (newRecords.length === 0) {
            addToast('Không tìm thấy dữ liệu phiếu cân hợp lệ nào trong file Excel!', 'info');
            return;
        }
        
        let finalRecords = newRecords;
        const { dupRecords, description } = getHistoryDuplicates(newRecords);
        if (dupRecords.length > 0) {
            const proceed = await showConfirm({
                title: 'Trùng lặp dữ liệu tệp nhập',
                message: `Phát hiện ${dupRecords.length} phiếu cân trong tệp tải lên đã tồn tại trong Sổ Theo Dõi:\n\n${description}\n\n- Nhấn OK: Để BỎ QUA các dòng trùng này và chỉ nhập các dòng mới.\n- Nhấn Hủy (Cancel): Để nhập TẤT CẢ các dòng.`,
                type: 'warning',
                okText: 'Bỏ qua trùng',
                cancelText: 'Nhập tất cả'
            });
            if (proceed) {
                // Filter out duplicates
                finalRecords = newRecords.filter(r => !dupRecords.some(dr => {
                    if (r.ticketNo && dr.ticketNo) return r.ticketNo === dr.ticketNo;
                    return r.plateNumber === dr.plateNumber && r.weightNet === dr.weightNet && r.dateInStr === dr.dateInStr;
                }));
            }
        }
        
        const { added, updated, skipped } = mergeTickets(finalRecords);
        regenerateAllocatedTrips();
        addToast(`Import Excel: ${added} mới, ${updated} cập nhật, ${skipped} bỏ qua (trùng)`, 'success');
        await LogService.logAction('Import Excel', `Import Excel phiếu cân: ${added} mới, ${updated} cập nhật`);
        await saveTicketsToSupabase();
        
    } catch (e) {
        console.error(e);
        addToast('Lỗi khi phân tích tệp Excel phiếu cân!', 'error');
    } finally {
        loadingCSV.value = false;
    }
}

// Smart merge tickets to prevent duplicates
function mergeTickets(newRecords: CSVRecord[]): { added: number; updated: number; skipped: number } {
    const currentList = [...csvRecords.value];
    let added = 0;
    let updated = 0;
    let skipped = 0;
    
    newRecords.forEach(rec => {
        // Tìm trùng theo số phiếu
        let matchIdx = rec.ticketNo 
            ? currentList.findIndex(x => x.ticketNo === rec.ticketNo)
            : -1;
        
        // Nếu không có số phiếu, tìm trùng theo biển số + khối lượng hàng + ngày vào
        if (matchIdx === -1 && !rec.ticketNo && rec.plateNumber) {
            matchIdx = currentList.findIndex(x => 
                x.plateNumber === rec.plateNumber && 
                x.weightNet === rec.weightNet &&
                x.dateInStr === rec.dateInStr
            );
        }
            
        const id = rec.id || 'ticket_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const mergedRec = { ...rec, id };
        
        if (matchIdx !== -1) {
            // Kiểm tra nếu dữ liệu hoàn toàn giống nhau thì bỏ qua
            const existing = currentList[matchIdx];
            if (existing && existing.ticketNo === rec.ticketNo && existing.plateNumber === rec.plateNumber && existing.weightNet === rec.weightNet) {
                skipped++;
            } else {
                currentList[matchIdx] = mergedRec;
                updated++;
            }
        } else {
            currentList.push(mergedRec);
            added++;
        }
    });
    
    csvRecords.value = currentList;
    saveTicketsToSupabase();
    return { added, updated, skipped };
}

// CRUD State & Functions
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
    direction: 'XUẤT KHẨU',
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
        direction: 'XUẤT KHẨU',
        cargoType: 'Viên Nén Gỗ',
        bargeName: '',
        driverName: '',
        notes: ''
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
    regenerateAllocatedTrips();
    showTicketDialog.value = false;
    saveTicketsToSupabase();
}

async function deleteTicket(ticket: CSVRecord) {
    if (authStore.role !== 'admin' && !hasDetailPermission('allocator', 'al_barge_manage', 'delete')) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const confirm = await showConfirm({
        title: 'Xóa phiếu cân',
        message: `Bạn có chắc chắn muốn xóa phiếu cân ${ticket.ticketNo || ticket.plateNumber} không?`,
        type: 'danger',
        okText: 'Xóa',
        cancelText: 'Hủy'
    });
    if (confirm) {
        csvRecords.value = csvRecords.value.filter(t => t.id !== ticket.id);
        addToast('Đã xóa phiếu cân!', 'info');
        await LogService.logAction('Xóa phiếu cân', 'Xóa phiếu cân: ' + (ticket.ticketNo || ticket.plateNumber));
        regenerateAllocatedTrips();
        saveTicketsToSupabase();
    }
}

// Clear all tickets
async function clearAllTickets() {
    if (authStore.role !== 'admin' && !hasDetailPermission('allocator', 'al_barge_manage', 'delete')) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const confirm = await showConfirm({
        title: 'Xóa tất cả phiếu cân',
        message: 'Bạn có chắc chắn muốn xóa toàn bộ danh sách phiếu cân hiện tại không? Hành động này sẽ dọn sạch Tab 1.',
        type: 'danger',
        okText: 'Xóa hết',
        cancelText: 'Hủy'
    });
    if (confirm) {
        csvRecords.value = [];
        generatedTrips.value = [];
        csvFile.value = null;
        addToast('Đã xóa sạch danh sách phiếu cân!', 'info');
        await LogService.logAction('Xóa tất cả phiếu cân', 'Xóa toàn bộ danh sách phiếu cân');
        saveTicketsToSupabase();
    }
}

// Tabs and filters for Source tickets
const activeDataTab = ref<'source' | 'generated' | 'template'>('source');
const isSettingsCollapsed = ref(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
const sourceCurrentPage = ref(1);
const sourceSearchQuery = ref('');

// Sorting Helper Function
function compareValues(a: any, b: any, key: string, desc: boolean): number {
    let valA = a[key];
    let valB = b[key];
    
    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';
    
    // Date comparison
    if (key === 'dateObj' || key === 'date1Obj' || key === 'date2Obj') {
        const timeA = valA ? new Date(valA).getTime() : 0;
        const timeB = valB ? new Date(valB).getTime() : 0;
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

// Sorting states for Tab 1 (Source)
const sourceSortKey = ref<string>('');
const sourceSortDesc = ref<boolean>(false);

function toggleSourceSort(key: string) {
    if (sourceSortKey.value === key) {
        sourceSortDesc.value = !sourceSortDesc.value;
    } else {
        sourceSortKey.value = key;
        sourceSortDesc.value = false;
    }
    sourceCurrentPage.value = 1;
}

// Sorting states for Tab 2 (Theo dõi / Lịch sử)
const historySortKey = ref<string>('');
const historySortDesc = ref<boolean>(false);

function toggleHistorySort(key: string) {
    if (historySortKey.value === key) {
        historySortDesc.value = !historySortDesc.value;
    } else {
        historySortKey.value = key;
        historySortDesc.value = false;
    }
    historyCurrentPage.value = 1;
}

const filteredSourceTickets = computed(() => {
    let list = csvRecords.value;
    if (sourceSearchQuery.value.trim()) {
        const q = sourceSearchQuery.value.toLowerCase();
        list = list.filter(t => 
            t.plateNumber.toLowerCase().includes(q) || 
            t.ticketNo.toLowerCase().includes(q) || 
            t.cargoType.toLowerCase().includes(q)
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
    return Math.ceil(filteredSourceTickets.value.length / itemsPerPage.value);
});

watch(sourceSearchQuery, () => {
    sourceCurrentPage.value = 1;
});

const syncStatus = ref<'synced' | 'saving' | 'error'>('synced');

async function loadTicketsFromSupabase() {
    isInitLoading.value = true;
    try {
        const { data, error } = await supabase
            .from('content')
            .select('settings')
            .eq('id', 'main')
            .single();
        if (error) throw error;
        
        if (data?.settings) {
            isSyncingFromChannel = true; // disable watch writes during supabase load

            // 1. Overwrite tickets
            const remoteTickets = data.settings.allocator_tickets;
            if (Array.isArray(remoteTickets)) {
                if (JSON.stringify(csvRecords.value) !== JSON.stringify(remoteTickets)) {
                    csvRecords.value = remoteTickets;
                    await dbContext.set('allocator_tickets', remoteTickets);
                }
            } else {
                if (csvRecords.value.length > 0) {
                    csvRecords.value = [];
                    await dbContext.set('allocator_tickets', []);
                }
            }

            // 2. Load all history trips from dedicated table weighbridge_tracking
            try {
                const allTrips = await AllocatorService.getAllTrips();
                if (allTrips && allTrips.length > 0) {
                    existingTrips.value = allTrips as SplitTrip[];
                    await dbContext.set('allocator_history_trips', allTrips);
                } else if (existingTrips.value.length === 0) {
                    const cachedHistory = await dbContext.get<any[]>('allocator_history_trips');
                    if (cachedHistory && Array.isArray(cachedHistory)) {
                        existingTrips.value = hydrateTrips(cachedHistory);
                    }
                }
            } catch (errHistory) {
                console.warn('Lỗi khi tải lịch sử từ AllocatorService, sử dụng bộ nhớ đệm cục bộ:', errHistory);
                const cachedHistory = await dbContext.get<any[]>('allocator_history_trips');
                if (cachedHistory && Array.isArray(cachedHistory)) {
                    existingTrips.value = hydrateTrips(cachedHistory);
                }
            }

            // 3. Overwrite vehicles list from VehicleService
            try {
                const remoteVehicles = await VehicleService.getVehicles();
                if (Array.isArray(remoteVehicles) && remoteVehicles.length > 0) {
                    if (JSON.stringify(vehiclesList.value) !== JSON.stringify(remoteVehicles)) {
                        vehiclesList.value = remoteVehicles;
                        await dbContext.set('allocator_vehicles', remoteVehicles);
                    }
                }
            } catch (eVehicles) {
                console.warn('Lỗi khi tải danh sách xe từ VehicleService:', eVehicles);
            }

            syncStatus.value = 'synced';
        }
    } catch (e) {
        console.warn('Lỗi khi tải dữ liệu từ Supabase:', e);
        syncStatus.value = 'error';
    } finally {
        isSyncingFromChannel = false;
        isInitLoading.value = false;
    }
}

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

        // Clean tickets to minimal serializable payload
        const cleanTickets = (csvRecords.value || []).map(r => ({
            id: r.id,
            ticketNo: r.ticketNo,
            sourceTicketNo: (r as any).sourceTicketNo || '',
            plateNumber: r.plateNumber,
            customer: r.customer || '',
            weight1: r.weight1,
            weight2: r.weight2,
            weightNet: r.weightNet,
            dateInStr: r.dateInStr || '',
            timeInStr: r.timeInStr || '',
            dateOutStr: r.dateOutStr || '',
            timeOutStr: r.timeOutStr || '',
            date1Obj: (r as any).date1Obj || (r.dateInStr ? parseDateTime(r.dateInStr, r.timeInStr).toISOString() : null),
            date2Obj: (r as any).date2Obj || (r.dateOutStr ? parseDateTime(r.dateOutStr, r.timeOutStr).toISOString() : null),
            direction: r.direction || '',
            cargoType: r.cargoType || '',
            bargeName: r.bargeName || '',
            driverName: r.driverName || '',
            notes: r.notes || '',
            orderNo: r.orderNo || ''
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
        addToast('Lỗi đồng bộ dữ liệu đám mây!', 'error');
    }
}

function saveTicketsToSupabase(): Promise<void> {
    return new Promise((resolve) => {
        if (saveSupabaseTimer) clearTimeout(saveSupabaseTimer);
        
        saveSupabaseTimer = setTimeout(async () => {
            if (isSavingSupabase) {
                // If a save is currently executing, retry after 300ms
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
        }, 200);
    });
}

// Core state for sidebar
const vessels = ref<Vessel[]>([]);
const expandedVesselIds = ref<Record<number, boolean>>({});
const loading = ref(false);
const saving = ref(false);
void saving;

interface BargeSummary {
    id: number;
    name: string;
    vesselId: number;
    vesselName: string;
    tripCount: number;
    totalWeight: number;
    dateStart: string | null;
    dateEnd: string | null;
    locked: boolean;
}

const allBargesSummary = ref<BargeSummary[]>([]);
const loadingGlobalSummary = ref(false);
const globalBargeSearchQuery = ref('');
const globalFilterMonth = ref('');

// Month list from date strings
const availableGlobalMonths = computed(() => {
    const months = new Set<string>();
    allBargesSummary.value.forEach(b => {
        if (b.dateStart) {
            const m = b.dateStart.split('/')[1] || b.dateStart.split('-')[1];
            if (m) months.add(m);
        }
    });
    return Array.from(months).sort();
});

const filteredAllBarges = computed(() => {
    let list = allBargesSummary.value;
    
    if (globalBargeSearchQuery.value) {
        const q = globalBargeSearchQuery.value.toLowerCase().trim();
        list = list.filter(b => b.name.toLowerCase().includes(q) || b.vesselName.toLowerCase().includes(q));
    }
    
    if (globalFilterMonth.value) {
        list = list.filter(b => {
            if (!b.dateStart) return false;
            const m = b.dateStart.split('/')[1] || b.dateStart.split('-')[1];
            return m === globalFilterMonth.value;
        });
    }
    
    return list;
});

// Load summary of all barges based on their split history in IndexedDB
const refreshGlobalBargesSummary = async () => {
    loadingGlobalSummary.value = true;
    try {
        const summaries: BargeSummary[] = [];
        for (const vessel of vessels.value) {
            for (const barge of (vessel.barges || [])) {
                // Read allocator history for this barge
                const trips = await dbContext.get<SplitTrip[]>('allocator_history_trips_' + barge.id) || [];
                let totalWeight = 0;
                let minDate: any = null;
                let maxDate: any = null;
                
                trips.forEach(t => {
                    totalWeight += (t.weightNet || (t.weightTons * 1000) || 0);
                    // Parse date
                    const d1 = t.date1Obj ? new Date(t.date1Obj) : null;
                    if (d1 && !isNaN(d1.getTime())) {
                        if (!minDate || d1 < minDate) minDate = d1;
                        if (!maxDate || d1 > maxDate) maxDate = d1;
                    }
                });
                
                summaries.push({
                    id: barge.id,
                    name: barge.name,
                    vesselId: vessel.id,
                    vesselName: vessel.name,
                    tripCount: trips.length,
                    totalWeight,
                    dateStart: minDate ? formatDateTimeStr(minDate.toISOString()) : null,
                    dateEnd: maxDate ? formatDateTimeStr(maxDate.toISOString()) : null,
                    locked: barge.config?.locked || false
                });
            }
        }
        allBargesSummary.value = summaries;
    } catch (e) {
        console.error('Lỗi khi tải báo cáo tổng hợp sà lan:', e);
    } finally {
        loadingGlobalSummary.value = false;
    }
};

// Vessel specific summary
const vesselBargesSummary = computed(() => {
    return allBargesSummary.value.filter(b => b.vesselId === activeVesselId.value);
});

const activeVessel = computed(() => {
    return vessels.value.find(v => v.id === activeVesselId.value) || null;
});

// Load all vessels from local IndexedDB
const loadVessels = async () => {
    loading.value = true;
    try {
        let data = await dbContext.get<Vessel[]>('allocator_vessels') || [];
        
        // Nếu cơ sở dữ liệu trống, tự động tạo tàu và sà lan mặc định
        if (data.length === 0) {
            const defaultVesselId = Date.now();
            const defaultBargeId = defaultVesselId + 1;
            const defaultVessel: Vessel = {
                id: defaultVesselId,
                name: 'Tàu mặc định',
                barges: [
                    {
                        id: defaultBargeId,
                        name: 'Sà lan mặc định',
                        vesselId: defaultVesselId,
                        config: { locked: false, orderNo: '' }
                    }
                ]
            };
            data = [defaultVessel];
            await dbContext.set('allocator_vessels', data);
        }
        
        vessels.value = data;
        
        // Expand all vessels by default
        data.forEach(v => {
            if (expandedVesselIds.value[v.id] === undefined) {
                expandedVesselIds.value[v.id] = true;
            }
        });
        
        // Tự động chọn sà lan đầu tiên nếu chưa chọn sà lan nào và không ở tab quản lý danh sách xe
        if (!activeBargeId.value) {
            let firstBargeId: number | null = null;
            let firstVesselId: number | null = null;
            for (const v of data) {
                if (v.barges && v.barges.length > 0) {
                    const firstB = v.barges[0];
                    if (firstB) {
                        firstBargeId = firstB.id;
                        firstVesselId = v.id;
                        break;
                    }
                }
            }
            if (firstBargeId && firstVesselId) {
                activeBargeId.value = firstBargeId;
                activeVesselId.value = firstVesselId;
            }
        }
        
        await refreshGlobalBargesSummary();
    } catch (e) {
        addToast('Không thể tải danh sách sà lan!', 'error');
    } finally {
        loading.value = false;
    }
};

// Dialog Prompt for CRUD
interface InputDialogState {
    show: boolean;
    title: string;
    placeholder: string;
    value: string;
    okText?: string;
    cancelText?: string;
    resolve?: (val: string | null) => void;
}

const inputDialog = ref<InputDialogState>({
    show: false,
    title: '',
    placeholder: '',
    value: ''
});

const inputPromptRef = ref<HTMLInputElement | null>(null);

function showPrompt(title: string, defaultValue: string = '', placeholder: string = ''): Promise<string | null> {
    return new Promise((resolve) => {
        inputDialog.value = {
            show: true,
            title,
            placeholder,
            value: defaultValue,
            okText: 'Xác nhận',
            cancelText: 'Hủy',
            resolve
        };
        nextTick(() => {
            inputPromptRef.value?.focus();
            if (inputPromptRef.value) {
                inputPromptRef.value.select();
            }
        });
    });
}

function handleInputOk() {
    if (inputDialog.value.resolve) {
        inputDialog.value.resolve(inputDialog.value.value);
    }
    inputDialog.value.show = false;
}

function handleInputCancel() {
    if (inputDialog.value.resolve) {
        inputDialog.value.resolve(null);
    }
    inputDialog.value.show = false;
}

// CRUD Methods utilizing local IndexedDB
const addVessel = async () => {
    const name = await showPrompt('Nhập tên tàu mới:');
    if (!name || !name.trim()) return;

    loading.value = true;
    try {
        const newVessel: Vessel = {
            id: Date.now(),
            name: name.trim(),
            barges: []
        };
        vessels.value.push(newVessel);
        await dbContext.set('allocator_vessels', vessels.value);
        expandedVesselIds.value[newVessel.id] = true;
        addToast(`Đã thêm tàu: ${newVessel.name}`);
        await loadVessels();
    } catch (e) {
        addToast('Lỗi khi thêm tàu!', 'error');
    } finally {
        loading.value = false;
    }
};

const renameVessel = async (id: number, currentName: string) => {
    const name = await showPrompt('Đổi tên tàu:', currentName);
    if (!name || !name.trim() || name.trim() === currentName) return;

    loading.value = true;
    try {
        const idx = vessels.value.findIndex(v => v.id === id);
        if (idx !== -1) {
            const v = vessels.value[idx];
            if (v) {
                v.name = name.trim();
                await dbContext.set('allocator_vessels', vessels.value);
                addToast(`Đã đổi tên tàu thành: ${name}`);
                await loadVessels();
            }
        } else {
            addToast('Không tìm thấy tàu!', 'error');
        }
    } catch (e) {
        addToast('Lỗi khi đổi tên tàu!', 'error');
    } finally {
        loading.value = false;
    }
};

const deleteVessel = async (id: number, name: string) => {
    const confirm = await showConfirm({
        title: 'Xóa tàu',
        message: `Bạn có chắc chắn muốn xóa tàu "${name}" cùng toàn bộ sà lan và dữ liệu phân bổ của nó không? Hành động này không thể hoàn tác.`,
        type: 'danger',
        okText: 'Xóa tàu',
        cancelText: 'Hủy'
    });
    if (!confirm) return;

    loading.value = true;
    try {
        const vessel = vessels.value.find(v => v.id === id);
        if (vessel && vessel.barges) {
            for (const b of vessel.barges) {
                await dbContext.delete('allocator_tickets_' + b.id);
                await dbContext.delete('allocator_history_trips_' + b.id);
                await dbContext.delete('allocator_generated_trips_' + b.id);
            }
        }
        
        vessels.value = vessels.value.filter(v => v.id !== id);
        await dbContext.set('allocator_vessels', vessels.value);
        
        if (activeVesselId.value === id) {
            activeVesselId.value = null;
            activeBargeId.value = null;
        }
        addToast(`Đã xóa tàu: ${name}`, 'error');
        await loadVessels();
    } catch (e) {
        addToast('Lỗi khi xóa tàu!', 'error');
    } finally {
        loading.value = false;
    }
};

const selectVessel = async (vesselId: number) => {
    activeVesselId.value = vesselId;
    activeBargeId.value = null;
    await refreshGlobalBargesSummary();
};

const selectBarge = async (vesselId: number, bargeId: number) => {
    activeVesselId.value = vesselId;
    activeBargeId.value = bargeId;
};

const addBarge = async (vesselId: number) => {
    const name = await showPrompt('Nhập tên sà lan mới:');
    if (!name || !name.trim()) return;

    loading.value = true;
    try {
        const idx = vessels.value.findIndex(v => v.id === vesselId);
        if (idx !== -1) {
            const v = vessels.value[idx];
            if (v) {
                const newBarge: Barge = {
                    id: Date.now(),
                    name: name.trim(),
                    vesselId,
                    config: { locked: false, orderNo: '' }
                };
                if (!v.barges) v.barges = [];
                v.barges.push(newBarge);
                await dbContext.set('allocator_vessels', vessels.value);
                addToast(`Đã thêm sà lan: ${newBarge.name}`);
                await loadVessels();
                await selectBarge(vesselId, newBarge.id);
            }
        } else {
            addToast('Không tìm thấy tàu để thêm sà lan!', 'error');
        }
    } catch (e) {
        addToast('Lỗi khi thêm sà lan!', 'error');
    } finally {
        loading.value = false;
    }
};

const renameBarge = async (id: number, currentName: string) => {
    const barge = vessels.value.flatMap(v => v.barges || []).find(b => b.id === id);
    if (barge?.config?.locked) {
        addToast('Sà lan đang bị khóa! Vui lòng mở khóa để đổi tên.', 'error');
        return;
    }

    const name = await showPrompt('Đổi tên sà lan:', currentName);
    if (!name || !name.trim() || name.trim() === currentName) return;

    loading.value = true;
    try {
        let found = false;
        for (const v of vessels.value) {
            if (v.barges) {
                const bIdx = v.barges.findIndex(b => b.id === id);
                if (bIdx !== -1) {
                    const b = v.barges[bIdx];
                    if (b) {
                        b.name = name.trim();
                        found = true;
                        break;
                    }
                }
            }
        }
        if (found) {
            await dbContext.set('allocator_vessels', vessels.value);
            addToast(`Đã đổi tên sà lan thành: ${name}`);
            await loadVessels();
            if (activeBargeId.value === id && activeVesselId.value) {
                await selectBarge(activeVesselId.value, id);
            }
        } else {
            addToast('Không tìm thấy sà lan!', 'error');
        }
    } catch (e) {
        addToast('Lỗi khi đổi tên sà lan!', 'error');
    } finally {
        loading.value = false;
    }
};

const deleteBarge = async (vesselId: number, id: number, name: string) => {
    const barge = vessels.value.flatMap(v => v.barges || []).find(b => b.id === id);
    if (barge?.config?.locked) {
        addToast('Sà lan đang bị khóa! Vui lòng mở khóa để xóa.', 'error');
        return;
    }

    const confirm = await showConfirm({
        title: 'Xóa sà lan',
        message: `Bạn có chắc chắn muốn xóa sà lan "${name}" cùng toàn bộ dữ liệu phân bổ của nó không? Hành động này không thể hoàn tác.`,
        type: 'danger',
        okText: 'Xóa sà lan',
        cancelText: 'Hủy'
    });
    if (!confirm) return;

    loading.value = true;
    try {
        const vIdx = vessels.value.findIndex(v => v.id === vesselId);
        if (vIdx !== -1) {
            const v = vessels.value[vIdx];
            if (v && v.barges) {
                const bIdx = v.barges.findIndex(b => b.id === id);
                if (bIdx !== -1) {
                    v.barges.splice(bIdx, 1);
                    await dbContext.set('allocator_vessels', vessels.value);
                    
                    // Clear barge data
                    await dbContext.delete('allocator_tickets_' + id);
                    await dbContext.delete('allocator_history_trips_' + id);
                    await dbContext.delete('allocator_generated_trips_' + id);
                    
                    if (activeBargeId.value === id) {
                        activeBargeId.value = null;
                    }
                    addToast(`Đã xóa sà lan: ${name}`, 'error');
                    await loadVessels();
                }
            }
        }
    } catch (e) {
        addToast('Lỗi khi xóa sà lan!', 'error');
    } finally {
        loading.value = false;
    }
};

const allBargesList = computed(() => {
    const list: (Barge & { vesselName: string })[] = [];
    vessels.value.forEach(v => {
        if (v.barges) {
            v.barges.forEach(b => {
                list.push({
                    ...b,
                    vesselName: v.name
                });
            });
        }
    });
    return list;
});

interface AddBargeDialogState {
    show: boolean;
    bargeName: string;
    vesselId: number | null;
    newVesselName: string;
    showNewVesselInput: boolean;
}

const addBargeDialog = ref<AddBargeDialogState>({
    show: false,
    bargeName: '',
    vesselId: null,
    newVesselName: '',
    showNewVesselInput: false
});

const openAddBargeDialog = () => {
    addBargeDialog.value = {
        show: true,
        bargeName: '',
        vesselId: vessels.value[0]?.id || null,
        newVesselName: '',
        showNewVesselInput: vessels.value.length === 0
    };
};

const handleAddBargeConfirm = async () => {
    const state = addBargeDialog.value;
    if (!state.bargeName.trim()) {
        addToast('Vui lòng nhập tên sà lan!', 'error');
        return;
    }

    loading.value = true;
    try {
        let vId = state.vesselId;
        
        // Nếu người dùng chọn tạo tàu mới
        if (state.showNewVesselInput) {
            if (!state.newVesselName.trim()) {
                addToast('Vui lòng nhập tên tàu mới!', 'error');
                loading.value = false;
                return;
            }
            const newV: Vessel = {
                id: Date.now(),
                name: state.newVesselName.trim(),
                barges: []
            };
            vessels.value.push(newV);
            await dbContext.set('allocator_vessels', vessels.value);
            vId = newV.id;
        }

        if (!vId) {
            addToast('Vui lòng chọn hoặc tạo tàu chủ quản!', 'error');
            loading.value = false;
            return;
        }

        const idx = vessels.value.findIndex(v => v.id === vId);
        if (idx !== -1) {
            const v = vessels.value[idx];
            if (v) {
                const newBarge: Barge = {
                    id: Date.now(),
                    name: state.bargeName.trim(),
                    vesselId: vId,
                    config: { locked: false, orderNo: '' }
                };
                if (!v.barges) v.barges = [];
                v.barges.push(newBarge);
                await dbContext.set('allocator_vessels', vessels.value);
                addToast(`Đã thêm sà lan: ${newBarge.name}`);
                await loadVessels();
                await selectBarge(vId, newBarge.id);
                addBargeDialog.value.show = false;
            }
        }
    } catch (e) {
        addToast('Lỗi khi thêm sà lan!', 'error');
    } finally {
        loading.value = false;
    }
};

const toggleBargeLock = async () => {
    if (!activeBarge.value) return;
    const b = activeBarge.value;
    if (!b.config) {
        b.config = {};
    }
    b.config.locked = !b.config.locked;
    await dbContext.set('allocator_vessels', vessels.value);
    addToast(b.config.locked ? 'Đã khóa sà lan' : 'Đã mở khóa sà lan');
};
void toggleBargeLock;
void vesselBargesSummary;
void activeVessel;
void addVessel;
void renameVessel;
void deleteVessel;
void selectVessel;
void addBarge;
void formatNumber;
void availableGlobalMonths;
void filteredAllBarges;
void renameBarge;
void deleteBarge;
void allBargesList;
void openAddBargeDialog;

// Loaded and synchronization logic
onMounted(async () => {
    try {
        const savedLimit = await dbContext.get<number>('allocator_standard_limit');
        if (savedLimit !== undefined && savedLimit !== null) {
            standardTTTPLimit.value = savedLimit;
        }

        const savedCurbMin = await dbContext.get<number>('allocator_curb_min');
        if (savedCurbMin !== undefined && savedCurbMin !== null) {
            standardCurbMin.value = savedCurbMin;
        } else {
            standardCurbMin.value = 1.5;
        }

        const savedCurbMax = await dbContext.get<number>('allocator_curb_max');
        if (savedCurbMax !== undefined && savedCurbMax !== null) {
            standardCurbMax.value = savedCurbMax;
        } else {
            standardCurbMax.value = 3.0;
        }

        const savedDist = await dbContext.get<any>('allocator_dist_strategy');
        if (savedDist) distStrategy.value = savedDist;

        const savedSpacing = await dbContext.get<any>('allocator_spacing_strategy');
        if (savedSpacing) spacingStrategy.value = savedSpacing;

        const savedInterval = await dbContext.get<number>('allocator_time_interval');
        if (savedInterval) timeIntervalMinutes.value = savedInterval;

        const savedPrefix = await dbContext.get<string>('allocator_ticket_prefix');
        if (savedPrefix !== undefined && savedPrefix !== null) ticketPrefix.value = savedPrefix;

        const savedSuffix = await dbContext.get<string>('allocator_ticket_suffix');
        if (savedSuffix !== undefined && savedSuffix !== null) ticketSuffix.value = savedSuffix;

        const savedStart = await dbContext.get<number>('allocator_ticket_start');
        if (savedStart !== undefined && savedStart !== null) ticketStart.value = savedStart;

        const savedPadding = await dbContext.get<number>('allocator_ticket_padding');
        if (savedPadding !== undefined && savedPadding !== null) ticketPadding.value = savedPadding;

        const savedUseAuto = await dbContext.get<boolean>('allocator_use_auto_ticket');
        if (savedUseAuto !== undefined && savedUseAuto !== null) useAutoTicketNo.value = savedUseAuto;

        const savedVehicles = await dbContext.get<any[]>('allocator_vehicles');
        if (savedVehicles && Array.isArray(savedVehicles)) {
            vehiclesList.value = savedVehicles;
        }

        isInitLoading.value = true;
        try {
            let savedTickets = await dbContext.get<CSVRecord[]>('allocator_tickets') || [];
            let savedHistory = await dbContext.get<SplitTrip[]>('allocator_history_trips') || [];
            let savedGenerated = await dbContext.get<SplitTrip[]>('allocator_generated_trips') || [];

            // Tự động di cư dữ liệu từ sà lan cũ nếu toàn cục trống rỗng
            if (savedTickets.length === 0 && savedHistory.length === 0 && savedGenerated.length === 0) {
                const vesselsData = await dbContext.get<any[]>('allocator_vessels') || [];
                let migrated = false;
                for (const v of vesselsData) {
                    if (v.barges) {
                        for (const b of v.barges) {
                            const bTickets = await dbContext.get<CSVRecord[]>('allocator_tickets_' + b.id);
                            if (bTickets && bTickets.length > 0) {
                                const bHistory = await dbContext.get<SplitTrip[]>('allocator_history_trips_' + b.id) || [];
                                const bGenerated = await dbContext.get<SplitTrip[]>('allocator_generated_trips_' + b.id) || [];

                                savedTickets = bTickets;
                                savedHistory = bHistory;
                                savedGenerated = bGenerated;

                                // Lưu đè vào key toàn cục
                                await dbContext.set('allocator_tickets', savedTickets);
                                await dbContext.set('allocator_history_trips', savedHistory);
                                await dbContext.set('allocator_generated_trips', savedGenerated);

                                migrated = true;
                                break;
                            }
                        }
                    }
                    if (migrated) break;
                }
            }

            csvRecords.value = savedTickets;
            existingTrips.value = hydrateTrips(savedHistory);

            // Load latest data from Supabase in the background
            await loadTicketsFromSupabase();
        } finally {
            isInitLoading.value = false;
        }
    } catch (e) {
        console.error('Lỗi khi nạp cấu hình:', e);
    }
    
    // Xử lý chuyển hướng view con từ Trang chủ
    const redirectSubView = localStorage.getItem('home_redirect_subview');
    if (redirectSubView) {
        activeSubViewMode.value = redirectSubView as any;
        localStorage.removeItem('home_redirect_subview');
    }
});

// Tự động tải lại danh sách xe khi chuyển đổi tab con để đảm bảo cập nhật đồng bộ trong cùng một cửa sổ
watch(activeSubViewMode, async (newVal) => {
    if (newVal === 'allocator') {
        try {
            const savedVehicles = await dbContext.get<any[]>('allocator_vehicles');
            if (savedVehicles && Array.isArray(savedVehicles)) {
                vehiclesList.value = savedVehicles;
            }
        } catch (e) {
            console.error('Lỗi khi tải lại danh sách xe:', e);
        }
    }
});

// Auto-save tickets on change
watch(csvRecords, async (newVal) => {
    if (isSyncingFromChannel || isInitLoading.value) return;
    try {
        await dbContext.set('allocator_tickets', newVal);
        syncChannel.postMessage({ type: 'tickets' });
    } catch (e) {
        console.error('Lỗi khi lưu danh sách phiếu cân vào IndexedDB:', e);
    }
}, { deep: true });

// Auto-save history on change
watch(existingTrips, async (newVal) => {
    if (isSyncingFromChannel || isInitLoading.value) return;
    try {
        await dbContext.set('allocator_history_trips', newVal);
        syncChannel.postMessage({ type: 'history' });
    } catch (e) {
        console.error('Lỗi khi lưu lịch sử chuyến xe vào IndexedDB:', e);
    }
}, { deep: true });

// Auto-save generated trips on change
watch(generatedTrips, async (newVal) => {
    if (isSyncingFromChannel || isInitLoading.value) return;
    try {
        await dbContext.set('allocator_generated_trips', newVal);
    } catch (e) {
        console.error('Lỗi khi lưu danh sách phân bổ vào IndexedDB:', e);
    }
}, { deep: true });

// Get the capacity info for a vehicle (uses standard limit)
function getVehicleCapacity(plate: string): CapacityConfig {
    const norm = normalizePlate(plate);
    const fallbackTTTP = standardTTTPLimit.value;
    
    // Check cache first
    if (vehicleLimitCache.has(norm)) {
        const cached = vehicleLimitCache.get(norm)!;
        return { code: 0, tttp: cached.tttp, limit: cached.limit };
    }
    
    // Fallback default
    const limit = getRandomLimit(fallbackTTTP, plate);
    vehicleLimitCache.set(norm, { tttp: fallbackTTTP, limit });
    return { code: 0, tttp: fallbackTTTP, limit };
}

function hydrateTrips(trips: any[]): SplitTrip[] {
    return (trips || []).map(t => {
        const capacity = getVehicleCapacity(t.plateNumber);
        return {
            ...t,
            tttp: typeof t.tttp === 'number' ? t.tttp : capacity.tttp,
            limit: typeof t.limit === 'number' ? t.limit : capacity.limit,
            weightTons: typeof t.weightTons === 'number' ? t.weightTons : (Number(t.weightNet) / 1000 || 0)
        };
    });
}


// Computed: Total CSV Weight in tons
const totalCsvWeightTons = computed(() => {
    const kg = csvRecords.value.reduce((acc, r) => {
        let net = r.weightNet || 0;
        if (net <= 0 && r.weight1 && r.weight2) {
            net = Math.abs(r.weight1 - r.weight2);
        }
        return acc + net;
    }, 0);
    return kg / 1000;
});

function regenerateAllocatedTrips() {
    // No-op: Thuật toán phân bổ cũ đã được thay thế bằng đồng bộ trực tiếp Salan theo orderNo
}

// History panel states
const historySearchQuery = ref('');
const historyCurrentPage = ref(1);

const filteredHistoryTrips = computed(() => {
    let list = existingTrips.value;
    if (historySearchQuery.value.trim()) {
        const q = historySearchQuery.value.toLowerCase();
        list = list.filter(t => 
            t.plateNumber.toLowerCase().includes(q) || 
            t.ticketNo.toLowerCase().includes(q) || 
            t.cargoType.toLowerCase().includes(q)
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
    return Math.ceil(filteredHistoryTrips.value.length / itemsPerPage.value);
});

watch(historySearchQuery, () => {
    historyCurrentPage.value = 1;
});



async function editHistoryTripOrderNo(trip: SplitTrip) {
    if (authStore.role !== 'admin' && !hasDetailPermission('allocator', 'al_data_manage', 'update')) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const currentOrderNo = trip.orderNo || '';
    const newOrderNo = prompt(`Nhập Mã lệnh mới cho xe "${trip.plateNumber}" rời bến lúc ${trip.timeStr || ''}:`, currentOrderNo);
    if (newOrderNo === null) return; // Cancelled
    
    trip.orderNo = newOrderNo.trim();
    
    const idx = existingTrips.value.findIndex(t => (trip.id && t.id === trip.id) || (t.ticketNo && t.ticketNo === trip.ticketNo) || t.stt === trip.stt);
    if (idx !== -1) {
        existingTrips.value[idx] = { ...trip };
    }
    
    const ok = await AllocatorService.updateTripOrderNo({ id: trip.id, ticketNo: trip.ticketNo, stt: trip.stt }, trip.orderNo);
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
        message: `Bạn có chắc chắn muốn xóa xe "${trip.plateNumber}" rời bến lúc ${trip.timeStr || ''} khỏi Sổ theo dõi?`,
        type: 'danger',
        okText: 'Xóa',
        cancelText: 'Hủy'
    });
    if (!proceed) return;
    
    const ok = await AllocatorService.deleteTrip({ id: trip.id, ticketNo: trip.ticketNo, stt: trip.stt });
    if (ok) {
        existingTrips.value = existingTrips.value.filter(t => (trip.id ? t.id !== trip.id : true) && (!t.ticketNo || t.ticketNo !== trip.ticketNo) && t.stt !== trip.stt);
        await dbContext.set('allocator_history_trips', existingTrips.value);
        addToast('Đã xóa bản ghi khỏi Sổ theo dõi!', 'success');
    } else {
        addToast('Lỗi khi xóa bản ghi trên máy chủ!', 'error');
    }
}



// Clear all history
async function clearHistory() {
    if (authStore.role !== 'admin' && !hasDetailPermission('allocator', 'al_data_manage', 'delete')) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const confirmClearHistory = await showConfirm({
        title: 'Xóa sạch Sổ Theo Dõi',
        message: 'Bạn có chắc chắn muốn xóa toàn bộ lịch sử trong Sổ Theo Dõi không? Hành động này không thể hoàn tác!',
        type: 'danger',
        okText: 'Xóa hết lịch sử',
        cancelText: 'Hủy'
    });
    if (confirmClearHistory) {
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

// Total history cargo weight in tons
const historyTotalWeightTons = computed(() => {
    return existingTrips.value.reduce((sum, t) => sum + (typeof t.weightTons === 'number' ? t.weightTons : (Number(t.weightNet) / 1000 || 0)), 0);
});

// Export source tickets (Tab 1) as Excel
async function exportSourceTickets() {
    if (authStore.role !== 'admin' && !hasDetailPermission('allocator', 'al_export', 'read')) {
        addToast('Bạn không có quyền xuất dữ liệu Excel!', 'error');
        return;
    }
    if (filteredSourceTickets.value.length === 0) {
        addToast('Không có phiếu cân nào để xuất!', 'info');
        return;
    }
    compiling.value = true;
    try {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Phiếu cân');
        
        const headers = ['STT', 'Số phiếu', 'Mã lệnh', 'Biển số xe', 'Khách hàng', 'Cân lần 1', 'Cân lần 2', 'KL hàng (kg)', 'Loại hàng', 'Ngày vào', 'Giờ vào', 'Ngày ra', 'Giờ ra', 'Xuất/Nhập', 'Sà lan', 'Tài xế', 'Ghi chú'];
        const headerRow = sheet.getRow(1);
        headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
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
        
        // Auto-width columns
        sheet.columns.forEach((col: any) => { col.width = 18; });
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

// Lưu toàn bộ danh sách phiếu cân hiện tại ở Tab 1 vào Sổ Theo Dõi và làm sạch Tab 1
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
                timeStr: rec.timeInStr ? `${rec.timeInStr}\n${rec.dateInStr}` : (rec.dateInStr || ''),
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

        const savedItems = (insertRes.data && insertRes.data.length === tripsToSave.length)
            ? insertRes.data
            : tripsToSave;
        existingTrips.value = [...savedItems, ...existingTrips.value];
        await dbContext.set('allocator_history_trips', existingTrips.value);

        // Làm sạch danh sách phiếu cân ở Tab 1
        csvRecords.value = [];
        csvFile.value = null;
        await doExecuteSaveTicketsToSupabase();

        // Chuyển sang Tab 2 (Theo dõi)
        activeDataTab.value = 'generated';
        addToast(`Đã lưu thành công ${tripsToSave.length} phiếu cân vào Sổ Theo Dõi!`, 'success');
        await LogService.logAction('Lưu Sổ Theo Dõi', `Lưu ${tripsToSave.length} phiếu cân vào sổ theo dõi`);
    } catch (err: any) {
        console.error('Lỗi khi lưu vào Sổ Theo Dõi:', err);
        addToast('Lỗi khi lưu vào Sổ Theo Dõi: ' + (err?.message || err), 'error');
    } finally {
        isSavingToHistory.value = false;
    }
}

// Xuất file Excel cho Sổ Theo Dõi theo đúng form tiêu chuẩn của file gốc import
async function compileAndDownload() {
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
        
        const headers = ['STT', 'Số phiếu', 'Mã lệnh', 'Biển số xe', 'Khách hàng', 'Cân lần 1', 'Cân lần 2', 'KL hàng (kg)', 'Loại hàng', 'Ngày vào', 'Giờ vào', 'Ngày ra', 'Giờ ra', 'Xuất/Nhập', 'Sà lan', 'Ghi chú'];
        const headerRow = sheet.getRow(1);
        headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
        headerRow.font = { name: 'Arial', size: 10, bold: true };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 24;

        for (let i = 1; i <= headers.length; i++) {
            const cell = headerRow.getCell(i);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE2EBF5' }
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
                left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
                bottom: { style: 'medium', color: { argb: 'FF808080' } },
                right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
            };
        }
        
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
            if (!t1Str && trip.timeStr) {
                t1Str = trip.timeStr;
            }

            row.getCell(10).value = d1Str;
            row.getCell(11).value = t1Str;
            row.getCell(12).value = d2Str;
            row.getCell(13).value = t2Str;
            row.getCell(14).value = trip.direction || '';
            row.getCell(15).value = trip.bargeName || '';
            row.getCell(16).value = trip.notes || '';
            row.font = { name: 'Arial', size: 10 };
            row.height = 20;

            for (let c = 1; c <= headers.length; c++) {
                row.getCell(c).border = {
                    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                };
            }
        });
        
        sheet.columns.forEach((col: any) => { col.width = 18; });
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'SỔ_THEO_DÕI_XẾP_HÀNG_HOA.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        addToast('Đã xuất Sổ theo dõi thành công!', 'success');
        await LogService.logAction('Xuất Excel', 'Xuất Sổ theo dõi ra Excel');
    } catch (error) {
        console.error('Lỗi khi xuất Excel Sổ theo dõi:', error);
        addToast('Có lỗi xảy ra khi tạo tệp Excel!', 'error');
    } finally {
        compiling.value = false;
    }
}
</script>

<template>
    <div class="cargo-allocator-wrapper flex-1 flex flex-col min-h-0 md:h-full w-full font-display">
        <!-- Main area -->
        <div class="flex-1 flex flex-col md:flex-row md:overflow-hidden gap-4 p-2 md:p-4">
            <!-- Top Navigation (Mobile Only) -->
            <div class="flex md:hidden bg-white border border-primary/5 rounded-[20px] p-2 overflow-x-auto gap-2 shrink-0 scrollbar-none whitespace-nowrap mb-1">
                <button 
                    @click="activeSubViewMode = 'allocator'"
                    :class="['flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border', activeSubViewMode === 'allocator' ? 'bg-primary text-white border-primary shadow-soft' : 'bg-slate-50 text-gray-700 border-gray-150']"
                >
                    <span class="material-symbols-outlined text-sm">analytics</span>
                    <span>Phân bổ tải trọng</span>
                </button>
                <button 
                    @click="activeSubViewMode = 'vehicles'"
                    :class="['flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border', activeSubViewMode === 'vehicles' ? 'bg-primary text-white border-primary shadow-soft' : 'bg-slate-50 text-gray-700 border-gray-150']"
                >
                    <span class="material-symbols-outlined text-sm">local_shipping</span>
                    <span>Danh sách xe</span>
                </button>
                <button 
                    @click="activeSubViewMode = 'goods'"
                    :class="['flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border', activeSubViewMode === 'goods' ? 'bg-primary text-white border-primary shadow-soft' : 'bg-slate-50 text-gray-700 border-gray-150']"
                >
                    <span class="material-symbols-outlined text-sm">inventory_2</span>
                    <span>Danh sách hàng hóa</span>
                </button>
                <button 
                    @click="activeSubViewMode = 'other_tickets'"
                    :class="['flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border', activeSubViewMode === 'other_tickets' ? 'bg-primary text-white border-primary shadow-soft' : 'bg-slate-50 text-gray-700 border-gray-150']"
                >
                    <span class="material-symbols-outlined text-sm">history</span>
                    <span>Cân Kho & Container</span>
                </button>
            </div>

            <!-- Sidebar (left) (Desktop Only) -->
            <aside class="hidden md:flex w-72 h-full bg-white rounded-[24px] soft-shadow border border-primary/5 flex-col shrink-0 overflow-hidden no-print">
                <!-- Sidebar header -->
                <div class="p-4 border-b border-primary/5">
                    <div class="text-xs uppercase font-black tracking-widest text-primary mb-0.5">Tiện ích quản lý</div>
                    <h2 class="text-sm font-black text-[#1e293b] flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-primary text-base">balance</span>
                        Dữ Liệu Cân Hàng 🚢
                    </h2>
                </div>

                <!-- Navigation menu items -->
                <div class="flex-1 overflow-y-auto p-3 space-y-2">
                    <div 
                        @click="activeSubViewMode = 'allocator'"
                        :class="['flex items-center gap-2.5 p-3 rounded-[16px] cursor-pointer transition-all text-xs font-black border', activeSubViewMode === 'allocator' ? 'bg-primary text-white border-primary shadow-soft' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-100']"
                    >
                        <span class="material-symbols-outlined text-base">analytics</span>
                        Phân bổ tải trọng xếp hàng
                    </div>

                    <div 
                        @click="activeSubViewMode = 'vehicles'"
                        :class="['flex items-center gap-2.5 p-3 rounded-[16px] cursor-pointer transition-all text-xs font-black border', activeSubViewMode === 'vehicles' ? 'bg-primary text-white border-primary shadow-soft' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-100']"
                    >
                        <span class="material-symbols-outlined text-base">local_shipping</span>
                        Danh sách xe
                    </div>

                    <div 
                        @click="activeSubViewMode = 'goods'"
                        :class="['flex items-center gap-2.5 p-3 rounded-[16px] cursor-pointer transition-all text-xs font-black border', activeSubViewMode === 'goods' ? 'bg-primary text-white border-primary shadow-soft' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-100']"
                    >
                        <span class="material-symbols-outlined text-base">inventory_2</span>
                        Danh sách hàng hóa
                    </div>

                    <div 
                        @click="activeSubViewMode = 'other_tickets'"
                        :class="['flex items-center gap-2.5 p-3 rounded-[16px] cursor-pointer transition-all text-xs font-black border', activeSubViewMode === 'other_tickets' ? 'bg-primary text-white border-primary shadow-soft' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-100']"
                    >
                        <span class="material-symbols-outlined text-base">history</span>
                        Lịch sử cân Kho & Container
                    </div>
                </div>
            </aside>

            <main class="flex-1 min-h-0 flex flex-col md:overflow-hidden">
                <!-- Chế độ 1: Quản lý danh sách xe -->
                <div v-if="activeSubViewMode === 'vehicles'" class="w-full max-w-[1500px] mx-auto flex-1 flex flex-col min-h-0">
                    <VehicleManager />
                </div>

                <!-- Chế độ 3: Quản lý danh sách hàng hóa -->
                <div v-else-if="activeSubViewMode === 'goods'" class="w-full max-w-[1500px] mx-auto flex-1 flex flex-col min-h-0">
                    <GoodsManager />
                </div>

                <!-- Chế độ 4: Lịch sử cân Kho & Container -->
                <div v-else-if="activeSubViewMode === 'other_tickets'" class="w-full max-w-[1500px] mx-auto flex-1 flex flex-col min-h-0 md:h-full">
                    <WeighbridgeOtherManager />
                </div>

                <!-- Chế độ 2: Giao diện Phân bổ tải trọng xếp hàng (Chạy toàn cục) -->
                <div v-else class="flex flex-col gap-4 w-full max-w-[1500px] mx-auto md:overflow-hidden flex-1 min-h-0">

                    <div class="flex flex-col gap-4 w-full max-w-[1500px] mx-auto pb-4 md:pb-0 fade-in flex-1 min-h-0">
        <!-- Header Banner -->
        <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] py-3 px-4 md:px-5 soft-shadow border border-primary/5 gap-3 shrink-0">
            <div>
                <div class="text-xs uppercase font-black tracking-widest text-primary mb-0.5">Công cụ thông minh</div>
                <h1 class="text-sm md:text-base font-black text-[#1e293b] flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-primary text-base">balance</span>
                    Dữ liệu cân hàng & Sổ theo dõi phương tiện
                </h1>
                <p class="text-xs text-gray-500 mt-0.5">
                    Quản lý dữ liệu phiếu cân hàng ngày, đồng bộ trực tiếp vào sà lan và lưu trữ sổ theo dõi.
                </p>
            </div>
            <!-- Toggle settings on mobile / desktop -->
            <button 
                @click="isSettingsCollapsed = !isSettingsCollapsed"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-primary/10 text-primary hover:bg-primary/20 shrink-0 select-none cursor-pointer"
                :title="isSettingsCollapsed ? 'Mở rộng cài đặt số phiếu' : 'Thu gọn cài đặt số phiếu'"
            >
                <span class="material-symbols-outlined text-[16px]">{{ isSettingsCollapsed ? 'tune' : 'expand_less' }}</span>
                <span>{{ isSettingsCollapsed ? 'Cài đặt số phiếu' : 'Thu gọn cài đặt' }}</span>
            </button>
        </div>

        <!-- Compact Settings (Số phiếu tự động) -->
        <div v-show="!isSettingsCollapsed" class="bg-white rounded-[20px] p-3.5 soft-shadow border border-primary/5 grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0 text-left transition-all">
            <!-- Col 1: Số phiếu tự động (Phần 1) -->
            <div class="flex flex-col gap-2 pr-2 lg:pl-1">
                <h4 class="text-xs font-black text-primary flex items-center gap-1.5 select-none">
                    <span class="material-symbols-outlined text-[13px]">tag</span>
                    Số phiếu tự động
                    <span v-if="!canEditRules" class="material-symbols-outlined text-gray-400 text-xs cursor-help" title="Bạn không có quyền chỉnh sửa cài đặt này">lock</span>
                </h4>
                <div class="space-y-2">
                    <div class="flex flex-col gap-0.5">
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Tiền tố số phiếu</span>
                        <input 
                            type="text" 
                            v-model="ticketPrefix" 
                            :disabled="!canEditRules"
                            placeholder="Ví dụ: PC-"
                            class="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono disabled:bg-slate-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                    </div>
                    <div class="flex flex-col gap-0.5">
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Số phiếu bắt đầu</span>
                        <input 
                            type="number" 
                            v-model.number="ticketStart" 
                            :disabled="!canEditRules"
                            min="0"
                            class="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono disabled:bg-slate-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                    </div>
                    <div class="text-xs text-gray-400 font-semibold italic flex items-center gap-1 pt-1 select-none text-left">
                        <span class="material-symbols-outlined text-xs">visibility</span>
                        Xem trước: <span class="font-bold text-teal-600 font-mono">{{ previewTicketNo }}</span>
                    </div>
                </div>
            </div>

            <!-- Col 2: Số phiếu tự động (Phần 2) -->
            <div class="flex flex-col gap-2 h-full lg:pl-1">
                <div class="space-y-2 text-left">
                    <h4 class="text-xs font-black text-transparent select-none hidden md:block">Cấu hình định dạng</h4>
                    <div class="flex flex-col gap-0.5">
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Số chữ số (Padding)</span>
                        <input 
                            type="number" 
                            v-model.number="ticketPadding" 
                            :disabled="!canEditRules"
                            min="1" 
                            max="10"
                            class="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono disabled:bg-slate-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                    </div>
                    <div class="flex flex-col gap-0.5">
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Hậu tố số phiếu</span>
                        <input 
                            type="text" 
                            v-model="ticketSuffix" 
                            :disabled="!canEditRules"
                            placeholder="Ví dụ: /mmyy"
                            class="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono disabled:bg-slate-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                    </div>
                </div>
            </div>
        </div>

        <!-- Tabbed Data Panel -->
        <div class="bg-white rounded-[24px] p-4 md:p-5 pb-3 soft-shadow border border-primary/5 flex flex-col gap-4 animate-fade-in w-full min-h-[500px] md:min-h-0 md:flex-1 md:overflow-hidden">
            <!-- Tabs Header -->
            <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <!-- Tabs Navigation Strip -->
                <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 xl:pb-0 shrink-0">
                    <button 
                        @click="activeDataTab = 'source'"
                        :class="[
                            'px-3 py-1.5 text-xs font-black rounded-lg transition-all shrink-0',
                            activeDataTab === 'source' 
                                ? 'bg-primary/10 text-primary border border-primary/20' 
                                : 'text-gray-500 hover:bg-gray-50'
                        ]"
                    >
                        1. Phiếu cân ({{ csvRecords.length }})
                    </button>
                    <button 
                        @click="activeDataTab = 'generated'"
                        :class="[
                            'px-3 py-1.5 text-xs font-black rounded-lg transition-all shrink-0',
                            activeDataTab === 'generated' 
                                ? 'bg-primary/10 text-primary border border-primary/20' 
                                : 'text-gray-500 hover:bg-gray-50'
                        ]"
                    >
                        2. Theo dõi ({{ existingTrips.length }})
                    </button>
                </div>

                <!-- Controls, Search, and Action Buttons (Aligned Row) -->
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 xl:justify-end min-w-0">
                    <!-- Search Input container -->
                    <div class="flex-grow sm:flex-initial min-w-0 flex items-center h-7">
                        <!-- Tab 1 Search -->
                        <div v-if="activeDataTab === 'source'" class="relative w-full sm:w-[240px] h-7 flex items-center">
                            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">search</span>
                            <input 
                                type="text" 
                                v-model="sourceSearchQuery" 
                                placeholder="Tìm kiếm..." 
                                class="w-full pl-9 pr-8 h-7 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all placeholder:text-gray-400"
                            >
                            <button 
                                v-if="sourceSearchQuery" 
                                @click="sourceSearchQuery = ''" 
                                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary flex items-center"
                            >
                                <span class="material-symbols-outlined text-xs">close</span>
                            </button>
                        </div>

                        <!-- Tab 2 (Theo dõi) Search -->
                        <div v-if="activeDataTab === 'generated'" class="relative w-full sm:w-[240px] h-7 flex items-center">
                            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">search</span>
                            <input 
                                type="text" 
                                v-model="historySearchQuery" 
                                placeholder="Tìm kiếm..." 
                                class="w-full pl-9 pr-8 h-7 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all placeholder:text-gray-400"
                            >
                            <button 
                                v-if="historySearchQuery" 
                                @click="historySearchQuery = ''" 
                                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary flex items-center"
                            >
                                <span class="material-symbols-outlined text-xs">close</span>
                            </button>
                        </div>
                    </div>

                    <!-- Right Side: Action Buttons -->
                    <div class="flex items-center gap-1.5 flex-nowrap overflow-x-auto scrollbar-none w-full sm:w-auto pb-0.5 sm:pb-0">
                    <!-- Tab 1 Actions -->
                    <template v-if="activeDataTab === 'source'">
                        <div class="h-7 px-2.5 bg-teal-50 rounded-[8px] border border-teal-200 text-teal-700 flex items-center font-bold text-xs">
                            KL: {{ totalCsvWeightTons.toFixed(2) }}t
                        </div>
                        <input 
                            type="file" 
                            ref="ticketFileInput" 
                            accept=".csv,.xlsx,.xls" 
                            @change="handleTicketImport" 
                            class="hidden"
                        >
                        <button 
                            @click="triggerTicketFileInput"
                            class="h-7 px-3 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-[8px] hover:bg-primary/20 active:scale-[0.98] transition-all flex items-center gap-1.5"
                            :disabled="loadingCSV"
                        >
                            <span class="material-symbols-outlined text-[14px]">upload_file</span>
                            {{ loadingCSV ? 'Đang đọc...' : 'Import' }}
                        </button>
                        <button 
                            @click="openAddTicketDialog"
                            class="h-7 px-3 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-[8px] hover:bg-primary/20 active:scale-[0.98] transition-all flex items-center gap-1.5"
                        >
                            <span class="material-symbols-outlined text-[14px]">add</span>
                            Thêm
                        </button>
                        <button 
                            @click="clearAllTickets"
                            class="h-7 px-3 bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-[8px] hover:bg-red-100 active:scale-[0.98] transition-all flex items-center gap-1.5"
                        >
                            <span class="material-symbols-outlined text-[14px]">delete</span>
                            Xóa hết
                        </button>
                        <button 
                            @click="saveSourceTicketsToHistory"
                            :disabled="csvRecords.length === 0 || isSavingToHistory"
                            class="h-7 px-3 bg-teal-600 text-white border border-teal-600 text-xs font-bold rounded-[8px] hover:bg-teal-700 active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            title="Lưu toàn bộ phiếu cân vào Sổ Theo Dõi và làm sạch danh sách ở Tab 1"
                        >
                            <span v-if="isSavingToHistory" class="material-symbols-outlined text-[14px] animate-spin">sync</span>
                            <span v-else class="material-symbols-outlined text-[14px]">save</span>
                            {{ isSavingToHistory ? 'Đang lưu...' : 'Lưu vào Sổ Theo Dõi' }}
                        </button>
                        <button 
                            @click="exportSourceTickets"
                            :disabled="csvRecords.length === 0 || compiling"
                            class="h-7 px-3 bg-primary text-white border border-primary text-xs font-bold rounded-[8px] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <span class="material-symbols-outlined text-[14px]">download</span>
                            Xuất Excel
                        </button>
                    </template>

                    <!-- Tab 2 (Theo dõi) Actions -->
                    <template v-if="activeDataTab === 'generated'">
                        <div class="h-7 px-2.5 bg-teal-50 rounded-[8px] border border-teal-200 text-teal-700 flex items-center font-bold text-xs">
                            KL: {{ historyTotalWeightTons.toFixed(2) }}t
                        </div>
                        <button v-if="authStore.role === 'admin'"
                            @click="clearHistory"
                            :disabled="existingTrips.length === 0"
                            class="h-7 px-3 bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-[8px] hover:bg-red-100 active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <span class="material-symbols-outlined text-[14px]">delete_forever</span>
                            Xóa lịch sử
                        </button>
                        <button 
                            @click="compileAndDownload"
                            :disabled="existingTrips.length === 0 || compiling"
                            class="h-7 px-3 bg-primary text-white border border-primary text-xs font-bold rounded-[8px] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <span v-if="compiling" class="material-symbols-outlined text-[14px] animate-spin">sync</span>
                            <span v-else class="material-symbols-outlined text-[14px]">download</span>
                            {{ compiling ? 'Đang xử lý...' : 'Xuất Excel' }}
                        </button>
                    </template>
                </div>
            </div></div>
            
            <!-- Tab Content: Source Tickets -->
            <div v-if="activeDataTab === 'source'" class="flex-1 flex flex-col gap-3 min-h-0">

                <!-- Source Tickets Table -->
                <div v-if="filteredSourceTickets.length > 0" class="flex-1 min-h-[400px] md:min-h-0 overflow-y-auto overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs font-bold min-w-[1200px] whitespace-nowrap">
                        <thead>
                            <tr class="bg-gray-55 text-gray-500 border-b border-gray-100 font-bold whitespace-nowrap">
                                <th class="py-2 px-3 w-12 text-center bg-gray-55 font-bold">STT</th>
                                <th @click="toggleSourceSort('ticketNo')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Số phiếu</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ sourceSortKey === 'ticketNo' ? (sourceSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleSourceSort('orderNo')" class="py-2 px-3 text-center bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-center gap-1">
                                        <span>Mã lệnh</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ sourceSortKey === 'orderNo' ? (sourceSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleSourceSort('plateNumber')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Số xe</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ sourceSortKey === 'plateNumber' ? (sourceSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleSourceSort('cargoType')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Loại hàng</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ sourceSortKey === 'cargoType' ? (sourceSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleSourceSort('weightNet')" class="py-2 px-3 text-center bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-center gap-1">
                                        <span>Khối lượng (kg)</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ sourceSortKey === 'weightNet' ? (sourceSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleSourceSort('dateInStr')" class="py-2 px-3 text-center bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-center gap-1">
                                        <span>Thời gian vào</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ sourceSortKey === 'dateInStr' ? (sourceSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleSourceSort('dateOutStr')" class="py-2 px-3 text-center bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-center gap-1">
                                        <span>Thời gian ra</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ sourceSortKey === 'dateOutStr' ? (sourceSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleSourceSort('driverName')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Tài xế</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ sourceSortKey === 'driverName' ? (sourceSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th class="py-2 px-3 text-center w-24 bg-gray-55 font-bold select-none">Thao tác</th>
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
                                <td class="py-2 px-3 font-semibold text-gray-700 whitespace-nowrap">{{ ticket.ticketNo }}</td>
                                <td class="py-2 px-3 text-center font-semibold text-teal-600 font-mono whitespace-nowrap">{{ ticket.orderNo || '-' }}</td>
                                <td class="py-2 px-3 font-bold text-gray-900 whitespace-nowrap">{{ formatPlate(ticket.plateNumber) }}</td>
                                <td class="py-2 px-3 truncate max-w-[120px]" :title="ticket.cargoType">{{ ticket.cargoType }}</td>
                                <td class="py-2 px-3 text-center font-black text-primary whitespace-nowrap">{{ ticket.weightNet.toLocaleString() }}</td>
                                <td class="py-2 px-3 text-center text-xs text-gray-500 font-mono whitespace-nowrap">{{ ticket.timeInStr }} {{ ticket.dateInStr }}</td>
                                <td class="py-2 px-3 text-center text-xs text-gray-500 font-mono whitespace-nowrap">{{ ticket.timeOutStr }} {{ ticket.dateOutStr }}</td>
                                <td class="py-2 px-3 text-gray-500 truncate max-w-[100px]" :title="ticket.driverName">{{ ticket.driverName || '-' }}</td>
                                <td class="py-2 px-3 text-center">
                                    <div class="flex items-center justify-center gap-1.5">
                                        <button 
                                            @click="openEditTicketDialog(ticket)" 
                                            class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all active:scale-95"
                                            title="Sửa"
                                        >
                                            <span class="material-symbols-outlined text-[12px]">edit</span>
                                        </button>
                                        <button 
                                            @click="deleteTicket(ticket)" 
                                            class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95"
                                            title="Xóa"
                                        >
                                            <span class="material-symbols-outlined text-[12px]">delete</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-else class="flex-1 min-h-[400px] md:min-h-0 flex flex-col items-center justify-center p-8 text-gray-400 italic text-center gap-2">
                    <span class="material-symbols-outlined text-4xl text-gray-300">inventory_2</span>
                    <p class="text-xs font-semibold max-w-[320px] leading-relaxed">
                        {{ csvRecords.length === 0 ? 'Chưa có phiếu cân nào. Vui lòng bấm "Import" hoặc "Thêm" để bắt đầu.' : 'Không tìm thấy phiếu cân nào khớp bộ lọc!' }}
                    </p>
                </div>

                <!-- Source Pagination -->
                <div class="flex items-center justify-between gap-4 pt-3 border-t border-gray-50 text-xs font-semibold text-gray-500">
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-1">
                            Tổng: <span class="font-black text-gray-700">{{ filteredSourceTickets.length }}</span>
                        </div>
                        <span class="w-[1px] h-3 bg-gray-200"></span>
                        <div class="flex items-center gap-1.5">
                            <span>Hiển thị:</span>
                            <select 
                                v-model.number="itemsPerPage"
                                class="px-2 py-1 bg-white border border-gray-200 rounded-[8px] text-xs font-bold focus:outline-none focus:border-primary transition-all cursor-pointer shadow-sm text-gray-700"
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
                                @click="sourceCurrentPage = Math.max(1, sourceCurrentPage - 1)" 
                                :disabled="sourceCurrentPage === 1"
                                class="size-7 rounded-lg hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-700 border border-gray-100 transition-colors"
                            >
                                <span class="material-symbols-outlined text-base">chevron_left</span>
                            </button>
                            <span class="text-xs font-bold text-gray-500">
                                Trang {{ sourceCurrentPage }} / {{ sourceTotalPages }}
                            </span>
                            <button 
                                @click="sourceCurrentPage = Math.min(sourceTotalPages, sourceCurrentPage + 1)" 
                                :disabled="sourceCurrentPage === sourceTotalPages"
                                class="size-7 rounded-lg hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-700 border border-gray-100 transition-colors"
                            >
                                <span class="material-symbols-outlined text-base">chevron_right</span>
                            </button>
                        </template>
                    </div>
                </div>
            </div>

            <!-- Tab Content: Tracking / History Records -->
            <div v-if="activeDataTab === 'generated'" class="flex-1 flex flex-col gap-3 min-h-0">

                <!-- Preview Data Table -->
                <div v-if="filteredHistoryTrips.length > 0" class="flex-1 min-h-[400px] md:min-h-0 overflow-y-auto overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs font-bold min-w-[1300px] whitespace-nowrap">
                        <thead>
                            <tr class="bg-gray-55 text-gray-500 border-b border-gray-100 font-bold whitespace-nowrap">
                                <th class="py-2 px-3 w-12 text-center bg-gray-55 font-bold">STT</th>
                                <th @click="toggleHistorySort('ticketNo')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Số phiếu</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'ticketNo' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('orderNo')" class="py-2 px-3 text-center bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-center gap-1">
                                        <span>Mã lệnh</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'orderNo' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('plateNumber')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Số xe</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'plateNumber' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('customer')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Khách hàng</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'customer' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('cargoType')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Loại hàng</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'cargoType' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('weight1')" class="py-2 px-3 text-right bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-end gap-1">
                                        <span>TL1 (kg)</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'weight1' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('weight2')" class="py-2 px-3 text-right bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-end gap-1">
                                        <span>TL2 (kg)</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'weight2' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('weightNet')" class="py-2 px-3 text-right bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-end gap-1">
                                        <span>KL hàng (kg)</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'weightNet' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('date1Obj')" class="py-2 px-3 text-center bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-center gap-1">
                                        <span>Thời gian vào</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'date1Obj' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('date2Obj')" class="py-2 px-3 text-center bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-center gap-1">
                                        <span>Thời gian ra</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'date2Obj' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('bargeName')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Tên sà lan</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'bargeName' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th class="py-2 px-3 bg-gray-55 font-bold select-none">Ghi chú</th>
                                <th v-if="authStore.role === 'admin' || hasDetailPermission('allocator', 'al_data_manage', 'update') || hasDetailPermission('allocator', 'al_data_manage', 'delete')" class="py-2 px-3 text-center w-20 bg-gray-55 font-bold select-none">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 text-[#1e293b]/90">
                            <tr 
                                v-for="(trip, idx) in pagedHistoryTrips" 
                                :key="trip.id || trip.stt || idx"
                                class="hover:bg-gray-50 transition-colors"
                            >
                                <td class="py-2 px-3 text-center font-bold text-gray-400 whitespace-nowrap">
                                    {{ (historyCurrentPage - 1) * itemsPerPage + idx + 1 }}
                                </td>
                                <td class="py-2 px-3 font-semibold text-gray-700 whitespace-nowrap">{{ trip.ticketNo || '-' }}</td>
                                <td class="py-2 px-3 text-center font-semibold text-teal-600 font-mono whitespace-nowrap">{{ trip.orderNo || '-' }}</td>
                                <td class="py-2 px-3 font-bold text-gray-900 whitespace-nowrap">
                                    {{ formatPlate(trip.plateNumber) }}
                                </td>
                                <td class="py-2 px-3 truncate max-w-[140px] text-gray-600" :title="trip.customer">{{ trip.customer || '-' }}</td>
                                <td class="py-2 px-3 truncate max-w-[120px]" :title="trip.cargoType">{{ trip.cargoType || '-' }}</td>
                                <td class="py-2 px-3 text-right font-mono text-gray-700 whitespace-nowrap">{{ trip.weight1 ? trip.weight1.toLocaleString() : '-' }}</td>
                                <td class="py-2 px-3 text-right font-mono text-gray-700 whitespace-nowrap">{{ trip.weight2 ? trip.weight2.toLocaleString() : '-' }}</td>
                                <td class="py-2 px-3 text-right font-black text-primary font-mono whitespace-nowrap">{{ (trip.weightNet || (trip.weightTons ? trip.weightTons * 1000 : 0)).toLocaleString() }}</td>
                                <td class="py-2 px-3 text-center text-xs text-gray-500 font-mono whitespace-nowrap">
                                    {{ trip.date1Obj ? formatExcelDateTimeCombined(trip.date1Obj) : (trip.timeStr || '-') }}
                                </td>
                                <td class="py-2 px-3 text-center text-xs text-gray-500 font-mono whitespace-nowrap">
                                    {{ trip.date2Obj ? formatExcelDateTimeCombined(trip.date2Obj) : '-' }}
                                </td>
                                <td class="py-2 px-3 truncate max-w-[120px] text-gray-600" :title="trip.bargeName">{{ trip.bargeName || '-' }}</td>
                                <td class="py-2 px-3 truncate max-w-[140px] text-gray-400 text-xs" :title="trip.notes">{{ trip.notes || '-' }}</td>
                                <td v-if="authStore.role === 'admin' || hasDetailPermission('allocator', 'al_data_manage', 'update') || hasDetailPermission('allocator', 'al_data_manage', 'delete')" class="py-2 px-3 text-center">
                                    <div class="flex items-center justify-center gap-1.5">
                                        <button 
                                            v-if="authStore.role === 'admin' || hasDetailPermission('allocator', 'al_data_manage', 'update')"
                                            @click="editHistoryTripOrderNo(trip)"
                                            class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all active:scale-95"
                                            title="Sửa Mã lệnh"
                                        >
                                            <span class="material-symbols-outlined text-[12px]">edit</span>
                                        </button>
                                        <button 
                                            v-if="authStore.role === 'admin' || hasDetailPermission('allocator', 'al_data_manage', 'delete')"
                                            @click="deleteHistoryTrip(trip)"
                                            class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95"
                                            title="Xóa"
                                        >
                                            <span class="material-symbols-outlined text-[12px]">delete</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-else class="flex-1 min-h-[400px] md:min-h-0 flex flex-col items-center justify-center p-8 text-gray-400 italic text-center gap-2">
                    <span class="material-symbols-outlined text-4xl text-gray-300">inventory_2</span>
                    <p class="text-xs font-semibold max-w-[320px] leading-relaxed">
                        {{ existingTrips.length === 0 ? 'Sổ theo dõi chưa có dữ liệu.' : 'Không tìm thấy bản ghi nào khớp bộ lọc!' }}
                    </p>
                </div>

                <!-- Table Pagination -->
                <div class="flex items-center justify-between gap-4 pt-3 border-t border-gray-50 text-xs font-semibold text-gray-500">
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-1">
                            Tổng: <span class="font-black text-gray-700">{{ filteredHistoryTrips.length }}</span>
                        </div>
                        <span class="w-[1px] h-3 bg-gray-200"></span>
                        <div class="flex items-center gap-1.5">
                            <span>Hiển thị:</span>
                            <select 
                                v-model.number="itemsPerPage"
                                class="px-2 py-1 bg-white border border-gray-200 rounded-[8px] text-xs font-bold focus:outline-none focus:border-primary transition-all cursor-pointer shadow-sm text-gray-700"
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
                                @click="historyCurrentPage = Math.max(1, historyCurrentPage - 1)" 
                                :disabled="historyCurrentPage === 1"
                                class="size-7 rounded-lg hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-700 border border-gray-100 transition-colors"
                            >
                                <span class="material-symbols-outlined text-base">chevron_left</span>
                            </button>
                            <span class="text-xs font-bold text-gray-500">
                                Trang {{ historyCurrentPage }} / {{ historyTotalPages }}
                            </span>
                            <button 
                                @click="historyCurrentPage = Math.min(historyTotalPages, historyCurrentPage + 1)" 
                                :disabled="historyCurrentPage === historyTotalPages"
                                class="size-7 rounded-lg hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-700 border border-gray-100 transition-colors"
                            >
                                <span class="material-symbols-outlined text-base">chevron_right</span>
                            </button>
                        </template>
                    </div>
                </div>
            </div>
        </div>



        <!-- DIALOG: ADD/EDIT TICKET -->
        <Teleport to="body">
        <div v-if="showTicketDialog" class="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 animate-fade-in font-display no-print">
            <div class="bg-white rounded-[24px] soft-shadow border border-primary/5 w-full max-w-lg overflow-hidden flex flex-col animate-scale-up">
                <!-- Dialog Header -->
                <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-black text-[#1e293b] flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-primary text-base">receipt_long</span>
                            {{ editingTicket ? 'Chỉnh sửa phiếu cân' : 'Thêm phiếu cân thủ công' }}
                        </h3>
                        <p class="text-xs text-gray-400">Nhập thông tin chi tiết của xe cân thực tế</p>
                    </div>
                    <button 
                        @click="showTicketDialog = false"
                        class="size-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-all"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>
                
                <!-- Dialog Body -->
                <div class="p-5 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Plate Number -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Số đăng ký xe (Biển số) *</label>
                            <input 
                                v-model="dialogTicket.plateNumber" 
                                type="text" 
                                placeholder="Ví dụ: 61H-16907" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary uppercase"
                            >
                        </div>
                        
                        <!-- Ticket Number -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Số phiếu cân</label>
                            <input 
                                v-model="dialogTicket.ticketNo" 
                                type="text" 
                                placeholder="Tự động nếu để trống" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Weight 1 -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Khối lượng cân lần 1 (kg)</label>
                            <input 
                                v-model.number="dialogTicket.weight1" 
                                type="number" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Weight 2 -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Khối lượng cân lần 2 (kg)</label>
                            <input 
                                v-model.number="dialogTicket.weight2" 
                                type="number" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Weight Net -->
                        <div class="flex flex-col gap-1.5 col-span-2">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Khối lượng hàng thực tế (Net - kg) *</label>
                            <input 
                                v-model.number="dialogTicket.weightNet" 
                                type="number" 
                                placeholder="Khối lượng net thực tế chở" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-bold text-primary focus:outline-none focus:border-primary"
                            >
                            <span class="text-xs text-gray-400">
                                Nếu nhập Lần 1 & Lần 2, khối lượng Net sẽ tự động được tính bằng hiệu của hai lần cân khi bấm Lưu.
                            </span>
                        </div>

                        <!-- Cargo Type -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Loại hàng hóa</label>
                            <input 
                                v-model="dialogTicket.cargoType" 
                                type="text" 
                                placeholder="Ví dụ: Viên Nén Gỗ" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Driver Name -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Tên tài xế</label>
                            <input 
                                v-model="dialogTicket.driverName" 
                                type="text" 
                                placeholder="Tên tài xế..." 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Date In -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Ngày cân vào (DD/MM/YYYY)</label>
                            <input 
                                v-model="dialogTicket.dateInStr" 
                                type="text" 
                                placeholder="DD/MM/YYYY" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Time In -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Giờ cân vào (HH:mm:ss)</label>
                            <input 
                                v-model="dialogTicket.timeInStr" 
                                type="text" 
                                placeholder="HH:mm:ss" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Date Out -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Ngày cân ra (DD/MM/YYYY)</label>
                            <input 
                                v-model="dialogTicket.dateOutStr" 
                                type="text" 
                                placeholder="DD/MM/YYYY" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Time Out -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Giờ cân ra (HH:mm:ss)</label>
                            <input 
                                v-model="dialogTicket.timeOutStr" 
                                type="text" 
                                placeholder="HH:mm:ss" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Direction -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Hình thức</label>
                            <select 
                                v-model="dialogTicket.direction" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary bg-white cursor-pointer"
                            >
                                <option value="XUẤT KHẨU">XUẤT KHẨU</option>
                                <option value="NHẬP KHẨU">NHẬP KHẨU</option>
                                <option value="NỘI BỘ">NỘI BỘ</option>
                            </select>
                        </div>

                        <!-- Customer -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Khách hàng</label>
                            <input 
                                v-model="dialogTicket.customer" 
                                type="text" 
                                placeholder="Tên khách hàng..." 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Order Number (Số lệnh) -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Số lệnh xuất / nhận</label>
                            <input 
                                v-model="dialogTicket.orderNo" 
                                type="text" 
                                placeholder="Ví dụ: L12345..." 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Notes -->
                        <div class="flex flex-col gap-1.5 col-span-2">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Ghi chú</label>
                            <textarea 
                                v-model="dialogTicket.notes" 
                                rows="2"
                                placeholder="Ghi chú thêm..." 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary resize-none"
                            ></textarea>
                        </div>
                    </div>
                </div>
                
                <!-- Dialog Footer -->
                <div class="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                    <button 
                        @click="showTicketDialog = false"
                        class="px-4 py-2 border border-gray-200 rounded-[12px] text-xs font-bold text-[#1e293b] hover:bg-gray-100 active:scale-[0.98] transition-all"
                    >
                        Hủy
                    </button>
                    <button 
                        @click="saveTicket"
                        class="px-4 py-2 bg-primary text-white rounded-[12px] text-xs font-bold hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        Lưu phiếu cân
                    </button>
                </div>
            </div>
        </div>
        </Teleport>

                    </div> <!-- Đóng div cũ của Allocator -->
                </div> <!-- Đóng Barge Detail Workspace div -->
            </main> <!-- Đóng Workspace (right) -->
        </div> <!-- Đóng Main area (flex-1 flex overflow-hidden) -->

        <!-- Advanced Add Barge Dialog -->
        <Teleport to="body">
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div 
                v-if="addBargeDialog.show" 
                class="fixed inset-0 z-[999] flex items-center justify-center bg-[#1e293b]/40 backdrop-blur-sm p-4"
                @click.self="addBargeDialog.show = false"
            >
                <div 
                    class="w-full max-w-[420px] bg-white rounded-[24px] border border-gray-100 shadow-2xl p-6 flex flex-col gap-4 transform transition-all scale-100 animate-scale-up text-xs"
                >
                    <h3 class="text-sm font-black text-gray-900 leading-tight">
                        Thêm sà lan phân bổ mới
                    </h3>
                    
                    <!-- Barge Name Input -->
                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Tên sà lan mới</label>
                        <input 
                            v-model="addBargeDialog.bargeName"
                            type="text"
                            placeholder="Ví dụ: SG 9988, HP 1022..."
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-bold focus:outline-none focus:border-primary transition-all"
                        />
                    </div>

                    <!-- Vessel Selection -->
                    <div class="flex flex-col gap-1.5">
                        <div class="flex items-center justify-between">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Tàu chủ quản</label>
                            <button 
                                @click="addBargeDialog.showNewVesselInput = !addBargeDialog.showNewVesselInput"
                                class="text-xs font-bold text-primary hover:underline"
                            >
                                {{ addBargeDialog.showNewVesselInput ? 'Chọn tàu có sẵn' : '+ Tạo tàu mới' }}
                            </button>
                        </div>
                        
                        <!-- Select existing vessel -->
                        <select 
                            v-if="!addBargeDialog.showNewVesselInput"
                            v-model="addBargeDialog.vesselId"
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-bold focus:outline-none focus:border-primary transition-all cursor-pointer"
                        >
                            <option v-for="v in vessels" :key="v.id" :value="v.id">
                                {{ v.name }}
                            </option>
                        </select>

                        <!-- Input new vessel name -->
                        <input 
                            v-else
                            v-model="addBargeDialog.newVesselName"
                            type="text"
                            placeholder="Nhập tên tàu mới..."
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-bold focus:outline-none focus:border-primary transition-all"
                        />
                    </div>
                    
                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-50">
                        <button 
                            @click="addBargeDialog.show = false"
                            class="h-9 px-4 rounded-[12px] text-xs font-bold text-gray-500 hover:bg-gray-50 active:scale-95 transition-all border border-gray-100"
                        >
                            Hủy
                        </button>
                        <button 
                            @click="handleAddBargeConfirm"
                            class="h-9 px-5 rounded-[12px] text-xs font-bold text-white bg-primary hover:bg-primary/95 active:scale-95 transition-all"
                        >
                            Thêm sà lan
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
        </Teleport>

        <!-- Custom Prompt Input Dialog -->
        <Teleport to="body">
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div 
                v-if="inputDialog.show" 
                class="fixed inset-0 z-[999] flex items-center justify-center bg-[#1e293b]/40 backdrop-blur-sm p-4"
                @click.self="handleInputCancel"
            >
                <div 
                    class="w-full max-w-[420px] bg-white rounded-[24px] border border-gray-100 shadow-2xl p-6 flex flex-col gap-4 transform transition-all scale-100 animate-scale-up"
                >
                    <h3 class="text-sm font-black text-gray-900 leading-tight">
                        {{ inputDialog.title }}
                    </h3>
                    
                    <div class="relative">
                        <input 
                            ref="inputPromptRef"
                            v-model="inputDialog.value"
                            type="text"
                            :placeholder="inputDialog.placeholder"
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-bold focus:outline-none focus:border-primary transition-all"
                            @keyup.enter="handleInputOk"
                        />
                    </div>
                    
                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-50">
                        <button 
                            @click="handleInputCancel"
                            class="h-9 px-4 rounded-[12px] text-xs font-bold text-gray-500 hover:bg-gray-50 active:scale-95 transition-all border border-gray-100"
                        >
                            {{ inputDialog.cancelText }}
                        </button>
                        <button 
                            @click="handleInputOk"
                            class="h-9 px-5 rounded-[12px] text-xs font-bold text-white bg-primary hover:bg-primary/95 active:scale-95 transition-all"
                        >
                            {{ inputDialog.okText }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
        </Teleport>

        <!-- Premium Custom Confirm Modal -->
        <Teleport to="body">
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div 
                v-if="confirmDialog.show" 
                class="fixed inset-0 z-[999] flex items-center justify-center bg-[#1e293b]/40 backdrop-blur-sm p-4"
                @click.self="handleConfirmCancel"
            >
                <div 
                    class="w-full max-w-[480px] bg-white rounded-[24px] border border-gray-100 shadow-2xl p-6 flex flex-col gap-4 transform transition-all scale-100 animate-scale-up"
                >
                    <!-- Header -->
                    <div class="flex items-center gap-3">
                        <div 
                            class="size-10 rounded-full flex items-center justify-center"
                            :class="[
                                confirmDialog.type === 'danger' ? 'bg-red-50 text-red-600' :
                                confirmDialog.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                                confirmDialog.type === 'success' ? 'bg-teal-50 text-teal-600' :
                                'bg-primary/10 text-primary'
                            ]"
                        >
                            <span class="material-symbols-outlined text-xl">
                                {{ 
                                    confirmDialog.type === 'danger' ? 'error' :
                                    confirmDialog.type === 'warning' ? 'warning' :
                                    confirmDialog.type === 'success' ? 'check_circle' :
                                    'info'
                                }}
                            </span>
                        </div>
                        <h3 class="text-sm font-black text-gray-900 leading-tight">
                            {{ confirmDialog.title }}
                        </h3>
                    </div>
                    
                    <!-- Message Content -->
                    <div class="text-xs font-semibold text-gray-700 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto pr-1">
                        {{ confirmDialog.message }}
                    </div>
                    
                    <!-- Footer Buttons -->
                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-50">
                        <button 
                            @click="handleConfirmCancel"
                            class="h-9 px-4 rounded-[12px] text-xs font-bold text-gray-500 hover:bg-gray-50 active:scale-95 transition-all border border-gray-100"
                        >
                            {{ confirmDialog.cancelText }}
                        </button>
                        <button 
                            @click="handleConfirmOk"
                            class="h-9 px-4 rounded-[12px] text-xs font-bold text-white active:scale-95 transition-all"
                            :class="[
                                confirmDialog.type === 'danger' ? 'bg-red-600 hover:bg-red-700' :
                                confirmDialog.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                                confirmDialog.type === 'success' ? 'bg-teal-600 hover:bg-teal-700' :
                                'bg-primary hover:bg-primary/95'
                            ]"
                        >
                            {{ confirmDialog.okText }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.fade-in {
    animation: fadeIn 0.2s ease-out forwards;
}

.animate-scale-up {
    animation: scaleUp 0.2s ease-out forwards;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(3px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes scaleUp {
    from {
        transform: scale(0.95);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}
</style>

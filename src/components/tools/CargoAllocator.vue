<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useToast } from '@/composables/useToast';
import { dbContext } from '@/services/storage/DBContext';
import { supabase } from '@/supabase';
import { authStore, canCreate, canUpdate, canDelete } from '@/stores/auth';
import VehicleManager from '@/components/tools/VehicleManager.vue';
import GoodsManager from '@/components/tools/GoodsManager.vue';
import { LogService } from '@/services/storage/LogService';

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
const activeSubViewMode = ref<'allocator' | 'vehicles' | 'goods'>('allocator');

const formatDateTimeStr = (isoString: string): string => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
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

// vehicleLimitCache is maintained locally

// vehicleLimitCache is maintained locally

// Algorithmic parameters
const distStrategy = ref<'even' | 'max' | 'random'>('random');
const spacingStrategy = ref<'even' | 'forward' | 'backward'>('even');

// Bounded random split algorithm
function splitWeightRandomly(weightTons: number, numTrips: number, tripLimit: number, rand: () => number): number[] {
    const weights: number[] = [];
    let remaining = weightTons;
    
    // We want each trip to be between minWeight and maxWeight (tripLimit)
    const maxWeight = tripLimit;
    const average = weightTons / numTrips;
    
    // Determine a dynamic reasonable minimum weight.
    let minWeight = Math.max(2.0, Math.min(average * 0.75, maxWeight * 0.5));
    if (minWeight > maxWeight) {
        minWeight = maxWeight * 0.5;
    }
    
    for (let i = 0; i < numTrips - 1; i++) {
        const remTrips = numTrips - 1 - i;
        
        // Mathematical limits to guarantee later trips can also be within limits:
        let lowerBound = Math.max(minWeight, remaining - remTrips * maxWeight);
        let upperBound = Math.min(maxWeight, remaining - remTrips * minWeight);
        
        if (lowerBound > upperBound) {
            const temp = lowerBound;
            lowerBound = upperBound;
            upperBound = temp;
        }
        
        let weight = average;
        if (upperBound >= lowerBound) {
            // Triangular distribution (sum of 2 randoms) to favor center/average values
            const r = (rand() + rand()) / 2;
            weight = lowerBound + r * (upperBound - lowerBound);
        }
        
        const roundedWeight = Math.round(weight * 100) / 100;
        weights.push(roundedWeight);
        remaining = Math.round((remaining - roundedWeight) * 100) / 100;
    }
    
    // Last trip gets the exact remaining weight
    weights.push(Math.round(remaining * 100) / 100);
    return weights;
}
const timeIntervalMinutes = ref(90);

const ticketPrefix = ref('');
const ticketSuffix = ref('/mmyy');
const ticketStart = ref(1);
const ticketPadding = ref(6);
const useAutoTicketNo = ref(true);

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
const currentPage = ref(1);
const itemsPerPage = ref(20);
watch(itemsPerPage, () => {
    sourceCurrentPage.value = 1;
    currentPage.value = 1;
    historyCurrentPage.value = 1;
});

// Search filter for preview
const searchQuery = ref('');

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

// Convert DD/MM/YYYY and HH:mm:ss strings to Date object
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
        
        let day = parseInt(dParts[0] || '0', 10);
        let month = parseInt(dParts[1] || '0', 10) - 1; // 0-indexed
        let year = parseInt(dParts[2] || '0', 10);
        
        if (year < 100) {
            year += 2000;
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
        
        return new Date(year, month, day, hour, minute, second);
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

// Format Date object to "HH:mm:ss\nDD/MM/YYYY"
function formatExcelDateTime(date: any): string {
    const d = ensureDate(date);
    const pad = (n: number) => String(n).padStart(2, '0');
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    const DD = pad(d.getDate());
    const MM = pad(d.getMonth() + 1);
    const YYYY = d.getFullYear();
    return `${hh}:${mm}:${ss}\n${DD}/${MM}/${YYYY}`;
}

function formatExcelDate(date: any): string {
    const d = ensureDate(date);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function formatExcelTime(date: any): string {
    const d = ensureDate(date);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getHours()}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
            addToast(`Import CSV: ${added} mới, ${updated} cập nhật, ${skipped} bỏ qua (trùng)`, 'success');
            await LogService.logAction('Import CSV', `Import CSV: ${added} mới, ${updated} cập nhật`);
            await saveTicketsToSupabase();
        } catch (error) {
            console.error(error);
            addToast('Lỗi khi đọc file CSV!', 'error');
        } finally {
            loadingCSV.value = false;
        }
    } else if (ext === 'xlsx') {
        await handleTicketExcelUpload(file, importOrderNo.value);
    } else {
        addToast('Định dạng tệp không được hỗ trợ (chỉ hỗ trợ .csv, .xlsx)', 'error');
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
    if (authStore.role !== 'admin' && ((isNew && !canCreate()) || (!isNew && !canUpdate()))) {
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
    saveTicketsToSupabase();
}

async function deleteTicket(ticket: CSVRecord) {
    if (authStore.role !== 'admin' && !canDelete()) {
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
        saveTicketsToSupabase();
    }
}

// Clear all tickets
async function clearAllTickets() {
    if (authStore.role !== 'admin' && !canDelete()) {
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
        csvFile.value = null;
        addToast('Đã xóa sạch danh sách phiếu cân!', 'info');
        await LogService.logAction('Xóa tất cả phiếu cân', 'Xóa toàn bộ danh sách phiếu cân');
        saveTicketsToSupabase();
    }
}

// Tabs and filters for Source tickets
const activeDataTab = ref<'source' | 'generated' | 'template'>('source');
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

// Sorting states for Tab 2 (Generated/Template)
const templateSortKey = ref<string>('');
const templateSortDesc = ref<boolean>(false);

function toggleTemplateSort(key: string) {
    if (templateSortKey.value === key) {
        templateSortDesc.value = !templateSortDesc.value;
    } else {
        templateSortKey.value = key;
        templateSortDesc.value = false;
    }
    currentPage.value = 1;
}

// Sorting states for Tab 3 (History/Tracking)
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

            // 2. Overwrite history trips
            const remoteHistory = data.settings.allocator_history_trips;
            if (Array.isArray(remoteHistory)) {
                if (JSON.stringify(existingTrips.value) !== JSON.stringify(remoteHistory)) {
                    existingTrips.value = remoteHistory;
                    await dbContext.set('allocator_history_trips', remoteHistory);
                }
            } else {
                if (existingTrips.value.length > 0) {
                    existingTrips.value = [];
                    await dbContext.set('allocator_history_trips', []);
                }
            }

            // 3. Overwrite vehicles list
            const remoteVehicles = data.settings.allocator_vehicles;
            if (Array.isArray(remoteVehicles)) {
                if (JSON.stringify(vehiclesList.value) !== JSON.stringify(remoteVehicles)) {
                    vehiclesList.value = remoteVehicles;
                    await dbContext.set('allocator_vehicles', remoteVehicles);
                }
            }

            // 4. Overwrite generated trips
            const remoteGenerated = data.settings.allocator_generated_trips;
            if (Array.isArray(remoteGenerated)) {
                if (JSON.stringify(generatedTrips.value) !== JSON.stringify(remoteGenerated)) {
                    generatedTrips.value = remoteGenerated;
                    await dbContext.set('allocator_generated_trips', remoteGenerated);
                }
            } else {
                regenerateAllocatedTrips();
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

async function saveTicketsToSupabase() {
    syncStatus.value = 'saving';
    try {
        const { data: current, error: fetchError } = await supabase
            .from('content')
            .select('settings')
            .eq('id', 'main')
            .single();
        
        if (fetchError) throw fetchError;
        
        const currentSettings = current?.settings || {};
        const updatedSettings = {
            ...currentSettings,
            allocator_tickets: csvRecords.value,
            allocator_history_trips: existingTrips.value,
            allocator_generated_trips: generatedTrips.value
        };

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
            existingTrips.value = savedHistory;
            generatedTrips.value = savedGenerated;

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

// Computed: Total CSV Weight in tons
const totalCsvWeightTons = computed(() => {
    const kg = csvRecords.value.reduce((acc, r) => acc + r.weightNet, 0);
    return kg / 1000;
});

function regenerateAllocatedTrips() {
    if (isSavingToHistory.value || isInitLoading.value) return;
    
    if (filteredSourceTickets.value.length === 0) {
        generatedTrips.value = [];
        return;
    }
    
    interface TempTrip {
        plateNumber: string;
        tttp: number;
        limit: number;
        ticketNo: string;
        cargoType: string;
        weightTons: number;
        notes: string;
        isNew?: boolean;
        dateObj: Date;
        // New columns to match "Ánh phân bổ bằng tay.csv"
        customer: string;
        weight1: number;
        weight2: number;
        weightNet: number;
        durationMs: number;
        direction: string;
        bargeName: string;
        orderNo?: string;
    }
    
    const tempTrips: TempTrip[] = [];
    
    filteredSourceTickets.value.forEach(record => {
        const capacity = getVehicleCapacity(record.plateNumber);
        const weightTons = record.weightNet / 1000;
        
        // Calculate trips count
        const tripLimit = capacity.limit;
        const numTrips = Math.ceil(weightTons / tripLimit);
        
        // Seed based on ticket number or ticket properties for deterministic generation
        const seed = record.ticketNo || `${record.plateNumber}_${record.weightNet}_${record.timeInStr}`;
        const rand = createSeededRandom(seed);
        
        // Weight split strategy
        let weights: number[] = [];
        if (distStrategy.value === 'random') {
            weights = splitWeightRandomly(weightTons, numTrips, tripLimit, rand);
        } else if (distStrategy.value === 'even') {
            const baseWeight = Math.round((weightTons / numTrips) * 100) / 100;
            let sum = 0;
            for (let j = 0; j < numTrips - 1; j++) {
                weights.push(baseWeight);
                sum += baseWeight;
            }
            // Adjust last trip weight to match exactly
            const lastWeight = Math.round((weightTons - sum) * 100) / 100;
            weights.push(lastWeight);
        } else {
            // Max Capacity strategy
            let remaining = weightTons;
            for (let j = 0; j < numTrips - 1; j++) {
                weights.push(tripLimit);
                remaining -= tripLimit;
            }
            weights.push(Math.round(remaining * 100) / 100);
        }
        
        // Spacing Dates/Times
        const dateIn = parseDateTime(record.dateInStr, record.timeInStr);
        const dateOut = parseDateTime(record.dateOutStr, record.timeOutStr);
        const durationMs = dateOut.getTime() - dateIn.getTime();
        
        for (let j = 0; j < numTrips; j++) {
            let tripTime = new Date();
            
            if (spacingStrategy.value === 'forward') {
                // Step forward from In time
                tripTime = new Date(dateIn.getTime() + (j + 1) * timeIntervalMinutes.value * 60 * 1000);
            } else if (spacingStrategy.value === 'backward') {
                // Step backward from Out time
                tripTime = new Date(dateOut.getTime() - (numTrips - 1 - j) * timeIntervalMinutes.value * 60 * 1000);
            } else {
                // even spacing placeholder (will be recalculated across shift)
                tripTime = dateOut;
            }
            
            // Add a small deterministic seeded jitter (+/- 10 minutes) to tripTime to make it look more natural
            const jitterMs = (rand() * 20 - 10) * 60 * 1000;
            tripTime = new Date(tripTime.getTime() + jitterMs);
            
            const tripWeightTons = weights[j] || 0;
            const tripWeightNet = Math.round(tripWeightTons * 1000);
            
            // Xác xe (tare weight) được tính bằng Trọng tải cho phép (TTTP) - Hạn mức hàng (tính theo kg)
            // Đảm bảo xác xe luôn dao động trong khoảng tiêu chuẩn từ 1.5t - 2.5t (1,500 - 2,500 kg)
            // Thêm jitter ngẫu nhiên ±150kg để số cân không bao giờ tròn chẵn (sử dụng seeded random)
            const baseTare = (capacity.tttp - capacity.limit) * 1000;
            const tareJitter = Math.round((rand() * 300 - 150) + (rand() * 10 - 5));
            const tareWeight = Math.round(baseTare + tareJitter);
            
            // Phân bổ cân lần 1 và lần 2 dựa trên hướng Xuất/Nhập
            const isXuat = record.direction.toUpperCase().includes('XUẤT') || record.direction.toUpperCase().includes('XUAT');
            let tripWeight1 = 0;
            let tripWeight2 = 0;
            
            if (isXuat) {
                // Xuất: Lần 1 có hàng (Gross), Lần 2 xác xe (Tare)
                tripWeight1 = tareWeight + tripWeightNet;
                tripWeight2 = tareWeight;
            } else {
                // Nhập: Lần 1 xác xe (Tare), Lần 2 có hàng (Gross)
                tripWeight1 = tareWeight;
                tripWeight2 = tareWeight + tripWeightNet;
            }
            
            tempTrips.push({
                plateNumber: record.plateNumber,
                tttp: capacity.tttp,
                limit: capacity.limit,
                ticketNo: j === 0 ? record.ticketNo : '', // Only keep ticketNo for the first trip
                cargoType: record.cargoType, // Keep full original cargo type
                weightTons: tripWeightTons,
                notes: '',
                isNew: true,
                dateObj: tripTime,
                customer: record.customer,
                weight1: tripWeight1,
                weight2: tripWeight2,
                weightNet: tripWeightNet,
                durationMs: durationMs,
                direction: record.direction,
                bargeName: record.bargeName,
                orderNo: record.orderNo || ''
            });
        }
    });
    
    // Sort all trips chronologically by dateObj
    // If spacing strategy is 'even', distribute all trips evenly across the entire shift range
    if (spacingStrategy.value === 'even' && tempTrips.length > 0) {
        let shiftStart = new Date();
        let shiftEnd = new Date();
        let hasDates = false;
        
        filteredSourceTickets.value.forEach(r => {
            if (r.dateOutStr && r.timeOutStr) {
                const d = parseDateTime(r.dateOutStr, r.timeOutStr);
                if (!hasDates) {
                    shiftStart = d;
                    shiftEnd = d;
                    hasDates = true;
                } else {
                    if (d < shiftStart) shiftStart = d;
                    if (d > shiftEnd) shiftEnd = d;
                }
            }
        });
        
        if (hasDates) {
            const N = tempTrips.length;
            const shiftDuration = shiftEnd.getTime() - shiftStart.getTime();
            tempTrips.forEach((t, idx) => {
                let tripTime = new Date();
                if (N === 1) {
                    tripTime = shiftEnd;
                } else {
                    const fraction = idx / (N - 1);
                    tripTime = new Date(shiftStart.getTime() + fraction * shiftDuration);
                }
                
                // Add a small deterministic seeded jitter (+/- 10 minutes) to tripTime to make it look more natural
                const seed = t.ticketNo || `${t.plateNumber}_${t.weightNet}_${idx}`;
                const rand = createSeededRandom(seed);
                const jitterMs = (rand() * 20 - 10) * 60 * 1000;
                t.dateObj = new Date(tripTime.getTime() + jitterMs);
            });
        }
    }

    // Sort all trips chronologically by dateObj
    tempTrips.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    
    // Extract chronological Date objects and time strings before interleaving to re-apply them in order later
    const sortedDates = tempTrips.map(t => t.dateObj);
    const sortedTimeStrings = sortedDates.map(d => formatExcelDateTime(d));
    
    // Resolve consecutive duplicates of plate numbers using our multi-pass resolver
    const n = tempTrips.length;
    let swapped = true;
    let iterations = 0;
    while (swapped && iterations < 10) {
        swapped = false;
        for (let i = 0; i < n - 1; i++) {
            const currentTrip = tempTrips[i];
            const nextTrip = tempTrips[i + 1];
            if (!currentTrip || !nextTrip) continue;
            
            if (currentTrip.plateNumber === nextTrip.plateNumber) {
                let swapIdx = -1;
                // Search forward first
                for (let k = i + 2; k < n; k++) {
                    const candidate = tempTrips[k];
                    if (!candidate) continue;
                    
                    const nextCandidate = tempTrips[k + 1];
                    const isDifferent = candidate.plateNumber !== currentTrip.plateNumber;
                    const isNextDifferent = !nextCandidate || nextCandidate.plateNumber !== nextTrip.plateNumber;
                    
                    if (isDifferent && (k === n - 1 || isNextDifferent)) {
                        swapIdx = k;
                        break;
                    }
                }
                // If forward fails, search backward
                if (swapIdx === -1) {
                    for (let k = i - 1; k >= 0; k--) {
                        const candidate = tempTrips[k];
                        if (!candidate) continue;
                        
                        const prevCandidate = k > 0 ? tempTrips[k - 1] : null;
                        const isDifferent = candidate.plateNumber !== currentTrip.plateNumber && candidate.plateNumber !== nextTrip.plateNumber;
                        const isPrevDifferent = !prevCandidate || prevCandidate.plateNumber !== nextTrip.plateNumber;
                        
                        if (isDifferent && (k === 0 || isPrevDifferent)) {
                            swapIdx = k;
                            break;
                        }
                    }
                }
                
                if (swapIdx !== -1) {
                    const candidateTrip = tempTrips[swapIdx];
                    if (candidateTrip) {
                        tempTrips[i + 1] = candidateTrip;
                        tempTrips[swapIdx] = nextTrip;
                        swapped = true;
                    }
                }
            }
        }
        iterations++;
    }
    
    // Re-apply sorted times and STTs sequentially so everything looks chronological in output
    const startSTT = nextSTT.value;
    const finalTrips: SplitTrip[] = tempTrips.map((t, idx) => {
        const { dateObj, durationMs, ...rest } = t;
        const tripDate2 = sortedDates[idx] || dateObj;
        
        let finalDuration = durationMs;
        if (finalDuration < 5 * 60 * 1000) {
            // Generate a seeded random duration between 8 and 15 minutes
            const seed = t.ticketNo || `${t.plateNumber}_${t.weightNet}_${idx}_dur`;
            const rand = createSeededRandom(seed);
            const mins = Math.floor(rand() * 8) + 8; // 8 to 15 minutes
            const secs = Math.floor(rand() * 60);
            finalDuration = (mins * 60 + secs) * 1000;
        }
        
        const tripDate1 = new Date(tripDate2.getTime() - finalDuration);
        
        let finalTicketNo = t.ticketNo;
        if (useAutoTicketNo.value) {
            const ticketNumVal = ticketStart.value + idx;
            const paddedNum = String(ticketNumVal).padStart(ticketPadding.value, '0');
            const dateObj = tripDate2 || new Date();
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
            
            finalTicketNo = ticketPrefix.value + paddedNum + suffixPattern;
        }
        
        return {
            ...rest,
            ticketNo: finalTicketNo,
            stt: startSTT + idx,
            timeStr: sortedTimeStrings[idx] || '',
            date1Obj: tripDate1,
            date2Obj: tripDate2
        };
    });
    
    generatedTrips.value = finalTrips;
}

// Watch dependencies to automatically regenerate
watch(
    [
        csvRecords, 
        distStrategy, 
        spacingStrategy, 
        timeIntervalMinutes, 
        standardTTTPLimit, 
        useAutoTicketNo, 
        ticketStart, 
        ticketPadding, 
        ticketPrefix, 
        ticketSuffix
    ], 
    () => {
        regenerateAllocatedTrips();
    }, 
    { deep: true }
);

// Computed: Next STT start number
const nextSTT = computed(() => {
    if (existingTrips.value.length > 0) {
        const lastTrip = existingTrips.value[existingTrips.value.length - 1];
        return (lastTrip?.stt || 0) + 1;
    }
    return 1;
});

const selectedCustomer = ref('');

const uniqueCustomers = computed(() => {
    const customers = generatedTrips.value
        .map(t => t.customer)
        .filter((c): c is string => typeof c === 'string' && c.trim() !== '');
    return Array.from(new Set(customers)).sort();
});

watch(selectedCustomer, () => {
    currentPage.value = 1;
});

watch(generatedTrips, () => {
    if (selectedCustomer.value && !uniqueCustomers.value.includes(selectedCustomer.value)) {
        selectedCustomer.value = '';
    }
});

// Computed: Filtered trips for preview search
const filteredTrips = computed(() => {
    let list = generatedTrips.value;
    
    // Filter by customer dropdown
    if (selectedCustomer.value) {
        list = list.filter(t => t.customer === selectedCustomer.value);
    }
    
    // Filter by search query text
    if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        list = list.filter(t => 
            t.plateNumber.toLowerCase().includes(q) || 
            t.ticketNo.toLowerCase().includes(q) || 
            t.cargoType.toLowerCase().includes(q) ||
            (t.customer && t.customer.toLowerCase().includes(q))
        );
    }
    
    if (templateSortKey.value) {
        list = [...list].sort((a, b) => compareValues(a, b, templateSortKey.value, templateSortDesc.value));
    }
    
    return list;
});

// Computed: Total split weight tons
const totalSplitWeightTons = computed(() => {
    return generatedTrips.value.reduce((acc, t) => acc + t.weightTons, 0);
});

// Computed: Check if current generated trips are already saved to history
const isAlreadySaved = computed(() => {
    if (generatedTrips.value.length === 0) return false;
    return generatedTrips.value.every(gt => {
        return existingTrips.value.some(et => {
            // Nếu dùng số phiếu tự động, ta kiểm tra thêm biển số, trọng lượng và ngày giờ để tránh trùng lặp giả do số phiếu bị lặp
            if (useAutoTicketNo.value) {
                const gtDateStr = formatExcelDateTimeCombined(gt.date1Obj);
                const etDateStr = formatExcelDateTimeCombined(et.date1Obj);
                return normalizePlate(gt.plateNumber) === normalizePlate(et.plateNumber) &&
                       gt.weightNet === et.weightNet &&
                       gtDateStr === etDateStr;
            }
            
            if (gt.ticketNo && et.ticketNo && gt.ticketNo === et.ticketNo) {
                return true;
            }
            const gtDateStr = formatExcelDateTimeCombined(gt.date1Obj);
            const etDateStr = formatExcelDateTimeCombined(et.date1Obj);
            return normalizePlate(gt.plateNumber) === normalizePlate(et.plateNumber) &&
                   gt.weightNet === et.weightNet &&
                   gtDateStr === etDateStr;
        });
    });
});

// Paged trips
const pagedTrips = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    return filteredTrips.value.slice(start, start + itemsPerPage.value);
});

// Total pages
const totalPages = computed(() => {
    return Math.ceil(filteredTrips.value.length / itemsPerPage.value);
});

// Reset pagination when search changes
watch(searchQuery, () => {
    currentPage.value = 1;
});

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

function getTripsWithoutMooc(): SplitTrip[] {
    return generatedTrips.value.filter(gt => {
        return !formatPlate(gt.plateNumber).includes('/');
    });
}

async function triggerManualSyncToPrinter() {
    try {
        const savedVehicles = await dbContext.get<any[]>('allocator_vehicles');
        if (savedVehicles && Array.isArray(savedVehicles)) {
            vehiclesList.value = savedVehicles;
        }
    } catch (e) {
        console.error('Lỗi khi tải lại danh sách xe trước khi đồng bộ:', e);
    }

    if (generatedTrips.value.length === 0) {
        addToast('Không có dữ liệu phân bổ để đồng bộ!', 'info');
        return;
    }
    
    const missingMoocTrips = getTripsWithoutMooc();
    if (missingMoocTrips.length > 0) {
        const plates = missingMoocTrips.map(t => formatPlate(t.plateNumber)).join(', ');
        await showConfirm({
            title: 'Cảnh báo: Thiếu số moóc phương tiện',
            message: `Có ${missingMoocTrips.length} xe chưa có số moóc:\n\n${plates}\n\nVui lòng cập nhật đầy đủ số moóc trước khi đồng bộ.`,
            type: 'warning',
            okText: 'Đã hiểu',
            cancelText: ''
        });
        return;
    }
    
    try {
        await dbContext.set('allocator_generated_trips', generatedTrips.value);
    } catch (e) {
        console.error('Lỗi lưu IndexedDB trước đồng bộ:', e);
    }
    await saveTicketsToSupabase();
    syncChannel.postMessage({ type: 'manual_sync_request' });
    addToast('Đồng bộ dữ liệu thành công! Bản phân bổ đã được lưu lên đám mây và sẽ tự động cập nhật khi bạn mở trang DASHBOARD.', 'success');
    await LogService.logAction('Đồng bộ dữ liệu', 'Đồng bộ bản phân bổ lên đám mây');
}

// Save generated temporary trips into history
async function saveToHistory() {
    try {
        const savedVehicles = await dbContext.get<any[]>('allocator_vehicles');
        if (savedVehicles && Array.isArray(savedVehicles)) {
            vehiclesList.value = savedVehicles;
        }
    } catch (e) {
        console.error('Lỗi khi tải lại danh sách xe trước khi lưu:', e);
    }

    if (generatedTrips.value.length === 0) {
        addToast('Không có dữ liệu phân bổ để lưu!', 'info');
        return;
    }
    
    const missingMoocTrips = getTripsWithoutMooc();
    if (missingMoocTrips.length > 0) {
        const plates = missingMoocTrips.map(t => formatPlate(t.plateNumber)).join(', ');
        await showConfirm({
            title: 'Cảnh báo: Thiếu số moóc phương tiện',
            message: `Có ${missingMoocTrips.length} xe chưa có số moóc:\n\n${plates}\n\nVui lòng cập nhật đầy đủ số moóc trước khi lưu vào Sổ Theo Dõi.`,
            type: 'warning',
            okText: 'Đã hiểu',
            cancelText: ''
        });
        return;
    }
    
    // Check duplicates
    const duplicates: string[] = [];
    generatedTrips.value.forEach(gt => {
        const isDup = existingTrips.value.some(et => {
            if (useAutoTicketNo.value) {
                const gtDateStr = formatExcelDateTimeCombined(gt.date1Obj);
                const etDateStr = formatExcelDateTimeCombined(et.date1Obj);
                return normalizePlate(gt.plateNumber) === normalizePlate(et.plateNumber) &&
                       gt.weightNet === et.weightNet &&
                       gtDateStr === etDateStr;
            }
            if (gt.ticketNo && et.ticketNo && gt.ticketNo === et.ticketNo) {
                return true;
            }
            // Fallback match: Plate + Net Weight + Date1 Time
            const gtDateStr = formatExcelDateTimeCombined(gt.date1Obj);
            const etDateStr = formatExcelDateTimeCombined(et.date1Obj);
            return normalizePlate(gt.plateNumber) === normalizePlate(et.plateNumber) &&
                   gt.weightNet === et.weightNet &&
                   gtDateStr === etDateStr;
        });
        if (isDup) {
            duplicates.push(gt.ticketNo || `${formatPlate(gt.plateNumber)} (${gt.weightNet} kg)`);
        }
    });

    if (duplicates.length > 0) {
        const fullListStr = duplicates.map(d => `- ${d}`).join('\n');
        const confirmSaveDup = await showConfirm({
            title: 'Trùng lặp dữ liệu lịch sử',
            message: `Cảnh báo: Có ${duplicates.length} chuyến xe bị trùng lặp với dữ liệu đã tồn tại trong Sổ Theo Dõi:\n\n${fullListStr}\n\nBạn có chắc chắn vẫn muốn lưu các chuyến trùng lặp này vào Sổ Theo Dõi không?`,
            type: 'warning',
            okText: 'Vẫn lưu',
            cancelText: 'Hủy'
        });
        if (!confirmSaveDup) {
            return;
        }
    }
    
    const confirmSave = await showConfirm({
        title: 'Lưu vào Sổ Theo Dõi',
        message: `Bạn có chắc chắn muốn lưu ${generatedTrips.value.length} chuyến xe này vào Sổ Theo Dõi và làm sạch danh sách phiếu cân hiện tại ở Tab 1 không?`,
        type: 'info',
        okText: 'Lưu & Làm sạch',
        cancelText: 'Hủy'
    });
    if (confirmSave) {
        // Tự động tăng số phiếu bắt đầu nếu đang dùng tự động sinh số phiếu
        if (useAutoTicketNo.value) {
            ticketStart.value = ticketStart.value + generatedTrips.value.length;
        }

        // Append generated trips to history
        existingTrips.value = [...existingTrips.value, ...generatedTrips.value];
        
        // Clear active tickets in Tab 1 without clearing Tab 2
        isSavingToHistory.value = true;
        csvRecords.value = [];
        csvFile.value = null;
        
        nextTick(() => {
            isSavingToHistory.value = false;
        });
        
        // Save empty tickets list to Supabase
        saveTicketsToSupabase();
        
        // Switch tab to Tab 3 (Theo dõi)
        activeDataTab.value = 'generated';
        addToast('Đã lưu thành công vào Sổ Theo Dõi!', 'success');
    }
}

async function deleteGeneratedTrip(trip: SplitTrip) {
    const confirmDelete = await showConfirm({
        title: 'Xóa chuyến xe phân bổ',
        message: `Bạn có chắc muốn xóa chuyến xe của xe ${trip.plateNumber} này khỏi danh sách phân bổ không?`,
        type: 'danger',
        okText: 'Xóa',
        cancelText: 'Hủy'
    });
    if (confirmDelete) {
        const index = generatedTrips.value.findIndex(t => t.stt === trip.stt);
        if (index !== -1) {
            generatedTrips.value.splice(index, 1);
            saveTicketsToSupabase();
            addToast('Đã xóa chuyến xe phân bổ thành công!', 'success');
        }
    }
}

async function editHistoryTripOrderNo(trip: SplitTrip) {
    if (authStore.role !== 'admin' && !canUpdate()) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const currentOrderNo = trip.orderNo || '';
    const newOrderNo = prompt(`Nhập Mã lệnh mới cho xe "${trip.plateNumber}" rời bến lúc ${trip.timeStr || ''}:`, currentOrderNo);
    if (newOrderNo === null) return; // Cancelled
    
    trip.orderNo = newOrderNo.trim();
    
    const idx = existingTrips.value.findIndex(t => t.stt === trip.stt || (t.ticketNo && t.ticketNo === trip.ticketNo));
    if (idx !== -1) {
        existingTrips.value[idx] = { ...trip };
    }
    
    await saveTicketsToSupabase();
    addToast('Cập nhật mã lệnh thành công!', 'success');
}

async function deleteHistoryTrip(trip: SplitTrip) {
    if (authStore.role !== 'admin' && !canDelete()) {
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
    
    existingTrips.value = existingTrips.value.filter(t => t.stt !== trip.stt && (!t.ticketNo || t.ticketNo !== trip.ticketNo));
    await saveTicketsToSupabase();
    addToast('Đã xóa bản ghi khỏi Sổ theo dõi!', 'success');
}

async function editGeneratedTripOrderNo(trip: SplitTrip) {
    const currentOrderNo = trip.orderNo || '';
    const newOrderNo = prompt(`Nhập Mã lệnh mới cho xe "${trip.plateNumber}" rời bến lúc ${trip.timeStr || ''}:`, currentOrderNo);
    if (newOrderNo === null) return; // Cancelled
    
    trip.orderNo = newOrderNo.trim();
    
    const idx = generatedTrips.value.findIndex(t => t.stt === trip.stt || (t.ticketNo && t.ticketNo === trip.ticketNo));
    if (idx !== -1) {
        generatedTrips.value[idx] = { ...trip };
    }
    
    await saveTicketsToSupabase();
    addToast('Cập nhật mã lệnh thành công!', 'success');
}

async function clearAllGeneratedTrips() {
    const confirmClear = await showConfirm({
        title: 'Xóa tất cả phân bổ',
        message: 'Bạn có chắc chắn muốn xóa toàn bộ danh sách phân bổ ở Tab 2 không? Hành động này không thể hoàn tác!',
        type: 'danger',
        okText: 'Xóa sạch',
        cancelText: 'Hủy'
    });
    if (confirmClear) {
        generatedTrips.value = [];
        saveTicketsToSupabase();
        addToast('Đã xóa sạch danh sách phân bổ!', 'info');
    }
}

// Clear all history
async function clearHistory() {
    if (authStore.role !== 'admin' && !canDelete()) {
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
        existingTrips.value = [];
        saveTicketsToSupabase();
        addToast('Đã xóa sạch lịch sử Sổ Theo Dõi!', 'info');
    }
}

// Total history cargo weight in tons
const historyTotalWeightTons = computed(() => {
    return existingTrips.value.reduce((sum, t) => sum + (t.weightTons || 0), 0);
});

// Export source tickets (Tab 1) as Excel
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

// Execute Excel update and download
async function compileAndDownload() {
    const dataToExport = activeDataTab.value === 'template' ? filteredTrips.value : filteredHistoryTrips.value;
    if (dataToExport.length === 0) {
        addToast(activeDataTab.value === 'template' ? 'Không có dữ liệu phân bổ để xuất!' : 'Không có dữ liệu lịch sử để xuất!', 'info');
        return;
    }
    
    compiling.value = true;
    
    try {
        let workbook: any = null;
        let dsSheet: any;
        const ExcelJS = await import('exceljs');
        workbook = new ExcelJS.Workbook();
        dsSheet = workbook.addWorksheet('DS');

        if (activeDataTab.value === 'template') {
            // Set 16 columns matching "Ánh phân bổ bằng tay.csv" plus orderNo
            dsSheet.columns = [
                { header: 'So phieu', key: 'ticketNo', width: 18 },
                { header: 'Ma lenh', key: 'orderNo', width: 15 },
                { header: 'So xe', key: 'plateNumber', width: 15 },
                { header: 'Khach hang', key: 'customer', width: 30 },
                { header: 'KL can lan 1', key: 'weight1', width: 15 },
                { header: 'KL can lan 2', key: 'weight2', width: 15 },
                { header: 'KL hang', key: 'weightNet', width: 15 },
                { header: 'Ngay can lan 1', key: 'date1', width: 15 },
                { header: 'Gio can lan 1', key: 'time1', width: 15 },
                { header: '', key: 'dateTime1', width: 22 },
                { header: 'Ngay can lan 2', key: 'date2', width: 15 },
                { header: 'Gio can lan 2', key: 'time2', width: 15 },
                { header: '', key: 'dateTime2', width: 22 },
                { header: 'Xuat/Nhap', key: 'direction', width: 15 },
                { header: 'Loai Hang', key: 'cargoType', width: 30 },
                { header: 'Loai Salan', key: 'bargeName', width: 35 }
            ];
            
            const headerRow = dsSheet.getRow(1);
            headerRow.getCell(1).value = 'So phieu';
            headerRow.getCell(2).value = 'Ma lenh';
            headerRow.getCell(3).value = 'So xe';
            headerRow.getCell(4).value = 'Khach hang';
            headerRow.getCell(5).value = 'KL can lan 1';
            headerRow.getCell(6).value = 'KL can lan 2';
            headerRow.getCell(7).value = 'KL hang';
            headerRow.getCell(8).value = 'Ngay can lan 1';
            headerRow.getCell(9).value = 'Gio can lan 1';
            headerRow.getCell(10).value = '';
            headerRow.getCell(11).value = 'Ngay can lan 2';
            headerRow.getCell(12).value = 'Gio can lan 2';
            headerRow.getCell(13).value = '';
            headerRow.getCell(14).value = 'Xuat/Nhap';
            headerRow.getCell(15).value = 'Loai Hang';
            headerRow.getCell(16).value = 'Loai Salan';
            
            headerRow.font = { name: 'Arial', size: 10, bold: true };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            
            for (let colIdx = 1; colIdx <= 16; colIdx++) {
                const cell = headerRow.getCell(colIdx);
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE2EBF5' } // soft light blue fill
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
                    left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
                    bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
                    right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
                };
            }
            headerRow.height = 25;
            
            let currentRowIdx = 2;
            dataToExport.forEach(trip => {
                const row = dsSheet.getRow(currentRowIdx);
                row.height = 20; // Đặt chiều cao hàng dữ liệu bằng nhau
                row.getCell(1).value = trip.ticketNo;
                row.getCell(2).value = trip.orderNo || '';
                row.getCell(3).value = formatPlate(trip.plateNumber);
                row.getCell(4).value = trip.customer;
                row.getCell(5).value = trip.weight1;
                row.getCell(6).value = trip.weight2;
                row.getCell(7).value = trip.weightNet;
                row.getCell(8).value = formatExcelDate(trip.date1Obj);
                row.getCell(9).value = formatExcelTime(trip.date1Obj);
                row.getCell(10).value = formatExcelDateTimeCombined(trip.date1Obj);
                row.getCell(11).value = formatExcelDate(trip.date2Obj);
                row.getCell(12).value = formatExcelTime(trip.date2Obj);
                row.getCell(13).value = formatExcelDateTimeCombined(trip.date2Obj);
                row.getCell(14).value = trip.direction;
                row.getCell(15).value = trip.cargoType;
                row.getCell(16).value = trip.bargeName;
                
                for (let colIdx = 1; colIdx <= 16; colIdx++) {
                    const cell = row.getCell(colIdx);
                    cell.font = { name: 'Arial', size: 10 };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
                    };
                    if ([1, 2, 3, 8, 9, 10, 11, 12, 13, 14].includes(colIdx)) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else if ([5, 6, 7].includes(colIdx)) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = '#,##0.00';
                    } else {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    }
                }
                currentRowIdx++;
            });

            // Tự động căn chỉnh độ rộng cột cho Tab Phân bổ
            for (let colIdx = 1; colIdx <= 16; colIdx++) {
                const col = dsSheet.getColumn(colIdx);
                let maxLen = 10;
                dsSheet.eachRow((row: any) => {
                    const cell = row.getCell(colIdx);
                    const val = cell.value;
                    if (val !== null && val !== undefined) {
                        const strVal = String(val);
                        if (strVal.length > maxLen) {
                            maxLen = strVal.length;
                        }
                    }
                });
                col.width = Math.min(maxLen + 4, 30);
            }
        } else {
            // Load template instead of creating blank workbook
            try {
                const response = await fetch('/SO_THEO_DOI_TEMPLATE.xlsx?v=' + Date.now());
                if (!response.ok) throw new Error('Không thể tải tệp mẫu Excel');
                const arrayBuffer = await response.arrayBuffer();
                
                const ExcelJS = await import('exceljs');
                workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(arrayBuffer);
                dsSheet = workbook.worksheets[0];
            } catch (err) {
                console.warn('Failed to load template, falling back to clean sheet', err);
                const ExcelJS = await import('exceljs');
                workbook = new ExcelJS.Workbook();
                dsSheet = workbook.addWorksheet('DS');
                
                dsSheet.columns = [
                    { header: '', key: 'A', width: 3 },
                    { header: 'STT', key: 'stt', width: 8 },
                    { header: 'Giờ', key: 'timeOnlyStr', width: 12 },
                    { header: 'Ngày', key: 'dateOnlyStr', width: 12 },
                    { header: 'Số xe', key: 'plateNumber', width: 15 },
                    { header: 'TTTP (tấn)', key: 'tttp', width: 15 },
                    { header: 'Trọng lượng hàng cho phép (tấn)', key: 'limit', width: 22 },
                    { header: 'Mã lệnh', key: 'orderNo', width: 18 },
                    { header: 'Số phiếu', key: 'ticketNo', width: 18 },
                    { header: 'Loại hàng', key: 'cargoType', width: 18 },
                    { header: 'Khối lượng (tấn)', key: 'weightTons', width: 22 },
                    { header: 'Ghi chú', key: 'notes', width: 15 }
                ];
                
                const headerRow = dsSheet.getRow(9);
                headerRow.getCell(2).value = 'STT';
                headerRow.getCell(3).value = 'Giờ';
                headerRow.getCell(4).value = 'Ngày';
                headerRow.getCell(5).value = 'Số xe';
                headerRow.getCell(6).value = 'TTTP (tấn)';
                headerRow.getCell(7).value = 'Trọng lượng hàng cho phép (tấn)';
                headerRow.getCell(8).value = 'Mã lệnh';
                headerRow.getCell(9).value = 'Số phiếu';
                headerRow.getCell(10).value = 'Loại hàng';
                headerRow.getCell(11).value = 'Khối lượng (tấn)';
                headerRow.getCell(12).value = 'Ghi chú';
                
                headerRow.font = { name: 'Times New Roman', size: 10, bold: true };
                headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                
                for (let colIdx = 2; colIdx <= 12; colIdx++) {
                    const cell = headerRow.getCell(colIdx);
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
                headerRow.height = 25;
            }
            
            // Thiết lập chiều cao dòng tiêu đề chính (Row 8 & 9) trong trường hợp dùng template
            dsSheet.getRow(8).height = 25;
            dsSheet.getRow(9).height = 25;

            const startRowIdx = 10;
            const maxEmptyRowsInTemplate = 18;
            const dataCount = dataToExport.length;
            
            const isUsingTemplate = dsSheet.name === 'Sheet1' || dsSheet.name === 'Danh sách Sà Lan' || dsSheet.rowCount >= 28;
            if (isUsingTemplate && dataCount > maxEmptyRowsInTemplate) {
                const rowsToInsert = dataCount - maxEmptyRowsInTemplate;
                const emptyRows = [];
                for (let i = 0; i < rowsToInsert; i++) {
                    emptyRows.push([]);
                }
                dsSheet.spliceRows(28, 0, ...emptyRows);
            }
            
            let currentSTT = 0;
            let currentRowIdx = 10;
            
            dataToExport.forEach(trip => {
                currentSTT++;
                
                const row = dsSheet.getRow(currentRowIdx);
                row.height = 20; // Đặt chiều cao các hàng dữ liệu bằng nhau
                
                let timeVal = '';
                let dateVal = '';
                if (trip.timeStr && trip.timeStr.includes('\n')) {
                    const timeParts = trip.timeStr.split('\n');
                    timeVal = timeParts[0] || '';
                    dateVal = timeParts[1] || '';
                } else if (trip.timeStr) {
                    const timeParts = trip.timeStr.trim().split(/\s+/);
                    if (timeParts.length === 2) {
                        timeVal = timeParts[0] || '';
                        dateVal = timeParts[1] || '';
                    } else {
                        timeVal = trip.timeStr;
                        dateVal = '';
                    }
                }
                
                row.getCell(2).value = currentSTT;                         // Col B: STT
                row.getCell(3).value = timeVal;                            // Col C: Giờ
                row.getCell(4).value = dateVal;                            // Col D: Ngày
                row.getCell(5).value = formatPlate(trip.plateNumber);      // Col E: Số đăng ký
                row.getCell(6).value = trip.tttp;                          // Col F: TTTP
                row.getCell(7).value = trip.limit;                         // Col G: Hạn mức hàng
                row.getCell(8).value = trip.orderNo || '';                 // Col H: Mã lệnh
                row.getCell(9).value = trip.ticketNo;                      // Col I: Số phiếu
                row.getCell(10).value = trip.cargoType;                    // Col J: Loại hàng
                row.getCell(11).value = trip.weightTons;                   // Col K: Khối lượng (tấn)
                row.getCell(12).value = trip.bargeName || '';              // Col L: Ghi chú (Tên sà lan)
                
                for (let colIdx = 2; colIdx <= 12; colIdx++) {
                    const cell = row.getCell(colIdx);
                    cell.font = { name: 'Times New Roman', size: 11 };
                    cell.border = {
                        top: { style: 'thin', color: { indexed: 64 } },
                        left: { style: 'thin', color: { indexed: 64 } },
                        bottom: { style: 'thin', color: { indexed: 64 } },
                        right: { style: 'thin', color: { indexed: 64 } }
                    };
                    if ([2, 3, 4, 5, 8, 9].includes(colIdx)) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else if ([6, 7, 11].includes(colIdx)) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = '#,##0.00';
                    } else {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    }
                }
                currentRowIdx++;
            });
            
            if (isUsingTemplate && dataCount < maxEmptyRowsInTemplate) {
                const unusedStart = startRowIdx + dataCount;
                const countToDelete = 27 - unusedStart + 1;
                dsSheet.spliceRows(unusedStart, countToDelete);
            }

            // Tự động căn chỉnh độ rộng cột cho Tab Theo dõi (bỏ qua dòng tiêu đề lớn)
            dsSheet.getColumn(1).width = 3; // Cột A trống
            
            const lastDataRowIdx = 10 + dataCount - 1;
            for (let colIdx = 2; colIdx <= 12; colIdx++) {
                const col = dsSheet.getColumn(colIdx);
                
                // Thu nhỏ cột Trọng tải cho phép (Col 6 / F) và Hạn mức hàng (Col 7 / G)
                if (colIdx === 6) {
                    col.width = 12;
                    continue;
                }
                if (colIdx === 7) {
                    col.width = 14;
                    continue;
                }
                
                let maxLen = 12; // Tăng chiều rộng cơ bản tối thiểu
                
                for (let rIdx = 8; rIdx <= lastDataRowIdx; rIdx++) {
                    const cell = dsSheet.getRow(rIdx).getCell(colIdx);
                    // Bỏ qua dòng 8 của các cột đã gộp để tránh giãn cột vô lý
                    if (rIdx === 8 && [3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(colIdx)) {
                        continue;
                    }
                    const val = cell.value;
                    if (val !== null && val !== undefined) {
                        let strVal = '';
                        if (typeof val === 'object' && val.result !== undefined) {
                            strVal = String(val.result);
                        } else {
                            strVal = String(val);
                        }
                        const lines = strVal.split('\n');
                        lines.forEach(l => {
                            if (l.length > maxLen) {
                                maxLen = l.length;
                            }
                        });
                    }
                }
                col.width = Math.min(maxLen + 5, 35); // Tăng đệm lên +5 và giới hạn tối đa lên 35
            }
        }
        
        // Write to buffer
        const buffer = await workbook.xlsx.writeBuffer();
        
        // Download
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = activeDataTab.value === 'template' 
            ? 'SỔ PHÂN BỔ CHI TIẾT_PhanBo.xlsx' 
            : 'SỐ THEO DÕI XẾP HÀNG HÓA LÊN PHƯƠNG TIỆN_NNP_TVPL.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        addToast('Đã xuất tệp Excel thành công!', 'success');
        await LogService.logAction('Xuất Excel', 'Xuất báo cáo cân hàng ra Excel');
    } catch (error) {
        console.error(error);
        addToast('Lỗi khi xuất tệp Excel!', 'error');
    } finally {
        compiling.value = false;
    }
}
</script>

<template>
    <div class="cargo-allocator-wrapper flex-1 flex flex-col min-h-0 overflow-hidden h-full w-full font-display">
        <!-- Main area -->
        <div class="flex-1 flex flex-col md:flex-row overflow-hidden gap-4 p-4">
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
            </div>

            <!-- Sidebar (left) (Desktop Only) -->
            <aside class="hidden md:flex w-72 h-full bg-white rounded-[24px] soft-shadow border border-primary/5 flex-col shrink-0 overflow-hidden no-print">
                <!-- Sidebar header -->
                <div class="p-4 border-b border-primary/5">
                    <div class="text-xs uppercase font-black tracking-widest text-primary mb-0.5">Tiện ích quản lý</div>
                    <h2 class="text-sm font-black text-[#1e293b] flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-primary text-base">balance</span>
                        Báo cáo cân hàng
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
                </div>
            </aside>

            <main class="flex-1 min-h-0 flex flex-col overflow-hidden">
                <!-- Chế độ 1: Quản lý danh sách xe -->
                <div v-if="activeSubViewMode === 'vehicles'" class="w-full max-w-[1500px] mx-auto flex-1 flex flex-col min-h-0">
                    <VehicleManager />
                </div>

                <!-- Chế độ 3: Quản lý danh sách hàng hóa -->
                <div v-else-if="activeSubViewMode === 'goods'" class="w-full max-w-[1500px] mx-auto flex-1 flex flex-col min-h-0">
                    <GoodsManager />
                </div>

                <!-- Chế độ 2: Giao diện Phân bổ tải trọng xếp hàng (Chạy toàn cục) -->
                <div v-else class="flex flex-col gap-4 w-full max-w-[1500px] mx-auto overflow-hidden flex-1 min-h-0">

                    <div class="flex flex-col gap-4 w-full max-w-[1500px] mx-auto pb-0 fade-in flex-1 min-h-0">
        <!-- Header Banner -->
        <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] py-3 px-5 soft-shadow border border-primary/5 gap-4 shrink-0">
            <div>
                <div class="text-xs uppercase font-black tracking-widest text-primary mb-0.5">Công cụ thông minh</div>
                <h1 class="text-base font-black text-[#1e293b] flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-primary text-base">balance</span>
                    Phân bổ tải trọng xếp hàng lên phương tiện
                </h1>
                <p class="text-xs text-gray-500 mt-1">
                    Tự động chia tách trọng lượng xe quá tải vượt hạn mức thành nhiều chuyến hợp lệ và kết xuất tệp theo mẫu chuẩn.
                </p>
            </div>
        </div>

        <!-- Settings Section -->

        <!-- Settings Section -->

        <!-- Compact Settings & Capacities configs -->
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-3 shrink-0 text-left">
            <!-- Thẻ 1: Số phiếu tự động (2/4 width) -->
            <div class="lg:col-span-2 bg-white rounded-[20px] p-3.5 soft-shadow border border-primary/5 grid grid-cols-1 md:grid-cols-2 gap-3">
                <!-- Col 1: Số phiếu tự động (Phần 1) -->
                <div class="flex flex-col gap-2 pr-2 lg:pl-1">
                    <h4 class="text-xs font-black text-primary flex items-center gap-1.5 select-none">
                        <span class="material-symbols-outlined text-[13px]">tag</span>
                        Số phiếu tự động
                    </h4>
                    <div class="space-y-2">
                        <div class="flex flex-col gap-0.5">
                            <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Tiền tố số phiếu</span>
                            <input 
                                type="text" 
                                v-model="ticketPrefix" 
                                placeholder="Ví dụ: PC-"
                                class="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono"
                            >
                        </div>
                        <div class="flex flex-col gap-0.5">
                            <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Số phiếu bắt đầu</span>
                            <input 
                                type="number" 
                                v-model.number="ticketStart" 
                                min="0"
                                class="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono"
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
                                min="1" 
                                max="10"
                                class="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono"
                            >
                        </div>
                        <div class="flex flex-col gap-0.5">
                            <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Hậu tố số phiếu</span>
                            <input 
                                type="text" 
                                v-model="ticketSuffix" 
                                placeholder="Ví dụ: /mmyy"
                                class="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono"
                            >
                        </div>
                    </div>
                </div>
            </div>

            <!-- Thẻ 2: Quy tắc phân bổ (1/4 width) -->
            <div class="lg:col-span-1 bg-white rounded-[20px] p-3.5 soft-shadow border border-primary/5 flex flex-col gap-2">
                <h4 class="text-xs font-black text-primary flex items-center gap-1.5 select-none">
                    <span class="material-symbols-outlined text-[13px]">tune</span>
                    Quy tắc phân bổ
                </h4>
                <div class="space-y-2">
                    <div class="flex flex-col gap-0.5">
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Chiến lược chia</span>
                        <select v-model="distStrategy" class="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all cursor-pointer">
                            <option value="random">Phân bổ ngẫu nhiên</option>
                            <option value="even">Chia đều</option>
                            <option value="max">Tối đa hóa công suất</option>
                        </select>
                    </div>
                    <div class="flex flex-col gap-0.5">
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Định thời gian</span>
                        <select v-model="spacingStrategy" class="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all cursor-pointer">
                            <option value="even">Phân đều chu kỳ</option>
                            <option value="forward">Tịnh tiến (+ Phút)</option>
                            <option value="backward">Lùi dần (- Phút)</option>
                        </select>
                    </div>
                    <div v-if="spacingStrategy !== 'even'" class="flex items-center gap-1.5 bg-primary/5 p-1 rounded-lg border border-primary/10">
                        <span class="text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Giãn cách:</span>
                        <input 
                            type="number" 
                            v-model.number="timeIntervalMinutes" 
                            min="10" 
                            max="720"
                            class="w-12 px-1 py-0.5 bg-white border border-gray-200 rounded-[4px] text-xs font-bold focus:outline-none focus:border-primary transition-all font-mono text-center"
                        >
                        <span class="text-xs text-gray-400 font-bold">phút</span>
                    </div>
                </div>
            </div>

            <!-- Thẻ 3: Hạn mức tải trọng (1/4 width) -->
            <div class="lg:col-span-1 bg-white rounded-[20px] p-3.5 soft-shadow border border-primary/5 flex flex-col gap-2">
                <h4 class="text-xs font-black text-primary flex items-center gap-1.5 select-none">
                    <span class="material-symbols-outlined text-[13px]">shield</span>
                    Hạn mức tải trọng
                </h4>
                <div class="space-y-2">
                    <div class="flex flex-col gap-0.5">
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Trọng tải cho phép (tấn)</span>
                        <input 
                            type="number" 
                            v-model.number="standardTTTPLimit" 
                            step="0.1"
                            class="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono"
                        >
                    </div>
                    <div class="flex flex-col gap-0.5">
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Xác xe tiêu chuẩn (tấn)</span>
                        <div class="flex items-center gap-1.5">
                            <input 
                                type="number" 
                                v-model.number="standardCurbMin" 
                                step="0.1"
                                placeholder="Min"
                                class="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono text-center"
                            >
                            <span class="text-gray-400 text-xs font-bold">~</span>
                            <input 
                                type="number" 
                                v-model.number="standardCurbMax" 
                                step="0.1"
                                placeholder="Max"
                                class="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono text-center"
                            >
                        </div>
                    </div>
                    <div class="text-xs text-gray-400 font-bold flex items-center justify-between mt-1">
                        <span>Hạn mức hàng:</span>
                        <span class="text-primary font-mono bg-primary/5 px-2 py-0.5 rounded">
                            {{ Math.max(0, standardTTTPLimit - standardCurbMax).toFixed(1) }} - {{ Math.max(0, standardTTTPLimit - standardCurbMin).toFixed(1) }} tấn
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Tabbed Data Panel -->
        <div class="bg-white rounded-[24px] p-5 pb-3 soft-shadow border border-primary/5 flex flex-col gap-4 animate-fade-in w-full flex-1 min-h-0 overflow-hidden">
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
                        @click="activeDataTab = 'template'"
                        :class="[
                            'px-3 py-1.5 text-xs font-black rounded-lg transition-all shrink-0',
                            activeDataTab === 'template' 
                                ? 'bg-primary/10 text-primary border border-primary/20' 
                                : 'text-gray-500 hover:bg-gray-50'
                        ]"
                    >
                        2. Phân bổ ({{ generatedTrips.length }})
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
                        3. Theo dõi ({{ existingTrips.length }})
                    </button>
                </div>

                <!-- Controls, Search, and Action Buttons (Aligned Row) -->
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 xl:justify-end min-w-0">
                    <!-- Search Input container -->
                    <div class="flex-grow sm:flex-initial min-w-0 flex items-center h-7">
                        <!-- Tab 1 Search -->
                        <div v-if="activeDataTab === 'source'" class="relative w-full sm:w-[180px] h-7 flex items-center">
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

                        <!-- Tab 2 Search & Filter -->
                        <div v-if="activeDataTab === 'template'" class="flex items-center gap-2 w-full sm:w-auto h-7">
                            <div class="relative w-full sm:w-[160px] h-7 flex items-center">
                                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">search</span>
                                <input 
                                    type="text" 
                                    v-model="searchQuery" 
                                    placeholder="Tìm kiếm..." 
                                    class="w-full pl-9 pr-8 h-7 bg-white border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all placeholder:text-gray-400"
                                >
                                <button 
                                    v-if="searchQuery" 
                                    @click="searchQuery = ''" 
                                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary flex items-center"
                                >
                                    <span class="material-symbols-outlined text-xs">close</span>
                                </button>
                            </div>
                            <div class="flex items-center gap-1.5 shrink-0 h-7">
                                <select 
                                    v-model="selectedCustomer"
                                    class="px-2.5 h-7 bg-white border border-gray-200 rounded-[8px] text-xs font-bold focus:outline-none focus:border-primary transition-all cursor-pointer min-w-[120px] max-w-[150px] shadow-sm text-gray-700"
                                >
                                    <option value="">Tất cả khách hàng</option>
                                    <option v-for="customer in uniqueCustomers" :key="customer" :value="customer">
                                        {{ customer }}
                                    </option>
                                </select>
                                <button 
                                    v-if="selectedCustomer"
                                    @click="selectedCustomer = ''"
                                    class="size-7 rounded-[8px] bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-primary flex items-center justify-center transition-colors border border-gray-200"
                                    title="Xóa lọc khách hàng"
                                >
                                    <span class="material-symbols-outlined text-xs">close</span>
                                </button>
                            </div>
                        </div>

                        <!-- Tab 3 Search -->
                        <div v-if="activeDataTab === 'generated'" class="relative w-full sm:w-[180px] h-7 flex items-center">
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
                            accept=".csv,.xlsx" 
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
                            @click="exportSourceTickets"
                            :disabled="csvRecords.length === 0 || compiling"
                            class="h-7 px-3 bg-primary text-white border border-primary text-xs font-bold rounded-[8px] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <span class="material-symbols-outlined text-[14px]">download</span>
                            Xuất Excel
                        </button>
                    </template>

                    <!-- Tab 2 Actions -->
                    <template v-if="activeDataTab === 'template'">
                        <div class="h-7 px-2.5 bg-teal-50 rounded-[8px] border border-teal-200 text-teal-700 flex items-center font-bold text-xs">
                            KL: {{ totalSplitWeightTons.toFixed(2) }}t
                        </div>
                        <button 
                            @click="triggerManualSyncToPrinter"
                            :disabled="generatedTrips.length === 0 || compiling"
                            class="h-7 px-3 bg-teal-600 text-white border border-teal-600 text-xs font-bold rounded-[8px] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed animate-fade-in"
                        >
                            <span class="material-symbols-outlined text-[14px]">sync</span>
                            Update
                        </button>
                        <button 
                            @click="saveToHistory"
                            :disabled="generatedTrips.length === 0 || isAlreadySaved"
                            class="h-7 px-3 bg-primary text-white border border-primary text-xs font-bold rounded-[8px] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <span class="material-symbols-outlined text-[14px]">save</span>
                            {{ isAlreadySaved ? 'Đã lưu' : 'Lưu' }}
                        </button>
                        <button 
                            @click="clearAllGeneratedTrips"
                            :disabled="generatedTrips.length === 0"
                            class="h-7 px-3 bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-[8px] hover:bg-red-100 active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <span class="material-symbols-outlined text-[14px]">delete</span>
                            Xóa tất cả
                        </button>
                        <button 
                            @click="compileAndDownload"
                            :disabled="generatedTrips.length === 0 || compiling"
                            class="h-7 px-3 bg-primary text-white border border-primary text-xs font-bold rounded-[8px] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <span v-if="compiling" class="material-symbols-outlined text-[14px] animate-spin">sync</span>
                            <span v-else class="material-symbols-outlined text-[14px]">download</span>
                            {{ compiling ? 'Đang xử lý...' : 'Xuất Excel' }}
                        </button>
                    </template>

                    <!-- Tab 3 Actions -->
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
                                <th @click="toggleSourceSort('orderNo')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
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
                                <th @click="toggleSourceSort('weightNet')" class="py-2 px-3 text-right bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-end gap-1">
                                        <span>Khối lượng (kg)</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ sourceSortKey === 'weightNet' ? (sourceSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleSourceSort('dateInStr')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Thời gian vào</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ sourceSortKey === 'dateInStr' ? (sourceSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleSourceSort('dateOutStr')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
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
                                <td class="py-2 px-3 font-semibold text-teal-600 font-mono whitespace-nowrap">{{ ticket.orderNo || '-' }}</td>
                                <td class="py-2 px-3 font-bold text-gray-900 whitespace-nowrap">{{ formatPlate(ticket.plateNumber) }}</td>
                                <td class="py-2 px-3 truncate max-w-[120px]" :title="ticket.cargoType">{{ ticket.cargoType }}</td>
                                <td class="py-2 px-3 text-right font-black text-primary whitespace-nowrap">{{ ticket.weightNet.toLocaleString() }}</td>
                                <td class="py-2 px-3 text-xs text-gray-500 font-mono whitespace-nowrap">{{ ticket.timeInStr }} {{ ticket.dateInStr }}</td>
                                <td class="py-2 px-3 text-xs text-gray-500 font-mono whitespace-nowrap">{{ ticket.timeOutStr }} {{ ticket.dateOutStr }}</td>
                                <td class="py-2 px-3 text-gray-500 truncate max-w-[100px]" :title="ticket.driverName">{{ ticket.driverName || '-' }}</td>
                                <td class="py-2 px-3 text-center">
                                    <div class="flex items-center justify-center gap-1.5">
                                        <button 
                                            @click="openEditTicketDialog(ticket)" 
                                            class="size-6 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all"
                                            title="Sửa"
                                        >
                                            <span class="material-symbols-outlined text-[13px]">edit</span>
                                        </button>
                                        <button 
                                            @click="deleteTicket(ticket)" 
                                            class="size-6 rounded-full bg-red-50 hover:bg-red-100 text-red-655 flex items-center justify-center transition-all"
                                            title="Xóa"
                                        >
                                            <span class="material-symbols-outlined text-[13px]">delete</span>
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

            <!-- Tab Content: Generated Split Trips -->
            <div v-if="activeDataTab === 'generated'" class="flex-1 flex flex-col gap-3 min-h-0">

                <!-- Preview Data Table -->
                <div v-if="filteredHistoryTrips.length > 0" class="flex-1 min-h-[400px] md:min-h-0 overflow-y-auto overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs font-bold min-w-[1200px] whitespace-nowrap">
                        <thead>
                            <tr class="bg-gray-55 text-gray-500 border-b border-gray-100 font-bold whitespace-nowrap">
                                <th class="py-2 px-3 w-12 text-center bg-gray-55 font-bold">STT</th>
                                <th @click="toggleHistorySort('orderNo')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Mã lệnh</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'orderNo' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('dateObj')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Thời gian rời bến (Giờ/Ngày)</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'dateObj' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
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
                                <th @click="toggleHistorySort('tttp')" class="py-2 px-3 text-center bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-center gap-1">
                                        <span>TTTP (tấn)</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'tttp' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('limit')" class="py-2 px-3 text-center bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-center gap-1">
                                        <span>Trọng lượng hàng CP (tấn)</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'limit' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('ticketNo')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Số phiếu</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'ticketNo' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('cargoType')" class="py-2 px-3 text-center w-28 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-center gap-1">
                                        <span>Loại hàng</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'cargoType' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleHistorySort('weightTons')" class="py-2 px-3 text-right bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-end gap-1">
                                        <span>Khối lượng (tấn)</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ historySortKey === 'weightTons' ? (historySortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th class="py-2 px-3 text-center w-16 bg-gray-55 font-bold select-none">Trạng thái</th>
                                <th v-if="authStore.role === 'admin' || canUpdate() || canDelete()" class="py-2 px-3 text-center w-20 bg-gray-55 font-bold select-none">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 text-[#1e293b]/90">
                            <tr 
                                v-for="(trip, idx) in pagedHistoryTrips" 
                                :key="trip.stt"
                                class="hover:bg-gray-50 transition-colors"
                            >
                                <td class="py-2 px-3 text-center font-bold text-gray-400 whitespace-nowrap">
                                    {{ (historyCurrentPage - 1) * itemsPerPage + idx + 1 }}
                                </td>
                                <td class="py-2 px-3 font-semibold text-teal-600 font-mono">{{ trip.orderNo || '-' }}</td>
                                <td class="py-2 px-3 whitespace-pre-line font-mono text-xs leading-tight text-gray-500">{{ trip.timeStr }}</td>
                                <td class="py-2 px-3 font-bold text-gray-900 flex items-center gap-1.5">
                                    <span class="whitespace-nowrap">{{ formatPlate(trip.plateNumber) }}</span>
                                    <span v-if="!formatPlate(trip.plateNumber).includes('/')" class="material-symbols-outlined text-[14px] text-red-500 font-bold animate-pulse" title="Thiếu số moóc!">warning</span>
                                </td>
                                <td class="py-2 px-3 text-center">{{ typeof trip.tttp === 'number' ? trip.tttp.toFixed(1) : (trip.tttp || '-') }}</td>
                                <td class="py-2 px-3 text-center">{{ typeof trip.limit === 'number' ? trip.limit.toFixed(1) : (trip.limit || '-') }}</td>
                                <td class="py-2 px-3 font-semibold text-gray-500">{{ trip.ticketNo }}</td>
                                <td class="py-2 px-3 truncate max-w-[120px]" :title="trip.cargoType">{{ trip.cargoType }}</td>
                                <td class="py-2 px-3 text-right font-black text-primary">{{ typeof trip.weightTons === 'number' ? trip.weightTons.toFixed(2) : (trip.weightTons || '-') }}</td>
                                <td class="py-2 px-3 text-center">
                                    <span 
                                        v-if="typeof trip.weightTons === 'number' && typeof trip.limit === 'number' && trip.weightTons <= trip.limit" 
                                        class="size-5 rounded-full bg-teal-50 text-teal-655 border border-teal-200 flex items-center justify-center mx-auto"
                                        title="Hợp lệ - Dưới hạn mức"
                                    >
                                        <span class="material-symbols-outlined text-[13px] font-black">check</span>
                                    </span>
                                    <span 
                                        v-else-if="typeof trip.weightTons === 'number' && typeof trip.limit === 'number'" 
                                        class="size-5 rounded-full bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto"
                                        title="Quá tải!"
                                    >
                                        <span class="material-symbols-outlined text-[13px] font-black">close</span>
                                    </span>
                                    <span v-else class="text-gray-400 italic text-xs">-</span>
                                </td>
                                <td v-if="authStore.role === 'admin' || canUpdate() || canDelete()" class="py-2 px-3 text-center">
                                    <div class="flex items-center justify-center gap-1.5">
                                        <button 
                                            @click="editHistoryTripOrderNo(trip)"
                                            class="size-6 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all"
                                            title="Sửa Mã lệnh"
                                        >
                                            <span class="material-symbols-outlined text-[12px]">edit</span>
                                        </button>
                                        <button 
                                            @click="deleteHistoryTrip(trip)"
                                            class="size-6 rounded-full bg-red-50 hover:bg-red-100 text-red-655 flex items-center justify-center transition-all"
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
                        Không tìm thấy bản ghi nào khớp bộ lọc!
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

            <!-- Tab Content: Detail Template (Theo dõi) -->
            <div v-if="activeDataTab === 'template'" class="flex-1 flex flex-col gap-3 min-h-0">

                <!-- Preview Data Table -->
                <div v-if="filteredTrips.length > 0" class="flex-1 min-h-[400px] md:min-h-0 overflow-y-auto overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs font-bold min-w-[1200px] whitespace-nowrap">
                        <thead>
                            <tr class="bg-gray-55 text-gray-500 border-b border-gray-100 font-bold whitespace-nowrap">
                                <th class="py-2 px-3 w-12 text-center bg-gray-50 font-bold">STT</th>
                                <th @click="toggleTemplateSort('ticketNo')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Số phiếu</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ templateSortKey === 'ticketNo' ? (templateSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleTemplateSort('orderNo')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Mã lệnh</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ templateSortKey === 'orderNo' ? (templateSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleTemplateSort('plateNumber')" class="py-2 px-3 bg-gray-50 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Số xe</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ templateSortKey === 'plateNumber' ? (templateSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleTemplateSort('customer')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Khách hàng</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ templateSortKey === 'customer' ? (templateSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleTemplateSort('weight1')" class="py-2 px-3 text-right bg-gray-50 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-end gap-1">
                                        <span>KL cân lần 1</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ templateSortKey === 'weight1' ? (templateSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleTemplateSort('weight2')" class="py-2 px-3 text-right bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-end gap-1">
                                        <span>KL cân lần 2</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ templateSortKey === 'weight2' ? (templateSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleTemplateSort('weightNet')" class="py-2 px-3 text-right bg-gray-50 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-end gap-1">
                                        <span>KL hàng</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ templateSortKey === 'weightNet' ? (templateSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleTemplateSort('date1Obj')" class="py-2 px-3 text-center bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group" colspan="3">
                                    <div class="flex items-center justify-center gap-1">
                                        <span>Thời gian vào</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ templateSortKey === 'date1Obj' ? (templateSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleTemplateSort('date2Obj')" class="py-2 px-3 text-center bg-gray-50 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group" colspan="3">
                                    <div class="flex items-center justify-center gap-1">
                                        <span>Thời gian ra</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ templateSortKey === 'date2Obj' ? (templateSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleTemplateSort('direction')" class="py-2 px-3 text-center bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center justify-center gap-1">
                                        <span>X/N</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ templateSortKey === 'direction' ? (templateSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleTemplateSort('cargoType')" class="py-2 px-3 bg-gray-50 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Loại hàng</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ templateSortKey === 'cargoType' ? (templateSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th @click="toggleTemplateSort('bargeName')" class="py-2 px-3 bg-gray-55 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none group">
                                    <div class="flex items-center gap-1">
                                        <span>Loại Sà lan</span>
                                        <span class="material-symbols-outlined text-[12px] text-gray-400 group-hover:text-gray-700 transition-colors">
                                            {{ templateSortKey === 'bargeName' ? (templateSortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                        </span>
                                    </div>
                                </th>
                                <th class="py-2 px-3 text-center bg-gray-50 font-bold w-[80px] select-none">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 text-[#1e293b]/90">
                            <tr 
                                v-for="(trip, idx) in pagedTrips" 
                                :key="trip.stt"
                                class="hover:bg-gray-50 transition-colors"
                            >
                                <td class="py-2 px-3 text-center font-bold text-gray-400 whitespace-nowrap">
                                    {{ (currentPage - 1) * itemsPerPage + idx + 1 }}
                                </td>
                                <td class="py-2 px-3 font-bold text-gray-800 whitespace-nowrap">{{ trip.ticketNo }}</td>
                                <td class="py-2 px-3 font-semibold text-teal-600 font-mono whitespace-nowrap">{{ trip.orderNo || '-' }}</td>
                                <td class="py-2 px-3 font-bold text-gray-900 whitespace-nowrap">
                                    <div class="flex items-center gap-1">
                                        <span>{{ formatPlate(trip.plateNumber) }}</span>
                                        <span v-if="!formatPlate(trip.plateNumber).includes('/')" class="material-symbols-outlined text-[14px] text-red-500 font-bold animate-pulse" title="Thiếu số moóc! Vui lòng cấu hình số moóc cho xe.">warning</span>
                                    </div>
                                </td>
                                <td class="py-2 px-3 max-w-[150px] truncate text-gray-500" :title="trip.customer">{{ trip.customer }}</td>
                                <td class="py-2 px-3 text-right font-mono text-gray-700 whitespace-nowrap">{{ trip.weight1.toLocaleString() }}</td>
                                <td class="py-2 px-3 text-right font-mono text-gray-700 whitespace-nowrap">{{ trip.weight2.toLocaleString() }}</td>
                                <td class="py-2 px-3 text-right font-black text-primary font-mono whitespace-nowrap">{{ trip.weightNet.toLocaleString() }}</td>
                                <td class="py-2 px-3 text-center text-gray-500 font-mono whitespace-nowrap">{{ formatExcelDate(trip.date1Obj) }}</td>
                                <td class="py-2 px-3 text-center text-gray-500 font-mono whitespace-nowrap">{{ formatExcelTime(trip.date1Obj) }}</td>
                                <td class="py-2 px-3 text-gray-400 text-xs font-mono whitespace-nowrap">{{ formatExcelDateTimeCombined(trip.date1Obj) }}</td>
                                <td class="py-2 px-3 text-center text-gray-500 font-mono whitespace-nowrap">{{ formatExcelDate(trip.date2Obj) }}</td>
                                <td class="py-2 px-3 text-center text-gray-500 font-mono whitespace-nowrap">{{ formatExcelTime(trip.date2Obj) }}</td>
                                <td class="py-2 px-3 text-gray-400 text-xs font-mono whitespace-nowrap">{{ formatExcelDateTimeCombined(trip.date2Obj) }}</td>
                                <td class="py-2 px-3 text-center">
                                    <span :class="['px-1.5 py-0.5 rounded text-xs font-black whitespace-nowrap', trip.direction.toUpperCase().includes('XUẤT') || trip.direction.toUpperCase().includes('XUAT') ? 'bg-primary/10 text-primary' : 'bg-teal-50 text-teal-600']">
                                        {{ trip.direction.toUpperCase().includes('XUẤT') || trip.direction.toUpperCase().includes('XUAT') ? 'XUẤT' : 'NHẬP' }}
                                    </span>
                                </td>
                                <td class="py-2 px-3 truncate max-w-[150px]" :title="trip.cargoType">{{ trip.cargoType }}</td>
                                <td class="py-2 px-3 truncate max-w-[150px]" :title="trip.bargeName">{{ trip.bargeName }}</td>
                                <td class="py-2 px-3 text-center">
                                    <div class="flex items-center justify-center gap-1.5">
                                        <button 
                                            @click="editGeneratedTripOrderNo(trip)"
                                            class="size-6 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all"
                                            title="Sửa Mã lệnh"
                                        >
                                            <span class="material-symbols-outlined text-[13px]">edit</span>
                                        </button>
                                        <button 
                                            @click="deleteGeneratedTrip(trip)"
                                            class="size-6 rounded-full bg-red-50 hover:bg-red-100 text-red-655 flex items-center justify-center transition-all"
                                            title="Xóa chuyến xe này"
                                        >
                                            <span class="material-symbols-outlined text-[13px]">delete</span>
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
                        Không tìm thấy bản ghi nào khớp bộ lọc!
                    </p>
                </div>

                <!-- Table Pagination -->
                <div class="flex items-center justify-between gap-4 pt-3 border-t border-gray-50 text-xs font-semibold text-gray-500">
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-1">
                            Tổng: <span class="font-black text-gray-700">{{ filteredTrips.length }}</span>
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
                        <template v-if="totalPages > 1">
                            <button 
                                @click="currentPage = Math.max(1, currentPage - 1)" 
                                :disabled="currentPage === 1"
                                class="size-7 rounded-lg hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-700 border border-gray-100 transition-colors"
                            >
                                <span class="material-symbols-outlined text-base">chevron_left</span>
                            </button>
                            <span class="text-xs font-bold text-gray-500">
                                Trang {{ currentPage }} / {{ totalPages }}
                            </span>
                            <button 
                                @click="currentPage = Math.min(totalPages, currentPage + 1)" 
                                :disabled="currentPage === totalPages"
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

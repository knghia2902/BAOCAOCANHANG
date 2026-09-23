<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { dbContext } from '@/services/storage/DBContext';
import { WeighbridgeService, type Vessel, type Barge, type Truck } from '@/services/weighbridge/WeighbridgeService';
import { VehicleService, type VehicleRecord } from '@/services/excel/VehicleService';
import ExcelJS from 'exceljs';

const { addToast } = useToast();

// ----------------------------------------------------
// TYPES & INTERFACES
// ----------------------------------------------------
export interface SourceTicket {
    id: string;
    ticketNo: string;
    orderNo: string;
    plateNumber: string;
    customer: string;
    cargoType: string;
    weight1: number;
    weight2: number;
    weightNet: number; // in kg
    dateInStr: string;
    timeInStr: string;
    dateOutStr: string;
    timeOutStr: string;
    driver: string;
    note?: string;
}

export interface SplitTrip {
    id: string;
    stt: number;
    ticketNo: string;
    sourceTicketNo: string;
    orderNo: string;
    plateNumber: string;
    customer: string;
    cargoType: string;
    weight1: number;
    weight2: number;
    weightNet: number; // in kg
    weightTons: number; // in tons
    dateInStr: string;
    timeInStr: string;
    dateOutStr: string;
    timeOutStr: string;
    bargeName: string;
    driver: string;
    notes: string;
    dateInObj: Date;
    dateOutObj: Date;
}

interface SplitConfig {
    selectedBargeId: number | null;
    customOrderNo: string;
    timeIntervalMinutes: number;
    distStrategy: 'even' | 'random' | 'max';
    spacingStrategy: 'even' | 'forward' | 'backward';
    defaultLimit: number; // in tons
    vehicleLimits: Record<string, number>;
    useAutoTicketNo: boolean;
    ticketPrefix: string;
    ticketStart: number;
    ticketPadding: number;
    ticketSuffix: string;
}

// ----------------------------------------------------
// STATE
// ----------------------------------------------------
const activeTab = ref<'tickets' | 'allocate' | 'history'>('tickets');
const isInitLoading = ref(true);
const loadingFile = ref(false);
const isSyncingBarge = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

// Vessels & Barges
const vesselsList = ref<Vessel[]>([]);
const vehiclesList = ref<VehicleRecord[]>([]);

// Tickets & Trips Data
const sourceTickets = ref<SourceTicket[]>([]);
const previewTrips = ref<SplitTrip[]>([]);
const historyTrips = ref<SplitTrip[]>([]);

// Config State
const config = ref<SplitConfig>({
    selectedBargeId: null,
    customOrderNo: '',
    timeIntervalMinutes: 10,
    distStrategy: 'even',
    spacingStrategy: 'forward',
    defaultLimit: 30.0,
    vehicleLimits: {},
    useAutoTicketNo: true,
    ticketPrefix: '',
    ticketStart: 1,
    ticketPadding: 6,
    ticketSuffix: '/mmyy'
});

// UI Filters & Pagination
const ticketSearchQuery = ref('');
const ticketCurrentPage = ref(1);
const ticketPageSize = ref(20);

const previewSearchQuery = ref('');
const previewCurrentPage = ref(1);
const previewPageSize = ref(20);

const historySearchQuery = ref('');
const historyCurrentPage = ref(1);
const historyPageSize = ref(20);

// Vehicle search in sidebar
const vehicleSearchQuery = ref('');

// Dialogs & Modals
const showTicketModal = ref(false);
const isEditingTicket = ref(false);
const editingTicket = ref<SourceTicket>({
    id: '',
    ticketNo: '',
    orderNo: '',
    plateNumber: '',
    customer: '',
    cargoType: '',
    weight1: 0,
    weight2: 0,
    weightNet: 0,
    dateInStr: '',
    timeInStr: '',
    dateOutStr: '',
    timeOutStr: '',
    driver: '',
    note: ''
});

// Confirm Dialog
const confirmDialog = ref({
    show: false,
    title: '',
    message: '',
    type: 'danger' as 'danger' | 'warning' | 'info',
    okText: 'Xác nhận',
    onOk: () => {}
});

function openConfirm(title: string, message: string, onOk: () => void, type: 'danger' | 'warning' | 'info' = 'danger') {
    confirmDialog.value = {
        show: true,
        title,
        message,
        type,
        okText: 'Xác nhận',
        onOk: () => {
            confirmDialog.value.show = false;
            onOk();
        }
    };
}

// ----------------------------------------------------
// UTILITY FUNCTIONS: Parsing & Formatting
// ----------------------------------------------------
function cleanHeader(h: any): string {
    if (!h) return '';
    return String(h)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizePlate(plate: string | null | undefined): string {
    if (!plate) return '';
    return String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function formatPlate(plate: string | null | undefined): string {
    if (!plate) return '';
    const clean = String(plate).toUpperCase().trim();
    if (clean.includes('-')) return clean;
    const match = clean.match(/^([0-9]{2}[A-Z]{1,2})([0-9]+)$/);
    if (match && match[1] && match[2]) {
        return `${match[1]}-${match[2]}`;
    }
    return clean;
}

function downloadExcel(buffer: any, filename: string) {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function formatExcelDateCell(val: any): { dateStr: string; timeStr: string } {
    let dateStr = '';
    let timeStr = '';
    if (val === null || val === undefined || val === '') return { dateStr, timeStr };

    if (typeof val === 'object' && 'result' in val) {
        val = (val as any).result;
    }

    if (val instanceof Date) {
        if (!isNaN(val.getTime())) {
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            const hh = String(val.getHours()).padStart(2, '0');
            const mm = String(val.getMinutes()).padStart(2, '0');
            const ss = String(val.getSeconds()).padStart(2, '0');

            if (y <= 1900) {
                timeStr = `${hh}:${mm}:${ss}`;
            } else {
                dateStr = `${d}/${m}/${y}`;
                timeStr = `${hh}:${mm}:${ss}`;
            }
        }
        return { dateStr, timeStr };
    }

    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) {
            const y = date.getUTCFullYear();
            const m = String(date.getUTCMonth() + 1).padStart(2, '0');
            const d = String(date.getUTCDate()).padStart(2, '0');
            const hh = String(date.getUTCHours()).padStart(2, '0');
            const mm = String(date.getUTCMinutes()).padStart(2, '0');
            const ss = String(date.getUTCSeconds()).padStart(2, '0');
            if (y <= 1900) {
                timeStr = `${hh}:${mm}:${ss}`;
            } else {
                dateStr = `${d}/${m}/${y}`;
                timeStr = `${hh}:${mm}:${ss}`;
            }
        }
        return { dateStr, timeStr };
    }

    const raw = String(val).trim();
    if (!raw) return { dateStr, timeStr };

    const timeMatch = raw.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (timeMatch && timeMatch[1] && timeMatch[2]) {
        const hh = String(timeMatch[1]).padStart(2, '0');
        const mm = String(timeMatch[2]).padStart(2, '0');
        const ss = timeMatch[3] ? String(timeMatch[3]).padStart(2, '0') : '00';
        return { dateStr: '', timeStr: `${hh}:${mm}:${ss}` };
    }

    const dtMatch = raw.match(/^(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (dtMatch && dtMatch[1] && dtMatch[2] && dtMatch[3] && dtMatch[4] && dtMatch[5]) {
        let p1 = dtMatch[1] || '';
        let p2 = dtMatch[2] || '';
        let p3 = dtMatch[3] || '';
        let d = '', m = '', y = '';
        if (p1.length === 4) {
            y = p1; m = p2.padStart(2, '0'); d = p3.padStart(2, '0');
        } else {
            d = p1.padStart(2, '0'); m = p2.padStart(2, '0'); y = p3.length === 2 ? '20' + p3 : p3;
        }
        dateStr = `${d}/${m}/${y}`;
        const hh = String(dtMatch[4]).padStart(2, '0');
        const mm = String(dtMatch[5]).padStart(2, '0');
        const ss = dtMatch[6] ? String(dtMatch[6]).padStart(2, '0') : '00';
        timeStr = `${hh}:${mm}:${ss}`;
        return { dateStr, timeStr };
    }

    const dateOnlyMatch = raw.match(/^(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})$/);
    if (dateOnlyMatch && dateOnlyMatch[1] && dateOnlyMatch[2] && dateOnlyMatch[3]) {
        let p1 = dateOnlyMatch[1] || '';
        let p2 = dateOnlyMatch[2] || '';
        let p3 = dateOnlyMatch[3] || '';
        let d = '', m = '', y = '';
        if (p1.length === 4) {
            y = p1; m = p2.padStart(2, '0'); d = p3.padStart(2, '0');
        } else {
            d = p1.padStart(2, '0'); m = p2.padStart(2, '0'); y = p3.length === 2 ? '20' + p3 : p3;
        }
        dateStr = `${d}/${m}/${y}`;
        return { dateStr, timeStr: '' };
    }

    return { dateStr: raw, timeStr: '' };
}

function parseDateTime(dateStr: string, timeStr: string): Date {
    try {
        if (!dateStr && !timeStr) return new Date();
        if (dateStr && dateStr.includes(' ') && !timeStr) {
            const parts = dateStr.split(' ');
            dateStr = parts[0] || '';
            timeStr = parts[1] || '';
        }

        const normalizedDate = (dateStr || '').replace(/-/g, '/');
        const dParts = normalizedDate.split('/');
        let day = 1, month = 0, year = new Date().getFullYear();

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
                year = parseInt(p2.length === 2 ? '20' + p2 : p2 || String(year), 10);
            }
        }

        let hour = 0, minute = 0, second = 0;
        if (timeStr) {
            const tParts = timeStr.trim().split(':');
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

function formatDisplayDate(dateObj: Date): { dateStr: string; timeStr: string } {
    if (!dateObj || isNaN(dateObj.getTime())) return { dateStr: '', timeStr: '' };
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    const ss = String(dateObj.getSeconds()).padStart(2, '0');
    return {
        dateStr: `${d}/${m}/${y}`,
        timeStr: `${hh}:${mm}:${ss}`
    };
}

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

function formatNumber(num: number): string {
    return Number(num || 0).toLocaleString('en-US');
}

// ----------------------------------------------------
// COMPUTED VALUES
// ----------------------------------------------------
// All active barges flattened
const allBarges = computed(() => {
    const list: { id: number; name: string; vesselName: string; orderNo: string; bargeObj: Barge }[] = [];
    vesselsList.value.forEach(v => {
        if (v.barges && v.barges.length > 0) {
            v.barges.forEach(b => {
                list.push({
                    id: b.id,
                    name: b.name,
                    vesselName: v.name,
                    orderNo: b.order_no || b.config?.orderNo || '',
                    bargeObj: b
                });
            });
        }
    });
    return list;
});

const selectedBargeInfo = computed(() => {
    if (!config.value.selectedBargeId) return null;
    return allBarges.value.find(b => b.id === config.value.selectedBargeId) || null;
});

// Auto-fill orderNo if selected barge changes
watch(() => config.value.selectedBargeId, (newId) => {
    if (newId) {
        const found = allBarges.value.find(b => b.id === newId);
        if (found && found.orderNo && !config.value.customOrderNo) {
            config.value.customOrderNo = found.orderNo;
        }
    }
});

// Stats for source tickets
const sourceStats = computed(() => {
    const totalCount = sourceTickets.value.length;
    const totalKg = sourceTickets.value.reduce((acc, t) => acc + (t.weightNet || 0), 0);
    const totalTons = totalKg / 1000;
    const platesSet = new Set(sourceTickets.value.map(t => normalizePlate(t.plateNumber)).filter(Boolean));
    return {
        totalCount,
        totalKg,
        totalTons,
        uniquePlates: platesSet.size
    };
});

// Filtered source tickets
const filteredSourceTickets = computed(() => {
    const q = ticketSearchQuery.value.trim().toLowerCase();
    if (!q) return sourceTickets.value;
    return sourceTickets.value.filter(t => 
        t.ticketNo.toLowerCase().includes(q) ||
        t.plateNumber.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q) ||
        t.cargoType.toLowerCase().includes(q) ||
        t.orderNo.toLowerCase().includes(q) ||
        (t.driver && t.driver.toLowerCase().includes(q))
    );
});

const paginatedSourceTickets = computed(() => {
    const start = (ticketCurrentPage.value - 1) * ticketPageSize.value;
    return filteredSourceTickets.value.slice(start, start + ticketPageSize.value);
});

const totalSourcePages = computed(() => Math.ceil(filteredSourceTickets.value.length / ticketPageSize.value) || 1);

// Filtered preview trips
const filteredPreviewTrips = computed(() => {
    const q = previewSearchQuery.value.trim().toLowerCase();
    if (!q) return previewTrips.value;
    return previewTrips.value.filter(t => 
        t.ticketNo.toLowerCase().includes(q) ||
        t.sourceTicketNo.toLowerCase().includes(q) ||
        t.plateNumber.toLowerCase().includes(q) ||
        t.orderNo.toLowerCase().includes(q) ||
        t.cargoType.toLowerCase().includes(q)
    );
});

const paginatedPreviewTrips = computed(() => {
    const start = (previewCurrentPage.value - 1) * previewPageSize.value;
    return filteredPreviewTrips.value.slice(start, start + previewPageSize.value);
});

const totalPreviewPages = computed(() => Math.ceil(filteredPreviewTrips.value.length / previewPageSize.value) || 1);

const previewStats = computed(() => {
    const totalCount = previewTrips.value.length;
    const totalKg = previewTrips.value.reduce((acc, t) => acc + (t.weightNet || 0), 0);
    const totalTons = totalKg / 1000;
    const avgTons = totalCount > 0 ? totalTons / totalCount : 0;
    return {
        totalCount,
        totalKg,
        totalTons,
        avgTons
    };
});

// Filtered history trips
const filteredHistoryTrips = computed(() => {
    const q = historySearchQuery.value.trim().toLowerCase();
    if (!q) return historyTrips.value;
    return historyTrips.value.filter(t => 
        t.ticketNo.toLowerCase().includes(q) ||
        t.plateNumber.toLowerCase().includes(q) ||
        t.orderNo.toLowerCase().includes(q) ||
        t.bargeName.toLowerCase().includes(q) ||
        t.cargoType.toLowerCase().includes(q)
    );
});

const paginatedHistoryTrips = computed(() => {
    const start = (historyCurrentPage.value - 1) * historyPageSize.value;
    return filteredHistoryTrips.value.slice(start, start + historyPageSize.value);
});

const totalHistoryPages = computed(() => Math.ceil(filteredHistoryTrips.value.length / historyPageSize.value) || 1);

const historyStats = computed(() => {
    const totalCount = historyTrips.value.length;
    const totalKg = historyTrips.value.reduce((acc, t) => acc + (t.weightNet || 0), 0);
    const totalTons = totalKg / 1000;
    return {
        totalCount,
        totalKg,
        totalTons
    };
});

// Vehicles in sidebar list
const filteredVehiclesList = computed(() => {
    const q = vehicleSearchQuery.value.trim().toLowerCase();
    if (!q) return vehiclesList.value;
    return vehiclesList.value.filter(v => 
        v.plateNumber.toLowerCase().includes(q) ||
        (v.moocNumber && v.moocNumber.toLowerCase().includes(q))
    );
});

// Ticket preview string
const previewNextTicketNo = computed(() => {
    if (!config.value.useAutoTicketNo) return 'Theo phiếu nguồn';
    const num = String(config.value.ticketStart).padStart(config.value.ticketPadding, '0');
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    let sfx = config.value.ticketSuffix || '';
    if (sfx.toLowerCase().includes('mmyy')) {
        sfx = sfx.replace(/mmyy/i, `${mm}${yy}`);
    }
    return `${config.value.ticketPrefix}${num}${sfx}`;
});

// ----------------------------------------------------
// PERSISTENCE (IndexedDB)
// ----------------------------------------------------
async function loadPersistedData() {
    isInitLoading.value = true;
    try {
        // Load Vessels from WeighbridgeService
        vesselsList.value = await WeighbridgeService.getVessels();

        // Load Vehicles from VehicleService
        vehiclesList.value = await VehicleService.getVehicles();

        // Load Saved Source Tickets
        const savedTickets = await dbContext.get<SourceTicket[]>('split_source_tickets');
        if (savedTickets && Array.isArray(savedTickets)) {
            sourceTickets.value = savedTickets;
        }

        // Load Saved Config
        const savedConfig = await dbContext.get<SplitConfig>('split_config');
        if (savedConfig) {
            config.value = { ...config.value, ...savedConfig };
        }

        // Auto-select barge if not selected: prioritize NÔNG SẢN_DE HEUS
        if (!config.value.selectedBargeId && allBarges.value.length > 0) {
            const deHeusBarge = allBarges.value.find(b => 
                b.name.toUpperCase().includes('NONG SAN') || 
                b.name.toUpperCase().includes('NÔNG SẢN') || 
                b.name.toUpperCase().includes('DE HEUS')
            );
            if (deHeusBarge) {
                config.value.selectedBargeId = deHeusBarge.id;
                config.value.customOrderNo = deHeusBarge.orderNo;
            } else if (allBarges.value[0]) {
                config.value.selectedBargeId = allBarges.value[0].id;
                config.value.customOrderNo = allBarges.value[0].orderNo;
            }
        }

        // Load Saved History Trips
        const savedHistory = await dbContext.get<SplitTrip[]>('split_history_trips');
        if (savedHistory && Array.isArray(savedHistory)) {
            historyTrips.value = savedHistory;
        }

        // Trigger allocation generation if source tickets exist
        if (sourceTickets.value.length > 0) {
            generateAllocatedTrips();
        }
    } catch (e) {
        console.error('Lỗi khi nạp dữ liệu phân bổ:', e);
    } finally {
        isInitLoading.value = false;
    }
}

// Auto-save changes
watch(sourceTickets, async (newVal) => {
    if (isInitLoading.value) return;
    try {
        await dbContext.set('split_source_tickets', newVal);
    } catch (e) {
        console.error('Lỗi lưu source tickets:', e);
    }
}, { deep: true });

watch(config, async (newVal) => {
    if (isInitLoading.value) return;
    try {
        await dbContext.set('split_config', newVal);
    } catch (e) {
        console.error('Lỗi lưu config:', e);
    }
}, { deep: true });

watch(historyTrips, async (newVal) => {
    if (isInitLoading.value) return;
    try {
        await dbContext.set('split_history_trips', newVal);
    } catch (e) {
        console.error('Lỗi lưu history trips:', e);
    }
}, { deep: true });

// Auto re-generate preview when config or source tickets change
watch([
    () => sourceTickets.value,
    () => config.value.selectedBargeId,
    () => config.value.customOrderNo,
    () => config.value.timeIntervalMinutes,
    () => config.value.distStrategy,
    () => config.value.spacingStrategy,
    () => config.value.defaultLimit,
    () => config.value.vehicleLimits,
    () => config.value.useAutoTicketNo,
    () => config.value.ticketPrefix,
    () => config.value.ticketStart,
    () => config.value.ticketPadding,
    () => config.value.ticketSuffix
], () => {
    if (!isInitLoading.value && sourceTickets.value.length > 0) {
        generateAllocatedTrips();
    }
}, { deep: true });

// ----------------------------------------------------
// TAB 1: SOURCE TICKETS MANAGEMENT & PARSING
// ----------------------------------------------------
function triggerFileInput() {
    fileInputRef.value?.click();
}

async function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !input.files[0]) return;
    const file = input.files[0];
    loadingFile.value = true;

    try {
        const ext = file.name.split('.').pop()?.toLowerCase();
        let parsedTickets: SourceTicket[] = [];

        if (ext === 'xlsx' || ext === 'xls') {
            parsedTickets = await parseExcelTickets(file);
        } else if (ext === 'csv') {
            parsedTickets = await parseCsvTickets(file);
        } else {
            addToast('Chỉ hỗ trợ tệp định dạng .xlsx, .xls hoặc .csv', 'error');
            return;
        }

        if (parsedTickets.length === 0) {
            addToast('Không tìm thấy dữ liệu phiếu cân hợp lệ trong tệp tải lên!', 'info');
            return;
        }

        sourceTickets.value = parsedTickets;
        addToast(`Đã import thành công ${parsedTickets.length} phiếu cân nguồn!`, 'success');
        ticketCurrentPage.value = 1;
        generateAllocatedTrips();
    } catch (err: any) {
        console.error('Lỗi khi đọc file phiếu cân:', err);
        addToast(`Không thể đọc file: ${err.message || 'Lỗi không xác định'}`, 'error');
    } finally {
        loadingFile.value = false;
        if (input) input.value = '';
    }
}

async function parseExcelTickets(file: File): Promise<SourceTicket[]> {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    let headerRowIdx = -1;
    let headers: string[] = [];

    // Scan top 15 rows to find header row containing keywords
    for (let r = 1; r <= Math.min(15, worksheet.rowCount); r++) {
        const row = worksheet.getRow(r);
        const rowVals: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
            rowVals.push(cleanHeader(cell.value));
        });
        const hasPlate = rowVals.some(h => h.includes('bien so') || h.includes('so xe') || h.includes('xe') || h.includes('plate'));
        const hasWeight = rowVals.some(h => h.includes('tl') || h.includes('trong luong') || h.includes('kl') || h.includes('khoi luong') || h.includes('hang'));

        if (hasPlate && hasWeight) {
            headerRowIdx = r;
            headers = rowVals;
            break;
        }
    }

    if (headerRowIdx === -1) {
        throw new Error('Không tìm thấy dòng tiêu đề chứa Biển số xe và Khối lượng cân.');
    }

    const normHeaders = headers;
    const idxTicket = normHeaders.findIndex(h => h.includes('phieu') || h.includes('ticket') || (h === 'stt' && !normHeaders.some(x => x.includes('phieu'))));
    const idxPlate = normHeaders.findIndex(h => h.includes('bien so') || h.includes('so xe') || h.includes('xe') || h.includes('plate'));
    const idxOrder = normHeaders.findIndex(h => h.includes('lenh') || h.includes('order'));
    const idxCustomer = normHeaders.findIndex(h => h.includes('khach') || h.includes('chu hang') || h.includes('customer'));
    const idxCargo = normHeaders.findIndex(h => h.includes('hang') || h.includes('loai hang') || h.includes('ten hang'));
    const idxDriver = normHeaders.findIndex(h => h.includes('tai xe') || h.includes('lai xe') || h.includes('driver'));

    const idxWeight1 = normHeaders.findIndex(h => 
        (h.includes('tl') && (h.includes('1') || h.includes('lan 1'))) ||
        (h.includes('trong luong') && (h.includes('1') || h.includes('lan 1'))) ||
        h.includes('lan 1') || h.includes('tl1') || h.includes('can 1')
    );
    const idxWeight2 = normHeaders.findIndex(h => 
        (h.includes('tl') && (h.includes('2') || h.includes('lan 2'))) ||
        (h.includes('trong luong') && (h.includes('2') || h.includes('lan 2'))) ||
        h.includes('lan 2') || h.includes('tl2') || h.includes('can 2')
    );
    const idxWeightNet = normHeaders.findIndex(h => 
        h.includes('kl hang') || h.includes('khoi luong') || h.includes('hang') || h.includes('net') || h.includes('tl hang')
    );

    const idxDateTime1 = normHeaders.findIndex(h => (h.includes('ngay gio') || h.includes('thoi gian')) && (h.includes('vao') || h.includes('in') || h.includes('1')));
    const idxDate1 = normHeaders.findIndex(h => h.includes('ngay') && (h.includes('vao') || h.includes('in') || h.includes('1')));
    const idxTime1 = normHeaders.findIndex(h => h.includes('gio') && (h.includes('vao') || h.includes('in') || h.includes('1')));

    const idxDateTime2 = normHeaders.findIndex(h => (h.includes('ngay gio') || h.includes('thoi gian')) && (h.includes('ra') || h.includes('out') || h.includes('2')));
    const idxDate2 = normHeaders.findIndex(h => h.includes('ngay') && (h.includes('ra') || h.includes('out') || h.includes('2')));
    const idxTime2 = normHeaders.findIndex(h => h.includes('gio') && (h.includes('ra') || h.includes('out') || h.includes('2')));

    const tickets: SourceTicket[] = [];

    for (let r = headerRowIdx + 1; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        const getCellVal = (colIdx: number) => {
            if (colIdx < 0) return null;
            return row.getCell(colIdx + 1).value;
        };

        const getTextVal = (colIdx: number): string => {
            const v = getCellVal(colIdx);
            if (v === null || v === undefined) return '';
            if (v instanceof Date) {
                const dt = formatExcelDateCell(v);
                return dt.timeStr ? `${dt.dateStr} ${dt.timeStr}` : dt.dateStr;
            }
            return String(v).trim();
        };

        const getNumVal = (colIdx: number): number => {
            const v = getCellVal(colIdx);
            if (typeof v === 'number') return v;
            if (!v) return 0;
            const str = String(v).replace(/,/g, '').trim();
            return parseFloat(str) || 0;
        };

        const rawPlate = getTextVal(idxPlate);
        if (!rawPlate) continue;

        let dateInStr = '', timeInStr = '';
        if (idxDateTime1 !== -1) {
            const dt = formatExcelDateCell(getCellVal(idxDateTime1));
            dateInStr = dt.dateStr; timeInStr = dt.timeStr;
        }
        if (idxDate1 !== -1) {
            const dt = formatExcelDateCell(getCellVal(idxDate1));
            if (!dateInStr && dt.dateStr) dateInStr = dt.dateStr;
            if (!timeInStr && dt.timeStr) timeInStr = dt.timeStr;
        }
        if (idxTime1 !== -1) {
            const dt = formatExcelDateCell(getCellVal(idxTime1));
            if (dt.timeStr) timeInStr = dt.timeStr;
            else if (!timeInStr) timeInStr = getTextVal(idxTime1);
        }

        let dateOutStr = '', timeOutStr = '';
        if (idxDateTime2 !== -1) {
            const dt = formatExcelDateCell(getCellVal(idxDateTime2));
            dateOutStr = dt.dateStr; timeOutStr = dt.timeStr;
        }
        if (idxDate2 !== -1) {
            const dt = formatExcelDateCell(getCellVal(idxDate2));
            if (!dateOutStr && dt.dateStr) dateOutStr = dt.dateStr;
            if (!timeOutStr && dt.timeStr) timeOutStr = dt.timeStr;
        }
        if (idxTime2 !== -1) {
            const dt = formatExcelDateCell(getCellVal(idxTime2));
            if (dt.timeStr) timeOutStr = dt.timeStr;
            else if (!timeOutStr) timeOutStr = getTextVal(idxTime2);
        }

        const w1 = getNumVal(idxWeight1);
        const w2 = getNumVal(idxWeight2);
        let wNet = getNumVal(idxWeightNet);
        if (wNet <= 0 && w1 > 0 && w2 > 0) {
            wNet = Math.abs(w1 - w2);
        }

        const tNo = getTextVal(idxTicket) || `T-${tickets.length + 1}`;
        const orderNo = getTextVal(idxOrder) || config.value.customOrderNo;

        tickets.push({
            id: `src_${Date.now()}_${r}`,
            ticketNo: tNo,
            orderNo: orderNo,
            plateNumber: formatPlate(rawPlate),
            customer: getTextVal(idxCustomer) || 'Khách lẻ',
            cargoType: getTextVal(idxCargo) || 'Nông sản',
            weight1: w1,
            weight2: w2,
            weightNet: wNet,
            dateInStr: dateInStr || new Date().toLocaleDateString('vi-VN'),
            timeInStr: timeInStr || '08:00:00',
            dateOutStr: dateOutStr || (dateInStr || new Date().toLocaleDateString('vi-VN')),
            timeOutStr: timeOutStr || '08:30:00',
            driver: getTextVal(idxDriver) || '',
            note: ''
        });
    }

    return tickets;
}

async function parseCsvTickets(file: File): Promise<SourceTicket[]> {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
        const res: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                res.push(cur.trim());
                cur = '';
            } else {
                cur += char;
            }
        }
        res.push(cur.trim());
        return res;
    };

    const headers = parseLine(lines[0] || '').map(cleanHeader);
    const idxTicket = headers.findIndex(h => h.includes('phieu') || h.includes('ticket') || (h === 'stt' && !headers.some(x => x.includes('phieu'))));
    const idxPlate = headers.findIndex(h => h.includes('bien so') || h.includes('so xe') || h.includes('xe') || h.includes('plate'));
    const idxOrder = headers.findIndex(h => h.includes('lenh') || h.includes('order'));
    const idxCustomer = headers.findIndex(h => h.includes('khach') || h.includes('customer'));
    const idxCargo = headers.findIndex(h => h.includes('hang') || h.includes('loai hang'));
    const idxDriver = headers.findIndex(h => h.includes('tai xe') || h.includes('driver'));

    const idxWeight1 = headers.findIndex(h => h.includes('tl1') || h.includes('can 1') || (h.includes('tl') && h.includes('1')));
    const idxWeight2 = headers.findIndex(h => h.includes('tl2') || h.includes('can 2') || (h.includes('tl') && h.includes('2')));
    const idxWeightNet = headers.findIndex(h => h.includes('kl hang') || h.includes('khoi luong') || h.includes('net'));

    const idxDate1 = headers.findIndex(h => h.includes('ngay') && (h.includes('vao') || h.includes('1')));
    const idxTime1 = headers.findIndex(h => h.includes('gio') && (h.includes('vao') || h.includes('1')));
    const idxDate2 = headers.findIndex(h => h.includes('ngay') && (h.includes('ra') || h.includes('2')));
    const idxTime2 = headers.findIndex(h => h.includes('gio') && (h.includes('ra') || h.includes('2')));

    const tickets: SourceTicket[] = [];

    for (let i = 1; i < lines.length; i++) {
        const parts = parseLine(lines[i] || '');
        if (parts.length <= Math.max(idxPlate, idxWeightNet)) continue;
        const plate = parts[idxPlate] || '';
        if (!plate) continue;

        const w1 = idxWeight1 !== -1 ? parseFloat((parts[idxWeight1] || '').replace(/,/g, '')) || 0 : 0;
        const w2 = idxWeight2 !== -1 ? parseFloat((parts[idxWeight2] || '').replace(/,/g, '')) || 0 : 0;
        let wNet = idxWeightNet !== -1 ? parseFloat((parts[idxWeightNet] || '').replace(/,/g, '')) || 0 : 0;
        if (wNet <= 0 && w1 > 0 && w2 > 0) wNet = Math.abs(w1 - w2);

        const d1 = idxDate1 !== -1 ? parts[idxDate1] || '' : '';
        const t1 = idxTime1 !== -1 ? parts[idxTime1] || '' : '';
        const d2 = idxDate2 !== -1 ? parts[idxDate2] || '' : '';
        const t2 = idxTime2 !== -1 ? parts[idxTime2] || '' : '';

        tickets.push({
            id: `src_csv_${Date.now()}_${i}`,
            ticketNo: (idxTicket !== -1 && parts[idxTicket]) ? parts[idxTicket] : `T-${i}`,
            orderNo: (idxOrder !== -1 && parts[idxOrder]) ? parts[idxOrder] : config.value.customOrderNo,
            plateNumber: formatPlate(plate),
            customer: (idxCustomer !== -1 && parts[idxCustomer]) ? parts[idxCustomer] : 'Khách lẻ',
            cargoType: (idxCargo !== -1 && parts[idxCargo]) ? parts[idxCargo] : 'Nông sản',
            weight1: w1,
            weight2: w2,
            weightNet: wNet,
            dateInStr: d1 || new Date().toLocaleDateString('vi-VN'),
            timeInStr: t1 || '08:00:00',
            dateOutStr: d2 || d1 || new Date().toLocaleDateString('vi-VN'),
            timeOutStr: t2 || '08:30:00',
            driver: (idxDriver !== -1 && parts[idxDriver]) ? parts[idxDriver] : '',
            note: ''
        });
    }

    return tickets;
}

// Modal actions: Add / Edit
function openAddTicketModal() {
    isEditingTicket.value = false;
    editingTicket.value = {
        id: `ticket_${Date.now()}`,
        ticketNo: `PC-${String(sourceTickets.value.length + 1).padStart(4, '0')}`,
        orderNo: config.value.customOrderNo || '',
        plateNumber: '',
        customer: 'Khách hàng',
        cargoType: 'Nông sản',
        weight1: 42000,
        weight2: 12000,
        weightNet: 30000,
        dateInStr: new Date().toLocaleDateString('vi-VN'),
        timeInStr: '08:00:00',
        dateOutStr: new Date().toLocaleDateString('vi-VN'),
        timeOutStr: '08:30:00',
        driver: '',
        note: ''
    };
    showTicketModal.value = true;
}

function openEditTicketModal(ticket: SourceTicket) {
    isEditingTicket.value = true;
    editingTicket.value = { ...ticket };
    showTicketModal.value = true;
}

function saveTicketModal() {
    if (!editingTicket.value.plateNumber.trim()) {
        addToast('Vui lòng nhập Biển số xe!', 'info');
        return;
    }

    // Auto-calculate weightNet if needed
    if (editingTicket.value.weight1 > 0 && editingTicket.value.weight2 > 0) {
        editingTicket.value.weightNet = Math.abs(editingTicket.value.weight1 - editingTicket.value.weight2);
    }

    editingTicket.value.plateNumber = formatPlate(editingTicket.value.plateNumber);

    if (isEditingTicket.value) {
        const idx = sourceTickets.value.findIndex(t => t.id === editingTicket.value.id);
        if (idx !== -1) {
            sourceTickets.value[idx] = { ...editingTicket.value };
            addToast('Đã cập nhật thông tin phiếu cân!', 'success');
        }
    } else {
        sourceTickets.value.push({ ...editingTicket.value });
        addToast('Đã thêm phiếu cân mới!', 'success');
    }

    showTicketModal.value = false;
    generateAllocatedTrips();
}

function deleteTicket(ticket: SourceTicket) {
    openConfirm('Xóa phiếu cân', `Bạn có chắc muốn xóa phiếu ${ticket.ticketNo} (${ticket.plateNumber})?`, () => {
        sourceTickets.value = sourceTickets.value.filter(t => t.id !== ticket.id);
        addToast('Đã xóa phiếu cân!', 'info');
        generateAllocatedTrips();
    });
}

function clearAllSourceTickets() {
    openConfirm('Xóa toàn bộ phiếu cân', 'Bạn có chắc chắn muốn xóa toàn bộ danh sách phiếu cân nguồn đã nạp?', () => {
        sourceTickets.value = [];
        previewTrips.value = [];
        addToast('Đã làm trống danh sách phiếu cân!', 'info');
    });
}

// Export source tickets to Excel
async function exportSourceTicketsExcel() {
    if (sourceTickets.value.length === 0) {
        addToast('Không có dữ liệu phiếu cân để xuất file!', 'info');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Phiếu cân nguồn');

    // Headers
    sheet.columns = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Số phiếu', key: 'ticketNo', width: 16 },
        { header: 'Mã lệnh', key: 'orderNo', width: 14 },
        { header: 'Số xe', key: 'plateNumber', width: 15 },
        { header: 'Khách hàng', key: 'customer', width: 22 },
        { header: 'Loại hàng', key: 'cargoType', width: 18 },
        { header: 'TL1 (kg)', key: 'weight1', width: 14 },
        { header: 'TL2 (kg)', key: 'weight2', width: 14 },
        { header: 'KL Hàng (kg)', key: 'weightNet', width: 16 },
        { header: 'Ngày vào', key: 'dateInStr', width: 14 },
        { header: 'Giờ vào', key: 'timeInStr', width: 12 },
        { header: 'Ngày ra', key: 'dateOutStr', width: 14 },
        { header: 'Giờ ra', key: 'timeOutStr', width: 12 },
        { header: 'Tài xế', key: 'driver', width: 18 }
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' } // Indigo
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 26;

    // Add rows
    sourceTickets.value.forEach((t, i) => {
        const row = sheet.addRow({
            stt: i + 1,
            ticketNo: t.ticketNo,
            orderNo: t.orderNo,
            plateNumber: t.plateNumber,
            customer: t.customer,
            cargoType: t.cargoType,
            weight1: t.weight1,
            weight2: t.weight2,
            weightNet: t.weightNet,
            dateInStr: t.dateInStr,
            timeInStr: t.timeInStr,
            dateOutStr: t.dateOutStr,
            timeOutStr: t.timeOutStr,
            driver: t.driver
        });
        row.getCell('weight1').numFmt = '#,##0';
        row.getCell('weight2').numFmt = '#,##0';
        row.getCell('weightNet').numFmt = '#,##0';
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadExcel(buffer, `DANH_SACH_PHIEU_CAN_NGUON_${new Date().toISOString().slice(0, 10)}.xlsx`);
    addToast('Đã xuất file Excel phiếu cân nguồn thành công!', 'success');
}

// ----------------------------------------------------
// TAB 2: ALLOCATION ALGORITHM & PREVIEW
// ----------------------------------------------------
function getVehicleLimitTons(plateNumber: string): number {
    const norm = normalizePlate(plateNumber);
    if (config.value.vehicleLimits[norm]) {
        return config.value.vehicleLimits[norm];
    }
    return config.value.defaultLimit || 30.0;
}

function updateVehicleLimit(plateNumber: string, limitTons: number) {
    const norm = normalizePlate(plateNumber);
    if (norm) {
        config.value.vehicleLimits[norm] = limitTons;
    }
}

// Bounded random split algorithm matching old allocator
function splitWeightRandomly(weightTons: number, numTrips: number, tripLimit: number, rand: () => number): number[] {
    const weights: number[] = [];
    let remaining = weightTons;
    const maxWeight = tripLimit;
    const average = weightTons / numTrips;

    let minWeight = Math.max(2.0, Math.min(average * 0.75, maxWeight * 0.5));
    if (minWeight > maxWeight) {
        minWeight = maxWeight * 0.5;
    }

    for (let i = 0; i < numTrips - 1; i++) {
        const remTrips = numTrips - 1 - i;
        const curMin = Math.max(minWeight, remaining - remTrips * maxWeight);
        const curMax = Math.min(maxWeight, remaining - remTrips * minWeight);

        let w = curMin + rand() * (curMax - curMin);
        w = Math.round(w * 100) / 100;
        weights.push(w);
        remaining -= w;
    }

    weights.push(Math.round(remaining * 100) / 100);
    return weights;
}

function generateAllocatedTrips() {
    if (sourceTickets.value.length === 0) {
        previewTrips.value = [];
        return;
    }

    const targetBarge = selectedBargeInfo.value;
    const bargeName = targetBarge ? targetBarge.name : 'SÀ LAN ĐÍCH';
    const orderNo = config.value.customOrderNo || (targetBarge ? targetBarge.orderNo : '');

    interface TempTrip {
        sourceTicket: SourceTicket;
        plateNumber: string;
        weightTons: number;
        weightNet: number;
        weight1: number;
        weight2: number;
        dateInObj: Date;
        dateOutObj: Date;
        ticketIndex: number;
        tripIndex: number;
    }

    const tempTrips: TempTrip[] = [];

    // 1. Split each ticket if needed
    sourceTickets.value.forEach((ticket, tIdx) => {
        let netKg = ticket.weightNet || 0;
        if (netKg <= 0 && ticket.weight1 > 0 && ticket.weight2 > 0) {
            netKg = Math.abs(ticket.weight1 - ticket.weight2);
        }
        const totalTons = netKg / 1000;
        if (totalTons <= 0) return;

        const limitTons = getVehicleLimitTons(ticket.plateNumber);
        const numTrips = Math.max(1, Math.ceil(totalTons / limitTons));

        // Weights distribution
        let weights: number[] = [];
        const seedStr = ticket.ticketNo || `${ticket.plateNumber}_${netKg}_${ticket.timeInStr}`;
        const rand = createSeededRandom(seedStr);

        if (config.value.distStrategy === 'random') {
            weights = splitWeightRandomly(totalTons, numTrips, limitTons, rand);
        } else if (config.value.distStrategy === 'even') {
            const base = Math.round((totalTons / numTrips) * 100) / 100;
            let sum = 0;
            for (let j = 0; j < numTrips - 1; j++) {
                weights.push(base);
                sum += base;
            }
            weights.push(Math.round((totalTons - sum) * 100) / 100);
        } else {
            // max strategy
            let rem = totalTons;
            for (let j = 0; j < numTrips - 1; j++) {
                weights.push(limitTons);
                rem -= limitTons;
            }
            weights.push(Math.round(rem * 100) / 100);
        }

        const dateIn = parseDateTime(ticket.dateInStr, ticket.timeInStr);
        const dateOut = parseDateTime(ticket.dateOutStr, ticket.timeOutStr);
        const durationMs = Math.max(10 * 60 * 1000, dateOut.getTime() - dateIn.getTime());

        for (let j = 0; j < numTrips; j++) {
            const tripWeightTons = weights[j] || (totalTons / numTrips);
            const tripNetKg = Math.round(tripWeightTons * 1000);
            
            // Standard tare weight estimation (12-14 tons)
            const tareKg = ticket.weight2 > 0 ? ticket.weight2 : 12500;
            const grossKg = tareKg + tripNetKg;

            let tripIn = new Date();
            let tripOut = new Date();

            if (config.value.spacingStrategy === 'forward') {
                tripIn = new Date(dateIn.getTime() + j * config.value.timeIntervalMinutes * 60 * 1000);
                tripOut = new Date(tripIn.getTime() + durationMs);
            } else if (config.value.spacingStrategy === 'backward') {
                tripOut = new Date(dateOut.getTime() - (numTrips - 1 - j) * config.value.timeIntervalMinutes * 60 * 1000);
                tripIn = new Date(tripOut.getTime() - durationMs);
            } else {
                tripIn = dateIn;
                tripOut = dateOut;
            }

            tempTrips.push({
                sourceTicket: ticket,
                plateNumber: ticket.plateNumber,
                weightTons: tripWeightTons,
                weightNet: tripNetKg,
                weight1: grossKg,
                weight2: tareKg,
                dateInObj: tripIn,
                dateOutObj: tripOut,
                ticketIndex: tIdx,
                tripIndex: j
            });
        }
    });

    // 2. Chronological sorting and overall spacing if strategy === 'even'
    if (config.value.spacingStrategy === 'even' && tempTrips.length > 1 && tempTrips[0]) {
        let minTime = tempTrips[0].dateInObj.getTime();
        let maxTime = tempTrips[0].dateOutObj.getTime();
        tempTrips.forEach(t => {
            if (t.dateInObj.getTime() < minTime) minTime = t.dateInObj.getTime();
            if (t.dateOutObj.getTime() > maxTime) maxTime = t.dateOutObj.getTime();
        });

        const totalSpan = maxTime - minTime;
        tempTrips.forEach((t, idx) => {
            const fraction = idx / (tempTrips.length - 1);
            const targetIn = new Date(minTime + fraction * totalSpan);
            const dur = Math.max(10 * 60 * 1000, t.dateOutObj.getTime() - t.dateInObj.getTime());
            t.dateInObj = targetIn;
            t.dateOutObj = new Date(targetIn.getTime() + dur);
        });
    }

    // Sort chronologically by dateInObj
    tempTrips.sort((a, b) => a.dateInObj.getTime() - b.dateInObj.getTime());

    // 3. Assign sequential ticket numbers and build final SplitTrip objects
    const result: SplitTrip[] = tempTrips.map((t, idx) => {
        let ticketNo = t.sourceTicket.ticketNo;
        if (config.value.useAutoTicketNo) {
            const ticketNumVal = config.value.ticketStart + idx;
            const paddedNum = String(ticketNumVal).padStart(config.value.ticketPadding, '0');
            const mm = String(t.dateOutObj.getMonth() + 1).padStart(2, '0');
            const yy = String(t.dateOutObj.getFullYear()).slice(-2);
            let sfx = config.value.ticketSuffix || '';
            if (sfx.toLowerCase().includes('mmyy')) {
                sfx = sfx.replace(/mmyy/i, `${mm}${yy}`);
            }
            ticketNo = `${config.value.ticketPrefix}${paddedNum}${sfx}`;
        } else if (t.tripIndex > 0) {
            ticketNo = `${t.sourceTicket.ticketNo}-${t.tripIndex + 1}`;
        }

        const inFmt = formatDisplayDate(t.dateInObj);
        const outFmt = formatDisplayDate(t.dateOutObj);

        return {
            id: `split_${Date.now()}_${idx}`,
            stt: idx + 1,
            ticketNo,
            sourceTicketNo: t.sourceTicket.ticketNo,
            orderNo: orderNo || t.sourceTicket.orderNo,
            plateNumber: t.plateNumber,
            customer: t.sourceTicket.customer,
            cargoType: t.sourceTicket.cargoType,
            weight1: t.weight1,
            weight2: t.weight2,
            weightNet: t.weightNet,
            weightTons: t.weightTons,
            dateInStr: inFmt.dateStr,
            timeInStr: inFmt.timeStr,
            dateOutStr: outFmt.dateStr,
            timeOutStr: outFmt.timeStr,
            bargeName,
            driver: t.sourceTicket.driver,
            notes: t.sourceTicket.ticketNo ? `Tách từ ${t.sourceTicket.ticketNo}` : '',
            dateInObj: t.dateInObj,
            dateOutObj: t.dateOutObj
        };
    });

    previewTrips.value = result;
}

// Direct barge sync
async function syncToSelectedBarge() {
    if (!config.value.selectedBargeId) {
        addToast('Vui lòng chọn Sà lan đích trước khi đồng bộ!', 'info');
        return;
    }
    if (previewTrips.value.length === 0) {
        addToast('Chưa có danh sách chuyến xe được phân bổ để đồng bộ!', 'info');
        return;
    }

    const targetBarge = selectedBargeInfo.value;
    const bargeName = targetBarge ? targetBarge.name : 'Sà lan đích';

    openConfirm('Đồng bộ vào Sà lan', `Bạn có chắc muốn nạp ${previewTrips.value.length} chuyến xe vào sà lan "${bargeName}" để phục vụ in phiếu?`, async () => {
        isSyncingBarge.value = true;
        try {
            // Convert SplitTrip[] to Truck[]
            const trucksToSync: Truck[] = previewTrips.value.map((t, i) => ({
                id: Date.now() + i,
                barge_id: config.value.selectedBargeId!,
                ticketNo: t.ticketNo,
                plateNumber: t.plateNumber,
                driver: t.driver || '',
                weight1: t.weight1,
                weight2: t.weight2,
                weightNet: t.weightNet,
                dateIn: t.timeInStr ? `${t.dateInStr} ${t.timeInStr}` : t.dateInStr,
                dateOut: t.timeOutStr ? `${t.dateOutStr} ${t.timeOutStr}` : t.dateOutStr,
                note: t.notes || ''
            }));

            const ok = await WeighbridgeService.saveTrucks(config.value.selectedBargeId!, trucksToSync);
            if (ok) {
                addToast(`Đã đồng bộ thành công ${trucksToSync.length} chuyến xe vào sà lan "${bargeName}"!`, 'success');
            } else {
                addToast('Có lỗi xảy ra khi lưu xe vào sà lan!', 'error');
            }
        } catch (e: any) {
            console.error('Lỗi khi đồng bộ vào sà lan:', e);
            addToast(`Lỗi đồng bộ: ${e.message || 'Lỗi không xác định'}`, 'error');
        } finally {
            isSyncingBarge.value = false;
        }
    }, 'info');
}

// Save preview trips into Tab 3 Tracking Book
function saveToTrackingBook() {
    if (previewTrips.value.length === 0) {
        addToast('Không có chuyến xe phân bổ để lưu vào Sổ theo dõi!', 'info');
        return;
    }

    // Merge or prepend preview trips into history
    const newItems = [...previewTrips.value];
    historyTrips.value = [...newItems, ...historyTrips.value];
    addToast(`Đã lưu ${newItems.length} chuyến xe vào Sổ theo dõi thành công!`, 'success');
    activeTab.value = 'history';
    historyCurrentPage.value = 1;
}

// ----------------------------------------------------
// TAB 3: ALLOCATED TRACKING BOOK & EXCEL EXPORT
// ----------------------------------------------------
function deleteHistoryTrip(trip: SplitTrip) {
    historyTrips.value = historyTrips.value.filter(t => t.id !== trip.id);
    addToast('Đã xóa dòng khỏi Sổ theo dõi!', 'info');
}

function clearAllHistory() {
    openConfirm('Xóa toàn bộ Sổ theo dõi', 'Bạn có chắc muốn xóa sạch toàn bộ lịch sử chuyến xe trong Sổ theo dõi?', () => {
        historyTrips.value = [];
        addToast('Đã làm trống Sổ theo dõi!', 'info');
    });
}

function updateTripOrderNo(trip: SplitTrip, newOrder: string) {
    trip.orderNo = newOrder.trim();
}

async function exportTrackingBookExcel() {
    if (historyTrips.value.length === 0) {
        addToast('Không có dữ liệu trong Sổ theo dõi để xuất file!', 'info');
        return;
    }

    const bargeName = selectedBargeInfo.value ? selectedBargeInfo.value.name : 'SA_LAN';
    const cleanBargeName = bargeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sổ theo dõi phân bổ');

    // Title Row
    sheet.mergeCells('A1:N1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `SỔ THEO DÕI CÁC PHIẾU CÂN SAU KHI PHÂN BỔ - SÀ LAN: ${bargeName.toUpperCase()}`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E1B4B' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 35;

    // Subtitle
    sheet.mergeCells('A2:N2');
    const subCell = sheet.getCell('A2');
    subCell.value = `Thời gian xuất: ${new Date().toLocaleString('vi-VN')} | Tổng số chuyến: ${historyTrips.value.length} | Tổng khối lượng: ${formatNumber(historyStats.value.totalKg)} kg (${historyStats.value.totalTons.toFixed(2)} Tấn)`;
    subCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(2).height = 20;

    sheet.addRow([]); // Blank row

    // Table Headers
    const headers = [
        'STT', 'Số phiếu', 'Mã lệnh', 'Số xe', 'Khách hàng', 'Loại hàng',
        'TL1 (kg)', 'TL2 (kg)', 'KL Hàng (kg)', 'Thời gian vào', 'Thời gian ra', 'Sà lan', 'Ghi chú', 'Phiếu nguồn'
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4338CA' } // Darker Indigo
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    // Data rows
    historyTrips.value.forEach((t, i) => {
        const timeIn = t.timeInStr ? `${t.timeInStr} ${t.dateInStr}` : t.dateInStr;
        const timeOut = t.timeOutStr ? `${t.timeOutStr} ${t.dateOutStr}` : t.dateOutStr;

        const row = sheet.addRow([
            i + 1,
            t.ticketNo,
            t.orderNo,
            t.plateNumber,
            t.customer,
            t.cargoType,
            t.weight1,
            t.weight2,
            t.weightNet,
            timeIn,
            timeOut,
            t.bargeName,
            t.notes,
            t.sourceTicketNo
        ]);

        row.getCell(7).numFmt = '#,##0';
        row.getCell(8).numFmt = '#,##0';
        row.getCell(9).numFmt = '#,##0';
        row.alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };
    });

    // Auto-fit column widths
    sheet.columns.forEach((col, idx) => {
        let maxLen = headers[idx] ? headers[idx].length : 10;
        col.width = Math.max(maxLen + 4, 12);
    });
    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 16;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 24;
    sheet.getColumn(10).width = 22;
    sheet.getColumn(11).width = 22;

    const buffer = await workbook.xlsx.writeBuffer();
    downloadExcel(buffer, `SO_THEO_DOI_PHAN_BO_${cleanBargeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    addToast('Đã xuất file Sổ theo dõi Excel thành công!', 'success');
}

// ----------------------------------------------------
// LIFECYCLE
// ----------------------------------------------------
onMounted(async () => {
    await loadPersistedData();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Top Action & Tab Navigation Bar -->
    <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-primary/10 shadow-soft">
      <!-- 3-Tab Navigator -->
      <div class="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
        <button
          @click="activeTab = 'tickets'"
          :class="[
            'flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all',
            activeTab === 'tickets' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          ]"
        >
          <span class="material-symbols-outlined text-base">receipt_long</span>
          1. Phiếu cân
          <span class="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-600 font-extrabold">{{ sourceTickets.length }}</span>
        </button>

        <button
          @click="activeTab = 'allocate'"
          :class="[
            'flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all',
            activeTab === 'allocate' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          ]"
        >
          <span class="material-symbols-outlined text-base">call_split</span>
          2. Phân bổ
          <span class="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-600 font-extrabold">{{ previewTrips.length }}</span>
        </button>

        <button
          @click="activeTab = 'history'"
          :class="[
            'flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all',
            activeTab === 'history' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          ]"
        >
          <span class="material-symbols-outlined text-base">menu_book</span>
          3. Sổ theo dõi
          <span class="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-600 font-extrabold">{{ historyTrips.length }}</span>
        </button>
      </div>

      <!-- Quick Action Buttons for Active Tab -->
      <div class="flex items-center gap-2 flex-wrap justify-end">
        <!-- Hidden File Input for Excel/CSV -->
        <input
          ref="fileInputRef"
          type="file"
          accept=".xlsx,.xls,.csv"
          class="hidden"
          @change="handleFileUpload"
        />

        <template v-if="activeTab === 'tickets'">
          <button
            @click="triggerFileInput"
            :disabled="loadingFile"
            class="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-base">{{ loadingFile ? 'sync' : 'upload_file' }}</span>
            <span>{{ loadingFile ? 'Đang đọc tệp...' : 'Import Excel / CSV' }}</span>
          </button>

          <button
            @click="openAddTicketModal"
            class="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
          >
            <span class="material-symbols-outlined text-base">add</span>
            <span>Thêm thủ công</span>
          </button>

          <button
            @click="exportSourceTicketsExcel"
            :disabled="sourceTickets.length === 0"
            class="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
          >
            <span class="material-symbols-outlined text-base">download</span>
            <span>Xuất Excel</span>
          </button>

          <button
            @click="clearAllSourceTickets"
            :disabled="sourceTickets.length === 0"
            class="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
          >
            <span class="material-symbols-outlined text-base">delete_sweep</span>
            <span>Xóa hết</span>
          </button>
        </template>

        <template v-else-if="activeTab === 'allocate'">
          <button
            @click="generateAllocatedTrips"
            class="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all"
          >
            <span class="material-symbols-outlined text-base">autorenew</span>
            <span>Tạo lại phân bổ</span>
          </button>

          <button
            @click="syncToSelectedBarge"
            :disabled="isSyncingBarge || previewTrips.length === 0 || !config.selectedBargeId"
            class="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-base">{{ isSyncingBarge ? 'sync' : 'directions_boat' }}</span>
            <span>{{ isSyncingBarge ? 'Đang nạp...' : 'Đồng bộ vào Sà lan' }}</span>
          </button>

          <button
            @click="saveToTrackingBook"
            :disabled="previewTrips.length === 0"
            class="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-base">save_as</span>
            <span>Lưu vào Sổ theo dõi</span>
          </button>
        </template>

        <template v-else-if="activeTab === 'history'">
          <button
            @click="exportTrackingBookExcel"
            :disabled="historyTrips.length === 0"
            class="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-base">file_download</span>
            <span>Xuất Excel Sổ theo dõi</span>
          </button>

          <button
            @click="clearAllHistory"
            :disabled="historyTrips.length === 0"
            class="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
          >
            <span class="material-symbols-outlined text-base">delete_forever</span>
            <span>Xóa sạch sổ</span>
          </button>
        </template>
      </div>
    </div>

    <!-- Main Workspace with 2 Columns: Content (Left) & Sidebar (Right) -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
      <!-- Left Column (3 Spans): Tab Content -->
      <div class="lg:col-span-3 space-y-6">
        <!-- ================= TAB 1: PHIẾU CÂN NGUỒN ================= -->
        <div v-if="activeTab === 'tickets'" class="space-y-4">
          <!-- Stats Summary Bar -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-white p-3.5 rounded-2xl border border-primary/10 shadow-soft flex items-center gap-3">
              <div class="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-lg">receipt</span>
              </div>
              <div>
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng số phiếu</p>
                <p class="text-lg font-black text-slate-800">{{ sourceStats.totalCount }}</p>
              </div>
            </div>

            <div class="bg-white p-3.5 rounded-2xl border border-primary/10 shadow-soft flex items-center gap-3">
              <div class="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-lg">scale</span>
              </div>
              <div>
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Khối lượng hàng</p>
                <p class="text-lg font-black text-emerald-600">{{ sourceStats.totalTons.toFixed(2) }} <span class="text-xs font-bold text-slate-500">Tấn</span></p>
              </div>
            </div>

            <div class="bg-white p-3.5 rounded-2xl border border-primary/10 shadow-soft flex items-center gap-3">
              <div class="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-lg">local_shipping</span>
              </div>
              <div>
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Số xe khác nhau</p>
                <p class="text-lg font-black text-slate-800">{{ sourceStats.uniquePlates }}</p>
              </div>
            </div>

            <div class="bg-white p-3.5 rounded-2xl border border-primary/10 shadow-soft flex items-center gap-3">
              <div class="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-lg">weight</span>
              </div>
              <div>
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng Kg hàng</p>
                <p class="text-sm font-black text-slate-800">{{ formatNumber(sourceStats.totalKg) }} kg</p>
              </div>
            </div>
          </div>

          <!-- Table Container -->
          <div class="bg-white rounded-2xl border border-primary/10 shadow-soft overflow-hidden">
            <!-- Table Header Toolbar -->
            <div class="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div class="relative w-full sm:w-72">
                <span class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                <input
                  v-model="ticketSearchQuery"
                  type="text"
                  placeholder="Tìm biển số xe, số phiếu, khách..."
                  class="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                />
              </div>

              <div class="text-xs text-slate-500 font-medium">
                Hiển thị <span class="font-bold text-slate-800">{{ filteredSourceTickets.length }}</span> / {{ sourceTickets.length }} phiếu
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="sourceTickets.length === 0" class="py-16 text-center text-slate-400">
              <div class="size-16 rounded-3xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-4">
                <span class="material-symbols-outlined text-3xl">upload_file</span>
              </div>
              <h3 class="text-base font-bold text-slate-700 mb-1">Chưa có dữ liệu phiếu cân</h3>
              <p class="text-xs max-w-md mx-auto text-slate-500 mb-4">
                Hãy bấm <strong>Import Excel / CSV</strong> hoặc <strong>Thêm thủ công</strong> để nạp các phiếu cân xe tải cần phân bổ.
              </p>
              <button
                @click="triggerFileInput"
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <span class="material-symbols-outlined text-base">upload</span>
                <span>Tải tệp ngay</span>
              </button>
            </div>

            <!-- Table of Tickets -->
            <div v-else class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider whitespace-nowrap">
                    <th class="py-3 px-3 text-center w-10">STT</th>
                    <th class="py-3 px-3">Số phiếu</th>
                    <th class="py-3 px-3">Mã lệnh</th>
                    <th class="py-3 px-3">Số xe</th>
                    <th class="py-3 px-3">Khách hàng</th>
                    <th class="py-3 px-3">Loại hàng</th>
                    <th class="py-3 px-3 text-right">TL1 (kg)</th>
                    <th class="py-3 px-3 text-right">TL2 (kg)</th>
                    <th class="py-3 px-3 text-right">KL Hàng (kg)</th>
                    <th class="py-3 px-3">Giờ vào</th>
                    <th class="py-3 px-3">Giờ ra</th>
                    <th class="py-3 px-3">Tài xế</th>
                    <th class="py-3 px-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr
                    v-for="(t, idx) in paginatedSourceTickets"
                    :key="t.id"
                    class="hover:bg-slate-50/80 transition-colors whitespace-nowrap"
                  >
                    <td class="py-2.5 px-3 text-center text-slate-400 font-medium">
                      {{ (ticketCurrentPage - 1) * ticketPageSize + idx + 1 }}
                    </td>
                    <td class="py-2.5 px-3 font-bold text-indigo-700">{{ t.ticketNo }}</td>
                    <td class="py-2.5 px-3 text-slate-600 font-medium">{{ t.orderNo || '-' }}</td>
                    <td class="py-2.5 px-3 font-black text-slate-800 tracking-wide">{{ t.plateNumber }}</td>
                    <td class="py-2.5 px-3 text-slate-700 max-w-[150px] truncate" :title="t.customer">{{ t.customer }}</td>
                    <td class="py-2.5 px-3 text-slate-600">{{ t.cargoType }}</td>
                    <td class="py-2.5 px-3 text-right text-slate-500">{{ formatNumber(t.weight1) }}</td>
                    <td class="py-2.5 px-3 text-right text-slate-500">{{ formatNumber(t.weight2) }}</td>
                    <td class="py-2.5 px-3 text-right font-black text-emerald-600">{{ formatNumber(t.weightNet) }}</td>
                    <td class="py-2.5 px-3 text-slate-500 text-[11px]">{{ t.timeInStr }} <span class="text-[10px] text-slate-400">{{ t.dateInStr }}</span></td>
                    <td class="py-2.5 px-3 text-slate-500 text-[11px]">{{ t.timeOutStr }} <span class="text-[10px] text-slate-400">{{ t.dateOutStr }}</span></td>
                    <td class="py-2.5 px-3 text-slate-500 truncate max-w-[100px]">{{ t.driver || '-' }}</td>
                    <td class="py-2.5 px-3 text-center">
                      <div class="flex items-center justify-center gap-1">
                        <button
                          @click="openEditTicketModal(t)"
                          class="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors"
                          title="Chỉnh sửa"
                        >
                          <span class="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button
                          @click="deleteTicket(t)"
                          class="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                          title="Xóa"
                        >
                          <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination Bar -->
            <div v-if="filteredSourceTickets.length > ticketPageSize" class="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div class="flex items-center gap-2">
                <span>Dòng/trang:</span>
                <select v-model.number="ticketPageSize" class="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs">
                  <option :value="10">10</option>
                  <option :value="20">20</option>
                  <option :value="50">50</option>
                  <option :value="100">100</option>
                </select>
              </div>

              <div class="flex items-center gap-1">
                <button
                  :disabled="ticketCurrentPage <= 1"
                  @click="ticketCurrentPage--"
                  class="p-1 rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-30"
                >
                  <span class="material-symbols-outlined text-base">chevron_left</span>
                </button>
                <span class="px-2 font-bold">{{ ticketCurrentPage }} / {{ totalSourcePages }}</span>
                <button
                  :disabled="ticketCurrentPage >= totalSourcePages"
                  @click="ticketCurrentPage++"
                  class="p-1 rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-30"
                >
                  <span class="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= TAB 2: XEM TRƯỚC PHÂN BỔ ================= -->
        <div v-else-if="activeTab === 'allocate'" class="space-y-4">
          <!-- Allocation Target & Stats Summary Banner -->
          <div class="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white p-5 rounded-2xl shadow-md">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                    Sà lan đích được chọn
                  </span>
                  <span v-if="selectedBargeInfo" class="text-xs text-indigo-200">({{ selectedBargeInfo.vesselName }})</span>
                </div>
                <h3 class="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  <span class="material-symbols-outlined text-amber-400">directions_boat</span>
                  {{ selectedBargeInfo ? selectedBargeInfo.name : 'Chưa chọn sà lan' }}
                </h3>
                <p class="text-xs text-indigo-200 mt-0.5">
                  Mã lệnh: <span class="font-bold text-amber-300">{{ config.customOrderNo || (selectedBargeInfo ? selectedBargeInfo.orderNo : 'Chưa đặt') }}</span>
                  • Chiến lược: <span class="font-semibold capitalize text-white">{{ config.distStrategy === 'even' ? 'Chia đều' : config.distStrategy === 'random' ? 'Ngẫu nhiên' : 'Tối đa tải' }}</span>
                  • Giãn cách: <span class="font-semibold text-white">{{ config.timeIntervalMinutes }} phút</span>
                </p>
              </div>

              <!-- Quick stats block -->
              <div class="flex items-center gap-6 bg-white/10 px-4 py-2.5 rounded-xl backdrop-blur-sm border border-white/10 shrink-0">
                <div>
                  <p class="text-[10px] uppercase font-bold text-indigo-200">Số chuyến sinh ra</p>
                  <p class="text-xl font-black text-amber-400">{{ previewStats.totalCount }}</p>
                </div>
                <div class="border-l border-white/20 pl-4">
                  <p class="text-[10px] uppercase font-bold text-indigo-200">Tổng KL phân bổ</p>
                  <p class="text-xl font-black text-emerald-400">{{ previewStats.totalTons.toFixed(2) }} <span class="text-xs font-normal text-white">Tấn</span></p>
                </div>
                <div class="border-l border-white/20 pl-4 hidden md:block">
                  <p class="text-[10px] uppercase font-bold text-indigo-200">Tải trọng TB</p>
                  <p class="text-base font-bold text-white">{{ previewStats.avgTons.toFixed(2) }} T/chuyến</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Preview Table -->
          <div class="bg-white rounded-2xl border border-primary/10 shadow-soft overflow-hidden">
            <div class="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div class="relative w-full sm:w-72">
                <span class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                <input
                  v-model="previewSearchQuery"
                  type="text"
                  placeholder="Tìm số phiếu, số xe, mã lệnh..."
                  class="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                />
              </div>

              <div class="flex items-center gap-2">
                <span class="text-xs text-slate-500 font-medium">
                  Hiển thị <span class="font-bold text-slate-800">{{ filteredPreviewTrips.length }}</span> chuyến xe
                </span>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="previewTrips.length === 0" class="py-16 text-center text-slate-400">
              <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">call_split</span>
              <p class="text-sm font-bold text-slate-600">Chưa có dữ liệu phân bổ</p>
              <p class="text-xs text-slate-400 mt-1">Hãy nạp phiếu cân ở Tab 1 hoặc bấm "Tạo lại phân bổ".</p>
            </div>

            <!-- Preview Table of Trips -->
            <div v-else class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider whitespace-nowrap">
                    <th class="py-3 px-3 text-center w-10">STT</th>
                    <th class="py-3 px-3">Số phiếu sinh</th>
                    <th class="py-3 px-3">Phiếu gốc</th>
                    <th class="py-3 px-3">Mã lệnh</th>
                    <th class="py-3 px-3">Số xe</th>
                    <th class="py-3 px-3 text-right">TL1 (kg)</th>
                    <th class="py-3 px-3 text-right">TL2 (kg)</th>
                    <th class="py-3 px-3 text-right">KL Hàng (kg)</th>
                    <th class="py-3 px-3 text-right">Tấn</th>
                    <th class="py-3 px-3">Giờ vào</th>
                    <th class="py-3 px-3">Giờ ra</th>
                    <th class="py-3 px-3">Sà lan</th>
                    <th class="py-3 px-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr
                    v-for="(t, idx) in paginatedPreviewTrips"
                    :key="t.id"
                    class="hover:bg-slate-50/80 transition-colors whitespace-nowrap"
                  >
                    <td class="py-2.5 px-3 text-center text-slate-400 font-medium">
                      {{ (previewCurrentPage - 1) * previewPageSize + idx + 1 }}
                    </td>
                    <td class="py-2.5 px-3 font-bold text-indigo-700">{{ t.ticketNo }}</td>
                    <td class="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{{ t.sourceTicketNo }}</td>
                    <td class="py-2.5 px-3 font-semibold text-amber-700">{{ t.orderNo || '-' }}</td>
                    <td class="py-2.5 px-3 font-black text-slate-800">{{ t.plateNumber }}</td>
                    <td class="py-2.5 px-3 text-right text-slate-500">{{ formatNumber(t.weight1) }}</td>
                    <td class="py-2.5 px-3 text-right text-slate-500">{{ formatNumber(t.weight2) }}</td>
                    <td class="py-2.5 px-3 text-right font-black text-emerald-600">{{ formatNumber(t.weightNet) }}</td>
                    <td class="py-2.5 px-3 text-right font-bold text-slate-700">{{ t.weightTons.toFixed(2) }}</td>
                    <td class="py-2.5 px-3 text-slate-500 text-[11px]">{{ t.timeInStr }} <span class="text-[10px] text-slate-400">{{ t.dateInStr }}</span></td>
                    <td class="py-2.5 px-3 text-slate-500 text-[11px]">{{ t.timeOutStr }} <span class="text-[10px] text-slate-400">{{ t.dateOutStr }}</span></td>
                    <td class="py-2.5 px-3 text-slate-700 font-medium">{{ t.bargeName }}</td>
                    <td class="py-2.5 px-3 text-slate-400 text-[11px]">{{ t.notes || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination Bar -->
            <div v-if="filteredPreviewTrips.length > previewPageSize" class="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div class="flex items-center gap-2">
                <span>Dòng/trang:</span>
                <select v-model.number="previewPageSize" class="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs">
                  <option :value="10">10</option>
                  <option :value="20">20</option>
                  <option :value="50">50</option>
                  <option :value="100">100</option>
                </select>
              </div>

              <div class="flex items-center gap-1">
                <button
                  :disabled="previewCurrentPage <= 1"
                  @click="previewCurrentPage--"
                  class="p-1 rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-30"
                >
                  <span class="material-symbols-outlined text-base">chevron_left</span>
                </button>
                <span class="px-2 font-bold">{{ previewCurrentPage }} / {{ totalPreviewPages }}</span>
                <button
                  :disabled="previewCurrentPage >= totalPreviewPages"
                  @click="previewCurrentPage++"
                  class="p-1 rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-30"
                >
                  <span class="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= TAB 3: SỔ THEO DÕI ================= -->
        <div v-else-if="activeTab === 'history'" class="space-y-4">
          <!-- Stats Summary Bar -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="bg-white p-3.5 rounded-2xl border border-primary/10 shadow-soft flex items-center gap-3">
              <div class="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-lg">menu_book</span>
              </div>
              <div>
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng chuyến đã lưu</p>
                <p class="text-lg font-black text-slate-800">{{ historyStats.totalCount }}</p>
              </div>
            </div>

            <div class="bg-white p-3.5 rounded-2xl border border-primary/10 shadow-soft flex items-center gap-3">
              <div class="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-lg">scale</span>
              </div>
              <div>
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Khối lượng tích lũy</p>
                <p class="text-lg font-black text-indigo-600">{{ historyStats.totalTons.toFixed(2) }} <span class="text-xs font-bold text-slate-500">Tấn</span></p>
              </div>
            </div>

            <div class="bg-white p-3.5 rounded-2xl border border-primary/10 shadow-soft flex items-center gap-3">
              <div class="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-lg">weight</span>
              </div>
              <div>
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng Kilogram</p>
                <p class="text-base font-black text-slate-800">{{ formatNumber(historyStats.totalKg) }} kg</p>
              </div>
            </div>
          </div>

          <!-- History Table -->
          <div class="bg-white rounded-2xl border border-primary/10 shadow-soft overflow-hidden">
            <div class="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div class="relative w-full sm:w-72">
                <span class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                <input
                  v-model="historySearchQuery"
                  type="text"
                  placeholder="Tìm biển số xe, số phiếu, sà lan..."
                  class="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                />
              </div>

              <div class="text-xs text-slate-500 font-medium">
                Hiển thị <span class="font-bold text-slate-800">{{ filteredHistoryTrips.length }}</span> / {{ historyTrips.length }} dòng
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="historyTrips.length === 0" class="py-16 text-center text-slate-400">
              <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">auto_stories</span>
              <p class="text-sm font-bold text-slate-600">Sổ theo dõi hiện đang trống</p>
              <p class="text-xs text-slate-400 mt-1">
                Sau khi phân bổ ở Tab 2, bấm <strong>Lưu vào Sổ theo dõi</strong> để ghi nhận tại đây.
              </p>
            </div>

            <!-- History Table of Trips (14 standard columns) -->
            <div v-else class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider whitespace-nowrap">
                    <th class="py-3 px-3 text-center w-10">STT</th>
                    <th class="py-3 px-3">Số phiếu</th>
                    <th class="py-3 px-3">Mã lệnh</th>
                    <th class="py-3 px-3">Số xe</th>
                    <th class="py-3 px-3">Khách hàng</th>
                    <th class="py-3 px-3">Loại hàng</th>
                    <th class="py-3 px-3 text-right">TL1 (kg)</th>
                    <th class="py-3 px-3 text-right">TL2 (kg)</th>
                    <th class="py-3 px-3 text-right">KL Hàng (kg)</th>
                    <th class="py-3 px-3">Thời gian vào</th>
                    <th class="py-3 px-3">Thời gian ra</th>
                    <th class="py-3 px-3">Sà lan</th>
                    <th class="py-3 px-3">Ghi chú</th>
                    <th class="py-3 px-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr
                    v-for="(t, idx) in paginatedHistoryTrips"
                    :key="t.id"
                    class="hover:bg-slate-50/80 transition-colors whitespace-nowrap"
                  >
                    <td class="py-2.5 px-3 text-center text-slate-400 font-medium">
                      {{ (historyCurrentPage - 1) * historyPageSize + idx + 1 }}
                    </td>
                    <td class="py-2.5 px-3 font-bold text-indigo-700">{{ t.ticketNo }}</td>
                    <td class="py-2.5 px-3">
                      <input
                        type="text"
                        :value="t.orderNo"
                        @change="updateTripOrderNo(t, ($event.target as HTMLInputElement).value)"
                        class="w-24 px-1.5 py-0.5 text-xs bg-slate-50 border border-slate-200 rounded font-semibold text-amber-700 focus:bg-white focus:outline-none focus:border-indigo-500"
                        title="Sửa nhanh mã lệnh"
                      />
                    </td>
                    <td class="py-2.5 px-3 font-black text-slate-800">{{ t.plateNumber }}</td>
                    <td class="py-2.5 px-3 text-slate-700 max-w-[130px] truncate" :title="t.customer">{{ t.customer }}</td>
                    <td class="py-2.5 px-3 text-slate-600">{{ t.cargoType }}</td>
                    <td class="py-2.5 px-3 text-right text-slate-500">{{ formatNumber(t.weight1) }}</td>
                    <td class="py-2.5 px-3 text-right text-slate-500">{{ formatNumber(t.weight2) }}</td>
                    <td class="py-2.5 px-3 text-right font-black text-emerald-600">{{ formatNumber(t.weightNet) }}</td>
                    <td class="py-2.5 px-3 text-slate-500 text-[11px]">{{ t.timeInStr }} <span class="text-[10px] text-slate-400">{{ t.dateInStr }}</span></td>
                    <td class="py-2.5 px-3 text-slate-500 text-[11px]">{{ t.timeOutStr }} <span class="text-[10px] text-slate-400">{{ t.dateOutStr }}</span></td>
                    <td class="py-2.5 px-3 text-slate-700 font-medium">{{ t.bargeName }}</td>
                    <td class="py-2.5 px-3 text-slate-400 text-[11px] max-w-[100px] truncate">{{ t.notes || '-' }}</td>
                    <td class="py-2.5 px-3 text-center">
                      <button
                        @click="deleteHistoryTrip(t)"
                        class="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                        title="Xóa dòng này"
                      >
                        <span class="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination Bar -->
            <div v-if="filteredHistoryTrips.length > historyPageSize" class="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div class="flex items-center gap-2">
                <span>Dòng/trang:</span>
                <select v-model.number="historyPageSize" class="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs">
                  <option :value="10">10</option>
                  <option :value="20">20</option>
                  <option :value="50">50</option>
                  <option :value="100">100</option>
                </select>
              </div>

              <div class="flex items-center gap-1">
                <button
                  :disabled="historyCurrentPage <= 1"
                  @click="historyCurrentPage--"
                  class="p-1 rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-30"
                >
                  <span class="material-symbols-outlined text-base">chevron_left</span>
                </button>
                <span class="px-2 font-bold">{{ historyCurrentPage }} / {{ totalHistoryPages }}</span>
                <button
                  :disabled="historyCurrentPage >= totalHistoryPages"
                  @click="historyCurrentPage++"
                  class="p-1 rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-30"
                >
                  <span class="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column (1 Span): Allocation Configuration Sidebar -->
      <div class="space-y-4 bg-white p-5 rounded-2xl border border-primary/10 shadow-soft">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 class="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-indigo-600 text-base">tune</span>
            Cấu hình phân bổ
          </h4>
        </div>

        <!-- 1. Target Barge Selector -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
            <span>Sà lan đích</span>
            <span class="text-[10px] text-indigo-600 font-extrabold">{{ allBarges.length }} sà lan</span>
          </label>
          <select
            v-model="config.selectedBargeId"
            class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all cursor-pointer"
          >
            <option :value="null" disabled>-- Chọn một sà lan đích --</option>
            <option
              v-for="b in allBarges"
              :key="b.id"
              :value="b.id"
            >
              {{ b.name }} ({{ b.vesselName }})
            </option>
          </select>
        </div>

        <!-- 2. Custom Order No -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Mã lệnh phân bổ
          </label>
          <input
            v-model="config.customOrderNo"
            type="text"
            placeholder="VD: L-01, 1025..."
            class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
          />
        </div>

        <!-- 3. Time Interval Between Trips -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
            <span>Khoảng cách thời gian</span>
            <span class="text-xs font-bold text-indigo-600">{{ config.timeIntervalMinutes }} phút</span>
          </label>
          <input
            v-model.number="config.timeIntervalMinutes"
            type="range"
            min="3"
            max="60"
            step="1"
            class="w-full accent-indigo-600 cursor-pointer"
          />
          <div class="flex justify-between text-[10px] text-slate-400 font-medium">
            <span>3 phút</span>
            <span>30 phút</span>
            <span>60 phút</span>
          </div>
        </div>

        <!-- 4. Weight Distribution Strategy -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Chiến lược chia tải
          </label>
          <select
            v-model="config.distStrategy"
            class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all cursor-pointer"
          >
            <option value="even">Chia đều (Cân bằng tải các chuyến)</option>
            <option value="random">Ngẫu nhiên (Biên độ tự nhiên)</option>
            <option value="max">Tối đa tải trọng (Dồn các xe đầu)</option>
          </select>
        </div>

        <!-- 5. Time Spacing Strategy -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Định thời gian ra / vào
          </label>
          <select
            v-model="config.spacingStrategy"
            class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all cursor-pointer"
          >
            <option value="forward">Tịnh tiến (+ Phút từ giờ vào)</option>
            <option value="backward">Lùi dần (- Phút từ giờ ra)</option>
            <option value="even">Phân đều toàn ca làm việc</option>
          </select>
        </div>

        <!-- 6. Default Vehicle Limit -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
            <span>Tải trọng xe định mức (Tấn)</span>
            <span class="text-xs font-bold text-indigo-600">{{ config.defaultLimit }} Tấn</span>
          </label>
          <input
            v-model.number="config.defaultLimit"
            type="number"
            min="5"
            max="60"
            step="0.5"
            class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
          />
          <p class="text-[10px] text-slate-400">Áp dụng cho các xe chưa có định mức riêng.</p>
        </div>

        <!-- 7. Ticket Number Generation Config -->
        <div class="border-t border-slate-100 pt-3 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Tự sinh số phiếu</span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="config.useAutoTicketNo" class="sr-only peer" />
              <div class="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div v-if="config.useAutoTicketNo" class="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <span class="text-[10px] font-bold text-slate-500">Tiền tố:</span>
                <input
                  v-model="config.ticketPrefix"
                  type="text"
                  placeholder="VD: C-"
                  class="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded"
                />
              </div>
              <div>
                <span class="text-[10px] font-bold text-slate-500">Số bắt đầu:</span>
                <input
                  v-model.number="config.ticketStart"
                  type="number"
                  min="1"
                  class="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <span class="text-[10px] font-bold text-slate-500">Độ dài số:</span>
                <input
                  v-model.number="config.ticketPadding"
                  type="number"
                  min="1"
                  max="10"
                  class="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded"
                />
              </div>
              <div>
                <span class="text-[10px] font-bold text-slate-500">Hậu tố:</span>
                <input
                  v-model="config.ticketSuffix"
                  type="text"
                  placeholder="/mmyy"
                  class="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded"
                />
              </div>
            </div>

            <div class="text-[11px] text-slate-500 pt-1">
              Mẫu xem trước: <strong class="text-indigo-700 font-mono">{{ previewNextTicketNo }}</strong>
            </div>
          </div>
        </div>

        <!-- 8. Specific Vehicle Limits List (Expandable) -->
        <div class="border-t border-slate-100 pt-3 space-y-2">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
            <span>Định mức từng xe</span>
            <span class="text-[10px] text-slate-400 font-semibold">{{ vehiclesList.length }} xe trong danh mục</span>
          </label>

          <input
            v-model="vehicleSearchQuery"
            type="text"
            placeholder="Lọc xe..."
            class="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
          />

          <div class="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg text-xs">
            <div
              v-for="v in filteredVehiclesList.slice(0, 15)"
              :key="v.plateNumber"
              class="p-2 flex items-center justify-between hover:bg-slate-50"
            >
              <div>
                <p class="font-bold text-slate-800">{{ v.plateNumber }}</p>
                <p v-if="v.moocNumber" class="text-[10px] text-slate-400">Mooc: {{ v.moocNumber }}</p>
              </div>
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  step="0.5"
                  :value="config.vehicleLimits[normalizePlate(v.plateNumber)] || config.defaultLimit"
                  @change="updateVehicleLimit(v.plateNumber, parseFloat(($event.target as HTMLInputElement).value) || config.defaultLimit)"
                  class="w-16 px-1.5 py-0.5 text-right text-xs bg-white border border-slate-200 rounded font-bold text-indigo-700"
                />
                <span class="text-[10px] text-slate-400 font-medium">T</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ================= MODAL THÊM / SỬA PHIẾU CÂN ================= -->
    <div
      v-if="showTicketModal"
      class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      @click.self="showTicketModal = false"
    >
      <div class="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 space-y-4 text-xs font-display">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 class="text-sm font-black text-slate-800 flex items-center gap-2">
            <span class="material-symbols-outlined text-indigo-600">edit_note</span>
            {{ isEditingTicket ? 'Chỉnh sửa phiếu cân' : 'Thêm phiếu cân mới' }}
          </h3>
          <button @click="showTicketModal = false" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Số phiếu</label>
            <input v-model="editingTicket.ticketNo" type="text" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mã lệnh</label>
            <input v-model="editingTicket.orderNo" type="text" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-amber-700" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Biển số xe *</label>
            <input v-model="editingTicket.plateNumber" type="text" placeholder="VD: 51C-12345" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tài xế</label>
            <input v-model="editingTicket.driver" type="text" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Khách hàng</label>
            <input v-model="editingTicket.customer" type="text" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Loại hàng</label>
            <input v-model="editingTicket.cargoType" type="text" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl" />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">TL1 (kg)</label>
            <input v-model.number="editingTicket.weight1" type="number" class="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">TL2 (kg)</label>
            <input v-model.number="editingTicket.weight2" type="number" class="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">KL Hàng (kg)</label>
            <input v-model.number="editingTicket.weightNet" type="number" class="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-black text-emerald-600" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Giờ vào</label>
            <div class="grid grid-cols-2 gap-1">
              <input v-model="editingTicket.timeInStr" type="text" placeholder="HH:mm:ss" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
              <input v-model="editingTicket.dateInStr" type="text" placeholder="DD/MM/YYYY" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
            </div>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Giờ ra</label>
            <div class="grid grid-cols-2 gap-1">
              <input v-model="editingTicket.timeOutStr" type="text" placeholder="HH:mm:ss" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
              <input v-model="editingTicket.dateOutStr" type="text" placeholder="DD/MM/YYYY" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button @click="showTicketModal = false" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all">
            Hủy
          </button>
          <button @click="saveTicketModal" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-sm">
            Lưu phiếu cân
          </button>
        </div>
      </div>
    </div>

    <!-- ================= CONFIRM DIALOG ================= -->
    <div
      v-if="confirmDialog.show"
      class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      @click.self="confirmDialog.show = false"
    >
      <div class="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 space-y-4 text-xs font-display">
        <div class="flex items-center gap-3">
          <div :class="[
            'size-10 rounded-2xl flex items-center justify-center shrink-0',
            confirmDialog.type === 'danger' ? 'bg-rose-50 text-rose-600' : confirmDialog.type === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
          ]">
            <span class="material-symbols-outlined text-xl">
              {{ confirmDialog.type === 'danger' ? 'warning' : confirmDialog.type === 'warning' ? 'help' : 'info' }}
            </span>
          </div>
          <div>
            <h4 class="text-sm font-black text-slate-800">{{ confirmDialog.title }}</h4>
            <p class="text-slate-500 mt-0.5 leading-relaxed">{{ confirmDialog.message }}</p>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button @click="confirmDialog.show = false" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all">
            Hủy
          </button>
          <button
            @click="confirmDialog.onOk"
            :class="[
              'px-4 py-2 rounded-xl font-bold text-white transition-all shadow-sm',
              confirmDialog.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : confirmDialog.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
            ]"
          >
            {{ confirmDialog.okText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { authStore, canCreate, canUpdate, canDelete, hasDetailPermission } from '@/stores/auth';
import { supabase } from '@/supabase';
import { excelService } from '@/services/excel/ExcelService';
import { dbContext } from '@/services/storage/DBContext';
import { WeighbridgeService, type Vessel, type Barge, type Truck, type BargeConfig, type CustomFieldConfig, type PrintElement, type WeighbridgeMasterData, type WeighbridgeStandardTemplate, DEFAULT_MASTER_DATA } from '@/services/excel/WeighbridgeService';
import { LogService } from '@/services/storage/LogService';
const props = withDefaults(defineProps<{
    hideCard?: boolean;
}>(), {
    hideCard: false
});

// Fullscreen state
const isOpen = ref(false);
const activeTab = ref<'data' | 'config' | 'goods'>('data');

// Global goods list state & sync channel
const globalGoodsList = ref<string[]>([]);
const syncChannel = new BroadcastChannel('allocator_sync_channel');
syncChannel.onmessage = async (event) => {
    try {
        if (event.data.type === 'goods') {
            const saved = await dbContext.get<string[]>('allocator_goods');
            if (saved && Array.isArray(saved)) {
                globalGoodsList.value = saved;
            }
        } else if (event.data.type === 'manual_sync_request') {
            await autoSyncAllBarges(true);
        } else if (event.data.type === 'tickets') {
            await autoSyncAllBarges(false);
            await loadVessels();
        }
    } catch (e) {
        console.error('Lỗi khi đồng bộ qua in phiếu cân:', e);
    }
};

async function loadGlobalGoods() {
    try {
        // Load from DB first
        const saved = await dbContext.get<string[]>('allocator_goods');
        if (saved && Array.isArray(saved)) {
            globalGoodsList.value = saved;
        }
        
        // Fetch from Supabase
        const { data, error } = await supabase
            .from('content')
            .select('settings')
            .eq('id', 'main')
            .single();
        if (error) throw error;
        
        if (data?.settings && Array.isArray(data.settings.allocator_goods)) {
            globalGoodsList.value = data.settings.allocator_goods;
            await dbContext.set('allocator_goods', data.settings.allocator_goods);
        }
    } catch (e) {
        console.warn('Lỗi khi tải danh mục hàng hóa toàn cục:', e);
    }
}

watch(() => props.hideCard, (newVal) => {
    if (newVal) {
        isOpen.value = true;
    }
}, { immediate: true });

watch(() => authStore.role, (newRole) => {
    if (newRole !== 'admin') {
        activeTab.value = 'data';
    }
});


// Form default layout helper
const getDefaultPrintFields = (): CustomFieldConfig[] => [
    { id: 'plateNumber', label: 'Số xe', visible: true, column: 'left', order: 1 },
    { id: 'goods', label: 'Hàng hóa', visible: true, column: 'left', order: 2 },
    { id: 'owner', label: 'Tên chủ hàng', visible: true, column: 'left', order: 3 },
    { id: 'weight1', label: 'Trọng lượng lần 1', visible: true, column: 'left', order: 4 },
    { id: 'weight2', label: 'Trọng lượng lần 2', visible: true, column: 'left', order: 5 },
    { id: 'weightNet', label: 'Trọng lượng hàng', visible: true, column: 'left', order: 6 },
    { id: 'words', label: 'Bằng chữ', visible: true, column: 'left', order: 7 },
    { id: 'barge', label: 'Sà lan', visible: true, column: 'left', order: 8 },
    { id: 'note', label: 'Ghi chú', visible: true, column: 'left', order: 9 },
    
    { id: 'driver', label: 'Tài xế', visible: true, column: 'right', order: 1 },
    { id: 'goodsCode', label: 'Mã hàng', visible: true, column: 'right', order: 2 },
    { id: 'xn', label: 'X/N', visible: true, column: 'right', order: 3 },
    { id: 'chinhpham', label: '*Chính phẩm', visible: true, column: 'right', order: 4 },
    { id: 'phupham', label: '*Phụ phẩm', visible: true, column: 'right', order: 5 },
    { id: 'ketluan', label: 'Kết luận', visible: true, column: 'right', order: 6 }
];

const getDefaultPrintElements = (): PrintElement[] => [
    { id: 'companyName', type: 'text', x: 9, y: 18, width: 140, height: 5, text: 'CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG NGUYÊN NGỌC', fontSize: 13, fontWeight: 'bold' },
    { id: 'companyAddress', type: 'text', x: 9, y: 25, width: 150, height: 4, text: 'Địa chỉ: Số 167, tổ 78, Đường Đê Bao, Khu phố 9, Phường Phú An, TP. Hồ Chí Minh, Việt Nam', fontSize: 10, fontWeight: 'normal' },
    { id: 'companyPhone', type: 'text', x: 9, y: 30.5, width: 140, height: 4, text: 'ĐT: 0964 258 671 / Fax:', fontSize: 10, fontWeight: 'normal' },
    { id: 'ticketNo', type: 'field', x: 145.5, y: 34.5, width: 45, height: 5, label: 'Phiếu số', fieldId: 'ticketNo', labelWidth: 15, fontSize: 10, fontWeight: 'normal' },
    { id: 'title', type: 'text', x: 0, y: 38, width: 198.5, height: 9.5, text: 'PHIẾU CÂN XE', fontSize: 24, fontWeight: 'bold', align: 'center' },
    { id: 'dateIn', type: 'field', x: 60, y: 49, width: 75, height: 4, label: 'Ngày, giờ vào', fieldId: 'dateIn', labelWidth: 24, fontSize: 10, fontWeight: 'normal' },
    { id: 'dateOut', type: 'field', x: 60, y: 54.5, width: 75, height: 4, label: 'Ngày, giờ ra', fieldId: 'dateOut', labelWidth: 24, fontSize: 10, fontWeight: 'normal' },
    
    // Left Column Fields
    { id: 'plateNumber', type: 'field', x: 9, y: 61.5, width: 85, height: 5, label: 'Số xe', fieldId: 'plateNumber', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'goods', type: 'field', x: 9, y: 66.5, width: 85, height: 5, label: 'Hàng hóa', fieldId: 'goods', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'owner', type: 'field', x: 9, y: 73, width: 100.5, height: 5, label: 'Tên chủ hàng', fieldId: 'owner', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'weight1', type: 'field', x: 9, y: 79, width: 85, height: 5, label: 'Trọng lượng lần 1', fieldId: 'weight1', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'weight2', type: 'field', x: 9, y: 85.5, width: 85, height: 5, label: 'Trọng lượng lần 2', fieldId: 'weight2', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'weightNet', type: 'field', x: 9, y: 92.5, width: 85, height: 5, label: 'Trọng lượng hàng', fieldId: 'weightNet', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'words', type: 'field', x: 9, y: 97.5, width: 100, height: 8.5, label: 'Bằng chữ', fieldId: 'words', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'barge', type: 'field', x: 9, y: 106, width: 85, height: 5, label: 'Sà lan', fieldId: 'barge', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    
    // Right Column Fields
    { id: 'driver', type: 'field', x: 80.5, y: 61.5, width: 85, height: 5, label: 'Tài xế', fieldId: 'driver', labelWidth: 11, fontSize: 10, fontWeight: 'normal' },
    { id: 'goodsCode', type: 'field', x: 114.5, y: 66.5, width: 85, height: 5, label: 'Mã hàng', fieldId: 'goodsCode', labelWidth: 15.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'xn', type: 'field', x: 114.5, y: 73, width: 85, height: 5, label: 'X/N', fieldId: 'xn', labelWidth: 15.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'qualityHeader', type: 'text', x: 114.5, y: 79, width: 85, height: 4, text: 'ĐÁNH GIÁ CHẤT LƯỢNG HÀNG HÓA', fontSize: 10, fontWeight: 'normal' },
    { id: 'chinhpham', type: 'field', x: 114.5, y: 85.5, width: 85, height: 5, label: '*Chính phẩm', fieldId: 'chinhpham', labelWidth: 24, fontSize: 10, fontWeight: 'normal' },
    { id: 'phupham', type: 'field', x: 114.5, y: 91.5, width: 85, height: 5, label: '*Phụ phẩm', fieldId: 'phupham', labelWidth: 24, fontSize: 10, fontWeight: 'normal' },
    { id: 'ketluan', type: 'field', x: 116, y: 97.5, width: 85, height: 11.5, label: 'Kết luận', fieldId: 'ketluan', labelWidth: 22.5, fontSize: 10, fontWeight: 'normal' },
    
    // Note Field
    { id: 'field_note_1782290495031', type: 'field', x: 9, y: 111, width: 80, height: 5, label: 'Ghi chú', fieldId: 'note', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },

    // Footer
    { id: 'sig1', type: 'text', x: 18.5, y: 118, width: 30, height: 4, text: 'NV TRẠM CÂN', align: 'center', fontSize: 10, fontWeight: 'bold' },
    { id: 'sig1_name', type: 'field', x: 18.5, y: 133, width: 30, height: 4, label: '', fieldId: 'operator', align: 'center', fontSize: 10, fontWeight: 'bold' },
    { id: 'sig2', type: 'text', x: 60, y: 118, width: 25, height: 4, text: 'BẢO VỆ', align: 'center', fontSize: 10, fontWeight: 'bold' },
    { id: 'sig3', type: 'text', x: 86, y: 118, width: 25, height: 4, text: 'CHỦ HÀNG', align: 'center', fontSize: 10, fontWeight: 'bold' },
    { id: 'sig4', type: 'text', x: 116, y: 118, width: 25, height: 4, text: 'THỦ KHO', align: 'center', fontSize: 10, fontWeight: 'bold' },
    { id: 'sig5', type: 'text', x: 141, y: 118, width: 20, height: 4, text: 'TÀI XẾ', align: 'center', fontSize: 10, fontWeight: 'bold' }
];

// Core state
const vessels = ref<Vessel[]>([]);
const activeVesselId = ref<number | null>(null);
const activeBargeId = ref<number | null>(null);
const trucks = ref<Truck[]>([]);
const loading = ref(false);
const saving = ref(false);
const isOnline = ref(navigator.onLine);
const updateOnlineStatus = () => {
    isOnline.value = navigator.onLine;
};


// Filters and sorting state
const vesselFilterMonth = ref<string>('');
const bargeSearchQuery = ref<string>('');
const searchQuery = ref<string>('');
const globalBargeSearchQuery = ref<string>('');
const globalFilterType = ref<string>('');
const globalFilterStartDate = ref<string>('');
const globalFilterEndDate = ref<string>('');
const globalFilterMonth = ref<string>('');
const globalFilterVesselStatus = ref<string>('');
const globalBargesSummary = ref<BargeSummary[]>([]);
const loadingGlobalSummary = ref(false);
const exportingGlobalBarges = ref(false);
const exportingActiveBargeTrucks = ref(false);
const sortKey = ref<string>('');
const sortOrder = ref<'asc' | 'desc'>('asc');
const selectedVesselStatusTab = ref<'in_progress' | 'done'>('in_progress');
const isUpdatingVesselStatus = ref(false);

// UI elements and modals
const expandedVesselIds = ref<Record<number, boolean>>({});
const showMappingModal = ref(false);
const showTruckDialog = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

// Master Data & Global Standard Weigh Ticket Template
const masterData = ref<WeighbridgeMasterData>(DEFAULT_MASTER_DATA);
const globalTemplate = ref<WeighbridgeStandardTemplate>({
    printFields: getDefaultPrintFields(),
    printElements: getDefaultPrintElements(),
    companyName: 'CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG NGUYÊN NGỌC',
    companyAddress: 'Địa chỉ: Số 167, tổ 78, Đường Đê Bao, Khu phố 9, Phường Phú An, TP. Hồ Chí Minh, Việt Nam',
    companyPhone: 'ĐT: 0964 258 671 / Fax:',
    ticketTitle: 'PHIẾU CÂN XE',
    signatures: ['NV TRẠM CÂN', 'BẢO VỆ', 'CHỦ HÀNG', 'THỦ KHO', 'TÀI XẾ'],
    updatedAt: Date.now()
});
const showMasterDataModal = ref(false);
const showGlobalTemplateModal = ref(false);
const masterDataTab = ref<'customers' | 'goods'>('customers');
const newCustomerInput = ref('');
const newGoodsName = ref('');
const newGoodsCode = ref('');

// Vessel Modal state (Form tạo / sửa Nguồn tàu kèm Master Data)
const showVesselModal = ref(false);
const vesselForm = reactive({
    id: 0,
    isEdit: false,
    name: '',
    customer: '',
    cargo_type: '',
    cargo_code: '',
    customCustomer: false,
    customGoods: false
});

// Toast state
const toastMessage = ref<string | null>(null);
const toastType = ref<'success' | 'error' | 'warning'>('success');
let toastTimer: any = null;

const showToast = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    toastMessage.value = msg;
    toastType.value = type;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastMessage.value = null;
    }, 3000);
};

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

// Unified Barge dialog state
interface BargeDialogState {
    show: boolean;
    title: string;
    bargeName: string;
    orderNo: string;
    resolve?: (result: { name: string; orderNo: string } | null) => void;
}

const bargeDialog = ref<BargeDialogState>({
    show: false,
    title: '',
    bargeName: '',
    orderNo: ''
});

const bargeNameInputRef = ref<HTMLInputElement | null>(null);

function showBargeDialog(title: string, defaultName: string = '', defaultOrderNo: string = ''): Promise<{ name: string; orderNo: string } | null> {
    return new Promise((resolve) => {
        bargeDialog.value = {
            show: true,
            title,
            bargeName: defaultName,
            orderNo: defaultOrderNo,
            resolve
        };
        nextTick(() => {
            bargeNameInputRef.value?.focus();
            if (bargeNameInputRef.value) {
                bargeNameInputRef.value.select();
            }
        });
    });
}

function handleBargeOk() {
    if (!bargeDialog.value.bargeName.trim()) {
        showToast('Vui lòng nhập tên sà lan!', 'error');
        return;
    }
    if (bargeDialog.value.resolve) {
        bargeDialog.value.resolve({
            name: bargeDialog.value.bargeName.trim(),
            orderNo: bargeDialog.value.orderNo.trim()
        });
    }
    bargeDialog.value.show = false;
}

function handleBargeCancel() {
    if (bargeDialog.value.resolve) {
        bargeDialog.value.resolve(null);
    }
    bargeDialog.value.show = false;
}

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

// Excel Upload pending data
interface ExcelColumn {
    index: number;
    name: string;
}

type ExcelField = 'ticketNo' | 'plateNumber' | 'driver' | 'weight1' | 'weight2' | 'weightNet' | 'dateIn' | 'dateOut' | 'note';

interface PendingExcel {
    rawRows: any[][];
    headerIndex: number;
    columns: ExcelColumn[];
    mapping: Record<ExcelField, number>;
}

const pendingExcelData = ref<PendingExcel | null>(null);

interface FieldInfo {
    id: ExcelField;
    label: string;
    required: boolean;
}

const mappingFields: FieldInfo[] = [
    { id: 'ticketNo', label: 'Số phiếu (tự chọn)', required: false },
    { id: 'plateNumber', label: 'Biển số xe / Số xe *', required: true },
    { id: 'driver', label: 'Tên tài xế', required: false },
    { id: 'weight1', label: 'Trọng lượng lần 1 (kg) *', required: true },
    { id: 'weight2', label: 'Trọng lượng lần 2 (kg) *', required: true },
    { id: 'weightNet', label: 'Trọng lượng hàng (Net) (kg)', required: false },
    { id: 'dateIn', label: 'Ngày giờ vào', required: false },
    { id: 'dateOut', label: 'Ngày giờ ra', required: false },
    { id: 'note', label: 'Ghi chú', required: false }
];

// Forms and inputs
const cfgForm = reactive<BargeConfig>({
    goods: '',
    goodsCode: '',
    owner: '',
    operator: '',
    xn: 'XUẤT KHẨU',
    ticketPrefix: 'PC-',
    ticketSeed: 1,
    chinhpham: '------------',
    phupham: '------------',
    ketluan: '[ ] Đạt\n[ ] Không đạt',
    locked: false,
    orderNo: '',
    printFields: getDefaultPrintFields(),
    printElements: getDefaultPrintElements(),
    companyName: 'CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG NGUYÊN NGỌC',
    companyAddress: 'Địa chỉ: Số 167, tổ 78, Đường Đê Bao, Khu phố 9, Phường Phú An, TP. Hồ Chí Minh, Việt Nam',
    companyPhone: 'ĐT: 0964 258 671 / Fax:',
    ticketTitle: 'PHIẾU CÂN XE',
    signatures: ['NV TRẠM CÂN', 'BẢO VỆ', 'CHỦ HÀNG', 'THỦ KHO', 'TÀI XẾ'],
    goodsList: []
});



const dialogTruck = reactive({
    id: 0,
    ticketNo: '',
    plateNumber: '',
    driver: '',
    weight1: 0,
    weight2: 0,
    weightNet: 0,
    dateIn: '',
    dateOut: '',
    note: ''
});

// Split date/time computed for 24h time input
const dialogDateInDate = computed({
    get: () => dialogTruck.dateIn?.includes('T') ? dialogTruck.dateIn.split('T')[0] : dialogTruck.dateIn || '',
    set: (v: string) => { dialogTruck.dateIn = v ? `${v}T${dialogTimeInTime.value || '00:00'}` : ''; }
});
const dialogTimeInTime = computed({
    get: () => dialogTruck.dateIn?.includes('T') ? dialogTruck.dateIn.split('T')[1]?.substring(0, 5) || '' : '',
    set: (v: string) => { if (dialogDateInDate.value) dialogTruck.dateIn = `${dialogDateInDate.value}T${v || '00:00'}`; }
});
const dialogDateOutDate = computed({
    get: () => dialogTruck.dateOut?.includes('T') ? dialogTruck.dateOut.split('T')[0] : dialogTruck.dateOut || '',
    set: (v: string) => { dialogTruck.dateOut = v ? `${v}T${dialogTimeOutTime.value || '00:00'}` : ''; }
});
const dialogTimeOutTime = computed({
    get: () => dialogTruck.dateOut?.includes('T') ? dialogTruck.dateOut.split('T')[1]?.substring(0, 5) || '' : '',
    set: (v: string) => { if (dialogDateOutDate.value) dialogTruck.dateOut = `${dialogDateOutDate.value}T${v || '00:00'}`; }
});

// Helper for flexible 24h time text input (HH:mm)
const cleanTimeString = (inputStr: string): string => {
    if (!inputStr) return '';
    const str = inputStr.trim();
    if (str.includes(':')) {
        const parts = str.split(':');
        let h = parseInt(parts[0] || '0', 10);
        let m = parseInt(parts[1] || '0', 10);
        if (isNaN(h)) h = 0;
        if (isNaN(m)) m = 0;
        if (h > 23) h = 23;
        if (m > 59) m = 59;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    const digits = str.replace(/[^\d]/g, '');
    if (!digits) return '';

    let hours = 0;
    let minutes = 0;

    if (digits.length <= 2) {
        hours = parseInt(digits, 10);
        minutes = 0;
    } else if (digits.length === 3) {
        hours = parseInt(digits.slice(0, 1), 10);
        minutes = parseInt(digits.slice(1, 3), 10);
    } else {
        hours = parseInt(digits.slice(0, 2), 10);
        minutes = parseInt(digits.slice(2, 4), 10);
    }

    if (isNaN(hours) || hours > 23) hours = hours > 23 ? 23 : 0;
    if (isNaN(minutes) || minutes > 59) minutes = minutes > 59 ? 59 : 0;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const onTimeInput = (event: Event, field: 'in' | 'out') => {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/[^\d:]/g, '');
    
    // Auto insert colon if 4 digits typed without colon (e.g. 1939 -> 19:39)
    if (/^\d{4}$/.test(val)) {
        val = `${val.slice(0, 2)}:${val.slice(2, 4)}`;
    }
    
    input.value = val;
    if (field === 'in') dialogTimeInTime.value = val;
    else dialogTimeOutTime.value = val;
};

const onTimeBlur = (event: Event, field: 'in' | 'out') => {
    const input = event.target as HTMLInputElement;
    const formatted = cleanTimeString(input.value);
    input.value = formatted;
    if (field === 'in') dialogTimeInTime.value = formatted;
    else dialogTimeOutTime.value = formatted;
};


// Helper functions for filtering and sorting
const removeAccents = (str: string): string => {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
};

const toggleSort = (key: string) => {
    if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortOrder.value = 'asc';
    }
};

// Computed properties
const activeVessel = computed(() => vessels.value.find(v => v.id === activeVesselId.value) || null);
const activeBarge = computed<Barge | null>(() => activeVessel.value?.barges?.find(b => b.id === activeBargeId.value) || null);

// Helper kiểm tra nguồn tàu Nông sản De Heus (lô hàng liên tục không chốt tàu)
const isDeHeusVessel = (vessel?: Vessel | null): boolean => {
    if (!vessel || !vessel.name) return false;
    return removeAccents(vessel.name)
        .toUpperCase()
        .replace(/[\s_\-]+/g, ' ')
        .includes('DE HEUS');
};

// Vessel status lifecycle computed filters
const inProgressVessels = computed(() => {
    const result: Vessel[] = [];
    for (const v of vessels.value) {
        if (isDeHeusVessel(v)) {
            const unlockedBarges = (v.barges || []).filter(b => !b.config?.locked);
            if (unlockedBarges.length > 0 || (v.barges || []).length === 0 || (v.status || 'in_progress') === 'in_progress') {
                result.push({
                    ...v,
                    status: 'in_progress',
                    barges: unlockedBarges
                });
            }
        } else if ((v.status || 'in_progress') === 'in_progress') {
            result.push(v);
        }
    }
    return result;
});

const doneVessels = computed(() => {
    const result: Vessel[] = [];
    for (const v of vessels.value) {
        if (isDeHeusVessel(v)) {
            const lockedBarges = (v.barges || []).filter(b => !!b.config?.locked);
            if (lockedBarges.length > 0 || v.status === 'done') {
                result.push({
                    ...v,
                    status: 'done',
                    barges: lockedBarges
                });
            }
        } else if (v.status === 'done') {
            result.push(v);
        }
    }
    return result;
});

const filteredSidebarVessels = computed(() => selectedVesselStatusTab.value === 'done' ? doneVessels.value : inProgressVessels.value);
const isCurrentVesselDone = computed(() => {
    if (!activeVessel.value) return false;
    if (isDeHeusVessel(activeVessel.value)) {
        return false;
    }
    return activeVessel.value.status === 'done';
});

const allBarges = computed(() => {
    const list: Array<{ 
        id: number; 
        name: string; 
        vesselId: number; 
        vesselName: string; 
        vesselStatus: 'in_progress' | 'done';
        created_at?: string; 
        locked: boolean; 
        orderNo: string;
        tonnage?: number | null;
    }> = [];
    const targetVessels = vessels.value;
    targetVessels.forEach(v => {
        if (v.barges) {
            const isDeHeus = isDeHeusVessel(v);
            v.barges.forEach(b => {
                const rawTonnage = (b as any).tonnage !== undefined && (b as any).tonnage !== null
                    ? (b as any).tonnage
                    : (b.config?.tonnage !== undefined && b.config?.tonnage !== null ? b.config.tonnage : null);
                const numTonnage = rawTonnage !== null && rawTonnage !== '' ? Number(rawTonnage) : null;
                const isLocked = b.config?.locked || false;
                const effectiveStatus: 'in_progress' | 'done' = isDeHeus
                    ? (isLocked ? 'done' : 'in_progress')
                    : ((v.status || 'in_progress') as 'in_progress' | 'done');
                list.push({
                    id: b.id,
                    name: b.name,
                    vesselId: v.id,
                    vesselName: v.name,
                    vesselStatus: effectiveStatus,
                    created_at: b.created_at,
                    locked: isLocked,
                    orderNo: b.config?.orderNo ? String(b.config.orderNo).trim() : '',
                    tonnage: (numTonnage && !isNaN(numTonnage)) ? numTonnage : null
                });
            });
        }
    });
    return list.sort((a, b) => {
        const orderA = a.orderNo;
        const orderB = b.orderNo;
        
        if (!orderA && orderB) return 1;
        if (orderA && !orderB) return -1;
        if (!orderA && !orderB) {
            return a.name.localeCompare(b.name);
        }
        
        return orderA.localeCompare(orderB, undefined, { numeric: true, sensitivity: 'base' });
    });
});

// Helper: Parse date string in ISO, YYYY-MM-DD HH:mm, or DD/MM/YYYY HH:mm into Date
const parseBargeDate = (dStr: string): Date | null => {
    if (!dStr) return null;
    const str = String(dStr).trim();
    const matchYmd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2}))?/);
    if (matchYmd && matchYmd[1] && matchYmd[2] && matchYmd[3]) {
        const y = parseInt(matchYmd[1], 10);
        const m = parseInt(matchYmd[2], 10) - 1;
        const d = parseInt(matchYmd[3], 10);
        const h = matchYmd[4] ? parseInt(matchYmd[4], 10) : 0;
        const min = matchYmd[5] ? parseInt(matchYmd[5], 10) : 0;
        return new Date(y, m, d, h, min, 0);
    }
    const matchDmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[T\s]+(\d{1,2}):(\d{1,2}))?/);
    if (matchDmy && matchDmy[1] && matchDmy[2] && matchDmy[3]) {
        const d = parseInt(matchDmy[1], 10);
        const m = parseInt(matchDmy[2], 10) - 1;
        const y = parseInt(matchDmy[3], 10);
        const h = matchDmy[4] ? parseInt(matchDmy[4], 10) : 0;
        const min = matchDmy[5] ? parseInt(matchDmy[5], 10) : 0;
        return new Date(y, m, d, h, min, 0);
    }
    const parsed = new Date(str.replace('T', ' '));
    return isNaN(parsed.getTime()) ? null : parsed;
};

// Chu kỳ tính phí cầu bến: Từ ngày 26 tháng trước đến 25 tháng này (ví dụ: 26/06 - 25/07 thuộc Kỳ 07)
const getBillingPeriodKey = (d: Date): string => {
    const day = d.getDate();
    let month = d.getMonth() + 1; // 1-12
    let year = d.getFullYear();
    if (day > 25) {
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }
    return `${year}-${String(month).padStart(2, '0')}`;
};

const getBillingPeriodRange = (periodKey: string): { start: Date; end: Date; label: string } => {
    const [yStr, mStr] = periodKey.split('-');
    const m = parseInt(mStr || '1', 10);
    const y = parseInt(yStr || '2000', 10);
    let prevM = m - 1;
    let prevY = y;
    if (prevM < 1) {
        prevM = 12;
        prevY -= 1;
    }
    const start = new Date(prevY, prevM - 1, 26, 0, 0, 0, 0);
    const end = new Date(y, m - 1, 25, 23, 59, 59, 999);
    const label = `Kỳ ${String(m).padStart(2, '0')}/${y} (26/${String(prevM).padStart(2, '0')} - 25/${String(m).padStart(2, '0')})`;
    return { start, end, label };
};

interface BillingPeriodOption {
    key: string;
    label: string;
    start: Date;
    end: Date;
}

const availableBillingPeriods = computed<BillingPeriodOption[]>(() => {
    const periodKeys = new Set<string>();
    
    // Luôn bao gồm kỳ tính phí hiện tại theo ngày hệ thống
    const currentPeriod = getBillingPeriodKey(new Date());
    periodKeys.add(currentPeriod);
    
    if (globalBargesSummary.value && globalBargesSummary.value.length > 0) {
        globalBargesSummary.value.forEach(b => {
            if (!b.dateEnd) return; // Chỉ tính sà lan đã hoàn thành làm hàng
            const d = parseBargeDate(b.dateEnd);
            if (d) {
                periodKeys.add(getBillingPeriodKey(d));
            }
        });
    }
    
    return Array.from(periodKeys).sort().reverse().map(key => {
        const { start, end, label } = getBillingPeriodRange(key);
        return { key, label, start, end };
    });
});

const currentFilterPeriodLabel = computed(() => {
    if (globalFilterType.value === 'custom') {
        const start = globalFilterStartDate.value ? globalFilterStartDate.value.split('-').reverse().join('/') : '';
        const end = globalFilterEndDate.value ? globalFilterEndDate.value.split('-').reverse().join('/') : '';
        if (start && end) return `Từ ${start} đến ${end}`;
        if (start) return `Từ ${start}`;
        if (end) return `Đến ${end}`;
        return 'Tùy chọn khoảng ngày';
    }
    if (globalFilterType.value) {
        const found = availableBillingPeriods.value.find(p => p.key === globalFilterType.value);
        return found ? found.label : `Kỳ ${globalFilterType.value}`;
    }
    return 'Tất cả thời gian';
});

watch(globalFilterType, (newVal) => {
    if (newVal !== 'custom') {
        globalFilterStartDate.value = '';
        globalFilterEndDate.value = '';
    }
});

const filteredAllBarges = computed(() => {
    let list = allBarges.value.map(b => {
        const summary = globalBargesSummary.value.find(s => s.id === b.id);
        return {
            ...b,
            dateStart: summary ? summary.dateStart : '',
            dateEnd: summary ? summary.dateEnd : '',
            truckCount: summary ? summary.truckCount : 0,
            totalWeight: summary ? summary.totalWeight : 0
        };
    });

    if (globalFilterVesselStatus.value) {
        list = list.filter(b => b.vesselStatus === globalFilterVesselStatus.value);
    }

    if (globalFilterType.value === 'custom') {
        const start = globalFilterStartDate.value ? new Date(`${globalFilterStartDate.value}T00:00:00`) : null;
        const end = globalFilterEndDate.value ? new Date(`${globalFilterEndDate.value}T23:59:59.999`) : null;

        list = list.filter(b => {
            if (!b.dateEnd) return false;
            const d = parseBargeDate(b.dateEnd);
            if (!d) return false;
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        });
    } else if (globalFilterType.value) {
        const range = getBillingPeriodRange(globalFilterType.value);
        list = list.filter(b => {
            if (!b.dateEnd) return false; // Loại sà lan làm dở chưa kết thúc
            const d = parseBargeDate(b.dateEnd);
            if (!d) return false;
            return d >= range.start && d <= range.end;
        });
    } else if (globalFilterMonth.value) {
        list = list.filter(b => {
            const dates = [b.dateStart, b.dateEnd].filter(Boolean);
            return dates.some(dStr => {
                const d = parseBargeDate(dStr!);
                if (!d) return false;
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                return `${mm}/${yyyy}` === globalFilterMonth.value;
            });
        });
    }

    if (globalBargeSearchQuery.value.trim()) {
        const query = removeAccents(globalBargeSearchQuery.value.trim().toLowerCase());
        list = list.filter(b => 
            removeAccents(b.name.toLowerCase()).includes(query) || 
            removeAccents(b.vesselName.toLowerCase()).includes(query)
        );
    }
    return list;
});

const availableVesselMonths = computed(() => {
    const vessel = activeVessel.value;
    if (!vessel || !vesselBargesSummary.value) return [];
    
    const months = new Set<string>();
    const isDeHeus = isDeHeusVessel(vessel);
    vesselBargesSummary.value.forEach(b => {
        if (isDeHeus) {
            const shouldBeLocked = selectedVesselStatusTab.value === 'done';
            if (Boolean(b.locked) !== shouldBeLocked) return;
        }
        const dates = [b.dateStart, b.dateEnd].filter(Boolean);
        dates.forEach(dStr => {
            const date = new Date(dStr!);
            if (!isNaN(date.getTime())) {
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const yyyy = date.getFullYear();
                months.add(`${mm}/${yyyy}`);
            }
        });
    });
    
    return Array.from(months).sort((a, b) => {
        const partsA = a.split('/');
        const partsB = b.split('/');
        const mA = Number(partsA[0]) || 0;
        const yA = Number(partsA[1]) || 0;
        const mB = Number(partsB[0]) || 0;
        const yB = Number(partsB[1]) || 0;
        if (yA !== yB) return yB - yA;
        return mB - mA;
    });
});

const filteredVesselBarges = computed<BargeSummary[]>(() => {
    let list = vesselBargesSummary.value;
    
    if (isDeHeusVessel(activeVessel.value)) {
        const shouldBeLocked = selectedVesselStatusTab.value === 'done';
        list = list.filter(b => Boolean(b.locked) === shouldBeLocked);
    }
    
    if (vesselFilterMonth.value) {
        list = list.filter(b => {
            const dates = [b.dateStart, b.dateEnd].filter(Boolean);
            return dates.some(dStr => {
                const d = new Date(dStr!);
                if (isNaN(d.getTime())) return false;
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                return `${mm}/${yyyy}` === vesselFilterMonth.value;
            });
        });
    }
    
    if (bargeSearchQuery.value.trim()) {
        const query = removeAccents(bargeSearchQuery.value.trim().toLowerCase());
        list = list.filter(b => removeAccents(b.name.toLowerCase()).includes(query));
    }
    
    return list;
});

const filteredTrucks = computed(() => {
    let list = [...trucks.value];

    // 1. Search Filter
    const query = removeAccents(searchQuery.value.trim().toLowerCase());
    if (query) {
        list = list.filter(t => {
            const plate = removeAccents((t.plateNumber || '').toLowerCase());
            const drv = removeAccents((t.driver || '').toLowerCase());
            const ticket = removeAccents((t.ticketNo || '').toLowerCase());
            const noteStr = removeAccents((t.note || '').toLowerCase());
            return plate.includes(query) || drv.includes(query) || ticket.includes(query) || noteStr.includes(query);
        });
    }

    // 2. Sort Filter
    if (sortKey.value) {
        list.sort((a, b) => {
            let valA: any = a[sortKey.value as keyof Truck];
            let valB: any = b[sortKey.value as keyof Truck];

            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            if (sortKey.value === 'dateIn' || sortKey.value === 'dateOut') {
                const timeA = valA ? new Date(valA).getTime() : 0;
                const timeB = valB ? new Date(valB).getTime() : 0;
                return sortOrder.value === 'asc' ? timeA - timeB : timeB - timeA;
            }

            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortOrder.value === 'asc' ? valA - valB : valB - valA;
            }

            const strA = String(valA).trim();
            const strB = String(valB).trim();
            return sortOrder.value === 'asc' 
                ? strA.localeCompare(strB, 'vi', { numeric: true }) 
                : strB.localeCompare(strA, 'vi', { numeric: true });
        });
    }

    return list;
});

const totalNetWeight = computed(() => {
    return filteredTrucks.value.reduce((sum, t) => sum + (t.weightNet || 0), 0);
});

const avgNetWeight = computed(() => {
    if (filteredTrucks.value.length === 0) return 0;
    return Math.round(totalNetWeight.value / filteredTrucks.value.length);
});

// Load all Vessels and Barges on component load
interface BargeSummary {
    id: number;
    name: string;
    truckCount: number;
    totalWeight: number;
    dateStart: string;
    dateEnd: string;
    locked?: boolean;
}

const vesselBargesSummary = ref<BargeSummary[]>([]);
const loadingVesselSummary = ref(false);

// Helper function to load/update vessel summary data
const refreshVesselSummary = async () => {
    if (!activeVesselId.value) {
        vesselBargesSummary.value = [];
        return;
    }
    const vessel = vessels.value.find(v => v.id === activeVesselId.value);
    if (!vessel || !vessel.barges || vessel.barges.length === 0) {
        vesselBargesSummary.value = [];
        return;
    }
    
    loadingVesselSummary.value = true;
    try {
        const summaries = await Promise.all(vessel.barges.map(async (barge) => {
            const list = await WeighbridgeService.getTrucks(barge.id);
            let totalWeight = 0;
            let minDate = '';
            let maxDate = '';
            
            list.forEach(t => {
                totalWeight += (t.weightNet || 0);
                if (t.dateIn) {
                    if (!minDate || t.dateIn < minDate) minDate = t.dateIn;
                }
                if (t.dateOut) {
                    if (!maxDate || t.dateOut > maxDate) maxDate = t.dateOut;
                }
            });
            
            return {
                id: barge.id,
                name: barge.name,
                truckCount: list.length,
                totalWeight,
                dateStart: minDate,
                dateEnd: maxDate,
                locked: barge.config?.locked || false
            };
        }));
        
        vesselBargesSummary.value = summaries;
    } catch (e) {
        console.error('Error loading vessel summary:', e);
    } finally {
        loadingVesselSummary.value = false;
    }
};

const refreshGlobalBargesSummary = async () => {
    loadingGlobalSummary.value = true;
    try {
        const allBargePromises = vessels.value.flatMap(v => {
            return (v.barges || []).map(async (b) => {
                const trks = await WeighbridgeService.getTrucks(b.id);
                let totalWeight = 0;
                let minDate = '';
                let maxDate = '';
                
                trks.forEach(t => {
                    totalWeight += (t.weightNet || 0);
                    if (t.dateIn) {
                        if (!minDate || t.dateIn < minDate) minDate = t.dateIn;
                    }
                    if (t.dateOut) {
                        if (!maxDate || t.dateOut > maxDate) maxDate = t.dateOut;
                    }
                });
                
                return {
                    id: b.id,
                    name: b.name,
                    truckCount: trks.length,
                    totalWeight,
                    dateStart: minDate,
                    dateEnd: maxDate,
                    locked: b.config?.locked || false
                };
            });
        });
        
        const results = await Promise.all(allBargePromises);
        globalBargesSummary.value = results;
    } catch (e) {
        console.error('Error loading global summary:', e);
    } finally {
        loadingGlobalSummary.value = false;
    }
};

const loadVessels = async () => {
    loading.value = true;
    try {
        const [data, md, gt] = await Promise.all([
            WeighbridgeService.getVessels(),
            WeighbridgeService.getMasterData(),
            WeighbridgeService.getGlobalTicketTemplate()
        ]);
        masterData.value = md;
        globalTemplate.value = gt;
        vessels.value = (data || [])
            .filter(v => v.name !== 'KHU VỰC PHÚ MỸ')
            .map(v => ({
                ...v,
                barges: (v.barges || []).filter(b => b.config?.site !== 'PhuMy')
            }));
        
        // Collapse all vessels by default in left sidebar
        vessels.value.forEach(v => {
            if (expandedVesselIds.value[v.id] === undefined) {
                expandedVesselIds.value[v.id] = false;
            }
        });

        if (activeVesselId.value) {
            await refreshVesselSummary();
        } else {
            await refreshGlobalBargesSummary();
        }
    } catch (e) {
        showToast('Không thể tải danh sách tàu từ Supabase!', 'error');
    } finally {
        loading.value = false;
    }
};

const selectBarge = async (vesselId: number, bargeId: number) => {
    activeVesselId.value = vesselId;
    activeBargeId.value = bargeId;
    expandedVesselIds.value[vesselId] = true;
    
    const currentV = vessels.value.find(v => v.id === vesselId);
    if (isDeHeusVessel(currentV)) {
        const targetBarge = currentV?.barges?.find(b => b.id === bargeId);
        selectedVesselStatusTab.value = targetBarge?.config?.locked ? 'done' : 'in_progress';
    } else if (currentV?.status === 'done') {
        selectedVesselStatusTab.value = 'done';
    } else if (currentV) {
        selectedVesselStatusTab.value = 'in_progress';
    }
    
    // Reset filters and sorting when switching barges
    searchQuery.value = '';
    sortKey.value = '';
    sortOrder.value = 'asc';
    
    // Reset designer selection
    selectedElementId.value = null;
    selectedElementIds.value = [];
    
    // Load config of active barge (with 100% inheritance from vessel and global template)
    if (activeBarge.value) {
        const cfg = activeBarge.value.config || {};

        cfgForm.goods = currentV?.cargo_type || cfg.goods || '';
        cfgForm.goodsCode = currentV?.cargo_code || cfg.goodsCode || '';
        cfgForm.owner = currentV?.customer || cfg.owner || '';
        cfgForm.operator = cfg.operator || '';
        cfgForm.xn = cfg.xn || 'XUẤT KHẨU';
        cfgForm.ticketPrefix = cfg.ticketPrefix || 'PC-';
        cfgForm.ticketSeed = cfg.ticketSeed !== undefined ? cfg.ticketSeed : 1;
        cfgForm.chinhpham = cfg.chinhpham !== undefined ? cfg.chinhpham : 100;
        cfgForm.phupham = cfg.phupham !== undefined ? cfg.phupham : 0;
        cfgForm.ketluan = cfg.ketluan || 'Chính phẩm đạt tiêu chuẩn';
        cfgForm.locked = cfg.locked || false;
        cfgForm.orderNo = cfg.orderNo || '';
        cfgForm.printFields = globalTemplate.value.printFields || getDefaultPrintFields();
        let elements = globalTemplate.value.printElements || getDefaultPrintElements();
        if (elements.length > 0 && !elements.some((el: any) => el.id === 'sig1_name')) {
            elements = [...elements, { id: 'sig1_name', type: 'field', x: 18.5, y: 133, width: 30, height: 4, label: '', fieldId: 'operator', align: 'center', fontSize: 10, fontWeight: 'bold' }];
        }
        cfgForm.printElements = elements.filter(el => !['lineHeader', 'lineTitle', 'lineFooter'].includes(el.id));
        cfgForm.companyName = globalTemplate.value.companyName || 'CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG NGUYÊN NGỌC';
        cfgForm.companyAddress = globalTemplate.value.companyAddress || 'Địa chỉ: Số 167, tổ 78, Đường Đê Bao, Khu phố 9, Phường Phú An, TP. Hồ Chí Minh, Việt Nam';
        cfgForm.companyPhone = globalTemplate.value.companyPhone || 'ĐT: 0964 258 671 / Fax:';
        cfgForm.ticketTitle = globalTemplate.value.ticketTitle || 'PHIẾU CÂN XE';
        cfgForm.signatures = globalTemplate.value.signatures || ['NV TRẠM CÂN', 'BẢO VỆ', 'CHỦ HÀNG', 'THỦ KHO', 'TÀI XẾ'];

        // Fetch trucks
        loading.value = true;
        try {
            const list = await WeighbridgeService.getTrucks(bargeId);
            trucks.value = list;
        } catch (e) {
            showToast('Lỗi tải danh sách xe cân!', 'error');
        } finally {
            loading.value = false;
        }
    }
};

const exportActiveBargeTrucksToExcel = () => {
    const barge = activeBarge.value;
    if (!barge) {
        showToast('Vui lòng chọn một sà lan trước!', 'error');
        return;
    }
    if (filteredTrucks.value.length === 0) {
        showToast('Không có dữ liệu chuyến xe nào để xuất!', 'error');
        return;
    }

    try {
        exportingActiveBargeTrucks.value = true;
        showToast('Đang chuẩn bị xuất tệp Excel danh sách xe...', 'success');
        
        import('exceljs').then(async (ExcelJS) => {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Chi tiết xe cân sà lan');
            
            sheet.pageSetup.margins = {
                left: 0.7, right: 0.7,
                top: 0.75, bottom: 0.75,
                header: 0.3, footer: 0.3
            };
            
            sheet.views = [{ showGridLines: true }];
            
            sheet.addRow([`DANH SÁCH CHI TIẾT XE CÂN SÀ LAN: ${barge.name.toUpperCase()}`]);
            sheet.addRow([`Mã lệnh: ${barge.config?.orderNo || '-'} | Cảng Nguyên Ngọc - Xuất lúc: ${formatDateTimeStr(new Date().toISOString())} - Tổng số: ${filteredTrucks.value.length} xe`]);
            sheet.addRow([]);
            
            const headerRow = sheet.addRow([
                'STT', 
                'Số phiếu', 
                'Số xe (Biển số)', 
                'Tài xế', 
                'TL Lần 1 (kg)', 
                'TL Lần 2 (kg)', 
                'TL Hàng (Net) (kg)', 
                'Giờ vào', 
                'Giờ ra', 
                'Ghi chú'
            ]);
            
            sheet.mergeCells('A1:J1');
            const titleCell = sheet.getCell('A1');
            titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: '0F766E' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            
            sheet.mergeCells('A2:J2');
            const subtitleCell = sheet.getCell('A2');
            subtitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: '666666' } };
            subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            
            headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFF' } };
            headerRow.height = 25;
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: '0D9488' }
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'E5E7EB' } },
                    left: { style: 'thin', color: { argb: 'E5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
                    right: { style: 'thin', color: { argb: 'E5E7EB' } }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            
            let totalWeightNet = 0;
            
            filteredTrucks.value.forEach((t, idx) => {
                const row = sheet.addRow([
                    idx + 1,
                    t.ticketNo || '',
                    t.plateNumber || '',
                    t.driver || '',
                    Number(t.weight1) || 0,
                    Number(t.weight2) || 0,
                    Number(t.weightNet) || 0,
                    t.dateIn ? formatDateTimeStr(t.dateIn) : '',
                    t.dateOut ? formatDateTimeStr(t.dateOut) : '',
                    t.note || ''
                ]);
                totalWeightNet += (Number(t.weightNet) || 0);
                
                row.font = { name: 'Segoe UI', size: 11 };
                row.height = 20;
                row.eachCell((cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'F3F4F6' } },
                        left: { style: 'thin', color: { argb: 'F3F4F6' } },
                        bottom: { style: 'thin', color: { argb: 'F3F4F6' } },
                        right: { style: 'thin', color: { argb: 'F3F4F6' } }
                    };
                    
                    if (colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 8 || colNumber === 9) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else if (colNumber === 5 || colNumber === 6 || colNumber === 7) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = '#,##0';
                    } else {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    }
                });
            });
            
            const totalRow = sheet.addRow([
                'TỔNG CỘNG',
                '',
                '',
                '',
                '',
                '',
                totalWeightNet,
                '',
                '',
                ''
            ]);
            sheet.mergeCells(`A${totalRow.number}:F${totalRow.number}`);
            
            totalRow.font = { name: 'Segoe UI', size: 11, bold: true };
            totalRow.height = 22;
            totalRow.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'E5E7EB' } },
                    left: { style: 'thin', color: { argb: 'E5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
                    right: { style: 'thin', color: { argb: 'E5E7EB' } }
                };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5EBE6' }
                };
                if (colNumber === 1) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                } else if (colNumber === 7) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = '#,##0';
                }
            });
            
            sheet.columns.forEach((col, idx) => {
                let maxLen = 10;
                sheet.eachRow((row, rowNumber) => {
                    if (rowNumber >= 4) {
                        const val = row.getCell(idx + 1).value;
                        if (val) maxLen = Math.max(maxLen, String(val).length);
                    }
                });
                col.width = maxLen + 4;
            });
            
            const buffer = await workbook.xlsx.writeBuffer();
            excelService.downloadFile(
                buffer, 
                `Danh_Sach_Xe_Can_Sa_Lan_${barge.name}_${new Date().toISOString().slice(0, 10)}.xlsx`, 
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            
            showToast('Xuất tệp Excel danh sách xe thành công! 📊', 'success');
            await LogService.logAction('Xuất Excel', `Xuất danh sách xe cân sà lan ${barge.name} ra Excel`);
            exportingActiveBargeTrucks.value = false;
        }).catch((err) => {
            console.error('Error exporting active barge trucks:', err);
            showToast('Có lỗi xảy ra khi xuất Excel!', 'error');
            exportingActiveBargeTrucks.value = false;
        });
    } catch (e) {
        console.error('Error in exportActiveBargeTrucksToExcel:', e);
        showToast('Có lỗi xảy ra khi xuất Excel!', 'error');
        exportingActiveBargeTrucks.value = false;
    }
};

const exportAllBargesToExcel = () => {
    if (filteredAllBarges.value.length === 0) return;
    
    try {
        exportingGlobalBarges.value = true;
        showToast('Đang chuẩn bị xuất tệp Excel...', 'success');
        
        import('exceljs').then(async (ExcelJS) => {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Danh sách Sà Lan');
            
            sheet.pageSetup.margins = {
                left: 0.7, right: 0.7,
                top: 0.75, bottom: 0.75,
                header: 0.3, footer: 0.3
            };
            
            sheet.views = [{ showGridLines: true }];
            
            sheet.addRow(['DANH SÁCH QUẢN LÝ TẤT CẢ SÀ LAN']);
            const vesselStatusLabel = globalFilterVesselStatus.value === 'done' ? ' - Tàu đã xong' : (globalFilterVesselStatus.value === 'in_progress' ? ' - Tàu đang làm hàng' : '');
            const filterLabel = (globalFilterType.value ? ` - ${currentFilterPeriodLabel.value}` : '') + vesselStatusLabel;
            sheet.addRow([`Cảng Nguyên Ngọc - Xuất lúc: ${formatDateTimeStr(new Date().toISOString())}${filterLabel} - Tổng số: ${filteredAllBarges.value.length} sà lan`]);
            sheet.addRow([]);
            
            const headerRow = sheet.addRow([
                'STT', 
                'Tên sà lan', 
                'Mã lệnh', 
                'Thuộc Tàu', 
                'Trọng tải (tấn)',
                'Thời gian bắt đầu', 
                'Thời gian kết thúc', 
                'Số chuyến xe', 
                'Tổng sản lượng (kg)', 
                'Trạng thái'
            ]);
            
            sheet.mergeCells('A1:J1');
            const titleCell = sheet.getCell('A1');
            titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: '4A2C32' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            
            sheet.mergeCells('A2:J2');
            const subtitleCell = sheet.getCell('A2');
            subtitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: '666666' } };
            subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            
            headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFF' } };
            headerRow.height = 25;
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF6B81' }
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'E5E7EB' } },
                    left: { style: 'thin', color: { argb: 'E5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
                    right: { style: 'thin', color: { argb: 'E5E7EB' } }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            
            let totalTrips = 0;
            let grandTotalWeight = 0;
            
            filteredAllBarges.value.forEach((b, idx) => {
                const row = sheet.addRow([
                    idx + 1,
                    b.name || '',
                    b.orderNo || '-',
                    b.vesselName || '',
                    b.tonnage ? b.tonnage : '-',
                    b.dateStart ? formatDateTimeStr(b.dateStart) : '-',
                    b.dateEnd ? formatDateTimeStr(b.dateEnd) : '-',
                    b.truckCount || 0,
                    b.totalWeight || 0,
                    b.locked ? 'Đã khóa' : 'Đang mở'
                ]);
                totalTrips += (b.truckCount || 0);
                grandTotalWeight += (b.totalWeight || 0);
                
                row.font = { name: 'Segoe UI', size: 11 };
                row.height = 20;
                row.eachCell((cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'F3F4F6' } },
                        left: { style: 'thin', color: { argb: 'F3F4F6' } },
                        bottom: { style: 'thin', color: { argb: 'F3F4F6' } },
                        right: { style: 'thin', color: { argb: 'F3F4F6' } }
                    };
                    
                    if (colNumber === 1 || colNumber === 3 || colNumber === 5 || colNumber === 6 || colNumber === 7 || colNumber === 10) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        if (colNumber === 5 && typeof b.tonnage === 'number') {
                            cell.numFmt = '#,##0';
                        }
                    } else if (colNumber === 8 || colNumber === 9) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        if (colNumber === 9) cell.numFmt = '#,##0';
                    } else {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    }
                    
                    if (colNumber === 10) {
                        if (b.locked) {
                            cell.font = { name: 'Segoe UI', size: 11, color: { argb: 'DC2626' }, bold: true };
                        } else {
                            cell.font = { name: 'Segoe UI', size: 11, color: { argb: '0D9488' }, bold: true };
                        }
                    }
                });
            });
            
            const totalRow = sheet.addRow([
                'TỔNG CỘNG',
                '',
                '',
                '',
                '',
                '',
                '',
                totalTrips,
                grandTotalWeight,
                ''
            ]);
            sheet.mergeCells(`A${totalRow.number}:G${totalRow.number}`);
            
            totalRow.font = { name: 'Segoe UI', size: 11, bold: true };
            totalRow.height = 22;
            totalRow.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'E5E7EB' } },
                    left: { style: 'thin', color: { argb: 'E5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
                    right: { style: 'thin', color: { argb: 'E5E7EB' } }
                };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5EBE6' }
                };
                if (colNumber === 1) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                } else if (colNumber === 8 || colNumber === 9) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    if (colNumber === 9) cell.numFmt = '#,##0';
                }
            });
            
            sheet.columns.forEach((col, idx) => {
                let maxLen = 10;
                sheet.eachRow((row, rowNumber) => {
                    // Bỏ qua tiêu đề (dòng 1, 2, 3) để tránh làm dãn cột STT quá rộng
                    if (rowNumber >= 4) {
                        const val = row.getCell(idx + 1).value;
                        if (val) maxLen = Math.max(maxLen, String(val).length);
                    }
                });
                col.width = maxLen + 4;
            });
            
            const buffer = await workbook.xlsx.writeBuffer();
            excelService.downloadFile(
                buffer, 
                `Danh_Sach_Quan_Ly_Sa_Lan_${new Date().toISOString().slice(0, 10)}.xlsx`, 
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            
            showToast('Xuất tệp Excel thành công! 📊', 'success');
            await LogService.logAction('Xuất Excel', 'Xuất danh sách quản lý sà lan ra Excel');
            exportingGlobalBarges.value = false;
        }).catch((err) => {
            console.error('Error exporting global barges:', err);
            showToast('Có lỗi xảy ra khi xuất Excel!', 'error');
            exportingGlobalBarges.value = false;
        });
    } catch (e) {
        console.error('Error in exportAllBargesToExcel:', e);
        showToast('Có lỗi xảy ra khi xuất Excel!', 'error');
        exportingGlobalBarges.value = false;
    }
};

const selectVessel = async (vesselId: number) => {
    const isSameVessel = activeVesselId.value === vesselId;
    const isBargeNull = activeBargeId.value === null;

    activeVesselId.value = vesselId;
    activeBargeId.value = null; // Deselect barge to show vessel report summary
    vesselFilterMonth.value = '';
    bargeSearchQuery.value = '';

    const currentV = vessels.value.find(v => v.id === vesselId);
    if (!isDeHeusVessel(currentV)) {
        if (currentV?.status === 'done') {
            selectedVesselStatusTab.value = 'done';
        } else if (currentV) {
            selectedVesselStatusTab.value = 'in_progress';
        }
    }

    if (isSameVessel && isBargeNull) {
        await refreshVesselSummary();
    }
};

const exportVesselSummaryExcel = () => {
    const vessel = activeVessel.value;
    if (!vessel) return;
    
    try {
        import('exceljs').then(async (ExcelJS) => {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Báo Cáo Tổng Hợp Tàu');
            
            sheet.pageSetup.margins = {
                left: 0.7, right: 0.7,
                top: 0.75, bottom: 0.75,
                header: 0.3, footer: 0.3
            };
            
            sheet.addRow([`BÁO CÁO TỔNG HỢP TÀU: ${vessel.name}`]);
            sheet.addRow([`Cảng Nguyên Ngọc - Đồng bộ lúc: ${formatDateTimeStr(new Date().toISOString())}`]);
            sheet.addRow([]);
            
            const headerRow = sheet.addRow(['STT', 'Tên sà lan', 'Số chuyến xe chạy', 'Tổng khối lượng hàng (Net - kg)', 'Thời gian bắt đầu', 'Thời gian kết thúc']);
            
            sheet.mergeCells('A1:F1');
            const titleCell = sheet.getCell('A1');
            titleCell.font = { name: 'Times New Roman', size: 16, bold: true };
            titleCell.alignment = { horizontal: 'center' };
            
            sheet.mergeCells('A2:F2');
            const subtitleCell = sheet.getCell('A2');
            subtitleCell.font = { name: 'Times New Roman', size: 10, italic: true };
            subtitleCell.alignment = { horizontal: 'center' };
            
            headerRow.font = { name: 'Times New Roman', size: 11, bold: true };
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE8DCD0' }
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            
            let totalTrips = 0;
            let grandTotalWeight = 0;
            
            filteredVesselBarges.value.forEach((b, idx) => {
                const row = sheet.addRow([
                    idx + 1,
                    b.name,
                    b.truckCount,
                    b.totalWeight,
                    formatDateTimeStr(b.dateStart) || '-',
                    formatDateTimeStr(b.dateEnd) || '-'
                ]);
                totalTrips += b.truckCount;
                grandTotalWeight += b.totalWeight;
                
                row.font = { name: 'Times New Roman', size: 11 };
                row.eachCell((cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    if (colNumber === 1 || colNumber === 2 || colNumber === 5 || colNumber === 6) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else if (colNumber === 3) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    } else if (colNumber === 4) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = '#,##0';
                    }
                });
            });
            
            const totalRow = sheet.addRow([
                'TỔNG CỘNG',
                '',
                totalTrips,
                grandTotalWeight,
                '',
                ''
            ]);
            sheet.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
            
            totalRow.font = { name: 'Times New Roman', size: 11, bold: true };
            totalRow.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5EBE6' }
                };
                if (colNumber === 1) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                } else if (colNumber === 3) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                } else if (colNumber === 4) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = '#,##0';
                }
            });
            
            sheet.columns.forEach((col, idx) => {
                let maxLen = 10;
                sheet.eachRow((row, rowNumber) => {
                    // Bỏ qua tiêu đề (dòng 1, 2, 3) để tránh làm dãn cột STT quá rộng
                    if (rowNumber >= 4) {
                        const val = row.getCell(idx + 1).value;
                        if (val) maxLen = Math.max(maxLen, String(val).length);
                    }
                });
                col.width = maxLen + 4;
            });
            
            const buffer = await workbook.xlsx.writeBuffer();
            excelService.downloadFile(
                buffer, 
                `BAO_CAO_TONG_HOP_TAU_${vessel.name.replace(/\s+/g, '_')}.xlsx`, 
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            showToast('Xuất báo cáo tổng hợp tàu thành công!');
        });
    } catch (e: any) {
        showToast('Lỗi khi xuất báo cáo: ' + e.message, 'error');
    }
};

// Auto save configurations when modified (debounced)
let saveDebounceTimer: any = null;
const saveBargeConfig = () => {
    if (showGlobalTemplateModal.value) return; // In global template modal, changes are saved via saveGlobalTemplateFromModal
    const bargeId = activeBargeId.value;
    if (!bargeId) return;
    if (cfgForm.locked || (authStore.role !== 'admin' && !canUpdate())) return; // Prevent auto-saving when locked or not admin
    
    // Save to local backup immediately
    try {
        localStorage.setItem('weighbridge_default_layout', JSON.stringify(cfgForm.printElements));
        localStorage.setItem('weighbridge_default_company_details', JSON.stringify({
            companyName: cfgForm.companyName,
            companyAddress: cfgForm.companyAddress,
            companyPhone: cfgForm.companyPhone,
            ticketTitle: cfgForm.ticketTitle,
            signatures: cfgForm.signatures
        }));
    } catch (e) {}

    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(async () => {
        saving.value = true;
        try {
            const success = await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm });
            if (success) {
                // Update local model
                if (activeBarge.value) {
                    activeBarge.value.config = { ...cfgForm, updatedAt: Date.now() };
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            saving.value = false;
        }
    }, 1000);
};

// Immediate save configuration (with toast notification)
const saveBargeConfigImmediately = async () => {
    const bargeId = activeBargeId.value;
    if (!bargeId) return;
    if (authStore.role !== 'admin' && !hasDetailPermission('weighbridge', 'wb_layout_config', 'update')) {
        showToast('Bạn không có quyền thay đổi cấu hình sà lan!', 'error');
        return;
    }
    if (authStore.role !== 'admin' && !canUpdate()) {
        showToast('Bạn không có quyền lưu cấu hình!', 'error');
        return;
    }
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể lưu cấu hình.', 'error');
        return;
    }

    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    
    saving.value = true;
    try {
        // Save to local backup
        try {
            localStorage.setItem('weighbridge_default_layout', JSON.stringify(cfgForm.printElements));
            localStorage.setItem('weighbridge_default_company_details', JSON.stringify({
                companyName: cfgForm.companyName,
                companyAddress: cfgForm.companyAddress,
                companyPhone: cfgForm.companyPhone,
                ticketTitle: cfgForm.ticketTitle,
                signatures: cfgForm.signatures
            }));
        } catch (e) {}

        const success = await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm });
        if (success) {
            if (activeBarge.value) {
                activeBarge.value.config = { ...cfgForm, updatedAt: Date.now() };
            }
            showToast('Đã lưu cấu hình mẫu phiếu thành công!');
        } else {
            showToast('Không thể lưu cấu hình mẫu phiếu!', 'error');
        }
    } catch (e) {
        console.error('Error saving barge config:', e);
        showToast('Lỗi kết nối khi lưu cấu hình!', 'error');
    } finally {
        saving.value = false;
    }
};

const toggleBargeLock = async () => {
    if (isCurrentVesselDone.value) {
        showToast('Tàu này đã chốt số liệu (Đã xong), không thể thay đổi khóa sà lan!', 'warning');
        return;
    }
    const bargeId = activeBargeId.value;
    if (!bargeId) return;
    if (authStore.role !== 'admin' && !hasDetailPermission('weighbridge', 'wb_layout_config', 'update')) {
        showToast('Bạn không có quyền khóa/mở khóa sà lan!', 'error');
        return;
    }
    if (authStore.role !== 'admin') {
        showToast('Chỉ Quản trị viên mới có quyền thực hiện thao tác này!', 'error');
        return;
    }

    const newLockState = !cfgForm.locked;
    saving.value = true;
    try {
        const success = await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm, locked: newLockState });
        if (success) {
            cfgForm.locked = newLockState;
            if (activeBarge.value) {
                activeBarge.value.config = { ...cfgForm, locked: newLockState, updatedAt: Date.now() };
            }
            // Update in local vessels list
            vessels.value.forEach(v => {
                const b = v.barges?.find(barge => barge.id === bargeId);
                if (b) {
                    b.config = { ...cfgForm, locked: newLockState, updatedAt: Date.now() };
                }
            });
            // Sync summary lists
            const vSummary = vesselBargesSummary.value.find(s => s.id === bargeId);
            if (vSummary) vSummary.locked = newLockState;
            const gSummary = globalBargesSummary.value.find(s => s.id === bargeId);
            if (gSummary) gSummary.locked = newLockState;

            if (isDeHeusVessel(activeVessel.value)) {
                selectedVesselStatusTab.value = newLockState ? 'done' : 'in_progress';
            }

            showToast(cfgForm.locked ? 'Đã khóa sà lan thành công! 🔒' : 'Đã mở khóa sà lan thành công! 🔓');
            await LogService.logAction(cfgForm.locked ? 'Khóa sà lan' : 'Mở khóa sà lan', 'Sà lan: ' + (activeBarge.value?.name || bargeId));
        } else {
            showToast('Không thể thay đổi trạng thái khóa!', 'error');
        }
    } catch (e) {
        console.error('Error toggling barge lock:', e);
        showToast('Lỗi kết nối khi đổi trạng thái khóa!', 'error');
    } finally {
        saving.value = false;
    }
};

const otherBargesWithConfig = computed(() => {
    const list: { id: number; name: string; vesselName: string }[] = [];
    vessels.value.forEach(v => {
        v.barges?.forEach(b => {
            if (b.id !== activeBargeId.value && b.config?.printElements && b.config.printElements.length > 0) {
                list.push({
                    id: b.id,
                    name: b.name,
                    vesselName: v.name
                });
            }
        });
    });
    return list;
});

const saveAsGlobalDefaultLayout = () => {
    try {
        localStorage.setItem('weighbridge_default_layout', JSON.stringify(cfgForm.printElements));
        localStorage.setItem('weighbridge_default_company_details', JSON.stringify({
            companyName: cfgForm.companyName,
            companyAddress: cfgForm.companyAddress,
            companyPhone: cfgForm.companyPhone,
            ticketTitle: cfgForm.ticketTitle,
            signatures: cfgForm.signatures
        }));
        showToast('Đã lưu thiết kế hiện tại làm mẫu mặc định thành công! ⭐');
    } catch (e) {
        console.error(e);
        showToast('Lỗi lưu mẫu in mặc định!', 'error');
    }
};

const applyLayoutToAllBarges = async () => {
    if (authStore.role !== 'admin' && !canUpdate()) {
        showToast('Chỉ Quản trị viên mới có quyền thực hiện thao tác này!', 'error');
        return;
    }
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể thực hiện thao tác này.', 'error');
        return;
    }

    const confirmApply = await showConfirm({
        title: 'Áp dụng thiết kế cho tất cả sà lan',
        message: 'Bạn có chắc chắn muốn áp dụng thiết kế mẫu in hiện tại cho TẤT CẢ sà lan khác trên hệ thống? Thiết kế cũ của các sà lan khác sẽ bị ghi đè.',
        type: 'warning',
        okText: 'Áp dụng hết',
        cancelText: 'Hủy'
    });
    if (!confirmApply) return;

    saving.value = true;
    try {
        saveAsGlobalDefaultLayout();

        const updatePromises: Promise<boolean>[] = [];
        vessels.value.forEach(v => {
            if (v.barges) {
                v.barges.forEach(b => {
                    const updatedConfig = {
                        ...b.config,
                        printElements: JSON.parse(JSON.stringify(cfgForm.printElements)),
                        companyName: cfgForm.companyName,
                        companyAddress: cfgForm.companyAddress,
                        companyPhone: cfgForm.companyPhone,
                        ticketTitle: cfgForm.ticketTitle,
                        signatures: [...(cfgForm.signatures || [])],
                        updatedAt: Date.now()
                    };
                    b.config = updatedConfig;
                    updatePromises.push(WeighbridgeService.updateBargeConfig(b.id, updatedConfig));
                });
            }
        });

        const results = await Promise.all(updatePromises);
        const successCount = results.filter(r => r).length;
        showToast(`Đã áp dụng mẫu in cho ${successCount} sà lan thành công! 🚢`);
    } catch (e) {
        console.error('Error applying layout to all barges:', e);
        showToast('Lỗi khi áp dụng mẫu in cho tất cả sà lan!', 'error');
    } finally {
        saving.value = false;
    }
};

const copyLayoutFromBarge = (fromBargeId: number) => {
    if (authStore.role !== 'admin' && !canUpdate()) {
        showToast('Chỉ Quản trị viên mới có quyền thực hiện thao tác này!', 'error');
        return;
    }
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể thay đổi thiết kế.', 'error');
        return;
    }

    let sourceBarge: Barge | null = null;
    for (const v of vessels.value) {
        const b = v.barges?.find(b => b.id === fromBargeId);
        if (b) {
            sourceBarge = b;
            break;
        }
    }

    if (!sourceBarge || !sourceBarge.config) {
        showToast('Không tìm thấy dữ liệu sà lan nguồn!', 'error');
        return;
    }

    const cfg = sourceBarge.config;
    cfgForm.printElements = JSON.parse(JSON.stringify(cfg.printElements || getDefaultPrintElements()));
    cfgForm.printFields = JSON.parse(JSON.stringify(cfg.printFields || getDefaultPrintFields()));
    cfgForm.companyName = cfg.companyName || 'CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG NGUYÊN NGỌC';
    cfgForm.companyAddress = cfg.companyAddress || 'Địa chỉ: Số 167, tổ 78, Đường Đê Bao, Khu phố 9, Phường Phú An, TP. Hồ Chí Minh, Việt Nam';
    cfgForm.companyPhone = cfg.companyPhone || 'ĐT: 0964 258 671 / Fax:';
    cfgForm.ticketTitle = cfg.ticketTitle || 'PHIẾU CÂN XE';
    cfgForm.signatures = cfg.signatures || ['NV TRẠM CÂN', 'BẢO VỆ', 'CHỦ HÀNG', 'THỦ KHO', 'TÀI XẾ'];

    showToast(`Đã sao chép thiết kế từ sà lan "${sourceBarge.name}"! Nhớ nhấn Lưu để áp dụng.`);
    saveBargeConfig();
};

// Visual Page Designer State
const selectedElementId = ref<string | null>(null);
const selectedElementIds = ref<string[]>([]);
const selectedElement = computed(() => {
    return (cfgForm.printElements || []).find(el => el.id === selectedElementId.value) || null;
});

// Helper to clamp a single element
const clampElement = (el: PrintElement) => {
    let x = Number(el.x);
    if (isNaN(x)) x = 0;
    let y = Number(el.y);
    if (isNaN(y)) y = 0;
    let w = Number(el.width);
    if (isNaN(w) || w <= 0) w = 10;
    let h = Number(el.height);
    if (isNaN(h) || h <= 0) h = 5;

    // Clamp width/height to canvas dimensions
    if (w > CANVAS_WIDTH_MM) w = CANVAS_WIDTH_MM;
    if (h > CANVAS_HEIGHT_MM) h = CANVAS_HEIGHT_MM;

    // Clamp X and Y to be within [0, CANVAS_WIDTH_MM - w]
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + w > CANVAS_WIDTH_MM) {
        x = CANVAS_WIDTH_MM - w;
    }
    if (y + h > CANVAS_HEIGHT_MM) {
        y = CANVAS_HEIGHT_MM - h;
    }

    // Clamp labelWidth for fields
    let lw = Number(el.labelWidth);
    if (!isNaN(lw) && lw > w) {
        el.labelWidth = w;
    }

    // Assign back
    if (el.x !== x) el.x = x;
    if (el.y !== y) el.y = y;
    if (el.width !== w) el.width = w;
    if (el.height !== h) el.height = h;
};

// Clamp active selected element (called on input events)
const clampSelectedElement = (el: PrintElement | null) => {
    if (!el) return;
    clampElement(el);
    saveBargeConfig();
};

// Apply a property from the primary selected element to all selected elements
const applyToAllSelected = (prop: keyof PrintElement) => {
    const primary = selectedElement.value;
    if (!primary || selectedElementIds.value.length <= 1) return;
    const value = primary[prop];
    selectedElementIds.value.forEach(id => {
        if (id === selectedElementId.value) return;
        const el = (cfgForm.printElements || []).find(e => e.id === id);
        if (!el) return;
        (el as any)[prop] = value;
        clampElement(el);
    });
    saveBargeConfig();
};

// Watch and clamp all elements to stay within A5 paper bounds (210mm x 148mm)
watch(() => JSON.stringify(cfgForm.printElements), () => {
    if (!cfgForm.printElements) return;
    let modified = false;
    cfgForm.printElements.forEach(el => {
        const oldX = el.x;
        const oldY = el.y;
        const oldW = el.width;
        const oldH = el.height;
        const oldLw = el.labelWidth;

        clampElement(el);

        if (el.x !== oldX || el.y !== oldY || el.width !== oldW || el.height !== oldH || el.labelWidth !== oldLw) {
            modified = true;
        }
    });
    if (modified) {
        saveBargeConfig();
    }
});

const availableFields = [
    { id: 'ticketNo', label: 'Số phiếu' },
    { id: 'plateNumber', label: 'Số xe (Biển số)' },
    { id: 'goods', label: 'Hàng hóa' },
    { id: 'goodsCode', label: 'Mã hàng hóa' },
    { id: 'owner', label: 'Chủ hàng' },
    { id: 'operator', label: 'Nhân viên cân' },
    { id: 'xn', label: 'Phương thức Xuất/Nhập' },
    { id: 'barge', label: 'Tên sà lan' },
    { id: 'driver', label: 'Tài xế' },
    { id: 'weight1', label: 'Trọng lượng cân lần 1' },
    { id: 'weight2', label: 'Trọng lượng cân lần 2' },
    { id: 'weightNet', label: 'Trọng lượng hàng (Net)' },
    { id: 'words', label: 'Khối lượng bằng chữ' },
    { id: 'dateIn', label: 'Ngày giờ vào' },
    { id: 'dateOut', label: 'Ngày giờ ra' },
    { id: 'chinhpham', label: 'Đánh giá: % Chính phẩm' },
    { id: 'phupham', label: 'Đánh giá: % Phụ phẩm' },
    { id: 'ketluan', label: 'Đánh giá: Kết luận' },
    { id: 'note', label: 'Ghi chú' }
];

const draggingElementId = ref<string | null>(null);
let dragStartMouseX = 0;
let dragStartMouseY = 0;
let dragStartElX = 0;
let dragStartElY = 0;

const canvasContainerRef = ref<HTMLDivElement | null>(null);
const canvasWidthPx = ref(840);
const canvasHeightPx = ref(592);
const currentMmToPx = computed(() => canvasWidthPx.value / 210);
let resizeObserver: ResizeObserver | null = null;

const CANVAS_WIDTH_MM = 210;
const CANVAS_HEIGHT_MM = 148;

interface AlignmentGuide {
    type: 'h' | 'v';
    pos: number; // in pixels relative to canvas
}

const alignmentGuides = ref<AlignmentGuide[]>([]);

let dragStartPositions = new Map<string, { x: number; y: number }>();

const handleDragMove = (event: MouseEvent) => {
    if (!draggingElementId.value) return;
    const primaryEl = (cfgForm.printElements || []).find(e => e.id === draggingElementId.value);
    if (!primaryEl) return;
    
    const deltaX_px = event.clientX - dragStartMouseX;
    const deltaY_px = event.clientY - dragStartMouseY;
    const deltaX_mm = deltaX_px / currentMmToPx.value;
    const deltaY_mm = deltaY_px / currentMmToPx.value;
    
    // Tentative position of primary element (rounded to 0.5mm)
    let newPrimaryX = Math.round((Number(dragStartElX) + deltaX_mm) * 2) / 2;
    let newPrimaryY = Math.round((Number(dragStartElY) + deltaY_mm) * 2) / 2;
    
    // Snapping logic for primary element
    const SNAP_THRESHOLD_MM = 1.0; // 1mm threshold
    const guides: AlignmentGuide[] = [];
    const elements = cfgForm.printElements || [];
    
    let snappedX = false;
    let snappedY = false;
    
    const primaryW = Number(primaryEl.width) || 10;
    const primaryH = Number(primaryEl.height) || 5;
    
    for (const other of elements) {
        // Do not snap to any element that is currently selected/dragged together
        if (selectedElementIds.value.includes(other.id)) continue;
        
        const otherW = Number(other.width) || 10;
        const otherH = Number(other.height) || 5;
        const otherX = Number(other.x) || 0;
        const otherY = Number(other.y) || 0;
        
        // 1. Vertical snapping (X-axis)
        if (!snappedX) {
            // Left edge to Left edge
            if (Math.abs(newPrimaryX - otherX) < SNAP_THRESHOLD_MM) {
                newPrimaryX = otherX;
                snappedX = true;
                guides.push({ type: 'v', pos: otherX * currentMmToPx.value });
            }
            // Right edge to Right edge
            else if (Math.abs((newPrimaryX + primaryW) - (otherX + otherW)) < SNAP_THRESHOLD_MM) {
                newPrimaryX = otherX + otherW - primaryW;
                snappedX = true;
                guides.push({ type: 'v', pos: (otherX + otherW) * currentMmToPx.value });
            }
            // Left edge to Right edge
            else if (Math.abs(newPrimaryX - (otherX + otherW)) < SNAP_THRESHOLD_MM) {
                newPrimaryX = otherX + otherW;
                snappedX = true;
                guides.push({ type: 'v', pos: (otherX + otherW) * currentMmToPx.value });
            }
            // Right edge to Left edge
            else if (Math.abs((newPrimaryX + primaryW) - otherX) < SNAP_THRESHOLD_MM) {
                newPrimaryX = otherX - primaryW;
                snappedX = true;
                guides.push({ type: 'v', pos: otherX * currentMmToPx.value });
            }
            // Center to Center
            else if (Math.abs((newPrimaryX + primaryW / 2) - (otherX + otherW / 2)) < SNAP_THRESHOLD_MM) {
                newPrimaryX = otherX + otherW / 2 - primaryW / 2;
                snappedX = true;
                guides.push({ type: 'v', pos: (otherX + otherW / 2) * currentMmToPx.value });
            }
        }
        
        // 2. Horizontal snapping (Y-axis)
        if (!snappedY) {
            // Top edge to Top edge
            if (Math.abs(newPrimaryY - otherY) < SNAP_THRESHOLD_MM) {
                newPrimaryY = otherY;
                snappedY = true;
                guides.push({ type: 'h', pos: otherY * currentMmToPx.value });
            }
            // Bottom edge to Bottom edge
            else if (Math.abs((newPrimaryY + primaryH) - (otherY + otherH)) < SNAP_THRESHOLD_MM) {
                newPrimaryY = otherY + otherH - primaryH;
                snappedY = true;
                guides.push({ type: 'h', pos: (otherY + otherH) * currentMmToPx.value });
            }
            // Top edge to Bottom edge
            else if (Math.abs(newPrimaryY - (otherY + otherH)) < SNAP_THRESHOLD_MM) {
                newPrimaryY = otherY + otherH;
                snappedY = true;
                guides.push({ type: 'h', pos: (otherY + otherH) * currentMmToPx.value });
            }
            // Bottom edge to Top edge
            else if (Math.abs((newPrimaryY + primaryH) - otherY) < SNAP_THRESHOLD_MM) {
                newPrimaryY = otherY - primaryH;
                snappedY = true;
                guides.push({ type: 'h', pos: otherY * currentMmToPx.value });
            }
            // Center to Center
            else if (Math.abs((newPrimaryY + primaryH / 2) - (otherY + otherH / 2)) < SNAP_THRESHOLD_MM) {
                newPrimaryY = otherY + otherH / 2 - primaryH / 2;
                snappedY = true;
                guides.push({ type: 'h', pos: (otherY + otherH / 2) * currentMmToPx.value });
            }
        }
    }
    
    // Constrain boundaries for primary element
    newPrimaryX = Math.max(0, Math.min(CANVAS_WIDTH_MM - primaryW, newPrimaryX));
    newPrimaryY = Math.max(0, Math.min(CANVAS_HEIGHT_MM - primaryH, newPrimaryY));
    
    // Calculate raw delta based on primary element movement
    let actualDeltaX = newPrimaryX - Number(dragStartElX);
    let actualDeltaY = newPrimaryY - Number(dragStartElY);
    
    // Constrain delta so ALL selected elements stay within bounds
    // Find the group's bounding box extremes from starting positions
    selectedElementIds.value.forEach(id => {
        const item = elements.find(e => e.id === id);
        if (!item) return;
        const startPos = dragStartPositions.get(id);
        if (!startPos) return;
        
        const w = Number(item.width) || 10;
        const h = Number(item.height) || 5;
        const sx = Number(startPos.x) || 0;
        const sy = Number(startPos.y) || 0;
        
        // Clamp delta so this element's new position stays within [0, CANVAS - size]
        const maxDeltaX_pos = CANVAS_WIDTH_MM - w - sx;  // max positive delta
        const maxDeltaX_neg = -sx;                        // max negative delta
        const maxDeltaY_pos = CANVAS_HEIGHT_MM - h - sy;
        const maxDeltaY_neg = -sy;
        
        actualDeltaX = Math.max(maxDeltaX_neg, Math.min(maxDeltaX_pos, actualDeltaX));
        actualDeltaY = Math.max(maxDeltaY_neg, Math.min(maxDeltaY_pos, actualDeltaY));
    });
    
    // Recompute primary position based on the group-constrained delta
    newPrimaryX = Number(dragStartElX) + actualDeltaX;
    newPrimaryY = Number(dragStartElY) + actualDeltaY;
    
    // Strict safety clamp for primary element
    newPrimaryX = Math.max(0, Math.min(CANVAS_WIDTH_MM - (Number(primaryEl.width) || 10), newPrimaryX));
    newPrimaryY = Math.max(0, Math.min(CANVAS_HEIGHT_MM - (Number(primaryEl.height) || 5), newPrimaryY));
    
    primaryEl.x = newPrimaryX;
    primaryEl.y = newPrimaryY;
    
    // Move all other selected elements with the group-constrained delta
    selectedElementIds.value.forEach(id => {
        if (id === draggingElementId.value) return; // primary already set above
        const item = elements.find(e => e.id === id);
        if (!item) return;
        const startPos = dragStartPositions.get(id);
        if (!startPos) return;
        
        const sx = Number(startPos.x) || 0;
        const sy = Number(startPos.y) || 0;
        
        let newX = sx + actualDeltaX;
        let newY = sy + actualDeltaY;
        
        // Strict safety clamp for secondary elements
        newX = Math.max(0, Math.min(CANVAS_WIDTH_MM - (Number(item.width) || 10), newX));
        newY = Math.max(0, Math.min(CANVAS_HEIGHT_MM - (Number(item.height) || 5), newY));
        
        item.x = newX;
        item.y = newY;
    });
    
    alignmentGuides.value = guides;
};

const handleDragEnd = () => {
    draggingElementId.value = null;
    alignmentGuides.value = [];
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    // Safety: clamp ALL selected elements within bounds before saving
    selectedElementIds.value.forEach(id => {
        const el = (cfgForm.printElements || []).find(e => e.id === id);
        if (el) clampElement(el);
    });
    if (!showGlobalTemplateModal.value) {
        saveBargeConfig();
    }
};

const canEditLayout = () => {
    if (showGlobalTemplateModal.value) {
        return authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_layout_config', 'update');
    }
    return !cfgForm.locked && (authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_layout_config', 'update'));
};

const startDrag = (event: MouseEvent, el: PrintElement) => {
    if (!canEditLayout()) return;
    
    // Check if shift or ctrl is held to toggle selection
    if (event.shiftKey || event.ctrlKey) {
        if (selectedElementIds.value.includes(el.id)) {
            selectedElementIds.value = selectedElementIds.value.filter(id => id !== el.id);
            if (selectedElementId.value === el.id) {
                selectedElementId.value = selectedElementIds.value[0] || null;
            }
        } else {
            selectedElementIds.value.push(el.id);
            selectedElementId.value = el.id; // Make primary
        }
    } else {
        // Normal click: if not already selected, select it exclusively.
        // If already selected, do not clear selection (so user can drag group).
        if (!selectedElementIds.value.includes(el.id)) {
            selectedElementIds.value = [el.id];
            selectedElementId.value = el.id;
        } else {
            selectedElementId.value = el.id;
        }
    }
    
    draggingElementId.value = el.id;
    dragStartMouseX = event.clientX;
    dragStartMouseY = event.clientY;
    dragStartElX = Number(el.x) || 0;
    dragStartElY = Number(el.y) || 0;
    
    // Save starting positions for all selected elements
    dragStartPositions.clear();
    selectedElementIds.value.forEach(id => {
        const item = (cfgForm.printElements || []).find(e => e.id === id);
        if (item) {
            dragStartPositions.set(id, { x: Number(item.x) || 0, y: Number(item.y) || 0 });
        }
    });
    
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
};

const handleKeyDown = async (event: KeyboardEvent) => {
    if (!isOpen.value || (!showGlobalTemplateModal.value && activeTab.value !== 'config') || !canEditLayout() || selectedElementIds.value.length === 0) return;
    
    // Ignore Arrow and Delete key movements when user is typing in inputs/textareas/selects
    const activeEl = document.activeElement;
    if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) {
        return;
    }
    
    let deltaX = 0;
    let deltaY = 0;
    const step = event.shiftKey ? 1.0 : 0.2; // Shift key for larger steps (1mm vs 0.2mm)
    let handled = false;
    
    if (event.key === 'ArrowUp') {
        deltaY = -step;
        handled = true;
    } else if (event.key === 'ArrowDown') {
        deltaY = step;
        handled = true;
    } else if (event.key === 'ArrowLeft') {
        deltaX = -step;
        handled = true;
    } else if (event.key === 'ArrowRight') {
        deltaX = step;
        handled = true;
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
        const toDeleteIds = [...selectedElementIds.value];
        if (toDeleteIds.length > 0) {
            const confirmDelete = await showConfirm({
                title: 'Xóa phần tử thiết kế',
                message: `Bạn có muốn xóa ${toDeleteIds.length} phần tử đang chọn khỏi thiết kế mẫu in không?`,
                type: 'danger',
                okText: 'Xóa',
                cancelText: 'Hủy'
            });
            if (confirmDelete) {
                cfgForm.printElements = (cfgForm.printElements || []).filter(el => !toDeleteIds.includes(el.id));
                selectedElementIds.value = [];
                selectedElementId.value = null;
                saveBargeConfig();
            }
            handled = true;
        }
    }
    
    if (handled && (event.key.startsWith('Arrow'))) {
        event.preventDefault();
        
        // Constrain delta so ALL selected elements stay within bounds
        selectedElementIds.value.forEach(id => {
            const el = (cfgForm.printElements || []).find(e => e.id === id);
            if (!el) return;
            const elX = Number(el.x) || 0;
            const elY = Number(el.y) || 0;
            const elW = Number(el.width) || 10;
            const elH = Number(el.height) || 5;
            
            deltaX = Math.max(-elX, Math.min(CANVAS_WIDTH_MM - elW - elX, deltaX));
            deltaY = Math.max(-elY, Math.min(CANVAS_HEIGHT_MM - elH - elY, deltaY));
        });
        
        // Apply the group-constrained delta to all selected elements
        selectedElementIds.value.forEach(id => {
            const el = (cfgForm.printElements || []).find(e => e.id === id);
            if (!el) return;
            el.x = (Number(el.x) || 0) + deltaX;
            el.y = (Number(el.y) || 0) + deltaY;
        });
        
        saveBargeConfig();
    }
};

const deleteElement = (id: string) => {
    if (!canEditLayout()) return;
    const toDeleteIds = selectedElementIds.value.includes(id) 
        ? [...selectedElementIds.value] 
        : [id];
        
    cfgForm.printElements = (cfgForm.printElements || []).filter(el => !toDeleteIds.includes(el.id));
    selectedElementIds.value = selectedElementIds.value.filter(selId => !toDeleteIds.includes(selId));
    if (toDeleteIds.includes(selectedElementId.value || '')) {
        selectedElementId.value = selectedElementIds.value[0] || null;
    }
    saveBargeConfig();
};

const duplicateElement = (el: PrintElement) => {
    if (!canEditLayout()) return;
    const id = el.type + '_' + Date.now();
    const newEl: PrintElement = {
        ...el,
        id,
        x: Math.min(CANVAS_WIDTH_MM - el.width, el.x + 4),
        y: Math.min(CANVAS_HEIGHT_MM - el.height, el.y + 4)
    };
    cfgForm.printElements = [...(cfgForm.printElements || []), newEl];
    selectedElementId.value = id;
    saveBargeConfig();
};

const resetToDefaultLayout = async () => {
    if (!canEditLayout()) return;
    const confirm = await showConfirm({
        title: 'Khôi phục mẫu chuẩn',
        message: 'Bạn có chắc chắn muốn khôi phục thiết kế mẫu phiếu cân về ban đầu không?',
        type: 'warning',
        okText: 'Khôi phục',
        cancelText: 'Hủy'
    });
    if (confirm) {
        cfgForm.printElements = getDefaultPrintElements();
        selectedElementId.value = null;
        saveBargeConfigImmediately();
    }
};

const addStaticText = () => {
    if (!canEditLayout()) return;
    const id = 'text_' + Date.now();
    const newEl: PrintElement = {
        id,
        type: 'text',
        x: 10,
        y: 10,
        width: 50,
        height: 5,
        text: 'Chữ tĩnh mới',
        fontSize: 8.5,
        fontWeight: 'normal',
        align: 'left'
    };
    cfgForm.printElements = [...(cfgForm.printElements || []), newEl];
    selectedElementId.value = id;
    saveBargeConfig();
};

const addFieldElement = (fieldId: string, label: string) => {
    if (!canEditLayout()) return;
    const id = 'field_' + fieldId + '_' + Date.now();
    const newEl: PrintElement = {
        id,
        type: 'field',
        x: 10,
        y: 10,
        width: 80,
        height: 5,
        label,
        fieldId,
        labelWidth: 24,
        fontSize: 8.5
    };
    cfgForm.printElements = [...(cfgForm.printElements || []), newEl];
    selectedElementId.value = id;
    saveBargeConfig();
};

const addLineElement = (direction: 'horizontal' | 'vertical') => {
    if (!canEditLayout()) return;
    const id = 'line_' + direction + '_' + Date.now();
    const newEl: PrintElement = {
        id,
        type: 'line',
        x: 10,
        y: 10,
        width: direction === 'horizontal' ? 100 : 0.5,
        height: direction === 'horizontal' ? 0.5 : 50
    };
    cfgForm.printElements = [...(cfgForm.printElements || []), newEl];
    selectedElementId.value = id;
    saveBargeConfig();
};

const addRectElement = () => {
    if (!canEditLayout()) return;
    const id = 'rect_' + Date.now();
    const newEl: PrintElement = {
        id,
        type: 'rect',
        x: 10,
        y: 10,
        width: 60,
        height: 30,
        borderStyle: 'solid'
    };
    cfgForm.printElements = [...(cfgForm.printElements || []), newEl];
    selectedElementId.value = id;
    saveBargeConfig();
};

const getFieldValue = (fieldId: string, truck?: Truck) => {
    const sampleTruck = {
        id: 0,
        barge_id: 0,
        ticketNo: 'PC-001',
        plateNumber: '51C-123.45',
        driver: 'Nguyễn Văn Hùng',
        weight1: 35400,
        weight2: 12200,
        weightNet: 23200,
        dateIn: '2026-06-20T08:30:00Z',
        dateOut: '2026-06-20T09:00:00Z',
        note: 'Đạt chuẩn'
    };
    
    const t = truck || sampleTruck;
    
    switch (fieldId) {
        case 'ticketNo': return t.ticketNo || '';
        case 'plateNumber': return t.plateNumber;
        case 'goods': return activeVessel.value?.cargo_type || cfgForm.goods || '';
        case 'owner': return activeVessel.value?.customer || cfgForm.owner || '';
        case 'weight1': return `${formatNumber(t.weight1)} kg`;
        case 'weight2': return `${formatNumber(t.weight2)} kg`;
        case 'weightNet': return `${formatNumber(t.weightNet)} kg`;
        case 'words': return DocSoThanhChu(t.weightNet);
        case 'barge': return activeBarge.value?.name || 'Sà lan SG-9921';
        case 'note': return t.note || '-';
        case 'driver': return t.driver || '-';
        case 'goodsCode': return activeVessel.value?.cargo_code || cfgForm.goodsCode || '';
        case 'operator': return cfgForm.operator || '';
        case 'xn': {
            const val = cfgForm.xn || '';
            if (val.toUpperCase() === 'XUẤT KHẨU') return 'XUẤT';
            if (val.toUpperCase() === 'NHẬP KHẨU') return 'NHẬP';
            return val;
        }
        case 'dateIn': return t.dateIn ? formatDateTimeStr(t.dateIn) : '';
        case 'dateOut': return t.dateOut ? formatDateTimeStr(t.dateOut) : '';
        case 'chinhpham': {
            const val = String(cfgForm.chinhpham ?? '');
            if (!val) return '-';
            if (val.trim().endsWith('%') || isNaN(Number(val))) {
                return val;
            }
            return `${val} %`;
        }
        case 'phupham': {
            const val = String(cfgForm.phupham ?? '');
            if (!val) return '-';
            if (val.trim().endsWith('%') || isNaN(Number(val))) {
                return val;
            }
            return `${val} %`;
        }
        case 'ketluan': return cfgForm.ketluan || '-';
        default: return '';
    }
};



// Watch config form for auto-saving
watch(cfgForm, () => {
    saveBargeConfig();
}, { deep: true });

// Watch activeVesselId to automatically load vessel summary when switching vessels/barges
watch(activeVesselId, async (newVesselId) => {
    if (newVesselId) {
        await refreshVesselSummary();
    } else {
        vesselBargesSummary.value = [];
        await refreshGlobalBargesSummary();
    }
});

// Watch activeBargeId: if we return to the vessel summary view (activeBargeId becomes null)
watch(activeBargeId, async (newBargeId) => {
    if (newBargeId === null) {
        if (activeVesselId.value !== null) {
            await refreshVesselSummary();
        } else {
            await refreshGlobalBargesSummary();
        }
    }
});

function getNextTicketNumber(dateStr: string, existingTrucks: Truck[], currentSeed: string | number, excludeId?: number): string {
    let date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        date = new Date();
    }
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    const suffix = `${mm}${yy}`;
    
    let maxSerial = 0;
    let found = false;
    for (const t of existingTrucks) {
        if (excludeId && t.id === excludeId) continue;
        const parts = (t.ticketNo || '').split('/');
        if (parts.length === 2 && parts[1] === suffix) {
            found = true;
            const serialNum = parseInt(parts[0] || '0', 10);
            if (!isNaN(serialNum) && serialNum > maxSerial) {
                maxSerial = serialNum;
            }
        }
    }
    
    let nextSerial = 1;
    if (found) {
        nextSerial = maxSerial + 1;
    } else {
        const parsedSeed = parseInt(String(currentSeed), 10);
        if (!isNaN(parsedSeed) && parsedSeed > 0) {
            nextSerial = parsedSeed;
        }
    }
    
    const serialStr = String(nextSerial).padStart(6, '0');
    return `${serialStr}/${suffix}`;
}

function regenerateAllTicketNumbers(trucksList: Truck[], startingSeed: string | number): Truck[] {
    const sorted = [...trucksList].sort((a, b) => {
        const timeA = new Date(a.dateOut || a.dateIn || 0).getTime();
        const timeB = new Date(b.dateOut || b.dateIn || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.id - b.id;
    });

    const parsedSeed = parseInt(String(startingSeed), 10);
    const defaultStart = !isNaN(parsedSeed) && parsedSeed > 0 ? parsedSeed : 1;

    const serialCounters: Record<string, number> = {};

    return sorted.map(truck => {
        let date = new Date(truck.dateOut || truck.dateIn || '');
        if (isNaN(date.getTime())) {
            date = new Date();
        }
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yy = String(date.getFullYear()).slice(-2);
        const suffix = `${mm}${yy}`;

        if (serialCounters[suffix] === undefined) {
            serialCounters[suffix] = defaultStart - 1;
        }
        serialCounters[suffix]++;
        const serialStr = String(serialCounters[suffix]).padStart(6, '0');
        
        return {
            ...truck,
            ticketNo: `${serialStr}/${suffix}`
        };
    });
}

// Handle ticket prefix or seed change from UI to regenerate ticket numbers
const handleTicketConfigChange = async () => {
    const bargeId = activeBargeId.value;
    if (!bargeId) return;
    if (authStore.role !== 'admin' && !hasDetailPermission('weighbridge', 'wb_layout_config', 'update')) {
        showToast('Bạn không có quyền cấu hình số phiếu!', 'error');
        return;
    }
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể thay đổi số phiếu.', 'error');
        return;
    }

    // Save configuration immediately to Supabase
    saving.value = true;
    try {
        await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm });
        if (activeBarge.value) {
            activeBarge.value.config = { ...cfgForm };
        }
    } catch (e) {
        console.error('Error saving barge config:', e);
    } finally {
        saving.value = false;
    }

    if (trucks.value.length === 0) return;
    
    // Regenerate ticket numbers
    const updatedTrucks = regenerateAllTicketNumbers(trucks.value, cfgForm.ticketSeed);
    trucks.value = updatedTrucks;

    // Save updated list to Supabase
    saving.value = true;
    try {
        await WeighbridgeService.saveTrucks(bargeId, trucks.value);
        showToast('Đã cập nhật lại toàn bộ số phiếu xe!');
    } catch (e) {
        showToast('Lỗi khi cập nhật lại số phiếu xe!', 'error');
    } finally {
        saving.value = false;
    }
};

// Vessel Modal Controller
const openAddVesselModal = () => {
    if (authStore.role !== 'admin' && !hasDetailPermission('weighbridge', 'wb_vessel_manage', 'create')) {
        showToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    vesselForm.isEdit = false;
    vesselForm.id = 0;
    vesselForm.name = '';
    vesselForm.customer = masterData.value.customers[0] || '';
    vesselForm.cargo_type = masterData.value.goods[0]?.name || '';
    vesselForm.cargo_code = masterData.value.goods[0]?.code || '';
    vesselForm.customCustomer = false;
    vesselForm.customGoods = false;
    showVesselModal.value = true;
};

const openEditVesselModal = (vessel: Vessel) => {
    if (authStore.role !== 'admin' && !hasDetailPermission('weighbridge', 'wb_vessel_manage', 'update')) {
        showToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    vesselForm.isEdit = true;
    vesselForm.id = vessel.id;
    vesselForm.name = vessel.name;
    vesselForm.customer = vessel.customer || '';
    vesselForm.cargo_type = vessel.cargo_type || '';
    vesselForm.cargo_code = vessel.cargo_code || '';
    vesselForm.customCustomer = !masterData.value.customers.includes(vesselForm.customer) && !!vesselForm.customer;
    vesselForm.customGoods = !masterData.value.goods.some(g => g.name === vesselForm.cargo_type) && !!vesselForm.cargo_type;
    showVesselModal.value = true;
};

const onVesselCargoTypeChange = () => {
    if (vesselForm.customGoods) return;
    const found = masterData.value.goods.find(g => g.name === vesselForm.cargo_type);
    if (found) {
        vesselForm.cargo_code = found.code;
    }
};

const submitVesselModal = async () => {
    if (!vesselForm.name || !vesselForm.name.trim()) {
        showToast('Vui lòng nhập tên tàu!', 'warning');
        return;
    }
    const cleanName = vesselForm.name.trim().toUpperCase();
    const customer = vesselForm.customer.trim().toUpperCase();
    const cargo_type = vesselForm.cargo_type.trim().toUpperCase();
    const cargo_code = vesselForm.cargo_code.trim().toUpperCase();

    // Auto save to master data if new
    let masterDataChanged = false;
    if (customer && !masterData.value.customers.includes(customer)) {
        masterData.value.customers.push(customer);
        masterDataChanged = true;
    }
    if (cargo_type && !masterData.value.goods.some(g => g.name === cargo_type)) {
        masterData.value.goods.push({ name: cargo_type, code: cargo_code });
        masterDataChanged = true;
    }
    if (masterDataChanged) {
        await WeighbridgeService.saveMasterData(masterData.value);
    }

    loading.value = true;
    try {
        if (vesselForm.isEdit) {
            const success = await WeighbridgeService.updateVessel(vesselForm.id, {
                name: cleanName,
                customer,
                cargo_type,
                cargo_code
            });
            if (success) {
                await loadVessels();
                showToast(`Đã cập nhật thông tin tàu: ${cleanName}`);
                await LogService.logAction('Sửa tàu', `Cập nhật tàu: ${cleanName} - Khách: ${customer} - Hàng: ${cargo_type}`);
                showVesselModal.value = false;
            } else {
                showToast('Không thể cập nhật thông tin tàu!', 'error');
            }
        } else {
            const data = await WeighbridgeService.createVessel(cleanName, customer, cargo_type, cargo_code);
            if (data) {
                await loadVessels();
                expandedVesselIds.value[data.id] = true;
                showToast(`Đã thêm tàu: ${data.name}`);
                await LogService.logAction('Thêm tàu', `Thêm tàu: ${data.name} - Khách: ${customer} - Hàng: ${cargo_type}`);
                showVesselModal.value = false;
            } else {
                showToast('Không thể thêm tàu mới!', 'error');
            }
        }
    } catch (e) {
        showToast('Lỗi khi lưu thông tin tàu!', 'error');
    } finally {
        loading.value = false;
    }
};

// Aliases for backwards compatibility
const addVessel = () => openAddVesselModal();
const renameVessel = (id: number, _currentName: string) => {
    const v = vessels.value.find(item => item.id === id);
    if (v) openEditVesselModal(v);
};

// Master Data Modal Controller
const openMasterDataModal = () => {
    showMasterDataModal.value = true;
};

const addMasterCustomer = async () => {
    if (!newCustomerInput.value.trim()) return;
    const name = newCustomerInput.value.trim().toUpperCase();
    if (!masterData.value.customers.includes(name)) {
        masterData.value.customers.push(name);
        await WeighbridgeService.saveMasterData(masterData.value);
        showToast(`Đã thêm khách hàng: ${name}`);
        newCustomerInput.value = '';
    } else {
        showToast('Khách hàng này đã tồn tại trong danh mục!', 'warning');
    }
};

const removeMasterCustomer = async (index: number) => {
    const removed = masterData.value.customers.splice(index, 1);
    await WeighbridgeService.saveMasterData(masterData.value);
    showToast(`Đã xóa khách hàng: ${removed[0]}`);
};

const addMasterGoods = async () => {
    if (!newGoodsName.value.trim()) return;
    const name = newGoodsName.value.trim().toUpperCase();
    const code = newGoodsCode.value.trim().toUpperCase();
    if (!masterData.value.goods.some(g => g.name === name)) {
        masterData.value.goods.push({ name, code });
        await WeighbridgeService.saveMasterData(masterData.value);
        showToast(`Đã thêm loại hàng: ${name}`);
        newGoodsName.value = '';
        newGoodsCode.value = '';
    } else {
        showToast('Loại hàng này đã tồn tại trong danh mục!', 'warning');
    }
};

const removeMasterGoods = async (index: number) => {
    const removed = masterData.value.goods.splice(index, 1);
    await WeighbridgeService.saveMasterData(masterData.value);
    showToast(`Đã xóa loại hàng: ${removed[0]?.name}`);
};

// Global Standard Weigh Ticket Template Controller
const openGlobalTemplateModal = () => {
    if (authStore.role !== 'admin' && !hasDetailPermission('weighbridge', 'wb_layout_config', 'read')) {
        showToast('Bạn không có quyền xem cấu hình mẫu phiếu!', 'error');
        return;
    }
    if (globalTemplate.value.printElements) {
        cfgForm.printElements = JSON.parse(JSON.stringify(globalTemplate.value.printElements));
        cfgForm.printFields = JSON.parse(JSON.stringify(globalTemplate.value.printFields || getDefaultPrintFields()));
        cfgForm.companyName = globalTemplate.value.companyName;
        cfgForm.companyAddress = globalTemplate.value.companyAddress;
        cfgForm.companyPhone = globalTemplate.value.companyPhone;
        cfgForm.ticketTitle = globalTemplate.value.ticketTitle;
        cfgForm.signatures = globalTemplate.value.signatures;
    }
    showGlobalTemplateModal.value = true;
};

const saveGlobalTemplateFromModal = async () => {
    if (authStore.role !== 'admin' && !hasDetailPermission('weighbridge', 'wb_layout_config', 'update')) {
        showToast('Bạn không có quyền thay đổi mẫu phiếu chuẩn!', 'error');
        return;
    }
    saving.value = true;
    try {
        const tpl: WeighbridgeStandardTemplate = {
            printFields: cfgForm.printFields || getDefaultPrintFields(),
            printElements: JSON.parse(JSON.stringify(cfgForm.printElements || getDefaultPrintElements())),
            companyName: cfgForm.companyName || 'CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG NGUYÊN NGỌC',
            companyAddress: cfgForm.companyAddress || 'Địa chỉ: Số 167, tổ 78, Đường Đê Bao, Khu phố 9, Phường Phú An, TP. Hồ Chí Minh, Việt Nam',
            companyPhone: cfgForm.companyPhone || 'ĐT: 0964 258 671 / Fax:',
            ticketTitle: cfgForm.ticketTitle || 'PHIẾU CÂN XE',
            signatures: cfgForm.signatures || ['NV TRẠM CÂN', 'BẢO VỆ', 'CHỦ HÀNG', 'THỦ KHO', 'TÀI XẾ'],
            updatedAt: Date.now()
        };
        const ok = await WeighbridgeService.saveGlobalTicketTemplate(tpl);
        if (ok) {
            globalTemplate.value = tpl;
            showToast('Đã lưu mẫu phiếu cân chuẩn toàn cảng thành công! Toàn bộ sà lan đã được cập nhật.');
            await LogService.logAction('Cấu hình mẫu phiếu', 'Cập nhật mẫu phiếu cân chuẩn toàn cảng');
            showGlobalTemplateModal.value = false;
        } else {
            showToast('Không thể lưu mẫu phiếu chuẩn!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi lưu mẫu phiếu chuẩn!', 'error');
    } finally {
        saving.value = false;
    }
};

const resetGlobalTemplateToDefault = async () => {
    const confirmed = await showConfirm({
        title: 'Khôi phục mẫu phiếu mặc định',
        message: 'Bạn có chắc chắn muốn đặt lại toàn bộ tọa độ và mẫu in về trạng thái chuẩn ban đầu của Cảng Nguyên Ngọc?',
        type: 'warning',
        okText: 'Khôi phục',
        cancelText: 'Hủy'
    });
    if (!confirmed) return;
    cfgForm.printElements = getDefaultPrintElements();
    cfgForm.printFields = getDefaultPrintFields();
    cfgForm.companyName = 'CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG NGUYÊN NGỌC';
    cfgForm.companyAddress = 'Địa chỉ: Số 167, tổ 78, Đường Đê Bao, Khu phố 9, Phường Phú An, TP. Hồ Chí Minh, Việt Nam';
    cfgForm.companyPhone = 'ĐT: 0964 258 671 / Fax:';
    cfgForm.ticketTitle = 'PHIẾU CÂN XE';
    cfgForm.signatures = ['NV TRẠM CÂN', 'BẢO VỆ', 'CHỦ HÀNG', 'THỦ KHO', 'TÀI XẾ'];
    showToast('Đã khôi phục mẫu mặc định trong bộ soạn thảo. Hãy bấm "Lưu mẫu chuẩn" để áp dụng.');
};

const deleteVessel = async (id: number, name: string) => {
    const confirm = await showConfirm({
        title: 'Xóa tàu',
        message: `Bạn có chắc chắn muốn xóa tàu "${name}" cùng toàn bộ sà lan và dữ liệu cân xe của nó không? Hành động này sẽ xóa vĩnh viễn dữ liệu.`,
        type: 'danger',
        okText: 'Xóa tàu',
        cancelText: 'Hủy'
    });
    if (!confirm) return;

    if (authStore.role !== 'admin' && !hasDetailPermission('weighbridge', 'wb_vessel_manage')) {
        showToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }

    loading.value = true;
    try {
        const success = await WeighbridgeService.deleteVessel(id);
        if (success) {
            if (activeVesselId.value === id) {
                activeVesselId.value = null;
                activeBargeId.value = null;
                trucks.value = [];
            }
            await loadVessels();
            showToast(`Đã xóa tàu: ${name}`, 'error');
            await LogService.logAction('Xóa tàu', 'Xóa tàu: ' + name);
        } else {
            showToast('Không thể xóa tàu!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi xóa tàu!', 'error');
    } finally {
        loading.value = false;
    }
};

const handleCloseVessel = async (vesselId?: number) => {
    const targetId = vesselId || activeVesselId.value;
    if (!targetId) return;
    const targetVessel = vessels.value.find(v => v.id === targetId);
    if (!targetVessel) return;

    const confirmed = await showConfirm({
        title: 'Chốt số liệu tàu',
        message: `Bạn có chắc chắn muốn chốt số liệu cho tàu "${targetVessel.name}"? Sau khi chốt, tàu sẽ chuyển sang trạng thái "Đã xong", toàn bộ dữ liệu sà lan và phiếu cân sẽ ở chế độ Chỉ xem (Read-only) để ngăn sửa/xóa/nhập dữ liệu. Chỉ tài khoản Admin mới có quyền mở lại tàu này.`,
        type: 'warning',
        okText: 'Chốt số liệu',
        cancelText: 'Hủy'
    });
    if (!confirmed) return;

    isUpdatingVesselStatus.value = true;
    try {
        const success = await WeighbridgeService.updateVesselStatus(targetId, 'done');
        if (success) {
            targetVessel.status = 'done';
            selectedVesselStatusTab.value = 'done';
            showToast(`Đã chốt số liệu tàu: ${targetVessel.name}`, 'success');
            LogService.logAction('Chốt số liệu tàu', `Chuyển tàu ${targetVessel.name} sang trạng thái Đã xong`).catch(err => {
                console.warn('LogService logAction failed:', err);
            });
        } else {
            showToast('Không thể cập nhật trạng thái tàu!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi chốt số liệu tàu!', 'error');
    } finally {
        isUpdatingVesselStatus.value = false;
    }
};

const handleReopenVessel = async (vesselId?: number) => {
    if (authStore.role !== 'admin') {
        showToast('Chỉ tài khoản Quản trị viên (Admin) mới có quyền mở lại tàu!', 'error');
        return;
    }
    const targetId = vesselId || activeVesselId.value;
    if (!targetId) return;
    const targetVessel = vessels.value.find(v => v.id === targetId);
    if (!targetVessel) return;

    const confirmed = await showConfirm({
        title: 'Mở lại làm hàng cho tàu',
        message: `Bạn có chắc chắn muốn mở lại tàu "${targetVessel.name}" về trạng thái "Đang làm hàng"? Sau khi mở lại, người dùng có thể tiếp tục thêm, sửa, xóa sà lan và phiếu cân.`,
        type: 'info',
        okText: 'Mở lại làm hàng',
        cancelText: 'Hủy'
    });
    if (!confirmed) return;

    isUpdatingVesselStatus.value = true;
    try {
        const success = await WeighbridgeService.updateVesselStatus(targetId, 'in_progress');
        if (success) {
            targetVessel.status = 'in_progress';
            selectedVesselStatusTab.value = 'in_progress';
            showToast(`Đã mở lại làm hàng cho tàu: ${targetVessel.name}`, 'success');
            LogService.logAction('Mở lại tàu', `Chuyển tàu ${targetVessel.name} về trạng thái Đang làm hàng`).catch(err => {
                console.warn('LogService logAction failed:', err);
            });
        } else {
            showToast('Không thể mở lại tàu!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi mở lại tàu!', 'error');
    } finally {
        isUpdatingVesselStatus.value = false;
    }
};

// Barge CRUD
const addBarge = async (vesselId: number) => {
    const targetVessel = vessels.value.find(v => v.id === vesselId);
    if (targetVessel?.status === 'done') {
        showToast('Tàu này đã chốt số liệu (Đã xong), không thể thêm sà lan mới!', 'warning');
        return;
    }
    if (authStore.role !== 'admin' && !hasDetailPermission('weighbridge', 'wb_vessel_manage')) {
        showToast('Bạn không có quyền thêm sà lan mới!', 'error');
        return;
    }
    // Pre-calculate the next sequential order number
    let maxNum = 0;
    for (const vessel of vessels.value) {
        if (vessel.barges) {
            for (const barge of vessel.barges) {
                const orderStr = barge.config?.orderNo || '';
                const match = orderStr.match(/(\d+)$/);
                if (match) {
                    const num = parseInt(match[1] || '', 10);
                    if (num > maxNum) {
                        maxNum = num;
                    }
                } else {
                    const num = parseInt(orderStr, 10);
                    if (!isNaN(num) && num > maxNum) {
                        maxNum = num;
                    }
                }
            }
        }
    }
    const nextOrderNo = String(maxNum + 1);

    const result = await showBargeDialog('Thêm sà lan phân bổ mới', '', nextOrderNo);
    if (!result || !result.name.trim()) return;

    if (authStore.role !== 'admin' && !hasDetailPermission('weighbridge', 'wb_vessel_manage')) {
        showToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }

    loading.value = true;
    try {
        const data = await WeighbridgeService.createBarge(vesselId, result.name, result.orderNo);
        if (data) {
            await loadVessels();
            await selectBarge(vesselId, data.id);
            showToast(`Đã thêm sà lan: ${data.name}`);
            await LogService.logAction('Thêm sà lan', 'Thêm sà lan: ' + data.name);
        } else {
            showToast('Không thể thêm sà lan mới!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi thêm sà lan!', 'error');
    } finally {
        loading.value = false;
    }
};

const renameBarge = async (id: number, currentName: string) => {
    const targetVessel = vessels.value.find(v => v.barges?.some(b => b.id === id));
    if (targetVessel?.status === 'done') {
        showToast('Tàu này đã chốt số liệu (Đã xong), không thể chỉnh sửa sà lan!', 'warning');
        return;
    }
    if (authStore.role !== 'admin' && !hasDetailPermission('weighbridge', 'wb_vessel_manage')) {
        showToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }

    const barge = vessels.value.flatMap(v => v.barges || []).find(b => b.id === id);
    if (barge?.config?.locked) {
        showToast('Sà lan đang bị khóa! Vui lòng mở khóa để chỉnh sửa sà lan.', 'error');
        return;
    }

    const currentOrderNo = barge?.config?.orderNo || '';
    const result = await showBargeDialog('Chỉnh sửa thông tin sà lan', currentName, currentOrderNo);
    if (!result) return;

    const { name, orderNo } = result;

    loading.value = true;
    try {
        let nameUpdated = false;
        let configUpdated = false;

        if (name.trim() && name.trim() !== currentName) {
            const success = await WeighbridgeService.updateBarge(id, name);
            if (success) nameUpdated = true;
        }

        if (orderNo.trim() !== currentOrderNo) {
            const updatedConfig: BargeConfig = {
                goods: barge?.config?.goods || '',
                goodsCode: barge?.config?.goodsCode || '',
                owner: barge?.config?.owner || '',
                operator: barge?.config?.operator || '',
                xn: barge?.config?.xn || 'XUẤT KHẨU',
                ticketPrefix: barge?.config?.ticketPrefix || 'PC-',
                ticketSeed: barge?.config?.ticketSeed || 1,
                chinhpham: barge?.config?.chinhpham || '------------',
                phupham: barge?.config?.phupham || '------------',
                ketluan: barge?.config?.ketluan || '[ ] Đạt\n[ ] Không đạt',
                ...(barge?.config || {}),
                orderNo: orderNo.trim()
            };
            const success = await WeighbridgeService.updateBargeConfig(id, updatedConfig);
            if (success) configUpdated = true;
        }

        if (nameUpdated || configUpdated) {
            await loadVessels();
            if (activeBargeId.value === id && activeVesselId.value) {
                await selectBarge(activeVesselId.value, id);
            }
            showToast('Đã cập nhật thông tin sà lan!');
            await LogService.logAction('Sửa sà lan', 'Chỉnh sửa sà lan ID: ' + id + ', Tên mới: ' + name);
        }
    } catch (e) {
        showToast('Lỗi khi chỉnh sửa sà lan!', 'error');
    } finally {
        loading.value = false;
    }
};

const deleteBarge = async (_vesselId: number, id: number, name: string) => {
    const targetVessel = vessels.value.find(v => v.id === _vesselId || v.barges?.some(b => b.id === id));
    if (targetVessel?.status === 'done') {
        showToast('Tàu này đã chốt số liệu (Đã xong), không thể xóa sà lan!', 'warning');
        return;
    }
    if (authStore.role !== 'admin' && !hasDetailPermission('weighbridge', 'wb_vessel_manage')) {
        showToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const barge = vessels.value.flatMap(v => v.barges || []).find(b => b.id === id);
    if (barge?.config?.locked) {
        showToast('Sà lan đang bị khóa! Vui lòng mở khóa để xóa.', 'error');
        return;
    }

    const confirm = await showConfirm({
        title: 'Xóa sà lan',
        message: `Bạn có chắc chắn muốn xóa sà lan "${name}" cùng toàn bộ danh sách xe không? Hành động này sẽ xóa vĩnh viễn dữ liệu.`,
        type: 'danger',
        okText: 'Xóa sà lan',
        cancelText: 'Hủy'
    });
    if (!confirm) return;

    loading.value = true;
    try {
        const success = await WeighbridgeService.deleteBarge(id);
        if (success) {
            if (activeBargeId.value === id) {
                activeBargeId.value = null;
                trucks.value = [];
            }
            await loadVessels();
            showToast(`Đã xóa sà lan: ${name}`, 'error');
            await LogService.logAction('Xóa sà lan', 'Xóa sà lan: ' + name);
        } else {
            showToast('Không thể xóa sà lan!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi xóa sà lan!', 'error');
    } finally {
        loading.value = false;
    }
};

// Drag & drop state for moving barges between vessels
const draggedBarge = ref<{
    vesselId: number;
    bargeId: number;
    bargeName: string;
} | null>(null);
const dragOverVesselId = ref<number | null>(null);

// Move barge modal state
const showMoveBargeModal = ref(false);
const moveBargeTarget = ref<{
    bargeId: number;
    bargeName: string;
    sourceVesselId: number;
    sourceVesselName: string;
    targetVesselId: number | null;
} | null>(null);
const isMovingBarge = ref(false);

const availableTargetVessels = computed(() => {
    if (!moveBargeTarget.value) return [];
    return vessels.value.filter(v => 
        v.id !== moveBargeTarget.value!.sourceVesselId && 
        v.status !== 'done'
    );
});

function handleBargeDragStart(event: DragEvent, vessel: Vessel, barge: Barge) {
    if (vessel.status === 'done' || barge.config?.locked) {
        event.preventDefault();
        return;
    }
    draggedBarge.value = {
        vesselId: vessel.id,
        bargeId: barge.id,
        bargeName: barge.name
    };
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify(draggedBarge.value));
    }
}

function handleBargeDragEnd() {
    draggedBarge.value = null;
    dragOverVesselId.value = null;
}

function handleVesselDragOver(event: DragEvent, targetVessel: Vessel) {
    if (!draggedBarge.value) return;
    if (draggedBarge.value.vesselId === targetVessel.id || targetVessel.status === 'done') {
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'none';
        }
        return;
    }
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
    }
    dragOverVesselId.value = targetVessel.id;
}

function handleVesselDragLeave(_event: DragEvent, targetVessel: Vessel) {
    if (dragOverVesselId.value === targetVessel.id) {
        dragOverVesselId.value = null;
    }
}

function handleVesselDrop(_event: DragEvent, targetVessel: Vessel) {
    dragOverVesselId.value = null;
    if (!draggedBarge.value) return;
    if (draggedBarge.value.vesselId === targetVessel.id) {
        draggedBarge.value = null;
        return;
    }
    if (targetVessel.status === 'done') {
        showToast('Không thể chuyển sà lan vào tàu đã chốt số liệu!', 'error');
        draggedBarge.value = null;
        return;
    }

    const sourceVessel = vessels.value.find(v => v.id === draggedBarge.value!.vesselId);
    moveBargeTarget.value = {
        bargeId: draggedBarge.value.bargeId,
        bargeName: draggedBarge.value.bargeName,
        sourceVesselId: draggedBarge.value.vesselId,
        sourceVesselName: sourceVessel?.name || 'Tàu nguồn',
        targetVesselId: targetVessel.id
    };
    showMoveBargeModal.value = true;
    draggedBarge.value = null;
}

function openMoveBargeModal(vessel: Vessel, barge: Barge) {
    if (vessel.status === 'done') {
        showToast('Tàu này đã chốt số liệu, không thể chuyển sà lan!', 'error');
        return;
    }
    if (barge.config?.locked) {
        showToast('Sà lan đang bị khóa, vui lòng mở khóa trước khi chuyển!', 'warning');
        return;
    }
    
    const firstAvailableTarget = vessels.value.find(v => v.id !== vessel.id && v.status !== 'done');

    moveBargeTarget.value = {
        bargeId: barge.id,
        bargeName: barge.name,
        sourceVesselId: vessel.id,
        sourceVesselName: vessel.name,
        targetVesselId: firstAvailableTarget ? firstAvailableTarget.id : null
    };
    showMoveBargeModal.value = true;
}

async function confirmMoveBarge() {
    if (!moveBargeTarget.value || !moveBargeTarget.value.targetVesselId) {
        showToast('Vui lòng chọn tàu đích để chuyển sà lan!', 'warning');
        return;
    }
    const { bargeId, bargeName, sourceVesselName, targetVesselId } = moveBargeTarget.value;
    const targetVessel = vessels.value.find(v => v.id === targetVesselId);
    if (!targetVessel) {
        showToast('Không tìm thấy tàu đích!', 'error');
        return;
    }
    if (targetVessel.status === 'done') {
        showToast('Không thể chuyển vào tàu đã chốt số liệu!', 'error');
        return;
    }

    isMovingBarge.value = true;
    try {
        const success = await WeighbridgeService.moveBarge(bargeId, targetVesselId);
        if (success) {
            showToast(`Đã chuyển sà lan "${bargeName}" từ "${sourceVesselName}" sang "${targetVessel.name}" thành công! 🚢`, 'success');
            await LogService.logAction('Chuyển tàu mẹ sà lan', `Chuyển "${bargeName}" từ "${sourceVesselName}" sang "${targetVessel.name}"`);
            
            await loadVessels();
            expandedVesselIds.value[targetVesselId] = true;
            
            if (activeBargeId.value === bargeId) {
                activeVesselId.value = targetVesselId;
            } else if (activeVesselId.value !== null) {
                await refreshVesselSummary();
            }
            await refreshGlobalBargesSummary();
            
            showMoveBargeModal.value = false;
            moveBargeTarget.value = null;
        } else {
            showToast('Chuyển sà lan thất bại, vui lòng thử lại!', 'error');
        }
    } catch (err) {
        console.error('Error moving barge:', err);
        showToast('Lỗi khi chuyển sà lan!', 'error');
    } finally {
        isMovingBarge.value = false;
    }
}

// Smart name normalization and matching for allocator sync

function isBargeMatch(trip: any, barge: Barge): boolean {
    // Match strictly by orderNo. If barge has no orderNo, return false
    const bargeOrderNo = barge.config?.orderNo ? String(barge.config.orderNo).trim().toLowerCase() : '';
    const tripOrderNo = trip.orderNo ? String(trip.orderNo).trim().toLowerCase() : '';
    
    if (bargeOrderNo) {
        return bargeOrderNo === tripOrderNo;
    }
    
    return false;
}

async function autoSyncAllBarges(isManual = false) {
    try {
        let allocatorTrips: any[] = [];
        try {
            const { data, error: fetchError } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();
                
            if (!fetchError && data?.settings) {
                allocatorTrips = data.settings.allocator_tickets || [];
                await dbContext.set('allocator_tickets', allocatorTrips);
            } else {
                allocatorTrips = await dbContext.get<any[]>('allocator_tickets') || [];
            }
        } catch (dbErr) {
            console.error('Lỗi khi truy xuất dữ liệu đồng bộ:', dbErr);
            allocatorTrips = await dbContext.get<any[]>('allocator_tickets') || [];
        }

        if (!Array.isArray(allocatorTrips) || allocatorTrips.length === 0) {
            if (isManual) {
                const emptyMsg = 'Không tìm thấy phiếu cân nào trong Dữ liệu cân hàng để đồng bộ!';
                showToast(emptyMsg);
                syncChannel.postMessage({ type: 'sync_response', message: emptyMsg, status: 'success' });
            }
            return;
        }

        // Check if any matched barge for allocatorTrips is locked
        const lockedBarges: string[] = [];
        for (const vessel of vessels.value) {
            if (vessel.barges) {
                for (const barge of vessel.barges) {
                    const hasMatch = allocatorTrips.some((t: any) => isBargeMatch(t, barge));
                    if (hasMatch && barge.config?.locked) {
                        lockedBarges.push(`"${barge.name}" (${barge.config.orderNo || ''})`);
                    }
                }
            }
        }

        if (lockedBarges.length > 0) {
            const errorMsg = `Đồng bộ thất bại! Sà lan đang khóa: ${lockedBarges.join(', ')}. Vui lòng mở khóa trước.`;
            showToast(errorMsg, 'error');
            syncChannel.postMessage({ type: 'sync_response', message: errorMsg, status: 'error' });
            return;
        }

        let hasUpdates = false;
        let matchedBargeCount = 0;
        
        for (const vessel of vessels.value) {
            if (!vessel.barges) continue;
            for (const barge of vessel.barges) {
                if (barge.config?.locked) continue;
                const bargeOrderNo = barge.config?.orderNo ? String(barge.config.orderNo).trim() : '';
                if (!bargeOrderNo) continue;

                // Filter trips for this barge
                const matchedTrips = allocatorTrips.filter((t: any) => isBargeMatch(t, barge));
                if (matchedTrips.length === 0) continue;

                matchedBargeCount++;

                // Map to Truck type
                const importedTrucks: Truck[] = matchedTrips.map((t: any, idx: number) => {
                    let dIn = '';
                    let dOut = '';
                    try {
                        if (t.dateInStr && t.timeInStr) {
                            dIn = parseExcelDate(`${t.dateInStr} ${t.timeInStr}`);
                        } else if (t.date1Obj) {
                            dIn = parseExcelDate(t.date1Obj);
                        } else if (t.dateInStr) {
                            dIn = parseExcelDate(t.dateInStr);
                        }

                        if (t.dateOutStr && t.timeOutStr) {
                            dOut = parseExcelDate(`${t.dateOutStr} ${t.timeOutStr}`);
                        } else if (t.date2Obj) {
                            dOut = parseExcelDate(t.date2Obj);
                        } else if (t.dateOutStr) {
                            dOut = parseExcelDate(t.dateOutStr);
                        }
                    } catch (e) {
                        console.warn('Error parsing date:', e);
                    }

                    if (!dIn) {
                        const now = new Date();
                        const y = now.getFullYear();
                        const m = String(now.getMonth() + 1).padStart(2, '0');
                        const day = String(now.getDate()).padStart(2, '0');
                        const h = String(now.getHours()).padStart(2, '0');
                        const min = String(now.getMinutes()).padStart(2, '0');
                        dIn = `${y}-${m}-${day}T${h}:${min}`;
                    }
                    if (!dOut) {
                        dOut = dIn;
                    }

                    return {
                        id: Date.now() + idx,
                        barge_id: barge.id,
                        ticketNo: t.ticketNo || '',
                        sourceTicketNo: t.ticketNo || t.sourceTicketNo || '', // Original CSV ticketNo for dedup
                        plateNumber: t.plateNumber || '',
                        driver: t.driverName || t.driver || '',
                        weight1: Number(t.weight1) || 0,
                        weight2: Number(t.weight2) || 0,
                        weightNet: Number(t.weightNet) || 0,
                        dateIn: dIn,
                        dateOut: dOut,
                        note: t.notes || t.note || ''
                    };
                });

                const currentTrucks = await WeighbridgeService.getTrucks(barge.id);
                
                const normPlate = (p: string) => p.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
                const tripsToAdd = importedTrucks.filter(tr => {
                    if (tr.ticketNo) {
                        return !currentTrucks.some(ct => ct.ticketNo === tr.ticketNo);
                    }
                    return !currentTrucks.some(ct => 
                        normPlate(ct.plateNumber || '') === normPlate(tr.plateNumber || '') && 
                        ct.weightNet === tr.weightNet &&
                        ct.dateOut === tr.dateOut
                    );
                });

                const mergedTrucks = [...currentTrucks, ...tripsToAdd];

                let currentSeed = barge.config?.ticketSeed || '1';
                for (const tr of mergedTrucks) {
                    if (!tr.ticketNo) {
                        tr.ticketNo = getNextTicketNumber(tr.dateOut || tr.dateIn, mergedTrucks, currentSeed, tr.id);
                        const serialPart = tr.ticketNo.split('/')[0];
                        currentSeed = (parseInt(serialPart || '0', 10) || 1) + 1;
                    }
                }

                // Compare mergedTrucks and currentTrucks to prevent redundant saves/toasts
                let isIdentical = mergedTrucks.length === currentTrucks.length;
                if (isIdentical) {
                    for (let i = 0; i < mergedTrucks.length; i++) {
                        const mt = mergedTrucks[i]!;
                        const ct = currentTrucks[i]!;
                        if (
                            mt.ticketNo !== ct.ticketNo ||
                            mt.plateNumber !== ct.plateNumber ||
                            mt.weight1 !== ct.weight1 ||
                            mt.weight2 !== ct.weight2 ||
                            mt.weightNet !== ct.weightNet ||
                            mt.note !== ct.note
                        ) {
                            isIdentical = false;
                            break;
                        }
                    }
                }

                if (isIdentical) continue;

                // Auto-sync merges/updates the trucks list with matchedTrips
                const success = await WeighbridgeService.saveTrucks(barge.id, mergedTrucks);
                if (success) {
                    hasUpdates = true;
                    barge.config.ticketSeed = String(currentSeed).padStart(6, '0');
                    await WeighbridgeService.updateBargeConfig(barge.id, barge.config);
                    
                    // If this is the currently active barge, reload trucks ref
                    if (activeBargeId.value === barge.id) {
                        trucks.value = mergedTrucks;
                        cfgForm.ticketSeed = barge.config.ticketSeed;
                    }
                }
            }
        }
        if (hasUpdates) {
            const successMsg = 'Đã đồng bộ danh sách xe qua Phần mềm in phiếu cân thành công! 🚢';
            showToast(successMsg, 'success');
            syncChannel.postMessage({ type: 'sync_response', message: successMsg, status: 'success' });
        } else if (isManual) {
            if (matchedBargeCount === 0) {
                const noBargeMsg = 'Không tìm thấy sà lan nào trùng khớp mã lệnh để đồng bộ!';
                showToast(noBargeMsg);
                syncChannel.postMessage({ type: 'sync_response', message: noBargeMsg, status: 'success' });
            } else {
                const upToDateMsg = 'Dữ liệu xe của các sà lan đã trùng khớp, không cần đồng bộ thêm!';
                showToast(upToDateMsg);
                syncChannel.postMessage({ type: 'sync_response', message: upToDateMsg, status: 'success' });
            }
        }
    } catch (e) {
        console.error('Lỗi khi tự động đồng bộ từ phân bổ:', e);
    }
}

// Sync allocator trips for a single active barge
const syncFromAllocatorActiveBarge = async () => {
    if (isCurrentVesselDone.value) {
        showToast('Tàu này đã chốt số liệu (Đã xong), không thể đồng bộ dữ liệu mới!', 'warning');
        return;
    }
    if (authStore.role !== 'admin' && !canCreate()) {
        showToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const bargeId = activeBargeId.value;
    if (!bargeId || !activeBarge.value) {
        showToast('Vui lòng chọn một sà lan trước!', 'error');
        return;
    }

    
    const bargeOrderNo = activeBarge.value.config?.orderNo ? String(activeBarge.value.config.orderNo).trim() : '';
    if (!bargeOrderNo) {
        showToast(`Cảnh báo: Sà lan "${activeBarge.value.name}" chưa được cấu hình Mã lệnh!`, 'error');
        return;
    }

    loading.value = true;
    try {
        const { data, error: fetchError } = await supabase
            .from('content')
            .select('settings')
            .eq('id', 'main')
            .single();

        let allocatorTrips: any[] = [];
        if (!fetchError && data?.settings) {
            allocatorTrips = data.settings.allocator_tickets || [];
            await dbContext.set('allocator_tickets', allocatorTrips);
        } else {
            allocatorTrips = await dbContext.get<any[]>('allocator_tickets') || [];
        }

        if (!Array.isArray(allocatorTrips) || allocatorTrips.length === 0) {
            showToast('Không tìm thấy phiếu cân nào trong Dữ liệu cân hàng. Hãy import phiếu cân trước!', 'error');
            return;
        }

        const activeBargeName = activeBarge.value.name;
        // Filter trips for this active barge (matches strictly by orderNo)
        const matchedTrips = allocatorTrips.filter((t: any) => isBargeMatch(t, activeBarge.value!));

        if (matchedTrips.length === 0) {
            showToast(`Không tìm thấy phiếu cân nào có mã lệnh "${bargeOrderNo}" (Sà lan "${activeBargeName}") trong Dữ liệu cân hàng!`, 'error');
            return;
        }

        // Get current trucks
        const currentTrucks = await WeighbridgeService.getTrucks(bargeId);
        let action: 'overwrite' | 'append' = 'append';

        if (currentTrucks.length > 0) {
            const confirmOverwrite = await showConfirm({
                title: 'Đồng bộ danh sách xe sà lan',
                message: `Sà lan này đang có ${currentTrucks.length} xe.\n\n- Chọn Ghi đè: Để xóa các xe cũ và chỉ giữ danh sách xe mới từ Dữ liệu cân hàng.\n- Chọn Thêm tiếp: Để giữ lại xe cũ và cộng dồn thêm xe mới.`,
                type: 'warning',
                okText: 'Ghi đè',
                cancelText: 'Thêm tiếp'
            });
            action = confirmOverwrite ? 'overwrite' : 'append';
        }

        const importedTrucks: Truck[] = matchedTrips.map((t: any, idx: number) => {
            let dIn = '';
            let dOut = '';
            try {
                if (t.dateInStr && t.timeInStr) {
                    dIn = parseExcelDate(`${t.dateInStr} ${t.timeInStr}`);
                } else if (t.date1Obj) {
                    dIn = parseExcelDate(t.date1Obj);
                } else if (t.dateInStr) {
                    dIn = parseExcelDate(t.dateInStr);
                }

                if (t.dateOutStr && t.timeOutStr) {
                    dOut = parseExcelDate(`${t.dateOutStr} ${t.timeOutStr}`);
                } else if (t.date2Obj) {
                    dOut = parseExcelDate(t.date2Obj);
                } else if (t.dateOutStr) {
                    dOut = parseExcelDate(t.dateOutStr);
                }
            } catch (e) {
                console.warn('Error parsing date:', e);
            }

            if (!dIn) {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const h = String(now.getHours()).padStart(2, '0');
                const min = String(now.getMinutes()).padStart(2, '0');
                dIn = `${y}-${m}-${day}T${h}:${min}`;
            }
            if (!dOut) {
                dOut = dIn;
            }

            return {
                id: Date.now() + idx,
                barge_id: bargeId,
                ticketNo: t.ticketNo || '',
                sourceTicketNo: t.ticketNo || t.sourceTicketNo || '', // Original CSV ticketNo for dedup
                plateNumber: t.plateNumber || '',
                driver: t.driverName || t.driver || '',
                weight1: Number(t.weight1) || 0,
                weight2: Number(t.weight2) || 0,
                weightNet: Number(t.weightNet) || 0,
                dateIn: dIn,
                dateOut: dOut,
                note: t.notes || t.note || ''
            };
        });

        let currentSeed = cfgForm.ticketSeed || '1';
        let allTrucks: Truck[] = [];
        if (action === 'overwrite') {
            await WeighbridgeService.deleteAllTrucksForBarge(bargeId);
            for (const tr of importedTrucks) {
                if (!tr.ticketNo) {
                    tr.ticketNo = getNextTicketNumber(tr.dateOut || tr.dateIn, importedTrucks, currentSeed, tr.id);
                    const serialPart = tr.ticketNo.split('/')[0];
                    currentSeed = (parseInt(serialPart || '0', 10) || 1) + 1;
                }
            }
            allTrucks = importedTrucks;
        } else {
            const normPlate = (p: string) => p.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
            const tripsToAdd = importedTrucks.filter(tr => {
                if (tr.ticketNo) {
                    return !currentTrucks.some(ct => ct.ticketNo === tr.ticketNo);
                }
                return !currentTrucks.some(ct => 
                    normPlate(ct.plateNumber || '') === normPlate(tr.plateNumber || '') && 
                    ct.weightNet === tr.weightNet &&
                    ct.dateOut === tr.dateOut
                );
            });

            allTrucks = [...currentTrucks, ...tripsToAdd];
            for (const tr of allTrucks) {
                if (!tr.ticketNo) {
                    tr.ticketNo = getNextTicketNumber(tr.dateOut || tr.dateIn, allTrucks, currentSeed, tr.id);
                    const serialPart = tr.ticketNo.split('/')[0];
                    currentSeed = (parseInt(serialPart || '0', 10) || 1) + 1;
                }
            }
        }

        const success = await WeighbridgeService.saveTrucks(bargeId, allTrucks);
        if (success) {
            cfgForm.ticketSeed = String(currentSeed).padStart(6, '0');
            await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm });
            showToast(`Đồng bộ thành công ${importedTrucks.length} xe từ Phân rã chuyến!`);
            trucks.value = await WeighbridgeService.getTrucks(bargeId);
        } else {
            showToast('Không thể lưu danh sách xe sau đồng bộ!', 'error');
        }
    } catch (e: any) {
        console.error(e);
        showToast('Lỗi khi đồng bộ dữ liệu: ' + (e.message || e), 'error');
    } finally {
        loading.value = false;
    }
};

// Sync allocator trips for all barges on active vessel


// Excel Upload and Analysis
const handleExcelFile = async (file: File) => {
    if (isCurrentVesselDone.value) {
        showToast('Tàu này đã chốt số liệu (Đã xong), không thể nhập Excel!', 'warning');
        return;
    }
    if (authStore.role !== 'admin' && !canCreate()) {
        showToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    if (!activeBargeId.value) {
        showToast('Vui lòng chọn một sà lan trước!', 'error');
        return;
    }
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể nhập Excel.', 'error');
        return;
    }
    
    loading.value = true;
    try {
        const workbook = await excelService.readExcel(file);
        const worksheet = excelService.getWorksheet(workbook, 0);
        
        if (!worksheet) {
            showToast('File Excel không có dữ liệu!', 'error');
            return;
        }

        const rawRows: any[][] = [];
        worksheet.eachRow({ includeEmpty: true }, (row) => {
            const rowValues: any[] = [];
            const values = (row.values as any[]) || [];
            // values[1] is column A. Let's copy values to a 0-based array.
            for (let col = 1; col < values.length; col++) {
                const val = values[col];
                if (val && typeof val === 'object') {
                    if ('result' in val) {
                        rowValues.push(val.result);
                    } else if ('text' in val) {
                        rowValues.push(val.text);
                    } else if (val instanceof Date) {
                        rowValues.push(val);
                    } else {
                        rowValues.push(val.toString());
                    }
                } else {
                    rowValues.push(val);
                }
            }
            rawRows.push(rowValues);
        });

        if (rawRows.length === 0) {
            showToast('File Excel rỗng!', 'error');
            return;
        }

        // Fuzzy match headers
        analyzeExcelHeaders(rawRows);
    } catch (err: any) {
        showToast('Lỗi phân tích file Excel: ' + err.message, 'error');
    } finally {
        loading.value = false;
    }
};

const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
        const file = target.files[0];
        if (file) handleExcelFile(file);
    }
    target.value = '';
};

const handleExcelDrop = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file) handleExcelFile(file);
    }
};

const analyzeExcelHeaders = (rawRows: any[][]) => {
    let headerRowIndex = -1;
    let maxMatches = 0;

    const keywords: Record<ExcelField, string[]> = {
        ticketNo: ["số phiếu", "phiếu số", "phieu", "ticket", "mã phiếu", "ma phieu", "so phieu"],
        plateNumber: ["biển số xe", "biển số", "số xe", "biển xe", "sks", "số kiểm soát", "plate", "phương tiện", "so xe", "bien so"],
        weight1: ["lần 1", "trọng lượng 1", "tl 1", "cân 1", "lần một", "gross", "tổng", "lan 1", "kl can lan 1", "kl1"],
        weight2: ["lần 2", "trọng lượng 2", "tl 2", "cân 2", "lần hai", "tare", "xác xe", "xác", "lan 2", "kl can lan 2", "kl2"],
        weightNet: ["trọng lượng hàng", "khối lượng hàng", "hàng", "tịnh", "net", "khối lượng tịnh", "kl tịnh", "kl hang", "kl tinh"],
        dateIn: ["ngày giờ vào", "thời gian vào", "giờ vào", "ngày vào", "vào", "time in", "ngay can lan 1"],
        dateOut: ["ngày giờ ra", "thời gian ra", "giờ ra", "ngày ra", "ra", "time out", "ngay can lan 2"],
        driver: ["tài xế", "tên tài xế", "tài", "lái xe", "driver", "tai xe"],
        note: ["ghi chú", "note", "diễn giải", "ghi chú thêm", "ghi chu"]
    };

    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
        const row = rawRows[r];
        if (!row || !Array.isArray(row)) continue;

        let matches = 0;
        row.forEach(cell => {
            if (cell === null || cell === undefined) return;
            const val = removeAccents(String(cell).toLowerCase().trim());
            
            Object.values(keywords).forEach(kwList => {
                if (kwList.some(kw => val.includes(removeAccents(kw)))) {
                    matches++;
                }
            });
        });

        if (matches > maxMatches) {
            maxMatches = matches;
            headerRowIndex = r;
        }
    }

    if (headerRowIndex === -1) {
        headerRowIndex = 0;
    }

    const headerRow = rawRows[headerRowIndex];
    if (!headerRow) {
        showToast('Không đọc được tiêu đề Excel!', 'error');
        return;
    }

    const columns: ExcelColumn[] = headerRow.map((cell, idx) => ({
        index: idx,
        name: cell !== undefined && cell !== null ? String(cell).trim() : `Cột ${idx + 1}`
    }));

    const mapping: Record<ExcelField, number> = {
        ticketNo: -1,
        plateNumber: -1,
        weight1: -1,
        weight2: -1,
        weightNet: -1,
        dateIn: -1,
        dateOut: -1,
        driver: -1,
        note: -1
    };

    const usedColumns = new Set<number>();
    const fieldPriority: ExcelField[] = ['plateNumber', 'weight1', 'weight2', 'ticketNo', 'weightNet', 'dateIn', 'dateOut', 'driver', 'note'];

    fieldPriority.forEach(field => {
        const fieldKwList = keywords[field];
        let bestColIndex = -1;
        let bestMatchLen = 0;

        columns.forEach(col => {
            if (usedColumns.has(col.index)) return;
            const nameLower = removeAccents(col.name.toLowerCase());

            fieldKwList.forEach(kw => {
                const kwClean = removeAccents(kw);
                if (nameLower.includes(kwClean)) {
                    if (kwClean.length > bestMatchLen) {
                        bestMatchLen = kwClean.length;
                        bestColIndex = col.index;
                    }
                }
            });
        });

        if (bestColIndex !== -1) {
            mapping[field] = bestColIndex;
            usedColumns.add(bestColIndex);
        }
    });

    pendingExcelData.value = {
        rawRows,
        headerIndex: headerRowIndex,
        columns,
        mapping
    };

    showMappingModal.value = true;
};

const parseExcelDate = (val: any): string => {
    if (!val) return '';
    if (val instanceof Date) {
        if (isNaN(val.getTime())) return '';
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        const h = String(val.getHours()).padStart(2, '0');
        const min = String(val.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${d}T${h}:${min}`;
    }
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        const h = String(date.getUTCHours()).padStart(2, '0');
        const min = String(date.getUTCMinutes()).padStart(2, '0');
        return `${y}-${m}-${d}T${h}:${min}`;
    }
    const str = String(val).trim();

    // 1. ISO format: YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm
    const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[T\s]+(\d{1,2}):(\d{1,2})/);
    if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3] && isoMatch[4] && isoMatch[5]) {
        const y = isoMatch[1];
        const m = String(isoMatch[2]).padStart(2, '0');
        const d = String(isoMatch[3]).padStart(2, '0');
        const h = String(isoMatch[4]).padStart(2, '0');
        const min = String(isoMatch[5]).padStart(2, '0');
        return `${y}-${m}-${d}T${h}:${min}`;
    }

    // 2. Vietnamese format: DD/MM/YYYY HH:mm[:ss] [AM/PM]
    const dMyHm = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{1,2})(?::\d{1,2})?\s*(AM|PM|am|pm)?/i);
    if (dMyHm && dMyHm[1] && dMyHm[2] && dMyHm[3] && dMyHm[4] && dMyHm[5]) {
        let p1 = parseInt(dMyHm[1] || '1', 10);
        let p2 = parseInt(dMyHm[2] || '1', 10);
        const y = dMyHm[3];
        let hour = parseInt(dMyHm[4] || '0', 10);
        const min = String(dMyHm[5]).padStart(2, '0');
        const ampm = (dMyHm[6] || '').toUpperCase();

        // AM/PM conversion to 24h
        if (ampm === 'PM' && hour < 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;

        let day = p1;
        let month = p2;
        if (p1 <= 12 && p2 > 12) {
            month = p1;
            day = p2;
        } else {
            day = p1;
            month = p2;
        }

        const mStr = String(month).padStart(2, '0');
        const dStr = String(day).padStart(2, '0');
        const hStr = String(hour).padStart(2, '0');
        return `${y}-${mStr}-${dStr}T${hStr}:${min}`;
    }

    // 3. Date only: DD/MM/YYYY
    const dMyOnly = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dMyOnly && dMyOnly[1] && dMyOnly[2] && dMyOnly[3]) {
        let day = parseInt(dMyOnly[1], 10);
        let month = parseInt(dMyOnly[2], 10);
        const y = dMyOnly[3];
        if (day <= 12 && month > 12) {
            const tmp = day; day = month; month = tmp;
        }
        return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00`;
    }

    // 4. Fallback ISO prefix
    const iso = str.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    if (iso) return str.slice(0, 16);

    return '';
};

const confirmExcelMapping = async () => {
    const bargeId = activeBargeId.value;
    if (!pendingExcelData.value || !bargeId) return;
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể nhập dữ liệu.', 'error');
        return;
    }

    const mapping = pendingExcelData.value.mapping;
    const requiredFields: ExcelField[] = ['plateNumber', 'weight1', 'weight2'];
    const hasRequired = requiredFields.every(f => (mapping[f] ?? -1) !== -1);

    if (!hasRequired) {
        alert("Vui lòng ánh xạ các cột bắt buộc: Số xe, Trọng lượng lần 1, Trọng lượng lần 2.");
        return;
    }

    const ticketNoCol = mapping.ticketNo;
    const plateCol = mapping.plateNumber;
    const w1Col = mapping.weight1;
    const w2Col = mapping.weight2;
    const wNetCol = mapping.weightNet;
    const dateInCol = mapping.dateIn;
    const dateOutCol = mapping.dateOut;
    const driverCol = mapping.driver;
    const noteCol = mapping.note;

    if (plateCol === undefined || plateCol === -1 || w1Col === undefined || w1Col === -1 || w2Col === undefined || w2Col === -1) {
        alert("Ánh xạ cột không hợp lệ!");
        return;
    }

    loading.value = true;
    try {
        const startRow = pendingExcelData.value.headerIndex + 1;
        const importedTrucks: Truck[] = [];
        
        let currentSeed = cfgForm.ticketSeed || '1';

        for (let r = startRow; r < pendingExcelData.value.rawRows.length; r++) {
            const row = pendingExcelData.value.rawRows[r];
            if (!row || row.length === 0) continue;

            const plateRaw = row[plateCol];
            if (plateRaw === undefined || plateRaw === null || String(plateRaw).trim() === '') continue;
            const plate = String(plateRaw).trim().toUpperCase();

            const w1 = parseFloat(String(row[w1Col]).replace(/[^0-9.-]/g, '')) || 0;
            const w2 = parseFloat(String(row[w2Col]).replace(/[^0-9.-]/g, '')) || 0;
            
            let wNet = 0;
            if (wNetCol !== undefined && wNetCol !== -1 && row[wNetCol] !== undefined && row[wNetCol] !== null) {
                wNet = parseFloat(String(row[wNetCol]).replace(/[^0-9.-]/g, '')) || 0;
            }
            if (wNet === 0) {
                wNet = Math.abs(w1 - w2);
            }

            let dIn = '';
            if (dateInCol !== undefined && dateInCol !== -1 && row[dateInCol]) {
                dIn = parseExcelDate(row[dateInCol]);
            }
            let dOut = '';
            if (dateOutCol !== undefined && dateOutCol !== -1 && row[dateOutCol]) {
                dOut = parseExcelDate(row[dateOutCol]);
            }

            if (!dIn) {
                const now = new Date();
                const y = now.getFullYear();
                const mo = String(now.getMonth() + 1).padStart(2, '0');
                const dy = String(now.getDate()).padStart(2, '0');
                const hr = String(now.getHours()).padStart(2, '0');
                const mi = String(now.getMinutes()).padStart(2, '0');
                dIn = `${y}-${mo}-${dy}T${hr}:${mi}`;
            }
            if (!dOut) {
                const now = new Date();
                now.setMinutes(now.getMinutes() + 30);
                const y = now.getFullYear();
                const mo = String(now.getMonth() + 1).padStart(2, '0');
                const dy = String(now.getDate()).padStart(2, '0');
                const hr = String(now.getHours()).padStart(2, '0');
                const mi = String(now.getMinutes()).padStart(2, '0');
                dOut = `${y}-${mo}-${dy}T${hr}:${mi}`;
            }

            const driver = driverCol !== undefined && driverCol !== -1 && row[driverCol] ? String(row[driverCol]).trim() : '';
            const note = noteCol !== undefined && noteCol !== -1 && row[noteCol] ? String(row[noteCol]).trim() : '';

            let ticketNo = '';
            if (ticketNoCol !== undefined && ticketNoCol !== -1 && row[ticketNoCol] !== undefined && row[ticketNoCol] !== null) {
                ticketNo = String(row[ticketNoCol]).trim();
            }
            if (!ticketNo) {
                const tempAllTrucks = [...trucks.value, ...importedTrucks];
                ticketNo = getNextTicketNumber(dOut || dIn, tempAllTrucks, currentSeed);
                const serialPart = ticketNo.split('/')[0];
                currentSeed = (parseInt(serialPart || '0', 10) || 1) + 1;
            }

            importedTrucks.push({
                id: Date.now() + r,
                barge_id: bargeId,
                ticketNo: ticketNo,
                plateNumber: plate,
                driver: driver,
                weight1: w1,
                weight2: w2,
                weightNet: wNet,
                dateIn: dIn,
                dateOut: dOut,
                note: note
            });
        }

        // Upsert to DB
        const allTrucks = [...trucks.value, ...importedTrucks];
        const success = await WeighbridgeService.saveTrucks(bargeId, allTrucks);

        if (success) {
            // Update seed in configuration
            cfgForm.ticketSeed = String(currentSeed).padStart(6, '0');
            await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm });
            
            // Reload list
            trucks.value = await WeighbridgeService.getTrucks(bargeId);
            showToast(`Đã nhập thành công ${importedTrucks.length} xe từ file Excel!`);
        } else {
            showToast('Lỗi lưu trữ dữ liệu xe vào database!', 'error');
        }
    } catch (e: any) {
        showToast('Lỗi trong khi nhập dữ liệu: ' + e.message, 'error');
    } finally {
        showMappingModal.value = false;
        pendingExcelData.value = null;
        loading.value = false;
    }
};

const downloadSampleExcel = () => {
    try {
        const sampleHeaders = [
            ['STT', 'Số phiếu', 'Biển số xe', 'Tài xế', 'Trọng lượng lần 1 (Gross)', 'Trọng lượng lần 2 (Tare)', 'Trọng lượng hàng (Net)', 'Thời gian vào', 'Thời gian ra', 'Ghi chú'],
            [1, 'PC-001', '51C-123.45', 'Nguyễn Văn Hùng', 35400, 12200, 23200, '2026-06-20 08:30', '2026-06-20 09:00', 'Đạt chuẩn'],
            [2, 'PC-002', '60C-554.89', 'Lê Hữu Tình', 28900, 11800, 17100, '2026-06-20 09:15', '2026-06-20 09:45', 'Hàng ẩm nhẹ'],
            [3, 'PC-003', '72H-992.11', 'Phạm Quốc Bảo', 31500, 12000, 19500, '2026-06-20 10:00', '2026-06-20 10:30', '']
        ];
        
        // Dynamically import ExcelJS if not globally imported
        import('exceljs').then(async (ExcelJS) => {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Mẫu Dữ Liệu Xe');
            
            sampleHeaders.forEach(row => {
                sheet.addRow(row);
            });
            
            const buffer = await workbook.xlsx.writeBuffer();
            excelService.downloadFile(buffer, 'MAU_DANH_SACH_XE_CAN.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            showToast('Đã tải file mẫu thành công!');
        });
    } catch (e: any) {
        showToast('Lỗi khi tạo file mẫu: ' + e.message, 'error');
    }
};

// Truck CRUD Dialog Functions
const openAddTruckDialog = () => {
    if (isCurrentVesselDone.value) {
        showToast('Tàu này đã chốt số liệu (Đã xong), không thể thêm xe mới!', 'warning');
        return;
    }
    if (authStore.role !== 'admin' && !canCreate()) {
        showToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể thêm xe.', 'error');
        return;
    }
    dialogTruck.id = 0;
    dialogTruck.ticketNo = '';
    dialogTruck.plateNumber = '';
    dialogTruck.driver = '';
    dialogTruck.weight1 = 0;
    dialogTruck.weight2 = 0;
    dialogTruck.weightNet = 0;
    
    const now = new Date();
    const y1 = now.getFullYear();
    const mo1 = String(now.getMonth() + 1).padStart(2, '0');
    const dy1 = String(now.getDate()).padStart(2, '0');
    const hr1 = String(now.getHours()).padStart(2, '0');
    const mi1 = String(now.getMinutes()).padStart(2, '0');
    dialogTruck.dateIn = `${y1}-${mo1}-${dy1}T${hr1}:${mi1}`;
    now.setMinutes(now.getMinutes() + 30);
    const y2 = now.getFullYear();
    const mo2 = String(now.getMonth() + 1).padStart(2, '0');
    const dy2 = String(now.getDate()).padStart(2, '0');
    const hr2 = String(now.getHours()).padStart(2, '0');
    const mi2 = String(now.getMinutes()).padStart(2, '0');
    dialogTruck.dateOut = `${y2}-${mo2}-${dy2}T${hr2}:${mi2}`;
    
    dialogTruck.note = '';
    
    showTruckDialog.value = true;
};

const openEditTruckDialog = (truck: Truck) => {
    if (isCurrentVesselDone.value) {
        showToast('Tàu này đã chốt số liệu (Đã xong), không thể sửa thông tin xe!', 'warning');
        return;
    }
    if (authStore.role !== 'admin' && !canUpdate()) {
        showToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể sửa thông tin.', 'error');
        return;
    }
    dialogTruck.id = truck.id;
    dialogTruck.ticketNo = truck.ticketNo;
    dialogTruck.plateNumber = truck.plateNumber;
    dialogTruck.driver = truck.driver || '';
    dialogTruck.weight1 = truck.weight1;
    dialogTruck.weight2 = truck.weight2;
    dialogTruck.weightNet = truck.weightNet;
    dialogTruck.dateIn = truck.dateIn || '';
    dialogTruck.dateOut = truck.dateOut || '';
    dialogTruck.note = truck.note || '';
    
    showTruckDialog.value = true;
};

const onWeightInput = () => {
    dialogTruck.weightNet = Math.abs(dialogTruck.weight1 - dialogTruck.weight2);
};

const saveTruck = async () => {
    const isNew = dialogTruck.id === 0;
    if (authStore.role !== 'admin' && ((isNew && !canCreate()) || (!isNew && !canUpdate()))) {
        showToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể lưu dữ liệu.', 'error');
        return;
    }
    if (!dialogTruck.plateNumber.trim()) {
        alert("Vui lòng nhập biển số xe.");
        return;
    }
    const bargeId = activeBargeId.value;
    if (!bargeId) return;

    loading.value = true;
    try {
        let ticketNo = dialogTruck.ticketNo;
        
        // Generate new ticket no if adding new
        if (dialogTruck.id === 0) {
            ticketNo = getNextTicketNumber(dialogTruck.dateOut || dialogTruck.dateIn, trucks.value, cfgForm.ticketSeed);
            
            // Extract the next serial and pad it
            const serialPart = ticketNo.split('/')[0];
            const nextSerial = (parseInt(serialPart || '0', 10) || 1) + 1;
            cfgForm.ticketSeed = String(nextSerial).padStart(6, '0');
            
            await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm });
        }

        const truckData = {
            id: dialogTruck.id || Date.now(),
            ticketNo,
            plateNumber: dialogTruck.plateNumber.trim().toUpperCase(),
            driver: dialogTruck.driver.trim(),
            weight1: dialogTruck.weight1,
            weight2: dialogTruck.weight2,
            weightNet: dialogTruck.weightNet,
            dateIn: dialogTruck.dateIn,
            dateOut: dialogTruck.dateOut,
            note: dialogTruck.note.trim()
        };

        const success = await WeighbridgeService.saveSingleTruck(bargeId, truckData);
        if (success) {
            showToast(dialogTruck.id ? 'Đã cập nhật thông tin xe!' : 'Đã thêm xe thành công!');
            // Reload list
            trucks.value = await WeighbridgeService.getTrucks(bargeId);
            showTruckDialog.value = false;
        } else {
            showToast('Không thể lưu thông tin xe!', 'error');
        }
    } catch (e: any) {
        showToast('Lỗi: ' + e.message, 'error');
    } finally {
        loading.value = false;
    }
};

const deleteTruck = async (id: number, plate: string) => {
    if (isCurrentVesselDone.value) {
        showToast('Tàu này đã chốt số liệu (Đã xong), không thể xóa xe!', 'warning');
        return;
    }
    if (authStore.role !== 'admin' && !canDelete()) {
        showToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể xóa xe.', 'error');
        return;
    }
    const confirm = await showConfirm({
        title: 'Xóa xe khỏi danh sách',
        message: `Bạn có muốn xóa xe "${plate}" ra khỏi danh sách không?`,
        type: 'danger',
        okText: 'Xóa',
        cancelText: 'Hủy'
    });
    if (!confirm) return;

    const bargeId = activeBargeId.value;
    if (!bargeId) return;

    loading.value = true;
    try {
        const success = await WeighbridgeService.deleteTruck(id);
        if (success) {
            trucks.value = trucks.value.filter(t => t.id !== id);
            showToast(`Đã xóa xe: ${plate}`, 'error');
            await LogService.logAction('Xóa phiếu cân', 'Xóa xe: ' + plate);
        } else {
            showToast('Không thể xóa xe!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi xóa xe!', 'error');
    } finally {
        loading.value = false;
    }
};

const clearTrucks = async () => {
    if (isCurrentVesselDone.value) {
        showToast('Tàu này đã chốt số liệu (Đã xong), không thể xóa danh sách xe!', 'warning');
        return;
    }
    if (authStore.role !== 'admin' && !hasDetailPermission('weighbridge', 'wb_truck_manage', 'delete')) {
        showToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const bargeId = activeBargeId.value;
    if (!bargeId) return;
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể xóa danh sách.', 'error');
        return;
    }
    const confirm = await showConfirm({
        title: 'Xóa toàn bộ danh sách xe',
        message: 'Bạn có chắc chắn muốn xóa toàn bộ danh sách xe của sà lan này? Hành động này không thể hoàn tác!',
        type: 'danger',
        okText: 'Xóa sạch',
        cancelText: 'Hủy'
    });
    if (!confirm) return;

    loading.value = true;
    try {
        const success = await WeighbridgeService.clearBargeTrucks(bargeId);
        if (success) {
            trucks.value = [];
            
            // Reset seed in config
            const padLength = String(cfgForm.ticketSeed || '1').length;
            cfgForm.ticketSeed = "1".padStart(padLength, '0');
            await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm });

            showToast("Đã xóa sạch danh sách xe của sà lan!", "error");
            await LogService.logAction('Xóa tất cả phiếu cân', 'Xóa sạch danh sách xe của sà lan');
        } else {
            showToast('Không thể xóa danh sách xe!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi xóa danh sách!', 'error');
    } finally {
        loading.value = false;
    }
};

// Vietnamese Number-to-Words Converter
function DocSoThanhChu(so: number): string {
    const rounded = Math.round(so);
    if (rounded === 0) return "Không kg";
    const ChuSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    
    function docXetChuc(chuc: number, donvi: number, KetQua: string) {
        if (chuc > 1) {
            KetQua += " " + ChuSo[chuc] + " mươi";
            if (donvi === 1) KetQua += " mốt";
            else if (donvi === 5) KetQua += " lăm";
            else if (donvi > 0) KetQua += " " + ChuSo[donvi];
        } else if (chuc === 1) {
            KetQua += " mười";
            if (donvi === 1) KetQua += " một";
            else if (donvi === 5) KetQua += " lăm";
            else if (donvi > 0) KetQua += " " + ChuSo[donvi];
        } else {
            if (donvi > 0) {
                if (KetQua !== "") KetQua += " lẻ";
                KetQua += " " + ChuSo[donvi];
            }
        }
        return KetQua;
    }

    function Doc3ChuSo(baso: number, daydu: boolean) {
        let tram = Math.floor(baso / 100);
        let chuc = Math.floor((baso % 100) / 10);
        let donvi = baso % 10;
        let KetQua = "";
        
        if (tram === 0 && chuc === 0 && donvi === 0) return "";
        
        if (daydu || tram > 0) {
            KetQua += " " + ChuSo[tram] + " trăm";
            KetQua = docXetChuc(chuc, donvi, KetQua);
        } else {
            KetQua = docXetChuc(chuc, donvi, KetQua);
        }
        return KetQua;
    }

    let strSo = String(Math.abs(rounded));
    let sochech = strSo.length % 3;
    if (sochech === 1) strSo = "00" + strSo;
    else if (sochech === 2) strSo = "0" + strSo;

    let nhom3 = [];
    for (let i = 0; i < strSo.length; i += 3) {
        nhom3.push(parseInt(strSo.slice(i, i + 3)));
    }

    const DonViLon = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];
    let KetQuaFinal = "";
    let countNhom = nhom3.length;
    
    for (let i = 0; i < countNhom; i++) {
        const val = nhom3[i];
        if (val === undefined) continue;
        const isDayDu = i > 0;
        const chuNhom = Doc3ChuSo(val, isDayDu);
        if (chuNhom !== "") {
            KetQuaFinal += chuNhom + DonViLon[countNhom - 1 - i];
        }
    }

    let text = KetQuaFinal.trim().replace(/\s+/g, ' ');
    text = text.charAt(0).toUpperCase() + text.slice(1);
    return text + " kg";
}

// Helpers for printing and formatting
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

// Print Logic
const printTrucksList = ref<Truck[]>([]);

const triggerPrint = async (singleTruck?: Truck) => {
    if (singleTruck) {
        printTrucksList.value = [singleTruck];
    } else {
        if (filteredTrucks.value.length === 0) {
            alert("Danh sách xe trống! Vui lòng tải file Excel hoặc thêm xe thủ công trước khi in.");
            return;
        }
        printTrucksList.value = [...filteredTrucks.value];
    }

    // Wait for Vue to render the print section DOM
    await nextTick();

    setTimeout(() => {
        const printSection = document.getElementById('print-section');
        if (!printSection) return;

        const content = printSection.innerHTML;

        // Remove any previous print iframe
        const oldIframe = document.getElementById('print-iframe');
        if (oldIframe) oldIframe.remove();

        // Create a hidden iframe for isolated printing
        const iframe = document.createElement('iframe');
        iframe.id = 'print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.top = '-10000px';
        iframe.style.left = '-10000px';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        const iframeWin = iframe.contentWindow;
        if (!iframeDoc || !iframeWin) {
            iframe.remove();
            window.print(); // Fallback
            return;
        }

        iframeDoc.open();
        iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Phiếu Cân Xe</title>
<style>
@page {
    size: 210mm 148mm;
    margin: 0;
}
*, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}
html, body {
    margin: 0;
    padding: 0;
    width: 210mm;
    background: white;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}
.print-page {
    page-break-after: always;
    width: 210mm;
    height: 148mm;
    position: relative;
    overflow: hidden;
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    color: black;
    background: white;
}
.print-page:last-child {
    page-break-after: avoid;
}
</style>
</head>
<body>${content}</body>
</html>`);
        iframeDoc.close();

        // Wait for iframe content to render, then trigger print
        setTimeout(() => {
            iframeWin.focus();
            iframeWin.print();

            // Clean up iframe after print dialog is dismissed
            iframeWin.onafterprint = () => {
                setTimeout(() => iframe.remove(), 500);
            };
        }, 300);
    }, 150);
};

// Initialize
onMounted(async () => {
    await loadVessels();
    
    // Check if redirected from Home page
    const redirectBargeId = localStorage.getItem('home_redirect_barge_id');
    const redirectVesselId = localStorage.getItem('home_redirect_vessel_id');
    if (redirectBargeId && redirectVesselId) {
        activeVesselId.value = Number(redirectVesselId);
        await selectBarge(Number(redirectVesselId), Number(redirectBargeId));
        localStorage.removeItem('home_redirect_barge_id');
        localStorage.removeItem('home_redirect_vessel_id');
    }

    loadGlobalGoods();
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    window.addEventListener('barge-config-updated', loadVessels);
});

// Watch activeTab and showGlobalTemplateModal to dynamically register/deregister ResizeObserver
watch([activeTab, showGlobalTemplateModal], async ([newTab, showModal]) => {
    if (newTab === 'config' || showModal) {
        await nextTick();
        if (canvasContainerRef.value && !resizeObserver) {
            resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    // Get width of parent container minus padding (p-4 is 16px padding on each side, total 32px)
                    const parentWidth = entry.contentRect.width;
                    const targetWidth = Math.min(840, parentWidth - 32);
                    if (targetWidth > 100) {
                        canvasWidthPx.value = targetWidth;
                        canvasHeightPx.value = targetWidth * 148 / 210;
                    }
                }
            });
            resizeObserver.observe(canvasContainerRef.value);
        }
    } else {
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
    }
}, { immediate: true });

onUnmounted(() => {
    try {
        syncChannel.close();
    } catch (e) {}
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('online', updateOnlineStatus);
    window.removeEventListener('offline', updateOnlineStatus);
    window.removeEventListener('barge-config-updated', loadVessels);
    if (resizeObserver) {
        resizeObserver.disconnect();
    }
});

defineExpose({
    isOpen,
    showPrompt,
    renameVessel,
    otherBargesWithConfig,
    applyLayoutToAllBarges,
    copyLayoutFromBarge,
    clampSelectedElement,
    applyToAllSelected,
    resetToDefaultLayout
});
</script>

<template>
    <div class="weighbridge-printer-wrapper flex-1 flex flex-col min-h-0 overflow-y-auto md:overflow-hidden font-display">
        <div v-if="!hideCard" class="bg-white rounded-[24px] p-8 md:p-10 soft-shadow border border-primary/5 relative overflow-hidden flex flex-col justify-between h-full group">
            <div class="absolute -top-6 -right-6 p-8 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all pointer-events-none">
                <span class="material-symbols-outlined text-[120px] text-primary">monitoring</span>
            </div>
            <div>
                <h3 class="text-2xl font-display font-black text-primary mb-3">Báo Cáo Tổng Quan 🚢</h3>
                <p class="text-sm font-bold text-[#1b0d11]/60 leading-relaxed mb-6">
                    Báo cáo tổng quan tiến độ làm hàng của các tàu mẹ, theo dõi danh sách sà lan và thống kê khối lượng toàn cảng.
                </p>
                <div class="flex flex-wrap gap-2 mb-6">
                    <span class="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full">Tổng quan</span>
                    <span class="text-xs font-bold px-3 py-1 bg-teal-500/10 text-teal-600 rounded-full">Tiến độ tàu</span>
                    <span class="text-xs font-bold px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full">Điều độ cảng</span>
                </div>
            </div>
            
            <button 
                @click="isOpen = true" 
                class="w-full py-4 puffy-button flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
                <span class="material-symbols-outlined">open_in_new</span>
                Mở Báo Cáo Tổng Quan
            </button>
        </div>

        <!-- Fullscreen Workspace Overlay -->
        <div v-if="isOpen" :class="[hideCard ? 'flex-1 flex flex-col overflow-y-auto md:overflow-hidden font-display' : 'fixed inset-0 bg-cute-gradient z-[100] flex flex-col overflow-y-auto md:overflow-hidden no-print animate-fade-in font-display']">
            <!-- Header bar of Workspace -->
            <header v-if="!hideCard" class="bg-white px-6 py-4 border-b border-primary/10 flex items-center justify-between shadow-sm shrink-0">
                <div class="flex items-center gap-3">
                    <div class="size-11 bg-primary rounded-full flex items-center justify-center text-white shadow-soft shrink-0">
                        <span class="material-symbols-outlined text-[20px]">monitoring</span>
                    </div>
                    <div class="flex flex-col gap-0.5">
                        <h2 class="text-base font-black text-primary leading-tight">BÁO CÁO TỔNG QUAN 🚢</h2>
                        <p class="text-xs font-semibold text-[#1b0d11]/50 leading-none">Cảng Nguyên Ngọc - Đồng bộ đám mây</p>
                    </div>
                </div>
                
                <!-- Status bar -->
                <div class="flex items-center gap-3">
                    <div v-if="!authStore.isAuthenticated" class="hidden lg:flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                        <span class="material-symbols-outlined text-xs">warning</span>
                        Chưa đăng nhập! Dữ liệu đang được lưu tạm thời.
                    </div>
                    
                    <button 
                        @click="isOpen = false" 
                        class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full text-xs flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <span class="material-symbols-outlined text-sm font-black">close</span>
                        Đóng
                    </button>
                </div>
            </header>

            <!-- Main area -->
            <div :class="['flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden gap-4', hideCard ? 'p-2 md:p-4' : 'p-2 md:p-4 bg-cute-gradient']">
                <!-- Sidebar (left): Vessels -> Barges tree -->
                <aside 
                    :class="[
                        'w-full md:w-72 h-auto md:h-full bg-white rounded-[24px] soft-shadow border border-primary/5 flex flex-col shrink-0 overflow-hidden',
                        (activeVesselId || activeBargeId) ? 'hidden md:flex' : 'flex'
                    ]"
                >
                    <div class="p-2.5 border-b border-primary/5 flex flex-col gap-1.5">
                        <div class="flex items-center justify-between">
                            <span 
                                @click="activeVesselId = null; activeBargeId = null" 
                                :class="['text-xs font-black cursor-pointer uppercase tracking-wider transition-colors flex items-center gap-1', !activeVesselId && !activeBargeId ? 'text-primary' : 'text-gray-500 hover:text-primary']"
                                title="Quay lại Trang tổng quan"
                            >
                                <span class="material-symbols-outlined text-sm">home</span>
                                Tổng quan
                            </span>
                            <button @click="loadVessels" class="size-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-primary transition-colors" title="Tải lại danh sách">
                                <span class="material-symbols-outlined text-lg" :class="{'animate-spin': loading}">refresh</span>
                            </button>
                        </div>
                    </div>

                    <!-- Vessel Status 2-Tabs -->
                    <div class="px-2 pt-2 pb-1 border-b border-primary/5">
                        <div class="grid grid-cols-2 p-0.5 bg-gray-100 rounded-xl text-xs font-bold">
                            <button 
                                @click="selectedVesselStatusTab = 'in_progress'"
                                :class="[
                                    'py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs',
                                    selectedVesselStatusTab === 'in_progress' 
                                        ? 'bg-white text-primary shadow-sm' 
                                        : 'text-gray-500 hover:text-gray-700'
                                ]"
                            >
                                <span class="material-symbols-outlined text-sm">schedule</span>
                                <span>Đang làm</span>
                                <span class="px-1.5 py-0.2 text-[10px] rounded-full font-bold" :class="selectedVesselStatusTab === 'in_progress' ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-600'">
                                    {{ inProgressVessels.length }}
                                </span>
                            </button>
                            <button 
                                @click="selectedVesselStatusTab = 'done'"
                                :class="[
                                    'py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs',
                                    selectedVesselStatusTab === 'done' 
                                        ? 'bg-white text-emerald-600 shadow-sm' 
                                        : 'text-gray-500 hover:text-gray-700'
                                ]"
                            >
                                <span class="material-symbols-outlined text-sm">check_circle</span>
                                <span>Đã xong</span>
                                <span class="px-1.5 py-0.2 text-[10px] rounded-full font-bold" :class="selectedVesselStatusTab === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'">
                                    {{ doneVessels.length }}
                                </span>
                            </button>
                        </div>
                    </div>

                    <!-- Tree list -->
                    <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
                        <div v-if="filteredSidebarVessels.length === 0" class="text-center py-6 text-gray-400 text-xs">
                            {{ selectedVesselStatusTab === 'done' ? 'Chưa có tàu nào ở trạng thái Đã xong.' : 'Không có tàu nào đang làm hàng.' }}
                        </div>

                        <div 
                            v-for="vessel in filteredSidebarVessels" 
                            :key="vessel.id" 
                            class="border rounded-[16px] overflow-hidden transition-all duration-200"
                            :class="[
                                dragOverVesselId === vessel.id && draggedBarge && draggedBarge.vesselId !== vessel.id && vessel.status !== 'done'
                                    ? 'border-2 border-teal-500 bg-teal-50/80 shadow-md ring-2 ring-teal-400/30'
                                    : 'border-primary/5 bg-gray-50'
                            ]"
                            @dragover.prevent="handleVesselDragOver($event, vessel)"
                            @dragleave="handleVesselDragLeave($event, vessel)"
                            @drop.prevent="handleVesselDrop($event, vessel)"
                        >
                            <!-- Vessel Header -->
                            <div 
                                @click="selectVessel(vessel.id); expandedVesselIds[vessel.id] = !expandedVesselIds[vessel.id]"
                                :class="['group flex items-center justify-between p-2.5 hover:bg-primary/10 cursor-pointer transition-colors', activeVesselId === vessel.id && activeBargeId === null ? 'bg-primary/10 border-l-4 border-primary' : '']"
                            >
                                <div class="flex items-center gap-1.5 font-bold text-xs text-[#1e293b]">
                                    <span class="material-symbols-outlined text-primary text-base">directions_boat</span>
                                    <span class="truncate max-w-[120px]">{{ vessel.name }}</span>
                                    <span v-if="vessel.status === 'done'" class="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded font-bold uppercase shrink-0">Xong</span>
                                </div>
                                
                                <!-- Vessel Actions -->
                                <div v-if="authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_vessel_manage', 'create') || hasDetailPermission('weighbridge', 'wb_vessel_manage', 'update') || hasDetailPermission('weighbridge', 'wb_vessel_manage', 'delete')" class="flex items-center gap-0.5" @click.stopPropagation>
                                    <div class="hidden group-hover:flex items-center gap-0.5">
                                        <button v-if="(authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_vessel_manage', 'update')) && vessel.status !== 'done'" @click="openEditVesselModal(vessel)" class="size-6 rounded-full hover:bg-white flex items-center justify-center text-gray-400 hover:text-primary transition-colors" title="Sửa thông tin tàu">
                                            <span class="material-symbols-outlined text-xs">edit</span>
                                        </button>
                                        <button v-if="authStore.role === 'admin' || (hasDetailPermission('weighbridge', 'wb_vessel_manage', 'delete') && vessel.status !== 'done')" @click="deleteVessel(vessel.id, vessel.name)" class="size-6 rounded-full hover:bg-white flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors" title="Xóa tàu">
                                            <span class="material-symbols-outlined text-xs">delete</span>
                                        </button>
                                    </div>
                                    <button v-if="(authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_vessel_manage', 'create')) && vessel.status !== 'done'" @click="addBarge(vessel.id)" class="size-6 rounded-full hover:bg-white flex items-center justify-center text-primary/70 hover:text-primary transition-colors" title="Thêm sà lan">
                                        <span class="material-symbols-outlined text-xs">add</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Barges List (under Vessel) -->
                            <div v-if="expandedVesselIds[vessel.id]" class="bg-white px-1.5 py-1 border-t border-primary/5 flex flex-col gap-0.5">
                                <div v-if="!vessel.barges || vessel.barges.length === 0" class="text-xs text-gray-400 py-1.5 px-2.5 italic">
                                    Không có sà lan nào
                                </div>
                                <div 
                                    v-for="barge in vessel.barges" 
                                    :key="barge.id"
                                    @click="selectBarge(vessel.id, barge.id)"
                                    :draggable="(authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_vessel_manage', 'update')) && vessel.status !== 'done' && !barge.config?.locked"
                                    @dragstart="handleBargeDragStart($event, vessel, barge)"
                                    @dragend="handleBargeDragEnd"
                                    :class="[
                                        'group flex items-center justify-between p-2 rounded-[12px] cursor-pointer transition-all text-xs font-bold gap-1.5',
                                        activeBargeId === barge.id ? 'bg-primary text-white shadow-soft' : 'text-gray-700 hover:bg-gray-100',
                                        draggedBarge?.bargeId === barge.id ? 'opacity-40 border-2 border-dashed border-teal-500 scale-95' : ''
                                    ]"
                                    :title="vessel.status !== 'done' && !barge.config?.locked ? 'Nhấn để xem hoặc kéo thả sang tàu khác' : ''"
                                >
                                    <div class="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                                        <span class="material-symbols-outlined text-sm shrink-0">layers</span>
                                        <span class="truncate">{{ barge.name }}</span>
                                    </div>
                                    <div class="flex items-center gap-1 shrink-0">
                                        <!-- Barge Actions (Chỉ hiện khi rê chuột) -->
                                        <div v-if="(authStore.role === 'admin' || canCreate() || canUpdate() || canDelete()) && vessel.status !== 'done'" class="hidden group-hover:flex items-center gap-0.5" @click.stopPropagation>
                                            <button v-if="authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_vessel_manage', 'update')" @click="openMoveBargeModal(vessel, barge)" class="size-5 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors" :class="activeBargeId === barge.id ? 'text-white' : 'text-gray-400 hover:text-teal-600'" title="Chuyển sang tàu khác">
                                                <span class="material-symbols-outlined text-xs">swap_horiz</span>
                                            </button>
                                            <button v-if="authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_vessel_manage', 'update')" @click="renameBarge(barge.id, barge.name)" class="size-5 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors" :class="activeBargeId === barge.id ? 'text-white' : 'text-gray-400 hover:text-primary'" title="Đổi tên">
                                                <span class="material-symbols-outlined text-xs">edit</span>
                                            </button>
                                            <button v-if="authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_vessel_manage', 'delete')" @click="deleteBarge(vessel.id, barge.id, barge.name)" class="size-5 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors" :class="activeBargeId === barge.id ? 'text-white' : 'text-gray-400 hover:text-red-500'" title="Xóa sà lan">
                                                <span class="material-symbols-outlined text-xs">delete</span>
                                            </button>
                                        </div>
                                        <!-- Thứ tự & Khóa (Cố định sát mép phải) -->
                                        <div class="min-w-[24px] flex justify-center items-center shrink-0">
                                            <span v-if="barge.config?.orderNo" :class="['size-[22px] rounded-full inline-flex items-center justify-center text-[10px] border font-black uppercase leading-none shrink-0 select-none', activeBargeId === barge.id ? 'bg-white/20 text-white border-white/30' : 'bg-teal-50 text-teal-600 border-teal-200']">
                                                {{ barge.config.orderNo }}
                                            </span>
                                        </div>
                                        <div class="w-4 h-4 flex justify-center items-center shrink-0">
                                            <span v-if="barge.config?.locked" class="material-symbols-outlined text-xs" :class="activeBargeId === barge.id ? 'text-white/90' : 'text-red-500'" title="Sà lan đang bị khóa">lock</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Sidebar Footer -->
                    <div v-if="authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_vessel_manage', 'create')" class="p-3 border-t border-primary/10 bg-gray-50">
                        <button 
                            @click="addVessel" 
                            class="w-full py-2 bg-white border border-primary/20 hover:border-primary text-primary font-bold rounded-[12px] text-xs flex items-center justify-center gap-1.5 hover:bg-primary/10 transition-all shadow-sm"
                        >
                            <span class="material-symbols-outlined text-xs">add</span>
                            Thêm tàu mới
                        </button>
                    </div>

                </aside>

                <!-- Workspace (right) -->
                <main 
                    :class="[
                        'flex-1 min-h-0 flex flex-col gap-4 p-0 overflow-y-auto md:overflow-hidden',
                        (!activeVesselId && !activeBargeId) ? 'hidden md:flex' : 'flex'
                    ]"
                >
                    <!-- Global Dashboard (Empty State replaced by All Barges Overview) -->
                    <div v-if="!activeVesselId" class="flex-1 flex flex-col gap-4 w-full max-w-[1500px] mx-auto pb-4 md:pb-0 animate-fade-in min-h-0">
                        <!-- Welcome Header banner -->
                        <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 gap-3">
                            <div>
                                <div class="text-xs uppercase font-black tracking-widest text-primary mb-0.5">Báo cáo & điều độ cảng</div>
                                <h1 class="text-base font-black text-[#1e293b] flex items-center gap-1.5">
                                    Báo cáo tổng quan hệ thống 🚢
                                </h1>
                            </div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <button 
                                    v-if="authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_layout_config', 'read')"
                                    @click="openGlobalTemplateModal"
                                    class="px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-[14px] flex items-center gap-1.5 transition-all shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                                    title="Cấu hình mẫu in phiếu cân chuẩn toàn cảng Nguyên Ngọc"
                                >
                                    <span class="material-symbols-outlined text-base">design_services</span>
                                    Mẫu phiếu cân toàn cảng
                                </button>
                                <button 
                                    v-if="authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_vessel_manage')"
                                    @click="openMasterDataModal"
                                    class="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-[14px] flex items-center gap-1.5 transition-all shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                                    title="Quản lý danh mục Khách hàng & Hàng hóa chuẩn"
                                >
                                    <span class="material-symbols-outlined text-base">category</span>
                                    Danh mục chuẩn
                                </button>
                                <button 
                                    v-if="authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_vessel_manage', 'create')"
                                    @click="openAddVesselModal"
                                    class="px-3.5 py-2 bg-primary text-white hover:bg-primary-dark font-bold text-xs rounded-[14px] flex items-center gap-1.5 transition-all shadow-soft hover:scale-[1.02] active:scale-[0.98]"
                                    title="Thêm Nguồn tàu mới"
                                >
                                    <span class="material-symbols-outlined text-base">add</span>
                                    Thêm tàu mới
                                </button>
                            </div>
                        </div>

                        <!-- Stats Row -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-primary/10 text-primary rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">directions_boat</span>
                                </div>
                                <div>
                                    <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        {{ globalFilterVesselStatus === 'done' ? 'Tàu đã xong' : (globalFilterVesselStatus === 'in_progress' ? 'Tàu đang làm hàng' : 'Tổng số tàu') }}
                                    </p>
                                    <h4 class="text-lg font-black text-[#1e293b]">
                                        {{ globalFilterVesselStatus === 'done' ? doneVessels.length : (globalFilterVesselStatus === 'in_progress' ? inProgressVessels.length : vessels.length) }} 
                                        <span class="text-xs text-gray-400 font-bold">tàu</span>
                                    </h4>
                                </div>
                            </div>
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-teal-500/10 text-teal-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">layers</span>
                                </div>
                                <div>
                                    <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Tổng số sà lan</p>
                                    <h4 class="text-lg font-black text-teal-600">{{ allBarges.length }} <span class="text-xs text-gray-400 font-bold">sà lan</span></h4>
                                </div>
                            </div>
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div 
                                    class="size-11 rounded-[12px] flex items-center justify-center flex-shrink-0 transition-all"
                                    :class="isOnline ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'"
                                >
                                    <span class="material-symbols-outlined text-xl">{{ isOnline ? 'cloud' : 'cloud_off' }}</span>
                                </div>
                                <div class="text-left">
                                    <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Đồng bộ đám mây</p>
                                    <h4 
                                        class="text-lg font-black transition-colors"
                                        :class="isOnline ? 'text-emerald-600' : 'text-amber-600'"
                                    >
                                        {{ isOnline ? 'Đã kết nối' : 'Ngoại tuyến' }}
                                    </h4>
                                </div>
                            </div>
                        </div>

                        <!-- All Barges Table Card -->
                        <div class="flex-1 bg-white rounded-[24px] p-4 md:p-5 soft-shadow border border-primary/5 flex flex-col min-h-[350px] md:min-h-0">
                            <div class="flex flex-wrap items-center justify-between mb-4 gap-3">
                                <h3 class="text-sm font-black text-primary flex items-center gap-1.5">
                                    <span class="material-symbols-outlined text-base">analytics</span>
                                    Danh sách quản lý tất cả sà lan
                                </h3>
                                <button 
                                    @click="exportAllBargesToExcel" 
                                    :disabled="exportingGlobalBarges || filteredAllBarges.length === 0"
                                    class="h-8 px-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Xuất danh sách sà lan hiện tại ra Excel"
                                >
                                    <span v-if="exportingGlobalBarges" class="material-symbols-outlined text-xs animate-spin">sync</span>
                                    <span v-else class="material-symbols-outlined text-xs">download</span>
                                    Xuất Excel ({{ filteredAllBarges.length }})
                                </button>
                            </div>
                            
                            <!-- Filters Row for all barges -->
                            <div v-if="allBarges.length > 0" class="flex flex-col md:flex-row gap-3 mb-4 p-3 bg-gray-50 rounded-[16px] border border-primary/5">
                                <!-- Search input -->
                                <div class="relative flex-1 flex items-center">
                                    <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm">search</span>
                                    <input 
                                        v-model="globalBargeSearchQuery"
                                        type="text"
                                        placeholder="Tìm kiếm nhanh tên sà lan hoặc tên tàu..."
                                        class="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all placeholder:text-gray-400"
                                    />
                                    <button 
                                        v-if="globalBargeSearchQuery" 
                                        @click="globalBargeSearchQuery = ''" 
                                        class="absolute right-3 text-gray-400 hover:text-primary flex items-center"
                                    >
                                        <span class="material-symbols-outlined text-xs">close</span>
                                    </button>
                                </div>
                                
                                <!-- Billing Period & Date Range Filter -->
                                <div class="flex flex-wrap items-center gap-2">
                                    <!-- Vessel Status Filter -->
                                    <div class="relative min-w-[170px] flex items-center">
                                        <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm pointer-events-none">directions_boat</span>
                                        <select 
                                            v-model="globalFilterVesselStatus" 
                                            class="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-[12px] text-xs font-bold text-gray-700 focus:outline-none focus:border-primary cursor-pointer appearance-none shadow-sm"
                                        >
                                            <option value="">Tất cả trạng thái tàu</option>
                                            <option value="in_progress">🚢 Đang làm hàng ({{ inProgressVessels.length }})</option>
                                            <option value="done">✅ Đã xong ({{ doneVessels.length }})</option>
                                        </select>
                                        <span class="material-symbols-outlined absolute right-3 text-gray-400 text-sm pointer-events-none">expand_more</span>
                                    </div>

                                    <div class="relative min-w-[230px] flex items-center">
                                        <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm pointer-events-none">calendar_month</span>
                                        <select 
                                            v-model="globalFilterType" 
                                            class="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-[12px] text-xs font-bold text-gray-700 focus:outline-none focus:border-primary cursor-pointer appearance-none shadow-sm"
                                        >
                                            <option value="">Tất cả thời gian</option>
                                            <optgroup v-if="availableBillingPeriods.length > 0" label="── Kỳ chốt phí cầu bến (26 - 25) ──">
                                                <option v-for="period in availableBillingPeriods" :key="period.key" :value="period.key">
                                                    {{ period.label }}
                                                </option>
                                            </optgroup>
                                            <option value="custom">📅 Tùy chọn khoảng ngày...</option>
                                        </select>
                                        <span class="material-symbols-outlined absolute right-3 text-gray-400 text-sm pointer-events-none">expand_more</span>
                                    </div>

                                    <!-- Custom Date Range picker -->
                                    <div v-if="globalFilterType === 'custom'" class="flex items-center gap-1.5 bg-white border border-gray-200 px-2.5 py-1 rounded-[12px] shadow-sm">
                                        <span class="text-[11px] font-bold text-gray-400">Từ</span>
                                        <input 
                                            type="date" 
                                            v-model="globalFilterStartDate"
                                            class="bg-transparent border-0 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-0 p-0"
                                        />
                                        <span class="text-[11px] font-bold text-gray-400">đến</span>
                                        <input 
                                            type="date" 
                                            v-model="globalFilterEndDate"
                                            class="bg-transparent border-0 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-0 p-0"
                                        />
                                        <button 
                                            v-if="globalFilterStartDate || globalFilterEndDate"
                                            @click="globalFilterStartDate = ''; globalFilterEndDate = ''"
                                            title="Xóa khoảng ngày"
                                            class="p-0.5 text-gray-400 hover:text-red-500 transition-colors flex items-center"
                                        >
                                            <span class="material-symbols-outlined text-xs">close</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div v-if="loadingGlobalSummary" class="text-center py-10 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
                                <span class="material-symbols-outlined text-2xl animate-spin text-primary">sync</span>
                                Đang tính toán và tải dữ liệu sà lan...
                            </div>
                            <div v-else-if="allBarges.length === 0" class="text-center py-10 text-gray-400 text-xs italic">
                                Chưa có tàu hoặc sà lan nào được tạo. Vui lòng thêm ở cột bên trái.
                            </div>
                            <div v-else-if="filteredAllBarges.length === 0" class="text-center py-10 text-gray-400 text-xs italic">
                                Không tìm thấy sà lan phù hợp với từ khóa tìm kiếm hoặc bộ lọc.
                            </div>
                            <div v-else class="flex-1 overflow-y-auto overflow-x-auto rounded-[16px] border border-gray-100 min-h-[250px] md:min-h-0">
                                <table class="w-full text-left border-collapse text-xs font-bold whitespace-nowrap">
                                    <thead>
                                        <tr class="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold">
                                            <th class="px-3 py-2 w-12 text-center bg-gray-50">STT</th>
                                            <th class="px-3 py-2 bg-gray-50">Tên sà lan</th>
                                            <th class="px-3 py-2 bg-gray-50 text-center w-20">Mã lệnh</th>
                                            <th class="pl-24 pr-3 py-2 bg-gray-50 text-center w-[216px]">Thuộc Tàu</th>
                                            <th class="pl-36 pr-0 py-2 bg-gray-50">Thời gian bắt đầu</th>
                                            <th class="pl-1 pr-2 py-2 bg-gray-50">Thời gian kết thúc</th>
                                            <th class="px-3 py-2 bg-gray-50 text-center">Trạng thái</th>
                                            <th class="px-3 py-2 text-center w-28 bg-gray-50">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-100 text-[#1e293b]/90">
                                        <tr v-for="(b, idx) in filteredAllBarges" :key="b.id" class="hover:bg-gray-50 transition-colors">
                                            <td class="px-3 py-2 text-center text-gray-400 font-bold">{{ idx + 1 }}</td>
                                            <td class="px-3 py-2 font-bold text-gray-900">{{ b.name }}</td>
                                            <td class="px-3 py-2 text-center w-20">
                                                <span v-if="b.orderNo" class="font-bold text-teal-700 text-xs select-none">
                                                    {{ b.orderNo }}
                                                </span>
                                                <span v-else class="text-gray-400 italic text-xs">-</span>
                                            </td>
                                            <td class="pl-24 pr-3 py-2 w-[216px]">
                                                <span class="w-[180px] inline-block text-primary font-bold text-xs whitespace-nowrap truncate" :title="b.vesselName">
                                                    {{ b.vesselName }}
                                                </span>
                                            </td>
                                            <td class="pl-36 pr-0 py-2 text-gray-700 whitespace-nowrap">{{ b.dateStart ? formatDateTimeStr(b.dateStart) : '-' }}</td>
                                            <td class="pl-1 pr-2 py-2 text-gray-700 whitespace-nowrap">{{ b.dateEnd ? formatDateTimeStr(b.dateEnd) : '-' }}</td>
                                            <td class="px-3 py-2 text-center">
                                                <span v-if="b.locked" class="inline-flex px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-bold items-center gap-1 whitespace-nowrap">
                                                    <span class="material-symbols-outlined text-xs">lock</span> Khóa
                                                </span>
                                                <span v-else class="inline-flex px-2.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-xs font-bold items-center gap-1 whitespace-nowrap">
                                                    <span class="material-symbols-outlined text-xs">lock_open</span> Mở
                                                </span>
                                            </td>
                                            <td class="px-3 py-2 text-center">
                                                <button 
                                                    @click="selectBarge(b.vesselId, b.id)" 
                                                    class="px-2.5 py-1 bg-primary text-white font-bold rounded-[12px] text-xs hover:scale-[1.05] transition-all whitespace-nowrap"
                                                >
                                                    Xem chi tiết
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Vessel Summary Dashboard -->
                    <div v-else-if="activeVesselId && !activeBargeId" class="flex-1 flex flex-col gap-4 w-full max-w-[1500px] mx-auto pb-4 md:pb-0 animate-fade-in min-h-0">
                        <!-- Vessel header breadcrumbs -->
                        <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 gap-3">
                            <div class="flex items-center gap-3">
                                <div>
                                    <div class="text-xs uppercase font-black tracking-widest text-primary mb-0.5">Báo cáo tổng hợp tàu</div>
                                    <h1 class="text-base font-black text-[#1e293b] flex items-center gap-1.5 flex-wrap">
                                        <span @click="activeVesselId = null; activeBargeId = null" class="text-gray-400 hover:text-primary cursor-pointer transition-colors flex items-center gap-0.5" title="Quay lại Tổng quan"><span class="material-symbols-outlined text-base">home</span>Tổng quan</span>
                                        <span class="text-gray-300">&rsaquo;</span>
                                        Tàu: <span class="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-black">{{ activeVessel?.name }}</span>
                                        <span v-if="(isDeHeusVessel(activeVessel) ? selectedVesselStatusTab === 'done' : activeVessel?.status === 'done')" class="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-300 flex items-center gap-1">
                                            <span class="material-symbols-outlined text-xs">check_circle</span>
                                            {{ isDeHeusVessel(activeVessel) ? 'Sà lan đã chốt' : 'Đã xong' }}
                                        </span>
                                        <span v-else class="px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full text-xs font-bold border border-sky-300 flex items-center gap-1">
                                            <span class="material-symbols-outlined text-xs">schedule</span>
                                            Đang làm hàng
                                        </span>
                                    </h1>
                                    <div class="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                                        <span v-if="activeVessel?.customer" class="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full font-bold border border-blue-200">
                                            <span class="material-symbols-outlined text-xs">business</span>
                                            Khách hàng: {{ activeVessel.customer }}
                                        </span>
                                        <span v-if="activeVessel?.cargo_type" class="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-full font-bold border border-amber-200">
                                            <span class="material-symbols-outlined text-xs">inventory_2</span>
                                            Hàng hóa: {{ activeVessel.cargo_type }} {{ activeVessel.cargo_code ? `(${activeVessel.cargo_code})` : '' }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-2 flex-wrap">
                                <button 
                                    v-if="activeVessel && (authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_vessel_manage', 'update'))"
                                    @click="openEditVesselModal(activeVessel)"
                                    class="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-[12px] shadow-xs hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5"
                                    title="Chỉnh sửa thông tin Tàu, Khách hàng, Loại hàng hóa"
                                >
                                    <span class="material-symbols-outlined text-sm">edit</span>
                                    Sửa thông tin tàu
                                </button>
                                <!-- Close vessel button: available when vessel is in_progress (hidden for De Heus continuous vessel) -->
                                <button 
                                    v-if="activeVessel?.status !== 'done' && !isDeHeusVessel(activeVessel)"
                                    @click="handleCloseVessel(activeVesselId!)"
                                    :disabled="isUpdatingVesselStatus"
                                    class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-[12px] shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-50"
                                    title="Chốt số liệu và khóa chỉnh sửa tàu"
                                >
                                    <span class="material-symbols-outlined text-sm">lock</span>
                                    Chốt số liệu
                                </button>

                                <!-- Admin-only Re-open button: available when vessel is done -->
                                <button 
                                    v-if="activeVessel?.status === 'done' && !isDeHeusVessel(activeVessel) && authStore.role === 'admin'"
                                    @click="handleReopenVessel(activeVesselId!)"
                                    :disabled="isUpdatingVesselStatus"
                                    class="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-[12px] shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-50"
                                    title="Mở lại làm hàng cho tàu này (Chỉ Quản trị viên)"
                                >
                                    <span class="material-symbols-outlined text-sm">lock_open</span>
                                    Mở lại
                                </button>

                                <button 
                                    v-if="filteredVesselBarges.length > 0"
                                    @click="exportVesselSummaryExcel"
                                    class="px-4 py-2 bg-teal-600 text-white font-bold text-xs rounded-[12px] shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5"
                                >
                                    <span class="material-symbols-outlined text-sm">download</span>
                                    Xuất báo cáo
                                </button>
                            </div>
                        </div>

                        <!-- Stats Row -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-primary/10 text-primary rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">layers</span>
                                </div>
                                <div>
                                    <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Tổng số sà lan</p>
                                    <h4 class="text-lg font-black text-[#1e293b]">{{ filteredVesselBarges.length }} <span class="text-xs text-gray-400 font-bold">sà lan</span></h4>
                                </div>
                            </div>
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-teal-500/10 text-teal-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">local_shipping</span>
                                </div>
                                <div>
                                    <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Tổng số chuyến xe</p>
                                    <h4 class="text-lg font-black text-teal-600">{{ formatNumber(filteredVesselBarges.reduce((sum, b) => sum + b.truckCount, 0)) }} <span class="text-xs font-bold text-gray-400">lượt</span></h4>
                                </div>
                            </div>
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-amber-500/10 text-amber-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">scale</span>
                                </div>
                                <div>
                                    <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Tổng khối lượng nhận</p>
                                    <h4 class="text-lg font-black text-amber-600">{{ formatNumber(filteredVesselBarges.reduce((sum, b) => sum + b.totalWeight, 0)) }} <span class="text-xs font-bold text-gray-400">kg</span></h4>
                                </div>
                            </div>
                        </div>

                        <!-- Barges Summary Table Card -->
                        <div class="flex-1 bg-white rounded-[24px] p-4 md:p-5 soft-shadow border border-primary/5 flex flex-col min-h-[350px] md:min-h-0">
                            <div class="flex flex-wrap items-center justify-between mb-4 gap-3">
                                <h3 class="text-sm font-black text-primary flex items-center gap-1.5">
                                    <span class="material-symbols-outlined text-base">analytics</span>
                                    Chi tiết danh sách sà lan đã làm
                                </h3>
                            </div>
                            
                            <!-- Filters Row (The red-boxed area in the screenshot) -->
                            <div v-if="vesselBargesSummary.length > 0" class="flex flex-col md:flex-row gap-3 mb-4 p-3 bg-gray-50 rounded-[16px] border border-primary/5">
                                <!-- Search Barge Input -->
                                <div class="relative flex-1 flex items-center">
                                    <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm">search</span>
                                    <input 
                                        v-model="bargeSearchQuery"
                                        type="text"
                                        placeholder="Tìm kiếm tên sà lan..."
                                        class="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all placeholder:text-gray-400"
                                    />
                                    <button 
                                        v-if="bargeSearchQuery" 
                                        @click="bargeSearchQuery = ''" 
                                        class="absolute right-3 text-gray-400 hover:text-primary flex items-center"
                                    >
                                        <span class="material-symbols-outlined text-xs">close</span>
                                    </button>
                                </div>
                                
                                <!-- Month Filter for Barges -->
                                <div v-if="availableVesselMonths.length > 0" class="relative min-w-[200px] flex items-center">
                                    <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm">calendar_month</span>
                                    <select 
                                        v-model="vesselFilterMonth" 
                                        class="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-[12px] text-xs font-bold focus:outline-none focus:border-primary cursor-pointer appearance-none"
                                    >
                                        <option value="">Tất cả các tháng (Thời gian)</option>
                                        <option v-for="month in availableVesselMonths" :key="month" :value="month">
                                            Tháng {{ month }}
                                        </option>
                                    </select>
                                    <span class="material-symbols-outlined absolute right-3 text-gray-400 text-sm pointer-events-none">expand_more</span>
                                </div>
                            </div>

                            <div v-if="loadingVesselSummary" class="text-center py-10 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
                                <span class="material-symbols-outlined text-2xl animate-spin text-primary">sync</span>
                                Đang tính toán và tải dữ liệu sà lan...
                            </div>
                            <div v-else-if="vesselBargesSummary.length === 0" class="text-center py-10 text-gray-400 text-xs italic">
                                Tàu này chưa có sà lan nào.
                            </div>
                            <div v-else-if="filteredVesselBarges.length === 0" class="text-center py-10 text-gray-400 text-xs italic">
                                Không có sà lan nào hoạt động trong thời gian được lọc.
                            </div>
                            <div v-else class="flex-1 overflow-y-auto overflow-x-auto rounded-[16px] border border-gray-100 min-h-[250px] md:min-h-0">
                                <table class="w-full text-left border-collapse text-xs font-bold whitespace-nowrap">
                                    <thead>
                                        <tr class="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold">
                                            <th class="px-3 py-2 w-12 text-center bg-gray-50">STT</th>
                                            <th class="px-3 py-2 bg-gray-50">Tên sà lan</th>
                                            <th class="px-3 py-2 text-right bg-gray-50">Số chuyến xe chạy</th>
                                            <th class="px-3 py-2 text-right text-primary bg-gray-50">Tổng khối lượng (Net - kg)</th>
                                            <th class="px-3 py-2 bg-gray-50">Thời gian bắt đầu</th>
                                            <th class="px-3 py-2 bg-gray-50">Thời gian kết thúc</th>
                                            <th class="px-3 py-2 bg-gray-50 text-center">Trạng thái</th>
                                            <th class="px-3 py-2 text-center w-28 bg-gray-50">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-100 text-[#1e293b]/90">
                                        <tr v-for="(b, idx) in filteredVesselBarges" :key="b.id" class="hover:bg-gray-50 transition-colors">
                                            <td class="px-3 py-2 text-center text-gray-400 font-bold">{{ idx + 1 }}</td>
                                            <td class="px-3 py-2 font-bold text-gray-900">{{ b.name }}</td>
                                            <td class="px-3 py-2 text-right font-bold">{{ formatNumber(b.truckCount) }}</td>
                                            <td class="px-3 py-2 text-right font-bold text-teal-600">{{ formatNumber(b.totalWeight) }}</td>
                                            <td class="px-3 py-2 text-gray-700 whitespace-nowrap">{{ formatDateTimeStr(b.dateStart) || '-' }}</td>
                                            <td class="px-3 py-2 text-gray-700 whitespace-nowrap">{{ formatDateTimeStr(b.dateEnd) || '-' }}</td>
                                            <td class="px-3 py-2 text-center">
                                                <span v-if="b.locked" class="inline-flex px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-bold items-center gap-1 whitespace-nowrap">
                                                    <span class="material-symbols-outlined text-xs">lock</span> Khóa
                                                </span>
                                                <span v-else class="inline-flex px-2.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-xs font-bold items-center gap-1 whitespace-nowrap">
                                                    <span class="material-symbols-outlined text-xs">lock_open</span> Mở
                                                </span>
                                            </td>
                                            <td class="px-3 py-2 text-center">
                                                <button 
                                                    @click="selectBarge(activeVesselId!, b.id)" 
                                                    class="px-2.5 py-1 bg-primary text-white font-bold rounded-[12px] text-xs hover:scale-[1.05] transition-all whitespace-nowrap"
                                                >
                                                    Xem chi tiết
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Active Barge Workspace -->
                    <div v-else class="flex-1 flex flex-col gap-4 w-full max-w-[1500px] mx-auto pb-4 md:pb-0 min-h-0 overflow-y-auto md:overflow-hidden">
                        <!-- Header with breadcrumbs -->
                        <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] p-3 px-4 soft-shadow border border-primary/5 gap-3">
                            <div>
                                <div class="text-xs uppercase font-black tracking-widest text-primary mb-0.5">Đang chọn hoạt động</div>
                                <h1 class="text-sm font-black text-[#1e293b] flex items-center gap-1.5">
                                    <span @click="activeVesselId = null; activeBargeId = null" class="text-gray-400 hover:text-primary cursor-pointer transition-colors flex items-center gap-0.5" title="Quay lại Tổng quan"><span class="material-symbols-outlined text-base">home</span>Tổng quan</span>
                                    <span class="text-gray-300">&rsaquo;</span>
                                    Tàu: <span @click="activeBargeId = null" class="px-2 py-0.5 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer rounded-full text-xs font-black" title="Xem báo cáo tổng hợp tàu">{{ activeVessel?.name }}</span>
                                    <span class="text-gray-300">&rsaquo;</span>
                                    Sà lan: <span class="px-2 py-0.5 bg-teal-500/10 text-teal-600 rounded-full text-xs font-black">{{ activeBarge?.name }}</span>
                                    <button 
                                        v-if="!isCurrentVesselDone"
                                        @click="toggleBargeLock" 
                                        :class="['ml-2 p-1 rounded-full flex items-center justify-center transition-all', cfgForm.locked ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200']"
                                        :title="cfgForm.locked ? 'Mở khóa sà lan' : 'Khóa sà lan'"
                                    >
                                        <span class="material-symbols-outlined text-[12px] font-bold">{{ cfgForm.locked ? 'lock' : 'lock_open' }}</span>
                                    </button>
                                    <button 
                                        v-if="!isCurrentVesselDone && (authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_vessel_manage', 'update'))"
                                        @click="activeVessel && activeBarge && openMoveBargeModal(activeVessel, activeBarge)" 
                                        class="ml-2 px-2.5 py-0.5 rounded-full flex items-center justify-center gap-1 text-[11px] font-bold transition-all bg-gray-100 text-gray-700 hover:bg-teal-50 hover:text-teal-700 border border-gray-200 hover:border-teal-300 shadow-xs"
                                        title="Chuyển sà lan này sang tàu mẹ khác"
                                    >
                                        <span class="material-symbols-outlined text-[13px] text-teal-600">swap_horiz</span>
                                        Chuyển tàu
                                    </button>
                                </h1>
                            </div>

                            <!-- Sync indicator -->
                            <div class="flex items-center gap-1.5">
                                <span v-if="cfgForm.locked" class="text-xs font-black text-red-600 flex items-center gap-0.5 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                                    <span class="material-symbols-outlined text-[12px]">lock</span> ĐÃ KHÓA
                                </span>
                                <span v-else-if="saving" class="text-xs font-bold text-gray-400 flex items-center gap-0.5">
                                    <span class="material-symbols-outlined text-xs animate-spin">sync</span> Đang đồng bộ...
                                </span>
                                <span v-else class="text-xs font-bold text-teal-500 flex items-center gap-0.5">
                                    <span class="material-symbols-outlined text-xs">cloud_done</span> Đã đồng bộ đám mây
                                </span>
                            </div>
                        </div>

                        <!-- Read-only Banner in Active Barge Workspace -->
                        <div v-if="isCurrentVesselDone" class="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-[20px] text-xs flex items-center justify-between shadow-sm">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-amber-600 text-lg">lock</span>
                                <span>
                                    <strong>Chế độ Chỉ xem (Read-only):</strong> Tàu <strong>{{ activeVessel?.name }}</strong> đã chốt số liệu. Dữ liệu xe cân đang được bảo vệ. Bạn vẫn có thể in phiếu (A5) và xuất Excel bình thường.
                                </span>
                            </div>
                            <button 
                                v-if="authStore.role === 'admin'"
                                @click="handleReopenVessel(activeVesselId!)"
                                :disabled="isUpdatingVesselStatus"
                                class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-[10px] text-xs flex items-center gap-1 shadow-sm transition-all disabled:opacity-50 shrink-0 ml-2"
                                title="Mở lại làm hàng cho tàu (Chỉ Quản trị viên)"
                            >
                                <span class="material-symbols-outlined text-sm">lock_open</span>
                                Mở lại tàu
                            </button>
                        </div>

                        <!-- Tab Navigation -->
                        <div class="flex gap-1.5 border-b border-primary/15 pb-1.5">
                            <button 
                                @click="activeTab = 'data'"
                                :class="['px-4 py-1.5 rounded-[12px] font-bold text-xs transition-all flex items-center gap-1', activeTab === 'data' ? 'bg-primary text-white shadow-soft' : 'text-[#1e293b]/60 hover:bg-white/50']"
                            >
                                <span class="material-symbols-outlined text-sm">local_shipping</span>
                                Danh sách xe & In ấn
                            </button>
                            <button v-if="(authStore.role === 'admin' || canUpdate()) && !isCurrentVesselDone"
                                @click="activeTab = 'config'"
                                :class="['px-4 py-1.5 rounded-[12px] font-bold text-xs transition-all flex items-center gap-1', activeTab === 'config' ? 'bg-primary text-white shadow-soft' : 'text-[#1e293b]/60 hover:bg-white/50']"
                            >
                                <span class="material-symbols-outlined text-sm">settings</span>
                                Cấu hình mẫu phiếu
                            </button>
                        </div>

                        <!-- TAB 1: DATA & PRINT -->
                        <div v-if="activeTab === 'data'" class="flex-1 flex flex-col gap-4 min-h-0 animate-fade-in">
                            <!-- Stats & Excel Upload Side-by-Side -->
                            <div class="grid grid-cols-2 lg:grid-cols-12 gap-3 md:gap-4 items-stretch">
                                <!-- Stats Grid (6 cols / 12 cols depending on role and read-only status) -->
                                <div :class="((authStore.role === 'admin' || canCreate()) && !isCurrentVesselDone) ? 'col-span-2 lg:col-span-6' : 'col-span-2 lg:col-span-12'" class="grid grid-cols-3 gap-2 sm:gap-3">
                                    <div class="bg-white rounded-2xl p-2 sm:p-3 soft-shadow border border-primary/5 flex items-center gap-1.5 sm:gap-3">
                                        <div class="size-7 sm:size-9 bg-primary/10 text-primary rounded-[10px] sm:rounded-[12px] flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-sm sm:text-lg">local_shipping</span>
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <p class="text-[7px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Tổng số xe</p>
                                            <h4 class="text-xs sm:text-base font-black text-[#1e293b] truncate">{{ filteredTrucks.length }} <span class="text-xs sm:text-xs text-gray-400 font-bold">xe</span></h4>
                                        </div>
                                    </div>
                                    <div class="bg-white rounded-2xl p-2 sm:p-3 soft-shadow border border-primary/5 flex items-center gap-1.5 sm:gap-3">
                                        <div class="size-7 sm:size-9 bg-teal-500/10 text-teal-600 rounded-[10px] sm:rounded-[12px] flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-sm sm:text-lg">scale</span>
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <p class="text-[7px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Tổng Net</p>
                                            <h4 class="text-xs sm:text-base font-black text-teal-600 truncate">{{ formatNumber(totalNetWeight) }} <span class="text-xs sm:text-xs font-bold">kg</span></h4>
                                        </div>
                                    </div>
                                    <div class="bg-white rounded-2xl p-2 sm:p-3 soft-shadow border border-primary/5 flex items-center gap-1.5 sm:gap-3">
                                        <div class="size-7 sm:size-9 bg-amber-500/10 text-amber-600 rounded-[10px] sm:rounded-[12px] flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-sm sm:text-lg">monitoring</span>
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <p class="text-[7px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Trung bình</p>
                                            <h4 class="text-xs sm:text-base font-black text-amber-600 truncate">{{ formatNumber(avgNetWeight) }} <span class="text-xs sm:text-xs font-bold">kg</span></h4>
                                        </div>
                                    </div>
                                </div>

                                <!-- Compact Excel Upload (3 cols) -->
                                <div v-if="(authStore.role === 'admin' || canCreate()) && !isCurrentVesselDone"
                                    @dragover.prevent
                                    @drop="cfgForm.locked ? null : handleExcelDrop($event)"
                                    :class="['col-span-1 lg:col-span-3 bg-white rounded-2xl p-2 sm:p-3 soft-shadow border border-primary/5 hover:border-primary/20 transition-all flex items-center justify-between gap-1.5 sm:gap-3 bg-gray-50/50', cfgForm.locked ? 'opacity-50 pointer-events-none' : '']"
                                >
                                    <input 
                                        type="file" 
                                        ref="fileInput" 
                                        class="hidden" 
                                        @change="handleFileSelect" 
                                        accept=".xlsx, .xls" 
                                        :disabled="cfgForm.locked"
                                    />
                                    <div class="flex items-center gap-1.5 sm:gap-2 min-w-0 cursor-pointer" @click="cfgForm.locked ? null : fileInput?.click()">
                                        <div class="size-7 sm:size-9 bg-primary/10 text-primary rounded-[10px] sm:rounded-[12px] flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-sm sm:text-lg">upload_file</span>
                                        </div>
                                        <div class="text-left min-w-0">
                                            <p class="text-xs sm:text-xs font-black text-[#1e293b] truncate">Nhập Excel</p>
                                            <p class="text-xs sm:text-xs text-gray-400 font-bold truncate hidden sm:block">Click chọn file</p>
                                        </div>
                                    </div>
                                    
                                    <div class="flex items-center gap-1 flex-shrink-0">
                                        <button 
                                            @click="downloadSampleExcel"
                                            class="size-6 sm:size-7 bg-gray-100 hover:bg-gray-200 text-[#1e293b] rounded-[6px] sm:rounded-[8px] flex items-center justify-center border border-gray-200 transition-colors"
                                            title="Tải Excel mẫu"
                                        >
                                            <span class="material-symbols-outlined text-xs sm:text-sm">download</span>
                                        </button>
                                    </div>
                                </div>


                                <!-- Direct Sync Card (3 cols) -->
                                <div v-if="(authStore.role === 'admin' || canCreate()) && !isCurrentVesselDone"
                                    class="col-span-1 lg:col-span-3 bg-white rounded-2xl p-2 sm:p-3 soft-shadow border border-primary/5 hover:border-primary/20 transition-all flex items-center justify-between gap-1.5 sm:gap-3 bg-gray-50/50"
                                >
                                    <div class="flex items-center gap-1.5 sm:gap-2 min-w-0 cursor-pointer" @click="syncFromAllocatorActiveBarge()">
                                        <div class="size-7 sm:size-9 bg-teal-500/10 text-teal-600 rounded-[10px] sm:rounded-[12px] flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-sm sm:text-lg">sync_alt</span>
                                        </div>
                                        <div class="text-left min-w-0">
                                            <p class="text-xs sm:text-xs font-black text-[#1e293b] truncate">Đồng bộ từ Phân bổ</p>
                                            <p class="text-xs sm:text-xs text-gray-400 font-bold truncate hidden sm:block">Kéo từ tab Phân bổ</p>
                                        </div>
                                    </div>
                                    <button 
                                        @click="syncFromAllocatorActiveBarge"
                                        class="px-2 py-1 sm:px-2.5 sm:py-1.5 bg-teal-600 text-white text-xs sm:text-xs font-black rounded-[6px] sm:rounded-[8px] hover:scale-[1.02] active:scale-[0.98] transition-all flex-shrink-0"
                                    >
                                        Đồng bộ
                                    </button>
                                </div>
                            </div>

                            <!-- Truck List Table Card -->
                             <div class="flex-1 bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex flex-col min-h-[350px] md:min-h-0">
                                <div class="flex flex-wrap items-center justify-between mb-3 gap-3">
                                    <h3 class="text-sm font-black text-primary flex items-center gap-1.5">
                                        <span class="material-symbols-outlined text-base">list_alt</span>
                                        Chi tiết danh sách xe cân sà lan
                                    </h3>
                                    
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <button v-if="(authStore.role === 'admin' || canCreate()) && !isCurrentVesselDone"
                                            @click="openAddTruckDialog"
                                            :disabled="cfgForm.locked"
                                            class="h-[32px] min-h-[32px] max-h-[32px] px-3 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none font-bold rounded-[8px] text-xs leading-none inline-flex items-center justify-center gap-1.5 transition-all shrink-0 box-border border-0"
                                        >
                                            <span class="material-symbols-outlined !text-[15px] leading-none">add</span>
                                            Thêm xe
                                        </button>
                                        <button v-if="(authStore.role === 'admin' || canCreate()) && !isCurrentVesselDone"
                                            @click="fileInput?.click()"
                                            :disabled="cfgForm.locked"
                                            class="h-[32px] min-h-[32px] max-h-[32px] px-3 bg-teal-600/10 text-teal-700 hover:bg-teal-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none font-bold rounded-[8px] text-xs leading-none inline-flex items-center justify-center gap-1.5 transition-all shrink-0 box-border border-0"
                                        >
                                            <span class="material-symbols-outlined !text-[15px] leading-none">upload_file</span>
                                            Nhập Excel
                                        </button>
                                        <button v-if="(authStore.role === 'admin' || canDelete()) && !isCurrentVesselDone"
                                            @click="clearTrucks"
                                            :disabled="cfgForm.locked"
                                            class="h-[32px] min-h-[32px] max-h-[32px] px-3 bg-red-50 hover:bg-red-100 text-red-500 font-bold rounded-[8px] text-xs leading-none inline-flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none shrink-0 box-border border-0"
                                        >
                                            <span class="material-symbols-outlined !text-[15px] leading-none">delete_sweep</span>
                                            Xóa tất cả
                                        </button>
                                        <button 
                                            @click="triggerPrint()"
                                            class="h-[32px] min-h-[32px] max-h-[32px] px-3 bg-primary text-white hover:bg-primary/90 font-bold rounded-[8px] text-xs leading-none inline-flex items-center justify-center gap-1.5 transition-all shrink-0 box-border border-0"
                                        >
                                            <span class="material-symbols-outlined !text-[15px] leading-none">print</span>
                                            In hàng loạt (A5)
                                        </button>
                                        <button 
                                            @click="exportActiveBargeTrucksToExcel"
                                            :disabled="exportingActiveBargeTrucks || filteredTrucks.length === 0"
                                            class="h-[32px] min-h-[32px] max-h-[32px] px-3 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none font-bold rounded-[8px] text-xs leading-none inline-flex items-center justify-center gap-1.5 transition-all shrink-0 box-border border-0"
                                        >
                                            <span v-if="exportingActiveBargeTrucks" class="material-symbols-outlined !text-[15px] leading-none animate-spin">sync</span>
                                            <span v-else class="material-symbols-outlined !text-[15px] leading-none">download</span>
                                            Xuất Excel
                                        </button>
                                    </div>
                                </div>

                                <!-- Table -->
                                <div class="flex-1 overflow-y-auto overflow-x-auto rounded-[16px] border border-gray-100 min-h-[250px] md:min-h-0">
                                    <table class="w-full text-left border-collapse text-xs font-bold whitespace-nowrap">
                                        <thead class="sticky top-0 bg-gray-50 z-10 shadow-sm">
                                            <tr class="text-gray-500 border-b border-gray-100 font-bold select-none">
                                                <th class="p-2.5 w-10 text-center bg-gray-50">STT</th>
                                                <th class="p-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('ticketNo')">
                                                    <div class="flex items-center gap-1">
                                                        Số phiếu
                                                        <span v-if="sortKey === 'ticketNo'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('plateNumber')">
                                                    <div class="flex items-center gap-1">
                                                        Số xe (Biển số)
                                                        <span v-if="sortKey === 'plateNumber'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('driver')">
                                                    <div class="flex items-center gap-1">
                                                        Tài xế
                                                        <span v-if="sortKey === 'driver'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 text-right bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('weight1')">
                                                    <div class="flex items-center justify-end gap-1">
                                                        TL Lần 1 (kg)
                                                        <span v-if="sortKey === 'weight1'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 text-right bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('weight2')">
                                                    <div class="flex items-center justify-end gap-1">
                                                        TL Lần 2 (kg)
                                                        <span v-if="sortKey === 'weight2'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 text-right text-primary bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('weightNet')">
                                                    <div class="flex items-center justify-end gap-1">
                                                        TL Hàng (Net)
                                                        <span v-if="sortKey === 'weightNet'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('dateIn')">
                                                    <div class="flex items-center gap-1">
                                                        Giờ vào
                                                        <span v-if="sortKey === 'dateIn'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('dateOut')">
                                                    <div class="flex items-center gap-1">
                                                        Giờ ra
                                                        <span v-if="sortKey === 'dateOut'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('note')">
                                                    <div class="flex items-center gap-1">
                                                        Ghi chú
                                                        <span v-if="sortKey === 'note'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 text-center w-28 bg-gray-50">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-gray-100 text-[#1e293b]/90">
                                            <tr v-if="filteredTrucks.length === 0">
                                                <td colspan="11" class="p-6 text-center text-gray-400 italic">
                                                    Chưa có dữ liệu xe. Hãy tải file Excel hoặc thêm xe thủ công để hiển thị.
                                                </td>
                                            </tr>
                                            <tr v-for="(truck, index) in filteredTrucks" :key="truck.id" class="hover:bg-gray-50 transition-colors">
                                                <td class="p-2 text-center text-gray-400 font-bold">{{ index + 1 }}</td>
                                                <td class="p-2 font-mono text-[#1e293b] font-bold">{{ truck.ticketNo }}</td>
                                                <td class="p-2 font-bold text-gray-900">{{ truck.plateNumber }}</td>
                                                <td class="p-2 text-gray-700">{{ truck.driver || '-' }}</td>
                                                <td class="p-2 text-right font-bold">{{ formatNumber(truck.weight1) }}</td>
                                                <td class="p-2 text-right font-bold">{{ formatNumber(truck.weight2) }}</td>
                                                <td class="p-2 text-right font-bold text-teal-600">{{ formatNumber(truck.weightNet) }}</td>
                                                <td class="p-2 text-gray-700 whitespace-nowrap">{{ formatDateTimeStr(truck.dateIn) }}</td>
                                                <td class="p-2 text-gray-700 whitespace-nowrap">{{ formatDateTimeStr(truck.dateOut) }}</td>
                                                <td class="p-2 text-gray-400 italic max-w-[150px] truncate" :title="truck.note">{{ truck.note || '-' }}</td>
                                                <td class="p-2">
                                                    <div class="flex items-center gap-1.5 justify-center">
                                                        <button 
                                                    @click="triggerPrint(truck)" 
                                                    class="size-8 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-600 flex items-center justify-center transition-all active:scale-95"
                                                    title="In phiếu này"
                                                >
                                                    <span class="material-symbols-outlined text-[12px]">print</span>
                                                </button>
                                                        <button 
                                                    v-if="(authStore.role === 'admin' || canUpdate()) && !isCurrentVesselDone" 
                                                    @click="openEditTruckDialog(truck)" 
                                                    :disabled="cfgForm.locked" 
                                                    class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none"
                                                    title="Sửa"
                                                >
                                                    <span class="material-symbols-outlined text-[12px]">edit</span>
                                                </button>
                                                        <button 
                                                    v-if="(authStore.role === 'admin' || canDelete()) && !isCurrentVesselDone" 
                                                    @click="deleteTruck(truck.id, truck.plateNumber)" 
                                                    :disabled="cfgForm.locked" 
                                                    class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none"
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
                            </div>
                        </div>

                        <!-- TAB 2: CONFIGURATION -->
                        <div v-if="activeTab === 'config' && (authStore.role === 'admin' || canUpdate()) && !isCurrentVesselDone" class="flex-1 flex flex-col gap-4 overflow-y-auto min-h-0 pb-6 pr-1 animate-fade-in custom-scrollbar">
                            <!-- Banner lock warning -->
                            <div v-if="cfgForm.locked" class="bg-red-50 text-red-700 text-xs font-bold p-3 rounded-lg border border-red-200 mb-2 flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm">warning</span>
                                Sà lan này đang bị khóa. Vui lòng mở khóa để sửa đổi cấu hình.
                            </div>

                            <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                                <!-- Print Configuration (7 cols) -->
                                <div class="bg-white rounded-[16px] p-5 soft-shadow border border-primary/5 lg:col-span-7 flex flex-col justify-between">
                                    <div>
                                        <h3 class="text-sm font-black text-primary mb-4 flex items-center justify-between">
                                            <span class="flex items-center gap-1.5">
                                                <span class="material-symbols-outlined text-base">settings_applications</span>
                                                Cấu hình thông tin in chung
                                            </span>
                                            <span class="text-[11px] font-bold text-gray-400">Sà lan: {{ activeBarge?.name }}</span>
                                        </h3>
                                        
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <!-- Readonly Vessel Inherited Goods -->
                                            <div class="flex flex-col gap-1">
                                                <div class="flex items-center justify-between">
                                                    <label class="text-xs font-bold text-gray-500">Tên hàng hóa</label>
                                                    <span class="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-700 font-bold rounded border border-blue-200 flex items-center gap-0.5">
                                                        <span class="material-symbols-outlined text-[10px]">lock</span> Nguồn tàu
                                                    </span>
                                                </div>
                                                <input 
                                                    :value="activeVessel?.cargo_type || cfgForm.goods || 'Chưa thiết lập'" 
                                                    disabled 
                                                    type="text" 
                                                    class="px-3 py-2 rounded-[8px] border border-gray-200 bg-gray-50 text-gray-700 font-bold text-xs cursor-not-allowed opacity-90"
                                                >
                                            </div>
                                            <!-- Readonly Vessel Inherited Goods Code -->
                                            <div class="flex flex-col gap-1">
                                                <div class="flex items-center justify-between">
                                                    <label class="text-xs font-bold text-gray-500">Mã hàng hóa</label>
                                                    <span class="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-700 font-bold rounded border border-blue-200 flex items-center gap-0.5">
                                                        <span class="material-symbols-outlined text-[10px]">lock</span> Nguồn tàu
                                                    </span>
                                                </div>
                                                <input 
                                                    :value="activeVessel?.cargo_code || cfgForm.goodsCode || '-'" 
                                                    disabled 
                                                    type="text" 
                                                    class="px-3 py-2 rounded-[8px] border border-gray-200 bg-gray-50 text-gray-700 font-bold text-xs cursor-not-allowed opacity-90"
                                                >
                                            </div>
                                            <!-- Readonly Vessel Inherited Customer/Owner -->
                                            <div class="flex flex-col gap-1 md:col-span-2">
                                                <div class="flex items-center justify-between">
                                                    <label class="text-xs font-bold text-gray-500">Tên khách hàng / Chủ hàng</label>
                                                    <span class="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-700 font-bold rounded border border-blue-200 flex items-center gap-0.5">
                                                        <span class="material-symbols-outlined text-[10px]">lock</span> Kế thừa 100% Nguồn tàu
                                                    </span>
                                                </div>
                                                <input 
                                                    :value="activeVessel?.customer || cfgForm.owner || 'Chưa thiết lập'" 
                                                    disabled 
                                                    type="text" 
                                                    class="px-3 py-2 rounded-[8px] border border-gray-200 bg-gray-50 text-gray-700 font-bold text-xs cursor-not-allowed opacity-90"
                                                >
                                                <p class="text-[10px] text-gray-400 italic">
                                                    * Khách hàng, Loại hàng & Mã hàng được đồng bộ tuyệt đối từ Nguồn tàu: <strong>{{ activeVessel?.name }}</strong>.
                                                </p>
                                            </div>

                                            <div class="flex flex-col gap-1">
                                                <label class="text-xs font-bold text-gray-500">Người cân (NV trạm cân)</label>
                                                <input v-model="cfgForm.operator" :disabled="cfgForm.locked" type="text" placeholder="Tên nhân viên..." class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-xs font-bold text-gray-500">Hình thức xuất/nhập</label>
                                                <select v-model="cfgForm.xn" :disabled="cfgForm.locked" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-bold bg-white disabled:opacity-50 disabled:cursor-not-allowed">
                                                    <option value="XUẤT KHẨU">XUẤT KHẨU</option>
                                                    <option value="NHẬP KHẨU">NHẬP KHẨU</option>
                                                    <option value="NỘI BỘ">NỘI BỘ</option>
                                                </select>
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-xs font-bold text-gray-500">Tiền tố số phiếu (Mẫu số)</label>
                                                <input v-model="cfgForm.ticketPrefix" :disabled="cfgForm.locked" @change="handleTicketConfigChange" type="text" placeholder="Ví dụ: PC-" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-xs font-bold text-gray-500">Số phiếu bắt đầu</label>
                                                <input v-model="cfgForm.ticketSeed" :disabled="cfgForm.locked" @change="handleTicketConfigChange" type="text" placeholder="Ví dụ: 1 hoặc 001" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1 md:col-span-2">
                                                <label class="text-xs font-bold text-gray-500">Số lệnh cấp hàng / Số lệnh xuất (Khớp tự động từ Phân bổ)</label>
                                                <input v-model="cfgForm.orderNo" :disabled="cfgForm.locked" type="text" placeholder="Ví dụ: L12345 hoặc L-54321..." class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Quality Evaluation Configuration (5 cols) -->
                                <div class="bg-white rounded-[16px] p-5 soft-shadow border border-primary/5 lg:col-span-5 flex flex-col justify-between">
                                    <div>
                                        <h3 class="text-sm font-black text-primary mb-4 flex items-center gap-1.5">
                                            <span class="material-symbols-outlined text-base">analytics</span>
                                            Cấu hình Đánh giá chất lượng
                                        </h3>
                                        
                                        <div class="space-y-3">
                                            <div class="flex flex-col gap-1">
                                                <label class="text-xs font-bold text-gray-500">Tỷ lệ Chính phẩm (%)</label>
                                                <input v-model="cfgForm.chinhpham" :disabled="cfgForm.locked" type="text" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-xs font-bold text-gray-500">Tỷ lệ Phụ phẩm (%)</label>
                                                <input v-model="cfgForm.phupham" :disabled="cfgForm.locked" type="text" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-xs font-bold text-gray-500">Kết luận</label>
                                                <textarea v-model="cfgForm.ketluan" :disabled="cfgForm.locked" rows="3" placeholder="Nhập kết luận đánh giá..." class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed resize-none"></textarea>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end">
                                        <button 
                                            @click="saveBargeConfigImmediately" 
                                            :disabled="cfgForm.locked"
                                            class="px-4 py-2 bg-primary text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-soft hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span class="material-symbols-outlined text-sm">save</span>
                                            Lưu cấu hình sà lan
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Unified Port-wide Standard Ticket Banner -->
                            <div class="bg-gradient-to-r from-teal-50 to-primary/5 rounded-[20px] p-6 border border-primary/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-xs">
                                <div class="flex items-start gap-4">
                                    <div class="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0 mt-0.5">
                                        <span class="material-symbols-outlined text-2xl">verified</span>
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <h4 class="text-sm font-black text-[#1e293b]">Mẫu in phiếu cân chuẩn toàn cảng Nguyên Ngọc</h4>
                                            <span class="text-[10px] uppercase font-black tracking-wider px-2.5 py-0.5 bg-teal-100 text-teal-800 rounded-full border border-teal-200">Đang áp dụng đồng nhất 100%</span>
                                        </div>
                                        <p class="text-xs text-gray-600 mt-1.5 leading-relaxed max-w-2xl">
                                            Tất cả sà lan trên toàn cảng đều tự động áp dụng thống nhất mẫu in phiếu cân chuẩn A5 (210mm x 148mm) cấp Hệ thống. Bấm nút bên cạnh để mở bộ thiết kế mẫu phiếu cân toàn cảng.
                                        </p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button 
                                        v-if="authStore.role === 'admin' || hasDetailPermission('weighbridge', 'wb_layout_config', 'read')"
                                        @click="openGlobalTemplateModal"
                                        class="px-4 py-2.5 bg-primary text-white hover:bg-primary-dark font-bold text-xs rounded-xl shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                                    >
                                        <span class="material-symbols-outlined text-base">design_services</span>
                                        Chỉnh sửa mẫu phiếu toàn cảng
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </div>

        <!-- COLUMN MAPPING MODAL -->
        <div v-if="showMappingModal && pendingExcelData" class="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 animate-fade-in no-print font-display">
            <div class="bg-white rounded-2xl max-w-xl w-full p-6 md:p-8 soft-shadow border border-primary/10 flex flex-col gap-6 max-h-[85vh]">
                <div>
                    <h3 class="text-xl font-black text-primary mb-1">Cấu hình ánh xạ cột Excel</h3>
                    <p class="text-xs text-[#1b0d11]/60">Hệ thống đã nhận diện các cột. Vui lòng kiểm tra và sửa lại nếu chưa khớp.</p>
                </div>

                <!-- Fields grid -->
                <div class="space-y-4 max-h-[500px] overflow-y-auto pr-2 flex-1">
                    <div v-for="field in mappingFields" :key="field.id" class="grid grid-cols-5 items-center gap-4">
                        <label class="col-span-2 text-xs font-bold text-gray-500">
                            {{ field.label }}
                        </label>
                        <select 
                            v-model="pendingExcelData.mapping[field.id]" 
                            class="col-span-3 px-3 py-2 border border-gray-200 rounded-[8px] text-xs font-bold bg-white focus:outline-none focus:border-primary"
                        >
                            <option :value="-1">-- Không ánh xạ --</option>
                            <option v-for="col in pendingExcelData.columns" :key="col.index" :value="col.index">
                                {{ col.name }} (Cột {{ col.index + 1 }})
                            </option>
                        </select>
                    </div>
                </div>

                <!-- Footer buttons -->
                <div class="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                    <button 
                        @click="showMappingModal = false; pendingExcelData = null" 
                        class="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full text-xs transition-all"
                    >
                        Hủy bỏ
                    </button>
                    <button 
                        @click="confirmExcelMapping" 
                        class="px-5 py-2.5 bg-primary text-white font-bold rounded-full text-xs shadow-soft hover:scale-[1.02] transition-all"
                    >
                        Hoàn tất nhập dữ liệu
                    </button>
                </div>
            </div>
        </div>

        <!-- DIALOG: ADD/EDIT TRUCK -->
        <div v-if="showTruckDialog" class="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 animate-fade-in no-print font-display">
            <div class="bg-white rounded-[16px] max-w-md w-full p-6 md:p-8 soft-shadow border border-primary/10 flex flex-col gap-6">
                <div>
                    <h3 class="text-xl font-black text-primary mb-1">{{ dialogTruck.id ? 'Sửa thông tin xe cân' : 'Thêm thông tin xe cân thủ công' }}</h3>
                    <p class="text-xs text-[#1b0d11]/60">Nhập đầy đủ thông tin chi tiết xe cân bên dưới.</p>
                </div>

                <!-- Form Inputs -->
                <form class="grid grid-cols-2 gap-4 text-xs font-bold text-gray-500">
                    <div class="col-span-2 flex flex-col gap-1.5">
                        <label>Biển số xe / Số xe *</label>
                        <input v-model="dialogTruck.plateNumber" type="text" placeholder="Ví dụ: 51C-12345" class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-semibold focus:outline-none focus:border-primary">
                    </div>
                    <div class="col-span-2 flex flex-col gap-1.5">
                        <label>Họ tên tài xế</label>
                        <input v-model="dialogTruck.driver" type="text" placeholder="Tên tài xế..." class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-semibold focus:outline-none focus:border-primary">
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label>TL lần 1 (kg) *</label>
                        <input v-model.number="dialogTruck.weight1" type="number" @input="onWeightInput" class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-semibold focus:outline-none focus:border-primary">
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label>TL lần 2 (kg) *</label>
                        <input v-model.number="dialogTruck.weight2" type="number" @input="onWeightInput" class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-semibold focus:outline-none focus:border-primary">
                    </div>
                    <div class="col-span-2 flex flex-col gap-1.5">
                        <label>Trọng lượng hàng (Net) (kg)</label>
                        <input :value="dialogTruck.weightNet" type="number" readonly class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-black focus:outline-none bg-gray-50 text-teal-600">
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label>Ngày vào</label>
                        <input v-model="dialogDateInDate" type="date" class="w-full px-3 py-2.5 rounded-[8px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary">
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label>Giờ vào (24h)</label>
                        <input 
                            :value="dialogTimeInTime" 
                            type="text" 
                            inputmode="numeric" 
                            maxlength="5" 
                            placeholder="19:30" 
                            @input="onTimeInput($event, 'in')" 
                            @blur="onTimeBlur($event, 'in')" 
                            class="w-full px-3 py-2.5 rounded-[8px] border border-gray-200 text-xs font-semibold text-center focus:outline-none focus:border-primary placeholder:text-gray-300"
                        >
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label>Ngày ra</label>
                        <input v-model="dialogDateOutDate" type="date" class="w-full px-3 py-2.5 rounded-[8px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary">
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label>Giờ ra (24h)</label>
                        <input 
                            :value="dialogTimeOutTime" 
                            type="text" 
                            inputmode="numeric" 
                            maxlength="5" 
                            placeholder="20:15" 
                            @input="onTimeInput($event, 'out')" 
                            @blur="onTimeBlur($event, 'out')" 
                            class="w-full px-3 py-2.5 rounded-[8px] border border-gray-200 text-xs font-semibold text-center focus:outline-none focus:border-primary placeholder:text-gray-300"
                        >
                    </div>
                    <div class="col-span-2 flex flex-col gap-1.5">
                        <label>Ghi chú</label>
                        <input v-model="dialogTruck.note" type="text" placeholder="Ghi chú thêm..." class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-semibold focus:outline-none focus:border-primary">
                    </div>
                </form>

                <!-- Footer buttons -->
                <div class="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                    <button 
                        @click="showTruckDialog = false" 
                        class="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full text-xs transition-all"
                    >
                        Hủy bỏ
                    </button>
                    <button 
                        @click="saveTruck" 
                        class="px-5 py-2.5 bg-primary text-white font-bold rounded-full text-xs shadow-soft hover:scale-[1.02] transition-all"
                    >
                        Lưu thông tin
                    </button>
                </div>
            </div>
        </div>

        <!-- GLOBAL TOAST BANNER -->
        <div v-if="toastMessage" :class="['fixed bottom-8 right-8 z-[200] px-6 py-4 rounded-[16px] shadow-lg border text-sm font-bold flex items-center gap-2 animate-fade-in no-print', toastType === 'success' ? 'bg-teal-50 border-teal-200 text-teal-700' : (toastType === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700')]">
            <span class="material-symbols-outlined text-lg">{{ toastType === 'success' ? 'check_circle' : (toastType === 'warning' ? 'warning' : 'error') }}</span>
            <span>{{ toastMessage }}</span>
        </div>

        <!-- PRINT ONLY SECTION -->
        <teleport to="body">
            <div id="print-section" class="hidden">
                <div v-for="truck in printTrucksList" :key="truck.id" class="print-page" style="position: relative; width: 210mm; height: 148mm; padding: 0; box-sizing: border-box; overflow: hidden; font-family: Arial, Helvetica, sans-serif;">
                                    <div 
                                        v-for="el in (cfgForm.printElements || [])" 
                                        :key="el.id"
                                        class="print-element"
                                        :style="{
                                            position: 'absolute',
                                            left: el.x + 'mm',
                                            top: el.y + 'mm',
                                            width: el.width + 'mm',
                                            height: el.height + 'mm',
                                            fontSize: el.fontSize + 'pt',
                                            fontWeight: el.fontWeight || 'bold',
                            fontStyle: el.fontStyle || 'normal',
                            textAlign: el.align || 'left',
                            lineHeight: '1.2',
                            color: 'black'
                        }"
                    >
                        <!-- Field type element -->
                        <div v-if="el.type === 'field'" style="display: flex; align-items: baseline; width: 100%; height: 100%; overflow: hidden;">
                            <span v-if="el.label" style="flex-shrink: 0; font-weight: inherit;" :style="{ width: (el.labelWidth || 20) + 'mm' }">{{ el.label }}</span>
                            <span v-if="el.label" style="flex-shrink: 0; margin-right: 1mm;">:</span>
                            <span 
                                style="flex-grow: 1; font-weight: inherit;"
                                :style="{ whiteSpace: (el.fieldId === 'ketluan' || el.fieldId === 'note') ? 'pre-wrap' : 'inherit', wordBreak: (el.fieldId === 'ketluan' || el.fieldId === 'note') ? 'break-word' : 'inherit' }"
                            >
                                {{ getFieldValue(el.fieldId!, truck) }}
                            </span>
                        </div>
                        
                        <!-- Static text element -->
                        <div v-else-if="el.type === 'text'" style="width: 100%; height: 100%; overflow: hidden; whitespace: pre-wrap;">
                            {{ el.text }}
                        </div>
                        
                        <!-- Line element -->
                        <div v-else-if="el.type === 'line'" style="width: 100%; height: 100%; background-color: black;"></div>
                        
                        <!-- Rect element -->
                        <div v-else-if="el.type === 'rect'" style="width: 100%; height: 100%; border: 0.5pt solid black;" :style="{ borderStyle: el.borderStyle || 'solid' }"></div>
                    </div>
                </div>
            </div>
    </teleport>

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
                class="w-full max-w-[480px] bg-white rounded-[24px] border border-gray-100 shadow-2xl p-6 flex flex-col gap-4 transform transition-all scale-100"
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

    <!-- Premium Custom Move Barge Modal -->
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
            v-if="showMoveBargeModal && moveBargeTarget" 
            class="fixed inset-0 z-[999] flex items-center justify-center bg-[#1e293b]/40 backdrop-blur-sm p-4 no-print"
            @click.self="!isMovingBarge && (showMoveBargeModal = false)"
        >
            <div 
                class="w-full max-w-[480px] bg-white rounded-[24px] border border-gray-100 shadow-2xl p-6 flex flex-col gap-4 transform transition-all scale-100"
            >
                <!-- Header -->
                <div class="flex items-center gap-3">
                    <div class="size-11 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-2xl">swap_horiz</span>
                    </div>
                    <div>
                        <h3 class="text-base font-black text-gray-900 leading-tight">
                            Chuyển sà lan sang tàu khác 🚢
                        </h3>
                        <p class="text-xs font-semibold text-gray-500 mt-0.5">
                            Điều chuyển sà lan giữa các kế hoạch làm hàng
                        </p>
                    </div>
                </div>

                <!-- Content Box -->
                <div class="bg-gray-50 rounded-[16px] p-4 border border-gray-100 flex flex-col gap-3">
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-gray-500 font-bold">Sà lan cần chuyển:</span>
                        <span class="text-gray-900 font-black text-sm px-2.5 py-1 bg-white rounded-lg border border-gray-200">
                            {{ moveBargeTarget.bargeName }}
                        </span>
                    </div>

                    <div class="grid grid-cols-5 items-center gap-2 py-2">
                        <div class="col-span-2 flex flex-col gap-1">
                            <span class="text-[11px] font-bold text-gray-400 uppercase">Tàu hiện tại</span>
                            <div class="p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-black text-primary truncate" :title="moveBargeTarget.sourceVesselName">
                                {{ moveBargeTarget.sourceVesselName }}
                            </div>
                        </div>

                        <div class="col-span-1 flex justify-center items-center text-teal-600">
                            <span class="material-symbols-outlined text-xl">arrow_forward</span>
                        </div>

                        <div class="col-span-2 flex flex-col gap-1">
                            <span class="text-[11px] font-bold text-gray-400 uppercase">Tàu đích đến *</span>
                            <select 
                                v-model="moveBargeTarget.targetVesselId" 
                                class="p-2.5 bg-white border-2 border-teal-500 rounded-xl text-xs font-black text-teal-700 focus:outline-none cursor-pointer"
                            >
                                <option :value="null" disabled>-- Chọn tàu đích --</option>
                                <option 
                                    v-for="v in availableTargetVessels" 
                                    :key="v.id" 
                                    :value="v.id"
                                >
                                    {{ v.name }}
                                </option>
                            </select>
                        </div>
                    </div>

                    <div v-if="availableTargetVessels.length === 0" class="text-xs text-red-500 font-bold bg-red-50 p-2.5 rounded-xl border border-red-200 flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">warning</span>
                        Hiện không có tàu mẹ nào khác đang mở làm hàng để chuyển đến!
                    </div>

                    <div class="text-[11px] text-gray-500 font-semibold leading-relaxed bg-teal-50/50 p-3 rounded-xl border border-teal-100 flex items-start gap-2">
                        <span class="material-symbols-outlined text-teal-600 text-base shrink-0 mt-0.5">info</span>
                        <div>
                            Toàn bộ dữ liệu phiếu cân, số lượng xe, khối lượng hàng và cấu hình biên bản bên trong sà lan sẽ được <strong>bảo lưu 100%</strong> và tự động tính sang cho tàu đích.
                        </div>
                    </div>
                </div>

                <!-- Footer Buttons -->
                <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                    <button 
                        @click="showMoveBargeModal = false; moveBargeTarget = null" 
                        :disabled="isMovingBarge"
                        class="h-10 px-4 rounded-[12px] text-xs font-bold text-gray-600 hover:bg-gray-100 active:scale-95 transition-all border border-gray-200"
                    >
                        Hủy bỏ
                    </button>
                    <button 
                        @click="confirmMoveBarge" 
                        :disabled="isMovingBarge || !moveBargeTarget.targetVesselId || availableTargetVessels.length === 0"
                        class="h-10 px-5 rounded-[12px] text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-95 transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span v-if="isMovingBarge" class="material-symbols-outlined text-sm animate-spin">sync</span>
                        <span v-else class="material-symbols-outlined text-sm">check</span>
                        Xác nhận chuyển
                    </button>
                </div>
            </div>
        </div>
    </Transition>
    </Teleport>

    <!-- Premium Custom Input Prompt Modal -->
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
            class="fixed inset-0 z-[999] flex items-center justify-center bg-[#1e293b]/40 backdrop-blur-sm p-4 no-print"
            @click.self="handleInputCancel"
        >
            <div 
                class="w-full max-w-[420px] bg-white rounded-[24px] border border-gray-100 shadow-2xl p-6 flex flex-col gap-4 transform transition-all scale-100"
            >
                <!-- Header -->
                <div class="flex items-center gap-3">
                    <div class="size-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                        <span class="material-symbols-outlined text-xl">edit_note</span>
                    </div>
                    <h3 class="text-sm font-black text-gray-900 leading-tight">
                        {{ inputDialog.title }}
                    </h3>
                </div>
                
                <!-- Input field -->
                <div class="flex flex-col gap-1">
                    <input 
                        type="text" 
                        v-model="inputDialog.value"
                        :placeholder="inputDialog.placeholder"
                        @keyup.enter="handleInputOk"
                        class="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-primary rounded-[14px] text-xs font-bold focus:outline-none transition-all"
                        ref="inputPromptRef"
                    />
                </div>
                
                <!-- Footer Buttons -->
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

    <!-- Premium Custom Barge Modal (Name & Order Number) -->
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
            v-if="bargeDialog.show" 
            class="fixed inset-0 z-[999] flex items-center justify-center bg-[#1e293b]/40 backdrop-blur-sm p-4 no-print"
            @click.self="handleBargeCancel"
        >
            <div 
                class="w-full max-w-[420px] bg-white rounded-[24px] border border-gray-100 shadow-2xl p-6 flex flex-col gap-4 transform transition-all scale-100"
            >
                <!-- Header -->
                <div class="flex items-center gap-3">
                    <div class="size-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                        <span class="material-symbols-outlined text-xl">layers</span>
                    </div>
                    <h3 class="text-sm font-black text-gray-900 leading-tight">
                        {{ bargeDialog.title }}
                    </h3>
                </div>
                
                <!-- Fields -->
                <div class="flex flex-col gap-3">
                    <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Tên sà lan *</label>
                        <input 
                            type="text" 
                            v-model="bargeDialog.bargeName"
                            placeholder="Ví dụ: HP 1022, SG 9988..."
                            class="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-primary rounded-[14px] text-xs font-bold focus:outline-none transition-all uppercase"
                            ref="bargeNameInputRef"
                        />
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Mã lệnh (Số lệnh)</label>
                        <input 
                            type="text" 
                            v-model="bargeDialog.orderNo"
                            placeholder="Ví dụ: 11, L11..."
                            @keyup.enter="handleBargeOk"
                            class="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-primary rounded-[14px] text-xs font-bold focus:outline-none transition-all"
                        />
                    </div>
                </div>
                
                <!-- Footer Buttons -->
                <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-50">
                    <button 
                        @click="handleBargeCancel"
                        class="h-9 px-4 rounded-[12px] text-xs font-bold text-gray-500 hover:bg-gray-50 active:scale-95 transition-all border border-gray-100"
                    >
                        Hủy
                    </button>
                    <button 
                        @click="handleBargeOk"
                        class="h-9 px-5 rounded-[12px] text-xs font-bold text-white bg-primary hover:bg-primary/95 active:scale-95 transition-all"
                    >
                        Xác nhận
                    </button>
                </div>
            </div>
        </div>
    </Transition>
    </Teleport>
</div>

    <!-- MODAL 1: VESSEL MODAL (Tạo / Sửa Nguồn tàu kèm Khách hàng & Hàng hóa) -->
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
            v-if="showVesselModal" 
            class="fixed inset-0 z-[999] flex items-center justify-center bg-[#1e293b]/40 backdrop-blur-sm p-4 no-print font-display"
            @click.self="showVesselModal = false"
        >
            <div class="w-full max-w-[500px] bg-white rounded-[24px] border border-gray-100 shadow-2xl p-6 flex flex-col gap-4 transform transition-all scale-100">
                <!-- Header -->
                <div class="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div class="flex items-center gap-3">
                        <div class="size-11 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                            <span class="material-symbols-outlined text-2xl">directions_boat</span>
                        </div>
                        <div>
                            <h3 class="text-base font-black text-gray-900 leading-tight">
                                {{ vesselForm.isEdit ? 'Chỉnh sửa thông tin Nguồn tàu' : 'Thêm Nguồn tàu mới' }}
                            </h3>
                            <p class="text-xs text-gray-400 font-semibold mt-0.5">
                                {{ vesselForm.isEdit ? 'Cập nhật tên tàu và thông tin chuẩn cho các sà lan con' : 'Thiết lập Nguồn tàu và thông tin khách hàng, hàng hóa' }}
                            </p>
                        </div>
                    </div>
                    <button @click="showVesselModal = false" class="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50 transition-colors">
                        <span class="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                <!-- Form Fields -->
                <div class="flex flex-col gap-3.5">
                    <!-- Tên tàu -->
                    <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-gray-600 uppercase tracking-wider">Tên tàu *</label>
                        <input 
                            v-model="vesselForm.name"
                            type="text" 
                            placeholder="Ví dụ: TÀU PHÚ MỸ 01..."
                            class="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 focus:border-primary rounded-[14px] text-xs font-bold focus:outline-none focus:bg-white transition-all uppercase"
                        />
                    </div>

                    <!-- Khách hàng -->
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center justify-between">
                            <label class="text-xs font-bold text-gray-600 uppercase tracking-wider">Tên khách hàng / Chủ hàng</label>
                            <button 
                                type="button" 
                                @click="vesselForm.customCustomer = !vesselForm.customCustomer"
                                class="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5"
                            >
                                <span class="material-symbols-outlined text-xs">{{ vesselForm.customCustomer ? 'list' : 'add_circle' }}</span>
                                {{ vesselForm.customCustomer ? 'Chọn từ danh mục' : '+ Nhập mới' }}
                            </button>
                        </div>
                        <input 
                            v-if="vesselForm.customCustomer"
                            v-model="vesselForm.customer"
                            type="text" 
                            placeholder="Nhập tên khách hàng mới (tự động lưu vào danh mục)..."
                            class="w-full px-4 py-2.5 bg-white border border-primary/50 rounded-[14px] text-xs font-bold focus:outline-none transition-all uppercase"
                        />
                        <select 
                            v-else
                            v-model="vesselForm.customer"
                            class="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 focus:border-primary rounded-[14px] text-xs font-bold focus:outline-none focus:bg-white transition-all"
                        >
                            <option value="">-- Chọn khách hàng chuẩn --</option>
                            <option v-for="c in masterData.customers" :key="c" :value="c">{{ c }}</option>
                        </select>
                    </div>

                    <!-- Loại hàng hóa -->
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center justify-between">
                            <label class="text-xs font-bold text-gray-600 uppercase tracking-wider">Loại hàng hóa</label>
                            <button 
                                type="button" 
                                @click="vesselForm.customGoods = !vesselForm.customGoods"
                                class="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5"
                            >
                                <span class="material-symbols-outlined text-xs">{{ vesselForm.customGoods ? 'list' : 'add_circle' }}</span>
                                {{ vesselForm.customGoods ? 'Chọn từ danh mục' : '+ Nhập mới' }}
                            </button>
                        </div>
                        <input 
                            v-if="vesselForm.customGoods"
                            v-model="vesselForm.cargo_type"
                            type="text" 
                            placeholder="Nhập tên loại hàng mới (tự động lưu vào danh mục)..."
                            class="w-full px-4 py-2.5 bg-white border border-primary/50 rounded-[14px] text-xs font-bold focus:outline-none transition-all uppercase"
                        />
                        <select 
                            v-else
                            v-model="vesselForm.cargo_type"
                            @change="onVesselCargoTypeChange"
                            class="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 focus:border-primary rounded-[14px] text-xs font-bold focus:outline-none focus:bg-white transition-all"
                        >
                            <option value="">-- Chọn loại hàng chuẩn --</option>
                            <option v-for="g in masterData.goods" :key="g.name" :value="g.name">{{ g.name }} ({{ g.code }})</option>
                        </select>
                    </div>

                    <!-- Mã hàng hóa -->
                    <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-gray-600 uppercase tracking-wider">Mã hàng hóa</label>
                        <input 
                            v-model="vesselForm.cargo_code"
                            type="text" 
                            placeholder="Ví dụ: V-CLINKER, V-CEMENT..."
                            class="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 focus:border-primary rounded-[14px] text-xs font-bold focus:outline-none focus:bg-white transition-all uppercase"
                        />
                    </div>

                    <!-- Informative Banner -->
                    <div class="bg-blue-50/70 border border-blue-200/60 rounded-[14px] p-3 text-[11px] font-semibold text-blue-800 flex items-start gap-2">
                        <span class="material-symbols-outlined text-base text-blue-600 shrink-0 mt-0.5">info</span>
                        <div>
                            <strong>Quy định Cảng:</strong> Tất cả các sà lan con thuộc Nguồn tàu này bắt buộc kế thừa 100% Khách hàng, Loại hàng và Mã hàng đã chọn. Không được phép chỉnh sửa riêng lẻ ở cấp sà lan.
                        </div>
                    </div>
                </div>

                <!-- Footer Buttons -->
                <div class="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                    <button 
                        @click="showVesselModal = false"
                        class="h-10 px-4 rounded-[12px] text-xs font-bold text-gray-500 hover:bg-gray-50 active:scale-95 transition-all border border-gray-100"
                    >
                        Hủy
                    </button>
                    <button 
                        @click="submitVesselModal"
                        :disabled="loading"
                        class="h-10 px-5 rounded-[12px] text-xs font-bold text-white bg-primary hover:bg-primary/95 active:scale-95 transition-all flex items-center gap-1.5 shadow-soft disabled:opacity-50"
                    >
                        <span v-if="loading" class="material-symbols-outlined text-sm animate-spin">sync</span>
                        <span>{{ vesselForm.isEdit ? 'Lưu thay đổi' : 'Tạo Nguồn tàu' }}</span>
                    </button>
                </div>
            </div>
        </div>
    </Transition>
    </Teleport>

    <!-- MODAL 2: MASTER DATA MODAL (Quản lý Danh mục chuẩn toàn cảng) -->
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
            v-if="showMasterDataModal" 
            class="fixed inset-0 z-[999] flex items-center justify-center bg-[#1e293b]/40 backdrop-blur-sm p-4 no-print font-display"
            @click.self="showMasterDataModal = false"
        >
            <div class="w-full max-w-[620px] bg-white rounded-[24px] border border-gray-100 shadow-2xl p-6 flex flex-col gap-4 transform transition-all scale-100 max-h-[85vh]">
                <!-- Header -->
                <div class="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div class="flex items-center gap-3">
                        <div class="size-11 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                            <span class="material-symbols-outlined text-2xl">category</span>
                        </div>
                        <div>
                            <h3 class="text-base font-black text-gray-900 leading-tight">
                                Danh mục chuẩn toàn cảng
                            </h3>
                            <p class="text-xs text-gray-400 font-semibold mt-0.5">
                                Quản lý danh sách Khách hàng và Loại hàng hóa dùng chung cho toàn bộ Nguồn tàu &amp; Sà lan
                            </p>
                        </div>
                    </div>
                    <button @click="showMasterDataModal = false" class="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50 transition-colors">
                        <span class="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                <!-- Tabs switcher -->
                <div class="flex items-center gap-2 p-1 bg-gray-100/70 rounded-[14px]">
                    <button 
                        @click="masterDataTab = 'customers'"
                        class="flex-1 py-2 rounded-[10px] text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        :class="masterDataTab === 'customers' ? 'bg-white text-primary shadow-xs font-black' : 'text-gray-500 hover:text-gray-900'"
                    >
                        <span class="material-symbols-outlined text-sm">business</span>
                        Khách hàng ({{ masterData.customers.length }})
                    </button>
                    <button 
                        @click="masterDataTab = 'goods'"
                        class="flex-1 py-2 rounded-[10px] text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        :class="masterDataTab === 'goods' ? 'bg-white text-primary shadow-xs font-black' : 'text-gray-500 hover:text-gray-900'"
                    >
                        <span class="material-symbols-outlined text-sm">inventory_2</span>
                        Hàng hóa &amp; Mã hàng ({{ masterData.goods.length }})
                    </button>
                </div>

                <!-- Tab 1: Customers -->
                <div v-if="masterDataTab === 'customers'" class="flex-1 flex flex-col gap-3 min-h-0">
                    <!-- Add form -->
                    <div class="flex items-center gap-2">
                        <input 
                            v-model="newCustomerInput"
                            @keyup.enter="addMasterCustomer"
                            type="text"
                            placeholder="Nhập tên khách hàng mới..."
                            class="flex-1 px-4 py-2.5 bg-gray-50/50 border border-gray-200 focus:border-primary rounded-[12px] text-xs font-bold focus:outline-none focus:bg-white transition-all uppercase"
                        />
                        <button 
                            @click="addMasterCustomer"
                            class="px-4 py-2.5 bg-primary text-white font-bold text-xs rounded-[12px] shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1 shrink-0"
                        >
                            <span class="material-symbols-outlined text-sm">add</span>
                            Thêm
                        </button>
                    </div>

                    <!-- Customers List -->
                    <div class="flex-1 overflow-y-auto max-h-[360px] border border-gray-100 rounded-[16px] divide-y divide-gray-100 custom-scrollbar">
                        <div 
                            v-for="(c, idx) in masterData.customers" 
                            :key="c"
                            class="flex items-center justify-between p-3 hover:bg-gray-50/80 transition-colors"
                        >
                            <div class="flex items-center gap-2.5">
                                <span class="size-6 bg-primary/10 text-primary rounded-full text-[10px] font-black flex items-center justify-center">{{ idx + 1 }}</span>
                                <span class="text-xs font-bold text-gray-800">{{ c }}</span>
                            </div>
                            <button 
                                @click="removeMasterCustomer(idx)"
                                class="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors"
                                title="Xóa khỏi danh mục"
                            >
                                <span class="material-symbols-outlined text-sm">delete</span>
                            </button>
                        </div>
                        <div v-if="masterData.customers.length === 0" class="p-8 text-center text-xs text-gray-400 italic">
                            Chưa có khách hàng nào trong danh mục.
                        </div>
                    </div>
                </div>

                <!-- Tab 2: Goods & Codes -->
                <div v-else-if="masterDataTab === 'goods'" class="flex-1 flex flex-col gap-3 min-h-0">
                    <!-- Add form -->
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <input 
                            v-model="newGoodsName"
                            type="text"
                            placeholder="Tên loại hàng..."
                            class="md:col-span-6 px-4 py-2.5 bg-gray-50/50 border border-gray-200 focus:border-primary rounded-[12px] text-xs font-bold focus:outline-none focus:bg-white transition-all uppercase"
                        />
                        <input 
                            v-model="newGoodsCode"
                            type="text"
                            placeholder="Mã hàng..."
                            class="md:col-span-4 px-4 py-2.5 bg-gray-50/50 border border-gray-200 focus:border-primary rounded-[12px] text-xs font-bold focus:outline-none focus:bg-white transition-all uppercase"
                        />
                        <button 
                            @click="addMasterGoods"
                            class="md:col-span-2 px-3 py-2.5 bg-primary text-white font-bold text-xs rounded-[12px] shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1 shrink-0"
                        >
                            <span class="material-symbols-outlined text-sm">add</span>
                            Thêm
                        </button>
                    </div>

                    <!-- Goods Table -->
                    <div class="flex-1 overflow-y-auto max-h-[360px] border border-gray-100 rounded-[16px] custom-scrollbar">
                        <table class="w-full text-left text-xs">
                            <thead class="bg-gray-50 text-gray-500 font-bold sticky top-0 border-b border-gray-100">
                                <tr>
                                    <th class="p-3 w-12 text-center">STT</th>
                                    <th class="p-3">Tên loại hàng</th>
                                    <th class="p-3">Mã hàng</th>
                                    <th class="p-3 w-16 text-center">Xóa</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                <tr v-for="(g, idx) in masterData.goods" :key="g.name" class="hover:bg-gray-50/80 transition-colors">
                                    <td class="p-3 text-center text-gray-400 font-bold">{{ idx + 1 }}</td>
                                    <td class="p-3 font-bold text-gray-800">{{ g.name }}</td>
                                    <td class="p-3 font-mono font-bold text-primary">{{ g.code || '-' }}</td>
                                    <td class="p-3 text-center">
                                        <button 
                                            @click="removeMasterGoods(idx)"
                                            class="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors"
                                            title="Xóa"
                                        >
                                            <span class="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </td>
                                </tr>
                                <tr v-if="masterData.goods.length === 0">
                                    <td colspan="4" class="p-8 text-center text-gray-400 italic">Chưa có loại hàng nào trong danh mục.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Footer Buttons -->
                <div class="flex items-center justify-end pt-3 border-t border-gray-100">
                    <button 
                        @click="showMasterDataModal = false"
                        class="h-10 px-5 rounded-[12px] text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
                    >
                        Đóng danh mục
                    </button>
                </div>
            </div>
        </div>
    </Transition>
    </Teleport>

    <!-- MODAL 3: GLOBAL STANDARD WEIGH TICKET TEMPLATE DESIGNER -->
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
            v-if="showGlobalTemplateModal" 
            class="fixed inset-0 z-[999] flex items-center justify-center bg-[#0f172a]/70 backdrop-blur-md p-2 md:p-5 no-print font-display"
        >
            <div class="w-full max-w-7xl bg-[#f8fafc] rounded-[24px] border border-gray-200 shadow-2xl flex flex-col h-[94vh] overflow-hidden">
                <!-- Top Header -->
                <div class="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
                    <div class="flex items-center gap-3">
                        <div class="size-11 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                            <span class="material-symbols-outlined text-2xl">design_services</span>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="text-base font-black text-gray-900 leading-tight">
                                    Mẫu phiếu cân chuẩn toàn cảng Nguyên Ngọc
                                </h3>
                                <span class="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">Hệ thống / Admin</span>
                            </div>
                            <p class="text-xs text-gray-500 font-semibold mt-0.5">
                                Bố cục chuẩn khổ A5 (210mm x 148mm) - Cấu hình 1 lần áp dụng ngay cho 100% sà lan
                            </p>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <button 
                            @click="resetGlobalTemplateToDefault"
                            class="px-3.5 py-2 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold rounded-[12px] border border-red-200 transition-all flex items-center gap-1"
                            title="Khôi phục mẫu in mặc định gốc"
                        >
                            <span class="material-symbols-outlined text-sm">restart_alt</span>
                            Khôi phục mặc định
                        </button>
                        <button 
                            @click="showGlobalTemplateModal = false"
                            class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-[12px] transition-all"
                        >
                            Hủy bỏ
                        </button>
                        <button 
                            @click="saveGlobalTemplateFromModal"
                            :disabled="saving"
                            class="px-5 py-2 bg-primary text-white hover:bg-primary-dark font-bold text-xs rounded-[12px] shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <span v-if="saving" class="material-symbols-outlined text-sm animate-spin">sync</span>
                            <span v-else class="material-symbols-outlined text-sm">save</span>
                            <span>Lưu mẫu chuẩn toàn cảng</span>
                        </button>
                    </div>
                </div>

                <!-- Main Designer Body: 2 Columns -->
                <div class="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-y-auto custom-scrollbar min-h-0">
                    <!-- Left Sidebar (Tools & Configuration) -->
                    <div class="w-full lg:w-[400px] shrink-0 flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
                        <!-- 1. Company Info & Title -->
                        <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-3">
                            <h4 class="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-2">
                                <span class="material-symbols-outlined text-base">apartment</span>
                                Thông tin công ty &amp; Tiêu đề
                            </h4>
                            <div class="flex flex-col gap-2.5 text-xs font-bold text-gray-600">
                                <div class="flex flex-col gap-1">
                                    <label class="text-[11px] text-gray-500">Tên đơn vị cảng</label>
                                    <input v-model="cfgForm.companyName" type="text" class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-primary">
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="text-[11px] text-gray-500">Địa chỉ</label>
                                    <input v-model="cfgForm.companyAddress" type="text" class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-primary">
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div class="flex flex-col gap-1">
                                        <label class="text-[11px] text-gray-500">Điện thoại / Fax</label>
                                        <input v-model="cfgForm.companyPhone" type="text" class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-primary">
                                    </div>
                                    <div class="flex flex-col gap-1">
                                        <label class="text-[11px] text-gray-500">Tiêu đề phiếu</label>
                                        <input v-model="cfgForm.ticketTitle" type="text" class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-primary uppercase">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 2. Designer Toolbar -->
                        <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-3">
                            <h4 class="text-xs font-black text-[#1e293b] uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-base">construction</span>
                                Thêm phần tử vào mẫu
                            </h4>
                            <div class="grid grid-cols-2 gap-2">
                                <button 
                                    @click="addStaticText" 
                                    class="px-2.5 py-2 bg-gray-50 border border-gray-200 hover:border-primary hover:text-primary rounded-xl text-xs font-bold text-gray-700 transition-all flex items-center gap-1.5"
                                >
                                    <span class="material-symbols-outlined text-sm">title</span> Chữ tĩnh
                                </button>
                                <button 
                                    @click="addLineElement('horizontal')" 
                                    class="px-2.5 py-2 bg-gray-50 border border-gray-200 hover:border-primary hover:text-primary rounded-xl text-xs font-bold text-gray-700 transition-all flex items-center gap-1.5"
                                >
                                    <span class="material-symbols-outlined text-sm">horizontal_rule</span> Kẻ ngang
                                </button>
                                <button 
                                    @click="addLineElement('vertical')" 
                                    class="px-2.5 py-2 bg-gray-50 border border-gray-200 hover:border-primary hover:text-primary rounded-xl text-xs font-bold text-gray-700 transition-all flex items-center gap-1.5"
                                >
                                    <span class="material-symbols-outlined text-sm">vertical_align_center</span> Kẻ dọc
                                </button>
                                <button 
                                    @click="addRectElement" 
                                    class="px-2.5 py-2 bg-gray-50 border border-gray-200 hover:border-primary hover:text-primary rounded-xl text-xs font-bold text-gray-700 transition-all flex items-center gap-1.5"
                                >
                                    <span class="material-symbols-outlined text-sm">check_box_outline_blank</span> Khung viền
                                </button>
                            </div>

                            <div class="flex flex-col gap-1 mt-1">
                                <label class="text-[11px] font-bold text-gray-500">Thêm trường dữ liệu xe cân:</label>
                                <select 
                                    @change="(e) => {
                                        const target = e.target as HTMLSelectElement;
                                        if (target.value) {
                                            const opt = availableFields.find(o => o.id === target.value);
                                            if (opt) addFieldElement(opt.id, opt.label);
                                            target.value = '';
                                        }
                                    }"
                                    class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary cursor-pointer w-full"
                                >
                                    <option value="">-- Chọn trường để thêm vào mẫu --</option>
                                    <option v-for="item in availableFields" :key="item.id" :value="item.id">
                                        {{ item.label }}
                                    </option>
                                </select>
                            </div>
                        </div>

                        <!-- 3. Selected Element Properties Panel -->
                        <div v-if="selectedElement" class="bg-white p-4 rounded-2xl border border-primary/20 shadow-xs flex flex-col gap-3">
                            <div class="flex items-center justify-between border-b border-gray-100 pb-2">
                                <h4 class="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-1">
                                    <span class="material-symbols-outlined text-sm">edit_attributes</span>
                                    Thuộc tính phần tử
                                </h4>
                                <div class="flex items-center gap-1">
                                    <button 
                                        @click="duplicateElement(selectedElement!)" 
                                        title="Nhân bản"
                                        class="p-1 text-gray-500 hover:text-primary hover:bg-gray-50 rounded transition-colors"
                                    >
                                        <span class="material-symbols-outlined text-sm">content_copy</span>
                                    </button>
                                    <button 
                                        @click="deleteElement(selectedElement!.id)" 
                                        title="Xóa phần tử"
                                        class="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                    >
                                        <span class="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-2 text-xs font-bold text-gray-600">
                                <div class="flex flex-col gap-1">
                                    <label class="text-[10px] text-gray-400">Vị trí X (mm)</label>
                                    <input v-model.number="selectedElement.x" type="number" min="0" max="210" step="0.5" class="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:border-primary">
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="text-[10px] text-gray-400">Vị trí Y (mm)</label>
                                    <input v-model.number="selectedElement.y" type="number" min="0" max="148" step="0.5" class="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:border-primary">
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="text-[10px] text-gray-400">Rộng (mm)</label>
                                    <input v-model.number="selectedElement.width" type="number" min="1" max="210" step="0.5" class="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:border-primary">
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="text-[10px] text-gray-400">Cao (mm)</label>
                                    <input v-model.number="selectedElement.height" type="number" min="1" max="148" step="0.5" class="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:border-primary">
                                </div>

                                <!-- Field Label -->
                                <div v-if="selectedElement.type === 'field'" class="col-span-2 flex flex-col gap-1">
                                    <label class="text-[10px] text-gray-400">Tiêu đề (Label)</label>
                                    <input v-model="selectedElement.label" type="text" class="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-bold focus:outline-none focus:border-primary">
                                </div>
                                <div v-if="selectedElement.type === 'field'" class="col-span-2 flex flex-col gap-1">
                                    <label class="text-[10px] text-gray-400">Độ rộng tiêu đề (mm)</label>
                                    <input v-model.number="selectedElement.labelWidth" type="number" min="0" max="100" class="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:border-primary">
                                </div>

                                <!-- Text content -->
                                <div v-if="selectedElement.type === 'text'" class="col-span-2 flex flex-col gap-1">
                                    <label class="text-[10px] text-gray-400">Nội dung chữ</label>
                                    <textarea v-model="selectedElement.text" rows="2" class="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-bold focus:outline-none focus:border-primary resize-none"></textarea>
                                </div>

                                <!-- Rect Border style -->
                                <div v-if="selectedElement.type === 'rect'" class="col-span-2 flex flex-col gap-1">
                                    <label class="text-[10px] text-gray-400">Kiểu viền</label>
                                    <select v-model="selectedElement.borderStyle" class="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-bold focus:outline-none focus:border-primary">
                                        <option value="solid">Nét liền (Solid)</option>
                                        <option value="dashed">Nét đứt (Dashed)</option>
                                        <option value="dotted">Chấm chấm (Dotted)</option>
                                    </select>
                                </div>

                                <!-- Font size & styles -->
                                <div v-if="['text', 'field'].includes(selectedElement.type)" class="flex flex-col gap-1">
                                    <label class="text-[10px] text-gray-400">Cỡ chữ (pt)</label>
                                    <input v-model.number="selectedElement.fontSize" type="number" min="6" max="24" step="0.5" class="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:border-primary">
                                </div>
                                <div v-if="['text', 'field'].includes(selectedElement.type)" class="flex flex-col gap-1">
                                    <label class="text-[10px] text-gray-400">Căn lề</label>
                                    <select v-model="selectedElement.align" class="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-bold focus:outline-none focus:border-primary">
                                        <option value="left">Trái</option>
                                        <option value="center">Giữa</option>
                                        <option value="right">Phải</option>
                                    </select>
                                </div>

                                <div v-if="['text', 'field'].includes(selectedElement.type)" class="col-span-2 flex items-center gap-4 pt-1">
                                    <label class="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" :checked="selectedElement.fontWeight === 'bold'" @change="(e) => selectedElement!.fontWeight = (e.target as HTMLInputElement).checked ? 'bold' : 'normal'" class="rounded text-primary focus:ring-0">
                                        <span>In đậm</span>
                                    </label>
                                    <label class="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" :checked="selectedElement.fontStyle === 'italic'" @change="(e) => selectedElement!.fontStyle = (e.target as HTMLInputElement).checked ? 'italic' : 'normal'" class="rounded text-primary focus:ring-0">
                                        <span>In nghiêng</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- 4. Signatures -->
                        <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-3">
                            <h4 class="text-xs font-black text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-base">draw</span>
                                Vị trí các chữ ký (5 chữ ký)
                            </h4>
                            <div class="space-y-1.5">
                                <div v-for="(_, sIdx) in (cfgForm.signatures || ['NV TRẠM CÂN', 'BẢO VỆ', 'CHỦ HÀNG', 'THỦ KHO', 'TÀI XẾ'])" :key="sIdx" class="flex items-center gap-2">
                                    <span class="text-[10px] font-black text-gray-400 w-4">{{ sIdx + 1 }}.</span>
                                    <input 
                                        v-model="cfgForm.signatures![sIdx]"
                                        class="flex-1 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-primary"
                                        placeholder="Ký tên..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right Blueprint Canvas -->
                    <div class="flex-1 flex flex-col gap-2 min-w-0 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
                        <div class="flex items-center justify-between pb-2 border-b border-gray-100">
                            <span class="text-xs font-black text-gray-800 flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-base text-primary">square_foot</span>
                                Bản vẽ in chuẩn A5 (210mm x 148mm)
                            </span>
                            <span class="text-[11px] font-bold text-gray-400">Kéo thả phần tử | Phím mũi tên để căn chỉnh mịn</span>
                        </div>

                        <!-- Canvas Container -->
                        <div ref="canvasContainerRef" class="flex-1 overflow-hidden bg-gray-100/70 border border-gray-200 rounded-xl p-4 flex justify-center items-center relative group min-h-[500px]">
                            <div 
                                class="relative bg-white border border-dashed border-gray-400 shadow-xl select-none overflow-hidden shrink-0"
                                :style="{
                                    width: canvasWidthPx + 'px',
                                    height: canvasHeightPx + 'px',
                                    boxSizing: 'content-box',
                                    backgroundImage: 'linear-gradient(to right, rgba(226, 239, 252, 0.8) 1px, transparent 1px), linear-gradient(to bottom, rgba(226, 239, 252, 0.8) 1px, transparent 1px)',
                                    backgroundSize: (5 * currentMmToPx) + 'px ' + (5 * currentMmToPx) + 'px'
                                }"
                                @mousedown="selectedElementId = null; selectedElementIds = []"
                            >
                                <!-- Alignment Snap Guides -->
                                <div 
                                    v-for="(guide, gIdx) in alignmentGuides" 
                                    :key="'guide_' + gIdx"
                                    class="absolute pointer-events-none z-50"
                                    :class="guide.type === 'h' ? 'left-0 right-0 border-t border-dashed border-red-500' : 'top-0 bottom-0 border-l border-dashed border-red-500'"
                                    :style="guide.type === 'h' ? { top: guide.pos + 'px', height: '0px' } : { left: guide.pos + 'px', width: '0px' }"
                                ></div>

                                <!-- Dynamic Print Elements -->
                                <div 
                                    v-for="el in (cfgForm.printElements || [])" 
                                    :key="el.id"
                                    class="absolute cursor-move select-none flex flex-col"
                                    :class="[
                                        selectedElementIds.includes(el.id) 
                                            ? (selectedElementId === el.id ? 'ring-2 ring-inset ring-primary z-30 bg-primary/[0.04]' : 'ring-2 ring-inset ring-teal-500 z-25 bg-teal-500/[0.04]') 
                                            : 'hover:ring-1 hover:ring-inset hover:ring-primary/50 z-20'
                                    ]"
                                    :style="{
                                        left: (el.x * currentMmToPx) + 'px',
                                        top: (el.y * currentMmToPx) + 'px',
                                        width: (el.width * currentMmToPx) + 'px',
                                        height: (el.height * currentMmToPx) + 'px',
                                        fontSize: (el.fontSize || 8.5) * 1.35 * (currentMmToPx / 4) + 'px',
                                        fontWeight: el.fontWeight || 'bold',
                                        fontStyle: el.fontStyle || 'normal',
                                        textAlign: el.align || 'left',
                                        color: 'black',
                                        fontFamily: 'Arial, Helvetica, sans-serif',
                                        lineHeight: '1.2'
                                    }"
                                    @mousedown.stop="startDrag($event, el)"
                                >
                                    <!-- Field Type element -->
                                    <div v-if="el.type === 'field'" class="w-full h-full flex items-baseline overflow-hidden select-none pointer-events-none">
                                        <span 
                                            v-if="el.label"
                                            class="text-gray-500 shrink-0 font-sans" 
                                            style="font-weight: inherit;"
                                            :style="{ width: ((el.labelWidth || 20) * currentMmToPx) + 'px' }"
                                        >
                                            {{ el.label }}
                                        </span>
                                        <span v-if="el.label" class="mr-1 shrink-0 font-sans">:</span>
                                        <span 
                                            class="grow font-sans"
                                            :class="(el.fieldId === 'ketluan' || el.fieldId === 'note') ? 'whitespace-pre-wrap break-words' : 'truncate'"
                                            style="font-weight: inherit;"
                                        >
                                            [{{ el.fieldId }}]
                                        </span>
                                    </div>
                                    
                                    <!-- Static text element -->
                                    <div v-else-if="el.type === 'text'" class="w-full h-full overflow-hidden whitespace-pre-wrap select-none pointer-events-none font-sans">
                                        {{ el.text }}
                                    </div>
                                    
                                    <!-- Line element -->
                                    <div 
                                        v-else-if="el.type === 'line'" 
                                        class="w-full h-full bg-black select-none pointer-events-none"
                                    ></div>
                                    
                                    <!-- Rect element -->
                                    <div 
                                        v-else-if="el.type === 'rect'" 
                                        class="w-full h-full border border-black select-none pointer-events-none"
                                        :style="{ borderStyle: el.borderStyle || 'solid', borderWidth: '1px' }"
                                    ></div>

                                    <!-- Selected Indicator Badge -->
                                    <div v-if="selectedElementIds.includes(el.id)" class="absolute -top-4 left-0 text-white text-[10px] px-1 py-0.5 rounded font-mono uppercase font-bold tracking-wider pointer-events-none shadow-sm z-40" :class="selectedElementId === el.id ? 'bg-primary' : 'bg-teal-500'">
                                        {{ el.type === 'field' ? el.fieldId : el.type }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Transition>
    </Teleport>
</template>

<style scoped>
/* Animations */
.animate-fade-in {
    animation: fadeIn 0.25s ease-out forwards;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: scale(0.98);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}
</style>

<style>
/* Print CSS Styles - Global (non-scoped) for teleported elements */
@media print {
    @page {
        size: A5 landscape;
        margin: 0;
    }

    html, body {
        margin: 0 !important;
        padding: 0 !important;
        background-color: white !important;
        background-image: none !important;
        color: black !important;
        height: auto !important;
        overflow: visible !important;
    }
    /* Hide the entire app container during printing */
    #app {
        display: none !important;
    }
    
    /* Show print section only (teleported to body) */
    #print-section {
        display: block !important;
        background-color: white !important;
        color: black !important;
        width: 100% !important;
    }

    .print-page {
        page-break-after: always;
        width: 210mm;
        height: 148mm;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        border: none;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 11pt !important;
        color: black !important;
        background-color: white !important;
    }

    .print-page:last-child {
        page-break-after: avoid;
    }

    /* Print Ticket styles mapping the original exactly */
    .ticket-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        width: 100%;
        margin-bottom: 2mm;
    }

    .ticket-logo-info {
        width: 70%;
        line-height: 1.2;
    }

    .ticket-company {
        font-weight: bold;
        font-size: 12pt;
        text-transform: uppercase;
    }

    .ticket-address, .ticket-phone {
        font-size: 9.5pt;
    }

    .ticket-number-box {
        width: 25%;
        text-align: right;
        font-size: 11pt;
    }
    
    .ticket-number-label {
        font-weight: normal;
    }
    
    .ticket-number-val {
        font-weight: bold;
        font-size: 11pt;
    }

    .ticket-title-container {
        text-align: center;
        margin-bottom: 3mm;
        width: 100%;
    }

    .ticket-title {
        font-size: 16pt;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .ticket-dates {
        display: flex;
        flex-direction: column;
        align-items: center;
        font-size: 10pt;
        font-style: italic;
        margin-top: 1mm;
        line-height: 1.3;
    }

    .ticket-body {
        display: flex;
        justify-content: space-between;
        width: 100%;
        margin-bottom: 4mm;
    }

    .ticket-col-left {
        width: 48%;
        display: flex;
        flex-direction: column;
        gap: 1.5mm;
    }

    .ticket-col-right {
        width: 48%;
        display: flex;
        flex-direction: column;
        gap: 1.5mm;
    }

    .ticket-row {
        display: flex;
        align-items: baseline;
        line-height: 1.2;
        font-size: 10.5pt;
        color: black !important;
    }

    .ticket-row-label {
        width: 130px;
        flex-shrink: 0;
    }

    .ticket-row-separator {
        width: 15px;
        flex-shrink: 0;
        text-align: center;
    }

    .ticket-row-val {
        flex-grow: 1;
        font-weight: bold;
        min-height: 18px;
    }
    
    .ticket-row-val.normal-weight {
        font-weight: normal;
    }

    .ticket-row-val.highlight {
        font-size: 11pt;
        font-weight: bold;
    }
    
    .text-italic {
        font-style: italic;
    }

    .ticket-quality-header {
        font-weight: bold;
        text-transform: uppercase;
        font-size: 10.5pt;
        margin-top: 2.5mm;
        margin-bottom: 1.5mm;
    }

    .ticket-row-val-underline-container {
        flex-grow: 1;
        display: flex;
        align-items: baseline;
    }

    .ticket-row-val-underline {
        border-bottom: 1px solid black;
        width: 120px;
        text-align: center;
        font-weight: bold;
        display: inline-block;
        min-height: 18px;
    }

    .ticket-row-unit {
        margin-left: 5px;
        font-weight: normal;
    }

    .ticket-footer-signatures {
        display: flex;
        justify-content: space-between;
        width: 100%;
        margin-top: 12mm; /* Give plenty of space for signatures */
        font-size: 9.5pt;
    }

    .sig-col {
        width: 18%;
        text-align: center;
        font-weight: bold;
        text-transform: uppercase;
        font-size: 9.5pt;
    }
}
</style>

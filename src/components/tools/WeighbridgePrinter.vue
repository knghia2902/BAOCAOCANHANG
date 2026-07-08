<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { authStore } from '@/stores/auth';
import { supabase } from '@/supabase';
import { excelService } from '@/services/excel/ExcelService';
import { dbContext } from '@/services/storage/DBContext';
import { WeighbridgeService, type Vessel, type Barge, type Truck, type BargeConfig, type CustomFieldConfig, type PrintElement } from '@/services/excel/WeighbridgeService';
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

defineExpose({
    isOpen
});

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
const globalFilterMonth = ref<string>('');
const globalBargesSummary = ref<BargeSummary[]>([]);
const loadingGlobalSummary = ref(false);
const sortKey = ref<string>('');
const sortOrder = ref<'asc' | 'desc'>('asc');

// UI elements and modals
const expandedVesselIds = ref<Record<number, boolean>>({});
const showMappingModal = ref(false);
const showTruckDialog = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

// Toast state
const toastMessage = ref<string | null>(null);
const toastType = ref<'success' | 'error'>('success');
let toastTimer: any = null;

const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
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

const allBarges = computed(() => {
    const list: Array<{ id: number; name: string; vesselId: number; vesselName: string; created_at?: string; locked: boolean; orderNo: string }> = [];
    vessels.value.forEach(v => {
        if (v.barges) {
            v.barges.forEach(b => {
                list.push({
                    id: b.id,
                    name: b.name,
                    vesselId: v.id,
                    vesselName: v.name,
                    created_at: b.created_at,
                    locked: b.config?.locked || false,
                    orderNo: b.config?.orderNo ? String(b.config.orderNo).trim() : ''
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

const availableGlobalMonths = computed(() => {
    if (!globalBargesSummary.value) return [];
    
    const months = new Set<string>();
    globalBargesSummary.value.forEach(b => {
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

    if (globalFilterMonth.value) {
        list = list.filter(b => {
            const dates = [b.dateStart, b.dateEnd].filter(Boolean);
            return dates.some(dStr => {
                const d = new Date(dStr!);
                if (isNaN(d.getTime())) return false;
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
    vesselBargesSummary.value.forEach(b => {
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
        const data = await WeighbridgeService.getVessels();
        vessels.value = data;
        
        // Expand all vessels by default
        data.forEach(v => {
            if (expandedVesselIds.value[v.id] === undefined) {
                expandedVesselIds.value[v.id] = true;
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
    
    // Reset filters and sorting when switching barges
    searchQuery.value = '';
    sortKey.value = '';
    sortOrder.value = 'asc';
    
    // Reset designer selection
    selectedElementId.value = null;
    selectedElementIds.value = [];
    
    // Load config of active barge
    if (activeBarge.value) {
        const cfg = activeBarge.value.config || {};

        // Load default layout or company details if not set in config
        let savedDefaultElements: PrintElement[] | null = null;
        let savedCompanyDetails: any = null;
        try {
            const savedStr = localStorage.getItem('weighbridge_default_layout');
            if (savedStr) {
                savedDefaultElements = JSON.parse(savedStr);
            }
            const savedDetailsStr = localStorage.getItem('weighbridge_default_company_details');
            if (savedDetailsStr) {
                savedCompanyDetails = JSON.parse(savedDetailsStr);
            }
        } catch (e) {
            console.error('Error reading default print layout from localStorage:', e);
        }

        cfgForm.goods = cfg.goods || '';
        cfgForm.goodsCode = cfg.goodsCode || '';
        cfgForm.owner = cfg.owner || '';
        cfgForm.operator = cfg.operator || '';
        cfgForm.xn = cfg.xn || 'XUẤT KHẨU';
        cfgForm.ticketPrefix = cfg.ticketPrefix || 'PC-';
        cfgForm.ticketSeed = cfg.ticketSeed !== undefined ? cfg.ticketSeed : 1;
        cfgForm.chinhpham = cfg.chinhpham !== undefined ? cfg.chinhpham : 100;
        cfgForm.phupham = cfg.phupham !== undefined ? cfg.phupham : 0;
        cfgForm.ketluan = cfg.ketluan || 'Chính phẩm đạt tiêu chuẩn';
        cfgForm.locked = cfg.locked || false;
        cfgForm.orderNo = cfg.orderNo || '';
        cfgForm.printFields = cfg.printFields || getDefaultPrintFields();
        let elements = cfg.printElements || savedDefaultElements || getDefaultPrintElements();
        if (elements.length > 0 && !elements.some((el: any) => el.id === 'sig1_name')) {
            elements = [...elements, { id: 'sig1_name', type: 'field', x: 18.5, y: 133, width: 30, height: 4, label: '', fieldId: 'operator', align: 'center', fontSize: 10, fontWeight: 'bold' }];
        }
        cfgForm.printElements = elements.filter(el => !['lineHeader', 'lineTitle', 'lineFooter'].includes(el.id));
        cfgForm.companyName = cfg.companyName || savedCompanyDetails?.companyName || 'CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG NGUYÊN NGỌC';
        cfgForm.companyAddress = cfg.companyAddress || savedCompanyDetails?.companyAddress || 'Địa chỉ: Số 167, tổ 78, Đường Đê Bao, Khu phố 9, Phường Phú An, TP. Hồ Chí Minh, Việt Nam';
        cfgForm.companyPhone = cfg.companyPhone || savedCompanyDetails?.companyPhone || 'ĐT: 0964 258 671 / Fax:';
        cfgForm.ticketTitle = cfg.ticketTitle || savedCompanyDetails?.ticketTitle || 'PHIẾU CÂN XE';
        cfgForm.signatures = cfg.signatures || savedCompanyDetails?.signatures || ['NV TRẠM CÂN', 'BẢO VỆ', 'CHỦ HÀNG', 'THỦ KHO', 'TÀI XẾ'];

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

const selectVessel = async (vesselId: number) => {
    const isSameVessel = activeVesselId.value === vesselId;
    const isBargeNull = activeBargeId.value === null;

    activeVesselId.value = vesselId;
    activeBargeId.value = null; // Deselect barge to show vessel report summary
    vesselFilterMonth.value = '';
    bargeSearchQuery.value = '';

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
                sheet.eachRow((row) => {
                    const val = row.getCell(idx + 1).value;
                    if (val) maxLen = Math.max(maxLen, String(val).length);
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
    const bargeId = activeBargeId.value;
    if (!bargeId) return;
    if (cfgForm.locked || authStore.role !== 'admin') return; // Prevent auto-saving when locked or not admin
    
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
    if (authStore.role !== 'admin') {
        showToast('Chỉ Quản trị viên mới được phép lưu cấu hình!', 'error');
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
    const bargeId = activeBargeId.value;
    if (!bargeId) return;
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
            showToast(cfgForm.locked ? 'Đã khóa sà lan thành công! 🔒' : 'Đã mở khóa sà lan thành công! 🔓');
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
    if (authStore.role !== 'admin') {
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
    if (authStore.role !== 'admin') {
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
    saveBargeConfig();
};

const startDrag = (event: MouseEvent, el: PrintElement) => {
    if (cfgForm.locked || authStore.role !== 'admin') return;
    
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
    if (!isOpen.value || activeTab.value !== 'config' || cfgForm.locked || authStore.role !== 'admin' || selectedElementIds.value.length === 0) return;
    
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
    if (cfgForm.locked || authStore.role !== 'admin') return;
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
    if (cfgForm.locked || authStore.role !== 'admin') return;
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
    if (cfgForm.locked || authStore.role !== 'admin') return;
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
    if (cfgForm.locked || authStore.role !== 'admin') return;
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
    if (cfgForm.locked || authStore.role !== 'admin') return;
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
    if (cfgForm.locked || authStore.role !== 'admin') return;
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
    if (cfgForm.locked || authStore.role !== 'admin') return;
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
        case 'goods': return cfgForm.goods || '';
        case 'owner': return cfgForm.owner || '';
        case 'weight1': return `${formatNumber(t.weight1)} kg`;
        case 'weight2': return `${formatNumber(t.weight2)} kg`;
        case 'weightNet': return `${formatNumber(t.weightNet)} kg`;
        case 'words': return DocSoThanhChu(t.weightNet);
        case 'barge': return activeBarge.value?.name || 'Sà lan SG-9921';
        case 'note': return t.note || '-';
        case 'driver': return t.driver || '-';
        case 'goodsCode': return cfgForm.goodsCode || '';
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

// Vessel CRUD
const addVessel = async () => {
    const name = await showPrompt('Nhập tên tàu mới:');
    if (!name || !name.trim()) return;

    loading.value = true;
    try {
        const data = await WeighbridgeService.createVessel(name);
        if (data) {
            await loadVessels();
            expandedVesselIds.value[data.id] = true;
            showToast(`Đã thêm tàu: ${data.name}`);
        } else {
            showToast('Không thể thêm tàu mới!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi thêm tàu!', 'error');
    } finally {
        loading.value = false;
    }
};

const renameVessel = async (id: number, currentName: string) => {
    const name = await showPrompt('Đổi tên tàu:', currentName);
    if (!name || !name.trim() || name.trim() === currentName) return;

    loading.value = true;
    try {
        const success = await WeighbridgeService.updateVessel(id, name);
        if (success) {
            await loadVessels();
            showToast(`Đã đổi tên tàu thành: ${name}`);
        } else {
            showToast('Không thể đổi tên tàu!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi đổi tên tàu!', 'error');
    } finally {
        loading.value = false;
    }
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
        } else {
            showToast('Không thể xóa tàu!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi xóa tàu!', 'error');
    } finally {
        loading.value = false;
    }
};

// Barge CRUD
const addBarge = async (vesselId: number) => {
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

    loading.value = true;
    try {
        const data = await WeighbridgeService.createBarge(vesselId, result.name, result.orderNo);
        if (data) {
            await loadVessels();
            await selectBarge(vesselId, data.id);
            showToast(`Đã thêm sà lan: ${data.name}`);
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
        }
    } catch (e) {
        showToast('Lỗi khi chỉnh sửa sà lan!', 'error');
    } finally {
        loading.value = false;
    }
};

const deleteBarge = async (_vesselId: number, id: number, name: string) => {
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
        } else {
            showToast('Không thể xóa sà lan!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi xóa sà lan!', 'error');
    } finally {
        loading.value = false;
    }
};

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

// Auto-sync allocator trips for all barges of loaded vessels
async function autoSyncAllBarges(isManual = false) {
    try {
        const allocatorTrips = await dbContext.get<any[]>('allocator_generated_trips') || [];
        if (!Array.isArray(allocatorTrips) || allocatorTrips.length === 0) {
            if (isManual) {
                const emptyMsg = 'Không tìm thấy chuyến xe nào trong Báo cáo phân bổ để đồng bộ!';
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
                        if (t.date1Obj) {
                            const date1 = new Date(t.date1Obj);
                            if (!isNaN(date1.getTime())) {
                                const offset = date1.getTimezoneOffset();
                                const localDate = new Date(date1.getTime() - (offset * 60 * 1000));
                                dIn = localDate.toISOString().slice(0, 16);
                            }
                        }
                        if (t.date2Obj) {
                            const date2 = new Date(t.date2Obj);
                            if (!isNaN(date2.getTime())) {
                                const offset = date2.getTimezoneOffset();
                                const localDate = new Date(date2.getTime() - (offset * 60 * 1000));
                                dOut = localDate.toISOString().slice(0, 16);
                            }
                        }
                    } catch (e) {
                        console.warn('Error parsing date:', e);
                    }

                    if (!dIn) dIn = new Date().toISOString().slice(0, 16);
                    if (!dOut) {
                        const outDate = new Date();
                        outDate.setMinutes(outDate.getMinutes() + 30);
                        dOut = outDate.toISOString().slice(0, 16);
                    }

                    return {
                        id: Date.now() + idx,
                        barge_id: barge.id,
                        ticketNo: t.ticketNo || '',
                        plateNumber: t.plateNumber || '',
                        driver: '',
                        weight1: Number(t.weight1) || 0,
                        weight2: Number(t.weight2) || 0,
                        weightNet: Number(t.weightNet) || 0,
                        dateIn: dIn,
                        dateOut: dOut,
                        note: t.notes || ''
                    };
                });

                const currentTrucks = await WeighbridgeService.getTrucks(barge.id);
                let currentSeed = barge.config?.ticketSeed || '1';
                for (const tr of importedTrucks) {
                    if (!tr.ticketNo) {
                        tr.ticketNo = getNextTicketNumber(tr.dateOut || tr.dateIn, [...currentTrucks, ...importedTrucks], currentSeed, tr.id);
                        const serialPart = tr.ticketNo.split('/')[0];
                        currentSeed = (parseInt(serialPart || '0', 10) || 1) + 1;
                    }
                }

                // Compare importedTrucks and currentTrucks to prevent redundant saves/toasts
                let isIdentical = importedTrucks.length === currentTrucks.length;
                if (isIdentical) {
                    for (let i = 0; i < importedTrucks.length; i++) {
                        const it = importedTrucks[i]!;
                        const ct = currentTrucks[i]!;
                        if (
                            it.ticketNo !== ct.ticketNo ||
                            it.plateNumber !== ct.plateNumber ||
                            it.weight1 !== ct.weight1 ||
                            it.weight2 !== ct.weight2 ||
                            it.weightNet !== ct.weightNet ||
                            it.note !== ct.note
                        ) {
                            isIdentical = false;
                            break;
                        }
                    }
                }

                if (isIdentical) continue;

                // Auto-sync overwrites the trucks list with matchedTrips
                const success = await WeighbridgeService.saveTrucks(barge.id, importedTrucks);
                if (success) {
                    hasUpdates = true;
                    barge.config.ticketSeed = String(currentSeed).padStart(6, '0');
                    await WeighbridgeService.updateBargeConfig(barge.id, barge.config);
                    
                    // If this is the currently active barge, reload trucks ref
                    if (activeBargeId.value === barge.id) {
                        trucks.value = importedTrucks;
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
    if (authStore.role !== 'admin') {
        showToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const bargeId = activeBargeId.value;
    if (!bargeId || !activeBarge.value) {
        showToast('Vui lòng chọn một sà lan trước!', 'error');
        return;
    }
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể nhập dữ liệu.', 'error');
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

        if (fetchError) throw fetchError;

        const allocatorTrips = data?.settings?.allocator_generated_trips || [];
        if (!Array.isArray(allocatorTrips) || allocatorTrips.length === 0) {
            showToast('Không tìm thấy chuyến xe nào trong Báo cáo phân bổ. Hãy thực hiện phân bổ tải trọng trước!', 'error');
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
            showToast(`Đồng bộ thất bại! Sà lan đang khóa: ${lockedBarges.join(', ')}. Vui lòng mở khóa trước.`, 'error');
            return;
        }

        const activeBargeName = activeBarge.value.name;
        // Filter trips for this active barge (matches strictly by orderNo)
        const matchedTrips = allocatorTrips.filter((t: any) => isBargeMatch(t, activeBarge.value!));

        if (matchedTrips.length === 0) {
            showToast(`Không tìm thấy chuyến xe nào được phân bổ cho sà lan "${activeBargeName}" với mã lệnh "${bargeOrderNo}" trong Báo cáo phân bổ!`, 'error');
            return;
        }

        // Get current trucks
        const currentTrucks = await WeighbridgeService.getTrucks(bargeId);
        let action: 'overwrite' | 'append' = 'append';

        if (currentTrucks.length > 0) {
            const confirmOverwrite = await showConfirm({
                title: 'Đồng bộ danh sách xe sà lan',
                message: `Sà lan này đang có ${currentTrucks.length} xe.\n\n- Chọn Ghi đè: Để xóa các xe cũ và chỉ giữ danh sách xe mới từ phân bổ.\n- Chọn Thêm tiếp: Để giữ lại xe cũ và cộng dồn thêm xe mới.`,
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
                if (t.date1Obj) {
                    const date1 = new Date(t.date1Obj);
                    if (!isNaN(date1.getTime())) {
                        const offset = date1.getTimezoneOffset();
                        const localDate = new Date(date1.getTime() - (offset * 60 * 1000));
                        dIn = localDate.toISOString().slice(0, 16);
                    }
                }
                if (t.date2Obj) {
                    const date2 = new Date(t.date2Obj);
                    if (!isNaN(date2.getTime())) {
                        const offset = date2.getTimezoneOffset();
                        const localDate = new Date(date2.getTime() - (offset * 60 * 1000));
                        dOut = localDate.toISOString().slice(0, 16);
                    }
                }
            } catch (e) {
                console.warn('Error parsing date:', e);
            }

            if (!dIn) {
                dIn = new Date().toISOString().slice(0, 16);
            }
            if (!dOut) {
                const outDate = new Date();
                outDate.setMinutes(outDate.getMinutes() + 30);
                dOut = outDate.toISOString().slice(0, 16);
            }

            return {
                id: Date.now() + idx,
                barge_id: bargeId,
                ticketNo: t.ticketNo || '',
                plateNumber: t.plateNumber || '',
                driver: '',
                weight1: Number(t.weight1) || 0,
                weight2: Number(t.weight2) || 0,
                weightNet: Number(t.weightNet) || 0,
                dateIn: dIn,
                dateOut: dOut,
                note: t.notes || ''
            };
        });

        let currentSeed = cfgForm.ticketSeed || '1';
        for (const tr of importedTrucks) {
            if (!tr.ticketNo) {
                const tempAll = (action === 'overwrite') ? importedTrucks : [...currentTrucks, ...importedTrucks];
                tr.ticketNo = getNextTicketNumber(tr.dateOut || tr.dateIn, tempAll, currentSeed, tr.id);
                const serialPart = tr.ticketNo.split('/')[0];
                currentSeed = (parseInt(serialPart || '0', 10) || 1) + 1;
            }
        }

        let allTrucks = [];
        if (action === 'overwrite') {
            allTrucks = importedTrucks;
        } else {
            allTrucks = [...currentTrucks, ...importedTrucks];
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
    if (authStore.role !== 'admin') {
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
        plateNumber: ["số xe", "biển số", "biển xe", "xe", "sks", "số kiểm soát", "plate", "phương tiện"],
        weight1: ["lần 1", "trọng lượng 1", "tl 1", "cân 1", "lần một", "gross", "tổng"],
        weight2: ["lần 2", "trọng lượng 2", "tl 2", "cân 2", "lần hai", "tare", "xe", "xác"],
        weightNet: ["hàng", "khối lượng hàng", "trọng lượng hàng", "tịnh", "net", "khối lượng tịnh", "kl tịnh"],
        dateIn: ["giờ vào", "ngày vào", "vào", "thời gian vào", "ngày giờ vào", "time in"],
        dateOut: ["giờ ra", "ngày ra", "ra", "thời gian ra", "ngày giờ ra", "time out"],
        driver: ["tài xế", "tài", "lái xe", "tên tài xế", "driver"],
        note: ["ghi chú", "note", "diễn giải", "ghi chú thêm"]
    };

    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
        const row = rawRows[r];
        if (!row || !Array.isArray(row)) continue;

        let matches = 0;
        row.forEach(cell => {
            if (cell === null || cell === undefined) return;
            const val = String(cell).toLowerCase().trim();
            
            Object.values(keywords).forEach(kwList => {
                if (kwList.some(kw => val.includes(kw))) {
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

    columns.forEach(col => {
        const nameLower = col.name.toLowerCase();
        
        (Object.keys(keywords) as ExcelField[]).forEach(field => {
            if (mapping[field] !== -1) return;
            if (keywords[field].some(kw => nameLower.includes(kw))) {
                mapping[field] = col.index;
            }
        });
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
        return val.toISOString().slice(0, 16);
    }
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return date.toISOString().slice(0, 16);
    }
    const str = String(val).trim();
    const dMyHm = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{1,2})/);
    if (dMyHm) {
        const date = new Date(parseInt(dMyHm[3] || '0'), parseInt(dMyHm[2] || '1') - 1, parseInt(dMyHm[1] || '1'), parseInt(dMyHm[4] || '0'), parseInt(dMyHm[5] || '0'));
        if (!isNaN(date.getTime())) return date.toISOString().slice(0, 16);
    }
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
                dIn = now.toISOString().slice(0, 16);
            }
            if (!dOut) {
                const now = new Date();
                now.setMinutes(now.getMinutes() + 30);
                dOut = now.toISOString().slice(0, 16);
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
    if (authStore.role !== 'admin') {
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
    dialogTruck.dateIn = now.toISOString().slice(0, 16);
    now.setMinutes(now.getMinutes() + 30);
    dialogTruck.dateOut = now.toISOString().slice(0, 16);
    
    dialogTruck.note = '';
    
    showTruckDialog.value = true;
};

const openEditTruckDialog = (truck: Truck) => {
    if (authStore.role !== 'admin') {
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
    if (authStore.role !== 'admin') {
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
    if (authStore.role !== 'admin') {
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
    if (authStore.role !== 'admin') {
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

// Print Logic
const printTrucksList = ref<Truck[]>([]);

const triggerPrint = (singleTruck?: Truck) => {
    if (singleTruck) {
        printTrucksList.value = [singleTruck];
    } else {
        if (filteredTrucks.value.length === 0) {
            alert("Danh sách xe trống! Vui lòng tải file Excel hoặc thêm xe thủ công trước khi in.");
            return;
        }
        printTrucksList.value = [...filteredTrucks.value];
    }

    // Wait for DOM to render the print section
    setTimeout(() => {
        window.print();
    }, 200);
};

// Initialize
onMounted(async () => {
    await loadVessels();
    loadGlobalGoods();
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
});

// Watch activeTab to dynamically register/deregister ResizeObserver when entering/leaving config tab
watch(activeTab, async (newTab) => {
    if (newTab === 'config') {
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
    if (resizeObserver) {
        resizeObserver.disconnect();
    }
});
</script>

<template>
    <div class="weighbridge-printer-wrapper flex-1 flex flex-col min-h-0 overflow-hidden">
        <div v-if="!hideCard" class="bg-white rounded-[24px] p-8 md:p-10 soft-shadow border border-primary/5 relative overflow-hidden flex flex-col justify-between h-full group">
            <div class="absolute -top-6 -right-6 p-8 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all pointer-events-none">
                <span class="material-symbols-outlined text-[120px] text-primary">print</span>
            </div>
            <div>
                <h3 class="text-2xl font-display font-black text-primary mb-3">In Phiếu Cân Xe 🚢</h3>
                <p class="text-sm font-medium text-[#1b0d11]/60 leading-relaxed mb-6">
                    Quản lý danh sách tàu, sà lan và nhập xe từ Excel. Hỗ trợ tạo và in phiếu cân tự động định dạng A5 chuyên nghiệp.
                </p>
                <div class="flex flex-wrap gap-2 mb-6">
                    <span class="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full">Supabase Cloud</span>
                    <span class="text-xs font-bold px-3 py-1 bg-teal-500/10 text-teal-600 rounded-full">In A5</span>
                    <span class="text-xs font-bold px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full">Excel Smart Match</span>
                </div>
            </div>
            
            <button 
                @click="isOpen = true" 
                class="w-full py-4 puffy-button flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
                <span class="material-symbols-outlined">open_in_new</span>
                Mở công cụ In Phiếu Cân
            </button>
        </div>

        <!-- Fullscreen Workspace Overlay -->
        <div v-if="isOpen" :class="[hideCard ? 'flex-1 flex flex-col overflow-hidden' : 'fixed inset-0 bg-cute-gradient z-[100] flex flex-col overflow-hidden no-print animate-fade-in font-display']">
            <!-- Header bar of Workspace -->
            <header v-if="!hideCard" class="bg-white px-6 py-2.5 border-b border-primary/10 flex items-center justify-between shadow-sm">
                <div class="flex items-center gap-2.5">
                    <div class="size-9 bg-primary rounded-full flex items-center justify-center text-white shadow-soft">
                        <span class="material-symbols-outlined text-lg">print</span>
                    </div>
                    <div>
                        <h2 class="text-sm font-black text-primary leading-tight">PHẦN MỀM IN PHIẾU CÂN XE</h2>
                        <p class="text-[10px] font-medium text-[#1b0d11]/60 leading-none">Cảng Nguyên Ngọc - Đồng bộ đám mây</p>
                    </div>
                </div>
                
                <!-- Status bar -->
                <div class="flex items-center gap-3">
                    <div v-if="!authStore.isAuthenticated" class="hidden lg:flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                        <span class="material-symbols-outlined text-xs">warning</span>
                        Chưa đăng nhập! Dữ liệu đang được lưu tạm thời.
                    </div>
                    
                    <button 
                        @click="isOpen = false" 
                        class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full text-xs flex items-center gap-1 transition-all"
                    >
                        <span class="material-symbols-outlined text-sm">close</span>
                        Đóng
                    </button>
                </div>
            </header>

            <!-- Main area -->
            <div :class="['flex-1 flex overflow-hidden gap-4', hideCard ? 'p-4' : 'p-4 bg-cute-gradient']">
                <!-- Sidebar (left): Vessels -> Barges tree -->
                <aside class="w-72 h-full bg-white rounded-[24px] soft-shadow border border-primary/5 flex flex-col shrink-0 overflow-hidden">
                    <div class="p-3 border-b border-primary/5 flex items-center justify-between">
                        <span 
                            @click="activeVesselId = null; activeBargeId = null" 
                            class="text-xs font-black text-gray-500 hover:text-primary cursor-pointer uppercase tracking-wider transition-colors flex items-center gap-1"
                            title="Quay lại Trang tổng quan"
                        >
                            <span class="material-symbols-outlined text-sm">home</span>
                            Tổng quan
                        </span>
                        <button @click="loadVessels" class="size-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-primary transition-colors" title="Tải lại danh sách">
                            <span class="material-symbols-outlined text-lg" :class="{'animate-spin': loading}">refresh</span>
                        </button>
                    </div>

                    <!-- Tree list -->
                    <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
                        <div v-if="vessels.length === 0" class="text-center py-6 text-gray-400 text-xs">
                            Chưa có dữ liệu tàu. Nhấn nút bên dưới để thêm tàu mới.
                        </div>

                        <div v-for="vessel in vessels" :key="vessel.id" class="border border-primary/5 rounded-[16px] overflow-hidden bg-gray-50">
                            <!-- Vessel Header -->
                            <div 
                                @click="selectVessel(vessel.id); expandedVesselIds[vessel.id] = !expandedVesselIds[vessel.id]"
                                :class="['flex items-center justify-between p-2.5 hover:bg-primary/5 cursor-pointer transition-colors', activeVesselId === vessel.id && activeBargeId === null ? 'bg-primary/10 border-l-4 border-primary' : '']"
                            >
                                <div class="flex items-center gap-1.5 font-bold text-xs text-[#4a2c32]">
                                    <span class="material-symbols-outlined text-primary text-base">directions_boat</span>
                                    <span class="truncate max-w-[120px]">{{ vessel.name }}</span>
                                </div>
                                
                                <!-- Vessel Actions -->
                                <div v-if="authStore.role === 'admin'" class="flex items-center gap-0.5" @click.stopPropagation>
                                    <button @click="addBarge(vessel.id)" class="size-6 rounded-full hover:bg-white flex items-center justify-center text-primary/70 hover:text-primary transition-colors" title="Thêm sà lan">
                                        <span class="material-symbols-outlined text-xs">add</span>
                                    </button>
                                    <button @click="renameVessel(vessel.id, vessel.name)" class="size-6 rounded-full hover:bg-white flex items-center justify-center text-gray-400 hover:text-primary transition-colors" title="Đổi tên tàu">
                                        <span class="material-symbols-outlined text-xs">edit</span>
                                    </button>
                                    <button @click="deleteVessel(vessel.id, vessel.name)" class="size-6 rounded-full hover:bg-white flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors" title="Xóa tàu">
                                        <span class="material-symbols-outlined text-xs">delete</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Barges List (under Vessel) -->
                            <div v-if="expandedVesselIds[vessel.id]" class="bg-white px-1.5 py-1 border-t border-primary/5 flex flex-col gap-0.5">
                                <div v-if="!vessel.barges || vessel.barges.length === 0" class="text-[10px] text-gray-400 py-1.5 px-2.5 italic">
                                    Không có sà lan nào
                                </div>
                                <div 
                                    v-for="barge in vessel.barges" 
                                    :key="barge.id"
                                    @click="selectBarge(vessel.id, barge.id)"
                                    :class="['flex items-center justify-between p-2 rounded-[12px] cursor-pointer transition-all text-[11px] font-bold', activeBargeId === barge.id ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
                                >
                                    <div class="flex items-center gap-1.5 truncate">
                                        <span class="material-symbols-outlined text-sm">layers</span>
                                        <span class="truncate">{{ barge.name }}</span>
                                        <span v-if="barge.config?.orderNo" :class="['ml-1.5 px-1 py-0.2 text-[8px] border rounded font-black uppercase tracking-wider', activeBargeId === barge.id ? 'bg-white/20 text-white border-white/30' : 'bg-teal-50 text-teal-600 border-teal-200']">
                                            Lệnh: {{ barge.config.orderNo }}
                                        </span>
                                        <span v-if="barge.config?.locked" class="material-symbols-outlined text-[11px]" :class="activeBargeId === barge.id ? 'text-white/90' : 'text-red-500'" title="Sà lan đang bị khóa">lock</span>
                                    </div>
                                    <div v-if="authStore.role === 'admin'" class="flex items-center gap-0.5" @click.stopPropagation>
                                        <button @click="renameBarge(barge.id, barge.name)" class="size-5 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors" :class="activeBargeId === barge.id ? 'text-white' : 'text-gray-400 hover:text-primary'" title="Đổi tên">
                                            <span class="material-symbols-outlined text-[10px]">edit</span>
                                        </button>
                                        <button @click="deleteBarge(vessel.id, barge.id, barge.name)" class="size-5 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors" :class="activeBargeId === barge.id ? 'text-white' : 'text-gray-400 hover:text-red-500'" title="Xóa sà lan">
                                            <span class="material-symbols-outlined text-[10px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Sidebar Footer -->
                    <div v-if="authStore.role === 'admin'" class="p-3 border-t border-primary/10 bg-gray-50">
                        <button 
                            @click="addVessel" 
                            class="w-full py-2 bg-white border border-primary/20 hover:border-primary text-primary font-bold rounded-[12px] text-xs flex items-center justify-center gap-1.5 hover:bg-primary/5 transition-all shadow-sm"
                        >
                            <span class="material-symbols-outlined text-xs">add</span>
                            Thêm tàu mới
                        </button>
                    </div>

                </aside>

                <!-- Workspace (right) -->
                <main class="flex-1 h-full min-h-0 flex flex-col gap-4 p-0 overflow-hidden">
                    <!-- Global Dashboard (Empty State replaced by All Barges Overview) -->
                    <div v-if="!activeVesselId" class="flex-1 flex flex-col gap-4 w-full max-w-[1500px] mx-auto pb-0 animate-fade-in min-h-0">
                        <!-- Welcome Header banner -->
                        <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 gap-3">
                            <div>
                                <div class="text-[9px] uppercase font-black tracking-widest text-primary mb-0.5">Hệ thống in phiếu cân xe</div>
                                <h1 class="text-base font-black text-[#4a2c32] flex items-center gap-1.5">
                                    Báo cáo tổng quan hệ thống
                                </h1>
                            </div>
                        </div>

                        <!-- Stats Row -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-primary/10 text-primary rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">directions_boat</span>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng số tàu</p>
                                    <h4 class="text-lg font-black text-[#4a2c32]">{{ vessels.length }} <span class="text-xs text-gray-400 font-bold">tàu</span></h4>
                                </div>
                            </div>
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-teal-500/10 text-teal-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">layers</span>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng số sà lan</p>
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
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Đồng bộ đám mây</p>
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
                        <div class="flex-1 bg-white rounded-[24px] p-5 soft-shadow border border-primary/5 flex flex-col min-h-0">
                            <div class="flex flex-wrap items-center justify-between mb-4 gap-3">
                                <h3 class="text-sm font-black text-primary flex items-center gap-1.5">
                                    <span class="material-symbols-outlined text-base">analytics</span>
                                    Danh sách quản lý tất cả sà lan
                                </h3>
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
                                
                                <!-- Month Filter dropdown -->
                                <div v-if="availableGlobalMonths.length > 0" class="relative min-w-[200px] flex items-center">
                                    <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm">calendar_month</span>
                                    <select 
                                        v-model="globalFilterMonth" 
                                        class="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-[12px] text-xs font-bold focus:outline-none focus:border-primary cursor-pointer appearance-none"
                                    >
                                        <option value="">Tất cả các tháng (Thời gian)</option>
                                        <option v-for="month in availableGlobalMonths" :key="month" :value="month">
                                            Tháng {{ month }}
                                        </option>
                                    </select>
                                    <span class="material-symbols-outlined absolute right-3 text-gray-400 text-sm pointer-events-none">expand_more</span>
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
                            <div v-else class="flex-1 overflow-y-auto overflow-x-auto rounded-[16px] border border-gray-100">
                                <table class="w-full text-left border-collapse text-xs font-semibold">
                                    <thead>
                                        <tr class="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold">
                                            <th class="px-3 py-2 w-12 text-center bg-gray-50">STT</th>
                                            <th class="px-3 py-2 bg-gray-50">Tên sà lan</th>
                                            <th class="px-3 py-2 bg-gray-50">Mã lệnh</th>
                                            <th class="px-3 py-2 bg-gray-50">Thuộc Tàu</th>
                                            <th class="px-3 py-2 bg-gray-50">Thời gian bắt đầu</th>
                                            <th class="px-3 py-2 bg-gray-50">Thời gian kết thúc</th>
                                            <th class="px-3 py-2 bg-gray-50 text-center">Trạng thái</th>
                                            <th class="px-3 py-2 text-center w-28 bg-gray-50">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-100 text-[#4a2c32]/90">
                                        <tr v-for="(b, idx) in filteredAllBarges" :key="b.id" class="hover:bg-gray-50 transition-colors">
                                            <td class="px-3 py-2 text-center text-gray-400 font-bold">{{ idx + 1 }}</td>
                                            <td class="px-3 py-2 font-bold text-gray-900">{{ b.name }}</td>
                                            <td class="px-3 py-2">
                                                <span v-if="b.orderNo" class="px-2 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[10px] font-black whitespace-nowrap">
                                                    {{ b.orderNo }}
                                                </span>
                                                <span v-else class="text-gray-400 italic text-[10px]">-</span>
                                            </td>
                                            <td class="px-3 py-2">
                                                <span class="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-black whitespace-nowrap">
                                                    {{ b.vesselName }}
                                                </span>
                                            </td>
                                            <td class="px-3 py-2 text-gray-500 whitespace-nowrap">{{ b.dateStart ? formatDateTimeStr(b.dateStart) : '-' }}</td>
                                            <td class="px-3 py-2 text-gray-500 whitespace-nowrap">{{ b.dateEnd ? formatDateTimeStr(b.dateEnd) : '-' }}</td>
                                            <td class="px-3 py-2 text-center">
                                                <span v-if="b.locked" class="inline-flex px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-[10px] font-bold items-center gap-1 whitespace-nowrap">
                                                    <span class="material-symbols-outlined text-[11px]">lock</span> Khóa
                                                </span>
                                                <span v-else class="inline-flex px-2.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[10px] font-bold items-center gap-1 whitespace-nowrap">
                                                    <span class="material-symbols-outlined text-[11px]">lock_open</span> Mở
                                                </span>
                                            </td>
                                            <td class="px-3 py-2 text-center">
                                                <button 
                                                    @click="selectBarge(b.vesselId, b.id)" 
                                                    class="px-2.5 py-1 bg-primary text-white font-bold rounded-[12px] text-[10px] hover:scale-[1.05] transition-all whitespace-nowrap"
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
                    <div v-else-if="activeVesselId && !activeBargeId" class="flex-1 flex flex-col gap-4 w-full max-w-[1500px] mx-auto pb-0 animate-fade-in min-h-0">
                        <!-- Vessel header breadcrumbs -->
                        <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 gap-3">
                            <div class="flex items-center gap-3">
                                <div>
                                    <div class="text-[9px] uppercase font-black tracking-widest text-primary mb-0.5">Báo cáo tổng hợp tàu</div>
                                    <h1 class="text-base font-black text-[#4a2c32] flex items-center gap-1.5">
                                        <span @click="activeVesselId = null; activeBargeId = null" class="text-gray-400 hover:text-primary cursor-pointer transition-colors flex items-center gap-0.5" title="Quay lại Tổng quan"><span class="material-symbols-outlined text-base">home</span>Tổng quan</span>
                                        <span class="text-gray-300">&rsaquo;</span>
                                        Tàu: <span class="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-black">{{ activeVessel?.name }}</span>
                                    </h1>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-2">
                                <button 
                                    v-if="filteredVesselBarges.length > 0"
                                    @click="exportVesselSummaryExcel"
                                    class="px-4 py-2 bg-teal-600 text-white font-bold text-xs rounded-[12px] shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5"
                                >
                                    <span class="material-symbols-outlined text-sm">download</span>
                                    Xuất báo cáo (Excel)
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
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng số sà lan</p>
                                    <h4 class="text-lg font-black text-[#4a2c32]">{{ filteredVesselBarges.length }} <span class="text-xs text-gray-400 font-bold">sà lan</span></h4>
                                </div>
                            </div>
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-teal-500/10 text-teal-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">local_shipping</span>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng số chuyến xe</p>
                                    <h4 class="text-lg font-black text-teal-600">{{ formatNumber(filteredVesselBarges.reduce((sum, b) => sum + b.truckCount, 0)) }} <span class="text-xs font-bold text-gray-400">lượt</span></h4>
                                </div>
                            </div>
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-amber-500/10 text-amber-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">scale</span>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng khối lượng nhận</p>
                                    <h4 class="text-lg font-black text-amber-600">{{ formatNumber(filteredVesselBarges.reduce((sum, b) => sum + b.totalWeight, 0)) }} <span class="text-xs font-bold text-gray-400">kg</span></h4>
                                </div>
                            </div>
                        </div>

                        <!-- Barges Summary Table Card -->
                        <div class="flex-1 bg-white rounded-[24px] p-5 soft-shadow border border-primary/5 flex flex-col min-h-0">
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
                            <div v-else class="flex-1 overflow-y-auto overflow-x-auto rounded-[16px] border border-gray-100">
                                <table class="w-full text-left border-collapse text-xs font-semibold">
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
                                    <tbody class="divide-y divide-gray-100 text-[#4a2c32]/90">
                                        <tr v-for="(b, idx) in filteredVesselBarges" :key="b.id" class="hover:bg-gray-50 transition-colors">
                                            <td class="px-3 py-2 text-center text-gray-400 font-bold">{{ idx + 1 }}</td>
                                            <td class="px-3 py-2 font-bold text-gray-900">{{ b.name }}</td>
                                            <td class="px-3 py-2 text-right font-medium">{{ formatNumber(b.truckCount) }}</td>
                                            <td class="px-3 py-2 text-right font-bold text-teal-600">{{ formatNumber(b.totalWeight) }}</td>
                                            <td class="px-3 py-2 text-gray-500 whitespace-nowrap">{{ formatDateTimeStr(b.dateStart) || '-' }}</td>
                                            <td class="px-3 py-2 text-gray-500 whitespace-nowrap">{{ formatDateTimeStr(b.dateEnd) || '-' }}</td>
                                            <td class="px-3 py-2 text-center">
                                                <span v-if="b.locked" class="inline-flex px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-[10px] font-bold items-center gap-1 whitespace-nowrap">
                                                    <span class="material-symbols-outlined text-[11px]">lock</span> Khóa
                                                </span>
                                                <span v-else class="inline-flex px-2.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[10px] font-bold items-center gap-1 whitespace-nowrap">
                                                    <span class="material-symbols-outlined text-[11px]">lock_open</span> Mở
                                                </span>
                                            </td>
                                            <td class="px-3 py-2 text-center">
                                                <button 
                                                    @click="selectBarge(activeVesselId!, b.id)" 
                                                    class="px-2.5 py-1 bg-primary text-white font-bold rounded-[12px] text-[10px] hover:scale-[1.05] transition-all whitespace-nowrap"
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
                    <div v-else class="flex-1 flex flex-col gap-4 w-full max-w-[1500px] mx-auto pb-0 min-h-0">
                        <!-- Header with breadcrumbs -->
                        <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] p-3 px-4 soft-shadow border border-primary/5 gap-3">
                            <div>
                                <div class="text-[9px] uppercase font-black tracking-widest text-primary mb-0.5">Đang chọn hoạt động</div>
                                <h1 class="text-sm font-black text-[#4a2c32] flex items-center gap-1.5">
                                    <span @click="activeVesselId = null; activeBargeId = null" class="text-gray-400 hover:text-primary cursor-pointer transition-colors flex items-center gap-0.5" title="Quay lại Tổng quan"><span class="material-symbols-outlined text-base">home</span>Tổng quan</span>
                                    <span class="text-gray-300">&rsaquo;</span>
                                    Tàu: <span @click="activeBargeId = null" class="px-2 py-0.5 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer rounded-full text-[10px] font-black" title="Xem báo cáo tổng hợp tàu">{{ activeVessel?.name }}</span>
                                    <span class="text-gray-300">&rsaquo;</span>
                                    Sà lan: <span class="px-2 py-0.5 bg-teal-500/10 text-teal-600 rounded-full text-[10px] font-black">{{ activeBarge?.name }}</span>
                                    <button 
                                        @click="toggleBargeLock" 
                                        :class="['ml-2 p-1 rounded-full flex items-center justify-center transition-all', cfgForm.locked ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200']"
                                        :title="cfgForm.locked ? 'Mở khóa sà lan' : 'Khóa sà lan'"
                                    >
                                        <span class="material-symbols-outlined text-[12px] font-bold">{{ cfgForm.locked ? 'lock' : 'lock_open' }}</span>
                                    </button>
                                </h1>
                            </div>

                            <!-- Sync indicator -->
                            <div class="flex items-center gap-1.5">
                                <span v-if="cfgForm.locked" class="text-[10px] font-black text-red-600 flex items-center gap-0.5 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                                    <span class="material-symbols-outlined text-[12px]">lock</span> ĐÃ KHÓA
                                </span>
                                <span v-else-if="saving" class="text-[10px] font-medium text-gray-400 flex items-center gap-0.5">
                                    <span class="material-symbols-outlined text-xs animate-spin">sync</span> Đang đồng bộ...
                                </span>
                                <span v-else class="text-[10px] font-medium text-teal-500 flex items-center gap-0.5">
                                    <span class="material-symbols-outlined text-xs">cloud_done</span> Đã đồng bộ đám mây
                                </span>
                            </div>
                        </div>

                        <!-- Tab Navigation -->
                        <div class="flex gap-1.5 border-b border-primary/15 pb-1.5">
                            <button 
                                @click="activeTab = 'data'"
                                :class="['px-4 py-1.5 rounded-[12px] font-bold text-xs transition-all flex items-center gap-1', activeTab === 'data' ? 'bg-primary text-white shadow-soft' : 'text-[#4a2c32]/60 hover:bg-white/50']"
                            >
                                <span class="material-symbols-outlined text-sm">local_shipping</span>
                                Danh sách xe & In ấn
                            </button>
                            <button v-if="authStore.role === 'admin'"
                                @click="activeTab = 'config'"
                                :class="['px-4 py-1.5 rounded-[12px] font-bold text-xs transition-all flex items-center gap-1', activeTab === 'config' ? 'bg-primary text-white shadow-soft' : 'text-[#4a2c32]/60 hover:bg-white/50']"
                            >
                                <span class="material-symbols-outlined text-sm">settings</span>
                                Cấu hình mẫu phiếu
                            </button>


                        </div>

                        <!-- TAB 1: DATA & PRINT -->
                        <div v-if="activeTab === 'data'" class="flex-1 flex flex-col gap-4 min-h-0 animate-fade-in">
                            <!-- Stats & Excel Upload Side-by-Side -->
                            <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                                <!-- Stats Grid (6 cols / 12 cols depending on role) -->
                                <div :class="authStore.role === 'admin' ? 'lg:col-span-6' : 'lg:col-span-12'" class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div class="bg-white rounded-2xl p-3 soft-shadow border border-primary/5 flex items-center gap-3">
                                        <div class="size-9 bg-primary/10 text-primary rounded-[12px] flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-lg">local_shipping</span>
                                        </div>
                                        <div>
                                            <p class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Tổng số xe</p>
                                            <h4 class="text-base font-black text-[#4a2c32]">{{ filteredTrucks.length }} <span class="text-[10px] text-gray-400 font-bold">xe</span></h4>
                                        </div>
                                    </div>
                                    <div class="bg-white rounded-2xl p-3 soft-shadow border border-primary/5 flex items-center gap-3">
                                        <div class="size-9 bg-teal-500/10 text-teal-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-lg">scale</span>
                                        </div>
                                        <div>
                                            <p class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Tổng TL tịnh (Net)</p>
                                            <h4 class="text-base font-black text-teal-600 truncate max-w-[120px]">{{ formatNumber(totalNetWeight) }} <span class="text-[10px] font-bold">kg</span></h4>
                                        </div>
                                    </div>
                                    <div class="bg-white rounded-2xl p-3 soft-shadow border border-primary/5 flex items-center gap-3">
                                        <div class="size-9 bg-amber-500/10 text-amber-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-lg">monitoring</span>
                                        </div>
                                        <div>
                                            <p class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">TL Trung bình</p>
                                            <h4 class="text-base font-black text-amber-600 truncate max-w-[120px]">{{ formatNumber(avgNetWeight) }} <span class="text-[10px] font-bold">kg</span></h4>
                                        </div>
                                    </div>
                                </div>

                                <!-- Compact Excel Upload (3 cols) -->
                                <div v-if="authStore.role === 'admin'"
                                    @dragover.prevent
                                    @drop="cfgForm.locked ? null : handleExcelDrop($event)"
                                    :class="['lg:col-span-3 bg-white rounded-2xl p-3 soft-shadow border border-primary/5 hover:border-primary/20 transition-all flex items-center justify-between gap-3 bg-gray-50/50', cfgForm.locked ? 'opacity-50 pointer-events-none' : '']"
                                >
                                    <input 
                                        type="file" 
                                        ref="fileInput" 
                                        class="hidden" 
                                        @change="handleFileSelect" 
                                        accept=".xlsx, .xls" 
                                        :disabled="cfgForm.locked"
                                    />
                                    <div class="flex items-center gap-2 min-w-0 cursor-pointer" @click="cfgForm.locked ? null : fileInput?.click()">
                                        <div class="size-9 bg-primary/10 text-primary rounded-[12px] flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-lg">upload_file</span>
                                        </div>
                                        <div class="text-left min-w-0">
                                            <p class="text-xs font-black text-[#4a2c32] truncate">Nhập file Excel</p>
                                            <p class="text-[9px] text-gray-400 font-bold truncate">Click chọn file</p>
                                        </div>
                                    </div>
                                    
                                    <div class="flex items-center gap-1 flex-shrink-0">
                                        <button 
                                            @click="downloadSampleExcel"
                                            class="size-7 bg-gray-100 hover:bg-gray-200 text-[#4a2c32] rounded-[8px] flex items-center justify-center border border-gray-200 transition-colors"
                                            title="Tải Excel mẫu"
                                        >
                                            <span class="material-symbols-outlined text-sm">download</span>
                                        </button>
                                    </div>
                                </div>

                                <!-- Direct Sync Card (3 cols) -->
                                <div v-if="authStore.role === 'admin'"
                                    :class="['lg:col-span-3 bg-white rounded-2xl p-3 soft-shadow border border-primary/5 hover:border-primary/20 transition-all flex items-center justify-between gap-3 bg-gray-50/50', cfgForm.locked ? 'opacity-50 pointer-events-none' : '']"
                                >
                                    <div class="flex items-center gap-2 min-w-0 cursor-pointer" @click="cfgForm.locked ? null : syncFromAllocatorActiveBarge()">
                                        <div class="size-9 bg-teal-500/10 text-teal-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-lg">sync_alt</span>
                                        </div>
                                        <div class="text-left min-w-0">
                                            <p class="text-xs font-black text-[#4a2c32] truncate">Đồng bộ từ Phân rã</p>
                                            <p class="text-[9px] text-gray-400 font-bold truncate">Kéo từ tab Phân bổ</p>
                                        </div>
                                    </div>
                                    <button 
                                        @click="syncFromAllocatorActiveBarge"
                                        class="px-2.5 py-1.5 bg-teal-600 text-white text-[9px] font-black rounded-[8px] hover:scale-[1.02] active:scale-[0.98] transition-all flex-shrink-0"
                                        :disabled="cfgForm.locked"
                                    >
                                        Đồng bộ
                                    </button>
                                </div>
                            </div>

                            <!-- Truck List Table Card -->
                             <div class="flex-1 bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex flex-col min-h-0">
                                <div class="flex flex-wrap items-center justify-between mb-3 gap-3">
                                    <h3 class="text-sm font-black text-primary flex items-center gap-1.5">
                                        <span class="material-symbols-outlined text-base">list_alt</span>
                                        Chi tiết danh sách xe cân sà lan
                                    </h3>
                                    
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <button v-if="authStore.role === 'admin'"
                                            @click="openAddTruckDialog"
                                            :disabled="cfgForm.locked"
                                            class="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none font-bold rounded-[8px] text-[10px] flex items-center gap-1 transition-all"
                                        >
                                            <span class="material-symbols-outlined text-xs">add</span>
                                            Thêm xe
                                        </button>
                                        <button v-if="authStore.role === 'admin'"
                                            @click="clearTrucks"
                                            :disabled="cfgForm.locked"
                                            class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 font-bold rounded-[8px] text-[10px] flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                                        >
                                            <span class="material-symbols-outlined text-xs">delete_sweep</span>
                                            Xóa tất cả
                                        </button>
                                        <button 
                                            @click="triggerPrint()"
                                            class="px-3.5 py-1.5 puffy-button flex items-center gap-1 text-[10px] hover:scale-[1.02] transition-all"
                                        >
                                            <span class="material-symbols-outlined text-xs">print</span>
                                            In hàng loạt (A5)
                                        </button>
                                    </div>
                                </div>

                                <!-- Table -->
                                <div class="flex-1 overflow-y-auto overflow-x-auto rounded-[16px] border border-gray-100">
                                    <table class="w-full text-left border-collapse text-[11px] font-semibold">
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
                                        <tbody class="divide-y divide-gray-100 text-[#4a2c32]/90">
                                            <tr v-if="filteredTrucks.length === 0">
                                                <td colspan="11" class="p-6 text-center text-gray-400 italic">
                                                    Chưa có dữ liệu xe. Hãy tải file Excel hoặc thêm xe thủ công để hiển thị.
                                                </td>
                                            </tr>
                                            <tr v-for="(truck, index) in filteredTrucks" :key="truck.id" class="hover:bg-gray-50 transition-colors">
                                                <td class="p-2 text-center text-gray-400 font-bold">{{ index + 1 }}</td>
                                                <td class="p-2 font-mono text-[#4a2c32] font-bold">{{ truck.ticketNo }}</td>
                                                <td class="p-2 font-bold text-gray-900">{{ truck.plateNumber }}</td>
                                                <td class="p-2 text-gray-600">{{ truck.driver || '-' }}</td>
                                                <td class="p-2 text-right font-medium">{{ formatNumber(truck.weight1) }}</td>
                                                <td class="p-2 text-right font-medium">{{ formatNumber(truck.weight2) }}</td>
                                                <td class="p-2 text-right font-bold text-teal-600">{{ formatNumber(truck.weightNet) }}</td>
                                                <td class="p-2 text-gray-500 whitespace-nowrap">{{ formatDateTimeStr(truck.dateIn) }}</td>
                                                <td class="p-2 text-gray-500 whitespace-nowrap">{{ formatDateTimeStr(truck.dateOut) }}</td>
                                                <td class="p-2 text-gray-400 italic max-w-[150px] truncate" :title="truck.note">{{ truck.note || '-' }}</td>
                                                <td class="p-2">
                                                    <div class="flex items-center gap-1 justify-center">
                                                        <button @click="triggerPrint(truck)" class="size-7 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-600 flex items-center justify-center transition-all" title="In phiếu này">
                                                            <span class="material-symbols-outlined text-sm">print</span>
                                                        </button>
                                                        <button v-if="authStore.role === 'admin'" @click="openEditTruckDialog(truck)" :disabled="cfgForm.locked" class="size-7 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none" title="Sửa">
                                                            <span class="material-symbols-outlined text-sm">edit</span>
                                                        </button>
                                                        <button v-if="authStore.role === 'admin'" @click="deleteTruck(truck.id, truck.plateNumber)" :disabled="cfgForm.locked" class="size-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none" title="Xóa">
                                                            <span class="material-symbols-outlined text-sm">delete</span>
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
                        <div v-if="activeTab === 'config' && authStore.role === 'admin'" class="flex flex-col gap-4 animate-fade-in">
                            <!-- Banner lock warning -->
                            <div v-if="cfgForm.locked" class="bg-red-50 text-red-700 text-xs font-bold p-3 rounded-lg border border-red-200 mb-2 flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm">warning</span>
                                Sà lan này đang bị khóa. Vui lòng mở khóa để sửa đổi cấu hình.
                            </div>

                            <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                                <!-- Print Configuration (7 cols) -->
                                <div class="bg-white rounded-[16px] p-5 soft-shadow border border-primary/5 lg:col-span-7 flex flex-col justify-between">
                                    <div>
                                        <h3 class="text-sm font-black text-primary mb-4 flex items-center gap-1.5">
                                            <span class="material-symbols-outlined text-base">settings_applications</span>
                                            Cấu hình thông tin in chung
                                        </h3>
                                        
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Tên hàng hóa (mặc định)</label>
                                                <select 
                                                    v-if="globalGoodsList && globalGoodsList.length > 0"
                                                    v-model="cfgForm.goods" 
                                                    :disabled="cfgForm.locked" 
                                                    class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <option value="">-- Chọn hàng hóa --</option>
                                                    <option v-for="g in globalGoodsList" :key="g" :value="g">{{ g }}</option>
                                                </select>
                                                <input 
                                                    v-else
                                                    v-model="cfgForm.goods" 
                                                    :disabled="cfgForm.locked" 
                                                    type="text" 
                                                    placeholder="Thêm danh mục ở Báo cáo cân hàng..." 
                                                    class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Mã hàng hóa</label>
                                                <input v-model="cfgForm.goodsCode" :disabled="cfgForm.locked" type="text" placeholder="Mã hàng..." class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1 md:col-span-2">
                                                <label class="text-[10px] font-bold text-gray-500">Tên chủ hàng (mặc định)</label>
                                                <input v-model="cfgForm.owner" :disabled="cfgForm.locked" type="text" placeholder="Công ty xuất nhập khẩu..." class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Người cân (NV trạm cân)</label>
                                                <input v-model="cfgForm.operator" :disabled="cfgForm.locked" type="text" placeholder="Tên nhân viên..." class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Hình thức xuất/nhập</label>
                                                <select v-model="cfgForm.xn" :disabled="cfgForm.locked" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-bold bg-white disabled:opacity-50 disabled:cursor-not-allowed">
                                                    <option value="XUẤT KHẨU">XUẤT KHẨU</option>
                                                    <option value="NHẬP KHẨU">NHẬP KHẨU</option>
                                                    <option value="NỘI BỘ">NỘI BỘ</option>
                                                </select>
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Tiền tố số phiếu (Mẫu số)</label>
                                                <input v-model="cfgForm.ticketPrefix" :disabled="cfgForm.locked" @change="handleTicketConfigChange" type="text" placeholder="Ví dụ: PC-" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Số phiếu bắt đầu</label>
                                                <input v-model="cfgForm.ticketSeed" :disabled="cfgForm.locked" @change="handleTicketConfigChange" type="text" placeholder="Ví dụ: 1 hoặc 001" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1 md:col-span-2">
                                                <label class="text-[10px] font-bold text-gray-500">Số lệnh cấp hàng / Số lệnh xuất (Khớp tự động từ Phân bổ)</label>
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
                                                <label class="text-[10px] font-bold text-gray-500">Tỷ lệ Chính phẩm (%)</label>
                                                <input v-model="cfgForm.chinhpham" :disabled="cfgForm.locked" type="text" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Tỷ lệ Phụ phẩm (%)</label>
                                                <input v-model="cfgForm.phupham" :disabled="cfgForm.locked" type="text" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Kết luận</label>
                                                <textarea v-model="cfgForm.ketluan" :disabled="cfgForm.locked" rows="3" placeholder="Nhập kết luận đánh giá..." class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed resize-none"></textarea>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Visual Template Designer Section (Full width) -->
                            <div class="bg-white rounded-[16px] p-5 soft-shadow border border-primary/5">
                                <h3 class="text-sm font-black text-primary mb-4 flex items-center justify-between border-b border-gray-100 pb-2 flex-wrap gap-2">
                                    <div class="flex items-center gap-1.5 select-none">
                                        <span class="material-symbols-outlined text-base">design_services</span>
                                        Thiết kế tự do &amp; Kéo thả mẫu phiếu cân A5
                                    </div>
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <button 
                                            @click="saveAsGlobalDefaultLayout"
                                            title="Lưu mẫu thiết kế hiện tại làm mẫu mặc định cho các sà lan khác"
                                            class="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 select-none"
                                        >
                                            <span class="material-symbols-outlined text-xs">star</span>
                                            Đặt làm mẫu mặc định
                                        </button>
                                        <button 
                                            @click="applyLayoutToAllBarges"
                                            :disabled="cfgForm.locked"
                                            title="Áp dụng thiết kế hiện tại cho tất cả sà lan trên toàn hệ thống"
                                            class="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 select-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span class="material-symbols-outlined text-xs">done_all</span>
                                            Áp dụng cho TẤT CẢ sà lan
                                        </button>
                                        <button 
                                            @click="resetToDefaultLayout" 
                                            :disabled="cfgForm.locked"
                                            class="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 text-[10px] font-bold rounded-lg border border-red-100 transition-all select-none"
                                        >
                                            Khôi phục mẫu chuẩn
                                        </button>
                                        <button 
                                            @click="saveBargeConfigImmediately" 
                                            :disabled="cfgForm.locked"
                                            class="px-3 py-1 bg-primary text-white font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 select-none hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                                        >
                                            <span class="material-symbols-outlined text-xs">save</span>
                                            Lưu cấu hình mẫu phiếu
                                        </button>
                                    </div>
                                </h3>
                                
                                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                    <!-- Left Panel (Sidebar): Elements & Configuration (lg:col-span-4) -->
                                    <div class="lg:col-span-4 flex flex-col gap-4">
                                        <!-- Add elements toolbar -->
                                        <div class="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col gap-3">
                                            <h4 class="text-xs font-black text-[#4a2c32] uppercase tracking-wider select-none">Thanh công cụ thiết kế</h4>
                                            
                                            <div class="grid grid-cols-2 gap-2">
                                                <button 
                                                    @click="addStaticText" 
                                                    :disabled="cfgForm.locked"
                                                    class="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 hover:border-primary hover:text-primary transition-all flex items-center gap-1"
                                                >
                                                    <span class="material-symbols-outlined text-xs">title</span> Chữ tĩnh
                                                </button>
                                                <button 
                                                    @click="addLineElement('horizontal')" 
                                                    :disabled="cfgForm.locked"
                                                    class="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 hover:border-primary hover:text-primary transition-all flex items-center gap-1"
                                                >
                                                    <span class="material-symbols-outlined text-xs">horizontal_rule</span> Kẻ ngang
                                                </button>
                                                <button 
                                                    @click="addLineElement('vertical')" 
                                                    :disabled="cfgForm.locked"
                                                    class="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 hover:border-primary hover:text-primary transition-all flex items-center gap-1"
                                                >
                                                    <span class="material-symbols-outlined text-xs">vertical_align_center</span> Kẻ dọc
                                                </button>
                                                <button 
                                                    @click="addRectElement" 
                                                    :disabled="cfgForm.locked"
                                                    class="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 hover:border-primary hover:text-primary transition-all flex items-center gap-1"
                                                >
                                                    <span class="material-symbols-outlined text-xs">check_box_outline_blank</span> Khung viền
                                                </button>
                                            </div>

                                            <div class="flex flex-col gap-1 mt-1">
                                                <label class="text-[10px] font-bold text-gray-500 select-none">Thêm trường dữ liệu xe cân:</label>
                                                <select 
                                                    @change="(e) => {
                                                        const target = e.target as HTMLSelectElement;
                                                        if (target.value) {
                                                            const opt = availableFields.find(o => o.id === target.value);
                                                            if (opt) addFieldElement(opt.id, opt.label);
                                                            target.value = '';
                                                        }
                                                    }"
                                                    :disabled="cfgForm.locked"
                                                    class="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-bold focus:outline-none focus:border-primary cursor-pointer w-full"
                                                >
                                                    <option value="">-- Chọn trường để thêm --</option>
                                                    <option v-for="item in availableFields" :key="item.id" :value="item.id">
                                                        {{ item.label }}
                                                    </option>
                                                </select>
                                            </div>

                                            <div v-if="otherBargesWithConfig.length > 0" class="flex flex-col gap-1 mt-2.5">
                                                <label class="text-[10px] font-bold text-gray-500 select-none">Sao chép thiết kế từ sà lan khác:</label>
                                                <select 
                                                    @change="(e) => {
                                                        const target = e.target as HTMLSelectElement;
                                                        if (target.value) {
                                                            copyLayoutFromBarge(Number(target.value));
                                                            target.value = '';
                                                        }
                                                    }"
                                                    :disabled="cfgForm.locked"
                                                    class="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-bold focus:outline-none focus:border-primary cursor-pointer w-full"
                                                >
                                                    <option value="">-- Chọn sà lan để sao chép --</option>
                                                    <option v-for="b in otherBargesWithConfig" :key="b.id" :value="b.id">
                                                        {{ b.vesselName }} - {{ b.name }}
                                                    </option>
                                                </select>
                                            </div>
                                        </div>

                                        <!-- Selected Element Config Panel -->
                                        <div v-if="selectedElement" class="bg-gray-50 p-4 rounded-xl border border-primary/10 flex flex-col gap-3.5">
                                            <div class="flex items-center justify-between border-b border-primary/5 pb-2">
                                                <h4 class="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-1 select-none">
                                                    <span class="material-symbols-outlined text-sm">edit_attributes</span>
                                                    Cấu hình phần tử
                                                    <span v-if="selectedElementIds.length > 1" class="text-[9px] bg-teal-500 text-white px-1.5 py-0.5 rounded-full font-black ml-1">{{ selectedElementIds.length }} đã chọn</span>
                                                </h4>
                                                <div class="flex items-center gap-1">
                                                    <button 
                                                        @click="duplicateElement(selectedElement!)" 
                                                        title="Nhân bản phần tử"
                                                        class="p-1 text-gray-500 hover:text-primary hover:bg-white rounded transition-colors"
                                                    >
                                                        <span class="material-symbols-outlined text-sm">content_copy</span>
                                                    </button>
                                                    <button 
                                                        @click="deleteElement(selectedElement!.id)" 
                                                        title="Xóa phần tử"
                                                        class="p-1 text-red-500 hover:text-red-700 hover:bg-white rounded transition-colors"
                                                    >
                                                        <span class="material-symbols-outlined text-sm">delete</span>
                                                    </button>
                                                </div>
                                            </div>

                                            <div class="grid grid-cols-2 gap-3 text-[10px] font-bold text-gray-500">
                                                <div class="flex flex-col gap-1">
                                                    <label class="flex justify-between select-none">
                                                        <span>Vị trí X (mm)</span>
                                                        <span class="text-gray-400">max 210</span>
                                                    </label>
                                                    <input 
                                                        v-model.number="selectedElement.x" 
                                                        type="number" 
                                                        step="0.5" 
                                                        min="0" 
                                                        max="210" 
                                                        @input="clampSelectedElement(selectedElement)"
                                                        class="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary font-mono"
                                                    />
                                                </div>
                                                <div class="flex flex-col gap-1">
                                                    <label class="flex justify-between select-none">
                                                        <span>Vị trí Y (mm)</span>
                                                        <span class="text-gray-400">max 148</span>
                                                    </label>
                                                    <input 
                                                        v-model.number="selectedElement.y" 
                                                        type="number" 
                                                        step="0.5" 
                                                        min="0" 
                                                        max="148" 
                                                        @input="clampSelectedElement(selectedElement)"
                                                        class="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary font-mono"
                                                    />
                                                </div>
                                            </div>

                                            <div class="grid grid-cols-2 gap-3 text-[10px] font-bold text-gray-500">
                                                <div class="flex flex-col gap-1">
                                                    <label class="select-none">Rộng W (mm)</label>
                                                    <input 
                                                        v-model.number="selectedElement.width" 
                                                        type="number" 
                                                        step="0.5" 
                                                        min="0.5" 
                                                        @input="clampSelectedElement(selectedElement); applyToAllSelected('width')"
                                                        class="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary font-mono"
                                                    />
                                                </div>
                                                <div class="flex flex-col gap-1">
                                                    <label class="select-none">Cao H (mm)</label>
                                                    <input 
                                                        v-model.number="selectedElement.height" 
                                                        type="number" 
                                                        step="0.5" 
                                                        min="0.5" 
                                                        @input="clampSelectedElement(selectedElement); applyToAllSelected('height')"
                                                        class="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary font-mono"
                                                    />
                                                </div>
                                            </div>

                                            <div v-if="selectedElement.type === 'text'" class="flex flex-col gap-1 text-[10px] font-bold text-gray-500">
                                                <label class="select-none">Nội dung chữ tĩnh</label>
                                                <textarea 
                                                    v-model="selectedElement.text" 
                                                    rows="2" 
                                                    class="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary resize-none font-sans font-bold"
                                                ></textarea>
                                            </div>

                                            <div v-if="selectedElement.type === 'field'" class="flex flex-col gap-2.5">
                                                <div class="flex flex-col gap-1 text-[10px] font-bold text-gray-500">
                                                    <label class="select-none">Tiêu đề nhãn (Label)</label>
                                                    <input 
                                                        v-model="selectedElement.label" 
                                                        type="text" 
                                                        class="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary font-sans font-bold"
                                                    />
                                                </div>
                                                <div class="grid grid-cols-2 gap-3 text-[10px] font-bold text-gray-500">
                                                    <div class="flex flex-col gap-1">
                                                        <label class="select-none">Độ rộng nhãn (mm)</label>
                                                        <input 
                                                            v-model.number="selectedElement.labelWidth" 
                                                            type="number" 
                                                            step="0.5" 
                                                            min="1" 
                                                            @input="clampSelectedElement(selectedElement); applyToAllSelected('labelWidth')"
                                                            class="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary font-mono"
                                                        />
                                                    </div>
                                                    <div class="flex flex-col gap-1">
                                                        <label class="select-none">Trường liên kết</label>
                                                        <select 
                                                            v-model="selectedElement.fieldId" 
                                                            class="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary font-bold cursor-pointer"
                                                        >
                                                            <option v-for="item in availableFields" :key="item.id" :value="item.id">
                                                                {{ item.label }}
                                                            </option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            <div v-if="selectedElement.type === 'rect'" class="flex flex-col gap-1 text-[10px] font-bold text-gray-500">
                                                <label class="select-none">Kiểu viền (Border style)</label>
                                                <select 
                                                    v-model="selectedElement.borderStyle" 
                                                    @change="applyToAllSelected('borderStyle')"
                                                    class="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary font-bold cursor-pointer"
                                                >
                                                    <option value="solid">Viền đơn (Solid)</option>
                                                    <option value="dashed">Đường đứt nét (Dashed)</option>
                                                    <option value="double">Viền kép (Double)</option>
                                                </select>
                                            </div>

                                            <!-- Typography (Not for lines and rects) -->
                                            <div v-if="selectedElement.type === 'text' || selectedElement.type === 'field'" class="flex flex-col gap-2 bg-white p-3 rounded-lg border border-gray-150">
                                                <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest select-none">Định dạng chữ</span>
                                                
                                                <div class="grid grid-cols-2 gap-3 text-[10px] font-bold text-gray-500 items-center">
                                                    <div class="flex flex-col gap-1">
                                                        <label class="select-none">Cỡ chữ (pt)</label>
                                                        <input 
                                                            v-model.number="selectedElement.fontSize" 
                                                            type="number" 
                                                            step="0.5" 
                                                            min="4" 
                                                            @input="applyToAllSelected('fontSize')"
                                                            class="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:border-primary font-mono"
                                                        />
                                                    </div>
                                                    <div class="flex flex-col gap-1">
                                                        <label class="select-none">Độ đậm</label>
                                                        <select 
                                                            v-model="selectedElement.fontWeight" 
                                                            @change="applyToAllSelected('fontWeight')"
                                                            class="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:border-primary cursor-pointer"
                                                        >
                                                            <option value="normal">Bình thường</option>
                                                            <option value="bold">In đậm</option>
                                                            <option value="black">Siêu đậm</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div class="flex items-center justify-between text-[10px] font-bold text-gray-500 pt-1">
                                                    <label class="flex items-center gap-1.5 cursor-pointer select-none">
                                                        <input 
                                                            v-model="selectedElement.fontStyle" 
                                                            type="checkbox" 
                                                            true-value="italic"
                                                            false-value="normal"
                                                            @change="applyToAllSelected('fontStyle')"
                                                            class="rounded text-primary focus:ring-primary/20"
                                                        />
                                                        <span>In nghiêng (Italic)</span>
                                                    </label>
                                                    
                                                    <div class="flex items-center gap-1">
                                                        <label class="select-none">Căn lề:</label>
                                                        <select 
                                                             v-model="selectedElement.align" 
                                                             @change="applyToAllSelected('align')"
                                                             class="px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:border-primary cursor-pointer font-bold"
                                                         > 
<option value="left">Trái</option>
                                                            <option value="center">Giữa</option>
                                                            <option value="right">Phải</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <!-- Signatures -->
                                            <div class="flex justify-between text-[7px] font-black text-gray-800 mt-4 text-center gap-1">
                                                <div v-for="(_, sIdx) in (cfgForm.signatures || ['NV TRẠM CÂN', 'BẢO VỆ', 'CHỦ HÀNG', 'THỦ KHO', 'TÀI XẾ'])" :key="sIdx" class="flex-1 min-w-0">
                                                    <input 
                                                        v-model="cfgForm.signatures![sIdx]" 
                                                        :disabled="cfgForm.locked"
                                                        class="bg-transparent border-none text-[6.5px] font-black text-gray-800 focus:outline-none hover:bg-gray-100 focus:bg-white rounded px-0.5 w-full text-center focus:ring-1 focus:ring-primary py-0 font-sans"
                                                        placeholder="Ký tên..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div> <!-- End of Left Panel lg:col-span-4 -->

                                    <!-- Right Panel: A5 Blueprint Canvas -->
                                    <div class="lg:col-span-8 flex flex-col gap-3">
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs font-bold text-[#4a2c32] flex items-center gap-1 select-none">
                                                <span class="material-symbols-outlined text-sm">square_foot</span>
                                                Khổ giấy in A5 (210mm x 148mm) - Kéo thả để bố trí layout
                                            </span>
                                            <span class="text-[9px] font-bold text-gray-400 select-none">Tỉ lệ 1mm = 4px | Dùng phím mũi tên để căn chỉnh mịn</span>
                                        </div>
                                        
                                        <!-- Canvas Container -->
                                        <div ref="canvasContainerRef" class="w-full overflow-hidden bg-gray-50 border border-gray-200 rounded-2xl p-4 flex justify-center items-center shadow-inner relative group">
                                            <div 
                                                class="relative bg-white border border-dashed border-gray-300 shadow-lg select-none overflow-hidden shrink-0"
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
                                                            ? (selectedElementId === el.id ? 'ring-2 ring-inset ring-primary z-30 bg-primary/[0.03]' : 'ring-2 ring-inset ring-teal-500 z-25 bg-teal-500/[0.03]') 
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
                                                    <div v-if="selectedElementIds.includes(el.id)" class="absolute -top-4 left-0 text-white text-[8px] px-1 py-0.5 rounded font-mono uppercase font-bold tracking-wider pointer-events-none shadow-sm z-40" :class="selectedElementId === el.id ? 'bg-primary' : 'bg-teal-500'">
                                                        {{ el.type === 'field' ? el.fieldId : el.type }}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                    </div>
                </main>
            </div>
        </div>

        <!-- COLUMN MAPPING MODAL -->
        <div v-if="showMappingModal && pendingExcelData" class="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 animate-fade-in no-print font-display">
            <div class="bg-white rounded-2xl max-w-xl w-full p-6 md:p-8 soft-shadow border border-primary/10 flex flex-col gap-6">
                <div>
                    <h3 class="text-xl font-black text-primary mb-1">Cấu hình ánh xạ cột Excel</h3>
                    <p class="text-xs text-[#1b0d11]/60">Hệ thống đã nhận diện các cột. Vui lòng kiểm tra và sửa lại nếu chưa khớp.</p>
                </div>

                <!-- Fields grid -->
                <div class="space-y-4 max-h-[350px] overflow-y-auto pr-2">
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
                        <label>Ngày giờ vào</label>
                        <input v-model="dialogTruck.dateIn" type="datetime-local" class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-semibold focus:outline-none focus:border-primary">
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label>Ngày giờ ra</label>
                        <input v-model="dialogTruck.dateOut" type="datetime-local" class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-semibold focus:outline-none focus:border-primary">
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
        <div v-if="toastMessage" :class="['fixed bottom-8 right-8 z-[200] px-6 py-4 rounded-[16px] shadow-lg border text-sm font-bold flex items-center gap-2 animate-fade-in no-print', toastType === 'success' ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-red-50 border-red-200 text-red-700']">
            <span class="material-symbols-outlined text-lg">{{ toastType === 'success' ? 'check_circle' : 'error' }}</span>
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
            class="fixed inset-0 z-[999] flex items-center justify-center bg-[#4a2c32]/40 backdrop-blur-sm p-4"
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
                <div class="text-xs font-semibold text-gray-600 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto pr-1">
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
            class="fixed inset-0 z-[999] flex items-center justify-center bg-[#4a2c32]/40 backdrop-blur-sm p-4 no-print"
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
            class="fixed inset-0 z-[999] flex items-center justify-center bg-[#4a2c32]/40 backdrop-blur-sm p-4 no-print"
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
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tên sà lan *</label>
                        <input 
                            type="text" 
                            v-model="bargeDialog.bargeName"
                            placeholder="Ví dụ: HP 1022, SG 9988..."
                            class="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-primary rounded-[14px] text-xs font-bold focus:outline-none transition-all uppercase"
                            ref="bargeNameInputRef"
                        />
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Mã lệnh (Số lệnh)</label>
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

/* Print CSS Styles */
@media print {
    @page {
        size: A5 landscape;
        margin: 0;
    }

    :global(body) {
        background-color: white !important;
        background-image: none !important;
        color: black !important;
        height: auto !important;
        overflow: visible !important;
    }
    /* Hide the entire app container during printing */
    :global(#app) {
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

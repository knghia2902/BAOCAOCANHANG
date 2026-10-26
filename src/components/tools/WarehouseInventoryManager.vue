<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import {
    WarehouseInventoryService,
    computeWarehouseFinalTable,
    formatIsoToDmy,
    getTicketCustomerGroup,
    sanitizeCustomerName
} from '@/services/excel/WarehouseInventoryService';
import type {
    WarehouseId,
    WarehouseInventoryTicket,
    WarehouseConfig,
    WarehouseVehicleMap,
    WarehouseFinalRow
} from '@/types/excel';
import WarehouseVisualMap from './WarehouseVisualMap.vue';

const emit = defineEmits<{
    (e: 'synced-to-allocator', payload: { syncedTicketsCount: number; matchedBargesCount: number }): void;
}>();

const { addToast } = useToast();

type ViewWarehouseMode = WarehouseId | 'COMBINED_123';
type SheetTabMode = 'FINAL' | 'IMPORT' | 'EXPORT' | 'DIRECT';

const selectedWarehouseMode = ref<ViewWarehouseMode>('KHO 4');
const activeSheetTab = ref<SheetTabMode>('IMPORT');
const isVisualMapOpen = ref(false);
const loading = ref(false);
const importingCsv = ref(false);
const importingHistoryExcel = ref(false);
const exportingExcel = ref(false);
const capturingZaloImage = ref(false);

const allTickets = ref<WarehouseInventoryTicket[]>([]);
const configs = ref<Record<WarehouseId, WarehouseConfig>>({
    'KHO 1': { warehouseId: 'KHO 1', initialStock: 0, initialDate: '', currentCustomer: 'GỖ BÌNH ĐỊNH', dailyRemarks: {} },
    'KHO 2': { warehouseId: 'KHO 2', initialStock: 0, initialDate: '', currentCustomer: 'GỖ BÌNH ĐỊNH', dailyRemarks: {} },
    'KHO 3': { warehouseId: 'KHO 3', initialStock: 0, initialDate: '', currentCustomer: 'GỖ BÌNH ĐỊNH', dailyRemarks: {} },
    'KHO 4': { warehouseId: 'KHO 4', initialStock: 0, initialDate: '', currentCustomer: 'EASTWOOD', dailyRemarks: {} }
});
const vehiclesMap = ref<Record<string, WarehouseVehicleMap>>({});

// Filter states
const filterFromDate = ref('');
const filterToDate = ref('');
const showDirectColumnInSingleFinal = ref(true);
const detailSearchQuery = ref('');
const detailFilterDate = ref('');

// Sidebar tree collapse state
const expandedCustomer = ref<Record<string, boolean>>({
    'EASTWOOD': true,
    'GBD': true
});

// Batch Vessel assignment for EXPORT tab
const batchVesselName = ref('');

// Config inline editing modal / panel
const showConfigModal = ref(false);
const editingConfigForm = ref<{
    warehouseId: WarehouseId;
    currentCustomer: string;
    initialStock: number;
    initialDate: string;
}>({
    warehouseId: 'KHO 4',
    currentCustomer: 'EASTWOOD',
    initialStock: 0,
    initialDate: ''
});

// Customer inline editing modal
const showEditCustomerModal = ref(false);
const editingCustomerGroup = ref<'KHO_4' | 'KHO_123'>('KHO_4');
const editingCustomerName = ref('');

// Ticket detail editing modal
const showEditTicketModal = ref(false);
const editingTicketForm = ref<WarehouseInventoryTicket | null>(null);
const editingTicketWeightsKg = ref<{
    grossKg: number;
    tareKg: number;
    netKg: number;
    factoryKg: number | '';
}>({
    grossKg: 0,
    tareKg: 0,
    netKg: 0,
    factoryKg: ''
});

function openEditCustomerModal(group: 'KHO_4' | 'KHO_123') {
    editingCustomerGroup.value = group;
    if (group === 'KHO_4') {
        editingCustomerName.value = configs.value['KHO 4']?.currentCustomer || 'EASTWOOD';
    } else {
        editingCustomerName.value = configs.value['KHO 1']?.currentCustomer || 'GỖ BÌNH ĐỊNH';
    }
    showEditCustomerModal.value = true;
}

async function saveCustomerNameModal() {
    const newName = sanitizeCustomerName(editingCustomerName.value.trim(), '');
    if (!newName) {
        addToast('Vui lòng nhập tên khách hàng hợp lệ', 'error');
        return;
    }

    try {
        if (editingCustomerGroup.value === 'KHO_4') {
            configs.value['KHO 4'].currentCustomer = newName;
            await WarehouseInventoryService.saveConfig(configs.value['KHO 4']);
        } else {
            configs.value['KHO 1'].currentCustomer = newName;
            configs.value['KHO 2'].currentCustomer = newName;
            configs.value['KHO 3'].currentCustomer = newName;
            await Promise.all([
                WarehouseInventoryService.saveConfig(configs.value['KHO 1']),
                WarehouseInventoryService.saveConfig(configs.value['KHO 2']),
                WarehouseInventoryService.saveConfig(configs.value['KHO 3'])
            ]);
        }
        showEditCustomerModal.value = false;
        await loadAllData();
        addToast(`Đã đổi tên khách hàng thành "${newName}"!`, 'success');
    } catch (err: any) {
        addToast('Lỗi lưu tên khách hàng: ' + (err?.message || err), 'error');
    }
}

// Active customer group
const activeCustomerGroup = computed<'KHO_4' | 'KHO_123'>(() => {
    return selectedWarehouseMode.value === 'KHO 4' ? 'KHO_4' : 'KHO_123';
});

// File inputs
const csvFileInput = ref<HTMLInputElement | null>(null);
const historyExcelFileInput = ref<HTMLInputElement | null>(null);

const activeSingleWarehouseId = computed<WarehouseId>(() => {
    if (selectedWarehouseMode.value === 'COMBINED_123') return 'KHO 1';
    return selectedWarehouseMode.value;
});

// Dropdown menu state for Delete options
const showDeleteMenu = ref(false);

const currentOperatingWarehouseName = computed(() => {
    if (selectedWarehouseMode.value === 'COMBINED_123') {
        const custName = configs.value['KHO 1']?.currentCustomer || 'GỖ BÌNH ĐỊNH';
        return `${custName} (Kho 1, 2, 3)`;
    }
    const whId = activeSingleWarehouseId.value;
    const custName = configs.value[whId]?.currentCustomer;
    return `${whId}${custName ? ` (${custName})` : ''}`;
});

async function loadAllData() {
    loading.value = true;
    try {
        const [loadedConfigs, loadedTickets, loadedVehicles] = await Promise.all([
            WarehouseInventoryService.getConfigs(),
            WarehouseInventoryService.getAllTickets(),
            WarehouseInventoryService.getVehicles()
        ]);
        configs.value = loadedConfigs;
        allTickets.value = loadedTickets;
        vehiclesMap.value = loadedVehicles;
    } catch (err: any) {
        console.error('Lỗi tải dữ liệu tồn kho:', err);
        addToast('Không thể tải dữ liệu tồn kho: ' + (err?.message || err), 'error');
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    loadAllData();
});

// Computed FINAL tables for each warehouse
const finalTablesByWarehouse = computed(() => {
    const opts = {
        fromDate: filterFromDate.value || undefined,
        toDate: filterToDate.value || undefined,
        includeDirectForCustomer: showDirectColumnInSingleFinal.value,
        allConfigs: configs.value
    };
    return {
        'KHO 1': computeWarehouseFinalTable('KHO 1', allTickets.value, configs.value['KHO 1'], opts),
        'KHO 2': computeWarehouseFinalTable('KHO 2', allTickets.value, configs.value['KHO 2'], opts),
        'KHO 3': computeWarehouseFinalTable('KHO 3', allTickets.value, configs.value['KHO 3'], opts),
        'KHO 4': computeWarehouseFinalTable('KHO 4', allTickets.value, configs.value['KHO 4'], opts)
    };
});

const activeFinalCalc = computed(() => {
    return finalTablesByWarehouse.value[activeSingleWarehouseId.value];
});

const closingStocksByWarehouse = computed<Record<WarehouseId, number>>(() => ({
    'KHO 1': finalTablesByWarehouse.value['KHO 1'].closingStockTons,
    'KHO 2': finalTablesByWarehouse.value['KHO 2'].closingStockTons,
    'KHO 3': finalTablesByWarehouse.value['KHO 3'].closingStockTons,
    'KHO 4': finalTablesByWarehouse.value['KHO 4'].closingStockTons
}));

// Filtered detail tickets for IMPORT, EXPORT, DIRECT tabs
const filteredDetailTickets = computed(() => {
    const whId = activeSingleWarehouseId.value;
    const q = detailSearchQuery.value.trim().toLowerCase();
    const dFilter = detailFilterDate.value;

    let list = allTickets.value.filter(t => {
        if (activeSheetTab.value === 'IMPORT') {
            return t.flowType === 'IMPORT' && t.warehouseId === whId;
        }
        if (activeSheetTab.value === 'EXPORT') {
            return t.flowType === 'EXPORT' && t.warehouseId === whId;
        }
        if (activeSheetTab.value === 'DIRECT') {
            return t.flowType === 'DIRECT' && getTicketCustomerGroup(t, configs.value) === activeCustomerGroup.value;
        }
        return false;
    });

    if (dFilter) {
        list = list.filter(t => t.reportDate === dFilter);
    }

    if (q) {
        list = list.filter(t =>
            (t.soPhieu || '').toLowerCase().includes(q) ||
            (t.vehiclePlate || '').toLowerCase().includes(q) ||
            (t.carrierName || '').toLowerCase().includes(q) ||
            (t.bargeInfo || '').toLowerCase().includes(q) ||
            (t.vesselName || '').toLowerCase().includes(q) ||
            (t.sourceOrRemark || '').toLowerCase().includes(q) ||
            (t.customerName || '').toLowerCase().includes(q)
        );
    }

    return list;
});

const detailTotalTons = computed(() => {
    return filteredDetailTickets.value.reduce((s, t) => s + (Number(t.netWeight) || 0), 0);
});

const detailTotalGrossTons = computed(() => {
    return filteredDetailTickets.value.reduce((s, t) => s + (Number(t.grossWeight) || 0), 0);
});

const detailTotalTareTons = computed(() => {
    return filteredDetailTickets.value.reduce((s, t) => s + (Number(t.tareWeight) || 0), 0);
});

const detailTotalFactoryTons = computed(() => {
    return filteredDetailTickets.value.reduce((s, t) => s + (Number(t.factoryWeight) || 0), 0);
});

const detailTotalDiffTons = computed(() => {
    return filteredDetailTickets.value.reduce(
        (s, t) => s + (t.factoryWeight ? (Number(t.netWeight) || 0) - Number(t.factoryWeight) : 0),
        0
    );
});

function getWarehouseThemeBg(whId: WarehouseId): string {
    if (whId === 'KHO 1') return 'bg-[#b4c6e7] text-[#1e293b]';
    if (whId === 'KHO 2') return 'bg-[#c6e0b4] text-[#1e293b]';
    if (whId === 'KHO 3') return 'bg-[#bdd7ee] text-[#1e293b]';
    return 'bg-[#d9e1f2] text-[#1e293b]';
}

function formatTons(val: number | undefined | null): string {
    const num = Number(val) || 0;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Display a ton value as integer kilograms (same unit as the template IMPORT sheet)
function formatKg(tons: number | undefined | null): string {
    const num = Number(tons) || 0;
    if (!num) return '-';
    return Math.round(num * 1000).toLocaleString('en-US');
}

type GbdSheetTab = 'FINAL' | 'IMPORT_1' | 'EXPORT_1' | 'IMPORT_2' | 'EXPORT_2' | 'IMPORT_3' | 'EXPORT_3' | 'DIRECT';

function isGbdTabActive(tab: GbdSheetTab): boolean {
    if (tab === 'FINAL') return activeSheetTab.value === 'FINAL';
    if (tab === 'IMPORT_1') return activeSheetTab.value === 'IMPORT' && activeSingleWarehouseId.value === 'KHO 1';
    if (tab === 'EXPORT_1') return activeSheetTab.value === 'EXPORT' && activeSingleWarehouseId.value === 'KHO 1';
    if (tab === 'IMPORT_2') return activeSheetTab.value === 'IMPORT' && activeSingleWarehouseId.value === 'KHO 2';
    if (tab === 'EXPORT_2') return activeSheetTab.value === 'EXPORT' && activeSingleWarehouseId.value === 'KHO 2';
    if (tab === 'IMPORT_3') return activeSheetTab.value === 'IMPORT' && activeSingleWarehouseId.value === 'KHO 3';
    if (tab === 'EXPORT_3') return activeSheetTab.value === 'EXPORT' && activeSingleWarehouseId.value === 'KHO 3';
    if (tab === 'DIRECT') return activeSheetTab.value === 'DIRECT';
    return false;
}

function selectGbdTab(tab: GbdSheetTab) {
    if (tab === 'FINAL') {
        selectedWarehouseMode.value = 'COMBINED_123';
        activeSheetTab.value = 'FINAL';
    } else if (tab === 'IMPORT_1') {
        selectedWarehouseMode.value = 'KHO 1';
        activeSheetTab.value = 'IMPORT';
    } else if (tab === 'EXPORT_1') {
        selectedWarehouseMode.value = 'KHO 1';
        activeSheetTab.value = 'EXPORT';
    } else if (tab === 'IMPORT_2') {
        selectedWarehouseMode.value = 'KHO 2';
        activeSheetTab.value = 'IMPORT';
    } else if (tab === 'EXPORT_2') {
        selectedWarehouseMode.value = 'KHO 2';
        activeSheetTab.value = 'EXPORT';
    } else if (tab === 'IMPORT_3') {
        selectedWarehouseMode.value = 'KHO 3';
        activeSheetTab.value = 'IMPORT';
    } else if (tab === 'EXPORT_3') {
        selectedWarehouseMode.value = 'KHO 3';
        activeSheetTab.value = 'EXPORT';
    } else if (tab === 'DIRECT') {
        activeSheetTab.value = 'DIRECT';
    }
}

async function onFactoryKgChange(t: WarehouseInventoryTicket, e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    const kg = Number(raw);
    t.factoryWeight = raw === '' || !kg ? null : Math.round(kg) / 1000;
    await handleUpdateTicketField(t);
}

// Trigger CSV import (supports multiple CSV/Excel files at once)
function triggerCsvImport() {
    csvFileInput.value?.click();
}

async function handleCsvFilesSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    importingCsv.value = true;
    try {
        const summary = await WarehouseInventoryService.importWeighbridgeCsvFiles(input.files);
        await loadAllData();

        if (summary.warehousesUpdated.length > 0 && selectedWarehouseMode.value !== 'COMBINED_123') {
            if (!summary.warehousesUpdated.includes(activeSingleWarehouseId.value)) {
                selectedWarehouseMode.value = summary.warehousesUpdated[0]!;
            }
        }

        const msgParts = [
            `Đã nạp ${summary.importedCount} phiếu vào Tồn kho (Nhập kho: ${summary.importFlowCount}, Xuất kho: ${summary.exportFlowCount}, Đi thẳng: ${summary.directFlowCount})`
        ];
        if (summary.syncedToAllocatorCount > 0) {
            msgParts.push(`Đã đồng bộ ${summary.syncedToAllocatorCount} phiếu vào Tab Phiếu Cân ở Dữ Liệu Cân Hàng`);
            emit('synced-to-allocator', {
                syncedTicketsCount: summary.syncedToAllocatorCount,
                matchedBargesCount: 0
            });
        }
        addToast(msgParts.join(' • '), 'success');
    } catch (err: any) {
        console.error('Lỗi nạp file CSV trạm cân:', err);
        addToast('Lỗi nạp file CSV: ' + (err?.message || err), 'error');
    } finally {
        importingCsv.value = false;
        input.value = '';
    }
}

// Trigger Historical Excel Bootstrap
function triggerHistoryExcelImport() {
    historyExcelFileInput.value?.click();
}

async function handleHistoryExcelSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    importingHistoryExcel.value = true;
    try {
        const summary = await WarehouseInventoryService.importHistoricalExcelWorkbook(
            file,
            activeSingleWarehouseId.value
        );
        await loadAllData();

        if (summary.warehousesUpdated.length >= 2) {
            selectedWarehouseMode.value = 'COMBINED_123';
        } else if (summary.warehousesUpdated.length === 1) {
            selectedWarehouseMode.value = summary.warehousesUpdated[0]!;
        }

        addToast(
            `Đã hút lịch sử từ "${file.name}": ${summary.importFlowCount} phiếu Nhập, ${summary.exportFlowCount} phiếu Xuất, ${summary.directFlowCount} Đi thẳng, ${summary.vehiclesLearnedCount} xe trong Data!`,
            'success'
        );
    } catch (err: any) {
        console.error('Lỗi nạp file Excel Tồn kho:', err);
        addToast('Lỗi nạp file Excel Tồn kho: ' + (err?.message || err), 'error');
    } finally {
        importingHistoryExcel.value = false;
        input.value = '';
    }
}

async function handleClearCurrentWarehouse() {
    showDeleteMenu.value = false;
    const whName = currentOperatingWarehouseName.value;
    if (!confirm(`Bạn có chắc chắn muốn XÓA DỮ LIỆU của ${whName} không?\n(Dữ liệu của các kho khác sẽ được giữ nguyên)`)) {
        return;
    }
    try {
        if (selectedWarehouseMode.value === 'COMBINED_123') {
            await WarehouseInventoryService.clearWarehouseTickets('GROUP_KHO123');
            await WarehouseInventoryService.clearWarehouseTickets('DIRECT_KHO123');
        } else if (activeSingleWarehouseId.value === 'KHO 4') {
            await WarehouseInventoryService.clearWarehouseTickets('KHO 4');
            await WarehouseInventoryService.clearWarehouseTickets('DIRECT_KHO4');
        } else {
            await WarehouseInventoryService.clearWarehouseTickets(activeSingleWarehouseId.value);
        }
        await loadAllData();
        addToast(`Đã xóa sạch dữ liệu của ${whName}!`, 'success');
    } catch (err: any) {
        addToast('Lỗi khi xóa dữ liệu: ' + (err?.message || err), 'error');
    }
}

async function handleClearAllWarehouses() {
    showDeleteMenu.value = false;
    if (!confirm('CẢNH BÁO: Bạn có chắc chắn muốn XÓA TẤT CẢ dữ liệu ở TẤT CẢ các kho (Kho 1, Kho 2, Kho 3, Kho 4 và Xá Thẳng) để làm lại từ đầu không?')) {
        return;
    }
    try {
        await WarehouseInventoryService.clearWarehouseTickets('ALL');
        await loadAllData();
        addToast('Đã xóa sạch toàn bộ dữ liệu ở tất cả các kho (Kho 1, 2, 3, 4 và Xá thẳng)!', 'success');
    } catch (err: any) {
        addToast('Lỗi khi xóa dữ liệu: ' + (err?.message || err), 'error');
    }
}

// Save daily remark inline on FINAL table
async function handleSaveDailyRemark(whId: WarehouseId, reportDate: string, newRemark: string) {
    const cfg = configs.value[whId];
    if (!cfg) return;
    if (!cfg.dailyRemarks) cfg.dailyRemarks = {};
    cfg.dailyRemarks[reportDate] = newRemark.trim();
    await WarehouseInventoryService.saveConfig(cfg);
    addToast(`Đã lưu ghi chú ngày ${formatIsoToDmy(reportDate)} cho ${whId}`, 'success');
}

function openEditConfigModal(whId?: WarehouseId) {
    const targetWh = whId || activeSingleWarehouseId.value;
    const cfg = configs.value[targetWh];
    editingConfigForm.value = {
        warehouseId: targetWh,
        currentCustomer: cfg.currentCustomer || '',
        initialStock: Number(cfg.initialStock) || 0,
        initialDate: cfg.initialDate || ''
    };
    showConfigModal.value = true;
}

async function saveConfigModal() {
    const f = editingConfigForm.value;
    const cfg = configs.value[f.warehouseId];
    const updated: WarehouseConfig = {
        ...cfg,
        warehouseId: f.warehouseId,
        currentCustomer: f.currentCustomer.trim(),
        initialStock: Number(f.initialStock) || 0,
        initialDate: f.initialDate
    };
    await WarehouseInventoryService.saveConfig(updated);
    configs.value[f.warehouseId] = updated;
    showConfigModal.value = false;
    addToast(`Đã cập nhật cấu hình ${f.warehouseId}!`, 'success');
}

// Inline update ticket fields (Factory Weight, Vessel Name, Carrier Name)
async function handleUpdateTicketField(ticket: WarehouseInventoryTicket) {
    await WarehouseInventoryService.updateTicket(ticket);
    addToast(`Đã cập nhật phiếu ${ticket.soPhieu || ticket.vehiclePlate}`, 'success');
}

async function handleDeleteTicket(ticket: WarehouseInventoryTicket) {
    if (!window.confirm(`Xóa phiếu cân ${ticket.soPhieu || ticket.vehiclePlate} (${ticket.netWeight} tấn)?`)) return;
    await WarehouseInventoryService.deleteTicket(ticket.id);
    allTickets.value = allTickets.value.filter(t => t.id !== ticket.id);
    addToast('Đã xóa phiếu cân khỏi tồn kho!', 'info');
}

function openEditTicketModal(ticket: WarehouseInventoryTicket) {
    editingTicketForm.value = JSON.parse(JSON.stringify(ticket));
    editingTicketWeightsKg.value = {
        grossKg: Math.round((Number(ticket.grossWeight) || 0) * 1000),
        tareKg: Math.round((Number(ticket.tareWeight) || 0) * 1000),
        netKg: Math.round((Number(ticket.netWeight) || 0) * 1000),
        factoryKg: ticket.factoryWeight !== null && ticket.factoryWeight !== undefined
            ? Math.round(Number(ticket.factoryWeight) * 1000)
            : ''
    };
    showEditTicketModal.value = true;
}

function onModalGrossOrTareChange() {
    if (!editingTicketForm.value) return;
    const g = Number(editingTicketWeightsKg.value.grossKg) || 0;
    const t = Number(editingTicketWeightsKg.value.tareKg) || 0;
    editingTicketWeightsKg.value.netKg = Math.round(g - t);
}

async function handleDeleteFromEditModal() {
    if (!editingTicketForm.value) return;
    const t = editingTicketForm.value;
    showEditTicketModal.value = false;
    await handleDeleteTicket(t);
}

async function saveEditTicketModal() {
    if (!editingTicketForm.value) return;
    try {
        const t = editingTicketForm.value;
        const gKg = Number(editingTicketWeightsKg.value.grossKg) || 0;
        const tKg = Number(editingTicketWeightsKg.value.tareKg) || 0;
        const nKg = editingTicketWeightsKg.value.netKg !== null && editingTicketWeightsKg.value.netKg !== undefined && (editingTicketWeightsKg.value.netKg as any) !== ''
            ? Number(editingTicketWeightsKg.value.netKg)
            : (gKg - tKg);

        t.grossWeight = Math.round(gKg) / 1000;
        t.tareWeight = Math.round(tKg) / 1000;
        t.netWeight = Math.round(nKg) / 1000;

        if (editingTicketWeightsKg.value.factoryKg !== null && editingTicketWeightsKg.value.factoryKg !== undefined && editingTicketWeightsKg.value.factoryKg !== '') {
            t.factoryWeight = Math.round(Number(editingTicketWeightsKg.value.factoryKg)) / 1000;
        } else {
            t.factoryWeight = null;
        }

        await WarehouseInventoryService.updateTicket(t);

        const idx = allTickets.value.findIndex(item => item.id === t.id);
        if (idx !== -1) {
            allTickets.value[idx] = { ...t };
        } else {
            allTickets.value.push({ ...t });
        }

        showEditTicketModal.value = false;
        editingTicketForm.value = null;
        addToast(`Đã lưu thay đổi phiếu ${t.soPhieu || t.vehiclePlate}!`, 'success');
    } catch (err: any) {
        console.error('Lỗi lưu phiếu cân:', err);
        addToast('Lỗi lưu phiếu cân: ' + (err?.message || err), 'error');
    }
}

async function handleBatchAssignVessel() {
    const vName = batchVesselName.value.trim();
    if (!vName) {
        addToast('Vui lòng nhập tên Tàu cần gán!', 'info');
        return;
    }
    const targetTickets = filteredDetailTickets.value;
    if (targetTickets.length === 0) {
        addToast('Không có phiếu xuất nào trong danh sách lọc hiện tại!', 'info');
        return;
    }
    for (const t of targetTickets) {
        t.vesselName = vName;
    }
    await WarehouseInventoryService.saveTicketsBulk(targetTickets);
    addToast(`Đã gán tàu "${vName}" cho ${targetTickets.length} chuyến xuất!`, 'success');
}

// Export Excel (.xlsx)
async function handleExportExcel() {
    exportingExcel.value = true;
    try {
        const opts = {
            fromDate: filterFromDate.value || undefined,
            toDate: filterToDate.value || undefined
        };
        const { buffer, filename } = activeCustomerGroup.value === 'KHO_4'
            ? await WarehouseInventoryService.exportSingleWarehouseWorkbook('KHO 4', opts)
            : await WarehouseInventoryService.exportCombined123WarehouseWorkbook(opts);

        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast(`Đã xuất file Excel "${filename}" thành công!`, 'success');
    } catch (err: any) {
        console.error('Lỗi xuất Excel tồn kho:', err);
        addToast('Lỗi xuất file Excel: ' + (err?.message || err), 'error');
    } finally {
        exportingExcel.value = false;
    }
}

/**
 * Render crisp, high-DPI PNG image of the FINAL table directly using HTML5 2D Canvas
 * matching the Excel FINAL report style (last 3 days up to the report date, black separator bar, and Total row).
 */
async function renderFinalTableToPngBlob(overrideWarehouseId?: WarehouseId): Promise<Blob> {
    const scale = 2; // Retina 2x resolution for Zalo
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const isCombined = !overrideWarehouseId && selectedWarehouseMode.value === 'COMBINED_123';
    const targetWarehouses: WarehouseId[] = isCombined
        ? ['KHO 1', 'KHO 2', 'KHO 3']
        : [overrideWarehouseId || activeSingleWarehouseId.value];

    const getBlockColWidths = (whId: WarehouseId): number[] => {
        const hasDirect = !isCombined && whId === 'KHO 4' && showDirectColumnInSingleFinal.value;
        return hasDirect
            ? [135, 130, 130, 135, 125, 125]
            : [135, 130, 130, 135, 125];
    };

    const getRecentRows = (whId: WarehouseId): WarehouseFinalRow[] => {
        const allRows = finalTablesByWarehouse.value[whId].rows;
        return allRows.slice(-3);
    };

    const maxDataRows = Math.max(
        ...targetWarehouses.map(whId => getRecentRows(whId).length),
        1
    );

    const padX = 12;
    const padY = 12;
    const gapW = 28; // Empty separator column between blocks when rendering 3 warehouses side-by-side

    const rowTitleH = 30;
    const rowSubTitleH = 24;
    const rowBlankH = 18;
    const rowInfoH = 22;
    const headerH = 42;
    const dataRowH = 28;
    const blackBarH = 13;
    const totalRowH = 30;

    const topSectionH = rowTitleH + rowSubTitleH + rowBlankH + rowInfoH * 3 + rowBlankH;
    const blockH = topSectionH + headerH + maxDataRows * dataRowH + blackBarH + totalRowH;

    const blockWidths = targetWarehouses.map(whId => getBlockColWidths(whId).reduce((a, b) => a + b, 0));
    const totalBlocksW = blockWidths.reduce((a, b) => a + b, 0) + (targetWarehouses.length - 1) * gapW;

    const logicalW = padX * 2 + totalBlocksW;
    const logicalH = padY * 2 + blockH;

    canvas.width = logicalW * scale;
    canvas.height = logicalH * scale;
    ctx.scale(scale, scale);

    // Pure white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, logicalW, logicalH);

    const drawGridCell = (x: number, y: number, w: number, h: number, stroke = '#e2e8f0', lineWidth = 0.7) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(x, y, w, h);
    };

    let currentBlockStartX = padX;

    targetWarehouses.forEach((whId, bIdx) => {
        const colWidths = getBlockColWidths(whId);
        const blockW = blockWidths[bIdx]!;
        const startX = currentBlockStartX;
        const cfg = configs.value[whId];
        const calc = finalTablesByWarehouse.value[whId];
        const recentRows = getRecentRows(whId);
        const hasDirect = !isCombined && whId === 'KHO 4' && showDirectColumnInSingleFinal.value;

        let curY = padY;

        // 1. Row: BÁO CÁO NHẬP- XUẤT KHO (Merged across block)
        drawGridCell(startX, curY, blockW, rowTitleH);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 20px "Cambria", "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BÁO CÁO NHẬP- XUẤT KHO', startX + blockW / 2, curY + rowTitleH / 2 + 1);
        curY += rowTitleH;

        // 2. Row: DAILY IMPORTED -EXPORTED  REPORT (Merged across block)
        drawGridCell(startX, curY, blockW, rowSubTitleH);
        ctx.fillStyle = '#000000';
        ctx.font = 'italic 15px "Cambria", "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DAILY IMPORTED -EXPORTED  REPORT', startX + blockW / 2, curY + rowSubTitleH / 2);
        curY += rowSubTitleH;

        // 3. Blank row with faint Excel cell gridlines
        let gx = startX;
        colWidths.forEach(w => {
            drawGridCell(gx, curY, w, rowBlankH);
            gx += w;
        });
        curY += rowBlankH;

        // 4-6. Info Rows: Nguồn gốc, Khách hàng, Loại hàng
        const infoRows: Array<[string, string]> = [
            ['Nguồn gốc (Origin):', `${whId} NGUYÊN NGỌC`],
            ['Khách hàng', cfg.currentCustomer || (whId === 'KHO 4' ? 'EASTWOOD' : 'GỖ BÌNH ĐỊNH')],
            ['Loại hàng:', 'VIÊN NÉN GỖ']
        ];

        infoRows.forEach(([label, val]) => {
            let cx = startX;
            colWidths.forEach(w => {
                drawGridCell(cx, curY, w, rowInfoH);
                cx += w;
            });
            ctx.fillStyle = '#000000';
            ctx.font = 'normal 13.5px "Cambria", "Times New Roman", serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, startX + 4, curY + rowInfoH / 2);
            ctx.fillText(val, startX + colWidths[0]! + 4, curY + rowInfoH / 2);
            curY += rowInfoH;
        });

        // 7. Blank row before table header
        gx = startX;
        colWidths.forEach(w => {
            drawGridCell(gx, curY, w, rowBlankH);
            gx += w;
        });
        curY += rowBlankH;

        // 8. Table Header Row (Sky-blue #84d0f0 with black borders)
        const headers: Array<string[]> = hasDirect
            ? [
                ['Ngày', 'Date'],
                [`NHẬP ${whId}`],
                [`XUẤT ${whId}`],
                ['Tồn cuối', 'Stock'],
                ['Xá thẳng', 'Direct'],
                ['Ghi chú', 'Remarks']
            ]
            : [
                ['Ngày', 'Date'],
                [`NHẬP ${whId}`],
                [`XUẤT ${whId}`],
                ['Tồn cuối', 'Stock'],
                ['Ghi chú', 'Remarks']
            ];

        let hx = startX;
        headers.forEach((lines, i) => {
            const w = colWidths[i]!;
            ctx.fillStyle = '#84d0f0';
            ctx.fillRect(hx, curY, w, headerH);
            drawGridCell(hx, curY, w, headerH, '#000000', 1);

            ctx.fillStyle = '#000000';
            ctx.font = 'bold 13px "Cambria", "Times New Roman", serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (lines.length === 1) {
                ctx.fillText(lines[0]!, hx + w / 2, curY + headerH / 2);
            } else {
                ctx.fillText(lines[0]!, hx + w / 2, curY + headerH / 2 - 8);
                ctx.fillText(lines[1]!, hx + w / 2, curY + headerH / 2 + 9);
            }
            hx += w;
        });
        curY += headerH;

        // 9. Data Rows (last 3 days up to report date)
        const aligns: Array<'center' | 'right' | 'left'> = hasDirect
            ? ['center', 'right', 'right', 'center', 'right', 'left']
            : ['center', 'right', 'right', 'center', 'left'];

        for (let rIdx = 0; rIdx < maxDataRows; rIdx++) {
            const r = recentRows[rIdx];
            const cells = r
                ? hasDirect
                    ? [
                        r.displayDate,
                        r.importTons !== 0 ? formatKg(r.importTons) : '-',
                        r.exportTons !== 0 ? formatKg(r.exportTons) : '-',
                        r.remainingStockTons !== 0 ? formatKg(r.remainingStockTons) : '0',
                        r.directTons !== 0 ? formatKg(r.directTons) : '-',
                        r.remark || ''
                    ]
                    : [
                        r.displayDate,
                        r.importTons !== 0 ? formatKg(r.importTons) : '-',
                        r.exportTons !== 0 ? formatKg(r.exportTons) : '-',
                        r.remainingStockTons !== 0 ? formatKg(r.remainingStockTons) : '0',
                        r.remark || ''
                    ]
                : colWidths.map(() => '');

            let dx = startX;
            cells.forEach((txt, i) => {
                const w = colWidths[i]!;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(dx, curY, w, dataRowH);
                drawGridCell(dx, curY, w, dataRowH, '#000000', 1);

                ctx.fillStyle = '#000000';
                ctx.font = 'normal 13.5px "Cambria", "Times New Roman", serif';
                const al = aligns[i]!;
                ctx.textAlign = al;
                ctx.textBaseline = 'middle';
                const tx = al === 'right' ? dx + w - 12 : al === 'left' ? dx + 8 : dx + w / 2;
                ctx.fillText(txt || '', tx, curY + dataRowH / 2, w - 14);
                dx += w;
            });
            curY += dataRowH;
        }

        // 10. Solid Black Separator Bar above Total Row
        ctx.fillStyle = '#000000';
        ctx.fillRect(startX, curY, blockW, blackBarH);
        drawGridCell(startX, curY, blockW, blackBarH, '#000000', 1);
        curY += blackBarH;

        // 11. Total Row: Tổng cộng (Total)
        const totalImpTons = calc.totalImportTons + (calc.openingStockBeforeFilter > 0 ? calc.openingStockBeforeFilter : 0);
        const totalCells = hasDirect
            ? [
                'Tổng cộng (Total)',
                totalImpTons !== 0 ? formatKg(totalImpTons) : '-',
                calc.totalExportTons !== 0 ? formatKg(calc.totalExportTons) : '-',
                '',
                calc.totalDirectTons !== 0 ? formatKg(calc.totalDirectTons) : '',
                ''
            ]
            : [
                'Tổng cộng (Total)',
                totalImpTons !== 0 ? formatKg(totalImpTons) : '-',
                calc.totalExportTons !== 0 ? formatKg(calc.totalExportTons) : '-',
                '',
                ''
            ];

        let tx = startX;
        totalCells.forEach((txt, i) => {
            const w = colWidths[i]!;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(tx, curY, w, totalRowH);
            drawGridCell(tx, curY, w, totalRowH, '#000000', 1);

            ctx.fillStyle = '#000000';
            ctx.font = 'bold 13.5px "Cambria", "Times New Roman", serif';
            const al = aligns[i]!;
            ctx.textAlign = al;
            ctx.textBaseline = 'middle';
            const textX = al === 'right' ? tx + w - 8 : al === 'left' ? tx + 8 : tx + w / 2;
            ctx.fillText(txt || '', textX, curY + totalRowH / 2, w - 12);
            tx += w;
        });

        currentBlockStartX += blockW + gapW;
    });

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Không thể tạo ảnh PNG'));
        }, 'image/png');
    });
}

async function handleCopyZaloImage(overrideWarehouseId?: WarehouseId | Event) {
    const whId = typeof overrideWarehouseId === 'string' ? overrideWarehouseId : undefined;
    capturingZaloImage.value = true;
    try {
        const blob = await renderFinalTableToPngBlob(whId);
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            const targetLabel = whId || (selectedWarehouseMode.value === 'COMBINED_123' ? 'Gộp Kho 1-2-3' : activeSingleWarehouseId.value);
            addToast(`Đã copy ảnh Báo cáo Nhập-Xuất Kho (${targetLabel}) 3 ngày gần nhất vào Clipboard! Nhấn Ctrl+V vào Zalo ngay.`, 'success');
        } else {
            await handleDownloadZaloImage(whId);
        }
    } catch (err: any) {
        console.warn('Clipboard write fallback to download:', err);
        await handleDownloadZaloImage(whId);
    } finally {
        capturingZaloImage.value = false;
    }
}

async function handleDownloadZaloImage(overrideWarehouseId?: WarehouseId) {
    capturingZaloImage.value = true;
    try {
        const blob = await renderFinalTableToPngBlob(overrideWarehouseId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const label = overrideWarehouseId
            ? overrideWarehouseId.replace(/\s+/g, '_')
            : selectedWarehouseMode.value === 'COMBINED_123'
                ? 'GOP_KHO_1_2_3'
                : selectedWarehouseMode.value.replace(/\s+/g, '_');
        a.href = url;
        a.download = `BAO_CAO_TON_KHO_${label}_ZALO.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast('Đã tải ảnh PNG Báo cáo Tồn kho gửi Zalo!', 'success');
    } catch (err: any) {
        addToast('Lỗi tạo ảnh PNG: ' + (err?.message || err), 'error');
    } finally {
        capturingZaloImage.value = false;
    }
}
</script>

<template>
    <div class="w-full h-full flex flex-col gap-3.5 font-display text-[#1e293b] min-h-0 overflow-y-auto md:overflow-hidden pb-4 md:pb-0">
        <!-- Hidden File Inputs -->
        <input
            ref="csvFileInput"
            type="file"
            multiple
            accept=".csv,.xlsx,.xls"
            class="hidden"
            @change="handleCsvFilesSelected"
        />
        <input
            ref="historyExcelFileInput"
            type="file"
            accept=".xlsx,.xls"
            class="hidden"
            @change="handleHistoryExcelSelected"
        />

        <!-- Main Master-Detail Work Area: Sidebar Tree + Content -->
        <div class="flex-1 flex flex-col md:flex-row gap-3.5 min-h-0 overflow-hidden">
            <!-- Sidebar: Tree Structure by Customer & Warehouses -->
            <aside class="w-full md:w-64 bg-white rounded-[24px] p-3 border border-primary/5 soft-shadow flex flex-col gap-2 shrink-0 overflow-y-auto">
                <!-- Tree Group 1: EASTWOOD (Kho 4) -->
                <div class="border rounded-2xl overflow-hidden border-slate-200/80 bg-slate-50/50">
                    <!-- Customer Node Header (Click to view Overview / FINAL Kho 4) -->
                    <div
                        @click="isVisualMapOpen = false; selectedWarehouseMode = 'KHO 4'; activeSheetTab = 'FINAL'"
                        :class="[
                            'p-2.5 flex items-center justify-between cursor-pointer select-none transition-all',
                            !isVisualMapOpen && selectedWarehouseMode === 'KHO 4' && activeSheetTab === 'FINAL'
                                ? 'bg-primary text-white shadow-sm font-black'
                                : 'hover:bg-slate-100/70 text-[#1e293b]'
                        ]"
                    >
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span
                                class="material-symbols-outlined text-base shrink-0"
                                :class="!isVisualMapOpen && selectedWarehouseMode === 'KHO 4' && activeSheetTab === 'FINAL' ? 'text-white' : 'text-primary'"
                            >
                                corporate_fare
                            </span>
                            <div class="min-w-0 flex items-center gap-1">
                                <span class="text-xs font-black truncate max-w-[100px]">
                                    {{ configs['KHO 4']?.currentCustomer || 'EASTWOOD' }}
                                </span>
                                <!-- Quick edit customer name button -->
                                <button
                                    @click.stop="openEditCustomerModal('KHO_4')"
                                    :class="[
                                        'size-5 rounded-md flex items-center justify-center shrink-0 cursor-pointer transition-colors',
                                        !isVisualMapOpen && selectedWarehouseMode === 'KHO 4' && activeSheetTab === 'FINAL'
                                            ? 'bg-white/20 hover:bg-white/30 text-white'
                                            : 'bg-primary/10 hover:bg-primary/20 text-primary'
                                    ]"
                                    title="Đổi tên khách hàng"
                                >
                                    <span class="material-symbols-outlined text-xs">edit</span>
                                </button>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <span
                                class="text-xs font-mono font-black"
                                :class="!isVisualMapOpen && selectedWarehouseMode === 'KHO 4' && activeSheetTab === 'FINAL' ? 'text-white' : 'text-primary'"
                            >
                                {{ formatTons(finalTablesByWarehouse['KHO 4'].closingStockTons) }} T
                            </span>
                            <button
                                @click.stop="expandedCustomer['EASTWOOD'] = !expandedCustomer['EASTWOOD']"
                                class="size-5 rounded flex items-center justify-center cursor-pointer hover:bg-black/10"
                                title="Đóng/mở nhánh"
                            >
                                <span
                                    class="material-symbols-outlined text-sm transition-transform"
                                    :class="[
                                        {'rotate-180': expandedCustomer['EASTWOOD']},
                                        !isVisualMapOpen && selectedWarehouseMode === 'KHO 4' && activeSheetTab === 'FINAL' ? 'text-white/80' : 'text-slate-400'
                                    ]"
                                >
                                    expand_more
                                </span>
                            </button>
                        </div>
                    </div>

                    <!-- Child Warehouses of EASTWOOD: Kho 4 with subdirectory_arrow_right -->
                    <div v-if="expandedCustomer['EASTWOOD']" class="bg-white p-1.5 flex flex-col gap-1 border-t border-slate-100">
                        <button
                            @click="isVisualMapOpen = false; selectedWarehouseMode = 'KHO 4'"
                            :class="[
                                'w-full px-2.5 py-1.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 pl-4',
                                !isVisualMapOpen && selectedWarehouseMode === 'KHO 4' && activeSheetTab !== 'FINAL'
                                    ? 'bg-primary text-white font-black shadow-sm'
                                    : 'hover:bg-slate-50 text-slate-700 font-bold'
                            ]"
                        >
                            <span class="flex items-center gap-1.5 text-xs truncate">
                                <span class="material-symbols-outlined text-xs">subdirectory_arrow_right</span>
                                <span>KHO 4</span>
                            </span>
                            <span
                                class="text-xs font-mono font-black shrink-0"
                                :class="!isVisualMapOpen && selectedWarehouseMode === 'KHO 4' && activeSheetTab !== 'FINAL' ? 'text-white' : 'text-slate-600'"
                            >
                                {{ formatTons(finalTablesByWarehouse['KHO 4'].closingStockTons) }} T
                            </span>
                        </button>
                    </div>
                </div>

                <!-- Tree Group 2: GỖ BÌNH ĐỊNH (Kho 1, 2, 3) -->
                <div class="border rounded-2xl overflow-hidden border-slate-200/80 bg-slate-50/50">
                    <!-- Customer Node Header (Click to view Combined overview Kho 1-2-3) -->
                    <div
                        @click="isVisualMapOpen = false; selectedWarehouseMode = 'COMBINED_123'; activeSheetTab = 'FINAL'"
                        :class="[
                            'p-2.5 flex items-center justify-between cursor-pointer select-none transition-all',
                            !isVisualMapOpen && selectedWarehouseMode === 'COMBINED_123'
                                ? 'bg-primary text-white shadow-sm font-black'
                                : 'hover:bg-slate-100/70 text-[#1e293b]'
                        ]"
                    >
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span
                                class="material-symbols-outlined text-base shrink-0"
                                :class="!isVisualMapOpen && selectedWarehouseMode === 'COMBINED_123' ? 'text-white' : 'text-primary'"
                            >
                                apartment
                            </span>
                            <div class="min-w-0 flex items-center gap-1">
                                <span class="text-xs font-black truncate max-w-[100px]">
                                    {{ configs['KHO 1']?.currentCustomer || 'GỖ BÌNH ĐỊNH' }}
                                </span>
                                <!-- Quick edit customer name button -->
                                <button
                                    @click.stop="openEditCustomerModal('KHO_123')"
                                    :class="[
                                        'size-5 rounded-md flex items-center justify-center shrink-0 cursor-pointer transition-colors',
                                        !isVisualMapOpen && selectedWarehouseMode === 'COMBINED_123'
                                            ? 'bg-white/20 hover:bg-white/30 text-white'
                                            : 'bg-primary/10 hover:bg-primary/20 text-primary'
                                    ]"
                                    title="Đổi tên khách hàng"
                                >
                                    <span class="material-symbols-outlined text-xs">edit</span>
                                </button>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <span
                                class="text-xs font-mono font-black"
                                :class="!isVisualMapOpen && selectedWarehouseMode === 'COMBINED_123' ? 'text-white' : 'text-primary'"
                            >
                                {{
                                    formatTons(
                                        finalTablesByWarehouse['KHO 1'].closingStockTons +
                                        finalTablesByWarehouse['KHO 2'].closingStockTons +
                                        finalTablesByWarehouse['KHO 3'].closingStockTons
                                    )
                                }} T
                            </span>
                            <button
                                @click.stop="expandedCustomer['GBD'] = !expandedCustomer['GBD']"
                                class="size-5 rounded flex items-center justify-center cursor-pointer hover:bg-black/10"
                                title="Đóng/mở nhánh"
                            >
                                <span
                                    class="material-symbols-outlined text-sm transition-transform"
                                    :class="[
                                        {'rotate-180': expandedCustomer['GBD']},
                                        !isVisualMapOpen && selectedWarehouseMode === 'COMBINED_123' ? 'text-white/80' : 'text-slate-400'
                                    ]"
                                >
                                    expand_more
                                </span>
                            </button>
                        </div>
                    </div>

                    <!-- Child Warehouses of GỖ BÌNH ĐỊNH: Kho 1, 2, 3 with subdirectory_arrow_right -->
                    <div v-if="expandedCustomer['GBD']" class="bg-white p-1.5 flex flex-col gap-1 border-t border-slate-100">
                        <!-- Individual Warehouse 1, 2, 3 Buttons -->
                        <button
                            v-for="whId in (['KHO 1', 'KHO 2', 'KHO 3'] as WarehouseId[])"
                            :key="whId"
                            @click="isVisualMapOpen = false; selectedWarehouseMode = whId"
                            :class="[
                                'w-full px-2.5 py-1.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 pl-4',
                                !isVisualMapOpen && selectedWarehouseMode === whId
                                    ? 'bg-primary text-white font-black shadow-sm'
                                    : 'hover:bg-slate-50 text-slate-700 font-bold'
                            ]"
                        >
                            <span class="flex items-center gap-1.5 text-xs truncate">
                                <span class="material-symbols-outlined text-xs">subdirectory_arrow_right</span>
                                <span>{{ whId }}</span>
                            </span>
                            <span class="text-xs font-mono font-black shrink-0" :class="!isVisualMapOpen && selectedWarehouseMode === whId ? 'text-white' : 'text-slate-600'">
                                {{ formatTons(finalTablesByWarehouse[whId].closingStockTons) }} T
                            </span>
                        </button>
                    </div>
                </div>

                <!-- Quick Help / Information -->
                <div class="mt-auto p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs text-slate-500 font-semibold flex flex-col gap-1">
                    <div class="font-bold text-slate-700 flex items-center gap-1">
                        <span class="material-symbols-outlined text-xs text-primary">info</span>
                        Quy tắc dữ liệu
                    </div>
                    <div>• <b>EASTWOOD</b>: Quản lý độc lập tại Kho 4.</div>
                    <div>• <b>GỖ BÌNH ĐỊNH</b>: Quản lý chung qua 3 Kho 1, 2, 3 và bảng Gộp.</div>
                </div>
            </aside>

            <!-- Main Content Area: Action Bar + Sheet Tabs + Tables -->
            <div class="flex-1 flex flex-col gap-3.5 min-h-0 overflow-hidden">
                <!-- VISUAL WAREHOUSE MAP MODE (Only opens when user explicitly clicks "Sơ đồ kho") -->
                <WarehouseVisualMap
                    v-if="isVisualMapOpen"
                    :configs="configs"
                    :closing-stocks="closingStocksByWarehouse"
                    @close="isVisualMapOpen = false"
                />

                <template v-else>
                <!-- Action & View Header Bar -->
                <div
                    class="bg-white rounded-[24px] px-4 py-3 border border-primary/5 soft-shadow shrink-0 flex flex-wrap items-center justify-between gap-3"
                >
                    <div class="flex items-center gap-2">
                        <div class="text-xs font-bold text-slate-400 uppercase">Đang xem</div>
                        <div class="text-sm font-black text-[#1e293b] flex items-center gap-1.5">
                            <span>{{ selectedWarehouseMode === 'COMBINED_123' ? 'GỘP KHO 1-2-3' : activeSingleWarehouseId }}</span>
                            <span class="text-primary">
                                ({{
                                    selectedWarehouseMode === 'COMBINED_123'
                                        ? (configs['KHO 1']?.currentCustomer || 'GỖ BÌNH ĐỊNH')
                                        : (configs[activeSingleWarehouseId]?.currentCustomer || 'Chưa gán')
                                }})
                            </span>
                            <button
                                v-if="selectedWarehouseMode !== 'COMBINED_123'"
                                @click="openEditConfigModal(activeSingleWarehouseId)"
                                class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                title="Sửa Tồn đầu kỳ & Tên khách hàng"
                            >
                                <span class="material-symbols-outlined text-sm">edit</span>
                            </button>
                        </div>
                    </div>

                    <!-- Primary Actions on the right -->
                    <div class="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            @click="isVisualMapOpen = true"
                            class="px-3.5 py-2 bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl text-xs hover:bg-primary/5 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="Mở Sơ đồ trực quan 4 Kho & Bãi Cont"
                        >
                            <span class="material-symbols-outlined text-sm text-primary">map</span>
                            <span>Sơ đồ kho</span>
                        </button>

                        <button
                            @click="triggerCsvImport"
                            :disabled="importingCsv"
                            class="px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold rounded-2xl text-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                            title="Chọn 1 hoặc 2 file CSV/Excel từ trạm cân (Nhập + Xuất)"
                        >
                            <span class="material-symbols-outlined text-sm">{{ importingCsv ? 'sync' : 'upload_file' }}</span>
                            <span>{{ importingCsv ? 'Đang import...' : 'Import' }}</span>
                        </button>

                        <button
                            @click="triggerHistoryExcelImport"
                            :disabled="importingHistoryExcel"
                            class="px-3.5 py-2 bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl text-xs hover:bg-primary/5 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                            title="Nạp từ file Excel Tồn kho đang dùng"
                        >
                            <span class="material-symbols-outlined text-sm">{{ importingHistoryExcel ? 'sync' : 'folder_open' }}</span>
                            <span>{{ importingHistoryExcel ? 'Đang hút lịch sử...' : 'Nạp từ Excel Tồn Kho Đang Dùng' }}</span>
                        </button>

                        <button
                            @click="handleCopyZaloImage"
                            :disabled="capturingZaloImage"
                            class="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-600 border border-teal-200 font-bold rounded-2xl text-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                            title="Chụp bảng FINAL độ nét cao vào bộ nhớ tạm để dán vào Zalo"
                        >
                            <span class="material-symbols-outlined text-sm">content_copy</span>
                            <span>{{ capturingZaloImage ? 'Đang tạo ảnh...' : 'Final' }}</span>
                        </button>

                        <button
                            @click="handleExportExcel()"
                            :disabled="exportingExcel"
                            class="px-4 py-2 bg-primary text-white font-bold rounded-full text-xs shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Xuất file báo cáo Excel"
                        >
                            <span class="material-symbols-outlined text-sm">download</span>
                            <span>{{ exportingExcel ? 'Đang export...' : 'Export' }}</span>
                        </button>

                        <!-- Delete Options Dropdown -->
                        <div class="relative inline-block">
                            <button
                                @click="showDeleteMenu = !showDeleteMenu"
                                class="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold rounded-2xl text-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                title="Tùy chọn xóa dữ liệu"
                            >
                                <span class="material-symbols-outlined text-sm font-bold">delete_forever</span>
                                <span>Delete all</span>
                                <span class="material-symbols-outlined text-xs transition-transform" :class="{ 'rotate-180': showDeleteMenu }">expand_more</span>
                            </button>

                            <!-- Backdrop for closing dropdown on outside click -->
                            <div
                                v-if="showDeleteMenu"
                                class="fixed inset-0 z-30"
                                @click="showDeleteMenu = false"
                            ></div>

                            <!-- Dropdown Menu -->
                            <div
                                v-if="showDeleteMenu"
                                class="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-40 flex flex-col overflow-hidden text-left"
                            >
                                <div class="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                    Chọn phạm vi xóa dữ liệu
                                </div>

                                <!-- Option 1: Xóa kho đang thao tác -->
                                <button
                                    type="button"
                                    @click="handleClearCurrentWarehouse"
                                    class="px-3.5 py-2.5 text-left hover:bg-amber-50/70 transition-colors flex items-start gap-2.5 cursor-pointer text-[#1e293b]"
                                >
                                    <span class="material-symbols-outlined text-amber-600 text-lg mt-0.5 shrink-0">delete_sweep</span>
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-xs font-black text-slate-800">1. Xóa kho đang thao tác</span>
                                        <span class="text-[11px] font-bold text-amber-700 truncate">{{ currentOperatingWarehouseName }}</span>
                                        <span class="text-[10px] text-slate-400 mt-0.5">Chỉ xóa phiếu và tồn đầu kho này, kho khác giữ nguyên</span>
                                    </div>
                                </button>

                                <div class="h-px bg-slate-100 my-1"></div>

                                <!-- Option 2: Xóa tất cả các kho -->
                                <button
                                    type="button"
                                    @click="handleClearAllWarehouses"
                                    class="px-3.5 py-2.5 text-left hover:bg-rose-50 transition-colors flex items-start gap-2.5 cursor-pointer text-[#1e293b]"
                                >
                                    <span class="material-symbols-outlined text-rose-600 text-lg mt-0.5 shrink-0">delete_forever</span>
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-xs font-black text-rose-600">2. Xóa tất cả các kho</span>
                                        <span class="text-[11px] font-bold text-rose-500">Kho 1, 2, 3, 4 & Xá thẳng</span>
                                        <span class="text-[10px] text-rose-400 mt-0.5">Xóa trắng toàn bộ dữ liệu làm lại từ đầu</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Card 3: Sheet Tabs + Main Table Content -->
                <div class="bg-white rounded-[24px] p-4 border border-primary/5 soft-shadow flex-1 flex flex-col gap-3 min-h-[460px] md:min-h-0 overflow-hidden">
                    <!-- Sheet Tabs Navigation -->
                    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 shrink-0">
                        <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                            <!-- KHO 4 (EASTWOOD): 4 Tabs (Import, Export, Final, Xá Thẳng) -->
                            <template v-if="activeCustomerGroup === 'KHO_4'">
                                <button
                                    @click="activeSheetTab = 'IMPORT'"
                                    :class="[
                                        'px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
                                        activeSheetTab === 'IMPORT'
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm">south_west</span>
                                    <span>IMPORT</span>
                                </button>

                                <button
                                    @click="activeSheetTab = 'EXPORT'"
                                    :class="[
                                        'px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
                                        activeSheetTab === 'EXPORT'
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm">north_east</span>
                                    <span>EXPORT</span>
                                </button>

                                <button
                                    @click="activeSheetTab = 'FINAL'"
                                    :class="[
                                        'px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
                                        activeSheetTab === 'FINAL'
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm">table_chart</span>
                                    <span>FINAL</span>
                                </button>

                                <button
                                    @click="activeSheetTab = 'DIRECT'"
                                    :class="[
                                        'px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
                                        activeSheetTab === 'DIRECT'
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm">bolt</span>
                                    <span>XÁ THẲNG</span>
                                </button>
                            </template>

                            <!-- GỖ BÌNH ĐỊNH (KHO 1, 2, 3): 8 Tabs matching the 8 Sheets in Excel 100% -->
                            <template v-else>
                                <button
                                    @click="selectGbdTab('FINAL')"
                                    :class="[
                                        'px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 shrink-0',
                                        isGbdTabActive('FINAL')
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm">table_chart</span>
                                    <span>FINAL</span>
                                </button>

                                <button
                                    @click="selectGbdTab('IMPORT_1')"
                                    :class="[
                                        'px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 shrink-0',
                                        isGbdTabActive('IMPORT_1')
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm">south_west</span>
                                    <span>IMPORT 1</span>
                                </button>

                                <button
                                    @click="selectGbdTab('EXPORT_1')"
                                    :class="[
                                        'px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 shrink-0',
                                        isGbdTabActive('EXPORT_1')
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm">north_east</span>
                                    <span>EXPORT 1</span>
                                </button>

                                <button
                                    @click="selectGbdTab('IMPORT_2')"
                                    :class="[
                                        'px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 shrink-0',
                                        isGbdTabActive('IMPORT_2')
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm">south_west</span>
                                    <span>IMPORT 2</span>
                                </button>

                                <button
                                    @click="selectGbdTab('EXPORT_2')"
                                    :class="[
                                        'px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 shrink-0',
                                        isGbdTabActive('EXPORT_2')
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm">north_east</span>
                                    <span>EXPORT 2</span>
                                </button>

                                <button
                                    @click="selectGbdTab('IMPORT_3')"
                                    :class="[
                                        'px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 shrink-0',
                                        isGbdTabActive('IMPORT_3')
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm">south_west</span>
                                    <span>IMPORT KHO 3</span>
                                </button>

                                <button
                                    @click="selectGbdTab('EXPORT_3')"
                                    :class="[
                                        'px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 shrink-0',
                                        isGbdTabActive('EXPORT_3')
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm">north_east</span>
                                    <span>EXPORT KH 3</span>
                                </button>

                                <button
                                    @click="selectGbdTab('DIRECT')"
                                    :class="[
                                        'px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 shrink-0',
                                        isGbdTabActive('DIRECT')
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm">bolt</span>
                                    <span>XÁ THẲNG</span>
                                </button>
                            </template>
                        </div>

                        <!-- Right contextual controls -->
                        <div class="flex items-center gap-2">
                            <label v-if="activeSheetTab === 'FINAL' && selectedWarehouseMode !== 'COMBINED_123'" class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer select-none ml-2">
                                <input
                                    v-model="showDirectColumnInSingleFinal"
                                    type="checkbox"
                                    class="rounded border-slate-300 text-primary focus:ring-primary"
                                />
                                <span>Hiển thị cột Xá thẳng</span>
                            </label>

                            <template v-if="activeSheetTab === 'IMPORT' || activeSheetTab === 'EXPORT' || activeSheetTab === 'DIRECT'">
                                <div class="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-xs font-black">
                                    {{ filteredDetailTickets.length }} chuyến • {{ formatKg(detailTotalTons) }} kg ({{ formatTons(detailTotalTons) }} Tấn)
                                </div>
                                <input
                                    v-model="detailFilterDate"
                                    type="date"
                                    class="h-7 px-2 bg-[#f1f5f9] border border-slate-200 rounded-lg text-xs font-semibold"
                                    title="Lọc theo ngày báo cáo (Ca 6h sáng)"
                                />
                                <input
                                    v-model="detailSearchQuery"
                                    type="text"
                                    placeholder="Tìm phiếu, số xe, nhà xe, sà lan..."
                                    class="h-7 px-3 bg-[#f1f5f9] border border-slate-200 rounded-lg text-xs font-semibold w-48"
                                />
                            </template>
                        </div>
                    </div>

            <!-- TAB 1A: SINGLE WAREHOUSE FINAL TABLE -->
            <div
                v-if="activeSheetTab === 'FINAL' && selectedWarehouseMode !== 'COMBINED_123'"
                class="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white"
            >
                <table class="w-full text-left border-collapse text-xs font-bold">
                    <thead
                        class="sticky top-0 z-10 text-[#1e293b] border-b border-slate-300"
                        :class="activeCustomerGroup === 'KHO_123' ? getWarehouseThemeBg(activeSingleWarehouseId) : 'bg-[#d9e1f2]'"
                    >
                        <tr v-if="activeCustomerGroup === 'KHO_123'">
                            <th class="py-2.5 px-3 text-center w-36 border-r border-slate-300">Ngày<br /><span class="font-semibold text-[10px]">Date</span></th>
                            <th class="py-2.5 px-3 text-right w-44 border-r border-slate-300">NHẬP KHO {{ activeSingleWarehouseId.replace('KHO ', '') }}</th>
                            <th class="py-2.5 px-3 text-right w-44 border-r border-slate-300">XUẤT KHO {{ activeSingleWarehouseId.replace('KHO ', '') }}</th>
                            <th class="py-2.5 px-3 text-right w-44 border-r border-slate-300 bg-teal-100/70 text-teal-900">Tồn cuối<br /><span class="font-semibold text-[10px]">Stock</span></th>
                            <th class="py-2.5 px-3 text-left">Ghi chú<br /><span class="font-semibold text-[10px]">Remarks</span></th>
                        </tr>
                        <tr v-else>
                            <th class="py-2.5 px-3 text-center w-32 border-r border-slate-300">Ngày<br /><span class="font-semibold text-[10px]">Date</span></th>
                            <th class="py-2.5 px-3 text-right w-40 border-r border-slate-300">Trọng lượng nhập<br /><span class="font-semibold text-[10px]">Imported weight</span></th>
                            <th class="py-2.5 px-3 text-right w-40 border-r border-slate-300">Trọng lượng xuất<br /><span class="font-semibold text-[10px]">Exported weight</span></th>
                            <th class="py-2.5 px-3 text-right w-40 border-r border-slate-300 bg-teal-100/70 text-teal-900">Tồn cuối<br /><span class="font-semibold text-[10px]">Stock</span></th>
                            <th v-if="showDirectColumnInSingleFinal" class="py-2.5 px-3 text-right w-36 border-r border-slate-300">Xá thẳng</th>
                            <th class="py-2.5 px-3 text-left">Ghi chú<br /><span class="font-semibold text-[10px]">Remarks</span></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
                        <!-- Opening Stock Row (shown only if openingStockBeforeFilter != 0 and not already represented as the first date row) -->
                        <tr
                            v-if="activeFinalCalc.openingStockBeforeFilter !== 0 && configs[activeSingleWarehouseId]?.initialDate !== activeFinalCalc.rows[0]?.reportDate"
                            class="bg-slate-50 font-black"
                        >
                            <td class="py-2 px-3 text-center text-slate-700 border-r border-slate-200">
                                {{ configs[activeSingleWarehouseId]?.initialDate ? formatIsoToDmy(configs[activeSingleWarehouseId].initialDate) : 'Tồn đầu' }}
                            </td>
                            <td class="py-2 px-3 text-right font-mono text-primary border-r border-slate-200">
                                {{ formatKg(activeFinalCalc.openingStockBeforeFilter) }}
                            </td>
                            <td class="py-2 px-3 text-right text-slate-400 border-r border-slate-200">-</td>
                            <td class="py-2 px-3 text-right font-mono text-teal-800 bg-teal-50/50 border-r border-slate-200">
                                {{ formatKg(activeFinalCalc.openingStockBeforeFilter) }}
                            </td>
                            <td v-if="showDirectColumnInSingleFinal && activeCustomerGroup === 'KHO_4'" class="py-2 px-3 text-right text-slate-400 border-r border-slate-200">-</td>
                            <td class="py-2 px-3 text-slate-500 italic">
                                {{ configs[activeSingleWarehouseId]?.initialDate ? `Tồn kho đến ${formatIsoToDmy(configs[activeSingleWarehouseId].initialDate)} (Theo báo cáo)` : 'Tồn đầu kỳ lũy kế' }}
                            </td>
                        </tr>

                        <tr
                            v-for="(row, idx) in activeFinalCalc.rows"
                            :key="row.reportDate"
                            class="hover:bg-gray-50 transition-colors"
                        >
                            <td class="py-2 px-3 text-center font-mono text-[#1e293b] border-r border-slate-200">
                                {{ row.displayDate }}
                            </td>
                            <td class="py-2 px-3 text-right font-mono text-primary border-r border-slate-200">
                                <template v-if="idx === 0 && activeFinalCalc.openingStockBeforeFilter > 0 && configs[activeSingleWarehouseId]?.initialDate === row.reportDate">
                                    {{ formatKg(row.importTons + activeFinalCalc.openingStockBeforeFilter) }}
                                </template>
                                <template v-else>
                                    {{ row.importTons > 0 ? formatKg(row.importTons) : '-' }}
                                </template>
                            </td>
                            <td class="py-2 px-3 text-right font-mono text-amber-700 border-r border-slate-200">
                                {{ row.exportTons > 0 ? formatKg(row.exportTons) : '-' }}
                            </td>
                            <td class="py-2 px-3 text-right font-mono font-black text-teal-800 bg-teal-50/40 border-r border-slate-200">
                                {{ row.remainingStockTons !== 0 ? formatKg(row.remainingStockTons) : '-' }}
                            </td>
                            <td v-if="showDirectColumnInSingleFinal && activeCustomerGroup === 'KHO_4'" class="py-2 px-3 text-right font-mono text-purple-700 border-r border-slate-200">
                                {{ row.directTons > 0 ? formatKg(row.directTons) : '-' }}
                            </td>
                            <td class="py-1.5 px-2">
                                <input
                                    type="text"
                                    :value="row.remark"
                                    placeholder=""
                                    @change="handleSaveDailyRemark(activeSingleWarehouseId, row.reportDate, ($event.target as HTMLInputElement).value)"
                                    class="w-full px-2 py-1 rounded-lg bg-transparent hover:bg-slate-100 focus:bg-white focus:border focus:border-primary text-xs font-semibold outline-none transition-all"
                                />
                            </td>
                        </tr>

                        <tr v-if="activeFinalCalc.rows.length === 0">
                            <td :colspan="(showDirectColumnInSingleFinal && activeCustomerGroup === 'KHO_4') ? 6 : 5" class="py-12 text-center text-slate-400 font-semibold">
                                Chưa có dữ liệu phát sinh cho {{ activeSingleWarehouseId }}. Hãy bấm <b>"Nạp CSV Trạm Cân"</b> hoặc <b>"Nạp từ Excel Tồn Kho Đang Dùng"</b> ở góc trên!
                            </td>
                        </tr>
                    </tbody>
                    <tfoot class="sticky bottom-0 bg-[#fff2cc] text-[#1e293b] font-black border-t-2 border-slate-400">
                        <tr>
                            <td class="py-2.5 px-3 text-center border-r border-slate-300">Tổng cộng (Total)</td>
                            <td class="py-2.5 px-3 text-right font-mono border-r border-slate-300">
                                {{ formatKg(activeFinalCalc.totalImportTons + (activeFinalCalc.openingStockBeforeFilter > 0 ? activeFinalCalc.openingStockBeforeFilter : 0)) }}
                            </td>
                            <td class="py-2.5 px-3 text-right font-mono border-r border-slate-300">
                                {{ formatKg(activeFinalCalc.totalExportTons) }}
                            </td>
                            <td class="py-2.5 px-3 text-right font-mono text-teal-900 border-r border-slate-300">
                                {{ formatKg(activeFinalCalc.closingStockTons) }}
                            </td>
                            <td v-if="showDirectColumnInSingleFinal && activeCustomerGroup === 'KHO_4'" class="py-2.5 px-3 text-right font-mono border-r border-slate-300">
                                {{ formatKg(activeFinalCalc.totalDirectTons) }}
                            </td>
                            <td class="py-2.5 px-3"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- TAB 1B: COMBINED 3-WAREHOUSE HORIZONTAL VIEW (KHO 1, KHO 2, KHO 3) -->
            <div
                v-else-if="activeSheetTab === 'FINAL' && selectedWarehouseMode === 'COMBINED_123'"
                class="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-slate-50/50 p-2"
            >
                <div class="grid grid-cols-1 xl:grid-cols-3 gap-3 min-w-[1200px]">
                    <div
                        v-for="whId in (['KHO 1', 'KHO 2', 'KHO 3'] as WarehouseId[])"
                        :key="whId"
                        class="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm"
                    >
                        <div
                            class="px-3 py-2 border-b border-slate-300 flex items-center justify-between gap-2"
                            :class="getWarehouseThemeBg(whId)"
                        >
                            <span class="text-xs font-black text-[#1e293b]">
                                {{ whId }} ({{ configs[whId]?.currentCustomer || 'GỖ BÌNH ĐỊNH' }})
                            </span>
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-black text-teal-900 font-mono">
                                    Tồn: {{ formatKg(finalTablesByWarehouse[whId].closingStockTons) }} kg
                                </span>
                                <button
                                    @click="handleCopyZaloImage(whId)"
                                    :disabled="capturingZaloImage"
                                    class="px-2.5 py-1 bg-[#f1f5f9] hover:bg-primary hover:text-white border border-soft-pink text-primary font-black rounded-xl text-xs transition-all whitespace-nowrap shadow-sm flex items-center gap-1 cursor-pointer"
                                    :title="`Copy ảnh báo cáo ${whId} (3 ngày gần nhất) để gửi Zalo`"
                                >
                                    <span class="material-symbols-outlined text-xs">content_copy</span>
                                    <span>Ảnh Zalo</span>
                                </button>
                            </div>
                        </div>
                        <table class="w-full text-left border-collapse text-xs font-bold whitespace-nowrap">
                            <thead class="bg-slate-100 text-slate-700 border-b border-slate-300">
                                <tr>
                                    <th class="py-2 px-2 text-center border-r border-slate-200">Ngày</th>
                                    <th class="py-2 px-2 text-right border-r border-slate-200">Nhập</th>
                                    <th class="py-2 px-2 text-right border-r border-slate-200">Xuất</th>
                                    <th class="py-2 px-2 text-right border-r border-slate-200 bg-teal-50">Tồn kho</th>
                                    <th class="py-2 px-2">Ghi chú</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                <tr class="bg-slate-50 font-black">
                                    <td class="py-1.5 px-2 text-center border-r border-slate-200">Tồn đầu</td>
                                    <td class="py-1.5 px-2 text-right border-r border-slate-200">-</td>
                                    <td class="py-1.5 px-2 text-right border-r border-slate-200">-</td>
                                    <td class="py-1.5 px-2 text-right font-mono border-r border-slate-200 bg-teal-50/40">
                                        {{ formatKg(finalTablesByWarehouse[whId].openingStockBeforeFilter) }}
                                    </td>
                                    <td class="py-1.5 px-2"></td>
                                </tr>
                                <tr
                                    v-for="r in finalTablesByWarehouse[whId].rows"
                                    :key="r.reportDate"
                                    class="hover:bg-gray-50"
                                >
                                    <td class="py-1.5 px-2 text-center font-mono border-r border-slate-200">{{ r.displayDate }}</td>
                                    <td class="py-1.5 px-2 text-right font-mono text-primary border-r border-slate-200">
                                        {{ r.importTons > 0 ? formatKg(r.importTons) : '-' }}
                                    </td>
                                    <td class="py-1.5 px-2 text-right font-mono text-amber-700 border-r border-slate-200">
                                        {{ r.exportTons > 0 ? formatKg(r.exportTons) : '-' }}
                                    </td>
                                    <td class="py-1.5 px-2 text-right font-mono font-black text-teal-800 bg-teal-50/30 border-r border-slate-200">
                                        {{ formatKg(r.remainingStockTons) }}
                                    </td>
                                    <td class="py-1 px-1.5">
                                        <input
                                            type="text"
                                            :value="r.remark"
                                            @change="handleSaveDailyRemark(whId, r.reportDate, ($event.target as HTMLInputElement).value)"
                                            class="w-full px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                        />
                                    </td>
                                </tr>
                            </tbody>
                            <tfoot class="bg-[#fff2cc] font-black border-t border-slate-300">
                                <tr>
                                    <td class="py-2 px-2 text-center border-r border-slate-300">TỔNG CỘNG</td>
                                    <td class="py-2 px-2 text-right font-mono border-r border-slate-300">
                                        {{ formatKg(finalTablesByWarehouse[whId].totalImportTons) }}
                                    </td>
                                    <td class="py-2 px-2 text-right font-mono border-r border-slate-300">
                                        {{ formatKg(finalTablesByWarehouse[whId].totalExportTons) }}
                                    </td>
                                    <td class="py-2 px-2 text-right font-mono text-teal-900 border-r border-slate-300">
                                        {{ formatKg(finalTablesByWarehouse[whId].closingStockTons) }}
                                    </td>
                                    <td class="py-2 px-2"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            <!-- TAB 2: IMPORT SHEET DETAILS -->
            <div
                v-else-if="activeSheetTab === 'IMPORT'"
                class="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white"
            >
                <!-- KHO 1-2-3 (GỖ BÌNH ĐỊNH) 18-COLUMN IMPORT TABLE -->
                <table v-if="activeCustomerGroup === 'KHO_123'" class="w-full text-left border-collapse text-xs font-bold whitespace-nowrap">
                    <thead class="sticky top-0 z-10 bg-[#92d050] text-[#1e293b] border-b border-slate-300">
                        <tr>
                            <th class="py-2.5 px-2 text-center w-12 border-r border-slate-300">STT<br /><span class="font-semibold text-[10px]">(No)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày nhập<br /><span class="font-semibold text-[10px]">Date</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Số phiếu<br /><span class="font-semibold text-[10px]">(Serial)</span></th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Số xe<br /><span class="font-semibold text-[10px]">(Truck no)</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng vào<br /><span class="font-semibold text-[10px]">(Weight in)</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng ra<br /><span class="font-semibold text-[10px]">(Weight out)</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng hàng<br /><span class="font-semibold text-[10px]">(N.Weight)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Nhập/Xuất<br /><span class="font-semibold text-[10px]">(In/Out)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Kho<br /><span class="font-semibold text-[10px]">(Warehouse)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày cân vào</th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày cân ra</th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">Cân nhà máy</th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">Chênh lệch</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Nơi Nhận</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">TÊN KHO</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">KHU VỰC</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Nhà xe</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Ghi chú</th>
                            <th class="py-2.5 px-2 text-center w-20">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr
                            v-for="(t, idx) in filteredDetailTickets"
                            :key="t.id"
                            class="hover:bg-gray-50 transition-colors"
                        >
                            <td class="py-2 px-2 text-center text-slate-400">{{ idx + 1 }}</td>
                            <td class="py-2 px-2 text-center font-mono">{{ formatIsoToDmy(t.reportDate) }}</td>
                            <td class="py-2 px-2 text-center font-mono text-slate-600">{{ t.soPhieu }}</td>
                            <td class="py-2 px-2 font-mono font-black">{{ t.vehiclePlate }}</td>
                            <td class="py-2 px-2 text-right font-mono text-slate-600">{{ formatKg(t.grossWeight) }}</td>
                            <td class="py-2 px-2 text-right font-mono text-slate-600">{{ formatKg(t.tareWeight) }}</td>
                            <td class="py-2 px-2 text-right font-mono text-primary font-black">{{ formatKg(t.netWeight) }}</td>
                            <td class="py-2 px-2 text-center text-slate-600">{{ t.maLenh || 'Nhập' }}</td>
                            <td class="py-2 px-2 text-center">Kho {{ activeSingleWarehouseId.replace('KHO ', '') }}</td>
                            <td class="py-2 px-2 text-center font-mono text-slate-500">{{ t.weighInTime || '-' }}</td>
                            <td class="py-2 px-2 text-center font-mono text-slate-500">{{ t.weighOutTime || '-' }}</td>
                            <td class="py-2 px-2 text-right">
                                <input
                                    :value="t.factoryWeight ? Math.round(t.factoryWeight * 1000) : ''"
                                    type="number"
                                    step="10"
                                    placeholder="-"
                                    @change="onFactoryKgChange(t, $event)"
                                    class="w-20 px-1.5 py-0.5 text-right rounded bg-slate-50 border border-slate-200 font-mono text-xs"
                                />
                            </td>
                            <td class="py-2 px-2 text-right font-mono" :class="t.factoryWeight ? (t.netWeight - t.factoryWeight < 0 ? 'text-rose-600' : 'text-teal-600') : 'text-slate-400'">
                                {{ t.factoryWeight ? formatKg(t.netWeight - t.factoryWeight) : '-' }}
                            </td>
                            <td class="py-2 px-2">
                                <input
                                    v-model="t.sourceOrRemark"
                                    type="text"
                                    placeholder="Nơi nhận..."
                                    @change="handleUpdateTicketField(t)"
                                    class="w-32 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2">
                                <input
                                    v-model="t.originWarehouseName"
                                    type="text"
                                    placeholder="Tên kho..."
                                    @change="handleUpdateTicketField(t)"
                                    class="w-28 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2">
                                <input
                                    v-model="t.originArea"
                                    type="text"
                                    placeholder="Khu vực..."
                                    @change="handleUpdateTicketField(t)"
                                    class="w-28 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2">
                                <input
                                    v-model="t.carrierName"
                                    type="text"
                                    placeholder="-"
                                    @change="handleUpdateTicketField(t)"
                                    class="w-24 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-bold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2">
                                <input
                                    v-model="t.rawNote"
                                    type="text"
                                    placeholder="-"
                                    @change="handleUpdateTicketField(t)"
                                    class="w-28 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2 text-center">
                                <div class="inline-flex items-center gap-1 justify-center">
                                    <button
                                        @click="openEditTicketModal(t)"
                                        class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary inline-flex items-center justify-center cursor-pointer transition-all active:scale-95"
                                        title="Sửa phiếu cân"
                                    >
                                        <span class="material-symbols-outlined text-sm">edit</span>
                                    </button>
                                    <button
                                        @click="handleDeleteTicket(t)"
                                        class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 inline-flex items-center justify-center cursor-pointer transition-all active:scale-95"
                                        title="Xóa phiếu cân"
                                    >
                                        <span class="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot class="sticky bottom-0 bg-[#92d050] border-t-2 border-slate-300 font-black text-[#1e293b]">
                        <tr>
                            <td colspan="4" class="py-2.5 px-2 text-center border-r border-slate-300">
                                Tổng cộng (Total): {{ filteredDetailTickets.length }} chuyến
                            </td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalGrossTons) }}</td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalTareTons) }}</td>
                            <td class="py-2.5 px-2 text-right font-mono text-primary border-r border-slate-300">{{ formatKg(detailTotalTons) }}</td>
                            <td colspan="4" class="py-2.5 px-2 border-r border-slate-300"></td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalFactoryTons) }}</td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300" :class="detailTotalDiffTons < 0 ? 'text-rose-600' : 'text-teal-700'">
                                {{ formatKg(detailTotalDiffTons) }}
                            </td>
                            <td colspan="6" class="py-2.5 px-2"></td>
                        </tr>
                    </tfoot>
                </table>

                <!-- KHO 4 (EASTWOOD) ORIGINAL 15-COLUMN IMPORT TABLE -->
                <table v-else class="w-full text-left border-collapse text-xs font-bold whitespace-nowrap">
                    <thead class="sticky top-0 z-10 bg-[#c6e0b4] text-[#1e293b] border-b border-slate-300">
                        <tr>
                            <th class="py-2.5 px-2 text-center w-12 border-r border-slate-300">STT<br /><span class="font-semibold text-[10px]">(No)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày nhập<br /><span class="font-semibold text-[10px]">Date</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Số phiếu<br /><span class="font-semibold text-[10px]">(Serial)</span></th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Số xe<br /><span class="font-semibold text-[10px]">(Truck no)</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng vào<br /><span class="font-semibold text-[10px]">(Weight in)</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng ra<br /><span class="font-semibold text-[10px]">(Weight out)</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng hàng<br /><span class="font-semibold text-[10px]">(N.Weight)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày cân vào</th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày cân ra</th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">Cân Nhà Máy</th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">Chênh lệch</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Ghi chú</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Ghi chú 2</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Nhà xe</th>
                            <th class="py-2.5 px-2 text-center w-20">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr
                            v-for="(t, idx) in filteredDetailTickets"
                            :key="t.id"
                            class="hover:bg-gray-50 transition-colors"
                        >
                            <td class="py-2 px-2 text-center text-slate-400">{{ idx + 1 }}</td>
                            <td class="py-2 px-2 text-center font-mono">{{ formatIsoToDmy(t.reportDate) }}</td>
                            <td class="py-2 px-2 text-center font-mono text-slate-600">{{ t.soPhieu }}</td>
                            <td class="py-2 px-2 font-mono font-black">{{ t.vehiclePlate }}</td>
                            <td class="py-2 px-2 text-right font-mono text-slate-600">{{ formatKg(t.grossWeight) }}</td>
                            <td class="py-2 px-2 text-right font-mono text-slate-600">{{ formatKg(t.tareWeight) }}</td>
                            <td class="py-2 px-2 text-right font-mono text-primary font-black">{{ formatKg(t.netWeight) }}</td>
                            <td class="py-2 px-2 text-center font-mono text-slate-500">{{ t.weighInTime || '-' }}</td>
                            <td class="py-2 px-2 text-center font-mono text-slate-500">{{ t.weighOutTime || '-' }}</td>
                            <td class="py-2 px-2 text-right">
                                <input
                                    :value="t.factoryWeight ? Math.round(t.factoryWeight * 1000) : ''"
                                    type="number"
                                    step="10"
                                    placeholder="-"
                                    @change="onFactoryKgChange(t, $event)"
                                    class="w-20 px-1.5 py-0.5 text-right rounded bg-slate-50 border border-slate-200 font-mono text-xs"
                                />
                            </td>
                            <td class="py-2 px-2 text-right font-mono" :class="t.factoryWeight ? (t.netWeight - t.factoryWeight < 0 ? 'text-rose-600' : 'text-teal-600') : 'text-slate-400'">
                                {{ t.factoryWeight ? formatKg(t.netWeight - t.factoryWeight) : '-' }}
                            </td>
                            <td class="py-2 px-2">
                                <input
                                    v-model="t.sourceOrRemark"
                                    type="text"
                                    @change="handleUpdateTicketField(t)"
                                    class="w-32 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2">
                                <input
                                    v-model="t.rawNote"
                                    type="text"
                                    placeholder="-"
                                    @change="handleUpdateTicketField(t)"
                                    class="w-28 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2">
                                <input
                                    v-model="t.carrierName"
                                    type="text"
                                    placeholder="-"
                                    @change="handleUpdateTicketField(t)"
                                    class="w-24 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-bold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2 text-center">
                                <div class="inline-flex items-center gap-1 justify-center">
                                    <button
                                        @click="openEditTicketModal(t)"
                                        class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary inline-flex items-center justify-center cursor-pointer transition-all active:scale-95"
                                        title="Sửa phiếu cân"
                                    >
                                        <span class="material-symbols-outlined text-sm">edit</span>
                                    </button>
                                    <button
                                        @click="handleDeleteTicket(t)"
                                        class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 inline-flex items-center justify-center cursor-pointer transition-all active:scale-95"
                                        title="Xóa phiếu cân"
                                    >
                                        <span class="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot class="sticky bottom-0 bg-[#c6e0b4] border-t-2 border-slate-300 font-black text-[#1e293b]">
                        <tr>
                            <td colspan="4" class="py-2.5 px-2 text-center border-r border-slate-300">
                                Tổng cộng (Total): {{ filteredDetailTickets.length }} chuyến
                            </td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalGrossTons) }}</td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalTareTons) }}</td>
                            <td class="py-2.5 px-2 text-right font-mono text-primary border-r border-slate-300">{{ formatKg(detailTotalTons) }}</td>
                            <td colspan="2" class="py-2.5 px-2 border-r border-slate-300"></td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalFactoryTons) }}</td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300" :class="detailTotalDiffTons < 0 ? 'text-rose-600' : 'text-teal-700'">
                                {{ formatKg(detailTotalDiffTons) }}
                            </td>
                            <td colspan="4" class="py-2.5 px-2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- TAB 3: EXPORT SHEET DETAILS -->
            <div
                v-else-if="activeSheetTab === 'EXPORT'"
                class="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden"
            >
                <!-- Quick Batch Vessel Bar (Only for Kho 4 where Vessel is actively tracked on scale) -->
                <div v-if="activeCustomerGroup === 'KHO_4'" class="flex flex-wrap items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 shrink-0 text-xs">
                    <span class="font-bold text-slate-600">Gán nhanh tên Tàu mẹ cho các chuyến đang lọc:</span>
                    <input
                        v-model="batchVesselName"
                        type="text"
                        placeholder="VD: MV. HENG SHUN - BẮC VÂN PHONG"
                        class="h-7 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold w-64"
                    />
                    <button
                        @click="handleBatchAssignVessel"
                        class="px-3.5 py-1.5 bg-primary text-white font-bold rounded-full text-xs shadow-[0_3px_0_0_#6495ed] hover:translate-y-[1px] hover:shadow-[0_1px_0_0_#6495ed] active:translate-y-[3px] active:shadow-none transition-all cursor-pointer"
                    >
                        Gán cho {{ filteredDetailTickets.length }} chuyến
                    </button>
                </div>

                <div class="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white">
                    <!-- KHO 1-2-3 (GỖ BÌNH ĐỊNH) 14-COLUMN EXPORT TABLE -->
                    <table v-if="activeCustomerGroup === 'KHO_123'" class="w-full text-left border-collapse text-xs font-bold whitespace-nowrap">
                        <thead class="sticky top-0 z-10 bg-[#92d050] text-[#1e293b] border-b border-slate-300">
                            <tr>
                                <th class="py-2.5 px-2 text-center w-12 border-r border-slate-300">STT<br /><span class="font-semibold text-[10px]">(No)</span></th>
                                <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày xuất<br /><span class="font-semibold text-[10px]">(Date)</span></th>
                                <th class="py-2.5 px-2 text-center border-r border-slate-300">Số phiếu<br /><span class="font-semibold text-[10px]">(Serial)</span></th>
                                <th class="py-2.5 px-2 border-r border-slate-300">Số xe<br /><span class="font-semibold text-[10px]">(Truck no)</span></th>
                                <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng vào<br /><span class="font-semibold text-[10px]">(Weight in)</span></th>
                                <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng ra<br /><span class="font-semibold text-[10px]">(Weight out)</span></th>
                                <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng hàng<br /><span class="font-semibold text-[10px]">(N.Weight)</span></th>
                                <th class="py-2.5 px-2 text-center border-r border-slate-300">Nhập/Xuất<br /><span class="font-semibold text-[10px]">(In/Out)</span></th>
                                <th class="py-2.5 px-2 text-center border-r border-slate-300">Kho<br /><span class="font-semibold text-[10px]">(Warehouse)</span></th>
                                <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày cân vào</th>
                                <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày cân ra</th>
                                <th class="py-2.5 px-2 border-r border-slate-300">Salan</th>
                                <th class="py-2.5 px-2 border-r border-slate-300">Ghi chú</th>
                                <th class="py-2.5 px-2 border-r border-slate-300">Nhà xe</th>
                                <th class="py-2.5 px-2 text-center w-20">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr
                                v-for="(t, idx) in filteredDetailTickets"
                                :key="t.id"
                                class="hover:bg-gray-50 transition-colors"
                            >
                                <td class="py-2 px-2 text-center text-slate-400">{{ idx + 1 }}</td>
                                <td class="py-2 px-2 text-center font-mono">{{ formatIsoToDmy(t.reportDate) }}</td>
                                <td class="py-2 px-2 text-center font-mono text-slate-600">{{ t.soPhieu }}</td>
                                <td class="py-2 px-2 font-mono font-black">{{ t.vehiclePlate }}</td>
                                <td class="py-2 px-2 text-right font-mono text-slate-600">{{ formatKg(t.grossWeight) }}</td>
                                <td class="py-2 px-2 text-right font-mono text-slate-600">{{ formatKg(t.tareWeight) }}</td>
                                <td class="py-2 px-2 text-right font-mono text-amber-700 font-black">{{ formatKg(t.netWeight) }}</td>
                                <td class="py-2 px-2 text-center text-slate-600">{{ t.maLenh || 'Xuất' }}</td>
                                <td class="py-2 px-2 text-center">{{ t.sourceOrRemark || `Kho ${activeSingleWarehouseId.replace('KHO ', '')}` }}</td>
                                <td class="py-2 px-2 text-center font-mono text-slate-500">{{ t.weighInTime || '-' }}</td>
                                <td class="py-2 px-2 text-center font-mono text-slate-500">{{ t.weighOutTime || '-' }}</td>
                                <td class="py-2 px-2 text-teal-700">
                                    <input
                                        v-model="t.bargeInfo"
                                        type="text"
                                        placeholder="-"
                                        @change="handleUpdateTicketField(t)"
                                        class="w-28 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                    />
                                </td>
                                <td class="py-2 px-2">
                                    <input
                                        v-model="t.rawNote"
                                        type="text"
                                        placeholder="-"
                                        @change="handleUpdateTicketField(t)"
                                        class="w-36 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                    />
                                </td>
                                <td class="py-2 px-2">
                                    <input
                                        v-model="t.carrierName"
                                        type="text"
                                        placeholder="-"
                                        @change="handleUpdateTicketField(t)"
                                        class="w-24 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-bold outline-none"
                                    />
                                </td>
                                <td class="py-2 px-2 text-center">
                                    <div class="inline-flex items-center gap-1 justify-center">
                                        <button
                                            @click="openEditTicketModal(t)"
                                            class="size-7 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 inline-flex items-center justify-center cursor-pointer transition-colors"
                                            title="Sửa phiếu cân"
                                        >
                                            <span class="material-symbols-outlined text-sm">edit</span>
                                        </button>
                                        <button
                                            @click="handleDeleteTicket(t)"
                                            class="size-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 inline-flex items-center justify-center cursor-pointer transition-colors"
                                            title="Xóa phiếu cân"
                                        >
                                            <span class="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                        <tfoot class="sticky bottom-0 bg-[#d9d9d9] border-t-2 border-slate-300 font-black text-[#1e293b]">
                            <tr>
                                <td colspan="4" class="py-2.5 px-2 text-center border-r border-slate-300">
                                    TỔNG CỘNG: {{ filteredDetailTickets.length }} chuyến
                                </td>
                                <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalGrossTons) }}</td>
                                <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalTareTons) }}</td>
                                <td class="py-2.5 px-2 text-right font-mono text-amber-800 border-r border-slate-300">{{ formatKg(detailTotalTons) }}</td>
                                <td colspan="8" class="py-2.5 px-2"></td>
                            </tr>
                        </tfoot>
                    </table>

                    <!-- KHO 4 (EASTWOOD) ORIGINAL 15-COLUMN EXPORT TABLE -->
                    <table v-else class="w-full text-left border-collapse text-xs font-bold whitespace-nowrap">
                        <thead class="sticky top-0 z-10 bg-[#d8e4bc] text-[#1e293b] border-b border-slate-300">
                            <tr>
                                <th class="py-2.5 px-2 text-center w-12 border-r border-slate-300">STT<br /><span class="font-semibold text-[10px]">(No)</span></th>
                                <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày xuất<br /><span class="font-semibold text-[10px]">(Date)</span></th>
                                <th class="py-2.5 px-2 text-center border-r border-slate-300">Số phiếu<br /><span class="font-semibold text-[10px]">(Serial)</span></th>
                                <th class="py-2.5 px-2 border-r border-slate-300">Số xe<br /><span class="font-semibold text-[10px]">(Truck no)</span></th>
                                <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng vào<br /><span class="font-semibold text-[10px]">(Weight in)</span></th>
                                <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng ra<br /><span class="font-semibold text-[10px]">(Weight out)</span></th>
                                <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng hàng<br /><span class="font-semibold text-[10px]">(N.Weight)</span></th>
                                <th class="py-2.5 px-2 text-center border-r border-slate-300">Nhập/Xuất<br /><span class="font-semibold text-[10px]">(In/Out)</span></th>
                                <th class="py-2.5 px-2 text-center border-r border-slate-300">Kho<br /><span class="font-semibold text-[10px]">(Warehouse)</span></th>
                                <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày cân vào</th>
                                <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày cân ra</th>
                                <th class="py-2.5 px-2 border-r border-slate-300">Salan</th>
                                <th class="py-2.5 px-2 border-r border-slate-300">Tàu</th>
                                <th class="py-2.5 px-2 border-r border-slate-300">Ghi chú</th>
                                <th class="py-2.5 px-2 text-center w-20">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr
                                v-for="(t, idx) in filteredDetailTickets"
                                :key="t.id"
                                class="hover:bg-gray-50 transition-colors"
                            >
                                <td class="py-2 px-2 text-center text-slate-400">{{ idx + 1 }}</td>
                                <td class="py-2 px-2 text-center font-mono">{{ formatIsoToDmy(t.reportDate) }}</td>
                                <td class="py-2 px-2 text-center font-mono text-slate-600">{{ t.soPhieu }}</td>
                                <td class="py-2 px-2 font-mono font-black">{{ t.vehiclePlate }}</td>
                                <td class="py-2 px-2 text-right font-mono text-slate-600">{{ formatKg(t.grossWeight) }}</td>
                                <td class="py-2 px-2 text-right font-mono text-slate-600">{{ formatKg(t.tareWeight) }}</td>
                                <td class="py-2 px-2 text-right font-mono text-amber-700 font-black">{{ formatKg(t.netWeight) }}</td>
                                <td class="py-2 px-2 text-center text-slate-600">{{ t.maLenh || 'Xuất' }}</td>
                                <td class="py-2 px-2 text-center">{{ t.sourceOrRemark || `Kho ${(t.warehouseId || '').replace('KHO ', '')}` }}</td>
                                <td class="py-2 px-2 text-center font-mono text-slate-500">{{ t.weighInTime || '-' }}</td>
                                <td class="py-2 px-2 text-center font-mono text-slate-500">{{ t.weighOutTime || '-' }}</td>
                                <td class="py-2 px-2 text-teal-700">
                                    <input
                                        v-model="t.bargeInfo"
                                        type="text"
                                        placeholder="-"
                                        @change="handleUpdateTicketField(t)"
                                        class="w-28 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                    />
                                </td>
                                <td class="py-2 px-2">
                                    <input
                                        v-model="t.vesselName"
                                        type="text"
                                        placeholder="Nhập tên tàu..."
                                        @change="handleUpdateTicketField(t)"
                                        class="w-36 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                    />
                                </td>
                                <td class="py-2 px-2">
                                    <input
                                        v-model="t.rawNote"
                                        type="text"
                                        placeholder="-"
                                        @change="handleUpdateTicketField(t)"
                                        class="w-36 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                    />
                                </td>
                                <td class="py-2 px-2 text-center">
                                    <div class="inline-flex items-center gap-1 justify-center">
                                        <button
                                            @click="openEditTicketModal(t)"
                                            class="size-7 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 inline-flex items-center justify-center cursor-pointer transition-colors"
                                            title="Sửa phiếu cân"
                                        >
                                            <span class="material-symbols-outlined text-sm">edit</span>
                                        </button>
                                        <button
                                            @click="handleDeleteTicket(t)"
                                            class="size-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 inline-flex items-center justify-center cursor-pointer transition-colors"
                                            title="Xóa phiếu cân"
                                        >
                                            <span class="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                        <tfoot class="sticky bottom-0 bg-[#d8e4bc] border-t-2 border-slate-300 font-black text-[#1e293b]">
                            <tr>
                                <td colspan="4" class="py-2.5 px-2 text-center border-r border-slate-300">
                                    TỔNG CỘNG: {{ filteredDetailTickets.length }} chuyến
                                </td>
                                <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalGrossTons) }}</td>
                                <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalTareTons) }}</td>
                                <td class="py-2.5 px-2 text-right font-mono text-amber-800 border-r border-slate-300">{{ formatKg(detailTotalTons) }}</td>
                                <td colspan="8" class="py-2.5 px-2"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <!-- TAB 4: XÁ THẲNG DETAILS -->
            <div
                v-else-if="activeSheetTab === 'DIRECT'"
                class="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white"
            >
                <!-- KHO 1-2-3 (GỖ BÌNH ĐỊNH) 19-COLUMN XÁ THẲNG TABLE -->
                <table v-if="activeCustomerGroup === 'KHO_123'" class="w-full text-left border-collapse text-xs font-bold whitespace-nowrap">
                    <thead class="sticky top-0 z-10 bg-[#92d050] text-[#1e293b] border-b border-slate-300">
                        <tr>
                            <th class="py-2.5 px-2 text-center w-12 border-r border-slate-300">STT<br /><span class="font-semibold text-[10px]">(No)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Số phiếu<br /><span class="font-semibold text-[10px]">(Serial)</span></th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Số xe<br /><span class="font-semibold text-[10px]">(Truck no)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày xuất<br /><span class="font-semibold text-[10px]">Date</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng vào<br /><span class="font-semibold text-[10px]">(Weight in)</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng ra<br /><span class="font-semibold text-[10px]">(Weight out)</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng hàng<br /><span class="font-semibold text-[10px]">(N.Weight)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Nhập/Xuất<br /><span class="font-semibold text-[10px]">(In/Out)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Kho<br /><span class="font-semibold text-[10px]">(Warehouse)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày cân vào</th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày cân ra</th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">Cân nhà máy</th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">Chênh lệch</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Salan</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Nơi Nhận</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Tên Kho</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Khu Vực</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Ghi chú</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Nhà xe</th>
                            <th class="py-2.5 px-2 text-center w-20">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr
                            v-for="(t, idx) in filteredDetailTickets"
                            :key="t.id"
                            class="hover:bg-gray-50 transition-colors"
                        >
                            <td class="py-2 px-2 text-center text-slate-400">{{ idx + 1 }}</td>
                            <td class="py-2 px-2 text-center font-mono text-slate-600">{{ t.soPhieu }}</td>
                            <td class="py-2 px-2 font-mono font-black">{{ t.vehiclePlate }}</td>
                            <td class="py-2 px-2 text-center font-mono">{{ formatIsoToDmy(t.reportDate) }}</td>
                            <td class="py-2 px-2 text-right font-mono text-slate-600">{{ formatKg(t.grossWeight) }}</td>
                            <td class="py-2 px-2 text-right font-mono text-slate-600">{{ formatKg(t.tareWeight) }}</td>
                            <td class="py-2 px-2 text-right font-mono text-purple-700 font-black">{{ formatKg(t.netWeight) }}</td>
                            <td class="py-2 px-2 text-center text-slate-600">{{ t.maLenh || 'Xuất' }}</td>
                            <td class="py-2 px-2 text-center">{{ t.warehouseId || '' }}</td>
                            <td class="py-2 px-2 text-center font-mono text-slate-500">{{ t.weighInTime || '-' }}</td>
                            <td class="py-2 px-2 text-center font-mono text-slate-500">{{ t.weighOutTime || '-' }}</td>
                            <td class="py-2 px-2 text-right">
                                <input
                                    :value="t.factoryWeight ? Math.round(t.factoryWeight * 1000) : ''"
                                    type="number"
                                    step="10"
                                    placeholder="-"
                                    @change="onFactoryKgChange(t, $event)"
                                    class="w-20 px-1.5 py-0.5 text-right rounded bg-slate-50 border border-slate-200 font-mono text-xs"
                                />
                            </td>
                            <td class="py-2 px-2 text-right font-mono" :class="t.factoryWeight ? (t.netWeight - t.factoryWeight < 0 ? 'text-rose-600' : 'text-teal-600') : 'text-slate-400'">
                                {{ t.factoryWeight ? formatKg(t.netWeight - t.factoryWeight) : '-' }}
                            </td>
                            <td class="py-2 px-2 text-teal-700">
                                <input
                                    v-model="t.bargeInfo"
                                    type="text"
                                    placeholder="-"
                                    @change="handleUpdateTicketField(t)"
                                    class="w-28 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2">
                                <input
                                    v-model="t.sourceOrRemark"
                                    type="text"
                                    placeholder="Nơi nhận..."
                                    @change="handleUpdateTicketField(t)"
                                    class="w-32 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2">
                                <input
                                    v-model="t.originWarehouseName"
                                    type="text"
                                    placeholder="Tên kho..."
                                    @change="handleUpdateTicketField(t)"
                                    class="w-28 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2">
                                <input
                                    v-model="t.originArea"
                                    type="text"
                                    placeholder="Khu vực..."
                                    @change="handleUpdateTicketField(t)"
                                    class="w-28 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2">
                                <input
                                    v-model="t.rawNote"
                                    type="text"
                                    placeholder="-"
                                    @change="handleUpdateTicketField(t)"
                                    class="w-32 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2">
                                <input
                                    v-model="t.carrierName"
                                    type="text"
                                    placeholder="-"
                                    @change="handleUpdateTicketField(t)"
                                    class="w-24 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-bold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2 text-center">
                                <div class="inline-flex items-center gap-1 justify-center">
                                    <button
                                        @click="openEditTicketModal(t)"
                                        class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary inline-flex items-center justify-center cursor-pointer transition-all active:scale-95"
                                        title="Sửa phiếu cân"
                                    >
                                        <span class="material-symbols-outlined text-sm">edit</span>
                                    </button>
                                    <button
                                        @click="handleDeleteTicket(t)"
                                        class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 inline-flex items-center justify-center cursor-pointer transition-all active:scale-95"
                                        title="Xóa phiếu cân"
                                    >
                                        <span class="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot class="sticky bottom-0 bg-[#d9d9d9] border-t-2 border-slate-300 font-black text-[#1e293b]">
                        <tr>
                            <td colspan="4" class="py-2.5 px-2 text-center border-r border-slate-300">
                                TỔNG CỘNG: {{ filteredDetailTickets.length }} chuyến
                            </td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalGrossTons) }}</td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalTareTons) }}</td>
                            <td class="py-2.5 px-2 text-right font-mono text-purple-800 border-r border-slate-300">{{ formatKg(detailTotalTons) }}</td>
                            <td colspan="4" class="py-2.5 px-2 border-r border-slate-300"></td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalFactoryTons) }}</td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300" :class="detailTotalDiffTons < 0 ? 'text-rose-600' : 'text-teal-700'">
                                {{ formatKg(detailTotalDiffTons) }}
                            </td>
                            <td colspan="7" class="py-2.5 px-2"></td>
                        </tr>
                    </tfoot>
                </table>

                <!-- KHO 4 (EASTWOOD) ORIGINAL 15-COLUMN XÁ THẲNG TABLE -->
                <table v-else class="w-full text-left border-collapse text-xs font-bold whitespace-nowrap">
                    <thead class="sticky top-0 z-10 bg-[#fff2cc] text-[#1e293b] border-b border-slate-300">
                        <tr>
                            <th class="py-2.5 px-2 text-center w-12 border-r border-slate-300">STT<br /><span class="font-semibold text-[10px]">(No)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày nhập<br /><span class="font-semibold text-[10px]">Date</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Số phiếu<br /><span class="font-semibold text-[10px]">(Serial)</span></th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Số xe<br /><span class="font-semibold text-[10px]">(Truck no)</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng vào<br /><span class="font-semibold text-[10px]">(Weight in)</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng ra<br /><span class="font-semibold text-[10px]">(Weight out)</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng hàng<br /><span class="font-semibold text-[10px]">(N.Weight)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày cân vào</th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày cân ra</th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">Cân Nhà Máy</th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">Chênh lệch</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Ghi chú</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Nơi nhận</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Tàu</th>
                            <th class="py-2.5 px-2 text-center w-20">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr
                            v-for="(t, idx) in filteredDetailTickets"
                            :key="t.id"
                            class="hover:bg-gray-50 transition-colors"
                        >
                            <td class="py-2 px-2 text-center text-slate-400">{{ idx + 1 }}</td>
                            <td class="py-2 px-2 text-center font-mono">{{ formatIsoToDmy(t.reportDate) }}</td>
                            <td class="py-2 px-2 text-center font-mono text-slate-600">{{ t.soPhieu }}</td>
                            <td class="py-2 px-2 font-mono font-black">{{ t.vehiclePlate }}</td>
                            <td class="py-2 px-2 text-right font-mono text-slate-600">{{ formatKg(t.grossWeight) }}</td>
                            <td class="py-2 px-2 text-right font-mono text-slate-600">{{ formatKg(t.tareWeight) }}</td>
                            <td class="py-2 px-2 text-right font-mono text-purple-700 font-black">{{ formatKg(t.netWeight) }}</td>
                            <td class="py-2 px-2 text-center font-mono text-slate-500">{{ t.weighInTime || '-' }}</td>
                            <td class="py-2 px-2 text-center font-mono text-slate-500">{{ t.weighOutTime || '-' }}</td>
                            <td class="py-2 px-2 text-right">
                                <input
                                    :value="t.factoryWeight ? Math.round(t.factoryWeight * 1000) : ''"
                                    type="number"
                                    step="10"
                                    placeholder="-"
                                    @change="onFactoryKgChange(t, $event)"
                                    class="w-20 px-1.5 py-0.5 text-right rounded bg-slate-50 border border-slate-200 font-mono text-xs"
                                />
                            </td>
                            <td class="py-2 px-2 text-right font-mono" :class="t.factoryWeight ? (t.netWeight - t.factoryWeight < 0 ? 'text-rose-600' : 'text-teal-600') : 'text-slate-400'">
                                {{ t.factoryWeight ? formatKg(t.netWeight - t.factoryWeight) : '-' }}
                            </td>
                            <td class="py-2 px-2 text-teal-700">
                                <input
                                    v-model="t.bargeInfo"
                                    type="text"
                                    placeholder="-"
                                    @change="handleUpdateTicketField(t)"
                                    class="w-28 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2 font-semibold text-amber-800">
                                <input
                                    v-model="t.sourceOrRemark"
                                    type="text"
                                    placeholder="-"
                                    @change="handleUpdateTicketField(t)"
                                    class="w-32 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2">
                                <input
                                    v-model="t.vesselName"
                                    type="text"
                                    placeholder="-"
                                    @change="handleUpdateTicketField(t)"
                                    class="w-28 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-2 text-center">
                                <div class="inline-flex items-center gap-1 justify-center">
                                    <button
                                        @click="openEditTicketModal(t)"
                                        class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary inline-flex items-center justify-center cursor-pointer transition-all active:scale-95"
                                        title="Sửa phiếu cân"
                                    >
                                        <span class="material-symbols-outlined text-sm">edit</span>
                                    </button>
                                    <button
                                        @click="handleDeleteTicket(t)"
                                        class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 inline-flex items-center justify-center cursor-pointer transition-all active:scale-95"
                                        title="Xóa phiếu cân"
                                    >
                                        <span class="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot class="sticky bottom-0 bg-[#fff2cc] border-t-2 border-slate-300 font-black text-[#1e293b]">
                        <tr>
                            <td colspan="4" class="py-2.5 px-2 text-center border-r border-slate-300">
                                Tổng cộng (Total): {{ filteredDetailTickets.length }} chuyến
                            </td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalGrossTons) }}</td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalTareTons) }}</td>
                            <td class="py-2.5 px-2 text-right font-mono text-purple-800 border-r border-slate-300">{{ formatKg(detailTotalTons) }}</td>
                            <td colspan="2" class="py-2.5 px-2 border-r border-slate-300"></td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300">{{ formatKg(detailTotalFactoryTons) }}</td>
                            <td class="py-2.5 px-2 text-right font-mono border-r border-slate-300" :class="detailTotalDiffTons < 0 ? 'text-rose-600' : 'text-teal-700'">
                                {{ formatKg(detailTotalDiffTons) }}
                            </td>
                            <td colspan="4" class="py-2.5 px-2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <!-- /Card 3: Sheet Tabs + Main Table Content -->
            </div>
                </template>
        <!-- /Main Content Area: line 1040 -->
        </div>
        <!-- /Main Master-Detail Work Area: line 881 -->
        </div>

        <!-- Modal: Edit Warehouse Config (Customer & Initial Stock) -->
        <div
            v-if="showConfigModal"
            class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
            <div class="bg-white rounded-[2rem] p-6 w-full max-w-md border border-primary/10 shadow-xl flex flex-col gap-4">
                <div class="flex items-center justify-between">
                    <h3 class="text-xl font-display font-black text-[#1e293b]">
                        Cấu hình {{ editingConfigForm.warehouseId }}
                    </h3>
                    <button
                        @click="showConfigModal = false"
                        class="size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <div class="flex flex-col gap-3 text-xs font-bold">
                    <div class="flex flex-col gap-1">
                        <label class="text-slate-600">Tên Khách Hàng Hiện Tại</label>
                        <input
                            v-model="editingConfigForm.currentCustomer"
                            type="text"
                            placeholder="VD: EASTWOOD, GỖ BÌNH ĐỊNH..."
                            class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-primary"
                        />
                        <span class="text-xs text-slate-400 font-normal">
                            Lưu ý: Khi đổi tên khách hàng, lịch sử tồn kho vẫn được cộng dồn liên tục (không tách lô).
                        </span>
                    </div>

                    <div class="flex flex-col gap-1">
                        <label class="text-slate-600">Số Dư Tồn Đầu Kỳ (Đơn vị: Tấn)</label>
                        <input
                            v-model.number="editingConfigForm.initialStock"
                            type="number"
                            step="0.01"
                            class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-2xl text-sm font-mono font-bold outline-none focus:border-primary"
                        />
                    </div>

                    <div class="flex flex-col gap-1">
                        <label class="text-slate-600">Ngày Mốc Tồn Đầu (Tùy chọn)</label>
                        <input
                            v-model="editingConfigForm.initialDate"
                            type="date"
                            class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-primary"
                        />
                    </div>
                </div>

                <div class="flex justify-end gap-2 pt-2">
                    <button
                        @click="showConfigModal = false"
                        class="px-4 py-2 bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl text-xs hover:bg-primary/5 active:scale-95 transition-all shadow-sm cursor-pointer"
                    >
                        Hủy
                    </button>
                    <button
                        @click="saveConfigModal"
                        class="px-5 py-2 bg-primary text-white font-bold rounded-full text-xs shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all cursor-pointer"
                    >
                        Lưu Cấu Hình
                    </button>
                </div>
            </div>
        </div>

        <!-- Modal: Edit Customer Name -->
        <div
            v-if="showEditCustomerModal"
            class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
            <div class="bg-white rounded-[2rem] p-6 w-full max-w-md border border-primary/10 shadow-xl flex flex-col gap-4">
                <div class="flex items-center justify-between">
                    <h3 class="text-xl font-display font-black text-[#1e293b]">
                        Đổi Tên Khách Hàng ({{ editingCustomerGroup === 'KHO_4' ? 'Kho 4' : 'Kho 1 - 2 - 3' }})
                    </h3>
                    <button
                        @click="showEditCustomerModal = false"
                        class="size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <div class="flex flex-col gap-3 text-xs font-bold">
                    <div class="flex flex-col gap-1">
                        <label class="text-slate-600">Tên Khách Hàng</label>
                        <input
                            v-model="editingCustomerName"
                            type="text"
                            placeholder="VD: EASTWOOD, GỖ BÌNH ĐỊNH..."
                            @keydown.enter="saveCustomerNameModal"
                            class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-primary"
                        />
                        <span class="text-xs text-slate-400 font-normal">
                            {{
                                editingCustomerGroup === 'KHO_4'
                                    ? 'Tên này sẽ áp dụng cho toàn bộ báo cáo và phiếu của Kho 4.'
                                    : 'Tên này sẽ áp dụng đồng bộ cho cả 3 Kho 1, 2, 3 và bảng Gộp Kho.'
                            }}
                        </span>
                    </div>
                </div>

                <div class="flex justify-end gap-2 pt-2">
                    <button
                        @click="showEditCustomerModal = false"
                        class="px-4 py-2 bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl text-xs hover:bg-primary/5 active:scale-95 transition-all shadow-sm cursor-pointer"
                    >
                        Hủy
                    </button>
                    <button
                        @click="saveCustomerNameModal"
                        class="px-5 py-2 bg-primary text-white font-bold rounded-full text-xs shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all cursor-pointer"
                    >
                        Lưu Tên Khách Hàng
                    </button>
                </div>
            </div>
        </div>

        <!-- Modal: Edit Ticket Details -->
        <div
            v-if="showEditTicketModal && editingTicketForm"
            class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
            <div class="bg-white rounded-[2rem] p-6 w-full max-w-2xl border border-primary/10 shadow-2xl flex flex-col gap-4 my-auto max-h-[90vh]">
                <!-- Header -->
                <div class="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                    <div class="flex items-center gap-2.5">
                        <div class="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <span class="material-symbols-outlined text-lg">edit_note</span>
                        </div>
                        <div>
                            <h3 class="text-xl font-display font-black text-[#1e293b]">
                                Sửa Phiếu Cân: {{ editingTicketForm.soPhieu || editingTicketForm.vehiclePlate }}
                            </h3>
                            <p class="text-xs text-slate-500 font-semibold">
                                Luồng: <span class="font-bold text-primary">{{ editingTicketForm.flowType }}</span> • Kho: <span class="font-bold">{{ editingTicketForm.warehouseId || 'Xá thẳng' }}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        @click="showEditTicketModal = false"
                        class="size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <!-- Scrollable Form Body -->
                <div class="overflow-y-auto flex-1 pr-1 flex flex-col gap-4 text-xs font-bold">
                    <!-- Group 1: Mã phiếu & Xe -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div class="flex flex-col gap-1">
                            <label class="text-slate-600">Số phiếu</label>
                            <input
                                v-model="editingTicketForm.soPhieu"
                                type="text"
                                placeholder="VD: 00123"
                                class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-primary"
                            />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-slate-600">Biển số xe</label>
                            <input
                                v-model="editingTicketForm.vehiclePlate"
                                type="text"
                                placeholder="VD: 77C-12345"
                                class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-mono font-black uppercase outline-none focus:border-primary"
                            />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-slate-600">Mã lệnh / Loại cân</label>
                            <input
                                v-model="editingTicketForm.maLenh"
                                type="text"
                                placeholder="Nhập / Xuất"
                                class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    <!-- Group 2: Thời gian & Ngày báo cáo -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div class="flex flex-col gap-1">
                            <label class="text-slate-600">Ngày báo cáo (Ca 6h)</label>
                            <input
                                v-model="editingTicketForm.reportDate"
                                type="date"
                                class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-primary"
                            />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-slate-600">Giờ vào (Weigh In)</label>
                            <input
                                v-model="editingTicketForm.weighInTime"
                                type="text"
                                placeholder="HH:mm:ss"
                                class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-primary"
                            />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-slate-600">Giờ ra (Weigh Out)</label>
                            <input
                                v-model="editingTicketForm.weighOutTime"
                                type="text"
                                placeholder="HH:mm:ss"
                                class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    <!-- Group 3: Trọng lượng (Kg) -->
                    <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col gap-2.5">
                        <span class="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                            Số liệu cân (Đơn vị: Kg)
                        </span>
                        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div class="flex flex-col gap-1">
                                <label class="text-slate-600">Tổng trọng (Gross Kg)</label>
                                <input
                                    v-model.number="editingTicketWeightsKg.grossKg"
                                    type="number"
                                    step="1"
                                    @input="onModalGrossOrTareChange"
                                    class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-primary text-right"
                                />
                                <span class="text-[10px] text-slate-400 text-right">{{ formatTons(editingTicketWeightsKg.grossKg / 1000) }} tấn</span>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="text-slate-600">Tự trọng xe (Tare Kg)</label>
                                <input
                                    v-model.number="editingTicketWeightsKg.tareKg"
                                    type="number"
                                    step="1"
                                    @input="onModalGrossOrTareChange"
                                    class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-primary text-right"
                                />
                                <span class="text-[10px] text-slate-400 text-right">{{ formatTons(editingTicketWeightsKg.tareKg / 1000) }} tấn</span>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="text-slate-600 font-black text-primary">TL Hàng (Net Kg)</label>
                                <input
                                    v-model.number="editingTicketWeightsKg.netKg"
                                    type="number"
                                    step="1"
                                    class="px-3 py-2 bg-primary/5 border border-primary/30 rounded-xl text-xs font-mono font-black text-primary outline-none focus:border-primary text-right"
                                />
                                <span class="text-[10px] text-primary/70 font-black text-right">{{ formatTons(editingTicketWeightsKg.netKg / 1000) }} tấn</span>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="text-slate-600">Cân nhà máy (Kg)</label>
                                <input
                                    v-model.number="editingTicketWeightsKg.factoryKg"
                                    type="number"
                                    step="1"
                                    placeholder="-"
                                    class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-primary text-right"
                                />
                                <span class="text-[10px] text-slate-400 text-right">{{ editingTicketWeightsKg.factoryKg !== '' ? formatTons(Number(editingTicketWeightsKg.factoryKg) / 1000) + ' tấn' : '-' }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Group 4: Vận chuyển, kho bãi & Ghi chú -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div class="flex flex-col gap-1">
                            <label class="text-slate-600">Kho lưu trữ</label>
                            <select
                                v-model="editingTicketForm.warehouseId"
                                class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary cursor-pointer"
                            >
                                <option :value="null">Không phân kho (Xá thẳng)</option>
                                <option value="KHO 1">Kho 1</option>
                                <option value="KHO 2">Kho 2</option>
                                <option value="KHO 3">Kho 3</option>
                                <option value="KHO 4">Kho 4</option>
                            </select>
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-slate-600">Nhà xe</label>
                            <input
                                v-model="editingTicketForm.carrierName"
                                type="text"
                                placeholder="Tên nhà xe"
                                class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary"
                            />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-slate-600">Nơi nhận / Xuất phát</label>
                            <input
                                v-model="editingTicketForm.sourceOrRemark"
                                type="text"
                                placeholder="Nơi nhận..."
                                class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div class="flex flex-col gap-1">
                            <label class="text-slate-600">Tên kho (Origin)</label>
                            <input
                                v-model="editingTicketForm.originWarehouseName"
                                type="text"
                                placeholder="VD: GBD..."
                                class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary"
                            />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-slate-600">Khu vực (Area)</label>
                            <input
                                v-model="editingTicketForm.originArea"
                                type="text"
                                placeholder="VD: Bình Định..."
                                class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary"
                            />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-slate-600">Sà lan</label>
                            <input
                                v-model="editingTicketForm.bargeInfo"
                                type="text"
                                placeholder="Tên sà lan..."
                                class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary"
                            />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-slate-600">Tàu</label>
                            <input
                                v-model="editingTicketForm.vesselName"
                                type="text"
                                placeholder="Tên tàu..."
                                class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    <div class="flex flex-col gap-1">
                        <label class="text-slate-600">Ghi chú</label>
                        <input
                            v-model="editingTicketForm.rawNote"
                            type="text"
                            placeholder="Ghi chú thêm về phiếu cân..."
                            class="px-3 py-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-primary"
                        />
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
                    <button
                        type="button"
                        @click="handleDeleteFromEditModal"
                        class="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-2xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                        <span class="material-symbols-outlined text-sm">delete</span>
                        <span>Xóa phiếu này</span>
                    </button>
                    <div class="flex gap-2">
                        <button
                            type="button"
                            @click="showEditTicketModal = false"
                            class="px-4 py-2 bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl text-xs hover:bg-primary/5 active:scale-95 transition-all shadow-sm cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            @click="saveEditTicketModal"
                            class="px-5 py-2 bg-primary text-white font-bold rounded-full text-xs shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
                        >
                            <span class="material-symbols-outlined text-sm">save</span>
                            <span>Lưu Phiếu Cân</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

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

const emit = defineEmits<{
    (e: 'synced-to-allocator', payload: { syncedTicketsCount: number; matchedBargesCount: number }): void;
}>();

const { addToast } = useToast();

type ViewWarehouseMode = WarehouseId | 'COMBINED_123';
type SheetTabMode = 'FINAL' | 'IMPORT' | 'EXPORT' | 'DIRECT';

const selectedWarehouseMode = ref<ViewWarehouseMode>('KHO 4');
const activeSheetTab = ref<SheetTabMode>('FINAL');
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
        includeDirectForCustomer: showDirectColumnInSingleFinal.value
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

async function handleClearWarehouseData() {
    let targetKey: WarehouseId | 'ALL' | 'DIRECT' | 'DIRECT_KHO4' | 'DIRECT_KHO123' | 'GROUP_KHO123';
    let targetLabel = '';

    if (activeSheetTab.value === 'DIRECT') {
        if (selectedWarehouseMode.value === 'KHO 4') {
            targetKey = 'DIRECT_KHO4';
            targetLabel = `toàn bộ phiếu XÁ THẲNG của ${configs.value['KHO 4']?.currentCustomer || 'Kho 4'}`;
        } else {
            targetKey = 'DIRECT_KHO123';
            targetLabel = `toàn bộ phiếu XÁ THẲNG của ${configs.value['KHO 1']?.currentCustomer || 'Kho 1-2-3'}`;
        }
    } else if (selectedWarehouseMode.value === 'COMBINED_123') {
        targetKey = 'GROUP_KHO123';
        targetLabel = `toàn bộ dữ liệu của Kho 1, 2, 3 và Xá thẳng của ${configs.value['KHO 1']?.currentCustomer || 'Gỗ Bình Định'}`;
    } else {
        targetKey = activeSingleWarehouseId.value;
        targetLabel = `toàn bộ phiếu của ${selectedWarehouseMode.value}`;
    }

    if (!confirm(`Bạn có chắc chắn muốn XÓA SẠCH ${targetLabel} để import lại từ đầu không?`)) {
        return;
    }
    try {
        await WarehouseInventoryService.clearWarehouseTickets(targetKey);
        await loadAllData();
        addToast(`Đã xóa sạch dữ liệu phiếu cân ${targetLabel}!`, 'success');
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
async function handleExportExcel(mode: 'SINGLE' | 'COMBINED_123') {
    exportingExcel.value = true;
    try {
        const opts = {
            fromDate: filterFromDate.value || undefined,
            toDate: filterToDate.value || undefined
        };
        const { buffer, filename } = mode === 'COMBINED_123'
            ? await WarehouseInventoryService.exportCombined123WarehouseWorkbook(opts)
            : await WarehouseInventoryService.exportSingleWarehouseWorkbook(activeSingleWarehouseId.value, opts);

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
 * so that Copy to Clipboard / Download PNG for Zalo is 100% reliable and sharp.
 */
async function renderFinalTableToPngBlob(): Promise<Blob> {
    const scale = 2; // Retina 2x resolution for Zalo
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    if (selectedWarehouseMode.value !== 'COMBINED_123') {
        const whId = activeSingleWarehouseId.value;
        const cfg = configs.value[whId];
        const calc = activeFinalCalc.value;
        const rows = calc.rows;
        const hasDirect = showDirectColumnInSingleFinal.value;

        const colWidths = hasDirect
            ? [50, 105, 110, 110, 110, 120, 260]
            : [50, 105, 115, 115, 125, 280];
        const headers = hasDirect
            ? ['STT', 'Ngày', 'Nhập (Tấn)', 'Xuất (Tấn)', 'Xá thẳng', 'Tồn kho (Tấn)', 'Ghi chú']
            : ['STT', 'Ngày', 'Nhập (Tấn)', 'Xuất (Tấn)', 'Tồn kho (Tấn)', 'Ghi chú'];

        const padX = 28;
        const padY = 24;
        const rowH = 30;
        const headerH = 34;
        const titleAreaH = 62;
        const hasOpeningRow = calc.openingStockBeforeFilter > 0 ? 1 : 0;
        const totalRowsCount = rows.length + hasOpeningRow + 1; // +1 for TỔNG CỘNG

        const tableW = colWidths.reduce((a, b) => a + b, 0);
        const logicalW = tableW + padX * 2;
        const logicalH = padY * 2 + titleAreaH + headerH + totalRowsCount * rowH;

        canvas.width = logicalW * scale;
        canvas.height = logicalH * scale;
        ctx.scale(scale, scale);

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, logicalW, logicalH);

        // Title Banner
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 17px "Times New Roman", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            `THEO DÕI NHẬP XUẤT TỒN KHO HÀNG VIÊN NÉN GỖ - ${whId} (${cfg.currentCustomer || 'KHÁCH HÀNG'})`,
            logicalW / 2,
            padY + 20
        );

        ctx.fillStyle = '#475569';
        ctx.font = 'italic 13px "Times New Roman", Arial, sans-serif';
        ctx.fillText(
            `Chốt số liệu 06:00 sáng ngày ${todayStr} — Đơn vị tính: Tấn`,
            logicalW / 2,
            padY + 42
        );

        let curY = padY + titleAreaH;

        // Draw Table Header
        let curX = padX;
        for (let i = 0; i < headers.length; i++) {
            const w = colWidths[i]!;
            ctx.fillStyle = '#d9e1f2';
            ctx.fillRect(curX, curY, w, headerH);
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1;
            ctx.strokeRect(curX, curY, w, headerH);

            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 13px "Times New Roman", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(headers[i]!, curX + w / 2, curY + headerH / 2);
            curX += w;
        }
        curY += headerH;

        const drawRowCells = (
            cells: string[],
            aligns: Array<'center' | 'right' | 'left'>,
            opts?: { bg?: string; bold?: boolean; highlightColIdx?: number }
        ) => {
            let x = padX;
            for (let i = 0; i < cells.length; i++) {
                const w = colWidths[i]!;
                ctx.fillStyle = opts?.bg || '#ffffff';
                ctx.fillRect(x, curY, w, rowH);
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 0.8;
                ctx.strokeRect(x, curY, w, rowH);

                ctx.fillStyle = opts?.highlightColIdx === i ? '#0f5132' : '#1e293b';
                ctx.font = `${opts?.bold || opts?.highlightColIdx === i ? 'bold' : 'normal'} 13px "Times New Roman", Arial, sans-serif`;
                const align = aligns[i] || 'center';
                ctx.textAlign = align;
                ctx.textBaseline = 'middle';
                const textX = align === 'right' ? x + w - 8 : align === 'left' ? x + 8 : x + w / 2;
                ctx.fillText(cells[i] || '', textX, curY + rowH / 2, w - 12);
                x += w;
            }
            curY += rowH;
        };

        const aligns: Array<'center' | 'right' | 'left'> = hasDirect
            ? ['center', 'center', 'right', 'right', 'right', 'right', 'left']
            : ['center', 'center', 'right', 'right', 'right', 'left'];

        if (hasOpeningRow) {
            const openCells = hasDirect
                ? ['', 'Tồn đầu', '-', '-', '-', formatTons(calc.openingStockBeforeFilter), cfg.initialDate ? `Tồn đầu ${cfg.initialDate}` : '']
                : ['', 'Tồn đầu', '-', '-', formatTons(calc.openingStockBeforeFilter), cfg.initialDate ? `Tồn đầu ${cfg.initialDate}` : ''];
            drawRowCells(openCells, aligns, { bg: '#f8fafc', bold: true });
        }

        rows.forEach((r: WarehouseFinalRow, idx: number) => {
            const rowCells = hasDirect
                ? [
                    String(idx + 1),
                    r.displayDate,
                    r.importTons > 0 ? formatTons(r.importTons) : '-',
                    r.exportTons > 0 ? formatTons(r.exportTons) : '-',
                    r.directTons > 0 ? formatTons(r.directTons) : '-',
                    formatTons(r.remainingStockTons),
                    r.remark || ''
                ]
                : [
                    String(idx + 1),
                    r.displayDate,
                    r.importTons > 0 ? formatTons(r.importTons) : '-',
                    r.exportTons > 0 ? formatTons(r.exportTons) : '-',
                    formatTons(r.remainingStockTons),
                    r.remark || ''
                ];
            drawRowCells(rowCells, aligns, { highlightColIdx: hasDirect ? 5 : 4 });
        });

        // Total Row
        const totalCells = hasDirect
            ? [
                '',
                'TỔNG CỘNG',
                formatTons(calc.totalImportTons),
                formatTons(calc.totalExportTons),
                formatTons(calc.totalDirectTons),
                formatTons(calc.closingStockTons),
                ''
            ]
            : [
                '',
                'TỔNG CỘNG',
                formatTons(calc.totalImportTons),
                formatTons(calc.totalExportTons),
                formatTons(calc.closingStockTons),
                ''
            ];
        drawRowCells(totalCells, aligns, { bg: '#fff2cc', bold: true });
    } else {
        // COMBINED_123: 3 side-by-side tables (KHO 1, KHO 2, KHO 3)
        const whs: WarehouseId[] = ['KHO 1', 'KHO 2', 'KHO 3'];
        const blockCols = [86, 86, 86, 94, 150]; // Ngày, Nhập, Xuất, Tồn kho, Ghi chú
        const blockW = blockCols.reduce((a, b) => a + b, 0);
        const gapW = 22;
        const padX = 24;
        const padY = 24;
        const titleH = 54;
        const headerH = 32;
        const rowH = 28;

        const maxRows = Math.max(
            finalTablesByWarehouse.value['KHO 1'].rows.length,
            finalTablesByWarehouse.value['KHO 2'].rows.length,
            finalTablesByWarehouse.value['KHO 3'].rows.length,
            1
        );

        const logicalW = padX * 2 + blockW * 3 + gapW * 2;
        const logicalH = padY * 2 + titleH + headerH + (maxRows + 2) * rowH;

        canvas.width = logicalW * scale;
        canvas.height = logicalH * scale;
        ctx.scale(scale, scale);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, logicalW, logicalH);

        whs.forEach((whId, bIdx) => {
            const startX = padX + bIdx * (blockW + gapW);
            const cfg = configs.value[whId];
            const calc = finalTablesByWarehouse.value[whId];

            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 14px "Times New Roman", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
                `THEO DÕI NHẬP XUẤT - ${whId} (${cfg.currentCustomer || ''})`,
                startX + blockW / 2,
                padY + 24
            );

            let curY = padY + titleH;
            const headers = ['Ngày', 'Nhập', 'Xuất', 'Tồn kho', 'Ghi chú'];
            let x = startX;
            headers.forEach((h, i) => {
                const w = blockCols[i]!;
                ctx.fillStyle = '#d9e1f2';
                ctx.fillRect(x, curY, w, headerH);
                ctx.strokeStyle = '#64748b';
                ctx.strokeRect(x, curY, w, headerH);
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 12px "Times New Roman", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(h, x + w / 2, curY + headerH / 2);
                x += w;
            });
            curY += headerH;

            const drawBlockRow = (cells: string[], bg = '#ffffff', bold = false) => {
                let cx = startX;
                const aligns: Array<'center' | 'right' | 'left'> = ['center', 'right', 'right', 'right', 'left'];
                cells.forEach((txt, i) => {
                    const w = blockCols[i]!;
                    ctx.fillStyle = bg;
                    ctx.fillRect(cx, curY, w, rowH);
                    ctx.strokeStyle = '#94a3b8';
                    ctx.strokeRect(cx, curY, w, rowH);
                    ctx.fillStyle = '#1e293b';
                    ctx.font = `${bold || i === 3 ? 'bold' : 'normal'} 12px "Times New Roman", Arial, sans-serif`;
                    const al = aligns[i]!;
                    ctx.textAlign = al;
                    ctx.textBaseline = 'middle';
                    const tx = al === 'right' ? cx + w - 6 : al === 'left' ? cx + 6 : cx + w / 2;
                    ctx.fillText(txt || '', tx, curY + rowH / 2, w - 10);
                    cx += w;
                });
                curY += rowH;
            };

            drawBlockRow(['Tồn đầu', '-', '-', formatTons(calc.openingStockBeforeFilter), ''], '#f8fafc', true);

            for (let rIdx = 0; rIdx < maxRows; rIdx++) {
                const r = calc.rows[rIdx];
                if (r) {
                    drawBlockRow([
                        r.displayDate,
                        r.importTons > 0 ? formatTons(r.importTons) : '-',
                        r.exportTons > 0 ? formatTons(r.exportTons) : '-',
                        formatTons(r.remainingStockTons),
                        r.remark || ''
                    ]);
                } else {
                    drawBlockRow(['', '', '', '', '']);
                }
            }

            drawBlockRow(
                [
                    'TỔNG CỘNG',
                    formatTons(calc.totalImportTons),
                    formatTons(calc.totalExportTons),
                    formatTons(calc.closingStockTons),
                    ''
                ],
                '#fff2cc',
                true
            );
        });
    }

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Không thể tạo ảnh PNG'));
        }, 'image/png');
    });
}

async function handleCopyZaloImage() {
    capturingZaloImage.value = true;
    try {
        const blob = await renderFinalTableToPngBlob();
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            addToast('Đã copy ảnh bảng tổng hợp Tồn kho vào Clipboard! Bạn có thể nhấn Ctrl+V vào Zalo ngay.', 'success');
        } else {
            await handleDownloadZaloImage();
        }
    } catch (err: any) {
        console.warn('Clipboard write fallback to download:', err);
        await handleDownloadZaloImage();
    } finally {
        capturingZaloImage.value = false;
    }
}

async function handleDownloadZaloImage() {
    capturingZaloImage.value = true;
    try {
        const blob = await renderFinalTableToPngBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const label = selectedWarehouseMode.value === 'COMBINED_123' ? 'GOP_KHO_1_2_3' : selectedWarehouseMode.value.replace(/\s+/g, '_');
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

        <!-- Card 1: Top Header & Action Bar -->
        <div class="bg-white rounded-[24px] p-4 border border-primary/5 soft-shadow shrink-0 flex flex-col gap-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div class="text-xs uppercase font-black tracking-widest text-primary mb-0.5">
                        Chốt số liệu 06:00 sáng hàng ngày • Cộng dồn liên tục
                    </div>
                    <h1 class="text-base md:text-xl font-black text-[#1e293b] flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-xl">warehouse</span>
                        Báo Cáo Tồn Kho & Xuất Thẳng Sà Lan
                    </h1>
                </div>

                <!-- Primary Import & Export Actions -->
                <div class="flex flex-wrap items-center gap-2">
                    <button
                        @click="triggerCsvImport"
                        :disabled="importingCsv"
                        class="px-3.5 py-2 bg-primary text-white font-bold rounded-2xl text-xs shadow-[0_3px_0_0_#6495ed] hover:translate-y-[1px] hover:shadow-[0_1px_0_0_#6495ed] active:translate-y-[3px] active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Chọn 1 hoặc 2 file CSV/Excel từ trạm cân (Nhập + Xuất). Tự động vào Tồn kho 4 kho và đẩy chuyến Xuất sang Sà lan Báo cáo cân hàng!"
                    >
                        <span class="material-symbols-outlined text-sm">{{ importingCsv ? 'sync' : 'upload_file' }}</span>
                        <span>{{ importingCsv ? 'Đang nạp CSV...' : 'Nạp CSV Trạm Cân (1 Lần)' }}</span>
                    </button>

                    <button
                        @click="triggerHistoryExcelImport"
                        :disabled="importingHistoryExcel"
                        class="px-3.5 py-2 bg-white border border-primary/20 hover:border-primary text-primary font-bold rounded-2xl text-xs hover:bg-primary/5 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                        title="Hút toàn bộ lịch sử IMPORT, EXPORT, XÁ THẲNG, Data (Nhà xe) và Ghi chú từ file Excel Báo cáo Tồn kho đang dùng"
                    >
                        <span class="material-symbols-outlined text-sm">{{ importingHistoryExcel ? 'sync' : 'folder_open' }}</span>
                        <span>{{ importingHistoryExcel ? 'Đang hút lịch sử...' : 'Nạp từ Excel Tồn Kho Đang Dùng' }}</span>
                    </button>

                    <button
                        @click="handleCopyZaloImage"
                        :disabled="capturingZaloImage"
                        class="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                        title="Chụp bảng FINAL độ nét cao vào bộ nhớ tạm để nhấn Ctrl+V dán thẳng vào Zalo"
                    >
                        <span class="material-symbols-outlined text-sm">content_copy</span>
                        <span>Copy Ảnh gửi Zalo</span>
                    </button>

                    <button
                        @click="handleDownloadZaloImage"
                        :disabled="capturingZaloImage"
                        class="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 font-bold rounded-2xl text-xs transition-all flex items-center gap-1 cursor-pointer"
                        title="Tải file ảnh PNG bảng FINAL về máy"
                    >
                        <span class="material-symbols-outlined text-sm">image</span>
                        <span>Tải PNG</span>
                    </button>

                    <button
                        @click="handleExportExcel(selectedWarehouseMode === 'COMBINED_123' ? 'COMBINED_123' : 'SINGLE')"
                        :disabled="exportingExcel"
                        class="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                    >
                        <span class="material-symbols-outlined text-sm">download</span>
                        <span>
                            {{
                                exportingExcel
                                    ? 'Đang tạo Excel...'
                                    : selectedWarehouseMode === 'COMBINED_123'
                                        ? 'Xuất Excel Gộp Kho 1-2-3'
                                        : `Xuất Excel ${selectedWarehouseMode}`
                            }}
                        </span>
                    </button>

                    <button
                        @click="handleClearWarehouseData"
                        class="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                        title="Xóa dữ liệu phiếu cân của kho này hoặc toàn bộ kho để import lại từ đầu"
                    >
                        <span class="material-symbols-outlined text-sm font-bold">delete_forever</span>
                        <span>Xóa Dữ Liệu</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Main Master-Detail Work Area: Sidebar Tree + Content -->
        <div class="flex-1 flex flex-col md:flex-row gap-3.5 min-h-0 overflow-hidden">
            <!-- Sidebar: Tree Structure by Customer & Warehouses -->
            <aside class="w-full md:w-64 bg-white rounded-[24px] p-3 border border-primary/5 soft-shadow flex flex-col gap-2 shrink-0 overflow-y-auto">
                <div class="px-2 py-1 flex items-center justify-between border-b border-slate-100 pb-2">
                    <span class="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-base text-primary">account_tree</span>
                        Cây Khách Hàng & Kho
                    </span>
                    <button
                        @click="openEditConfigModal(activeSingleWarehouseId)"
                        class="size-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center cursor-pointer transition-colors"
                        title="Cấu hình tồn đầu & khách hàng"
                    >
                        <span class="material-symbols-outlined text-xs">settings</span>
                    </button>
                </div>

                <!-- Tree Group 1: EASTWOOD (Kho 4) -->
                <div class="border rounded-2xl overflow-hidden border-slate-200/80 bg-slate-50/50">
                    <!-- Customer Node Header (Click to view Overview / FINAL Kho 4) -->
                    <div
                        @click="selectedWarehouseMode = 'KHO 4'; activeSheetTab = 'FINAL'"
                        :class="[
                            'p-2.5 flex items-center justify-between cursor-pointer select-none transition-all',
                            selectedWarehouseMode === 'KHO 4' && activeSheetTab === 'FINAL'
                                ? 'bg-primary text-white shadow-sm font-black'
                                : 'hover:bg-slate-100/70 text-[#1e293b]'
                        ]"
                    >
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span
                                class="material-symbols-outlined text-base shrink-0"
                                :class="selectedWarehouseMode === 'KHO 4' && activeSheetTab === 'FINAL' ? 'text-white' : 'text-primary'"
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
                                        selectedWarehouseMode === 'KHO 4' && activeSheetTab === 'FINAL'
                                            ? 'bg-white/20 hover:bg-white/30 text-white'
                                            : 'bg-primary/10 hover:bg-primary/20 text-primary'
                                    ]"
                                    title="Đổi tên khách hàng"
                                >
                                    <span class="material-symbols-outlined text-[11px]">edit</span>
                                </button>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <span
                                class="text-[11px] font-mono font-black"
                                :class="selectedWarehouseMode === 'KHO 4' && activeSheetTab === 'FINAL' ? 'text-white' : 'text-primary'"
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
                                        selectedWarehouseMode === 'KHO 4' && activeSheetTab === 'FINAL' ? 'text-white/80' : 'text-slate-400'
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
                            @click="selectedWarehouseMode = 'KHO 4'"
                            :class="[
                                'w-full px-2.5 py-1.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 pl-4',
                                selectedWarehouseMode === 'KHO 4' && activeSheetTab !== 'FINAL'
                                    ? 'bg-primary text-white font-black shadow-sm'
                                    : 'hover:bg-slate-50 text-slate-700 font-bold'
                            ]"
                        >
                            <span class="flex items-center gap-1.5 text-xs truncate">
                                <span class="material-symbols-outlined text-xs">subdirectory_arrow_right</span>
                                <span>KHO 4</span>
                            </span>
                            <span
                                class="text-[11px] font-mono font-black shrink-0"
                                :class="selectedWarehouseMode === 'KHO 4' && activeSheetTab !== 'FINAL' ? 'text-white' : 'text-slate-600'"
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
                        @click="selectedWarehouseMode = 'COMBINED_123'; activeSheetTab = 'FINAL'"
                        :class="[
                            'p-2.5 flex items-center justify-between cursor-pointer select-none transition-all',
                            selectedWarehouseMode === 'COMBINED_123'
                                ? 'bg-teal-600 text-white shadow-sm font-black'
                                : 'hover:bg-slate-100/70 text-[#1e293b]'
                        ]"
                    >
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span
                                class="material-symbols-outlined text-base shrink-0"
                                :class="selectedWarehouseMode === 'COMBINED_123' ? 'text-white' : 'text-teal-600'"
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
                                        selectedWarehouseMode === 'COMBINED_123'
                                            ? 'bg-white/20 hover:bg-white/30 text-white'
                                            : 'bg-teal-600/10 hover:bg-teal-600/20 text-teal-700'
                                    ]"
                                    title="Đổi tên khách hàng"
                                >
                                    <span class="material-symbols-outlined text-[11px]">edit</span>
                                </button>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <span
                                class="text-[11px] font-mono font-black"
                                :class="selectedWarehouseMode === 'COMBINED_123' ? 'text-white' : 'text-teal-700'"
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
                                        selectedWarehouseMode === 'COMBINED_123' ? 'text-white/80' : 'text-slate-400'
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
                            @click="selectedWarehouseMode = whId"
                            :class="[
                                'w-full px-2.5 py-1.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 pl-4',
                                selectedWarehouseMode === whId
                                    ? 'bg-primary text-white font-black shadow-sm'
                                    : 'hover:bg-slate-50 text-slate-700 font-bold'
                            ]"
                        >
                            <span class="flex items-center gap-1.5 text-xs truncate">
                                <span class="material-symbols-outlined text-xs">subdirectory_arrow_right</span>
                                <span>{{ whId }}</span>
                            </span>
                            <span class="text-[11px] font-mono font-black shrink-0" :class="selectedWarehouseMode === whId ? 'text-white' : 'text-slate-600'">
                                {{ formatTons(finalTablesByWarehouse[whId].closingStockTons) }} T
                            </span>
                        </button>
                    </div>
                </div>

                <!-- Quick Help / Information -->
                <div class="mt-auto p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-500 font-semibold flex flex-col gap-1">
                    <div class="font-bold text-slate-700 flex items-center gap-1">
                        <span class="material-symbols-outlined text-xs text-primary">info</span>
                        Quy tắc dữ liệu
                    </div>
                    <div>• <b>EASTWOOD</b>: Quản lý độc lập tại Kho 4.</div>
                    <div>• <b>GỖ BÌNH ĐỊNH</b>: Quản lý chung qua 3 Kho 1, 2, 3 và bảng Gộp.</div>
                </div>
            </aside>

            <!-- Main Content Area: KPI Banner + Sheet Tabs + Tables -->
            <div class="flex-1 flex flex-col gap-3.5 min-h-0 overflow-hidden">
                <!-- Card 2: KPI Summary & Config Bar for Active View -->
                <div
                    class="bg-white rounded-[24px] px-4 py-3 border border-primary/5 soft-shadow shrink-0 flex flex-wrap items-center justify-between gap-3"
                >
                    <div class="flex flex-wrap items-center gap-4 md:gap-6">
                        <div>
                            <div class="text-[11px] font-bold text-slate-400 uppercase">Đang xem</div>
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
                                    class="size-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center cursor-pointer"
                                    title="Sửa Tồn đầu kỳ & Tên khách hàng"
                                >
                                    <span class="material-symbols-outlined text-xs">edit</span>
                                </button>
                            </div>
                        </div>

                        <div class="h-7 w-px bg-slate-100 hidden sm:block"></div>

                        <template v-if="selectedWarehouseMode !== 'COMBINED_123'">
                            <div>
                                <div class="text-[11px] font-bold text-slate-400 uppercase">Tồn đầu kỳ</div>
                                <div class="text-sm font-black text-slate-700 font-mono">
                                    {{ formatTons(activeFinalCalc.openingStockBeforeFilter) }} Tấn
                                </div>
                            </div>

                            <div>
                                <div class="text-[11px] font-bold text-slate-400 uppercase">Tổng Nhập ({{ activeFinalCalc.totalImportTrips }} xe)</div>
                                <div class="text-sm font-black text-primary font-mono">
                                    +{{ formatTons(activeFinalCalc.totalImportTons) }} Tấn
                                </div>
                            </div>

                            <div>
                                <div class="text-[11px] font-bold text-slate-400 uppercase">Tổng Xuất Kho ({{ activeFinalCalc.totalExportTrips }} xe)</div>
                                <div class="text-sm font-black text-amber-600 font-mono">
                                    -{{ formatTons(activeFinalCalc.totalExportTons) }} Tấn
                                </div>
                            </div>

                            <div>
                                <div class="text-[11px] font-bold text-slate-400 uppercase">Xá Thẳng ({{ activeFinalCalc.totalDirectTrips }} xe)</div>
                                <div class="text-sm font-black text-purple-600 font-mono">
                                    {{ formatTons(activeFinalCalc.totalDirectTons) }} Tấn
                                </div>
                            </div>

                            <div class="px-3.5 py-1.5 rounded-2xl bg-teal-50 border border-teal-200">
                                <div class="text-[10px] font-black text-teal-700 uppercase">Tồn Kho Chốt 06:00 Sáng</div>
                                <div class="text-base font-black text-teal-700 font-mono">
                                    {{ formatTons(activeFinalCalc.closingStockTons) }} Tấn
                                </div>
                            </div>
                        </template>

                        <template v-else>
                            <div class="px-3.5 py-1.5 rounded-2xl bg-teal-50 border border-teal-200">
                                <div class="text-[10px] font-black text-teal-700 uppercase">Tổng Tồn 3 Kho Chốt 06:00 Sáng</div>
                                <div class="text-base font-black text-teal-700 font-mono">
                                    {{
                                        formatTons(
                                            finalTablesByWarehouse['KHO 1'].closingStockTons +
                                            finalTablesByWarehouse['KHO 2'].closingStockTons +
                                            finalTablesByWarehouse['KHO 3'].closingStockTons
                                        )
                                    }} Tấn
                                </div>
                            </div>
                        </template>
                    </div>

                    <!-- Date range filter for FINAL -->
                    <div class="flex flex-wrap items-center gap-2 text-xs">
                        <span class="font-bold text-slate-500">Lọc ngày:</span>
                        <input
                            v-model="filterFromDate"
                            type="date"
                            class="h-7 px-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-semibold"
                        />
                        <span class="text-slate-400">→</span>
                        <input
                            v-model="filterToDate"
                            type="date"
                            class="h-7 px-2 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs font-semibold"
                        />
                        <button
                            v-if="filterFromDate || filterToDate"
                            @click="filterFromDate = ''; filterToDate = ''"
                            class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
                        >
                            Xóa lọc
                        </button>
                    </div>
                </div>

                <!-- Card 3: Sheet Tabs + Main Table Content -->
                <div class="bg-white rounded-[24px] p-4 border border-primary/5 soft-shadow flex-1 flex flex-col gap-3 min-h-[460px] md:min-h-0 overflow-hidden">
                    <!-- Sheet Tabs Navigation -->
                    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 shrink-0">
                        <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                            <button
                                @click="activeSheetTab = 'FINAL'"
                                :class="[
                                    'px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5',
                                    activeSheetTab === 'FINAL'
                                        ? 'bg-primary text-white shadow-sm'
                                        : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                ]"
                            >
                                <span class="material-symbols-outlined text-sm">table_chart</span>
                                <span>
                                    {{ selectedWarehouseMode === 'COMBINED_123' ? 'FINAL (Gộp Kho 1-2-3)' : `FINAL (${activeSingleWarehouseId})` }}
                                </span>
                            </button>

                            <template v-if="selectedWarehouseMode !== 'COMBINED_123'">
                                <button
                                    @click="activeSheetTab = 'IMPORT'"
                                    :class="[
                                        'px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5',
                                        activeSheetTab === 'IMPORT'
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm">south_west</span>
                                    <span>IMPORT {{ activeSingleWarehouseId.replace('KHO ', '') }} (Nhập kho)</span>
                                </button>

                                <button
                                    @click="activeSheetTab = 'EXPORT'"
                                    :class="[
                                        'px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5',
                                        activeSheetTab === 'EXPORT'
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm">north_east</span>
                                    <span>EXPORT {{ activeSingleWarehouseId.replace('KHO ', '') }} (Xuất kho)</span>
                                </button>
                            </template>

                            <button
                                @click="activeSheetTab = 'DIRECT'"
                                :class="[
                                    'px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5',
                                    activeSheetTab === 'DIRECT'
                                        ? 'bg-primary text-white shadow-sm'
                                        : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                                ]"
                            >
                                <span class="material-symbols-outlined text-sm">bolt</span>
                                <span>XÁ THẲNG ({{ selectedWarehouseMode === 'KHO 4' ? (configs['KHO 4']?.currentCustomer || 'Kho 4') : (configs['KHO 1']?.currentCustomer || 'Kho 1-2-3') }})</span>
                            </button>
                        </div>

                        <!-- Right contextual controls -->
                        <div class="flex items-center gap-2">
                            <button
                                @click="handleClearWarehouseData"
                                class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer"
                                title="Xóa dữ liệu để nạp lại"
                            >
                                <span class="material-symbols-outlined text-sm text-rose-600">delete</span>
                                <span>Xóa Dữ Liệu</span>
                            </button>

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
                    <thead class="sticky top-0 z-10 bg-[#d9e1f2] text-[#1e293b] border-b border-slate-300">
                        <tr>
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
                            <td v-if="showDirectColumnInSingleFinal" class="py-2 px-3 text-right text-slate-400 border-r border-slate-200">-</td>
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
                            <td v-if="showDirectColumnInSingleFinal" class="py-2 px-3 text-right font-mono text-purple-700 border-r border-slate-200">
                                {{ row.directTons > 0 ? formatKg(row.directTons) : '-' }}
                            </td>
                            <td class="py-1.5 px-2">
                                <input
                                    type="text"
                                    :value="row.remark"
                                    :placeholder="row.autoRemark || ''"
                                    @change="handleSaveDailyRemark(activeSingleWarehouseId, row.reportDate, ($event.target as HTMLInputElement).value)"
                                    class="w-full px-2 py-1 rounded-lg bg-transparent hover:bg-slate-100 focus:bg-white focus:border focus:border-primary text-xs font-semibold outline-none transition-all"
                                />
                            </td>
                        </tr>

                        <tr v-if="activeFinalCalc.rows.length === 0">
                            <td :colspan="showDirectColumnInSingleFinal ? 6 : 5" class="py-12 text-center text-slate-400 font-semibold">
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
                            <td v-if="showDirectColumnInSingleFinal" class="py-2.5 px-3 text-right font-mono border-r border-slate-300">
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
                        <div class="bg-[#d9e1f2] px-3 py-2 border-b border-slate-300 flex items-center justify-between">
                            <span class="text-xs font-black text-[#1e293b]">
                                {{ whId }} ({{ configs[whId]?.currentCustomer || 'GỖ BÌNH ĐỊNH' }})
                            </span>
                            <span class="text-xs font-black text-teal-800 font-mono">
                                Tồn: {{ formatTons(finalTablesByWarehouse[whId].closingStockTons) }} T
                            </span>
                        </div>
                        <table class="w-full text-left border-collapse text-[11px] font-bold">
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
                                        {{ formatTons(finalTablesByWarehouse[whId].openingStockBeforeFilter) }}
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
                                        {{ r.importTons > 0 ? formatTons(r.importTons) : '-' }}
                                    </td>
                                    <td class="py-1.5 px-2 text-right font-mono text-amber-700 border-r border-slate-200">
                                        {{ r.exportTons > 0 ? formatTons(r.exportTons) : '-' }}
                                    </td>
                                    <td class="py-1.5 px-2 text-right font-mono font-black text-teal-800 bg-teal-50/30 border-r border-slate-200">
                                        {{ formatTons(r.remainingStockTons) }}
                                    </td>
                                    <td class="py-1 px-1.5">
                                        <input
                                            type="text"
                                            :value="r.remark"
                                            @change="handleSaveDailyRemark(whId, r.reportDate, ($event.target as HTMLInputElement).value)"
                                            class="w-full px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-[11px] font-semibold outline-none"
                                        />
                                    </td>
                                </tr>
                            </tbody>
                            <tfoot class="bg-[#fff2cc] font-black border-t border-slate-300">
                                <tr>
                                    <td class="py-2 px-2 text-center border-r border-slate-300">TỔNG CỘNG</td>
                                    <td class="py-2 px-2 text-right font-mono border-r border-slate-300">
                                        {{ formatTons(finalTablesByWarehouse[whId].totalImportTons) }}
                                    </td>
                                    <td class="py-2 px-2 text-right font-mono border-r border-slate-300">
                                        {{ formatTons(finalTablesByWarehouse[whId].totalExportTons) }}
                                    </td>
                                    <td class="py-2 px-2 text-right font-mono text-teal-900 border-r border-slate-300">
                                        {{ formatTons(finalTablesByWarehouse[whId].closingStockTons) }}
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
                <table class="w-full text-left border-collapse text-xs font-bold whitespace-nowrap">
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
                            <th class="py-2.5 px-2 border-r border-slate-300">Ghi chú 2</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Nhà xe</th>
                            <th class="py-2.5 px-2 text-center w-12">Xóa</th>
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
                                <button
                                    @click="handleDeleteTicket(t)"
                                    class="size-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 inline-flex items-center justify-center cursor-pointer"
                                >
                                    <span class="material-symbols-outlined text-sm">delete</span>
                                </button>
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
                <!-- Quick Batch Vessel Bar -->
                <div class="flex flex-wrap items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 shrink-0 text-xs">
                    <span class="font-bold text-slate-600">Gán nhanh tên Tàu mẹ cho các chuyến đang lọc:</span>
                    <input
                        v-model="batchVesselName"
                        type="text"
                        placeholder="VD: MV. HENG SHUN - BẮC VÂN PHONG"
                        class="h-7 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold w-64"
                    />
                    <button
                        @click="handleBatchAssignVessel"
                        class="h-7 px-3 bg-primary text-white font-bold rounded-lg text-xs hover:bg-[#3b5e9c] cursor-pointer"
                    >
                        Gán cho {{ filteredDetailTickets.length }} chuyến
                    </button>
                </div>

                <div class="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white">
                    <table class="w-full text-left border-collapse text-xs font-bold whitespace-nowrap">
                        <thead class="sticky top-0 z-10 bg-[#fff2cc] text-[#1e293b] border-b border-slate-300">
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
                                <th class="py-2.5 px-2 text-center w-12">Xóa</th>
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
                                    <button
                                        @click="handleDeleteTicket(t)"
                                        class="size-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 inline-flex items-center justify-center cursor-pointer"
                                    >
                                        <span class="material-symbols-outlined text-sm">delete</span>
                                    </button>
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
                <table class="w-full text-left border-collapse text-xs font-bold whitespace-nowrap">
                    <thead class="sticky top-0 z-10 bg-[#fff2cc] text-[#1e293b] border-b border-slate-300">
                        <tr>
                            <th class="py-2.5 px-2 text-center w-12 border-r border-slate-300">STT<br /><span class="font-semibold text-[10px]">(No)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày nhập<br /><span class="font-semibold text-[10px]">Date</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Số phiếu<br /><span class="font-semibold text-[10px]">(Serial)</span></th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Số xe<br /><span class="font-semibold text-[10px]">(Truck no)</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng vào<br /><span class="font-semibold text-[10px]">(Weight in)</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng ra<br /><span class="font-semibold text-[10px]">(Weight out)</span></th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">T.Lượng hàng<br /><span class="font-semibold text-[10px]">(N.Weight)</span></th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Nhập/ Xuất</th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày cân vào</th>
                            <th class="py-2.5 px-2 text-center border-r border-slate-300">Ngày cân ra</th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">Cân Nhà Máy</th>
                            <th class="py-2.5 px-2 text-right border-r border-slate-300">Chênh lệch</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Ghi chú</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Nơi nhận</th>
                            <th class="py-2.5 px-2 border-r border-slate-300">Tàu</th>
                            <th class="py-2.5 px-2 text-center w-12">Xóa</th>
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
                            <td class="py-2 px-2 text-center text-slate-600">{{ t.maLenh || '-' }}</td>
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
                                <button
                                    @click="handleDeleteTicket(t)"
                                    class="size-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 inline-flex items-center justify-center cursor-pointer"
                                >
                                    <span class="material-symbols-outlined text-sm">delete</span>
                                </button>
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
                            <td colspan="3" class="py-2.5 px-2 border-r border-slate-300"></td>
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
                    <h3 class="text-lg font-black text-[#1e293b]">
                        Cấu hình {{ editingConfigForm.warehouseId }}
                    </h3>
                    <button
                        @click="showConfigModal = false"
                        class="size-8 rounded-full bg-[#f1f5f9] flex items-center justify-center text-slate-500 hover:text-rose-600 cursor-pointer"
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
                        <span class="text-[11px] text-slate-400 font-normal">
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
                        class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs cursor-pointer"
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
                    <h3 class="text-lg font-black text-[#1e293b]">
                        Đổi Tên Khách Hàng ({{ editingCustomerGroup === 'KHO_4' ? 'Kho 4' : 'Kho 1 - 2 - 3' }})
                    </h3>
                    <button
                        @click="showEditCustomerModal = false"
                        class="size-8 rounded-full bg-[#f1f5f9] flex items-center justify-center text-slate-500 hover:text-rose-600 cursor-pointer"
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
                        <span class="text-[11px] text-slate-400 font-normal">
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
                        class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs cursor-pointer"
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
    </div>
</template>

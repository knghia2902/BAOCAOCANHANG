<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import {
    WarehouseInventoryService,
    ALL_WAREHOUSES,
    computeWarehouseFinalTable,
    formatIsoToDmy
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
type SheetTabMode = 'FINAL' | 'IMPORT' | 'EXPORT' | 'DIRECT' | 'DATA';

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

// Vehicle Data tab states
const newVehiclePlate = ref('');
const newVehicleCarrier = ref('');
const bulkVehiclePasteText = ref('');
const showBulkPasteBox = ref(false);

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
            return t.flowType === 'DIRECT';
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

const vehiclesList = computed(() => {
    const q = detailSearchQuery.value.trim().toLowerCase();
    const arr = Object.values(vehiclesMap.value).sort((a, b) =>
        a.displayPlate.localeCompare(b.displayPlate)
    );
    if (!q) return arr;
    return arr.filter(v =>
        v.displayPlate.toLowerCase().includes(q) ||
        v.carrierName.toLowerCase().includes(q)
    );
});

function formatTons(val: number | undefined | null): string {
    const num = Number(val) || 0;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        if (summary.syncedToAllocatorCount > 0 || summary.matchedBargesCount > 0) {
            msgParts.push(`Đồng bộ ${summary.syncedToAllocatorCount} chuyến Xuất sang Báo cáo cân hàng (${summary.matchedBargesCount} sà lan khớp lệnh)`);
            emit('synced-to-allocator', {
                syncedTicketsCount: summary.syncedToAllocatorCount,
                matchedBargesCount: summary.matchedBargesCount
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

// Vehicle Data management
async function handleAddSingleVehicle() {
    if (!newVehiclePlate.value.trim() || !newVehicleCarrier.value.trim()) {
        addToast('Vui lòng nhập đầy đủ Biển số xe và Tên nhà xe!', 'info');
        return;
    }
    await WarehouseInventoryService.saveVehiclesBulk([
        {
            vehiclePlate: newVehiclePlate.value.trim(),
            displayPlate: newVehiclePlate.value.trim().toUpperCase(),
            carrierName: newVehicleCarrier.value.trim().toUpperCase()
        }
    ]);
    newVehiclePlate.value = '';
    newVehicleCarrier.value = '';
    vehiclesMap.value = await WarehouseInventoryService.getVehicles();
    const updatedCount = await WarehouseInventoryService.reapplyVehicleCarriers();
    if (updatedCount > 0) {
        allTickets.value = await WarehouseInventoryService.getAllTickets();
    }
    addToast(`Đã lưu nhà xe và tự động điền cho ${updatedCount} phiếu cân!`, 'success');
}

async function handleBulkPasteVehicles() {
    const lines = bulkVehiclePasteText.value.split(/\r?\n/).filter(l => l.trim());
    const items: WarehouseVehicleMap[] = [];
    for (const line of lines) {
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        if (parts.length >= 2) {
            const plate = (parts[0] || '').trim();
            const carrier = (parts[1] || '').trim();
            if (plate && carrier) {
                items.push({
                    vehiclePlate: plate,
                    displayPlate: plate.toUpperCase(),
                    carrierName: carrier.toUpperCase()
                });
            }
        }
    }
    if (items.length === 0) {
        addToast('Không tìm thấy dòng hợp lệ! Hãy dán 2 cột: Số xe [Tab/Phẩy] Nhà xe', 'error');
        return;
    }
    const count = await WarehouseInventoryService.saveVehiclesBulk(items);
    vehiclesMap.value = await WarehouseInventoryService.getVehicles();
    const updatedTickets = await WarehouseInventoryService.reapplyVehicleCarriers();
    allTickets.value = await WarehouseInventoryService.getAllTickets();
    bulkVehiclePasteText.value = '';
    showBulkPasteBox.value = false;
    addToast(`Đã nạp ${count} xe vào Data và cập nhật nhà xe cho ${updatedTickets} phiếu!`, 'success');
}

async function handleDeleteVehicle(plateKey: string) {
    await WarehouseInventoryService.deleteVehicle(plateKey);
    vehiclesMap.value = await WarehouseInventoryService.getVehicles();
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
                        Báo Cáo Tồn Kho 4 Kho & Xuất Thẳng Sà Lan
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
                        title="Hút toàn bộ lịch sử IMPORT, EXPORT, ĐI THẲNG, Data (Nhà xe) và Ghi chú từ file Excel Báo cáo Tồn kho đang dùng"
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
                </div>
            </div>

            <!-- Warehouse Selector Strip (KHO 1..4 + GỘP KHO 1-2-3) -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
                <button
                    v-for="whId in ALL_WAREHOUSES"
                    :key="whId"
                    @click="selectedWarehouseMode = whId"
                    :class="[
                        'p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1',
                        selectedWarehouseMode === whId
                            ? 'bg-primary text-white border-primary shadow-md'
                            : 'bg-[#f8fafc] hover:bg-[#e2ecfc]/50 text-[#1e293b] border-slate-200'
                    ]"
                >
                    <div class="flex items-center justify-between gap-1">
                        <span class="text-xs font-black tracking-wide">{{ whId }}</span>
                        <span
                            :class="[
                                'px-2 py-0.5 rounded-full text-[10px] font-bold truncate max-w-[110px]',
                                selectedWarehouseMode === whId
                                    ? 'bg-white/20 text-white'
                                    : 'bg-primary/10 text-primary'
                            ]"
                        >
                            {{ configs[whId]?.currentCustomer || 'Chưa gán KH' }}
                        </span>
                    </div>
                    <div class="flex items-baseline justify-between mt-0.5">
                        <span :class="['text-[11px] font-semibold', selectedWarehouseMode === whId ? 'text-white/80' : 'text-slate-500']">
                            Tồn hiện tại:
                        </span>
                        <span class="text-sm font-black font-mono">
                            {{ formatTons(finalTablesByWarehouse[whId].closingStockTons) }} T
                        </span>
                    </div>
                </button>

                <!-- Combined 1-2-3 Mode Button -->
                <button
                    @click="selectedWarehouseMode = 'COMBINED_123'; activeSheetTab = 'FINAL'"
                    :class="[
                        'p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1',
                        selectedWarehouseMode === 'COMBINED_123'
                            ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                            : 'bg-teal-50/60 hover:bg-teal-100/70 text-teal-900 border-teal-200'
                    ]"
                >
                    <div class="flex items-center justify-between gap-1">
                        <span class="text-xs font-black">GỘP KHO 1 - 2 - 3</span>
                        <span class="material-symbols-outlined text-sm">view_column</span>
                    </div>
                    <div class="flex items-baseline justify-between mt-0.5">
                        <span :class="['text-[11px] font-semibold', selectedWarehouseMode === 'COMBINED_123' ? 'text-white/80' : 'text-teal-700']">
                            Tổng tồn 1+2+3:
                        </span>
                        <span class="text-sm font-black font-mono">
                            {{
                                formatTons(
                                    finalTablesByWarehouse['KHO 1'].closingStockTons +
                                    finalTablesByWarehouse['KHO 2'].closingStockTons +
                                    finalTablesByWarehouse['KHO 3'].closingStockTons
                                )
                            }} T
                        </span>
                    </div>
                </button>
            </div>
        </div>

        <!-- Card 2: KPI Summary & Config Bar for Active Single Warehouse -->
        <div
            v-if="selectedWarehouseMode !== 'COMBINED_123'"
            class="bg-white rounded-[24px] px-4 py-3 border border-primary/5 soft-shadow shrink-0 flex flex-wrap items-center justify-between gap-3"
        >
            <div class="flex flex-wrap items-center gap-4 md:gap-6">
                <div>
                    <div class="text-[11px] font-bold text-slate-400 uppercase">Kho & Khách hàng</div>
                    <div class="text-sm font-black text-[#1e293b] flex items-center gap-1.5">
                        <span>{{ activeSingleWarehouseId }}</span>
                        <span class="text-primary">({{ configs[activeSingleWarehouseId]?.currentCustomer || 'Chưa gán' }})</span>
                        <button
                            @click="openEditConfigModal(activeSingleWarehouseId)"
                            class="size-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center cursor-pointer"
                            title="Sửa Tồn đầu kỳ & Tên khách hàng"
                        >
                            <span class="material-symbols-outlined text-xs">edit</span>
                        </button>
                    </div>
                </div>

                <div class="h-7 w-px bg-slate-100 hidden sm:block"></div>

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
                        <span>ĐI THẲNG / XÁ THẲNG</span>
                    </button>

                    <button
                        @click="activeSheetTab = 'DATA'"
                        :class="[
                            'px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5',
                            activeSheetTab === 'DATA'
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-[#f1f5f9] text-slate-600 hover:bg-slate-200'
                        ]"
                    >
                        <span class="material-symbols-outlined text-sm">local_shipping</span>
                        <span>Data Nhà Xe ({{ Object.keys(vehiclesMap).length }})</span>
                    </button>
                </div>

                <!-- Right contextual controls -->
                <div v-if="activeSheetTab === 'FINAL' && selectedWarehouseMode !== 'COMBINED_123'" class="flex items-center gap-2">
                    <label class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer select-none">
                        <input
                            v-model="showDirectColumnInSingleFinal"
                            type="checkbox"
                            class="rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span>Hiển thị cột Xá thẳng</span>
                    </label>
                </div>

                <div v-else-if="activeSheetTab === 'IMPORT' || activeSheetTab === 'EXPORT' || activeSheetTab === 'DIRECT'" class="flex flex-wrap items-center gap-2">
                    <div class="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-xs font-black">
                        {{ filteredDetailTickets.length }} chuyến • {{ formatTons(detailTotalTons) }} Tấn
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
                            <th class="py-2.5 px-3 text-center w-14 border-r border-slate-300">STT</th>
                            <th class="py-2.5 px-3 text-center w-32 border-r border-slate-300">Ngày (Ca 6h)</th>
                            <th class="py-2.5 px-3 text-right w-36 border-r border-slate-300">Nhập (Tấn)</th>
                            <th class="py-2.5 px-3 text-right w-36 border-r border-slate-300">Xuất (Tấn)</th>
                            <th v-if="showDirectColumnInSingleFinal" class="py-2.5 px-3 text-right w-36 border-r border-slate-300">Xá thẳng (Tấn)</th>
                            <th class="py-2.5 px-3 text-right w-40 border-r border-slate-300 bg-teal-100/70 text-teal-900">Tồn kho (Tấn)</th>
                            <th class="py-2.5 px-3 text-left">Ghi chú (Bấm để sửa trực tiếp)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
                        <!-- Opening Stock Row -->
                        <tr class="bg-slate-50 font-black">
                            <td class="py-2 px-3 text-center text-slate-400 border-r border-slate-200">-</td>
                            <td class="py-2 px-3 text-center text-slate-700 border-r border-slate-200">Tồn đầu</td>
                            <td class="py-2 px-3 text-right text-slate-400 border-r border-slate-200">-</td>
                            <td class="py-2 px-3 text-right text-slate-400 border-r border-slate-200">-</td>
                            <td v-if="showDirectColumnInSingleFinal" class="py-2 px-3 text-right text-slate-400 border-r border-slate-200">-</td>
                            <td class="py-2 px-3 text-right font-mono text-teal-800 bg-teal-50/50 border-r border-slate-200">
                                {{ formatTons(activeFinalCalc.openingStockBeforeFilter) }}
                            </td>
                            <td class="py-2 px-3 text-slate-500 italic">
                                {{ configs[activeSingleWarehouseId]?.initialDate ? `Mốc tồn đầu: ${configs[activeSingleWarehouseId].initialDate}` : 'Tồn đầu kỳ lũy kế' }}
                            </td>
                        </tr>

                        <tr
                            v-for="(row, idx) in activeFinalCalc.rows"
                            :key="row.reportDate"
                            class="hover:bg-gray-50 transition-colors"
                        >
                            <td class="py-2 px-3 text-center text-slate-500 border-r border-slate-200">{{ idx + 1 }}</td>
                            <td class="py-2 px-3 text-center font-mono text-[#1e293b] border-r border-slate-200">
                                {{ row.displayDate }}
                            </td>
                            <td class="py-2 px-3 text-right font-mono text-primary border-r border-slate-200">
                                {{ row.importTons > 0 ? formatTons(row.importTons) : '-' }}
                                <span v-if="row.importTrips > 0" class="text-[10px] text-slate-400 ml-1">({{ row.importTrips }}x)</span>
                            </td>
                            <td class="py-2 px-3 text-right font-mono text-amber-700 border-r border-slate-200">
                                {{ row.exportTons > 0 ? formatTons(row.exportTons) : '-' }}
                                <span v-if="row.exportTrips > 0" class="text-[10px] text-slate-400 ml-1">({{ row.exportTrips }}x)</span>
                            </td>
                            <td v-if="showDirectColumnInSingleFinal" class="py-2 px-3 text-right font-mono text-purple-700 border-r border-slate-200">
                                {{ row.directTons > 0 ? formatTons(row.directTons) : '-' }}
                            </td>
                            <td class="py-2 px-3 text-right font-mono font-black text-teal-800 bg-teal-50/40 border-r border-slate-200">
                                {{ formatTons(row.remainingStockTons) }}
                            </td>
                            <td class="py-1.5 px-2">
                                <input
                                    type="text"
                                    :value="row.remark"
                                    :placeholder="row.autoRemark || 'Nhập ghi chú tàu xuất / lô hàng...'"
                                    @change="handleSaveDailyRemark(activeSingleWarehouseId, row.reportDate, ($event.target as HTMLInputElement).value)"
                                    class="w-full px-2 py-1 rounded-lg bg-transparent hover:bg-slate-100 focus:bg-white focus:border focus:border-primary text-xs font-semibold outline-none transition-all"
                                />
                            </td>
                        </tr>

                        <tr v-if="activeFinalCalc.rows.length === 0">
                            <td :colspan="showDirectColumnInSingleFinal ? 7 : 6" class="py-12 text-center text-slate-400 font-semibold">
                                Chưa có dữ liệu phát sinh cho {{ activeSingleWarehouseId }}. Hãy bấm <b>"Nạp CSV Trạm Cân"</b> hoặc <b>"Nạp từ Excel Tồn Kho Đang Dùng"</b> ở góc trên!
                            </td>
                        </tr>
                    </tbody>
                    <tfoot class="sticky bottom-0 bg-[#fff2cc] text-[#1e293b] font-black border-t-2 border-slate-400">
                        <tr>
                            <td class="py-2.5 px-3 text-center border-r border-slate-300"></td>
                            <td class="py-2.5 px-3 text-center border-r border-slate-300">TỔNG CỘNG</td>
                            <td class="py-2.5 px-3 text-right font-mono border-r border-slate-300">
                                {{ formatTons(activeFinalCalc.totalImportTons) }}
                            </td>
                            <td class="py-2.5 px-3 text-right font-mono border-r border-slate-300">
                                {{ formatTons(activeFinalCalc.totalExportTons) }}
                            </td>
                            <td v-if="showDirectColumnInSingleFinal" class="py-2.5 px-3 text-right font-mono border-r border-slate-300">
                                {{ formatTons(activeFinalCalc.totalDirectTons) }}
                            </td>
                            <td class="py-2.5 px-3 text-right font-mono text-teal-900 border-r border-slate-300">
                                {{ formatTons(activeFinalCalc.closingStockTons) }}
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
                <table class="w-full text-left border-collapse text-xs font-bold">
                    <thead class="sticky top-0 z-10 bg-gray-50 text-slate-600 border-b border-slate-200">
                        <tr>
                            <th class="py-2.5 px-3 text-center w-12">STT</th>
                            <th class="py-2.5 px-3 text-center">Ngày (Ca 6h)</th>
                            <th class="py-2.5 px-3 text-center">Số phiếu</th>
                            <th class="py-2.5 px-3">Số xe</th>
                            <th class="py-2.5 px-3">Nhà xe</th>
                            <th class="py-2.5 px-3 text-right">TL Hàng (Tấn)</th>
                            <th class="py-2.5 px-3 text-center">Giờ cân ra</th>
                            <th class="py-2.5 px-3">Nhà máy / Ghi chú (Tai Xe)</th>
                            <th class="py-2.5 px-3 text-right">KL Phiếu (Tấn)</th>
                            <th class="py-2.5 px-3 text-right">Chênh lệch</th>
                            <th class="py-2.5 px-3 text-center w-16">Xóa</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr
                            v-for="(t, idx) in filteredDetailTickets"
                            :key="t.id"
                            class="hover:bg-gray-50 transition-colors"
                        >
                            <td class="py-2 px-3 text-center text-slate-400">{{ idx + 1 }}</td>
                            <td class="py-2 px-3 text-center font-mono">{{ formatIsoToDmy(t.reportDate) }}</td>
                            <td class="py-2 px-3 text-center font-mono text-slate-600">{{ t.soPhieu }}</td>
                            <td class="py-2 px-3 font-mono font-black">{{ t.vehiclePlate }}</td>
                            <td class="py-2 px-3">
                                <input
                                    v-model="t.carrierName"
                                    type="text"
                                    placeholder="-"
                                    @change="handleUpdateTicketField(t)"
                                    class="w-28 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-bold outline-none"
                                />
                            </td>
                            <td class="py-2 px-3 text-right font-mono text-primary font-black">{{ formatTons(t.netWeight) }}</td>
                            <td class="py-2 px-3 text-center font-mono text-slate-500">{{ t.weighOutTime }}</td>
                            <td class="py-2 px-3">
                                <input
                                    v-model="t.sourceOrRemark"
                                    type="text"
                                    @change="handleUpdateTicketField(t)"
                                    class="w-36 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-3 text-right">
                                <input
                                    v-model.number="t.factoryWeight"
                                    type="number"
                                    step="0.01"
                                    placeholder="-"
                                    @change="handleUpdateTicketField(t)"
                                    class="w-20 px-1.5 py-0.5 text-right rounded bg-slate-50 border border-slate-200 font-mono text-xs"
                                />
                            </td>
                            <td class="py-2 px-3 text-right font-mono" :class="t.factoryWeight ? (t.netWeight - t.factoryWeight < 0 ? 'text-rose-600' : 'text-teal-600') : 'text-slate-400'">
                                {{ t.factoryWeight ? formatTons(t.netWeight - t.factoryWeight) : '-' }}
                            </td>
                            <td class="py-2 px-3 text-center">
                                <button
                                    @click="handleDeleteTicket(t)"
                                    class="size-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 inline-flex items-center justify-center cursor-pointer"
                                >
                                    <span class="material-symbols-outlined text-sm">delete</span>
                                </button>
                            </td>
                        </tr>
                    </tbody>
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
                    <table class="w-full text-left border-collapse text-xs font-bold">
                        <thead class="sticky top-0 z-10 bg-gray-50 text-slate-600 border-b border-slate-200">
                            <tr>
                                <th class="py-2.5 px-3 text-center w-12">STT</th>
                                <th class="py-2.5 px-3 text-center">Ngày (Ca 6h)</th>
                                <th class="py-2.5 px-3 text-center">Số phiếu</th>
                                <th class="py-2.5 px-3">Số xe</th>
                                <th class="py-2.5 px-3">Nhà xe</th>
                                <th class="py-2.5 px-3 text-right">TL Hàng (Tấn)</th>
                                <th class="py-2.5 px-3">Sà lan (Loai Salan)</th>
                                <th class="py-2.5 px-3">Tàu (Vessel)</th>
                                <th class="py-2.5 px-3 text-center">Giờ cân ra</th>
                                <th class="py-2.5 px-3">Khách hàng</th>
                                <th class="py-2.5 px-3 text-center w-16">Xóa</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr
                                v-for="(t, idx) in filteredDetailTickets"
                                :key="t.id"
                                class="hover:bg-gray-50 transition-colors"
                            >
                                <td class="py-2 px-3 text-center text-slate-400">{{ idx + 1 }}</td>
                                <td class="py-2 px-3 text-center font-mono">{{ formatIsoToDmy(t.reportDate) }}</td>
                                <td class="py-2 px-3 text-center font-mono text-slate-600">{{ t.soPhieu }}</td>
                                <td class="py-2 px-3 font-mono font-black">{{ t.vehiclePlate }}</td>
                                <td class="py-2 px-3">{{ t.carrierName || '-' }}</td>
                                <td class="py-2 px-3 text-right font-mono text-amber-700 font-black">{{ formatTons(t.netWeight) }}</td>
                                <td class="py-2 px-3 text-teal-700">{{ t.bargeInfo || '-' }}</td>
                                <td class="py-2 px-3">
                                    <input
                                        v-model="t.vesselName"
                                        type="text"
                                        placeholder="Nhập tên tàu..."
                                        @change="handleUpdateTicketField(t)"
                                        class="w-44 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                    />
                                </td>
                                <td class="py-2 px-3 text-center font-mono text-slate-500">{{ t.weighOutTime }}</td>
                                <td class="py-2 px-3">{{ t.customerName }}</td>
                                <td class="py-2 px-3 text-center">
                                    <button
                                        @click="handleDeleteTicket(t)"
                                        class="size-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 inline-flex items-center justify-center cursor-pointer"
                                    >
                                        <span class="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- TAB 4: DIRECT / XÁ THẲNG DETAILS -->
            <div
                v-else-if="activeSheetTab === 'DIRECT'"
                class="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white"
            >
                <table class="w-full text-left border-collapse text-xs font-bold">
                    <thead class="sticky top-0 z-10 bg-gray-50 text-slate-600 border-b border-slate-200">
                        <tr>
                            <th class="py-2.5 px-3 text-center w-12">STT</th>
                            <th class="py-2.5 px-3 text-center">Ngày (Ca 6h)</th>
                            <th class="py-2.5 px-3 text-center">Số phiếu</th>
                            <th class="py-2.5 px-3">Số xe</th>
                            <th class="py-2.5 px-3">Nhà xe</th>
                            <th class="py-2.5 px-3 text-right">TL Hàng (Tấn)</th>
                            <th class="py-2.5 px-3">Sà lan</th>
                            <th class="py-2.5 px-3">Tàu</th>
                            <th class="py-2.5 px-3 text-center">Giờ cân ra</th>
                            <th class="py-2.5 px-3">Nguồn đi thẳng (Tai Xe)</th>
                            <th class="py-2.5 px-3">Khách hàng</th>
                            <th class="py-2.5 px-3 text-center w-16">Xóa</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr
                            v-for="(t, idx) in filteredDetailTickets"
                            :key="t.id"
                            class="hover:bg-gray-50 transition-colors"
                        >
                            <td class="py-2 px-3 text-center text-slate-400">{{ idx + 1 }}</td>
                            <td class="py-2 px-3 text-center font-mono">{{ formatIsoToDmy(t.reportDate) }}</td>
                            <td class="py-2 px-3 text-center font-mono text-slate-600">{{ t.soPhieu }}</td>
                            <td class="py-2 px-3 font-mono font-black">{{ t.vehiclePlate }}</td>
                            <td class="py-2 px-3">{{ t.carrierName || '-' }}</td>
                            <td class="py-2 px-3 text-right font-mono text-purple-700 font-black">{{ formatTons(t.netWeight) }}</td>
                            <td class="py-2 px-3 text-teal-700">{{ t.bargeInfo || '-' }}</td>
                            <td class="py-2 px-3">
                                <input
                                    v-model="t.vesselName"
                                    type="text"
                                    placeholder="Nhập tên tàu..."
                                    @change="handleUpdateTicketField(t)"
                                    class="w-40 px-1.5 py-0.5 rounded bg-transparent hover:bg-slate-100 focus:bg-white text-xs font-semibold outline-none"
                                />
                            </td>
                            <td class="py-2 px-3 text-center font-mono text-slate-500">{{ t.weighOutTime }}</td>
                            <td class="py-2 px-3 font-semibold text-amber-800">{{ t.sourceOrRemark }}</td>
                            <td class="py-2 px-3">{{ t.customerName }}</td>
                            <td class="py-2 px-3 text-center">
                                <button
                                    @click="handleDeleteTicket(t)"
                                    class="size-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 inline-flex items-center justify-center cursor-pointer"
                                >
                                    <span class="material-symbols-outlined text-sm">delete</span>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- TAB 5: DATA (VEHICLE -> CARRIER MAPPING) -->
            <div
                v-else-if="activeSheetTab === 'DATA'"
                class="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden"
            >
                <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 shrink-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <input
                            v-model="newVehiclePlate"
                            type="text"
                            placeholder="Biển số xe (VD: 50H-235.64)"
                            class="h-8 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold w-44"
                        />
                        <input
                            v-model="newVehicleCarrier"
                            type="text"
                            placeholder="Nhà xe (VD: NGUYÊN NGỌC)"
                            class="h-8 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold w-48"
                        />
                        <button
                            @click="handleAddSingleVehicle"
                            class="h-8 px-3.5 bg-primary text-white font-bold rounded-xl text-xs cursor-pointer"
                        >
                            + Thêm Xe
                        </button>
                        <button
                            @click="showBulkPasteBox = !showBulkPasteBox"
                            class="h-8 px-3.5 bg-white border border-primary/20 text-primary font-bold rounded-xl text-xs cursor-pointer"
                        >
                            Dán nhanh từ Excel (2 cột)
                        </button>
                    </div>

                    <input
                        v-model="detailSearchQuery"
                        type="text"
                        placeholder="Tìm biển số hoặc nhà xe..."
                        class="h-8 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold w-52"
                    />
                </div>

                <div v-if="showBulkPasteBox" class="bg-slate-50 p-3 rounded-2xl border border-primary/20 flex flex-col gap-2 shrink-0">
                    <div class="text-xs font-bold text-slate-600">
                        Copy 2 cột <b>SỐ XE</b> và <b>NHÀ XE</b> từ sheet Data trong Excel và dán vào ô bên dưới:
                    </div>
                    <textarea
                        v-model="bulkVehiclePasteText"
                        rows="4"
                        placeholder="50H-235.64&#9;NGUYÊN NGỌC&#10;77H-046.90&#9;TẤN PHÁT"
                        class="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                    ></textarea>
                    <div class="flex justify-end gap-2">
                        <button
                            @click="showBulkPasteBox = false"
                            class="px-3 py-1.5 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                        >
                            Đóng
                        </button>
                        <button
                            @click="handleBulkPasteVehicles"
                            class="px-4 py-1.5 bg-primary text-white font-bold rounded-xl text-xs cursor-pointer"
                        >
                            Lưu danh sách xe
                        </button>
                    </div>
                </div>

                <div class="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white">
                    <table class="w-full text-left border-collapse text-xs font-bold">
                        <thead class="sticky top-0 z-10 bg-gray-50 text-slate-600 border-b border-slate-200">
                            <tr>
                                <th class="py-2.5 px-3 text-center w-16">STT</th>
                                <th class="py-2.5 px-3">SỐ XE (Biển số hiển thị)</th>
                                <th class="py-2.5 px-3">Mã tra cứu chuẩn hóa</th>
                                <th class="py-2.5 px-3">NHÀ XE</th>
                                <th class="py-2.5 px-3 text-center w-20">Xóa</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr
                                v-for="(v, idx) in vehiclesList"
                                :key="v.vehiclePlate"
                                class="hover:bg-gray-50"
                            >
                                <td class="py-2 px-3 text-center text-slate-400">{{ idx + 1 }}</td>
                                <td class="py-2 px-3 font-mono font-black">{{ v.displayPlate }}</td>
                                <td class="py-2 px-3 font-mono text-slate-500">{{ v.vehiclePlate }}</td>
                                <td class="py-2 px-3 text-primary font-black">{{ v.carrierName }}</td>
                                <td class="py-2 px-3 text-center">
                                    <button
                                        @click="handleDeleteVehicle(v.vehiclePlate)"
                                        class="size-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 inline-flex items-center justify-center cursor-pointer"
                                    >
                                        <span class="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
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
    </div>
</template>

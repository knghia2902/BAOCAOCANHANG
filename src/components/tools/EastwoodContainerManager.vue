<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { authStore, hasDetailPermission } from '@/stores/auth';
import {
    EastwoodContainerService,
    classifyEastwoodContainerRow,
    computeContainerStatuses,
    computeContainerDailyReport,
    formatEventDatetimeDisplay
} from '@/services/excel/EastwoodContainerService';
import {
    parseWeighbridgeFile,
    formatIsoToDmy
} from '@/services/excel/WarehouseInventoryService';
import { WeighbridgeService, type Vessel } from '@/services/weighbridge/WeighbridgeService';
import type {
    EastwoodContainerEvent,
    EastwoodContainerStatus,
    EastwoodContainerYardSummary
} from '@/types/excel';

const emit = defineEmits<{
    (e: 'summary-updated', summary: EastwoodContainerYardSummary): void;
}>();

const { addToast } = useToast();

const canImport = computed(() => authStore.role === 'admin' || hasDetailPermission('warehouse', 'wh_import', 'create'));
const canExport = computed(() => authStore.role === 'admin' || hasDetailPermission('warehouse', 'wh_export', 'read'));
const canDelete = computed(() => authStore.role === 'admin' || hasDetailPermission('warehouse', 'wh_delete_tickets', 'delete'));

type ContainerTabMode = 'REPORT' | 'STATUS' | 'HA_CONT' | 'LOAD_CONT' | 'TRA_CONT';

const activeTab = ref<ContainerTabMode>('STATUS');
const events = ref<EastwoodContainerEvent[]>([]);
const loading = ref(false);
const importingHistory = ref(false);
const importingScale = ref(false);
const exportingExcel = ref(false);

const searchQuery = ref('');
const fromDate = ref('');
const toDate = ref('');
const statusFilter = ref<'ALL' | EastwoodContainerStatus>('ALL');
const currentPage = ref(1);
const pageSize = 50;

const historyExcelInputRef = ref<HTMLInputElement | null>(null);
const scaleFileInputRef = ref<HTMLInputElement | null>(null);

// Edit modal state
const showEditModal = ref(false);
const editingEvent = ref<EastwoodContainerEvent | null>(null);
const savingEdit = ref(false);

const syncChannel = new BroadcastChannel('allocator_sync_channel');
syncChannel.onmessage = async (ev) => {
    if (ev.data?.type === 'eastwood_containers_updated') {
        await loadEvents();
    }
};

onUnmounted(() => {
    try {
        syncChannel.close();
    } catch (_) {}
});

watch([activeTab, searchQuery, fromDate, toDate, statusFilter], () => {
    currentPage.value = 1;
});

const statusComputed = computed(() => computeContainerStatuses(events.value));

const yardSummary = computed<EastwoodContainerYardSummary>(() => statusComputed.value.summary);

watch(yardSummary, (val) => {
    emit('summary-updated', val);
}, { immediate: true, deep: true });

const dailyReportComputed = computed(() =>
    computeContainerDailyReport(events.value, {
        fromDate: fromDate.value || undefined,
        toDate: toDate.value || undefined
    })
);

const filteredStatusRows = computed(() => {
    const q = searchQuery.value.trim().toUpperCase();
    return statusComputed.value.rows.filter(r => {
        if (statusFilter.value !== 'ALL' && r.status !== statusFilter.value) return false;
        if (fromDate.value && r.latestActualDate && r.latestActualDate < fromDate.value) return false;
        if (toDate.value && r.latestActualDate && r.latestActualDate > toDate.value) return false;
        if (q) {
            const hay = `${r.containerNo} ${r.latestVesselName} ${r.latestBargeInfo} ${r.latestPlateNumber} ${r.latestBoardType}`.toUpperCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
});

const filteredDetailEvents = computed(() => {
    if (activeTab.value !== 'HA_CONT' && activeTab.value !== 'LOAD_CONT' && activeTab.value !== 'TRA_CONT') {
        return [];
    }
    const q = searchQuery.value.trim().toUpperCase();
    return events.value
        .filter(e => {
            if (e.flowType !== activeTab.value) return false;
            if (fromDate.value && e.reportDate < fromDate.value) return false;
            if (toDate.value && e.reportDate > toDate.value) return false;
            if (q) {
                const hay = `${e.containerNo} ${e.soPhieu} ${e.plateNumber} ${e.romoocNo || ''} ${e.boardType || ''} ${e.bargeInfo || ''} ${e.vesselName || ''} ${e.sourceFactory || ''} ${e.remark || ''}`.toUpperCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        })
        .sort((a, b) => (b.eventDatetime || '').localeCompare(a.eventDatetime || ''));
});

const activeTotalCount = computed(() => {
    if (activeTab.value === 'REPORT') return dailyReportComputed.value.rows.length;
    if (activeTab.value === 'STATUS') return filteredStatusRows.value.length;
    return filteredDetailEvents.value.length;
});

const totalPages = computed(() => Math.max(1, Math.ceil(activeTotalCount.value / pageSize)));

const pageStartIdx = computed(() => {
    const safePage = Math.min(currentPage.value, totalPages.value);
    return (safePage - 1) * pageSize;
});

const paginatedReportRows = computed(() =>
    dailyReportComputed.value.rows.slice(pageStartIdx.value, pageStartIdx.value + pageSize)
);

const paginatedStatusRows = computed(() =>
    filteredStatusRows.value.slice(pageStartIdx.value, pageStartIdx.value + pageSize)
);

const paginatedDetailEvents = computed(() =>
    filteredDetailEvents.value.slice(pageStartIdx.value, pageStartIdx.value + pageSize)
);

const detailTotalKg = computed(() =>
    filteredDetailEvents.value.reduce((sum, e) => sum + (Number(e.netWeightKg) || 0), 0)
);

function formatKg(val: number | undefined | null): string {
    const num = Number(val) || 0;
    if (!num) return '-';
    return Math.round(num).toLocaleString('en-US');
}

function formatTons(kg: number | undefined | null): string {
    const num = (Number(kg) || 0) / 1000;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadEvents() {
    loading.value = true;
    try {
        events.value = await EastwoodContainerService.getEvents();
    } catch (err: any) {
        console.error('Lỗi tải dữ liệu Container Eastwood:', err);
        addToast('Không thể tải dữ liệu Container Eastwood: ' + (err?.message || err), 'error');
    } finally {
        loading.value = false;
    }
}

function triggerHistoryImport() {
    if (!canImport.value) {
        addToast('Bạn không có quyền import file Excel lịch sử container!', 'error');
        return;
    }
    historyExcelInputRef.value?.click();
}

async function handleHistoryExcelSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    importingHistory.value = true;
    try {
        const res = await EastwoodContainerService.importHistoricalContainerExcel(file);
        await loadEvents();
        syncChannel.postMessage({ type: 'eastwood_containers_updated' });

        if (res.errors.length > 0 && res.haCount + res.loadCount + res.traCount + res.emptyLegacyCount === 0) {
            addToast(res.errors[0]!, 'error');
        } else {
            const msg = `Đã nạp lịch sử từ "${file.name}": Hạ Cont ${res.haCount}, Load Cont ${res.loadCount}, Trả Cont ${res.traCount}${res.emptyLegacyCount > 0 ? `, Cont rỗng cũ ${res.emptyLegacyCount}` : ''} (+${res.added} mới, ${res.updated} cập nhật)`;
            addToast(msg, res.errors.length > 0 ? 'info' : 'success');
        }
    } catch (err: any) {
        console.error('Lỗi import Excel lịch sử container:', err);
        addToast('Lỗi đọc file Excel lịch sử: ' + (err?.message || err), 'error');
    } finally {
        importingHistory.value = false;
        input.value = '';
    }
}

function triggerScaleImport() {
    if (!canImport.value) {
        addToast('Bạn không có quyền import phiếu cân!', 'error');
        return;
    }
    scaleFileInputRef.value?.click();
}

async function handleScaleFilesSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    importingScale.value = true;
    try {
        const vessels = await WeighbridgeService.getVessels().catch(() => [] as Vessel[]);
        const extracted: EastwoodContainerEvent[] = [];
        for (const f of Array.from(input.files)) {
            const rows = await parseWeighbridgeFile(f);
            for (const r of rows) {
                const evs = classifyEastwoodContainerRow(r, vessels);
                if (evs.length > 0) extracted.push(...evs);
            }
        }
        if (extracted.length === 0) {
            addToast('Không tìm thấy phiếu Container nào của Eastwood trong tệp vừa chọn.', 'info');
            return;
        }
        const res = await EastwoodContainerService.saveEventsBulk(extracted);
        await loadEvents();
        syncChannel.postMessage({ type: 'eastwood_containers_updated' });

        const ha = extracted.filter(x => x.flowType === 'HA_CONT').length;
        const ld = extracted.filter(x => x.flowType === 'LOAD_CONT').length;
        const tr = extracted.filter(x => x.flowType === 'TRA_CONT').length;
        addToast(
            `Đã nạp ${extracted.length} container Eastwood (Hạ: ${ha}, Load: ${ld}, Trả rỗng: ${tr} • +${res.added} mới, ${res.updated} cập nhật)`,
            res.cloudError ? 'info' : 'success'
        );
    } catch (err: any) {
        console.error('Lỗi import phiếu cân container:', err);
        addToast('Lỗi đọc phiếu cân container: ' + (err?.message || err), 'error');
    } finally {
        importingScale.value = false;
        input.value = '';
    }
}

async function handleExportExcel() {
    if (!canExport.value) {
        addToast('Bạn không có quyền xuất Excel!', 'error');
        return;
    }
    exportingExcel.value = true;
    try {
        await EastwoodContainerService.exportContainerReportExcel(events.value, {
            fromDate: fromDate.value || undefined,
            toDate: toDate.value || undefined
        });
        addToast('Đã xuất báo cáo Container Eastwood (5 sheet)!', 'success');
    } catch (err: any) {
        addToast('Lỗi xuất Excel Container: ' + (err?.message || err), 'error');
    } finally {
        exportingExcel.value = false;
    }
}

function openEditModal(ev: EastwoodContainerEvent) {
    editingEvent.value = { ...ev };
    showEditModal.value = true;
}

async function saveEditEvent() {
    if (!editingEvent.value) return;
    savingEdit.value = true;
    try {
        editingEvent.value.containerNo = editingEvent.value.containerNo.trim().toUpperCase();
        await EastwoodContainerService.updateEvent(editingEvent.value);
        await loadEvents();
        syncChannel.postMessage({ type: 'eastwood_containers_updated' });
        showEditModal.value = false;
        editingEvent.value = null;
        addToast('Đã cập nhật thông tin container!', 'success');
    } catch (err: any) {
        addToast('Lỗi cập nhật container: ' + (err?.message || err), 'error');
    } finally {
        savingEdit.value = false;
    }
}

async function handleDeleteEvent(ev: EastwoodContainerEvent) {
    if (!canDelete.value) {
        addToast('Bạn không có quyền xóa bản ghi!', 'error');
        return;
    }
    if (!confirm(`Xóa bản ghi container ${ev.containerNo} (Phiếu ${ev.soPhieu || '-'})?`)) return;
    await EastwoodContainerService.deleteEvent(ev.id);
    await loadEvents();
    syncChannel.postMessage({ type: 'eastwood_containers_updated' });
    addToast(`Đã xóa container ${ev.containerNo}`, 'success');
}

async function handleClearAll() {
    if (!canDelete.value) {
        addToast('Bạn không có quyền xóa dữ liệu!', 'error');
        return;
    }
    if (!confirm('Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu Bãi Container Eastwood không?')) return;
    await EastwoodContainerService.clearAllEvents();
    await loadEvents();
    syncChannel.postMessage({ type: 'eastwood_containers_updated' });
    addToast('Đã xóa toàn bộ dữ liệu Bãi Container Eastwood.', 'success');
}

function selectStatusQuickFilter(st: 'ALL' | EastwoodContainerStatus) {
    activeTab.value = 'STATUS';
    statusFilter.value = st;
}

onMounted(() => {
    loadEvents();
});
</script>

<template>
    <div class="h-full flex-1 flex flex-col gap-3.5 min-h-0 font-display text-[#1e293b]">
        <!-- Hidden File Inputs -->
        <input
            ref="historyExcelInputRef"
            type="file"
            accept=".xlsx,.xls"
            class="hidden"
            @change="handleHistoryExcelSelected"
        />
        <input
            ref="scaleFileInputRef"
            type="file"
            multiple
            accept=".csv,.xlsx,.xls"
            class="hidden"
            @change="handleScaleFilesSelected"
        />

        <!-- Card 1: Header Banner + Tab Switcher + Action Toolbar -->
        <div class="bg-white rounded-[24px] px-4 py-3 border border-primary/5 shadow-soft shrink-0 flex flex-col gap-3">
            <div class="flex flex-wrap items-center justify-between gap-2.5">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary text-xl">inventory_2</span>
                    <h2 class="text-base font-display font-black text-[#1e293b]">
                        BÃI CONTAINER <span class="text-primary">(EASTWOOD)</span>
                    </h2>
                    <span class="px-2 py-0.5 rounded-xl bg-primary/10 text-primary text-xs font-bold">
                        Report: Ngày ca 06:00 • Trạng thái: Ngày thực tế
                    </span>
                </div>

                <!-- Compact Toolbar Actions (DESIGN.md Section 6) -->
                <div class="flex flex-wrap items-center gap-1.5">
                    <button
                        v-if="canImport"
                        type="button"
                        :disabled="importingHistory"
                        @click="triggerHistoryImport"
                        class="h-7 px-3 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-[8px] hover:bg-primary/20 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Nạp file Excel lịch sử (REPORT CONTAINER_...xlsx gồm sheet HẠ CONT, LOAD CONT, TRẢ CONT, CONT RỖNG)"
                    >
                        <span class="material-symbols-outlined text-sm">{{ importingHistory ? 'progress_activity' : 'history' }}</span>
                        <span>{{ importingHistory ? 'Đang nạp...' : 'Import Excel lịch sử' }}</span>
                    </button>

                    <button
                        v-if="canImport"
                        type="button"
                        :disabled="importingScale"
                        @click="triggerScaleImport"
                        class="h-7 px-3 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-[8px] hover:bg-primary/20 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Nạp trực tiếp file phiếu cân (CSV/Excel)"
                    >
                        <span class="material-symbols-outlined text-sm">{{ importingScale ? 'progress_activity' : 'upload_file' }}</span>
                        <span>{{ importingScale ? 'Đang đọc...' : 'Import Phiếu cân' }}</span>
                    </button>

                    <button
                        v-if="canExport"
                        type="button"
                        :disabled="exportingExcel || events.length === 0"
                        @click="handleExportExcel"
                        class="h-7 px-3 bg-primary text-white border border-primary text-xs font-bold rounded-[8px] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <span class="material-symbols-outlined text-sm">download</span>
                        <span>{{ exportingExcel ? 'Đang xuất...' : 'Xuất Excel' }}</span>
                    </button>

                    <button
                        v-if="canDelete && events.length > 0"
                        type="button"
                        @click="handleClearAll"
                        class="h-7 px-3 bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-[8px] hover:bg-red-100 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                        <span class="material-symbols-outlined text-sm">delete_sweep</span>
                        <span>Xóa hết</span>
                    </button>
                </div>
            </div>

            <!-- Compact Tab Switcher (DESIGN.md Section 6) -->
            <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0 h-8 items-center gap-0.5 overflow-x-auto scrollbar-none">
                    <button
                        type="button"
                        @click="activeTab = 'REPORT'"
                        :class="[
                            'px-3 py-1 rounded-lg text-xs font-display font-bold transition-all flex items-center gap-1.5 h-6.5 cursor-pointer whitespace-nowrap',
                            activeTab === 'REPORT' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                        ]"
                    >
                        <span>Báo cáo ngày (REPORT)</span>
                    </button>
                    <button
                        type="button"
                        @click="activeTab = 'STATUS'"
                        :class="[
                            'px-3 py-1 rounded-lg text-xs font-display font-bold transition-all flex items-center gap-1.5 h-6.5 cursor-pointer whitespace-nowrap',
                            activeTab === 'STATUS' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                        ]"
                    >
                        <span>Trạng thái bãi ({{ yardSummary.totalTracked }})</span>
                    </button>
                    <button
                        type="button"
                        @click="activeTab = 'HA_CONT'"
                        :class="[
                            'px-3 py-1 rounded-lg text-xs font-display font-bold transition-all flex items-center gap-1.5 h-6.5 cursor-pointer whitespace-nowrap',
                            activeTab === 'HA_CONT' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                        ]"
                    >
                        <span>Hạ Cont</span>
                    </button>
                    <button
                        type="button"
                        @click="activeTab = 'LOAD_CONT'"
                        :class="[
                            'px-3 py-1 rounded-lg text-xs font-display font-bold transition-all flex items-center gap-1.5 h-6.5 cursor-pointer whitespace-nowrap',
                            activeTab === 'LOAD_CONT' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                        ]"
                    >
                        <span>Load Cont</span>
                    </button>
                    <button
                        type="button"
                        @click="activeTab = 'TRA_CONT'"
                        :class="[
                            'px-3 py-1 rounded-lg text-xs font-display font-bold transition-all flex items-center gap-1.5 h-6.5 cursor-pointer whitespace-nowrap',
                            activeTab === 'TRA_CONT' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                        ]"
                    >
                        <span>Trả Cont</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Card 2: KPI Quick Summary -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            <button
                type="button"
                @click="selectStatusQuickFilter('LOADED')"
                :class="[
                    'bg-white rounded-[24px] px-4 py-3 border text-left transition-all cursor-pointer shadow-soft hover:border-primary/40',
                    activeTab === 'STATUS' && statusFilter === 'LOADED' ? 'border-primary ring-2 ring-primary/15' : 'border-primary/5'
                ]"
            >
                <div class="text-xs font-bold text-slate-500 flex items-center justify-between">
                    <span>Cont có hàng (trên bãi)</span>
                    <span class="size-2.5 rounded-full bg-primary"></span>
                </div>
                <div class="text-xl font-display font-black text-primary mt-1">
                    {{ yardSummary.loadedCount.toLocaleString('en-US') }} <span class="text-xs font-bold text-slate-400">cont</span>
                </div>
            </button>

            <button
                type="button"
                @click="selectStatusQuickFilter('EMPTY_YARD')"
                :class="[
                    'bg-white rounded-[24px] px-4 py-3 border text-left transition-all cursor-pointer shadow-soft hover:border-amber-400',
                    activeTab === 'STATUS' && statusFilter === 'EMPTY_YARD' ? 'border-amber-500 ring-2 ring-amber-200' : 'border-primary/5'
                ]"
            >
                <div class="text-xs font-bold text-slate-500 flex items-center justify-between">
                    <span>Cont rỗng (đã xá)</span>
                    <span class="size-2.5 rounded-full bg-amber-500"></span>
                </div>
                <div class="text-xl font-display font-black text-amber-600 mt-1">
                    {{ yardSummary.emptyCount.toLocaleString('en-US') }} <span class="text-xs font-bold text-slate-400">cont</span>
                </div>
            </button>

            <button
                type="button"
                @click="selectStatusQuickFilter('RETURNED')"
                :class="[
                    'bg-white rounded-[24px] px-4 py-3 border text-left transition-all cursor-pointer shadow-soft hover:border-teal-400',
                    activeTab === 'STATUS' && statusFilter === 'RETURNED' ? 'border-teal-600 ring-2 ring-teal-200' : 'border-primary/5'
                ]"
            >
                <div class="text-xs font-bold text-slate-500 flex items-center justify-between">
                    <span>Đã trả (hoàn tất)</span>
                    <span class="size-2.5 rounded-full bg-teal-600"></span>
                </div>
                <div class="text-xl font-display font-black text-teal-600 mt-1">
                    {{ yardSummary.returnedCount.toLocaleString('en-US') }} <span class="text-xs font-bold text-slate-400">cont</span>
                </div>
            </button>

            <button
                type="button"
                @click="selectStatusQuickFilter('ALL')"
                :class="[
                    'bg-white rounded-[24px] px-4 py-3 border text-left transition-all cursor-pointer shadow-soft hover:border-slate-300',
                    activeTab === 'STATUS' && statusFilter === 'ALL' ? 'border-slate-400 ring-2 ring-slate-200' : 'border-primary/5'
                ]"
            >
                <div class="text-xs font-bold text-slate-500 flex items-center justify-between">
                    <span>Tổng số Container</span>
                    <span class="material-symbols-outlined text-sm text-slate-400">view_list</span>
                </div>
                <div class="text-xl font-display font-black text-[#1e293b] mt-1">
                    {{ yardSummary.totalTracked.toLocaleString('en-US') }} <span class="text-xs font-bold text-slate-400">cont</span>
                </div>
            </button>
        </div>

        <!-- Card 3: Filter Toolbar + Scrollable Table + Pinned Pagination -->
        <div class="bg-white rounded-[24px] p-4 border border-primary/5 shadow-soft flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
            <!-- Toolbar -->
            <div class="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div class="flex flex-wrap items-center gap-2">
                    <input
                        v-if="activeTab !== 'REPORT'"
                        v-model="searchQuery"
                        type="text"
                        placeholder="Tìm số cont, phiếu, biển số, tàu..."
                        class="h-7 px-3 bg-white border border-slate-200 rounded-[8px] text-xs font-semibold text-[#1e293b] focus:outline-none focus:border-primary w-56"
                    />

                    <div class="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <span>Từ:</span>
                        <input
                            v-model="fromDate"
                            type="date"
                            class="h-7 px-2 bg-white border border-slate-200 rounded-[8px] text-xs font-semibold text-[#1e293b] focus:outline-none focus:border-primary"
                        />
                        <span>Đến:</span>
                        <input
                            v-model="toDate"
                            type="date"
                            class="h-7 px-2 bg-white border border-slate-200 rounded-[8px] text-xs font-semibold text-[#1e293b] focus:outline-none focus:border-primary"
                        />
                        <button
                            v-if="fromDate || toDate || searchQuery || statusFilter !== 'ALL'"
                            type="button"
                            @click="fromDate = ''; toDate = ''; searchQuery = ''; statusFilter = 'ALL'"
                            class="h-7 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-[8px] text-xs font-bold cursor-pointer"
                        >
                            Xóa lọc
                        </button>
                    </div>

                    <select
                        v-if="activeTab === 'STATUS'"
                        v-model="statusFilter"
                        class="h-7 px-2.5 bg-white border border-slate-200 rounded-[8px] text-xs font-bold text-[#1e293b] focus:outline-none focus:border-primary"
                    >
                        <option value="ALL">Tất cả trạng thái</option>
                        <option value="LOADED">Cont có hàng</option>
                        <option value="EMPTY_YARD">Cont rỗng (đã xá)</option>
                        <option value="RETURNED">Đã trả (hoàn tất)</option>
                    </select>
                </div>

                <div class="flex items-center gap-2">
                    <span
                        v-if="(activeTab === 'HA_CONT' || activeTab === 'LOAD_CONT') && detailTotalKg > 0"
                        class="h-7 px-2.5 bg-primary/10 border border-primary/20 text-primary rounded-[8px] text-xs font-bold flex items-center"
                    >
                        Tổng KL: {{ formatKg(detailTotalKg) }} kg ({{ formatTons(detailTotalKg) }} T)
                    </span>
                    <span class="h-7 px-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-[8px] text-xs font-bold flex items-center">
                        {{ activeTotalCount.toLocaleString('en-US') }} dòng
                    </span>
                </div>
            </div>

            <!-- Scrollable Data Table -->
            <div class="flex-1 min-h-0 overflow-auto scrollbar-none border border-slate-100 rounded-2xl">
                <div v-if="loading" class="p-10 text-center text-xs font-bold text-slate-400">
                    Đang tải dữ liệu Container Eastwood...
                </div>

                <!-- TAB 1: REPORT (Báo cáo ngày theo Ngày báo cáo ca 06:00) -->
                <table v-else-if="activeTab === 'REPORT'" class="w-full text-left border-collapse font-sans">
                    <thead class="bg-gray-50 sticky top-0 z-10 border-b border-slate-200">
                        <tr class="text-xs font-bold text-slate-600">
                            <th class="px-3 py-2.5 text-center">Ngày báo cáo ca</th>
                            <th class="px-3 py-2.5 text-right">Container IN (Hạ)</th>
                            <th class="px-3 py-2.5 text-right">Container OUT (Trả rỗng)</th>
                            <th class="px-3 py-2.5 text-right">Container LOAD (Xá)</th>
                            <th class="px-3 py-2.5 text-right">KL Hạ Cont (kg)</th>
                            <th class="px-3 py-2.5 text-right">KL Load Sà Lan (kg)</th>
                            <th class="px-3 py-2.5 text-right">KL Load (Tấn)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 text-xs font-semibold text-[#1e293b]">
                        <tr v-if="paginatedReportRows.length === 0">
                            <td colspan="7" class="px-4 py-10 text-center text-slate-400">
                                Chưa có dữ liệu báo cáo Container. Hãy nạp file Phiếu cân hoặc Import Excel lịch sử.
                            </td>
                        </tr>
                        <tr v-for="r in paginatedReportRows" :key="r.reportDate" class="hover:bg-gray-50 transition-colors">
                            <td class="px-3 py-2.5 text-center font-bold text-primary">{{ r.displayDate }}</td>
                            <td class="px-3 py-2.5 text-right font-bold">{{ r.containerIn || '-' }}</td>
                            <td class="px-3 py-2.5 text-right font-bold text-teal-600">{{ r.containerOut || '-' }}</td>
                            <td class="px-3 py-2.5 text-right font-bold text-amber-600">{{ r.containerLoad || '-' }}</td>
                            <td class="px-3 py-2.5 text-right">{{ formatKg(r.haWeightKg) }}</td>
                            <td class="px-3 py-2.5 text-right font-bold">{{ formatKg(r.loadWeightKg) }}</td>
                            <td class="px-3 py-2.5 text-right font-bold text-primary">{{ r.loadWeightKg ? formatTons(r.loadWeightKg) : '-' }}</td>
                        </tr>
                    </tbody>
                    <tfoot v-if="dailyReportComputed.rows.length > 0" class="bg-primary/5 border-t-2 border-primary/20 sticky bottom-0">
                        <tr class="text-xs font-black text-[#1e293b]">
                            <td class="px-3 py-2.5 text-center">TỔNG CỘNG</td>
                            <td class="px-3 py-2.5 text-right">{{ dailyReportComputed.totalIn.toLocaleString('en-US') }}</td>
                            <td class="px-3 py-2.5 text-right text-teal-700">{{ dailyReportComputed.totalOut.toLocaleString('en-US') }}</td>
                            <td class="px-3 py-2.5 text-right text-amber-700">{{ dailyReportComputed.totalLoad.toLocaleString('en-US') }}</td>
                            <td class="px-3 py-2.5 text-right">{{ formatKg(dailyReportComputed.totalHaWeightKg) }}</td>
                            <td class="px-3 py-2.5 text-right">{{ formatKg(dailyReportComputed.totalLoadWeightKg) }}</td>
                            <td class="px-3 py-2.5 text-right text-primary">{{ formatTons(dailyReportComputed.totalLoadWeightKg) }}</td>
                        </tr>
                    </tfoot>
                </table>

                <!-- TAB 2: TRẠNG THÁI BÃI (Theo ngày giờ thực tế) -->
                <table v-else-if="activeTab === 'STATUS'" class="w-full text-left border-collapse font-sans">
                    <thead class="bg-gray-50 sticky top-0 z-10 border-b border-slate-200">
                        <tr class="text-xs font-bold text-slate-600">
                            <th class="px-3 py-2.5 text-center w-12">STT</th>
                            <th class="px-3 py-2.5">Số Container</th>
                            <th class="px-3 py-2.5">Hạ Cont (Thực tế)</th>
                            <th class="px-3 py-2.5">Load Cont (Thực tế)</th>
                            <th class="px-3 py-2.5">Trả Cont (Thực tế)</th>
                            <th class="px-3 py-2.5 text-center">Trạng thái</th>
                            <th class="px-3 py-2.5 text-center">Ván</th>
                            <th class="px-3 py-2.5">Tàu / Sà lan</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 text-xs font-semibold text-[#1e293b]">
                        <tr v-if="paginatedStatusRows.length === 0">
                            <td colspan="8" class="px-4 py-10 text-center text-slate-400">
                                Không có container nào khớp điều kiện lọc.
                            </td>
                        </tr>
                        <tr v-for="(r, idx) in paginatedStatusRows" :key="r.containerNo" class="hover:bg-gray-50 transition-colors">
                            <td class="px-3 py-2.5 text-center text-slate-400">{{ pageStartIdx + idx + 1 }}</td>
                            <td class="px-3 py-2.5 font-mono font-bold text-[#1e293b]">
                                <div class="flex items-center gap-1.5">
                                    <span>{{ r.containerNo }}</span>
                                    <span
                                        v-if="r.hasWarning"
                                        class="material-symbols-outlined text-sm text-rose-500"
                                        :title="r.warningText"
                                    >
                                        warning
                                    </span>
                                </div>
                            </td>
                            <td class="px-3 py-2.5 whitespace-nowrap">{{ formatEventDatetimeDisplay(r.latestHaContDatetime) }}</td>
                            <td class="px-3 py-2.5 whitespace-nowrap">{{ formatEventDatetimeDisplay(r.latestLoadContDatetime) }}</td>
                            <td class="px-3 py-2.5 whitespace-nowrap">{{ formatEventDatetimeDisplay(r.latestTraContDatetime) }}</td>
                            <td class="px-3 py-2.5 text-center whitespace-nowrap">
                                <span
                                    :class="[
                                        'px-2.5 py-1 rounded-xl text-xs font-bold inline-block',
                                        r.status === 'LOADED'
                                            ? 'bg-primary/10 text-primary'
                                            : r.status === 'EMPTY_YARD'
                                                ? 'bg-amber-50 text-amber-700'
                                                : 'bg-teal-50 text-teal-600'
                                    ]"
                                >
                                    {{ r.statusLabel }}
                                </span>
                            </td>
                            <td class="px-3 py-2.5 text-center whitespace-nowrap">
                                <span
                                    v-if="r.latestBoardType"
                                    class="px-2 py-0.5 rounded-xl bg-[#f1f5f9] text-slate-700 text-xs font-bold"
                                >
                                    {{ r.latestBoardType }}
                                </span>
                                <span v-else class="text-slate-300">-</span>
                            </td>
                            <td class="px-3 py-2.5 max-w-[220px] truncate" :title="r.latestVesselName || r.latestBargeInfo">
                                {{ r.latestVesselName || r.latestBargeInfo || '-' }}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- TAB 3, 4, 5: CHI TIẾT HẠ CONT / LOAD CONT / TRẢ CONT (Có cả 2 cột Ngày thực tế & Ngày báo cáo ca) -->
                <table v-else class="w-full text-left border-collapse font-sans">
                    <thead class="bg-gray-50 sticky top-0 z-10 border-b border-slate-200">
                        <tr class="text-xs font-bold text-slate-600">
                            <th class="px-3 py-2.5 text-center w-10">STT</th>
                            <th class="px-3 py-2.5">Số Phiếu</th>
                            <th class="px-3 py-2.5 whitespace-nowrap">Ngày thực tế</th>
                            <th class="px-3 py-2.5 whitespace-nowrap">Ngày báo cáo ca</th>
                            <th class="px-3 py-2.5">Số Container</th>
                            <th class="px-3 py-2.5">Số xe</th>
                            <th v-if="activeTab !== 'TRA_CONT'" class="px-3 py-2.5 text-center">Ván</th>
                            <th v-if="activeTab !== 'TRA_CONT'" class="px-3 py-2.5 text-right">KL Hàng (kg)</th>
                            <th class="px-3 py-2.5">Giờ vào / ra</th>
                            <th v-if="activeTab === 'LOAD_CONT'" class="px-3 py-2.5">Sà lan / Tàu</th>
                            <th v-if="activeTab === 'HA_CONT'" class="px-3 py-2.5">Nguồn / Seal</th>
                            <th class="px-3 py-2.5 text-center w-20">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 text-xs font-semibold text-[#1e293b]">
                        <tr v-if="paginatedDetailEvents.length === 0">
                            <td :colspan="activeTab === 'TRA_CONT' ? 8 : 11" class="px-4 py-10 text-center text-slate-400">
                                Chưa có phiếu nào trong mục này.
                            </td>
                        </tr>
                        <tr v-for="(ev, idx) in paginatedDetailEvents" :key="ev.id" class="hover:bg-gray-50 transition-colors">
                            <td class="px-3 py-2.5 text-center text-slate-400">{{ pageStartIdx + idx + 1 }}</td>
                            <td class="px-3 py-2.5 font-mono font-bold whitespace-nowrap">{{ ev.soPhieu || '-' }}</td>
                            <td class="px-3 py-2.5 whitespace-nowrap">{{ formatIsoToDmy(ev.actualDate) }}</td>
                            <td class="px-3 py-2.5 whitespace-nowrap font-bold text-primary">{{ formatIsoToDmy(ev.reportDate) }}</td>
                            <td class="px-3 py-2.5 font-mono font-bold text-[#1e293b] whitespace-nowrap">{{ ev.containerNo }}</td>
                            <td class="px-3 py-2.5 whitespace-nowrap">
                                {{ ev.plateNumber }}<span v-if="ev.romoocNo" class="text-slate-400">/{{ ev.romoocNo }}</span>
                            </td>
                            <td v-if="activeTab !== 'TRA_CONT'" class="px-3 py-2.5 text-center whitespace-nowrap">
                                <span
                                    v-if="ev.boardType"
                                    class="px-2 py-0.5 rounded-xl bg-[#f1f5f9] text-slate-700 text-xs font-bold"
                                >
                                    {{ ev.boardType }}
                                </span>
                                <span v-else class="text-slate-300">-</span>
                            </td>
                            <td v-if="activeTab !== 'TRA_CONT'" class="px-3 py-2.5 text-right font-bold whitespace-nowrap">
                                {{ formatKg(ev.netWeightKg) }}
                            </td>
                            <td class="px-3 py-2.5 whitespace-nowrap text-slate-500">
                                {{ ev.weighInTime || '-' }} → {{ ev.weighOutTime || '-' }}
                            </td>
                            <td v-if="activeTab === 'LOAD_CONT'" class="px-3 py-2.5 max-w-[220px] truncate" :title="`${ev.bargeInfo || ''} ${ev.vesselName || ''}`">
                                <span v-if="ev.vesselName" class="font-bold text-primary">{{ ev.vesselName }}</span>
                                <span v-if="ev.vesselName && ev.bargeInfo" class="text-slate-400"> • </span>
                                <span>{{ ev.bargeInfo || (!ev.vesselName ? '-' : '') }}</span>
                            </td>
                            <td v-if="activeTab === 'HA_CONT'" class="px-3 py-2.5 max-w-[180px] truncate">
                                {{ ev.sourceFactory || ev.warehouseNote || '-' }}
                                <span v-if="ev.sealNo" class="text-slate-400"> • Seal: {{ ev.sealNo }}</span>
                            </td>
                            <td class="px-3 py-2.5">
                                <div class="flex items-center justify-center gap-1.5">
                                    <button
                                        type="button"
                                        @click="openEditModal(ev)"
                                        class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                        title="Chỉnh sửa"
                                    >
                                        <span class="material-symbols-outlined text-sm">edit</span>
                                    </button>
                                    <button
                                        v-if="canDelete"
                                        type="button"
                                        @click="handleDeleteEvent(ev)"
                                        class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
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

            <!-- Pinned Pagination Footer (Outside scrollable table, DESIGN.md Section 5C) -->
            <div class="flex items-center justify-between pt-1 shrink-0 text-xs font-bold text-slate-500">
                <div>
                    Hiển thị
                    <span class="text-[#1e293b]">{{ activeTotalCount === 0 ? 0 : pageStartIdx + 1 }}</span>–<span class="text-[#1e293b]">{{ Math.min(pageStartIdx + pageSize, activeTotalCount) }}</span>
                    / <span class="text-[#1e293b]">{{ activeTotalCount.toLocaleString('en-US') }}</span> bản ghi
                </div>
                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        :disabled="currentPage <= 1"
                        @click="currentPage--"
                        class="h-7 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer"
                    >
                        Trước
                    </button>
                    <span class="text-[#1e293b]">Trang {{ currentPage }} / {{ totalPages }}</span>
                    <button
                        type="button"
                        :disabled="currentPage >= totalPages"
                        @click="currentPage++"
                        class="h-7 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer"
                    >
                        Sau
                    </button>
                </div>
            </div>
        </div>

        <!-- Edit Modal -->
        <div
            v-if="showEditModal && editingEvent"
            class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
            @click.self="showEditModal = false"
        >
            <div class="bg-white rounded-[2rem] p-6 w-full max-w-lg border border-primary/10 shadow-xl flex flex-col gap-4">
                <div class="flex items-center justify-between">
                    <h3 class="text-xl font-display font-black text-[#1e293b]">Chỉnh sửa Container</h3>
                    <button
                        type="button"
                        @click="showEditModal = false"
                        class="size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div class="grid grid-cols-2 gap-3 text-xs font-bold">
                    <label class="flex flex-col gap-1">
                        <span class="text-slate-500">Số Container</span>
                        <input
                            v-model="editingEvent.containerNo"
                            type="text"
                            class="px-3 py-2 bg-[#f1f5f9] rounded-2xl text-sm font-bold text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>
                    <label class="flex flex-col gap-1">
                        <span class="text-slate-500">Có / Không ván</span>
                        <select
                            v-model="editingEvent.boardType"
                            class="px-3 py-2 bg-[#f1f5f9] rounded-2xl text-sm font-bold text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                            <option value="">-- Không ghi --</option>
                            <option value="Có ván">Có ván</option>
                            <option value="Không ván">Không ván</option>
                        </select>
                    </label>
                    <label class="flex flex-col gap-1">
                        <span class="text-slate-500">Số Seal</span>
                        <input
                            v-model="editingEvent.sealNo"
                            type="text"
                            class="px-3 py-2 bg-[#f1f5f9] rounded-2xl text-sm font-bold text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>
                    <label class="flex flex-col gap-1">
                        <span class="text-slate-500">KL Hàng (kg)</span>
                        <input
                            v-model.number="editingEvent.netWeightKg"
                            type="number"
                            class="px-3 py-2 bg-[#f1f5f9] rounded-2xl text-sm font-bold text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>
                    <label class="flex flex-col gap-1 col-span-2">
                        <span class="text-slate-500">Tàu mẹ</span>
                        <input
                            v-model="editingEvent.vesselName"
                            type="text"
                            class="px-3 py-2 bg-[#f1f5f9] rounded-2xl text-sm font-bold text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>
                    <label class="flex flex-col gap-1 col-span-2">
                        <span class="text-slate-500">Ghi chú</span>
                        <input
                            v-model="editingEvent.remark"
                            type="text"
                            class="px-3 py-2 bg-[#f1f5f9] rounded-2xl text-sm font-bold text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </label>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2">
                    <button
                        type="button"
                        @click="showEditModal = false"
                        class="px-4 py-2 bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl text-sm hover:bg-primary/5 active:scale-95 transition-all cursor-pointer"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        :disabled="savingEdit"
                        @click="saveEditEvent"
                        class="px-5 py-2 bg-primary text-white font-bold rounded-full text-sm shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                    >
                        {{ savingEdit ? 'Đang lưu...' : 'Lưu thay đổi' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

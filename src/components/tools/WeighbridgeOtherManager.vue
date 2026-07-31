<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { weighbridgeOtherService } from '@/services/excel/WeighbridgeOtherService';
import type { WarehouseTicket, ContainerTicket } from '@/types/excel';
import { authStore, canCreate, canDelete } from '@/stores/auth';
import { LogService } from '@/services/storage/LogService';

import WbKpiCards from './weighbridge/WbKpiCards.vue';
import WbTicketTable from './weighbridge/WbTicketTable.vue';

const { addToast } = useToast();

const activeTab = ref<'warehouse' | 'container'>('warehouse');
const loading = ref(false);
const tickets = ref<(WarehouseTicket | ContainerTicket)[]>([]);
const previewTickets = ref<(WarehouseTicket | ContainerTicket)[]>([]);
const searchQuery = ref('');

// Pagination state
const currentPage = ref(1);
const itemsPerPage = ref(20);

// File state
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFileName = ref('');

// Fetch records from database
const fetchTickets = async () => {
    loading.value = true;
    try {
        if (activeTab.value === 'warehouse') {
            tickets.value = await weighbridgeOtherService.getWarehouseTickets();
        } else {
            tickets.value = await weighbridgeOtherService.getContainerTickets();
        }
        currentPage.value = 1;
    } catch (e: any) {
        console.error('Lỗi tải danh sách phiếu cân:', e);
        addToast('Lỗi khi đồng bộ dữ liệu: ' + e.message, 'error');
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchTickets();
});

watch(activeTab, () => {
    previewTickets.value = [];
    selectedFileName.value = '';
    fetchTickets();
});

watch(itemsPerPage, () => {
    currentPage.value = 1;
});

// Client-side quick filter
const filteredTickets = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    if (!query) return tickets.value;

    return tickets.value.filter((t) => {
        const ticketNo = String(t.ticketNo || '').toLowerCase();
        const plate = String(t.plateNumber || '').toLowerCase();
        const driver = String(t.driver || '').toLowerCase();
        const goods = String(t.goodsName || '').toLowerCase();
        const note = String(t.note || '').toLowerCase();
        const cont = activeTab.value === 'container' ? String((t as any).containerNo || '').toLowerCase() : '';

        return (
            ticketNo.includes(query) ||
            plate.includes(query) ||
            driver.includes(query) ||
            goods.includes(query) ||
            note.includes(query) ||
            cont.includes(query)
        );
    });
});

// KPI Summary stats
const totalTicketsCount = computed(() => filteredTickets.value.length);
const totalNetWeightTons = computed(() => {
    const totalKg = filteredTickets.value.reduce((sum, t) => sum + (t.weightNet || 0), 0);
    return (totalKg / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});
const uniquePlatesCount = computed(() => {
    const plates = new Set(filteredTickets.value.map(t => t.plateNumber).filter(Boolean));
    return plates.size;
});

// Paginated items
const paginatedTickets = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    return filteredTickets.value.slice(start, start + itemsPerPage.value);
});

const totalPages = computed(() => {
    return Math.max(1, Math.ceil(filteredTickets.value.length / itemsPerPage.value));
});

// File processing
const processExcelFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
        addToast('Vui lòng chọn tệp định dạng Excel (.xlsx, .xls) hoặc CSV (.csv)!', 'error');
        return;
    }
    
    // T-06-02-01: Limit upload file processing size to prevent tab crashing
    if (file.size > 20 * 1024 * 1024) {
        addToast('Tệp quá lớn! Vui lòng tải tệp nhỏ hơn 20MB.', 'error');
        return;
    }

    loading.value = true;
    selectedFileName.value = file.name;
    try {
        const arrayBuffer = await file.arrayBuffer();
        const parsed = await weighbridgeOtherService.parseExcelFile(arrayBuffer, activeTab.value, file.name);
        
        if (parsed.length === 0) {
            addToast('Không tìm thấy dòng dữ liệu hợp lệ trong tệp Excel!', 'info');
            previewTickets.value = [];
            selectedFileName.value = '';
        } else {
            previewTickets.value = parsed;
            addToast(`Đã phân tích thành công ${parsed.length} dòng dữ liệu!`, 'success');
        }
    } catch (err: any) {
        console.error(err);
        addToast('Lỗi phân tích file: ' + err.message, 'error');
        previewTickets.value = [];
        selectedFileName.value = '';
    } finally {
        loading.value = false;
    }
};

const triggerFileInput = () => {
    if (fileInput.value) {
        fileInput.value.click();
    }
};

const handleFileInputChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
        const file = target.files[0];
        if (file) processExcelFile(file);
    }
    if (fileInput.value) fileInput.value.value = '';
};

const saveImportedTickets = async () => {
    if (previewTickets.value.length === 0) return;
    loading.value = true;
    try {
        let result;
        if (activeTab.value === 'warehouse') {
            result = await weighbridgeOtherService.saveWarehouseTickets(previewTickets.value);
        } else {
            result = await weighbridgeOtherService.saveContainerTickets(previewTickets.value);
        }

        if (result.success) {
            addToast(`Đã lưu thành công ${previewTickets.value.length} phiếu cân vào hệ thống!`, 'success');
            await LogService.logAction(
                activeTab.value === 'warehouse' ? 'Nhập Excel cân kho' : 'Nhập Excel cân container',
                `Đã import thành công ${previewTickets.value.length} phiếu từ tệp ${selectedFileName.value}`
            );
            previewTickets.value = [];
            selectedFileName.value = '';
            await fetchTickets();
        } else {
            addToast('Không thể lưu dữ liệu lên hệ thống đám mây: ' + (result.error?.message || 'Lỗi không xác định'), 'error');
        }
    } catch (e: any) {
        console.error(e);
        addToast('Gặp sự cố khi lưu: ' + e.message, 'error');
    } finally {
        loading.value = false;
    }
};

const cancelImport = () => {
    previewTickets.value = [];
    selectedFileName.value = '';
    addToast('Đã hủy tệp import.', 'info');
};

const deleteTicket = async (ticket: any) => {
    if (!canDelete()) {
        addToast('Bạn không có quyền xóa dữ liệu này!', 'error');
        return;
    }
    
    if (!confirm(`Bạn có chắc chắn muốn xóa phiếu cân "${ticket.ticketNo}" không?`)) {
        return;
    }

    loading.value = true;
    try {
        let success = false;
        if (activeTab.value === 'warehouse') {
            success = await weighbridgeOtherService.deleteWarehouseTicket(ticket.id);
        } else {
            success = await weighbridgeOtherService.deleteContainerTicket(ticket.id);
        }

        if (success) {
            addToast('Đã xóa phiếu cân thành công!', 'success');
            await LogService.logAction(
                activeTab.value === 'warehouse' ? 'Xóa phiếu cân kho' : 'Xóa phiếu cân container',
                `Đã xóa phiếu cân số: ${ticket.ticketNo}`
            );
            await fetchTickets();
        } else {
            addToast('Có lỗi xảy ra khi xóa dữ liệu!', 'error');
        }
    } catch (e: any) {
        addToast('Sự cố hệ thống: ' + e.message, 'error');
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="w-full h-full flex-1 flex flex-col gap-4 min-h-0">
        
        <!-- ═══ Card 1: Header & Tab switcher ═══ -->
        <div class="bg-white rounded-3xl p-5 border border-primary/5 shadow-soft shrink-0">
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-[10px] font-black uppercase tracking-widest text-primary/60 bg-primary/5 px-2.5 py-1 rounded-lg">Dữ liệu cân hàng</span>
                    </div>
                    <h3 class="text-lg font-display font-black text-primary flex items-center gap-2">
                        <span class="material-symbols-outlined text-2xl">history</span>
                        Lịch sử cân Kho & Container
                    </h3>
                    <p class="text-xs text-slate-500 font-semibold mt-1">
                        Tra cứu và đồng bộ hóa phiếu cân dữ liệu từ Excel lên cơ sở dữ liệu đám mây Supabase.
                    </p>
                </div>
                
                <!-- Tab switcher buttons -->
                <div class="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 shrink-0">
                    <button
                        @click="activeTab = 'warehouse'"
                        :class="['px-4 py-2 rounded-xl text-xs font-display font-bold transition-all flex items-center gap-2', activeTab === 'warehouse' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50']"
                    >
                        <span class="material-symbols-outlined text-base">store</span>
                        Cân Kho Nhà Máy
                    </button>
                    <button
                        @click="activeTab = 'container'"
                        :class="['px-4 py-2 rounded-xl text-xs font-display font-bold transition-all flex items-center gap-2', activeTab === 'container' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50']"
                    >
                        <span class="material-symbols-outlined text-base">widgets</span>
                        Cân Container
                    </button>
                </div>
            </div>
        </div>

        <!-- ═══ Card 2: KPI Summary ═══ -->
        <div class="bg-white rounded-3xl p-5 border border-primary/5 shadow-soft shrink-0">
            <WbKpiCards
                :total-tickets="totalTicketsCount"
                :total-net-weight-tons="totalNetWeightTons"
                :unique-plates="uniquePlatesCount"
            />
        </div>

        <!-- ═══ Card 3: Data Table + Search + Import + Pagination ═══ -->
        <div class="bg-white rounded-3xl p-5 border border-primary/5 shadow-soft flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
            <!-- Hidden file input -->
            <input 
                type="file" 
                ref="fileInput" 
                @change="handleFileInputChange" 
                accept=".xlsx,.xls,.csv" 
                class="hidden" 
            />

            <WbTicketTable
                :tickets="paginatedTickets"
                :loading="loading"
                :active-tab="activeTab"
                :search-query="searchQuery"
                :current-page="currentPage"
                :items-per-page="itemsPerPage"
                :total-pages="totalPages"
                :total-filtered="filteredTickets.length"
                :preview-count="previewTickets.length"
                :file-name="selectedFileName"
                @update:search-query="searchQuery = $event"
                @update:current-page="currentPage = $event"
                @update:items-per-page="itemsPerPage = $event"
                @delete="deleteTicket"
                @import="triggerFileInput"
                @save-import="saveImportedTickets"
                @cancel-import="cancelImport"
            />
        </div>

    </div>
</template>

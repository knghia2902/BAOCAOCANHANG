<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { weighbridgeOtherService } from '@/services/excel/WeighbridgeOtherService';
import type { WarehouseTicket, ContainerTicket } from '@/types/excel';
import { authStore, canCreate, canDelete } from '@/stores/auth';
import { LogService } from '@/services/storage/LogService';

const { addToast } = useToast();

const activeTab = ref<'warehouse' | 'container'>('warehouse');
const loading = ref(false);
const tickets = ref<(WarehouseTicket | ContainerTicket)[]>([]);
const previewTickets = ref<(WarehouseTicket | ContainerTicket)[]>([]);
const searchQuery = ref('');

// Pagination state
const currentPage = ref(1);
const itemsPerPage = ref(20);

// File input reference
const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
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

// Excel reading & upload
const triggerFileInput = () => {
    if (fileInput.value) {
        fileInput.value.click();
    }
};

const handleFileSelect = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
        const file = target.files[0];
        if (file) await processExcelFile(file);
    }
    if (fileInput.value) fileInput.value.value = '';
};

const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    isDragging.value = true;
};

const handleDragLeave = () => {
    isDragging.value = false;
};

const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    isDragging.value = false;
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file) await processExcelFile(file);
    }
};

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

const formatWeight = (val: any) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '-';
    return Number(val).toLocaleString('vi-VN');
};

const formatDate = (isoString: any) => {
    if (!isoString) return '-';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString;
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${d}/${m}/${y} ${h}:${min}`;
    } catch {
        return isoString;
    }
};
</script>

<template>
    <div class="w-full flex-1 flex flex-col gap-6 bg-white rounded-3xl p-6 border border-primary/5 shadow-soft">
        
        <!-- Header & Tab switcher -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
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

        <!-- KPI Summary Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-white rounded-2xl p-4 border border-primary/10 shadow-soft flex items-center gap-3.5">
                <div class="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-2xl">description</span>
                </div>
                <div>
                    <div class="text-xs font-bold text-slate-500">Tổng phiếu cân</div>
                    <div class="text-xl font-display font-black text-slate-800 mt-0.5">{{ totalTicketsCount }}</div>
                </div>
            </div>

            <div class="bg-white rounded-2xl p-4 border border-teal-200/60 shadow-soft flex items-center gap-3.5">
                <div class="size-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-2xl">scale</span>
                </div>
                <div>
                    <div class="text-xs font-bold text-slate-500">Tổng khối lượng tịnh</div>
                    <div class="text-xl font-display font-black text-teal-700 mt-0.5">{{ totalNetWeightTons }} <span class="text-xs font-bold text-teal-600">tấn</span></div>
                </div>
            </div>

            <div class="bg-white rounded-2xl p-4 border border-indigo-200/60 shadow-soft flex items-center gap-3.5">
                <div class="size-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-2xl">local_shipping</span>
                </div>
                <div>
                    <div class="text-xs font-bold text-slate-500">Phương tiện đã cân</div>
                    <div class="text-xl font-display font-black text-slate-800 mt-0.5">{{ uniquePlatesCount }} <span class="text-xs font-bold text-slate-500">xe</span></div>
                </div>
            </div>
        </div>

        <!-- Main dragzone & preview area -->
        <div v-if="authStore.role === 'admin' || canCreate()" class="flex flex-col gap-4">
            <!-- Drag and Drop Panel per DESIGN.md -->
            <div 
                v-if="previewTickets.length === 0"
                @click="triggerFileInput"
                @dragover="handleDragOver"
                @dragleave="handleDragLeave"
                @drop="handleDrop"
                :class="['border-2 border-dashed rounded-[24px] p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group', isDragging ? 'border-primary bg-primary/5' : 'border-primary/20 hover:border-primary bg-slate-50/50 hover:bg-primary/5']"
            >
                <input 
                    type="file" 
                    ref="fileInput" 
                    @change="handleFileSelect" 
                    accept=".xlsx,.xls,.csv" 
                    class="hidden" 
                />
                <div class="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span class="material-symbols-outlined text-2xl">cloud_upload</span>
                </div>
                <div class="text-xs font-display font-black text-slate-800">Kéo & Thả tệp Excel / CSV chứa phiếu cân vào đây</div>
                <div class="text-[11px] text-slate-500 font-semibold">hoặc click để chọn file từ máy tính. Hỗ trợ file .xlsx, .xls, .csv &lt; 20MB.</div>
            </div>

            <!-- Preview panel if loaded -->
            <div v-else class="bg-teal-50/60 border border-teal-200 rounded-[24px] p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-soft">
                <div class="flex items-center gap-3">
                    <div class="size-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-xl">analytics</span>
                    </div>
                    <div class="text-left">
                        <div class="text-xs font-display font-black text-slate-800">Tệp đã nạp: {{ selectedFileName }}</div>
                        <div class="text-[11px] text-slate-600 font-semibold mt-0.5">
                            Phân tích thành công <span class="text-teal-700 font-bold">{{ previewTickets.length }}</span> phiếu cân. Dữ liệu đang ở chế độ xem trước (chưa lưu).
                        </div>
                    </div>
                </div>
                
                <div class="flex items-center gap-2 shrink-0">
                    <button
                        @click="saveImportedTickets"
                        class="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-soft flex items-center gap-1.5 transition-all active:scale-95"
                    >
                        <span class="material-symbols-outlined text-sm">cloud_sync</span>
                        Lưu dữ liệu
                    </button>
                    <button
                        @click="cancelImport"
                        class="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all active:scale-95"
                    >
                        <span class="material-symbols-outlined text-sm">close</span>
                        Hủy bỏ
                    </button>
                </div>
            </div>
        </div>

        <!-- Search toolbar -->
        <div class="flex items-center justify-between gap-4">
            <div class="relative flex-1 max-w-md">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <input 
                    type="text" 
                    v-model="searchQuery" 
                    placeholder="Tìm kiếm biển số xe, số phiếu, loại hàng..."
                    class="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-primary transition-all text-slate-700 font-semibold placeholder:text-slate-400"
                />
            </div>
            
            <div class="text-xs text-slate-500 font-semibold shrink-0">
                Tìm thấy <span class="text-slate-800 font-display font-black">{{ filteredTickets.length }}</span> bản ghi
            </div>
        </div>

        <!-- Table / List view per DESIGN.md & CargoAllocator -->
        <div class="flex-1 min-h-0 flex flex-col">
            <div class="overflow-x-auto border border-slate-200/80 rounded-2xl flex-1 min-h-0">
                <table class="min-w-full divide-y divide-slate-100 text-left border-collapse">
                    <thead class="bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th class="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider w-12 text-center">STT</th>
                            <th class="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Mã / Số Phiếu</th>
                            <th class="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Biển Số Xe</th>
                            <th class="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Tài Xế</th>
                            <th class="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Cân Lần 1 (kg)</th>
                            <th class="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Cân Lần 2 (kg)</th>
                            <th class="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Khối Lượng Tịnh (kg)</th>
                            <th class="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Ngày Vào</th>
                            <th class="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Ngày Ra</th>
                            <th class="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Loại Hàng</th>
                            <th v-if="activeTab === 'container'" class="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Số Container</th>
                            <th class="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Ghi Chú</th>
                            <th class="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center w-16">Thao tác</th>
                        </tr>
                    </thead>
                    
                    <tbody class="divide-y divide-slate-100 bg-white">
                        <tr v-if="loading" class="h-32">
                            <td :colspan="activeTab === 'container' ? 13 : 12" class="text-center">
                                <div class="flex flex-col items-center justify-center gap-2">
                                    <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    <span class="text-xs font-semibold text-slate-500">Đang đồng bộ dữ liệu...</span>
                                </div>
                            </td>
                        </tr>
                        
                        <tr v-else-if="paginatedTickets.length === 0" class="h-32">
                            <td :colspan="activeTab === 'container' ? 13 : 12" class="text-center text-xs text-slate-400 font-semibold">
                                Không có dữ liệu phiếu cân nào được hiển thị.
                            </td>
                        </tr>
                        
                        <tr 
                            v-else
                            v-for="(t, idx) in paginatedTickets" 
                            :key="t.ticketNo"
                            class="hover:bg-slate-50/70 transition-all text-xs font-semibold text-slate-700"
                        >
                            <td class="px-4 py-2.5 text-center font-mono text-slate-400">{{ (currentPage - 1) * itemsPerPage + idx + 1 }}</td>
                            <td class="px-4 py-2.5 text-center">
                                <span class="font-mono font-bold text-slate-800 bg-slate-100/80 px-2 py-0.5 rounded-lg border border-slate-200/60 inline-block text-[11px]">
                                    {{ t.ticketNo }}
                                </span>
                            </td>
                            <td class="px-4 py-2.5 text-center">
                                <span class="font-bold text-primary bg-primary/5 px-2.5 py-1 rounded-xl border border-primary/10 inline-block text-xs">
                                    {{ t.plateNumber }}
                                </span>
                            </td>
                            <td class="px-4 py-2.5 text-slate-600">{{ t.driver || '-' }}</td>
                            <td class="px-4 py-2.5 text-center font-mono text-slate-600">{{ formatWeight(t.weight1) }}</td>
                            <td class="px-4 py-2.5 text-center font-mono text-slate-600">{{ formatWeight(t.weight2) }}</td>
                            <td class="px-4 py-2.5 text-center">
                                <span class="font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200/60 inline-block text-xs">
                                    {{ formatWeight(t.weightNet) }}
                                </span>
                            </td>
                            <td class="px-4 py-2.5 text-center font-mono text-[11px] text-slate-500">{{ formatDate(t.dateIn) }}</td>
                            <td class="px-4 py-2.5 text-center font-mono text-[11px] text-slate-500">{{ formatDate(t.dateOut) }}</td>
                            <td class="px-4 py-2.5 text-slate-600">{{ t.goodsName || '-' }}</td>
                            <td v-if="activeTab === 'container'" class="px-4 py-2.5 text-center">
                                <span class="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200/60 inline-block text-[11px]">
                                    {{ (t as any).containerNo || '-' }}
                                </span>
                            </td>
                            <td class="px-4 py-2.5 text-slate-500 max-w-[180px] truncate" :title="t.note">{{ t.note || '-' }}</td>
                            <td class="px-4 py-2.5 text-center">
                                <button
                                    v-if="authStore.role === 'admin' || canDelete()"
                                    @click="deleteTicket(t)"
                                    class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95 mx-auto"
                                    title="Xóa phiếu cân"
                                >
                                    <span class="material-symbols-outlined text-base">delete</span>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination footer matching CargoAllocator layout -->
            <div class="flex items-center justify-between gap-4 pt-3 mt-4 border-t border-slate-200/80 text-xs font-semibold text-slate-500 no-print">
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-1">
                        Tổng: <span class="font-display font-black text-slate-800">{{ filteredTickets.length }}</span> bản ghi
                    </div>
                    <span class="w-[1px] h-3 bg-slate-200"></span>
                    <div class="flex items-center gap-1.5">
                        <span>Hiển thị:</span>
                        <select 
                            v-model.number="itemsPerPage"
                            class="px-2 py-1 bg-white border border-slate-200 rounded-[8px] text-xs font-bold focus:outline-none focus:border-primary transition-all cursor-pointer shadow-sm text-slate-700"
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
                            class="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-[10px] hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                        >
                            <span class="material-symbols-outlined text-sm font-bold">chevron_left</span>
                        </button>
                        
                        <span class="text-slate-600 font-bold select-none px-1">
                            Trang {{ currentPage }} / {{ totalPages }}
                        </span>
                        
                        <button 
                            @click="currentPage = Math.min(totalPages, currentPage + 1)" 
                            :disabled="currentPage === totalPages"
                            class="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-[10px] hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                        >
                            <span class="material-symbols-outlined text-sm font-bold">chevron_right</span>
                        </button>
                    </template>
                </div>
            </div>
        </div>

    </div>
</template>

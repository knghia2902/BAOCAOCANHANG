<script setup lang="ts">
import { ref, computed } from 'vue';
import type { WarehouseTicket, ContainerTicket } from '@/types/excel';
import { authStore, canCreate, canDelete } from '@/stores/auth';

const props = defineProps<{
    tickets: (WarehouseTicket | ContainerTicket)[];
    loading: boolean;
    activeTab: 'warehouse' | 'container';
    searchQuery: string;
    currentPage: number;
    itemsPerPage: number;
    totalPages: number;
    totalFiltered: number;
    previewCount?: number;
    fileName?: string;
}>();

const emit = defineEmits<{
    (e: 'update:searchQuery', val: string): void;
    (e: 'update:currentPage', val: number): void;
    (e: 'update:itemsPerPage', val: number): void;
    (e: 'delete', ticket: any): void;
    (e: 'import'): void;
    (e: 'save-import'): void;
    (e: 'cancel-import'): void;
}>();

// Column sort state
const sortKey = ref<string>('');
const sortDesc = ref<boolean>(false);

const toggleSort = (key: string) => {
    if (sortKey.value === key) {
        if (sortDesc.value) {
            sortKey.value = '';
            sortDesc.value = false;
        } else {
            sortDesc.value = true;
        }
    } else {
        sortKey.value = key;
        sortDesc.value = false;
    }
};

const sortedTickets = computed(() => {
    if (!sortKey.value) return props.tickets;

    return [...props.tickets].sort((a: any, b: any) => {
        let valA = a[sortKey.value] ?? '';
        let valB = b[sortKey.value] ?? '';

        if (typeof valA === 'number' && typeof valB === 'number') {
            return sortDesc.value ? valB - valA : valA - valB;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return sortDesc.value ? strB.localeCompare(strA) : strA.localeCompare(strB);
    });
});

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

const localSearch = computed({
    get: () => props.searchQuery,
    set: (val: string) => emit('update:searchQuery', val),
});

const localItemsPerPage = computed({
    get: () => props.itemsPerPage,
    set: (val: number) => emit('update:itemsPerPage', val),
});

const showImportBtn = computed(() => authStore.role === 'admin' || canCreate());
</script>

<template>
    <!-- Preview banner (shown when file loaded) -->
    <div v-if="previewCount && previewCount > 0" class="bg-teal-50/60 border border-teal-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-soft">
        <div class="flex items-center gap-3">
            <div class="size-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-lg">analytics</span>
            </div>
            <div class="text-left">
                <div class="text-xs font-display font-black text-slate-800">Tệp đã nạp: {{ fileName }}</div>
                <div class="text-[11px] text-slate-600 font-semibold mt-0.5">
                    Phân tích thành công <span class="text-teal-700 font-bold">{{ previewCount }}</span> phiếu cân. Dữ liệu đang ở chế độ xem trước.
                </div>
            </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
            <button
                @click="$emit('save-import')"
                class="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-soft flex items-center gap-1.5 transition-all active:scale-95"
            >
                <span class="material-symbols-outlined text-sm">cloud_sync</span>
                Lưu dữ liệu
            </button>
            <button
                @click="$emit('cancel-import')"
                class="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all active:scale-95"
            >
                <span class="material-symbols-outlined text-sm">close</span>
                Hủy
            </button>
        </div>
    </div>

    <!-- Search toolbar + Import button per CargoAllocator -->
    <div class="flex items-center justify-between gap-3">
        <div class="relative w-full sm:w-[260px] h-7 flex items-center">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">search</span>
            <input 
                type="text" 
                v-model="localSearch" 
                placeholder="Tìm kiếm..."
                class="w-full pl-9 pr-8 h-7 bg-white border border-slate-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary transition-all text-slate-700 placeholder:text-slate-400"
            />
            <button 
                v-if="localSearch" 
                @click="localSearch = ''" 
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary flex items-center"
            >
                <span class="material-symbols-outlined text-xs">close</span>
            </button>
        </div>

        <div class="flex items-center gap-2 shrink-0 h-7">
            <div class="h-7 px-2.5 bg-slate-50 rounded-[8px] border border-slate-200 text-slate-600 flex items-center font-bold text-xs">
                Tìm thấy: {{ totalFiltered }}
            </div>

            <!-- Import button matching CargoAllocator -->
            <button
                v-if="showImportBtn"
                @click="$emit('import')"
                class="h-7 px-3 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-[8px] hover:bg-primary/20 active:scale-[0.98] transition-all flex items-center gap-1.5"
            >
                <span class="material-symbols-outlined text-[14px]">upload_file</span>
                Import
            </button>
        </div>
    </div>

    <!-- Table / List view with sticky header and inner vertical scrolling -->
    <div class="flex flex-col">
        <div class="overflow-x-auto overflow-y-auto max-h-[520px] border border-slate-200/80 rounded-2xl">
            <table class="min-w-full divide-y divide-slate-100 text-left border-collapse">
                <thead class="bg-slate-50 sticky top-0 z-10">
                    <tr>
                        <th class="px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 tracking-wider w-12 text-center select-none">STT</th>
                        
                        <th @click="toggleSort('ticketNo')" class="px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center cursor-pointer hover:bg-slate-100 transition-colors select-none group">
                            <div class="flex items-center justify-center gap-1">
                                <span>Mã / Số Phiếu</span>
                                <span class="material-symbols-outlined text-[12px] text-slate-400 group-hover:text-slate-700 transition-colors">
                                    {{ sortKey === 'ticketNo' ? (sortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                </span>
                            </div>
                        </th>

                        <th @click="toggleSort('plateNumber')" class="px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center cursor-pointer hover:bg-slate-100 transition-colors select-none group">
                            <div class="flex items-center justify-center gap-1">
                                <span>Biển Số Xe</span>
                                <span class="material-symbols-outlined text-[12px] text-slate-400 group-hover:text-slate-700 transition-colors">
                                    {{ sortKey === 'plateNumber' ? (sortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                </span>
                            </div>
                        </th>

                        <th @click="toggleSort('driver')" class="px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none group">
                            <div class="flex items-center gap-1">
                                <span>Tài Xế</span>
                                <span class="material-symbols-outlined text-[12px] text-slate-400 group-hover:text-slate-700 transition-colors">
                                    {{ sortKey === 'driver' ? (sortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                </span>
                            </div>
                        </th>

                        <th @click="toggleSort('weight1')" class="px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center cursor-pointer hover:bg-slate-100 transition-colors select-none group">
                            <div class="flex items-center justify-center gap-1">
                                <span>Cân Lần 1 (kg)</span>
                                <span class="material-symbols-outlined text-[12px] text-slate-400 group-hover:text-slate-700 transition-colors">
                                    {{ sortKey === 'weight1' ? (sortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                </span>
                            </div>
                        </th>

                        <th @click="toggleSort('weight2')" class="px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center cursor-pointer hover:bg-slate-100 transition-colors select-none group">
                            <div class="flex items-center justify-center gap-1">
                                <span>Cân Lần 2 (kg)</span>
                                <span class="material-symbols-outlined text-[12px] text-slate-400 group-hover:text-slate-700 transition-colors">
                                    {{ sortKey === 'weight2' ? (sortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                </span>
                            </div>
                        </th>

                        <th @click="toggleSort('weightNet')" class="px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center cursor-pointer hover:bg-slate-100 transition-colors select-none group">
                            <div class="flex items-center justify-center gap-1">
                                <span>Khối Lượng Tịnh (kg)</span>
                                <span class="material-symbols-outlined text-[12px] text-slate-400 group-hover:text-slate-700 transition-colors">
                                    {{ sortKey === 'weightNet' ? (sortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                </span>
                            </div>
                        </th>

                        <th @click="toggleSort('dateIn')" class="px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center cursor-pointer hover:bg-slate-100 transition-colors select-none group">
                            <div class="flex items-center justify-center gap-1">
                                <span>Ngày Vào</span>
                                <span class="material-symbols-outlined text-[12px] text-slate-400 group-hover:text-slate-700 transition-colors">
                                    {{ sortKey === 'dateIn' ? (sortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                </span>
                            </div>
                        </th>

                        <th @click="toggleSort('dateOut')" class="px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center cursor-pointer hover:bg-slate-100 transition-colors select-none group">
                            <div class="flex items-center justify-center gap-1">
                                <span>Ngày Ra</span>
                                <span class="material-symbols-outlined text-[12px] text-slate-400 group-hover:text-slate-700 transition-colors">
                                    {{ sortKey === 'dateOut' ? (sortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                </span>
                            </div>
                        </th>

                        <th @click="toggleSort('goodsName')" class="px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none group">
                            <div class="flex items-center gap-1">
                                <span>Loại Hàng</span>
                                <span class="material-symbols-outlined text-[12px] text-slate-400 group-hover:text-slate-700 transition-colors">
                                    {{ sortKey === 'goodsName' ? (sortDesc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more' }}
                                </span>
                            </div>
                        </th>

                        <th v-if="activeTab === 'container'" class="px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center select-none">Số Container</th>
                        <th class="px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 tracking-wider select-none">Ghi Chú</th>
                        <th class="px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center w-16 select-none">Thao tác</th>
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
                    
                    <tr v-else-if="sortedTickets.length === 0" class="h-32">
                        <td :colspan="activeTab === 'container' ? 13 : 12" class="text-center text-xs text-slate-400 font-semibold">
                            Không có dữ liệu phiếu cân nào được hiển thị.
                        </td>
                    </tr>
                    
                    <tr 
                        v-else
                        v-for="(t, idx) in sortedTickets" 
                        :key="t.ticketNo"
                        class="hover:bg-slate-50/70 transition-all text-xs font-semibold text-slate-700"
                    >
                        <td class="px-3 py-2.5 text-center font-mono text-slate-400">{{ (currentPage - 1) * itemsPerPage + idx + 1 }}</td>
                        <td class="px-3 py-2.5 text-center font-mono font-bold text-slate-800">{{ t.ticketNo }}</td>
                        <td class="px-3 py-2.5 text-center font-bold text-slate-800">{{ t.plateNumber }}</td>
                        <td class="px-3 py-2.5 text-slate-600">{{ t.driver || '-' }}</td>
                        <td class="px-3 py-2.5 text-center font-mono text-slate-600">{{ formatWeight(t.weight1) }}</td>
                        <td class="px-3 py-2.5 text-center font-mono text-slate-600">{{ formatWeight(t.weight2) }}</td>
                        <td class="px-3 py-2.5 text-center font-mono font-bold text-primary">{{ formatWeight(t.weightNet) }}</td>
                        <td class="px-3 py-2.5 text-center font-mono text-[11px] text-slate-500">{{ formatDate(t.dateIn) }}</td>
                        <td class="px-3 py-2.5 text-center font-mono text-[11px] text-slate-500">{{ formatDate(t.dateOut) }}</td>
                        <td class="px-3 py-2.5 text-slate-600 uppercase">{{ t.goodsName || '-' }}</td>
                        <td v-if="activeTab === 'container'" class="px-3 py-2.5 text-center font-mono font-bold text-slate-700">{{ (t as any).containerNo || '-' }}</td>
                        <td class="px-3 py-2.5 text-slate-500 max-w-[180px] truncate" :title="t.note">{{ t.note || '-' }}</td>
                        <td class="px-3 py-2.5 text-center">
                            <button
                                v-if="authStore.role === 'admin' || canDelete()"
                                @click="$emit('delete', t)"
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

        <!-- Pagination footer -->
        <div class="flex items-center justify-between gap-4 pt-3 mt-4 border-t border-slate-200/80 text-xs font-semibold text-slate-500 no-print">
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-1">
                    Tổng: <span class="font-display font-black text-slate-800">{{ totalFiltered }}</span> bản ghi
                </div>
                <span class="w-[1px] h-3 bg-slate-200"></span>
                <div class="flex items-center gap-1.5">
                    <span>Hiển thị:</span>
                    <select 
                        v-model.number="localItemsPerPage"
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
                        @click="$emit('update:currentPage', Math.max(1, currentPage - 1))" 
                        :disabled="currentPage === 1"
                        class="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-[10px] hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                    >
                        <span class="material-symbols-outlined text-sm font-bold">chevron_left</span>
                    </button>
                    
                    <span class="text-slate-600 font-bold select-none px-1">
                        Trang {{ currentPage }} / {{ totalPages }}
                    </span>
                    
                    <button 
                        @click="$emit('update:currentPage', Math.min(totalPages, currentPage + 1))" 
                        :disabled="currentPage === totalPages"
                        class="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-[10px] hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                    >
                        <span class="material-symbols-outlined text-sm font-bold">chevron_right</span>
                    </button>
                </template>
            </div>
        </div>
    </div>
</template>

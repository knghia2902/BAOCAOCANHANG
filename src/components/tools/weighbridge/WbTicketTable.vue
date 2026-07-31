<script setup lang="ts">
import { computed } from 'vue';
import type { WarehouseTicket, ContainerTicket } from '@/types/excel';
import { authStore, canDelete } from '@/stores/auth';

const props = defineProps<{
    tickets: (WarehouseTicket | ContainerTicket)[];
    loading: boolean;
    activeTab: 'warehouse' | 'container';
    searchQuery: string;
    currentPage: number;
    itemsPerPage: number;
    totalPages: number;
    totalFiltered: number;
}>();

const emit = defineEmits<{
    (e: 'update:searchQuery', val: string): void;
    (e: 'update:currentPage', val: number): void;
    (e: 'update:itemsPerPage', val: number): void;
    (e: 'delete', ticket: any): void;
}>();

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
</script>

<template>
    <!-- Search toolbar -->
    <div class="flex items-center justify-between gap-4">
        <div class="relative flex-1 max-w-md">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input 
                type="text" 
                v-model="localSearch" 
                placeholder="Tìm kiếm biển số xe, số phiếu, loại hàng..."
                class="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-primary transition-all text-slate-700 font-semibold placeholder:text-slate-400"
            />
        </div>
        
        <div class="text-xs text-slate-500 font-semibold shrink-0">
            Tìm thấy <span class="text-slate-800 font-display font-black">{{ totalFiltered }}</span> bản ghi
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
                    
                    <tr v-else-if="tickets.length === 0" class="h-32">
                        <td :colspan="activeTab === 'container' ? 13 : 12" class="text-center text-xs text-slate-400 font-semibold">
                            Không có dữ liệu phiếu cân nào được hiển thị.
                        </td>
                    </tr>
                    
                    <tr 
                        v-else
                        v-for="(t, idx) in tickets" 
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

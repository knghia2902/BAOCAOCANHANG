<script setup lang="ts">
import { ref, computed } from 'vue';

export interface TruckItem {
    stt?: number;
    so_xe: string;
    so_phieu?: string;
    khoi_luong_1?: number;
    khoi_luong_2?: number;
    khoi_luong_hang?: number;
    thoi_gian_1?: string;
    thoi_gian_2?: string;
    loai_hang?: string;
    chu_hang?: string;
    ghi_chu?: string;
}

const props = defineProps<{
    trucks: TruckItem[];
    isReadOnly?: boolean;
}>();

const emit = defineEmits<{
    (e: 'printTruck', truck: TruckItem): void;
    (e: 'deleteTruck', truck: TruckItem): void;
    (e: 'editTruck', truck: TruckItem): void;
}>();

const searchQuery = ref('');
const currentPage = ref(1);
const pageSize = ref(15);

const filteredTrucks = computed(() => {
    if (!searchQuery.value.trim()) return props.trucks;
    const q = searchQuery.value.toLowerCase().trim();
    return props.trucks.filter(t => 
        (t.so_xe || '').toLowerCase().includes(q) ||
        (t.so_phieu || '').toLowerCase().includes(q) ||
        (t.chu_hang || '').toLowerCase().includes(q)
    );
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredTrucks.value.length / pageSize.value)));

const paginatedTrucks = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    return filteredTrucks.value.slice(start, start + pageSize.value);
});
</script>

<template>
    <div class="bg-white rounded-[24px] border border-primary/5 shadow-xs overflow-hidden flex flex-col">
        <!-- Table Toolbar -->
        <div class="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
            <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-gray-700">Tổng cộng:</span>
                <span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-black text-xs">{{ filteredTrucks.length }} phiếu</span>
            </div>

            <!-- Search input -->
            <div class="relative w-full sm:w-64 h-7 flex items-center">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                <input 
                    v-model="searchQuery"
                    type="text" 
                    placeholder="Tìm biển số, số phiếu..."
                    class="w-full h-7 bg-white border border-slate-200 rounded-[8px] pl-9 pr-3 text-xs font-semibold outline-none focus:border-primary text-slate-700 placeholder:text-slate-400"
                />
            </div>
        </div>

        <!-- Table Data -->
        <div class="overflow-auto scrollbar-none flex-1 min-h-0">
            <table class="w-full text-left text-xs text-gray-600">
                <thead class="sticky top-0 z-10 bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-xs border-b border-gray-100">
                    <tr>
                        <th class="px-4 py-3 text-center w-12">STT</th>
                        <th class="px-4 py-3">Biển số</th>
                        <th class="px-4 py-3">Số phiếu</th>
                        <th class="px-4 py-3 text-right">KL 1 (kg)</th>
                        <th class="px-4 py-3 text-right">KL 2 (kg)</th>
                        <th class="px-4 py-3 text-right">Hàng (kg)</th>
                        <th class="px-4 py-3 text-right">Tấn</th>
                        <th class="px-4 py-3 text-center">Thao tác</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    <tr v-if="paginatedTrucks.length === 0">
                        <td colspan="8" class="px-4 py-8 text-center text-gray-400">
                            Không có dữ liệu phiếu cân
                        </td>
                    </tr>
                    <tr 
                        v-for="(t, idx) in paginatedTrucks" 
                        :key="t.so_phieu || idx"
                        class="hover:bg-gray-50 transition-colors"
                    >
                        <td class="px-4 py-2.5 text-center font-medium text-gray-400">
                            {{ (currentPage - 1) * pageSize + idx + 1 }}
                        </td>
                        <td class="px-4 py-2.5 font-bold text-[#1e293b]">{{ t.so_xe }}</td>
                        <td class="px-4 py-2.5 font-mono text-primary font-medium">{{ t.so_phieu || '—' }}</td>
                        <td class="px-4 py-2.5 text-right font-mono">{{ (t.khoi_luong_1 || 0).toLocaleString() }}</td>
                        <td class="px-4 py-2.5 text-right font-mono">{{ (t.khoi_luong_2 || 0).toLocaleString() }}</td>
                        <td class="px-4 py-2.5 text-right font-mono font-bold text-teal-600">{{ (t.khoi_luong_hang || 0).toLocaleString() }}</td>
                        <td class="px-4 py-2.5 text-right font-mono font-bold text-primary">{{ ((t.khoi_luong_hang || 0) / 1000).toFixed(2) }}</td>
                        <td class="px-4 py-2.5 text-center">
                            <div class="flex items-center justify-center gap-1.5">
                                <button 
                                    @click="emit('printTruck', t)"
                                    class="size-8 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-600 flex items-center justify-center transition-all active:scale-95"
                                    title="In phiếu"
                                >
                                    <span class="material-symbols-outlined text-sm">print</span>
                                </button>
                                <button 
                                    v-if="!isReadOnly"
                                    @click="emit('editTruck', t)"
                                    class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all active:scale-95"
                                    title="Chỉnh sửa"
                                >
                                    <span class="material-symbols-outlined text-sm">edit</span>
                                </button>
                                <button 
                                    v-if="!isReadOnly"
                                    @click="emit('deleteTruck', t)"
                                    class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95"
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

        <!-- Pagination Bar (pinned outside scrollable table) -->
        <div v-if="totalPages > 1" class="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/30 shrink-0">
            <span>Trang {{ currentPage }} / {{ totalPages }}</span>
            <div class="flex items-center gap-1">
                <button 
                    @click="currentPage = Math.max(1, currentPage - 1)"
                    :disabled="currentPage === 1"
                    class="px-2.5 py-1 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 font-bold"
                >
                    Trước
                </button>
                <button 
                    @click="currentPage = Math.min(totalPages, currentPage + 1)"
                    :disabled="currentPage === totalPages"
                    class="px-2.5 py-1 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 font-bold"
                >
                    Sau
                </button>
            </div>
        </div>
    </div>
</template>

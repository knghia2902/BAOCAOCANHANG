<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { dbContext } from '@/services/storage/DBContext';
import { useToast } from '@/composables/useToast';
import { WeighbridgeService } from '@/services/excel/WeighbridgeService';

const props = defineProps<{
    categoryKey: string;
}>();

const { addToast } = useToast();
const syncChannel = new BroadcastChannel('allocator_sync_channel');

const searchQuery = ref('');
const editingId = ref<string | null>(null);

interface CategoryItem {
    id: string;
    name: string;
    code?: string;
    note?: string;
    capacityTons?: number;
}

const items = ref<CategoryItem[]>([]);
const loading = ref(false);

const form = ref({
    name: '',
    code: '',
    note: '',
    capacityTons: 0
});

const getStorageKey = (key: string) => `master_${key}`;

const categoryTitle = computed(() => {
    switch (props.categoryKey) {
        case 'category-customers':
            return 'Danh sách khách hàng / Đối tác';
        case 'category-warehouses':
            return 'Danh sách kho hàng';
        default:
            return 'Danh mục nền tảng';
    }
});

const categoryDescription = computed(() => {
    switch (props.categoryKey) {
        case 'category-customers':
            return 'Quản lý danh mục chủ hàng và đối tác lưu thông qua cảng (Eastwood, Gỗ Bình Định, De Heus...).';
        case 'category-warehouses':
            return 'Quản lý cấu hình thông số các kho bãi tại cảng (Kho 1, Kho 2, Kho 3, Kho 4) và sức chứa định mức.';
        default:
            return 'Quản lý danh mục dữ liệu nền tảng dùng chung cho toàn bộ hệ thống.';
    }
});

const categoryIcon = computed(() => {
    switch (props.categoryKey) {
        case 'category-customers':
            return 'groups';
        case 'category-warehouses':
            return 'domain';
        default:
            return 'dataset';
    }
});

const loadCategoryData = async () => {
    try {
        loading.value = true;
        const key = getStorageKey(props.categoryKey);
        const saved = await dbContext.get<CategoryItem[]>(key);

        if (props.categoryKey === 'category-customers') {
            const wbMaster = await WeighbridgeService.getMasterData();
            const map = new Map<string, CategoryItem>();

            if (saved && Array.isArray(saved) && saved.length > 0) {
                for (const item of saved) {
                    if (item && item.name) {
                        map.set(item.name.trim().toUpperCase(), {
                            ...item,
                            name: item.name.trim().toUpperCase()
                        });
                    }
                }
            } else {
                const defaults: CategoryItem[] = [
                    { id: '1', name: 'CÔNG TY TNHH DE HEUS', code: 'DH', note: 'Chủ hàng nông sản xá (Bắp hạt, Khô đậu nành)' },
                    { id: '2', name: 'CÔNG TY EASTWOOD ENERGY', code: 'EW', note: 'Chủ hàng viên nén gỗ - Kho 4' },
                    { id: '3', name: 'GỖ BÌNH ĐỊNH (GBD)', code: 'GBD', note: 'Chủ hàng dăm gỗ & viên nén - Kho 1, 2, 3' },
                    { id: '4', name: 'CÔNG TY CỔ PHẦN GREENFEED VIỆT NAM', code: 'GF', note: 'Chủ hàng nguyên liệu thức ăn chăn nuôi' },
                    { id: '5', name: 'CÔNG TY CỔ PHẦN CHĂN NUÔI C.P. VIỆT NAM', code: 'CP', note: 'Chủ hàng nông sản nhập khẩu' }
                ];
                for (const d of defaults) {
                    map.set(d.name, d);
                }
            }

            if (wbMaster?.customers && Array.isArray(wbMaster.customers)) {
                wbMaster.customers.forEach((cName, idx) => {
                    const clean = String(cName || '').trim().toUpperCase();
                    if (clean && !map.has(clean)) {
                        map.set(clean, {
                            id: `wb-${idx}-${Date.now()}`,
                            name: clean,
                            code: '',
                            note: 'Đồng bộ từ Danh mục Cảng'
                        });
                    }
                });
            }

            items.value = Array.from(map.values());
            await dbContext.set(key, items.value);
        } else if (saved && Array.isArray(saved) && saved.length > 0) {
            items.value = saved;
        } else {
            if (props.categoryKey === 'category-warehouses') {
                items.value = [
                    { id: '1', name: 'KHO 1', code: 'KH-01', note: 'Kho lưu trữ Gỗ Bình Định (GBD)', capacityTons: 25000 },
                    { id: '2', name: 'KHO 2', code: 'KH-02', note: 'Kho lưu trữ Gỗ Bình Định (GBD)', capacityTons: 25000 },
                    { id: '3', name: 'KHO 3', code: 'KH-03', note: 'Kho lưu trữ Gỗ Bình Định (GBD)', capacityTons: 20000 },
                    { id: '4', name: 'KHO 4', code: 'KH-04', note: 'Kho chuyên dụng Eastwood', capacityTons: 35000 }
                ];
            }
            await dbContext.set(key, items.value);
        }
    } catch (e) {
        console.error('Lỗi khi tải danh mục:', e);
    } finally {
        loading.value = false;
    }
};

const syncCustomersToMasterData = async () => {
    if (props.categoryKey !== 'category-customers') return;
    try {
        const wbMaster = await WeighbridgeService.getMasterData();
        wbMaster.customers = items.value.map(i => i.name.trim().toUpperCase()).filter(Boolean);
        await WeighbridgeService.saveMasterData(wbMaster);
        syncChannel.postMessage({ type: 'master_data' });
    } catch (e) {
        console.warn('Lỗi đồng bộ khách hàng sang WeighbridgeMasterData:', e);
    }
};

const filteredItems = computed(() => {
    return items.value.filter(item => {
        const q = searchQuery.value.toLowerCase();
        return (
            item.name.toLowerCase().includes(q) ||
            (item.code && item.code.toLowerCase().includes(q)) ||
            (item.note && item.note.toLowerCase().includes(q))
        );
    });
});

const resetForm = () => {
    editingId.value = null;
    form.value = {
        name: '',
        code: '',
        note: '',
        capacityTons: 0
    };
};

const handleSaveItem = async () => {
    if (!form.value.name.trim()) {
        addToast('Vui lòng nhập tên mục danh mục!', 'error');
        return;
    }

    const newItem: CategoryItem = {
        id: editingId.value || String(Date.now()),
        name: form.value.name.trim().toUpperCase(),
        code: form.value.code.trim().toUpperCase(),
        note: form.value.note.trim(),
        capacityTons: props.categoryKey === 'category-warehouses' ? Number(form.value.capacityTons) || 0 : undefined
    };

    if (editingId.value) {
        const idx = items.value.findIndex(i => i.id === editingId.value);
        if (idx !== -1) {
            items.value[idx] = newItem;
        }
        addToast('Đã cập nhật dữ liệu danh mục!', 'success');
    } else {
        items.value.unshift(newItem);
        addToast('Đã thêm mới vào danh mục!', 'success');
    }

    const key = getStorageKey(props.categoryKey);
    await dbContext.set(key, items.value);
    await syncCustomersToMasterData();
    resetForm();
};

const handleEditItem = (item: CategoryItem) => {
    editingId.value = item.id;
    form.value = {
        name: item.name,
        code: item.code || '',
        note: item.note || '',
        capacityTons: item.capacityTons || 0
    };
};

const handleDeleteItem = async (item: CategoryItem) => {
    if (!confirm(`Bạn có chắc muốn xóa "${item.name}" khỏi danh mục?`)) return;

    items.value = items.value.filter(i => i.id !== item.id);
    const key = getStorageKey(props.categoryKey);
    await dbContext.set(key, items.value);
    await syncCustomersToMasterData();
    if (editingId.value === item.id) resetForm();
    addToast(`Đã xóa ${item.name}`, 'info');
};

syncChannel.onmessage = async (event) => {
    if (event.data?.type === 'master_data') {
        await loadCategoryData();
    }
};

onUnmounted(() => {
    try {
        syncChannel.close();
    } catch (_) {}
});

watch(
    () => props.categoryKey,
    () => {
        resetForm();
        loadCategoryData();
    },
    { immediate: true }
);

onMounted(() => {
    loadCategoryData();
});
</script>

<template>
    <div class="w-full flex-1 flex flex-col gap-6 bg-white rounded-3xl p-6 border border-primary/5 shadow-soft font-display">
        <!-- Header Section (Đồng bộ 100% với VehicleManager.vue & GoodsManager.vue) -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
                <h3 class="text-base font-black text-primary flex items-center gap-2">
                    <span class="material-symbols-outlined text-xl">{{ categoryIcon }}</span>
                    {{ categoryTitle }}
                </h3>
                <p class="text-xs text-gray-500 font-semibold mt-1">
                    {{ categoryDescription }} Tổng cộng:
                    <span class="text-teal-600 font-bold font-mono">{{ items.length }}</span> mục.
                </p>
            </div>

            <div class="flex items-center gap-2">
                <span class="h-7 px-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-[8px] text-xs font-bold flex items-center">
                    Đồng bộ tự động
                </span>
            </div>
        </div>

        <!-- Add/Edit Form (1/3) + Search & Sticky Table (2/3) -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <!-- Left Form Card -->
            <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
                <h4 class="text-xs font-black text-primary flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base">
                        {{ editingId !== null ? 'edit_note' : 'add_circle' }}
                    </span>
                    {{ editingId !== null ? 'Cập nhật thông tin' : 'Thêm mục mới' }}
                </h4>

                <form @submit.prevent="handleSaveItem" class="flex flex-col gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {{ categoryKey === 'category-warehouses' ? 'Tên kho hàng *' : 'Tên khách hàng / Đối tác *' }}
                        </label>
                        <input
                            v-model="form.name"
                            type="text"
                            :placeholder="categoryKey === 'category-warehouses' ? 'Ví dụ: KHO 1' : 'Ví dụ: DE HEUS'"
                            required
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all"
                        />
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Mã quy chuẩn</label>
                        <input
                            v-model="form.code"
                            type="text"
                            :placeholder="categoryKey === 'category-warehouses' ? 'Ví dụ: KH-01' : 'Ví dụ: DH'"
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono"
                        />
                    </div>

                    <div v-if="categoryKey === 'category-warehouses'" class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Sức chứa định mức (tấn)</label>
                        <input
                            v-model.number="form.capacityTons"
                            type="number"
                            placeholder="Ví dụ: 25000"
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono"
                        />
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Ghi chú / Mô tả</label>
                        <textarea
                            v-model="form.note"
                            rows="2"
                            placeholder="Ghi chú chi tiết..."
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all"
                        ></textarea>
                    </div>

                    <div class="flex items-center gap-2 mt-2">
                        <button
                            type="submit"
                            class="flex-1 py-2.5 bg-primary text-white font-bold rounded-[12px] text-xs shadow-soft hover:opacity-90 transition-all cursor-pointer"
                        >
                            {{ editingId !== null ? 'Cập nhật' : 'Thêm mới' }}
                        </button>

                        <button
                            v-if="editingId !== null"
                            type="button"
                            @click="resetForm"
                            class="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-[12px] text-xs transition-all cursor-pointer"
                        >
                            Hủy
                        </button>
                    </div>
                </form>
            </div>

            <!-- Right Table & Search Card -->
            <div class="lg:col-span-2 flex flex-col gap-4">
                <!-- Search bar -->
                <div class="relative w-full">
                    <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                        search
                    </span>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Tìm theo tên, mã hiệu hoặc ghi chú..."
                        class="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-full text-xs font-semibold focus:outline-none focus:border-primary transition-all"
                    />
                </div>

                <!-- Sticky Header Table (Chuẩn DESIGN.md Mục 6) -->
                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div class="overflow-x-auto max-h-[420px]">
                        <table class="w-full text-left border-collapse text-xs font-semibold whitespace-nowrap">
                            <thead class="bg-gray-50 border-b border-gray-100 sticky top-0 z-10 text-xs font-black text-gray-500 uppercase tracking-wider select-none">
                                <tr>
                                    <th class="px-4 py-3 text-center w-14">STT</th>
                                    <th class="px-4 py-3">Tên danh mục</th>
                                    <th class="px-4 py-3">Mã hiệu</th>
                                    <th v-if="categoryKey === 'category-warehouses'" class="px-4 py-3 text-right">
                                        Sức chứa (tấn)
                                    </th>
                                    <th class="px-4 py-3">Ghi chú</th>
                                    <th class="px-4 py-3 text-center w-24">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-50">
                                <tr
                                    v-for="(item, idx) in filteredItems"
                                    :key="item.id"
                                    :class="[
                                        'hover:bg-gray-50 transition-colors',
                                        editingId === item.id ? 'bg-primary/[0.04]' : ''
                                    ]"
                                >
                                    <td class="px-4 py-3 text-center text-gray-400 font-mono font-bold">
                                        {{ idx + 1 }}
                                    </td>
                                    <td class="px-4 py-3 text-primary font-display font-black">
                                        {{ item.name }}
                                    </td>
                                    <td class="px-4 py-3 font-mono font-bold">
                                        <span
                                            v-if="item.code"
                                            class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-xs"
                                        >
                                            {{ item.code }}
                                        </span>
                                        <span v-else class="text-gray-400 italic font-normal">--</span>
                                    </td>
                                    <td
                                        v-if="categoryKey === 'category-warehouses'"
                                        class="px-4 py-3 text-right font-mono font-black text-teal-600"
                                    >
                                        {{ item.capacityTons ? Number(item.capacityTons).toLocaleString('en-US') : '--' }}
                                    </td>
                                    <td class="px-4 py-3 text-gray-600">
                                        {{ item.note || 'Không có ghi chú' }}
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        <div class="flex items-center justify-center gap-1.5">
                                            <button
                                                type="button"
                                                @click="handleEditItem(item)"
                                                class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                                title="Chỉnh sửa"
                                            >
                                                <span class="material-symbols-outlined text-sm">edit</span>
                                            </button>
                                            <button
                                                type="button"
                                                @click="handleDeleteItem(item)"
                                                class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                                title="Xóa"
                                            >
                                                <span class="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-if="filteredItems.length === 0">
                                    <td :colspan="categoryKey === 'category-warehouses' ? 6 : 5" class="px-4 py-8 text-center text-gray-400 italic">
                                        Không tìm thấy dữ liệu nào phù hợp
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

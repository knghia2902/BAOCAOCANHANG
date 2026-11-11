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
    area?: string;
    note?: string;
    capacityTons?: number;
}

const DEFAULT_WAREHOUSE_CATEGORIES: CategoryItem[] = [
    { id: 'wh-1', name: 'KHO 1', code: 'KH-01, KHO 1', area: 'Khu vực Cảng', note: 'Kho lưu trữ Gỗ Bình Định (GBD)', capacityTons: 25000 },
    { id: 'wh-2', name: 'KHO 2', code: 'KH-02, KHO 2', area: 'Khu vực Cảng', note: 'Kho lưu trữ Gỗ Bình Định (GBD)', capacityTons: 25000 },
    { id: 'wh-3', name: 'KHO 3', code: 'KH-03, KHO 3', area: 'Khu vực Cảng', note: 'Kho lưu trữ Gỗ Bình Định (GBD)', capacityTons: 20000 },
    { id: 'wh-4', name: 'KHO 4', code: 'KH-04, KHO 4', area: 'Khu vực Cảng', note: 'Kho chuyên dụng Eastwood', capacityTons: 35000 },
    { id: 'sat-1', name: 'GREEN WOOD', code: 'GREEN WOOD', area: 'Phường Đồng Xoài', note: 'Kho vệ tinh GREEN WOOD' },
    { id: 'sat-2', name: 'Kho Bình Định', code: 'BINH DINH', area: 'Xã Trừ Văn Thố', note: 'Kho vệ tinh Bình Định' },
    { id: 'sat-3', name: 'Kho Hùng', code: 'THONG HUNG PHAT, QUYNH ANH TH', area: 'Phường Tân Hiệp', note: 'Kho vệ tinh Thông Hùng Phát' },
    { id: 'sat-4', name: 'Kho Bảo', code: 'NANG LUONG HUNG PHAT, HUNG PHAT, GIA BAO, QUYNH ANH', area: 'Phường Tân Hiệp', note: 'Kho vệ tinh Hùng Phát / Bảo' },
    { id: 'sat-5', name: 'Kho Thanh', code: 'HA NAM', area: 'Bàu Bàng', note: 'Kho vệ tinh Hà Nam' },
    { id: 'sat-6', name: 'Kho Hào', code: 'NGUYEN HUY, HOANG PHUONG GREEN, KHO HAO', area: 'Phường Tân Hiệp', note: 'Kho vệ tinh Nguyễn Huy / Hoàng Phương' },
    { id: 'sat-7', name: 'Kho Mạnh', code: 'TUAN DUY', area: 'Nam Tân Uyên', note: 'Kho vệ tinh Tuấn Duy' },
    { id: 'sat-8', name: 'Kho Bích Tân Uyên', code: 'KHAI HOAN PHAT', area: 'Phường Tân Hiệp', note: 'Kho vệ tinh Khải Hoàn Phát' },
    { id: 'sat-9', name: 'Kho Cúc', code: 'THUY MOC THINH, KHO CUC', area: 'Xã Phước Hòa', note: 'Kho vệ tinh Thủy Mộc Thịnh / Cúc' },
    { id: 'sat-10', name: 'Kho Tài', code: 'HOA BINH', area: 'Phường Bình Phước', note: 'Kho vệ tinh Hòa Bình' },
    { id: 'sat-11', name: 'Kho Lan Bình Chuẩn', code: 'NANG LUONG TUONG LAI', area: 'Phường Tân Khánh', note: 'Kho vệ tinh Năng Lượng Tương Lai' },
    { id: 'sat-12', name: 'Kho Khánh Bình 53', code: 'KB53', area: 'Phường Tân Hiệp', note: 'Kho vệ tinh KB53' }
];

const items = ref<CategoryItem[]>([]);
const loading = ref(false);

const form = ref({
    name: '',
    code: '',
    area: '',
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
            return 'Quản lý danh sách kho cảng (Kho 1-4) và các kho vệ tinh (GREEN WOOD, Kho Bảo, Kho Hùng...). Dữ liệu này dùng để chuẩn hóa Tên kho & Khu vực trong Báo cáo tồn kho.';
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

function stripAccents(str: string): string {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

const syncWarehousesToPlaceMap = async () => {
    if (props.categoryKey !== 'category-warehouses') return;
    try {
        const placeMap: Record<string, { tenKho: string; khuVuc: string }> = {};
        for (const item of items.value) {
            const tenKho = item.name.trim();
            const khuVuc = (item.area || '').trim();
            const normName = stripAccents(tenKho).toUpperCase().replace(/\s+/g, ' ').trim();
            if (normName) {
                placeMap[normName] = { tenKho, khuVuc };
            }
            if (item.code) {
                const keywords = item.code.split(',').map(s => s.trim()).filter(Boolean);
                for (const kw of keywords) {
                    const normKw = stripAccents(kw).toUpperCase().replace(/\s+/g, ' ').trim();
                    if (normKw) {
                        placeMap[normKw] = { tenKho, khuVuc };
                    }
                }
            }
        }
        await dbContext.set('weighbridge_custom_place_map', placeMap);
        syncChannel.postMessage({ type: 'warehouses_updated' });
    } catch (e) {
        console.warn('Lỗi đồng bộ kho hàng sang placeMap:', e);
    }
};

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
        } else if (props.categoryKey === 'category-warehouses') {
            if (saved && Array.isArray(saved) && saved.length > 0) {
                // If only basic 4 warehouses were saved previously, enrich with satellites
                if (saved.length <= 4 && !saved.some(i => i.id?.startsWith('sat-'))) {
                    const existingNames = new Set(saved.map(s => stripAccents(s.name).toUpperCase()));
                    const toAdd = DEFAULT_WAREHOUSE_CATEGORIES.filter(d => !existingNames.has(stripAccents(d.name).toUpperCase()));
                    items.value = [...saved, ...toAdd];
                } else {
                    items.value = saved;
                }
            } else {
                items.value = JSON.parse(JSON.stringify(DEFAULT_WAREHOUSE_CATEGORIES));
            }
            await dbContext.set(key, items.value);
            await syncWarehousesToPlaceMap();
        } else if (saved && Array.isArray(saved) && saved.length > 0) {
            items.value = saved;
        } else {
            items.value = [];
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
            (item.area && item.area.toLowerCase().includes(q)) ||
            (item.note && item.note.toLowerCase().includes(q))
        );
    });
});

const resetForm = () => {
    editingId.value = null;
    form.value = {
        name: '',
        code: '',
        area: '',
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
        area: props.categoryKey === 'category-warehouses' ? form.value.area.trim() : undefined,
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
    await syncWarehousesToPlaceMap();
    resetForm();
};

const handleEditItem = (item: CategoryItem) => {
    editingId.value = item.id;
    form.value = {
        name: item.name,
        code: item.code || '',
        area: item.area || '',
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
    await syncWarehousesToPlaceMap();
    if (editingId.value === item.id) resetForm();
    addToast(`Đã xóa ${item.name}`, 'info');
};

const handleResetStandardWarehouses = async () => {
    if (!confirm('Khôi phục danh sách kho về 16 kho mẫu chuẩn ban đầu (4 kho cảng + 12 kho vệ tinh)?')) return;
    items.value = JSON.parse(JSON.stringify(DEFAULT_WAREHOUSE_CATEGORIES));
    const key = getStorageKey(props.categoryKey);
    await dbContext.set(key, items.value);
    await syncWarehousesToPlaceMap();
    resetForm();
    addToast('Đã khôi phục 16 kho chuẩn thành công!', 'success');
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
                <button
                    v-if="categoryKey === 'category-warehouses'"
                    type="button"
                    @click="handleResetStandardWarehouses"
                    class="h-7 px-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold rounded-[8px] transition-all flex items-center gap-1 cursor-pointer"
                    title="Khôi phục danh sách 16 kho hàng và mã nhận diện chuẩn (4 kho cảng + 12 kho vệ tinh)"
                >
                    <span class="material-symbols-outlined text-sm">restart_alt</span>
                    Nạp 16 kho chuẩn
                </button>
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
                            :placeholder="categoryKey === 'category-warehouses' ? 'Ví dụ: KHO 1 hoặc GREEN WOOD' : 'Ví dụ: DE HEUS'"
                            required
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all"
                        />
                    </div>

                    <div v-if="categoryKey === 'category-warehouses'" class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Khu vực *</label>
                        <input
                            v-model="form.area"
                            type="text"
                            placeholder="Ví dụ: Phường Tân Hiệp, Phường Đồng Xoài, Cảng..."
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all"
                        />
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {{ categoryKey === 'category-warehouses' ? 'Mã hiệu / Nơi xuất nhận diện' : 'Mã quy chuẩn' }}
                        </label>
                        <input
                            v-model="form.code"
                            type="text"
                            :placeholder="categoryKey === 'category-warehouses' ? 'Ví dụ: GREEN WOOD hoặc HUNG PHAT, NANG LUONG HUNG PHAT' : 'Ví dụ: DH'"
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono"
                        />
                        <p v-if="categoryKey === 'category-warehouses'" class="text-[11px] text-gray-400">
                            Có thể nhập nhiều mã / nơi xuất trên phiếu cân, phân tách bằng dấu phẩy.
                        </p>
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
                                    <th class="px-4 py-3">{{ categoryKey === 'category-warehouses' ? 'Tên kho hàng' : 'Tên danh mục' }}</th>
                                    <th v-if="categoryKey === 'category-warehouses'" class="px-4 py-3 w-40">Khu vực</th>
                                    <th class="px-4 py-3">{{ categoryKey === 'category-warehouses' ? 'Mã hiệu / Nơi xuất' : 'Mã hiệu' }}</th>
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
                                    <td v-if="categoryKey === 'category-warehouses'" class="px-4 py-3 text-slate-600 font-semibold">
                                        <span v-if="item.area" class="px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-xs font-bold">
                                            {{ item.area }}
                                        </span>
                                        <span v-else class="text-gray-400 italic">--</span>
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
                                    <td :colspan="categoryKey === 'category-warehouses' ? 7 : 5" class="px-4 py-8 text-center text-gray-400 italic">
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

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import {
    WeighbridgeService,
    DEFAULT_MASTER_DATA,
    type Vessel,
    type Barge,
    type MasterCargoItem,
    type WeighbridgeMasterData
} from '@/services/excel/WeighbridgeService';
import { dbContext } from '@/services/storage/DBContext';
import { useToast } from '@/composables/useToast';

const { addToast } = useToast();
const syncChannel = new BroadcastChannel('allocator_sync_channel');

const vessels = ref<Vessel[]>([]);
const loading = ref(true);
const selectedVesselId = ref<number | null>(null);

// Master Categories synced from "2. DANH MỤC" on tree sidebar
const masterGoods = ref<MasterCargoItem[]>([]);
const masterCustomers = ref<string[]>([]);

// Toggle custom input when item is not yet in Danh mục
const vesselCustomGoods = ref(false);
const vesselCustomCustomer = ref(false);
const isSavingVessel = ref(false);
const isSavingBarge = ref(false);

// Search
const searchQuery = ref('');
const bargeSearchQuery = ref('');

// Modal States
const showVesselModal = ref(false);
const showBargeModal = ref(false);
const editingVessel = ref<Vessel | null>(null);
const editingBarge = ref<{ vesselId: number; barge: Barge } | null>(null);

const vesselForm = ref({
    id: 0,
    name: '',
    customer: '',
    cargo_type: '',
    cargo_code: '',
    is_pinned: false
});

const bargeForm = ref({
    id: 0,
    name: '',
    orderNo: ''
});

// Sắp xếp: Tàu được ghim (is_pinned) luôn lên đầu, trong cùng nhóm xếp theo id giảm dần
const sortVesselsList = (list: Vessel[]): Vessel[] => {
    return [...list].sort((a, b) => {
        const pinA = a.is_pinned ? 1 : 0;
        const pinB = b.is_pinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        return Number(b.id || 0) - Number(a.id || 0);
    });
};

// Tự động tính số thứ tự lệnh tiếp theo cho sà lan mới dựa trên số lệnh lớn nhất hiện có
const calculateNextOrderNo = (): string => {
    let maxNum = 0;
    for (const vessel of vessels.value) {
        if (vessel.barges) {
            for (const barge of vessel.barges) {
                const orderStr = barge.config?.orderNo || '';
                const match = orderStr.match(/(\d+)$/);
                if (match) {
                    const num = parseInt(match[1] || '', 10);
                    if (num > maxNum) maxNum = num;
                } else {
                    const num = parseInt(orderStr, 10);
                    if (!isNaN(num) && num > maxNum) maxNum = num;
                }
            }
        }
    }
    return String(maxNum + 1);
};

const loadVessels = async () => {
    try {
        loading.value = true;
        const data = await WeighbridgeService.getVessels();
        vessels.value = sortVesselsList(data || []);
        if (vessels.value.length > 0 && !selectedVesselId.value) {
            selectedVesselId.value = vessels.value[0]?.id ?? null;
        }
    } catch (e) {
        console.error('Lỗi tải danh sách tàu:', e);
        addToast('Không thể tải danh sách nguồn tàu', 'error');
    } finally {
        loading.value = false;
    }
};

const totalBargesCount = computed(() =>
    vessels.value.reduce((acc, v) => acc + (v.barges ? v.barges.length : 0), 0)
);

// Hiển thị tổng quan TẤT CẢ các tàu (không chia trạng thái Đang làm / Đã hoàn thành)
const filteredVessels = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return vessels.value;
    return vessels.value.filter(
        v =>
            v.name.toLowerCase().includes(q) ||
            (v.customer || '').toLowerCase().includes(q) ||
            (v.cargo_type || '').toLowerCase().includes(q) ||
            (v.cargo_code || '').toLowerCase().includes(q)
    );
});

const selectedVessel = computed(() => {
    return vessels.value.find(v => v.id === selectedVesselId.value) || null;
});

const filteredBarges = computed(() => {
    if (!selectedVessel.value || !selectedVessel.value.barges) return [];
    const q = bargeSearchQuery.value.trim().toLowerCase();
    if (!q) return selectedVessel.value.barges;
    return selectedVessel.value.barges.filter(
        b =>
            b.name.toLowerCase().includes(q) ||
            (b.config?.orderNo || '').toLowerCase().includes(q)
    );
});

const loadMasterCategories = async (fetchRemote = false) => {
    try {
        let wbMaster = await dbContext.get<WeighbridgeMasterData>('weighbridge_master_data');
        if (!wbMaster || fetchRemote) {
            wbMaster = await WeighbridgeService.getMasterData();
        }
        const safeMaster = wbMaster || DEFAULT_MASTER_DATA;

        // 1. Merge Goods (Loại hàng & Mã hàng)
        const goodsMap = new Map<string, string>();
        if (safeMaster.goods && Array.isArray(safeMaster.goods)) {
            for (const g of safeMaster.goods) {
                if (g && g.name) {
                    goodsMap.set(g.name.trim().toUpperCase(), (g.code || '').trim().toUpperCase());
                }
            }
        }
        const savedAllocGoods = await dbContext.get<string[]>('allocator_goods');
        if (savedAllocGoods && Array.isArray(savedAllocGoods)) {
            for (const name of savedAllocGoods) {
                const cleanName = String(name || '').trim().toUpperCase();
                if (cleanName && !goodsMap.has(cleanName)) {
                    goodsMap.set(cleanName, '');
                }
            }
        }
        masterGoods.value = Array.from(goodsMap.entries()).map(([name, code]) => ({ name, code }));

        // 2. Merge Customers (Khách hàng / Chủ hàng)
        const custSet = new Set<string>();
        const savedCatCustomers = await dbContext.get<{ id: string; name: string; code?: string }[]>('master_category-customers');
        if (savedCatCustomers && Array.isArray(savedCatCustomers)) {
            for (const c of savedCatCustomers) {
                if (c && c.name) {
                    custSet.add(c.name.trim().toUpperCase());
                }
            }
        }
        if (safeMaster.customers && Array.isArray(safeMaster.customers)) {
            for (const c of safeMaster.customers) {
                const cleanC = String(c || '').trim().toUpperCase();
                if (cleanC) custSet.add(cleanC);
            }
        }
        masterCustomers.value = Array.from(custSet);
    } catch (e) {
        console.warn('Lỗi khi tải dữ liệu Danh mục cho Tạo nguồn tàu:', e);
    }
};

const syncNewEntryToMasterCategories = async (cargoType: string, cargoCode: string, customerName: string) => {
    try {
        const cleanCargo = cargoType.trim().toUpperCase();
        const cleanCode = cargoCode.trim().toUpperCase();
        const cleanCustomer = customerName.trim().toUpperCase();

        if (!cleanCargo && !cleanCustomer) return;

        const cachedMaster = (await dbContext.get<WeighbridgeMasterData>('weighbridge_master_data')) || {
            customers: [...DEFAULT_MASTER_DATA.customers],
            goods: [...DEFAULT_MASTER_DATA.goods]
        };
        const wbMaster: WeighbridgeMasterData = {
            customers: Array.isArray(cachedMaster.customers) ? [...cachedMaster.customers] : [],
            goods: Array.isArray(cachedMaster.goods) ? cachedMaster.goods.map(g => ({ ...g })) : []
        };

        let masterChanged = false;

        if (cleanCargo) {
            const existingGood = wbMaster.goods.find(g => g.name.trim().toUpperCase() === cleanCargo);
            if (!existingGood) {
                wbMaster.goods.unshift({ name: cleanCargo, code: cleanCode });
                masterChanged = true;
            } else if (cleanCode && existingGood.code !== cleanCode) {
                existingGood.code = cleanCode;
                masterChanged = true;
            }

            const savedAllocGoods = (await dbContext.get<string[]>('allocator_goods')) || [];
            if (!savedAllocGoods.some(g => String(g).trim().toUpperCase() === cleanCargo)) {
                savedAllocGoods.unshift(cleanCargo);
                await dbContext.set('allocator_goods', savedAllocGoods);
                syncChannel.postMessage({ type: 'goods' });
            }
        }

        if (cleanCustomer) {
            if (!wbMaster.customers.some(c => c.trim().toUpperCase() === cleanCustomer)) {
                wbMaster.customers.unshift(cleanCustomer);
                masterChanged = true;
            }

            const savedCatCustomers =
                (await dbContext.get<{ id: string; name: string; code?: string; note?: string }[]>('master_category-customers')) || [];
            if (!savedCatCustomers.some(c => c.name.trim().toUpperCase() === cleanCustomer)) {
                savedCatCustomers.unshift({
                    id: String(Date.now()),
                    name: cleanCustomer,
                    code: '',
                    note: 'Tự động thêm từ Khai báo Nguồn tàu'
                });
                await dbContext.set('master_category-customers', savedCatCustomers);
            }
        }

        if (masterChanged) {
            await dbContext.set('weighbridge_master_data', wbMaster);
            void WeighbridgeService.saveMasterData(wbMaster);
        }
        await loadMasterCategories(false);
        syncChannel.postMessage({ type: 'master_data' });
    } catch (e) {
        console.warn('Không thể tự động lưu mục mới vào Danh mục:', e);
    }
};

const onVesselCargoSelectChange = (e: Event) => {
    const val = (e.target as HTMLSelectElement).value;
    if (val === '__NEW__') {
        vesselCustomGoods.value = true;
        vesselForm.value.cargo_type = '';
        vesselForm.value.cargo_code = '';
        return;
    }
    vesselForm.value.cargo_type = val;
    const found = masterGoods.value.find(g => g.name.toUpperCase() === val.toUpperCase());
    if (found) {
        vesselForm.value.cargo_code = found.code || '';
    }
};

const onVesselCustomerSelectChange = (e: Event) => {
    const val = (e.target as HTMLSelectElement).value;
    if (val === '__NEW__') {
        vesselCustomCustomer.value = true;
        vesselForm.value.customer = '';
        return;
    }
    vesselForm.value.customer = val;
};

const openAddVesselModal = async () => {
    await loadMasterCategories(false);
    editingVessel.value = null;
    vesselForm.value = {
        id: 0,
        name: '',
        customer: '',
        cargo_type: '',
        cargo_code: '',
        is_pinned: false
    };
    vesselCustomGoods.value = masterGoods.value.length === 0;
    vesselCustomCustomer.value = masterCustomers.value.length === 0;
    showVesselModal.value = true;
};

const openEditVesselModal = async (vessel: Vessel) => {
    await loadMasterCategories(false);
    editingVessel.value = vessel;
    const cargoType = (vessel.cargo_type || '').trim();
    const customer = (vessel.customer || '').trim();
    vesselForm.value = {
        id: vessel.id,
        name: vessel.name,
        customer,
        cargo_type: cargoType,
        cargo_code: vessel.cargo_code || '',
        is_pinned: Boolean(vessel.is_pinned)
    };
    vesselCustomGoods.value =
        masterGoods.value.length === 0 ||
        (!!cargoType && !masterGoods.value.some(g => g.name.toUpperCase() === cargoType.toUpperCase()));
    vesselCustomCustomer.value =
        masterCustomers.value.length === 0 ||
        (!!customer && !masterCustomers.value.some(c => c.toUpperCase() === customer.toUpperCase()));
    showVesselModal.value = true;
};

const handleTogglePinVessel = async (vessel: Vessel) => {
    try {
        const newPinned = await WeighbridgeService.toggleVesselPinned(vessel.id, !vessel.is_pinned);
        vessel.is_pinned = newPinned;
        vessels.value = sortVesselsList(vessels.value);
        if (newPinned) {
            addToast(`Đã ghim tàu đặc biệt "${vessel.name}" lên đầu danh sách`, 'success');
        } else {
            addToast(`Đã bỏ ghim tàu "${vessel.name}"`, 'info');
        }
    } catch (e) {
        console.error('Lỗi khi ghim tàu:', e);
        addToast('Không thể thay đổi trạng thái ghim tàu', 'error');
    }
};

const handleSaveVessel = async () => {
    if (!vesselForm.value.name.trim()) {
        addToast('Vui lòng nhập tên tàu mẹ', 'error');
        return;
    }
    if (isSavingVessel.value) return;

    const nameUpper = vesselForm.value.name.trim().toUpperCase();
    const cleanCustomer = vesselForm.value.customer.trim().toUpperCase();
    const cleanCargoType = vesselForm.value.cargo_type.trim().toUpperCase();
    const cleanCargoCode = vesselForm.value.cargo_code.trim().toUpperCase();
    const isPinned = Boolean(vesselForm.value.is_pinned);

    isSavingVessel.value = true;
    try {
        if (editingVessel.value) {
            const targetId = editingVessel.value.id;
            await WeighbridgeService.updateVessel(targetId, {
                name: nameUpper,
                customer: cleanCustomer,
                cargo_type: cleanCargoType,
                cargo_code: cleanCargoCode,
                is_pinned: isPinned
            });

            const idx = vessels.value.findIndex(v => v.id === targetId);
            if (idx !== -1 && vessels.value[idx]) {
                vessels.value[idx] = {
                    ...vessels.value[idx],
                    name: nameUpper,
                    customer: cleanCustomer,
                    cargo_type: cleanCargoType,
                    cargo_code: cleanCargoCode,
                    is_pinned: isPinned
                };
            }
            vessels.value = sortVesselsList(vessels.value);
            addToast(`Đã cập nhật thông tin tàu ${nameUpper}`, 'success');
        } else {
            const created = await WeighbridgeService.createVessel(
                nameUpper,
                cleanCustomer,
                cleanCargoType,
                cleanCargoCode,
                isPinned
            );
            if (created) {
                vessels.value = sortVesselsList([created, ...vessels.value]);
                selectedVesselId.value = created.id;
                searchQuery.value = '';
            }
            addToast(`Đã thêm mới nguồn tàu ${nameUpper}`, 'success');
        }

        showVesselModal.value = false;
        void syncNewEntryToMasterCategories(cleanCargoType, cleanCargoCode, cleanCustomer);
        void loadVessels();
    } catch (e) {
        console.error('Lỗi khi lưu tàu:', e);
        addToast('Lỗi khi lưu thông tin tàu', 'error');
    } finally {
        isSavingVessel.value = false;
    }
};

const handleDeleteVessel = async (vessel: Vessel) => {
    if (!confirm(`Bạn có chắc muốn xóa nguồn tàu "${vessel.name}"? Thao tác này không thể hoàn tác.`)) return;

    try {
        await WeighbridgeService.deleteVessel(vessel.id);
        addToast(`Đã xóa nguồn tàu ${vessel.name}`, 'info');
        await loadVessels();
    } catch (e) {
        console.error('Lỗi khi xóa tàu:', e);
        addToast('Không thể xóa tàu, vui lòng thử lại', 'error');
    }
};

// Barge management (Tự động kế thừa Loại hàng, Mã hàng, Chủ hàng từ Tàu mẹ đang chọn)
const openAddBargeModal = () => {
    if (!selectedVessel.value) return;
    editingBarge.value = null;
    const nextOrder = calculateNextOrderNo();
    bargeForm.value = {
        id: 0,
        name: '',
        orderNo: nextOrder
    };
    showBargeModal.value = true;
};

const openEditBargeModal = (barge: Barge) => {
    if (!selectedVessel.value) return;
    editingBarge.value = { vesselId: selectedVessel.value.id, barge };
    bargeForm.value = {
        id: barge.id,
        name: barge.name,
        orderNo: barge.config?.orderNo || ''
    };
    showBargeModal.value = true;
};

const handleSaveBarge = async () => {
    if (!selectedVessel.value) return;
    if (!bargeForm.value.name.trim()) {
        addToast('Vui lòng nhập tên sà lan', 'error');
        return;
    }
    if (isSavingBarge.value) return;

    const bargeNameUpper = bargeForm.value.name.trim().toUpperCase();
    let cleanOrderNo = bargeForm.value.orderNo.trim().toUpperCase();
    if (!cleanOrderNo && !editingBarge.value) {
        cleanOrderNo = calculateNextOrderNo();
    }
    const vesselGoods = (selectedVessel.value.cargo_type || '').trim().toUpperCase();
    const vesselGoodsCode = (selectedVessel.value.cargo_code || '').trim().toUpperCase();
    const vesselOwner = (selectedVessel.value.customer || '').trim().toUpperCase();

    isSavingBarge.value = true;
    try {
        if (editingBarge.value) {
            const bargeId = editingBarge.value.barge.id;
            await WeighbridgeService.updateBarge(bargeId, bargeNameUpper);
            await WeighbridgeService.updateBargeConfig(bargeId, {
                ...editingBarge.value.barge.config,
                orderNo: cleanOrderNo,
                goods: vesselGoods || editingBarge.value.barge.config?.goods || '',
                goodsCode: vesselGoodsCode || editingBarge.value.barge.config?.goodsCode || '',
                owner: vesselOwner || editingBarge.value.barge.config?.owner || ''
            });
            addToast(`Đã cập nhật sà lan ${bargeNameUpper}`, 'success');
        } else {
            const created = await WeighbridgeService.createBarge(
                selectedVessel.value.id,
                bargeNameUpper,
                cleanOrderNo
            );
            if (created) {
                await WeighbridgeService.updateBargeConfig(created.id, {
                    ...created.config,
                    orderNo: cleanOrderNo || created.config?.orderNo || '',
                    goods: vesselGoods,
                    goodsCode: vesselGoodsCode,
                    owner: vesselOwner,
                    locked: false
                });
            }
            addToast(`Đã thêm sà lan ${bargeNameUpper} (Mã lệnh: ${cleanOrderNo})`, 'success');
        }
        showBargeModal.value = false;
        await loadVessels();
    } catch (e) {
        console.error('Lỗi khi lưu sà lan:', e);
        addToast('Không thể lưu sà lan, vui lòng thử lại', 'error');
    } finally {
        isSavingBarge.value = false;
    }
};

const handleDeleteBarge = async (barge: Barge) => {
    if (!confirm(`Bạn có chắc muốn xóa sà lan "${barge.name}" khỏi tàu?`)) return;

    try {
        await WeighbridgeService.deleteBarge(barge.id);
        addToast(`Đã xóa sà lan ${barge.name}`, 'info');
        await loadVessels();
    } catch (e) {
        console.error('Lỗi khi xóa sà lan:', e);
    }
};

syncChannel.onmessage = async (event) => {
    if (event.data?.type === 'goods' || event.data?.type === 'master_data') {
        await loadMasterCategories(false);
    }
};

onUnmounted(() => {
    try {
        syncChannel.close();
    } catch (_) {}
});

onMounted(async () => {
    await loadMasterCategories(false);
    await loadVessels();
    void loadMasterCategories(true);
});
</script>

<template>
    <div class="h-full flex flex-col font-display min-h-0">
        <!-- Split Workspace toàn màn hình (Trái: Tổng quan tất cả tàu mẹ | Phải: Danh sách sà lan của tàu đang chọn) -->
        <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3.5 min-h-0">
            <!-- Left Column: Tổng quan tất cả tàu mẹ (5 cols) -->
            <div class="lg:col-span-5 bg-white rounded-[24px] soft-shadow border border-primary/5 flex flex-col overflow-hidden min-h-0">
                <!-- Toolbar chuẩn DESIGN.md Mục 6 -->
                <div class="p-3 px-4 border-b border-primary/5 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <div class="relative flex-1 min-w-[160px]">
                        <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                            search
                        </span>
                        <input
                            v-model="searchQuery"
                            type="text"
                            placeholder="Tìm tên tàu, loại hàng, khách hàng..."
                            class="w-full h-7 pl-8 pr-2.5 bg-white border border-slate-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0">
                        <span class="h-7 px-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-[8px] text-xs font-bold flex items-center">
                            {{ filteredVessels.length }} tàu • {{ totalBargesCount }} SL
                        </span>

                        <button
                            type="button"
                            @click="openAddVesselModal"
                            class="h-7 px-3 bg-primary text-white border border-primary text-xs font-bold rounded-[8px] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                            <span class="material-symbols-outlined text-sm">add</span>
                            Tàu mới
                        </button>
                    </div>
                </div>

                <!-- Danh sách tổng quan tất cả tàu mẹ (Thiết kế 2 dòng tinh gọn) -->
                <div class="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scroll">
                    <div v-if="loading" class="py-12 text-center text-slate-400 text-xs">
                        <span class="material-symbols-outlined animate-spin text-2xl text-primary mb-2">sync</span>
                        <p class="font-bold">Đang tải danh sách tàu...</p>
                    </div>

                    <div v-else-if="filteredVessels.length === 0" class="py-12 text-center text-slate-400 text-xs">
                        <span class="material-symbols-outlined text-3xl text-slate-300 mb-1">sailing</span>
                        <p class="font-bold">Không tìm thấy tàu mẹ nào</p>
                    </div>

                    <div
                        v-for="vessel in filteredVessels"
                        :key="vessel.id"
                        @click="selectedVesselId = vessel.id"
                        :class="[
                            'px-3.5 py-2.5 rounded-2xl border transition-all cursor-pointer group',
                            selectedVesselId === vessel.id
                                ? 'bg-primary/[0.06] border-primary shadow-xs'
                                : (vessel.is_pinned
                                    ? 'bg-amber-50/25 border-amber-200/80 hover:border-amber-300 hover:bg-amber-50/50'
                                    : 'bg-white border-gray-100 hover:border-primary/30 hover:bg-gray-50/70')
                        ]"
                    >
                        <!-- Dòng 1: Tên tàu + Badge Ghim + Số sà lan + Nút Ghim/Sửa/Xóa gọn ngay bên phải -->
                        <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span
                                    :class="[
                                        'material-symbols-outlined text-base shrink-0',
                                        vessel.is_pinned
                                            ? 'text-amber-500'
                                            : (selectedVesselId === vessel.id ? 'text-primary' : 'text-gray-400')
                                    ]"
                                >
                                    {{ vessel.is_pinned ? 'push_pin' : 'directions_boat' }}
                                </span>
                                <h3 class="text-xs font-display font-black text-[#1e293b] truncate group-hover:text-primary transition-colors">
                                    {{ vessel.name }}
                                </h3>
                                <span
                                    v-if="vessel.is_pinned"
                                    class="px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold flex items-center gap-0.5 shrink-0"
                                    title="Tàu đặc biệt được ghim lên đầu"
                                >
                                    Đặc biệt
                                </span>
                            </div>

                            <div class="flex items-center gap-1.5 shrink-0">
                                <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                                    {{ (vessel.barges || []).length }} sà lan
                                </span>
                                <button
                                    type="button"
                                    @click.stop="handleTogglePinVessel(vessel)"
                                    :class="[
                                        'size-7 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer',
                                        vessel.is_pinned
                                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-700 shadow-xs'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600'
                                    ]"
                                    :title="vessel.is_pinned ? 'Bỏ ghim tàu đặc biệt' : 'Ghim tàu đặc biệt lên đầu'"
                                >
                                    <span class="material-symbols-outlined text-xs">push_pin</span>
                                </button>
                                <button
                                    type="button"
                                    @click.stop="openEditVesselModal(vessel)"
                                    class="size-7 rounded-full bg-primary/5 hover:bg-primary/15 text-primary flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                    title="Sửa thông tin tàu"
                                >
                                    <span class="material-symbols-outlined text-xs">edit</span>
                                </button>
                                <button
                                    type="button"
                                    @click.stop="handleDeleteVessel(vessel)"
                                    class="size-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                    title="Xóa tàu"
                                >
                                    <span class="material-symbols-outlined text-xs">delete</span>
                                </button>
                            </div>
                        </div>

                        <!-- Dòng 2: Loại hàng (Mã hàng) • Khách hàng -->
                        <div class="mt-1 pl-6 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 font-semibold">
                            <span class="truncate">
                                Hàng:
                                <strong class="text-[#1e293b] font-bold">
                                    {{ vessel.cargo_type || 'Chưa gán' }}{{ vessel.cargo_code ? ` (${vessel.cargo_code})` : '' }}
                                </strong>
                            </span>
                            <span class="text-slate-300">•</span>
                            <span class="truncate">
                                Khách:
                                <strong class="text-[#1e293b] font-bold">{{ vessel.customer || 'Chưa gán' }}</strong>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Danh sách Sà lan tiếp nhận của Tàu đang chọn (7 cols) -->
            <div class="lg:col-span-7 bg-white rounded-[24px] soft-shadow border border-primary/5 p-4 flex flex-col gap-3 overflow-hidden min-h-0">
                <template v-if="selectedVessel">
                    <!-- Toolbar + Thông tin tàu mẹ kế thừa (DESIGN.md Mục 6) -->
                    <div class="flex flex-col gap-2 pb-2.5 border-b border-gray-100 shrink-0">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="flex items-center gap-2 min-w-0">
                                <span class="material-symbols-outlined text-primary text-lg">layers</span>
                                <h3 class="text-sm font-display font-black text-[#1e293b] truncate">
                                    {{ selectedVessel.name }}
                                </h3>
                                <span
                                    v-if="selectedVessel.is_pinned"
                                    class="h-7 px-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-[8px] text-xs font-bold flex items-center gap-1 shrink-0"
                                    title="Tàu đặc biệt được ghim"
                                >
                                    <span class="material-symbols-outlined text-xs text-amber-600">push_pin</span>
                                    Đặc biệt
                                </span>
                                <span class="h-7 px-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-[8px] text-xs font-bold flex items-center shrink-0">
                                    {{ filteredBarges.length }} sà lan
                                </span>
                            </div>

                            <div class="flex flex-wrap items-center gap-2">
                                <div class="relative">
                                    <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                                        search
                                    </span>
                                    <input
                                        v-model="bargeSearchQuery"
                                        type="text"
                                        placeholder="Lọc sà lan, mã lệnh..."
                                        class="h-7 pl-8 pr-3 bg-white border border-slate-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-primary w-44"
                                    />
                                </div>

                                <button
                                    type="button"
                                    @click="handleTogglePinVessel(selectedVessel)"
                                    :class="[
                                        'h-7 px-2.5 rounded-[8px] border text-xs font-bold flex items-center gap-1 transition-all cursor-pointer',
                                        selectedVessel.is_pinned
                                            ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    ]"
                                    :title="selectedVessel.is_pinned ? 'Bỏ ghim tàu đặc biệt' : 'Ghim tàu đặc biệt lên đầu'"
                                >
                                    <span class="material-symbols-outlined text-xs text-amber-600">push_pin</span>
                                    <span>{{ selectedVessel.is_pinned ? 'Đã ghim' : 'Ghim tàu' }}</span>
                                </button>

                                <button
                                    type="button"
                                    @click="openAddBargeModal"
                                    class="h-7 px-3 bg-teal-600 text-white border border-teal-600 text-xs font-bold rounded-[8px] hover:bg-teal-700 active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                >
                                    <span class="material-symbols-outlined text-sm">add</span>
                                    Thêm sà lan
                                </button>
                            </div>
                        </div>

                        <!-- Dải thông tin chung của tàu mẹ (thay vì lặp lại trên từng dòng sà lan) -->
                        <div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                            <span class="px-2.5 py-0.5 rounded-lg bg-primary/5 text-primary border border-primary/15 font-bold">
                                Loại hàng: {{ selectedVessel.cargo_type || 'Chưa gán' }}{{ selectedVessel.cargo_code ? ` (${selectedVessel.cargo_code})` : '' }}
                            </span>
                            <span class="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/70 font-bold">
                                Khách hàng: {{ selectedVessel.customer || 'Chưa gán' }}
                            </span>
                        </div>
                    </div>

                    <!-- Bảng dữ liệu sà lan tinh gọn (Chỉ giữ các cột cốt lõi: STT, Tên sà lan, Mã lệnh, Thao tác) -->
                    <div class="flex-1 overflow-auto border border-gray-100 rounded-[16px] min-h-0 custom-scroll">
                        <table class="w-full text-left border-collapse text-xs font-semibold whitespace-nowrap">
                            <thead class="bg-gray-50 border-b border-gray-100 sticky top-0 z-10 text-xs font-black text-gray-500 uppercase tracking-wider select-none">
                                <tr>
                                    <th class="py-2.5 px-3.5 text-center w-14">STT</th>
                                    <th class="py-2.5 px-3.5">Tên sà lan</th>
                                    <th class="py-2.5 px-3.5">Mã lệnh (OrderNo)</th>
                                    <th class="py-2.5 px-3.5 text-center w-24">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100 text-[#1e293b]">
                                <tr
                                    v-for="(barge, idx) in filteredBarges"
                                    :key="barge.id"
                                    class="hover:bg-gray-50 transition-colors"
                                >
                                    <td class="py-2.5 px-3.5 text-center font-mono font-bold text-gray-400">
                                        {{ idx + 1 }}
                                    </td>
                                    <td class="py-2.5 px-3.5 font-display font-black text-primary">
                                        {{ barge.name }}
                                    </td>
                                    <td class="py-2.5 px-3.5 font-mono font-bold">
                                        <span
                                            v-if="barge.config?.orderNo"
                                            class="px-2.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-xs"
                                        >
                                            {{ barge.config.orderNo }}
                                        </span>
                                        <span v-else class="text-gray-400 italic font-normal">Chưa gán</span>
                                    </td>
                                    <td class="py-2.5 px-3.5 text-center">
                                        <div class="flex items-center justify-center gap-1.5">
                                            <button
                                                type="button"
                                                @click="openEditBargeModal(barge)"
                                                class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                                title="Chỉnh sửa sà lan"
                                            >
                                                <span class="material-symbols-outlined text-sm">edit</span>
                                            </button>
                                            <button
                                                type="button"
                                                @click="handleDeleteBarge(barge)"
                                                class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                                title="Xóa sà lan"
                                            >
                                                <span class="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-if="filteredBarges.length === 0">
                                    <td colspan="4" class="py-12 text-center text-gray-400">
                                        <span class="material-symbols-outlined text-3xl text-gray-300 block mb-1">anchor</span>
                                        Chưa có sà lan nào trong danh sách. Bấm <strong>"Thêm sà lan"</strong> để khai báo.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </template>

                <div v-else class="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-xs font-semibold">
                    <span class="material-symbols-outlined text-5xl text-slate-300 mb-3">directions_boat</span>
                    <p>Vui lòng chọn một tàu mẹ từ danh sách bên trái để quản lý sà lan tiếp nhận</p>
                </div>
            </div>
        </div>

        <!-- Modal Khai báo Tàu mẹ (Bỏ ô Trạng thái làm hàng) -->
        <div
            v-if="showVesselModal"
            class="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            @click.self="showVesselModal = false"
        >
            <div class="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-primary/10 space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-primary/5">
                    <h3 class="text-xl font-display font-black text-[#1e293b]">
                        {{ editingVessel ? 'Chỉnh Sửa Nguồn Tàu' : 'Khai Báo Nguồn Tàu Mới' }}
                    </h3>
                    <button
                        @click="showVesselModal = false"
                        class="size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                        <span class="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                <div class="space-y-3.5">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 mb-1">Tên tàu mẹ (*)</label>
                        <input
                            v-model="vesselForm.name"
                            type="text"
                            placeholder="VD: M/V PACIFIC CROWN"
                            class="w-full h-10 px-3.5 bg-[#f1f5f9] border-none rounded-2xl text-xs font-display font-bold text-[#1e293b] focus:ring-2 focus:ring-primary/20 outline-none uppercase"
                        />
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div class="sm:col-span-7">
                            <div class="flex items-center justify-between mb-1">
                                <label class="block text-xs font-bold text-slate-700">Loại hàng</label>
                                <button
                                    type="button"
                                    @click="vesselCustomGoods = !vesselCustomGoods"
                                    class="text-xs font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                                >
                                    <span class="material-symbols-outlined text-xs">
                                        {{ vesselCustomGoods ? 'list' : 'add_circle' }}
                                    </span>
                                    {{ vesselCustomGoods ? 'Chọn danh mục' : '+ Nhập mới' }}
                                </button>
                            </div>
                            <input
                                v-if="vesselCustomGoods"
                                v-model="vesselForm.cargo_type"
                                type="text"
                                placeholder="Nhập loại hàng mới (tự lưu vào Danh mục)..."
                                class="w-full h-10 px-3.5 bg-white border border-primary/40 rounded-2xl text-xs font-semibold text-[#1e293b] focus:ring-2 focus:ring-primary/20 outline-none uppercase"
                            />
                            <select
                                v-else
                                :value="vesselForm.cargo_type"
                                @change="onVesselCargoSelectChange"
                                class="w-full h-10 px-3.5 bg-[#f1f5f9] border-none rounded-2xl text-xs font-bold text-[#1e293b] focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
                            >
                                <option value="">-- Chọn loại hàng từ Danh mục --</option>
                                <option
                                    v-for="g in masterGoods"
                                    :key="g.name"
                                    :value="g.name"
                                >
                                    {{ g.name }}{{ g.code ? ` (${g.code})` : '' }}
                                </option>
                                <option value="__NEW__">➕ Nhập loại hàng mới (chưa có trong Danh mục)...</option>
                            </select>
                        </div>
                        <div class="sm:col-span-5">
                            <div class="flex items-center justify-between mb-1">
                                <label class="block text-xs font-bold text-slate-700">Mã hàng</label>
                                <span class="text-xs font-semibold text-slate-400">
                                    {{ vesselCustomGoods ? 'Nhập mã' : 'Tự động / Sửa' }}
                                </span>
                            </div>
                            <input
                                v-model="vesselForm.cargo_code"
                                type="text"
                                placeholder="VD: BH, LM, 01..."
                                :class="[
                                    'w-full h-10 px-3.5 rounded-2xl text-xs font-mono font-bold text-[#1e293b] focus:ring-2 focus:ring-primary/20 outline-none uppercase',
                                    vesselCustomGoods ? 'bg-white border border-primary/40' : 'bg-[#f1f5f9] border-none'
                                ]"
                            />
                        </div>
                    </div>

                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <label class="block text-xs font-bold text-slate-700">Khách hàng / Chủ hàng</label>
                            <button
                                type="button"
                                @click="vesselCustomCustomer = !vesselCustomCustomer"
                                class="text-xs font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                                <span class="material-symbols-outlined text-xs">
                                    {{ vesselCustomCustomer ? 'list' : 'add_circle' }}
                                </span>
                                {{ vesselCustomCustomer ? 'Chọn danh mục' : '+ Nhập mới' }}
                            </button>
                        </div>
                        <input
                            v-if="vesselCustomCustomer"
                            v-model="vesselForm.customer"
                            type="text"
                            placeholder="Nhập khách hàng mới (tự lưu vào Danh mục)..."
                            class="w-full h-10 px-3.5 bg-white border border-primary/40 rounded-2xl text-xs font-semibold text-[#1e293b] focus:ring-2 focus:ring-primary/20 outline-none uppercase"
                        />
                        <select
                            v-else
                            :value="vesselForm.customer"
                            @change="onVesselCustomerSelectChange"
                            class="w-full h-10 px-3.5 bg-[#f1f5f9] border-none rounded-2xl text-xs font-bold text-[#1e293b] focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
                        >
                            <option value="">-- Chọn khách hàng từ Danh mục --</option>
                            <option
                                v-for="c in masterCustomers"
                                :key="c"
                                :value="c"
                            >
                                {{ c }}
                            </option>
                            <option value="__NEW__">➕ Nhập khách hàng mới (chưa có trong Danh mục)...</option>
                        </select>
                    </div>

                    <!-- Ghim nguồn tàu đặc biệt -->
                    <div class="flex items-center justify-between p-3 bg-amber-50/60 border border-amber-200/70 rounded-2xl">
                        <div class="flex items-center gap-2.5">
                            <span class="material-symbols-outlined text-amber-600 text-lg">push_pin</span>
                            <div>
                                <div class="text-xs font-bold text-slate-800">Ghim nguồn tàu đặc biệt</div>
                                <div class="text-[11px] text-slate-500 font-semibold">Tàu được ghim sẽ luôn ưu tiên hiển thị ở đầu danh sách</div>
                            </div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" v-model="vesselForm.is_pinned" class="sr-only peer" />
                            <div class="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                    </div>
                </div>

                <div class="flex items-center justify-end gap-3 pt-3 border-t border-primary/5">
                    <button
                        type="button"
                        @click="showVesselModal = false"
                        class="h-9 px-4 bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl hover:bg-primary/5 active:scale-95 transition-all shadow-sm text-xs cursor-pointer"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        @click="handleSaveVessel"
                        :disabled="isSavingVessel"
                        class="h-9 px-5 bg-primary text-white font-bold rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all text-xs cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                    >
                        <span v-if="isSavingVessel" class="material-symbols-outlined text-sm animate-spin">sync</span>
                        <span>{{ isSavingVessel ? 'Đang lưu...' : 'Lưu nguồn tàu' }}</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Modal Khai báo Sà lan tiếp nhận (Tinh gọn chỉ nhập Tên sà lan & Mã lệnh, kế thừa Hàng & Chủ hàng từ tàu mẹ) -->
        <div
            v-if="showBargeModal"
            class="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            @click.self="showBargeModal = false"
        >
            <div class="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-primary/10 space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-primary/5">
                    <h3 class="text-xl font-display font-black text-[#1e293b]">
                        {{ editingBarge ? 'Chỉnh Sửa Sà Lan' : 'Thêm Sà Lan Tiếp Nhận' }}
                    </h3>
                    <button
                        @click="showBargeModal = false"
                        class="size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                        <span class="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                <div class="space-y-3.5">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 mb-1">Tên sà lan (*)</label>
                        <input
                            v-model="bargeForm.name"
                            type="text"
                            placeholder="VD: SG 7889 hoặc TG 15869"
                            class="w-full h-10 px-3.5 bg-[#f1f5f9] border-none rounded-2xl text-xs font-display font-bold text-[#1e293b] focus:ring-2 focus:ring-primary/20 outline-none uppercase"
                        />
                    </div>

                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <label class="block text-xs font-bold text-slate-700">Mã lệnh (Order No)</label>
                            <span class="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60 flex items-center gap-0.5">
                                <span class="material-symbols-outlined text-xs">auto_awesome</span>
                                Tự động gán số tiếp theo
                            </span>
                        </div>
                        <input
                            v-model="bargeForm.orderNo"
                            type="text"
                            placeholder="Số lệnh tiếp theo tự động gán..."
                            class="w-full h-10 px-3.5 bg-[#f1f5f9] border-none rounded-2xl text-xs font-mono font-bold text-[#1e293b] focus:ring-2 focus:ring-primary/20 outline-none uppercase"
                        />
                    </div>

                    <div v-if="selectedVessel" class="bg-slate-50 border border-slate-200/70 rounded-2xl p-3 text-xs text-slate-600 space-y-1">
                        <div class="font-bold text-slate-700">Thông tin kế thừa từ tàu {{ selectedVessel.name }}:</div>
                        <div>• Loại hàng: <strong class="text-[#1e293b]">{{ selectedVessel.cargo_type || 'Chưa gán' }}{{ selectedVessel.cargo_code ? ` (${selectedVessel.cargo_code})` : '' }}</strong></div>
                        <div>• Khách hàng: <strong class="text-[#1e293b]">{{ selectedVessel.customer || 'Chưa gán' }}</strong></div>
                    </div>
                </div>

                <div class="flex items-center justify-end gap-3 pt-3 border-t border-primary/5">
                    <button
                        type="button"
                        @click="showBargeModal = false"
                        class="h-9 px-4 bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl hover:bg-primary/5 active:scale-95 transition-all shadow-sm text-xs cursor-pointer"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        @click="handleSaveBarge"
                        :disabled="isSavingBarge"
                        class="h-9 px-5 bg-primary text-white font-bold rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all text-xs cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                    >
                        <span v-if="isSavingBarge" class="material-symbols-outlined text-sm animate-spin">sync</span>
                        <span>{{ isSavingBarge ? 'Đang lưu...' : 'Lưu sà lan' }}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.custom-scroll::-webkit-scrollbar {
    width: 5px;
    height: 5px;
}
.custom-scroll::-webkit-scrollbar-thumb {
    background: rgba(74, 120, 194, 0.2);
    border-radius: 9999px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(74, 120, 194, 0.4);
}
</style>

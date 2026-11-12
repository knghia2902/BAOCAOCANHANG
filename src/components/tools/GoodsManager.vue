<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { dbContext } from '@/services/storage/DBContext';
import { SettingsService } from '@/services/storage/SettingsService';
import { LogService } from '@/services/storage/LogService';
import { authStore, canCreate, canUpdate, canDelete } from '@/stores/auth';
import { WeighbridgeService, type MasterCargoItem } from '@/services/excel/WeighbridgeService';

const { addToast } = useToast();

interface ConfirmDialogState {
    show: boolean;
    title: string;
    message: string;
    type: 'warning' | 'danger' | 'info' | 'success';
    okText?: string;
    cancelText?: string;
    onOk?: () => void;
    onCancel?: () => void;
}

const confirmDialog = ref<ConfirmDialogState>({
    show: false,
    title: '',
    message: '',
    type: 'info'
});

function showConfirm(options: Omit<ConfirmDialogState, 'show'>) {
    return new Promise<boolean>((resolve) => {
        confirmDialog.value = {
            show: true,
            title: options.title,
            message: options.message,
            type: options.type,
            okText: options.okText || 'Xác nhận',
            cancelText: options.cancelText || 'Hủy',
            onOk: () => {
                confirmDialog.value.show = false;
                resolve(true);
            },
            onCancel: () => {
                confirmDialog.value.show = false;
                resolve(false);
            }
        };
    });
}

function handleConfirmOk() {
    if (confirmDialog.value.onOk) {
        confirmDialog.value.onOk();
    }
}

function handleConfirmCancel() {
    if (confirmDialog.value.onCancel) {
        confirmDialog.value.onCancel();
    }
}

const syncChannel = new BroadcastChannel('allocator_sync_channel');

const goodsItems = ref<MasterCargoItem[]>([]);
const searchQuery = ref('');

// Form state
const goodsNameInput = ref('');
const goodsCodeInput = ref('');
const editingIndex = ref<number | null>(null);

const syncStatus = ref<'synced' | 'saving' | 'error'>('synced');
const loadingCloud = ref(false);

async function loadUnifiedGoods() {
    loadingCloud.value = true;
    try {
        // 1. Load from WeighbridgeService master data (has { name, code })
        const wbMaster = await WeighbridgeService.getMasterData();
        const map = new Map<string, string>();

        if (wbMaster?.goods && Array.isArray(wbMaster.goods)) {
            for (const g of wbMaster.goods) {
                if (g && g.name) {
                    map.set(g.name.trim().toUpperCase(), (g.code || '').trim().toUpperCase());
                }
            }
        }

        // 2. Merge with allocator_goods (string[]) from IndexedDB / Supabase
        const localNames = await dbContext.get<string[]>('allocator_goods');
        if (localNames && Array.isArray(localNames)) {
            for (const n of localNames) {
                const key = String(n || '').trim().toUpperCase();
                if (key && !map.has(key)) {
                    map.set(key, '');
                }
            }
        }

        const settings = await SettingsService.getSettings();

        if (settings) {
            const remoteGoods = settings.allocator_goods;
            if (Array.isArray(remoteGoods)) {
                for (const n of remoteGoods) {
                    const key = String(n || '').trim().toUpperCase();
                    if (key && !map.has(key)) {
                        map.set(key, '');
                    }
                }
            }
            const remoteMaster = settings.weighbridge_master_data;
            if (remoteMaster?.goods && Array.isArray(remoteMaster.goods)) {
                for (const g of remoteMaster.goods) {
                    if (g && g.name) {
                        const key = g.name.trim().toUpperCase();
                        const code = (g.code || '').trim().toUpperCase();
                        if (code || !map.has(key)) {
                            map.set(key, code);
                        }
                    }
                }
            }
        }

        goodsItems.value = Array.from(map.entries()).map(([name, code]) => ({ name, code }));
        await dbContext.set('allocator_goods', goodsItems.value.map(g => g.name));
        syncStatus.value = 'synced';
    } catch (e) {
        console.warn('Lỗi khi tải danh mục hàng hóa:', e);
        syncStatus.value = 'error';
    } finally {
        loadingCloud.value = false;
    }
}

syncChannel.onmessage = async (event) => {
    try {
        if (event.data.type === 'goods' || event.data.type === 'master_data') {
            await loadUnifiedGoods();
        }
    } catch (e) {
        console.error('Lỗi khi đồng bộ danh sách hàng hóa giữa các tab:', e);
    }
};

onUnmounted(() => {
    try {
        syncChannel.close();
    } catch (e) {
        console.error('Lỗi khi đóng sync channel:', e);
    }
});

onMounted(async () => {
    await loadUnifiedGoods();
});

const saveToStorage = async () => {
    syncStatus.value = 'saving';
    try {
        const namesList = goodsItems.value.map(g => g.name);
        await dbContext.set('allocator_goods', namesList);

        // Update WeighbridgeService MasterData & allocator_goods via SettingsService
        const wbMaster = await WeighbridgeService.getMasterData();
        wbMaster.goods = [...goodsItems.value];
        await WeighbridgeService.saveMasterData(wbMaster);

        await SettingsService.updateSettings({
            allocator_goods: namesList,
            weighbridge_master_data: wbMaster
        });

        syncStatus.value = 'synced';
        syncChannel.postMessage({ type: 'goods' });
        syncChannel.postMessage({ type: 'master_data' });
    } catch (e) {
        console.error('Lỗi khi lưu danh sách hàng hóa:', e);
        syncStatus.value = 'error';
        addToast('Lỗi khi lưu dữ liệu hàng hóa!', 'error');
    }
};

const filteredGoods = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return goodsItems.value;
    return goodsItems.value.filter(
        item =>
            item.name.toLowerCase().includes(q) ||
            (item.code && item.code.toLowerCase().includes(q))
    );
});

const handleSubmit = async () => {
    const isNew = editingIndex.value === null;
    if (authStore.role !== 'admin' && ((isNew && !canCreate()) || (!isNew && !canUpdate()))) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const name = goodsNameInput.value.trim().toUpperCase();
    const code = goodsCodeInput.value.trim().toUpperCase();
    if (!name) return;

    if (editingIndex.value !== null) {
        const index = editingIndex.value;
        const exists = goodsItems.value.some((g, i) => g.name.toLowerCase() === name.toLowerCase() && i !== index);
        if (exists) {
            addToast('Tên loại hàng đã tồn tại trong danh sách!', 'error');
            return;
        }
        goodsItems.value[index] = { name, code };
        addToast('Cập nhật loại hàng thành công!', 'success');
        await LogService.logAction('Sửa hàng hóa', `Cập nhật: ${name} (${code || '-'})`);
        editingIndex.value = null;
    } else {
        const exists = goodsItems.value.some(g => g.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            addToast('Tên loại hàng đã tồn tại!', 'error');
            return;
        }
        goodsItems.value.unshift({ name, code });
        addToast('Thêm loại hàng mới thành công!', 'success');
        await LogService.logAction('Thêm hàng hóa', `Thêm mới: ${name} (${code || '-'})`);
    }

    goodsNameInput.value = '';
    goodsCodeInput.value = '';
    await saveToStorage();
};

const editItem = (index: number) => {
    const item = filteredGoods.value[index];
    if (item !== undefined) {
        const realIndex = goodsItems.value.findIndex(g => g.name === item.name);
        if (realIndex !== -1) {
            editingIndex.value = realIndex;
            goodsNameInput.value = goodsItems.value[realIndex]?.name || '';
            goodsCodeInput.value = goodsItems.value[realIndex]?.code || '';
        }
    }
};

const deleteItem = async (index: number) => {
    if (authStore.role !== 'admin' && !canDelete()) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const item = filteredGoods.value[index];
    if (item !== undefined) {
        const realIndex = goodsItems.value.findIndex(g => g.name === item.name);
        if (realIndex !== -1) {
            const confirmDelete = await showConfirm({
                title: 'Xác nhận xóa hàng hóa',
                message: `Bạn có chắc chắn muốn xóa loại hàng "${item.name}" khỏi danh mục không?`,
                type: 'danger',
                okText: 'Xóa hàng hóa',
                cancelText: 'Hủy'
            });

            if (confirmDelete) {
                goodsItems.value.splice(realIndex, 1);
                addToast('Đã xóa loại hàng!', 'success');
                await LogService.logAction('Xóa hàng hóa', 'Xóa: ' + item.name);
                if (editingIndex.value === realIndex) {
                    editingIndex.value = null;
                    goodsNameInput.value = '';
                    goodsCodeInput.value = '';
                }
                await saveToStorage();
            }
        }
    }
};

const cancelEdit = () => {
    editingIndex.value = null;
    goodsNameInput.value = '';
    goodsCodeInput.value = '';
};

const clearAll = async () => {
    if (authStore.role !== 'admin' && !canDelete()) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const confirmClear = await showConfirm({
        title: 'Xóa sạch danh sách',
        message: 'Bạn có chắc chắn muốn xóa toàn bộ danh mục hàng hóa hiện tại? Hành động này không thể hoàn tác.',
        type: 'danger',
        okText: 'Xóa sạch tất cả',
        cancelText: 'Hủy'
    });

    if (confirmClear) {
        goodsItems.value = [];
        editingIndex.value = null;
        goodsNameInput.value = '';
        goodsCodeInput.value = '';
        await saveToStorage();
        addToast('Đã xóa sạch danh sách hàng hóa!', 'success');
        await LogService.logAction('Xóa tất cả hàng hóa', 'Xóa sạch danh sách hàng hóa');
    }
};
</script>

<template>
    <div class="w-full flex-1 flex flex-col gap-6 bg-white rounded-3xl p-6 border border-primary/5 shadow-soft font-display">
        <!-- Header Section -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
                <h3 class="text-base font-black text-primary flex items-center gap-2">
                    <span class="material-symbols-outlined text-xl">inventory_2</span>
                    Danh mục hàng hóa &amp; Mã hàng
                </h3>
                <p class="text-xs text-gray-500 font-semibold mt-1">
                    Quản lý danh mục Loại hàng và Mã hàng dùng chung cho Khai báo Nguồn tàu, Sà lan và Phiếu cân. Tổng cộng:
                    <span class="text-teal-600 font-bold font-mono">{{ goodsItems.length }}</span> mặt hàng.
                </p>
            </div>

            <!-- Actions buttons -->
            <div class="flex items-center gap-2">
                <button
                    v-if="goodsItems.length > 0 && (authStore.role === 'admin' || canDelete())"
                    @click="clearAll"
                    class="px-3.5 py-2 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-black rounded-[14px] flex items-center gap-1.5 transition-all cursor-pointer"
                >
                    <span class="material-symbols-outlined text-sm font-bold">delete_forever</span>
                    Xóa sạch
                </button>
            </div>
        </div>

        <!-- Add/Edit form + Search in 1 row grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <!-- Form Card -->
            <div v-if="authStore.role === 'admin' || canCreate() || canUpdate()" class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
                <h4 class="text-xs font-black text-primary flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base">{{ editingIndex !== null ? 'edit_note' : 'add_circle' }}</span>
                    {{ editingIndex !== null ? 'Cập nhật hàng hóa' : 'Thêm hàng hóa mới' }}
                </h4>

                <form @submit.prevent="handleSubmit" class="flex flex-col gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Loại hàng (Tên hàng hóa) *</label>
                        <input
                            type="text"
                            v-model="goodsNameInput"
                            placeholder="Ví dụ: LÚA MÌ, BẮP HẠT, VIÊN NÉN GỖ..."
                            required
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all uppercase"
                        />
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Mã hàng</label>
                        <input
                            type="text"
                            v-model="goodsCodeInput"
                            placeholder="Ví dụ: LM, BH, 01..."
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold font-mono focus:outline-none focus:border-primary transition-all uppercase"
                        />
                    </div>

                    <div class="flex items-center gap-2 mt-2">
                        <button
                            type="submit"
                            class="flex-1 py-2.5 bg-primary text-white font-bold rounded-[12px] text-xs shadow-soft hover:opacity-90 transition-all cursor-pointer"
                        >
                            {{ editingIndex !== null ? 'Cập nhật' : 'Thêm mới' }}
                        </button>

                        <button
                            v-if="editingIndex !== null"
                            type="button"
                            @click="cancelEdit"
                            class="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-[12px] text-xs transition-all cursor-pointer"
                        >
                            Hủy
                        </button>
                    </div>
                </form>
            </div>

            <!-- List Card -->
            <div :class="(authStore.role === 'admin' || canCreate() || canUpdate()) ? 'lg:col-span-2' : 'lg:col-span-3'" class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4 min-h-[350px]">
                <!-- Search bar -->
                <div class="relative w-full flex items-center">
                    <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm">search</span>
                    <input
                        type="text"
                        v-model="searchQuery"
                        placeholder="Tìm kiếm theo loại hàng hoặc mã hàng..."
                        class="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-100 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary focus:bg-white transition-all placeholder:text-gray-400"
                    />
                    <button
                        v-if="searchQuery"
                        @click="searchQuery = ''"
                        class="absolute right-3 text-gray-400 hover:text-primary flex items-center cursor-pointer"
                    >
                        <span class="material-symbols-outlined text-xs">close</span>
                    </button>
                </div>

                <!-- Table Container -->
                <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[380px] border border-gray-100 rounded-[16px]">
                    <table class="w-full text-left border-collapse text-xs font-semibold whitespace-nowrap">
                        <thead>
                            <tr class="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold whitespace-nowrap sticky top-0 z-10">
                                <th class="py-2.5 px-4 w-16 text-center">STT</th>
                                <th class="py-2.5 px-4">Loại hàng (Tên hàng hóa)</th>
                                <th class="py-2.5 px-4 w-36">Mã hàng</th>
                                <th v-if="authStore.role === 'admin' || canUpdate() || canDelete()" class="py-2.5 px-4 w-28 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 text-[#1e293b]/90">
                            <tr
                                v-for="(item, idx) in filteredGoods"
                                :key="item.name"
                                class="hover:bg-gray-50 transition-colors"
                            >
                                <td class="py-2.5 px-4 text-center font-bold font-mono text-gray-400">{{ idx + 1 }}</td>
                                <td class="py-2.5 px-4 font-bold text-primary">{{ item.name }}</td>
                                <td class="py-2.5 px-4 font-mono font-bold">
                                    <span
                                        v-if="item.code"
                                        class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-xs"
                                    >
                                        {{ item.code }}
                                    </span>
                                    <span v-else class="text-gray-400 italic font-normal">--</span>
                                </td>
                                <td v-if="authStore.role === 'admin' || canUpdate() || canDelete()" class="py-2.5 px-4 text-center flex items-center justify-center gap-1.5">
                                    <button
                                        v-if="authStore.role === 'admin' || canUpdate()"
                                        @click="editItem(idx)"
                                        class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                        title="Chỉnh sửa"
                                    >
                                        <span class="material-symbols-outlined text-[14px]">edit</span>
                                    </button>
                                    <button
                                        v-if="authStore.role === 'admin' || canDelete()"
                                        @click="deleteItem(idx)"
                                        class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                        title="Xóa"
                                    >
                                        <span class="material-symbols-outlined text-[14px]">delete</span>
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="filteredGoods.length === 0">
                                <td colspan="4" class="p-8 text-center text-gray-400 italic">
                                    Không tìm thấy hàng hóa nào phù hợp!
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Confirm Dialog Modal -->
        <Teleport to="body">
            <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0"
                enter-to-class="opacity-100"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
            >
                <div
                    v-if="confirmDialog.show"
                    class="fixed inset-0 z-[999] flex items-center justify-center bg-[#1e293b]/40 backdrop-blur-sm p-4"
                    @click.self="handleConfirmCancel"
                >
                    <div class="w-full max-w-[420px] bg-white rounded-[24px] border border-gray-100 shadow-2xl p-6 flex flex-col gap-4 transform transition-all scale-100 animate-scale-up text-xs">
                        <div class="flex items-center gap-3">
                            <div
                                class="size-10 rounded-full flex items-center justify-center"
                                :class="[
                                    confirmDialog.type === 'danger' ? 'bg-red-50 text-red-600' :
                                    confirmDialog.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                                    confirmDialog.type === 'success' ? 'bg-teal-50 text-teal-600' :
                                    'bg-primary/10 text-primary'
                                ]"
                            >
                                <span class="material-symbols-outlined text-xl">
                                    {{
                                        confirmDialog.type === 'danger' ? 'error' :
                                        confirmDialog.type === 'warning' ? 'warning' :
                                        confirmDialog.type === 'success' ? 'check_circle' :
                                        'info'
                                    }}
                                </span>
                            </div>
                            <h3 class="text-sm font-black text-gray-900 leading-tight">
                                {{ confirmDialog.title }}
                            </h3>
                        </div>
                        <div class="text-xs font-semibold text-gray-600 leading-relaxed whitespace-pre-wrap">
                            {{ confirmDialog.message }}
                        </div>
                        <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-50">
                            <button
                                @click="handleConfirmCancel"
                                class="h-9 px-4 rounded-[12px] text-xs font-bold text-gray-500 hover:bg-gray-50 active:scale-95 transition-all border border-gray-100 cursor-pointer"
                            >
                                {{ confirmDialog.cancelText }}
                            </button>
                            <button
                                @click="handleConfirmOk"
                                class="h-9 px-4 rounded-[12px] text-xs font-bold text-white active:scale-95 transition-all cursor-pointer"
                                :class="[
                                    confirmDialog.type === 'danger' ? 'bg-red-600 hover:bg-red-700' :
                                    confirmDialog.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                                    confirmDialog.type === 'success' ? 'bg-teal-600 hover:bg-teal-700' :
                                    'bg-primary hover:bg-primary/95'
                                ]"
                            >
                                {{ confirmDialog.okText }}
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

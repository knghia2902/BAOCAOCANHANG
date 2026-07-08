<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { dbContext } from '@/services/storage/DBContext';
import { supabase } from '@/supabase';

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

syncChannel.onmessage = async (event) => {
    try {
        if (event.data.type === 'goods') {
            const saved = await dbContext.get<string[]>('allocator_goods');
            if (saved && Array.isArray(saved)) {
                if (JSON.stringify(goodsList.value) !== JSON.stringify(saved)) {
                    goodsList.value = saved;
                }
            }
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

const goodsList = ref<string[]>([]);
const searchQuery = ref('');

// Form state
const goodsInput = ref('');
const editingIndex = ref<number | null>(null);

const syncStatus = ref<'synced' | 'saving' | 'error'>('synced');
const loadingCloud = ref(false);

async function loadGoodsFromSupabase() {
    loadingCloud.value = true;
    try {
        const { data, error } = await supabase
            .from('content')
            .select('settings')
            .eq('id', 'main')
            .single();
        if (error) throw error;
        
        if (data?.settings) {
            const remoteGoods = data.settings.allocator_goods;
            if (Array.isArray(remoteGoods)) {
                if (JSON.stringify(goodsList.value) !== JSON.stringify(remoteGoods)) {
                    goodsList.value = remoteGoods;
                    await dbContext.set('allocator_goods', remoteGoods);
                }
                syncStatus.value = 'synced';
            } else {
                if (goodsList.value.length > 0) {
                    await saveGoodsToSupabase();
                } else {
                    syncStatus.value = 'synced';
                }
            }
        }
    } catch (e) {
        console.warn('Lỗi khi tải danh sách hàng hóa từ Supabase:', e);
        syncStatus.value = 'error';
    } finally {
        loadingCloud.value = false;
    }
}

async function saveGoodsToSupabase() {
    syncStatus.value = 'saving';
    try {
        const { data: current, error: fetchError } = await supabase
            .from('content')
            .select('settings')
            .eq('id', 'main')
            .single();
        
        if (fetchError) throw fetchError;
        
        const currentSettings = current?.settings || {};
        const updatedSettings = {
            ...currentSettings,
            allocator_goods: goodsList.value
        };

        const { error: updateError } = await supabase
            .from('content')
            .update({ settings: updatedSettings })
            .eq('id', 'main');

        if (updateError) throw updateError;
        
        syncStatus.value = 'synced';
    } catch (e) {
        console.error('Lỗi khi lưu danh sách hàng hóa lên Supabase:', e);
        syncStatus.value = 'error';
        addToast('Lỗi đồng bộ dữ liệu đám mây!', 'error');
    }
}

// Load goods on mount
onMounted(async () => {
    try {
        const saved = await dbContext.get<string[]>('allocator_goods');
        if (saved && Array.isArray(saved)) {
            goodsList.value = saved;
        }
        await loadGoodsFromSupabase();
    } catch (e) {
        console.error('Lỗi khi tải danh sách hàng hóa:', e);
    }
});

// Save to DB
const saveToStorage = async () => {
    try {
        await dbContext.set('allocator_goods', goodsList.value);
        await saveGoodsToSupabase();
        syncChannel.postMessage({ type: 'goods' });
    } catch (e) {
        console.error('Lỗi khi lưu danh sách hàng hóa:', e);
        addToast('Lỗi khi lưu dữ liệu hàng hóa!', 'error');
    }
};

// Filtered goods list
const filteredGoods = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return goodsList.value;
    return goodsList.value.filter(item => 
        item.toLowerCase().includes(q)
    );
});

// Form submission handler
const handleSubmit = async () => {
    const item = goodsInput.value.trim();
    if (!item) return;

    if (editingIndex.value !== null) {
        // Edit mode
        const index = editingIndex.value;
        const exists = goodsList.value.some((g, i) => g.toLowerCase() === item.toLowerCase() && i !== index);
        if (exists) {
            addToast('Tên hàng hóa đã tồn tại trong danh sách!', 'error');
            return;
        }
        goodsList.value[index] = item;
        addToast('Cập nhật hàng hóa thành công!', 'success');
        editingIndex.value = null;
    } else {
        // Add mode
        const exists = goodsList.value.some(g => g.toLowerCase() === item.toLowerCase());
        if (exists) {
            addToast('Tên hàng hóa đã tồn tại!', 'error');
            return;
        }
        goodsList.value.push(item);
        addToast('Thêm hàng hóa mới thành công!', 'success');
    }

    goodsInput.value = '';
    await saveToStorage();
};

const editItem = (index: number) => {
    const item = filteredGoods.value[index];
    if (item !== undefined) {
        const realIndex = goodsList.value.indexOf(item);
        if (realIndex !== -1) {
            editingIndex.value = realIndex;
            goodsInput.value = goodsList.value[realIndex] || '';
        }
    }
};

const deleteItem = async (index: number) => {
    const item = filteredGoods.value[index];
    if (item !== undefined) {
        const realIndex = goodsList.value.indexOf(item);
        if (realIndex !== -1) {
            const confirmDelete = await showConfirm({
                title: 'Xác nhận xóa hàng hóa',
                message: `Bạn có chắc chắn muốn xóa hàng hóa "${item}" khỏi danh mục không?`,
                type: 'danger',
                okText: 'Xóa hàng hóa',
                cancelText: 'Hủy'
            });

            if (confirmDelete) {
                goodsList.value.splice(realIndex, 1);
                addToast('Đã xóa hàng hóa!', 'success');
                if (editingIndex.value === realIndex) {
                    editingIndex.value = null;
                    goodsInput.value = '';
                }
                await saveToStorage();
            }
        }
    }
};

const cancelEdit = () => {
    editingIndex.value = null;
    goodsInput.value = '';
};

const clearAll = async () => {
    const confirmClear = await showConfirm({
        title: 'Xóa sạch danh sách',
        message: 'Bạn có chắc chắn muốn xóa toàn bộ danh mục hàng hóa hiện tại? Hành động này không thể hoàn tác.',
        type: 'danger',
        okText: 'Xóa sạch tất cả',
        cancelText: 'Hủy'
    });

    if (confirmClear) {
        goodsList.value = [];
        editingIndex.value = null;
        goodsInput.value = '';
        await saveToStorage();
        addToast('Đã xóa sạch danh sách hàng hóa!', 'success');
    }
};
</script>

<template>
    <div class="w-full flex-1 flex flex-col gap-6 bg-white rounded-3xl p-6 border border-primary/5 shadow-soft">
        
        <!-- Header Section -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
                <h3 class="text-lg font-black text-primary flex items-center gap-2">
                    <span class="material-symbols-outlined text-xl">inventory_2</span>
                    Danh mục hàng hóa
                </h3>
                <p class="text-[11px] text-gray-500 font-semibold mt-1">
                    Quản lý danh mục loại hàng hóa dùng chung cho toàn bộ tàu và sà lan. Tổng cộng: 
                    <span class="text-teal-600 font-bold font-mono">{{ goodsList.length }}</span> mặt hàng.
                </p>
            </div>
            
            <!-- Actions buttons -->
            <div class="flex items-center gap-2">
                <button 
                    v-if="goodsList.length > 0"
                    @click="clearAll"
                    class="px-3.5 py-2 bg-red-50 text-red-600 hover:bg-red-100 text-[11px] font-black rounded-[14px] flex items-center gap-1.5 transition-all"
                >
                    <span class="material-symbols-outlined text-sm font-bold">delete_forever</span>
                    Xóa sạch
                </button>
            </div>
        </div>

        <!-- Add/Edit form + Search in 1 row grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            <!-- Form Card -->
            <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
                <h4 class="text-xs font-black text-primary flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base">{{ editingIndex !== null ? 'edit_note' : 'add_circle' }}</span>
                    {{ editingIndex !== null ? 'Cập nhật hàng hóa' : 'Thêm hàng hóa mới' }}
                </h4>
                
                <form @submit.prevent="handleSubmit" class="flex flex-col gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tên hàng hóa *</label>
                        <input 
                            type="text" 
                            v-model="goodsInput"
                            placeholder="Ví dụ: Viên Nén Gỗ (FSC Mix %)"
                            required
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all"
                        />
                    </div>
                    
                    <div class="flex items-center gap-2 mt-2">
                        <button 
                            type="submit"
                            class="flex-1 py-2.5 bg-primary text-white font-bold rounded-[12px] text-xs shadow-soft hover:opacity-90 transition-all"
                        >
                            {{ editingIndex !== null ? 'Cập nhật' : 'Thêm mới' }}
                        </button>
                        
                        <button 
                            v-if="editingIndex !== null"
                            type="button"
                            @click="cancelEdit"
                            class="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-[12px] text-xs transition-all"
                        >
                            Hủy
                        </button>
                    </div>
                </form>
            </div>
            
            <!-- List Card -->
            <div class="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4 min-h-[350px]">
                <!-- Search bar -->
                <div class="relative w-full flex items-center">
                    <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm">search</span>
                    <input 
                        type="text" 
                        v-model="searchQuery" 
                        placeholder="Tìm kiếm hàng hóa..." 
                        class="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-100 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary focus:bg-white transition-all placeholder:text-gray-400"
                    >
                    <button 
                        v-if="searchQuery" 
                        @click="searchQuery = ''" 
                        class="absolute right-3 text-gray-400 hover:text-primary flex items-center"
                    >
                        <span class="material-symbols-outlined text-xs">close</span>
                    </button>
                </div>

                <!-- Table Container -->
                <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[300px] border border-gray-100 rounded-[16px]">
                    <table class="w-full text-left border-collapse text-xs font-semibold">
                        <thead>
                            <tr class="bg-gray-55 text-gray-500 border-b border-gray-100 font-bold whitespace-nowrap">
                                <th class="py-2.5 px-4 w-16 text-center">STT</th>
                                <th class="py-2.5 px-4">Tên hàng hóa</th>
                                <th class="py-2.5 px-4 w-28 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 text-[#4a2c32]/90">
                            <tr 
                                v-for="(item, idx) in filteredGoods" 
                                :key="idx"
                                class="hover:bg-gray-50 transition-colors"
                            >
                                <td class="py-2 px-4 text-center font-bold text-gray-400">{{ idx + 1 }}</td>
                                <td class="py-2 px-4 font-bold text-gray-800">{{ item }}</td>
                                <td class="py-2 px-4 text-center flex items-center justify-center gap-1.5">
                                    <button 
                                        @click="editItem(idx)"
                                        class="size-7 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-all"
                                        title="Chỉnh sửa"
                                    >
                                        <span class="material-symbols-outlined text-[15px]">edit</span>
                                    </button>
                                    <button 
                                        @click="deleteItem(idx)"
                                        class="size-7 rounded-full bg-red-50 hover:bg-red-100 text-red-655 flex items-center justify-center transition-all"
                                        title="Xóa"
                                    >
                                        <span class="material-symbols-outlined text-[15px]">delete</span>
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="filteredGoods.length === 0">
                                <td colspan="3" class="p-8 text-center text-gray-400 italic">
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
                    class="fixed inset-0 z-[999] flex items-center justify-center bg-[#4a2c32]/40 backdrop-blur-sm p-4"
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
                                class="h-9 px-4 rounded-[12px] text-xs font-bold text-gray-500 hover:bg-gray-50 active:scale-95 transition-all border border-gray-100"
                            >
                                {{ confirmDialog.cancelText }}
                            </button>
                            <button 
                                @click="handleConfirmOk"
                                class="h-9 px-4 rounded-[12px] text-xs font-bold text-white active:scale-95 transition-all"
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

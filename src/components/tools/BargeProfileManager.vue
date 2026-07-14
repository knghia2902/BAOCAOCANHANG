<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { WeighbridgeService, type Vessel, type Barge, type BargeConfig } from '@/services/excel/WeighbridgeService';
import { useToast } from '@/composables/useToast';

const { addToast } = useToast();
const vessels = ref<Vessel[]>([]);
const loading = ref(false);
const saving = ref(false);
const searchQuery = ref('');

// Edit Modal state
const showEditModal = ref(false);
const selectedBarge = ref<Barge | null>(null);
const selectedVesselName = ref('');

// Form fields
const editBargeName = ref('');
const editOrderNo = ref('');
const editGoods = ref('');
const editGoodsCode = ref('');
const editOwner = ref('');
const editOperator = ref('');
const editXn = ref('');
const editTicketPrefix = ref('');
const editTicketSeed = ref<number | string>('');
const editChinhpham = ref<number | string>('');
const editPhupham = ref<number | string>('');
const editKetluan = ref('');
const editLocked = ref(false);

// Custom Metadata fields (for additional barge information)
interface CustomMeta {
    key: string;
    value: string;
}
const customMetas = ref<CustomMeta[]>([]);

// Fetch all barges from all vessels
const allBarges = computed(() => {
    const list: Array<{ barge: Barge; vesselName: string }> = [];
    vessels.value.forEach(v => {
        if (v.barges) {
            v.barges.forEach(b => {
                list.push({
                    barge: b,
                    vesselName: v.name
                });
            });
        }
    });
    
    // Sắp xếp giống "Danh sách quản lý tất cả sà lan" (theo mã lệnh)
    return list.sort((a, b) => {
        const orderA = a.barge.config?.orderNo ? String(a.barge.config.orderNo).trim() : '';
        const orderB = b.barge.config?.orderNo ? String(b.barge.config.orderNo).trim() : '';
        
        if (!orderA && orderB) return 1;
        if (orderA && !orderB) return -1;
        if (!orderA && !orderB) {
            return a.barge.name.localeCompare(b.barge.name);
        }
        
        return orderA.localeCompare(orderB, undefined, { numeric: true, sensitivity: 'base' });
    });
});

// Filtered list
const filteredBarges = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return allBarges.value;
    return allBarges.value.filter(item => {
        return (
            item.barge.name.toLowerCase().includes(q) ||
            item.vesselName.toLowerCase().includes(q) ||
            (item.barge.config?.goods || '').toLowerCase().includes(q) ||
            (item.barge.config?.owner || '').toLowerCase().includes(q) ||
            (item.barge.config?.operator || '').toLowerCase().includes(q) ||
            (item.barge.config?.orderNo || '').toLowerCase().includes(q)
        );
    });
});

async function loadData() {
    loading.value = true;
    try {
        vessels.value = await WeighbridgeService.getVessels() || [];
    } catch (e) {
        console.error('Lỗi khi tải danh sách sà lan:', e);
        addToast('Lỗi khi tải danh sách phương tiện sà lan!', 'error');
    } finally {
        loading.value = false;
    }
}

function openEdit(item: { barge: Barge; vesselName: string }) {
    selectedBarge.value = item.barge;
    selectedVesselName.value = item.vesselName;
    
    const config = item.barge.config || {} as BargeConfig;
    editBargeName.value = item.barge.name || '';
    editOrderNo.value = config.orderNo || '';
    editGoods.value = config.goods || '';
    editGoodsCode.value = config.goodsCode || '';
    editOwner.value = config.owner || '';
    editOperator.value = config.operator || '';
    editXn.value = config.xn || 'XUẤT';
    editTicketPrefix.value = config.ticketPrefix || '';
    editTicketSeed.value = config.ticketSeed !== undefined ? config.ticketSeed : '';
    editChinhpham.value = config.chinhpham !== undefined ? config.chinhpham : '';
    editPhupham.value = config.phupham !== undefined ? config.phupham : '';
    editKetluan.value = config.ketluan || '';
    editLocked.value = config.locked || false;
    
    // Parse custom metadata
    const customObj = config.customProfileInfo || {};
    customMetas.value = Object.entries(customObj).map(([key, value]) => ({
        key,
        value: String(value)
    }));
    
    showEditModal.value = true;
}

function addCustomMeta() {
    customMetas.value.push({ key: '', value: '' });
}

function removeCustomMeta(index: number) {
    customMetas.value.splice(index, 1);
}

async function saveProfile() {
    if (!selectedBarge.value) return;
    saving.value = true;
    try {
        const id = selectedBarge.value.id;
        const name = editBargeName.value.trim().toUpperCase();
        if (!name) {
            addToast('Tên sà lan không được để trống!', 'info');
            saving.value = false;
            return;
        }
        
        // Build customProfileInfo
        const customProfileInfo: Record<string, string> = {};
        customMetas.value.forEach(m => {
            const k = m.key.trim();
            if (k) {
                customProfileInfo[k] = m.value.trim();
            }
        });
        
        const updatedConfig: BargeConfig = {
            ...(selectedBarge.value.config || {}),
            orderNo: editOrderNo.value.trim().toUpperCase(),
            goods: editGoods.value.trim(),
            goodsCode: editGoodsCode.value.trim().toUpperCase(),
            owner: editOwner.value.trim(),
            operator: editOperator.value.trim(),
            xn: editXn.value.trim().toUpperCase(),
            ticketPrefix: editTicketPrefix.value.trim().toUpperCase(),
            ticketSeed: editTicketSeed.value,
            chinhpham: editChinhpham.value,
            phupham: editPhupham.value,
            ketluan: editKetluan.value.trim(),
            locked: editLocked.value,
            customProfileInfo: customProfileInfo
        };
        
        // Update name if changed
        if (selectedBarge.value.name !== name) {
            await WeighbridgeService.updateBarge(id, name);
        }
        
        // Update config
        await WeighbridgeService.updateBargeConfig(id, updatedConfig);
        
        addToast('Lưu hồ sơ sà lan thành công! 🚢', 'success');
        
        // Dispatch custom event for dynamic sync in same window
        window.dispatchEvent(new CustomEvent('barge-config-updated', { detail: { bargeId: id } }));
        
        showEditModal.value = false;
        await loadData();
    } catch (e) {
        console.error('Lỗi khi lưu hồ sơ sà lan:', e);
        addToast('Gặp sự cố khi lưu hồ sơ sà lan!', 'error');
    } finally {
        saving.value = false;
    }
}

onMounted(() => {
    loadData();
    window.addEventListener('barge-config-updated', loadData);
});
</script>

<template>
    <div class="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden font-display text-left">
        <!-- Control Bar -->
        <div class="bg-white border-b border-primary/10 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
            <div>
                <h3 class="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2">
                    <span class="material-symbols-outlined text-lg">local_shipping</span>
                    Hồ sơ phương tiện sà lan
                </h3>
                <p class="text-[10px] text-gray-400 font-bold mt-0.5">
                    Quản lý thông tin cấu hình, thông số đăng kiểm và hồ sơ của tất cả sà lan đang làm hàng.
                </p>
            </div>
            
            <div class="flex items-center gap-2 max-w-xs w-full">
                <div class="relative w-full">
                    <span class="material-symbols-outlined text-gray-400 text-sm absolute left-3 top-2.5">search</span>
                    <input 
                        v-model="searchQuery" 
                        type="text" 
                        placeholder="Tìm sà lan, tàu, chủ hàng..." 
                        class="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-semibold"
                    />
                </div>
                <button @click="loadData" class="size-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-primary transition-colors border border-gray-200" title="Tải lại dữ liệu">
                    <span class="material-symbols-outlined text-base" :class="{'animate-spin': loading}">refresh</span>
                </button>
            </div>
        </div>

        <!-- Main Body -->
        <div class="flex-1 overflow-auto p-6">
            <div class="bg-white rounded-[24px] p-5 shadow-sm border border-primary/5 flex flex-col h-full min-h-0">
                <div v-if="loading" class="h-full flex-1 flex flex-col justify-center items-center text-gray-400 text-xs gap-2">
                    <span class="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
                    <span>Đang tải thông tin sà lan...</span>
                </div>
                <div v-else-if="filteredBarges.length === 0" class="h-full flex-1 flex flex-col justify-center items-center text-gray-400 text-xs italic gap-1">
                    <span class="material-symbols-outlined text-3xl text-gray-300">sailing</span>
                    <span>Không tìm thấy sà lan nào. Vui lòng thêm sà lan mới bên tab "In Phiếu Cân Xe".</span>
                </div>
                <div v-else class="flex-1 overflow-auto rounded-[16px] border border-gray-100">
                    <table class="w-full text-left border-collapse text-xs font-semibold">
                        <thead>
                            <tr class="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold">
                                <th class="px-3 py-2 w-12 text-center bg-gray-50">STT</th>
                                <th class="px-3 py-2 bg-gray-50">Tên sà lan</th>
                                <th class="px-3 py-2 bg-gray-50">Mã lệnh</th>
                                <th class="px-3 py-2 bg-gray-50">Thuộc Tàu</th>
                                <th class="px-3 py-2 bg-gray-50">Chủ hàng</th>
                                <th class="px-3 py-2 bg-gray-50">Trực ca</th>
                                <th class="px-3 py-2 bg-gray-50">Hàng hóa</th>
                                <th class="px-3 py-2 text-center">Thông số phụ</th>
                                <th class="px-3 py-2 text-center bg-gray-50">Trạng thái</th>
                                <th class="px-3 py-2 text-center w-28 bg-gray-50">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 text-[#4a2c32]/90">
                            <tr v-for="(item, idx) in filteredBarges" :key="item.barge.id" class="hover:bg-gray-50 transition-colors">
                                <td class="px-3 py-2.5 text-center text-gray-400 font-bold">{{ idx + 1 }}</td>
                                <td class="px-3 py-2.5 font-bold text-gray-900">{{ item.barge.name }}</td>
                                <td class="px-3 py-2.5">
                                    <span v-if="item.barge.config?.orderNo" class="px-2 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[10px] font-black whitespace-nowrap">
                                        {{ item.barge.config.orderNo }}
                                    </span>
                                    <span v-else class="text-gray-400 italic text-[10px]">-</span>
                                </td>
                                <td class="px-3 py-2.5">
                                    <span class="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-black whitespace-nowrap">
                                        {{ item.vesselName }}
                                    </span>
                                </td>
                                <td class="px-3 py-2.5 text-gray-700 max-w-[150px] truncate">{{ item.barge.config?.owner || '-' }}</td>
                                <td class="px-3 py-2.5 text-gray-700 max-w-[150px] truncate">{{ item.barge.config?.operator || '-' }}</td>
                                <td class="px-3 py-2.5 text-gray-700 max-w-[150px] truncate">{{ item.barge.config?.goods || '-' }}</td>
                                <td class="px-3 py-2.5 text-center whitespace-nowrap">
                                    <span 
                                        v-if="item.barge.config?.customProfileInfo && Object.keys(item.barge.config.customProfileInfo).length > 0" 
                                        class="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full text-[9px] font-black"
                                    >
                                        +{{ Object.keys(item.barge.config.customProfileInfo).length }} thông số
                                    </span>
                                    <span v-else class="text-gray-400 italic text-[10px]">-</span>
                                </td>
                                <td class="px-3 py-2.5 text-center">
                                    <span v-if="item.barge.config?.locked" class="inline-flex px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-[10px] font-bold items-center gap-1 whitespace-nowrap">
                                        <span class="material-symbols-outlined text-[11px]">lock</span> Khóa
                                    </span>
                                    <span v-else class="inline-flex px-2.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[10px] font-bold items-center gap-1 whitespace-nowrap">
                                        <span class="material-symbols-outlined text-[11px]">lock_open</span> Mở
                                    </span>
                                </td>
                                <td class="px-3 py-2.5 text-center">
                                    <button 
                                        @click="openEdit(item)" 
                                        class="px-3 py-1 bg-[#fcf8f9] hover:bg-primary hover:text-white border border-soft-pink text-primary font-black rounded-xl text-[10px] transition-all whitespace-nowrap shadow-sm"
                                    >
                                        Chỉnh sửa
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Edit Profile Modal -->
        <div v-if="showEditModal" class="fixed inset-0 bg-[#1b0d11]/40 z-[999] backdrop-blur-[2px] flex items-center justify-center p-4 transition-all">
            <div class="bg-white rounded-[2.5rem] border border-[#1b0d11]/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-up">
                <!-- Header -->
                <div class="px-8 py-5 border-b border-primary/10 flex items-center justify-between bg-slate-50 shrink-0">
                    <div>
                        <h3 class="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2">
                            <span class="material-symbols-outlined">edit_note</span>
                            Hồ sơ sà lan: {{ selectedBarge?.name }}
                        </h3>
                        <p class="text-[9px] text-gray-400 font-bold mt-0.5">
                            Thuộc tàu vận tải: <span class="text-primary font-black">{{ selectedVesselName }}</span>
                        </p>
                    </div>
                    <button 
                        @click="showEditModal = false" 
                        class="size-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-primary transition-all border border-gray-200"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <!-- Form Body -->
                <div class="flex-1 overflow-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <!-- Left: Standard settings -->
                    <div class="space-y-4">
                        <h4 class="text-xs font-black text-primary uppercase tracking-wider border-b border-dashed border-gray-200 pb-2">
                            Thông tin hành chính & Cấu hình
                        </h4>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tên sà lan</label>
                                <input 
                                    v-model="editBargeName" 
                                    type="text" 
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-black"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mã lệnh</label>
                                <input 
                                    v-model="editOrderNo" 
                                    type="text" 
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-black"
                                />
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Chủ hàng</label>
                                <input 
                                    v-model="editOwner" 
                                    type="text" 
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-semibold"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Trực ca</label>
                                <input 
                                    v-model="editOperator" 
                                    type="text" 
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-semibold"
                                />
                            </div>
                        </div>

                        <div class="grid grid-cols-3 gap-4">
                            <div class="col-span-2 space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tên hàng hóa</label>
                                <input 
                                    v-model="editGoods" 
                                    type="text" 
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-semibold"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mã hàng</label>
                                <input 
                                    v-model="editGoodsCode" 
                                    type="text" 
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-semibold"
                                />
                            </div>
                        </div>

                        <div class="grid grid-cols-3 gap-4">
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Loại hàng (X/N)</label>
                                <select 
                                    v-model="editXn" 
                                    class="w-full h-8 px-2 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-bold"
                                >
                                    <option value="XUẤT">XUẤT</option>
                                    <option value="NHẬP">NHẬP</option>
                                </select>
                            </div>
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tiền tố phiếu</label>
                                <input 
                                    v-model="editTicketPrefix" 
                                    type="text" 
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-bold"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Số phiếu đầu</label>
                                <input 
                                    v-model="editTicketSeed" 
                                    type="text" 
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-bold"
                                />
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Chính phẩm (%)</label>
                                <input 
                                    v-model="editChinhpham" 
                                    type="text" 
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32]"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Phụ phẩm (%)</label>
                                <input 
                                    v-model="editPhupham" 
                                    type="text" 
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32]"
                                />
                            </div>
                        </div>

                        <div class="space-y-1">
                            <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Kết luận mẫu phiếu</label>
                            <textarea 
                                v-model="editKetluan" 
                                rows="2" 
                                class="w-full p-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-semibold resize-none"
                            ></textarea>
                        </div>

                        <div class="flex items-center gap-2 pt-2">
                            <input 
                                v-model="editLocked" 
                                type="checkbox" 
                                id="locked_checkbox" 
                                class="size-4 rounded border-gray-300 text-primary focus:ring-primary/20 accent-primary"
                            />
                            <label for="locked_checkbox" class="text-xs font-black text-[#4a2c32] select-none cursor-pointer">
                                Khóa sà lan này (Không cho nhân viên sửa thông tin khi in)
                            </label>
                        </div>
                    </div>

                    <!-- Right: Technical profiles (Custom Metadata info) -->
                    <div class="space-y-4 flex flex-col h-full min-h-0">
                        <div class="flex justify-between items-center border-b border-dashed border-gray-200 pb-2">
                            <h4 class="text-xs font-black text-primary uppercase tracking-wider">
                                Thông số kỹ thuật & Hồ sơ sà lan
                            </h4>
                            <button 
                                @click="addCustomMeta" 
                                class="h-6 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[9px] font-black flex items-center gap-1 transition-all"
                            >
                                <span class="material-symbols-outlined text-[12px]">add</span>
                                Thêm thông số
                            </button>
                        </div>
                        
                        <p class="text-[9px] text-gray-400 font-bold leading-normal">
                            Thêm các thông tin kỹ thuật mở rộng như: *Tải trọng đăng kiểm (tấn)*, *Hạn đăng kiểm*, *Chiều dài*, *Chiều rộng*, *Năm sản xuất*, vv.
                        </p>

                        <!-- Dynamic Key-Value list -->
                        <div class="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[300px]">
                            <div v-if="customMetas.length === 0" class="py-10 text-center text-gray-400 text-xs italic">
                                Chưa có thông tin hồ sơ kỹ thuật bổ sung nào. Hãy nhấn "Thêm thông số" để nhập.
                            </div>
                            <div 
                                v-else 
                                v-for="(meta, index) in customMetas" 
                                :key="index"
                                class="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-gray-200 animate-fade-in"
                            >
                                <input 
                                    v-model="meta.key" 
                                    type="text" 
                                    placeholder="Tên thông số (Ví dụ: Chiều dài)" 
                                    class="w-1/2 h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-primary/50 text-[#4a2c32] font-black"
                                />
                                <input 
                                    v-model="meta.value" 
                                    type="text" 
                                    placeholder="Giá trị (Ví dụ: 62.5 m)" 
                                    class="w-1/2 h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-primary/50 text-[#4a2c32] font-semibold"
                                />
                                <button 
                                    @click="removeCustomMeta(index)"
                                    class="size-8 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center shrink-0 border border-transparent hover:border-red-200 transition-all"
                                    title="Xóa thông số này"
                                >
                                    <span class="material-symbols-outlined text-base">delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="px-8 py-4 border-t border-primary/10 bg-slate-50 flex justify-end gap-3 shrink-0">
                    <button 
                        @click="showEditModal = false"
                        :disabled="saving"
                        class="h-9 px-5 bg-white text-gray-600 border border-gray-300 font-black rounded-xl text-xs hover:bg-gray-50 active:scale-95 transition-all"
                    >
                        Hủy bỏ
                    </button>
                    <button 
                        @click="saveProfile"
                        :disabled="saving"
                        class="h-9 px-6 bg-primary hover:bg-primary-dark text-white font-black rounded-xl text-xs active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-primary/10 disabled:opacity-50"
                    >
                        <span v-if="saving" class="material-symbols-outlined text-sm animate-spin">sync</span>
                        <span v-else class="material-symbols-outlined text-sm">save</span>
                        Lưu hồ sơ
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-scale-up {
    animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.animate-fade-in {
    animation: fadeIn 0.15s ease-out forwards;
}

@keyframes scaleUp {
    from {
        transform: scale(0.95);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(5px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>

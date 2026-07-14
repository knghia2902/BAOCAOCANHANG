<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { WeighbridgeService, type Vessel, type Barge, type BargeConfig } from '@/services/excel/WeighbridgeService';
import { useToast } from '@/composables/useToast';

const { addToast } = useToast();
const vessels = ref<Vessel[]>([]);
const loading = ref(false);
const saving = ref(false);
const searchQuery = ref('');

// Excel Import state
const excelFileInput = ref<HTMLInputElement | null>(null);

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

// New Structured Profile fields
const editTonnage = ref<number | string>('');
const editHp = ref<number | string>('');
const editGcnNo = ref('');
const editGcnIssuedDate = ref('');
const editGcnExpiryDate = ref('');
const editDkNo = ref('');
const editDkIssuedDate = ref('');
const editDkExpiryDate = ref('');
const editBhNo = ref('');
const editBhIssuedDate = ref('');
const editBhExpiryDate = ref('');

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

// Helpers to calculate status
const isDocComplete = (config: BargeConfig) => {
    return !!(config.gcnNo && config.dkNo && config.bhNo);
};

const getGcnStatus = (config: BargeConfig) => {
    if (!config.gcnExpiryDate) return '-';
    const expiry = new Date(config.gcnExpiryDate);
    if (isNaN(expiry.getTime())) return '-';
    
    // Compare YYYY-MM-DD
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date(todayStr);
    return expiry < today ? 'HẾT HẠN' : 'CÒN HẠN';
};

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
    
    // Set new profile fields
    editTonnage.value = config.tonnage !== undefined ? config.tonnage : '';
    editHp.value = config.hp !== undefined ? config.hp : '';
    editGcnNo.value = config.gcnNo || '';
    editGcnIssuedDate.value = config.gcnIssuedDate || '';
    editGcnExpiryDate.value = config.gcnExpiryDate || '';
    editDkNo.value = config.dkNo || '';
    editDkIssuedDate.value = config.dkIssuedDate || '';
    editDkExpiryDate.value = config.dkExpiryDate || '';
    editBhNo.value = config.bhNo || '';
    editBhIssuedDate.value = config.bhIssuedDate || '';
    editBhExpiryDate.value = config.bhExpiryDate || '';
    
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
            
            // Technical details
            tonnage: editTonnage.value !== '' ? Number(editTonnage.value) : undefined,
            hp: editHp.value !== '' ? Number(editHp.value) : undefined,
            gcnNo: editGcnNo.value.trim(),
            gcnIssuedDate: editGcnIssuedDate.value,
            gcnExpiryDate: editGcnExpiryDate.value,
            dkNo: editDkNo.value.trim(),
            dkIssuedDate: editDkIssuedDate.value,
            dkExpiryDate: editDkExpiryDate.value,
            bhNo: editBhNo.value.trim(),
            bhIssuedDate: editBhIssuedDate.value,
            bhExpiryDate: editBhExpiryDate.value,
            
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

function triggerExcelUpload() {
    excelFileInput.value?.click();
}

async function handleExcelImport(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    loading.value = true;
    
    try {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const arrayBuffer = await file.arrayBuffer();
        await workbook.xlsx.load(arrayBuffer);
        
        const sheetName = 'Hồ sơ phương tiện';
        let sheet = workbook.getWorksheet(sheetName);
        if (!sheet) {
            sheet = workbook.worksheets[0];
        }
        
        if (!sheet) {
            addToast('Không thể đọc dữ liệu từ file Excel!', 'error');
            loading.value = false;
            return;
        }
        
        let matchCount = 0;
        
        // Helpers to parse cells
        const formatDateCell = (cellValue: any): string => {
            if (!cellValue) return '';
            if (cellValue instanceof Date) {
                return cellValue.toISOString().slice(0, 10);
            }
            if (typeof cellValue === 'object' && cellValue.result instanceof Date) {
                return cellValue.result.toISOString().slice(0, 10);
            }
            if (typeof cellValue === 'number') {
                const date = new Date(Math.round((cellValue - 25569) * 86400 * 1000));
                return date.toISOString().slice(0, 10);
            }
            const str = String(cellValue).trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
                return str.slice(0, 10);
            }
            return str;
        };
        
        const formatNumberCell = (cellValue: any): number | undefined => {
            if (cellValue === null || cellValue === undefined) return undefined;
            if (typeof cellValue === 'number') return cellValue;
            if (typeof cellValue === 'object' && typeof cellValue.result === 'number') return cellValue.result;
            const parsed = parseFloat(String(cellValue).replace(/[^0-9.-]/g, ''));
            return isNaN(parsed) ? undefined : parsed;
        };
        
        const formatStringCell = (cellValue: any): string => {
            if (cellValue === null || cellValue === undefined) return '';
            if (typeof cellValue === 'object' && cellValue.result !== undefined) {
                return String(cellValue.result).trim();
            }
            return String(cellValue).trim();
        };

        const normalizeBargeName = (name: string): string => {
            return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
        };
        
        // Map of normalized barge names in system
        const systemBargesMap = new Map<string, Barge>();
        vessels.value.forEach(v => {
            if (v.barges) {
                v.barges.forEach(b => {
                    systemBargesMap.set(normalizeBargeName(b.name), b);
                });
            }
        });
        
        // Loop rows (row 1 is header, data starts at row 2)
        for (let r = 2; r <= sheet.rowCount; r++) {
            const row = sheet.getRow(r);
            const rawName = formatStringCell(row.getCell(2).value);
            if (!rawName) continue;
            
            const normName = normalizeBargeName(rawName);
            const barge = systemBargesMap.get(normName);
            
            if (barge) {
                const tonnage = formatNumberCell(row.getCell(3).value);
                const hp = formatNumberCell(row.getCell(4).value);
                const gcnNo = formatStringCell(row.getCell(5).value);
                const gcnIssuedDate = formatDateCell(row.getCell(6).value);
                const gcnExpiryDate = formatDateCell(row.getCell(7).value);
                const dkNo = formatStringCell(row.getCell(8).value);
                const dkIssuedDate = formatDateCell(row.getCell(9).value);
                const dkExpiryDate = formatDateCell(row.getCell(10).value);
                const bhNo = formatStringCell(row.getCell(11).value);
                const bhIssuedDate = formatDateCell(row.getCell(12).value);
                const bhExpiryDate = formatDateCell(row.getCell(13).value);
                
                const updatedConfig: BargeConfig = {
                    ...(barge.config || {}),
                    tonnage,
                    hp,
                    gcnNo,
                    gcnIssuedDate,
                    gcnExpiryDate,
                    dkNo,
                    dkIssuedDate,
                    dkExpiryDate,
                    bhNo,
                    bhIssuedDate,
                    bhExpiryDate,
                    updatedAt: Date.now()
                };
                
                await WeighbridgeService.updateBargeConfig(barge.id, updatedConfig);
                matchCount++;
            }
        }
        
        if (matchCount > 0) {
            addToast(`Đã nạp hồ sơ thành công cho ${matchCount} sà lan! 🚢`, 'success');
            window.dispatchEvent(new CustomEvent('barge-config-updated', { detail: { batch: true } }));
            await loadData();
        } else {
            addToast('Không tìm thấy sà lan nào khớp tên trong danh sách để cập nhật!', 'info');
        }
    } catch (e) {
        console.error('Lỗi khi nhập Excel:', e);
        addToast('Lỗi khi đọc file Excel, vui lòng kiểm tra lại cấu trúc file!', 'error');
    } finally {
        loading.value = false;
        if (excelFileInput.value) {
            excelFileInput.value.value = '';
        }
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
            
            <div class="flex items-center gap-2 max-w-md w-full justify-end">
                <!-- Excel Import -->
                <input 
                    type="file" 
                    ref="excelFileInput" 
                    @change="handleExcelImport" 
                    accept=".xlsx" 
                    class="hidden" 
                />
                <button 
                    @click="triggerExcelUpload"
                    class="h-8 px-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-teal-600/10 shrink-0"
                    title="Nhập dữ liệu hồ sơ hàng loạt từ file Excel"
                >
                    <span class="material-symbols-outlined text-sm">upload_file</span>
                    Nhập từ Excel
                </button>

                <div class="relative w-full max-w-xs">
                    <span class="material-symbols-outlined text-gray-400 text-sm absolute left-3 top-2.5">search</span>
                    <input 
                        v-model="searchQuery" 
                        type="text" 
                        placeholder="Tìm sà lan, tàu, chủ hàng..." 
                        class="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-semibold"
                    />
                </div>
                <button @click="loadData" class="size-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-primary transition-colors border border-gray-200 shrink-0" title="Tải lại dữ liệu">
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
                                <th class="px-3 py-2 text-center bg-gray-50">Trọng tải (Tấn)</th>
                                <th class="px-3 py-2 text-center bg-gray-50">Công suất (HP)</th>
                                <th class="px-3 py-2 text-center bg-gray-50">Đủ hồ sơ</th>
                                <th class="px-3 py-2 text-center bg-gray-50">Trạng thái GCN</th>
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
                                <td class="px-3 py-2.5 text-center text-gray-700">
                                    {{ item.barge.config?.tonnage !== undefined ? item.barge.config.tonnage.toLocaleString() : '-' }}
                                </td>
                                <td class="px-3 py-2.5 text-center text-gray-700">
                                    {{ item.barge.config?.hp !== undefined ? item.barge.config.hp.toLocaleString() : '-' }}
                                </td>
                                <td class="px-3 py-2.5 text-center">
                                    <span 
                                        v-if="isDocComplete(item.barge.config || {})" 
                                        class="inline-flex px-2.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[10px] font-bold items-center gap-1 whitespace-nowrap"
                                    >
                                        <span class="material-symbols-outlined text-[11px]">task_alt</span> ĐỦ
                                    </span>
                                    <span 
                                        v-else 
                                        class="inline-flex px-2.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-full text-[10px] font-bold items-center gap-1 whitespace-nowrap"
                                    >
                                        <span class="material-symbols-outlined text-[11px]">warning</span> THIẾU
                                    </span>
                                </td>
                                <td class="px-3 py-2.5 text-center">
                                    <span 
                                        v-if="getGcnStatus(item.barge.config || {}) === 'CÒN HẠN'" 
                                        class="inline-flex px-2.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[10px] font-bold items-center gap-1 whitespace-nowrap"
                                    >
                                        CÒN HẠN
                                    </span>
                                    <span 
                                        v-else-if="getGcnStatus(item.barge.config || {}) === 'HẾT HẠN'" 
                                        class="inline-flex px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-[10px] font-bold items-center gap-1 whitespace-nowrap"
                                    >
                                        HẾT HẠN
                                    </span>
                                    <span v-else class="text-gray-400 italic text-[10px]">-</span>
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
            <div class="bg-white rounded-[2.5rem] border border-[#1b0d11]/10 shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-scale-up">
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
                        <h4 class="text-xs font-black text-primary uppercase tracking-wider border-b border-dashed border-gray-200 pb-2 flex items-center gap-1">
                            <span class="material-symbols-outlined text-base">settings</span>
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

                    <!-- Right: Technical profiles (Structured Excel fields + Custom fields) -->
                    <div class="space-y-4 flex flex-col h-full min-h-0">
                        <h4 class="text-xs font-black text-primary uppercase tracking-wider border-b border-dashed border-gray-200 pb-2 flex items-center gap-1">
                            <span class="material-symbols-outlined text-base">engineering</span>
                            Hồ sơ kỹ thuật & Pháp lý (Excel)
                        </h4>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Trọng tải (Tấn)</label>
                                <input 
                                    v-model="editTonnage" 
                                    type="number" 
                                    placeholder="Ví dụ: 1276"
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-bold"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Công suất (HP)</label>
                                <input 
                                    v-model="editHp" 
                                    type="number" 
                                    placeholder="Ví dụ: 400"
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-bold"
                                />
                            </div>
                        </div>

                        <!-- GCN Đăng ký Group -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-2">
                            <span class="text-[10px] font-black text-[#4a2c32] uppercase tracking-wider flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm text-primary">feed</span>
                                Giấy chứng nhận (GCN) đăng ký
                            </span>
                            <div class="grid grid-cols-3 gap-2">
                                <div class="col-span-1 space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Số GCN</label>
                                    <input v-model="editGcnNo" type="text" class="w-full h-7 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Ngày cấp</label>
                                    <input v-model="editGcnIssuedDate" type="date" class="w-full h-7 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Hết hạn GCN</label>
                                    <input v-model="editGcnExpiryDate" type="date" class="w-full h-7 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                            </div>
                        </div>

                        <!-- Đăng kiểm Group -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-2">
                            <span class="text-[10px] font-black text-[#4a2c32] uppercase tracking-wider flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm text-primary">verified_user</span>
                                Chứng nhận Đăng kiểm (ĐK)
                            </span>
                            <div class="grid grid-cols-3 gap-2">
                                <div class="col-span-1 space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Số Đăng kiểm</label>
                                    <input v-model="editDkNo" type="text" class="w-full h-7 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Ngày cấp</label>
                                    <input v-model="editDkIssuedDate" type="date" class="w-full h-7 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Hết hạn ĐK</label>
                                    <input v-model="editDkExpiryDate" type="date" class="w-full h-7 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                            </div>
                        </div>

                        <!-- Bảo hiểm Group -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-2">
                            <span class="text-[10px] font-black text-[#4a2c32] uppercase tracking-wider flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm text-primary">gavel</span>
                                Bảo hiểm phương tiện (BH)
                            </span>
                            <div class="grid grid-cols-3 gap-2">
                                <div class="col-span-1 space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Số Bảo hiểm</label>
                                    <input v-model="editBhNo" type="text" class="w-full h-7 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Ngày cấp</label>
                                    <input v-model="editBhIssuedDate" type="date" class="w-full h-7 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Hết hạn BH</label>
                                    <input v-model="editBhExpiryDate" type="date" class="w-full h-7 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                            </div>
                        </div>

                        <!-- Custom optional metadata list -->
                        <div class="border-t border-dashed border-gray-200 pt-3 space-y-2">
                            <div class="flex justify-between items-center">
                                <span class="text-[10px] font-black text-gray-400 uppercase tracking-wider">Thông số phụ khác (Tự chọn)</span>
                                <button 
                                    @click="addCustomMeta" 
                                    class="h-5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[8px] font-black flex items-center gap-0.5 transition-all"
                                >
                                    <span class="material-symbols-outlined text-[10px]">add</span>
                                    Thêm dòng
                                </button>
                            </div>
                            <div class="max-h-[120px] overflow-y-auto space-y-2 pr-1">
                                <div 
                                    v-for="(meta, index) in customMetas" 
                                    :key="index"
                                    class="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-gray-150"
                                >
                                    <input v-model="meta.key" type="text" placeholder="Tên (VD: Chiều dài)" class="w-1/2 h-7 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32] font-black" />
                                    <input v-model="meta.value" type="text" placeholder="Giá trị (VD: 62m)" class="w-1/2 h-7 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                    <button @click="removeCustomMeta(index)" class="size-7 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center shrink-0 border border-transparent hover:border-red-200 transition-all">
                                        <span class="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
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

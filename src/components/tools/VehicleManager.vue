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
        if (event.data.type === 'vehicles') {
            const saved = await dbContext.get<Vehicle[]>('allocator_vehicles');
            if (saved && Array.isArray(saved)) {
                if (JSON.stringify(vehicles.value) !== JSON.stringify(saved)) {
                    vehicles.value = saved;
                }
            }
        }
    } catch (e) {
        console.error('Lỗi khi đồng bộ danh sách xe giữa các tab:', e);
    }
};

onUnmounted(() => {
    try {
        syncChannel.close();
    } catch (e) {
        console.error('Lỗi khi đóng sync channel:', e);
    }
});

interface Vehicle {
    plateNumber: string;
    moocNumber: string;
}

function normalizePlate(plate: string): string {
    return String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const vehicles = ref<Vehicle[]>([]);
const searchQuery = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

// Form state
const plateInput = ref('');
const moocInput = ref('');
const editingIndex = ref<number | null>(null);

const syncStatus = ref<'synced' | 'saving' | 'error'>('synced');
const loadingCloud = ref(false);

async function loadVehiclesFromSupabase() {
    loadingCloud.value = true;
    try {
        const { data, error } = await supabase
            .from('content')
            .select('settings')
            .eq('id', 'main')
            .single();
        if (error) throw error;
        
        if (data?.settings) {
            const remoteVehicles = data.settings.allocator_vehicles;
            if (Array.isArray(remoteVehicles)) {
                if (JSON.stringify(vehicles.value) !== JSON.stringify(remoteVehicles)) {
                    vehicles.value = remoteVehicles;
                    await dbContext.set('allocator_vehicles', remoteVehicles);
                }
                syncStatus.value = 'synced';
            } else {
                if (vehicles.value.length > 0) {
                    await saveVehiclesToSupabase();
                } else {
                    syncStatus.value = 'synced';
                }
            }
        }
    } catch (e) {
        console.warn('Lỗi khi tải danh sách xe từ Supabase:', e);
        syncStatus.value = 'error';
    } finally {
        loadingCloud.value = false;
    }
}

async function saveVehiclesToSupabase() {
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
            allocator_vehicles: vehicles.value
        };

        const { error: updateError } = await supabase
            .from('content')
            .update({ settings: updatedSettings })
            .eq('id', 'main');

        if (updateError) throw updateError;
        
        syncStatus.value = 'synced';
    } catch (e) {
        console.error('Lỗi khi lưu danh sách xe lên Supabase:', e);
        syncStatus.value = 'error';
        addToast('Lỗi đồng bộ dữ liệu đám mây!', 'error');
    }
}

// Load vehicles on mount
onMounted(async () => {
    try {
        const saved = await dbContext.get<Vehicle[]>('allocator_vehicles');
        if (saved && Array.isArray(saved)) {
            vehicles.value = saved;
        }
        await loadVehiclesFromSupabase();
    } catch (e) {
        console.error('Lỗi khi tải danh sách xe:', e);
    }
});

// Save to DB
const saveVehicles = async () => {
    try {
        await dbContext.set('allocator_vehicles', vehicles.value);
        await saveVehiclesToSupabase();
        syncChannel.postMessage({ type: 'vehicles' });
    } catch (e) {
        console.error('Lỗi khi lưu danh sách xe:', e);
        addToast('Lỗi khi lưu dữ liệu xe!', 'error');
    }
};

// Filtered vehicles list
const filteredVehicles = computed(() => {
    const q = searchQuery.value.trim().toUpperCase();
    if (!q) return vehicles.value;
    return vehicles.value.filter(v => 
        v.plateNumber.toUpperCase().includes(q) || 
        v.moocNumber.toUpperCase().includes(q)
    );
});

// Add or edit vehicle
const handleSubmit = async () => {
    const plate = plateInput.value.trim().toUpperCase();
    const mooc = moocInput.value.trim().toUpperCase();

    if (!plate) {
        addToast('Vui lòng nhập biển số xe!', 'info');
        return;
    }

    if (editingIndex.value === null) {
        // Add new
        const exists = vehicles.value.some(v => normalizePlate(v.plateNumber) === normalizePlate(plate));
        if (exists) {
            addToast('Biển số xe này đã tồn tại trong danh sách!', 'info');
            return;
        }
        vehicles.value.push({ plateNumber: plate, moocNumber: mooc });
        addToast('Đã thêm xe mới thành công!', 'success');
    } else {
        // Edit existing
        const index = editingIndex.value;
        const exists = vehicles.value.some((v, idx) => normalizePlate(v.plateNumber) === normalizePlate(plate) && idx !== index);
        if (exists) {
            addToast('Biển số xe này đã tồn tại ở dòng khác!', 'info');
            return;
        }
        const currentVehicle = vehicles.value[index];
        if (currentVehicle) {
            vehicles.value[index] = { plateNumber: plate, moocNumber: mooc };
            addToast('Đã cập nhật thông tin xe!', 'success');
        }
        editingIndex.value = null;
    }

    // Reset form & save
    plateInput.value = '';
    moocInput.value = '';
    await saveVehicles();
};

// Start edit
const startEdit = (index: number) => {
    const v = vehicles.value[index];
    if (v) {
        plateInput.value = v.plateNumber;
        moocInput.value = v.moocNumber;
        editingIndex.value = index;
    }
};

// Cancel edit
const cancelEdit = () => {
    plateInput.value = '';
    moocInput.value = '';
    editingIndex.value = null;
};

// Delete vehicle
const deleteVehicle = async (index: number) => {
    const v = vehicles.value[index];
    if (!v) return;
    const confirm = await showConfirm({
        title: 'Xóa xe khỏi danh sách',
        message: `Bạn có chắc chắn muốn xóa xe ${v.plateNumber} khỏi danh sách?`,
        type: 'danger',
        okText: 'Xóa',
        cancelText: 'Hủy'
    });
    if (confirm) {
        vehicles.value.splice(index, 1);
        await saveVehicles();
        addToast('Đã xóa xe khỏi danh sách!', 'info');
        if (editingIndex.value === index) {
            cancelEdit();
        } else if (editingIndex.value !== null && editingIndex.value > index) {
            editingIndex.value--;
        }
    }
};

// Clear all
const clearAll = async () => {
    const confirm = await showConfirm({
        title: 'Xóa sạch danh sách xe',
        message: 'Bạn có chắc chắn muốn xóa SẠCH toàn bộ danh sách xe không? Hành động này không thể hoàn tác!',
        type: 'danger',
        okText: 'Xóa sạch',
        cancelText: 'Hủy'
    });
    if (confirm) {
        vehicles.value = [];
        editingIndex.value = null;
        plateInput.value = '';
        moocInput.value = '';
        await saveVehicles();
        addToast('Đã xóa sạch danh sách xe!', 'info');
    }
};

// Import Excel
const triggerImport = () => {
    if (fileInput.value) {
        fileInput.value.click();
    }
};

const handleImportExcel = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    try {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const arrayBuffer = await file.arrayBuffer();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            addToast('Không tìm thấy sheet nào trong file Excel!', 'error');
            return;
        }

        let importedCount = 0;
        let updatedCount = 0;

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Bỏ qua tiêu đề
            const cell1 = row.getCell(1).value;
            const cell2 = row.getCell(2).value;

            if (cell1) {
                const plate = String(cell1).trim().toUpperCase();
                const mooc = cell2 ? String(cell2).trim().toUpperCase() : '';

                if (plate) {
                    const existingIdx = vehicles.value.findIndex(v => v.plateNumber === plate);
                    if (existingIdx !== -1) {
                        const existingVehicle = vehicles.value[existingIdx];
                        if (existingVehicle) {
                            existingVehicle.moocNumber = mooc;
                            updatedCount++;
                        }
                    } else {
                        vehicles.value.push({ plateNumber: plate, moocNumber: mooc });
                        importedCount++;
                    }
                }
            }
        });

        await saveVehicles();
        addToast(`Đã nhập xong! Thêm mới: ${importedCount}, Cập nhật: ${updatedCount}`, 'success');
    } catch (err) {
        console.error(err);
        addToast('Có lỗi xảy ra khi đọc tệp Excel!', 'error');
    } finally {
        target.value = '';
    }
};

// Export Excel
const handleExportExcel = async () => {
    if (vehicles.value.length === 0) {
        addToast('Danh sách trống, không có gì để xuất!', 'info');
        return;
    }
    try {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Danh sách xe');

        worksheet.columns = [
            { header: 'Biển số xe', key: 'plateNumber', width: 25 },
            { header: 'Số mooc', key: 'moocNumber', width: 25 }
        ];

        // Format header
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF10B981' } // Emerald green
        };

        vehicles.value.forEach(v => {
            worksheet.addRow({
                plateNumber: v.plateNumber,
                moocNumber: v.moocNumber
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `danh_sach_xe_${new Date().toISOString().slice(0, 10)}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
        addToast('Xuất tệp Excel thành công!', 'success');
    } catch (err) {
        console.error(err);
        addToast('Có lỗi xảy ra khi xuất Excel!', 'error');
    }
};
</script>

<template>
    <div class="w-full flex-1 flex flex-col gap-6 bg-white rounded-3xl p-6 border border-primary/5 shadow-soft">
        
        <!-- Header Section -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
                <h3 class="text-lg font-black text-primary flex items-center gap-2">
                    <span class="material-symbols-outlined text-xl">local_shipping</span>
                    Danh sách xe
                </h3>
                <p class="text-[11px] text-gray-500 font-semibold mt-1">
                    Quản lý danh sách biển số xe và số mooc tương ứng. Tổng cộng: 
                    <span class="text-teal-600 font-bold font-mono">{{ vehicles.length }}</span> xe.
                </p>
            </div>
            
            <!-- Actions buttons -->
            <div class="flex items-center gap-2 flex-wrap">
                <input 
                    type="file" 
                    ref="fileInput" 
                    @change="handleImportExcel" 
                    accept=".xlsx" 
                    class="hidden" 
                />
                
                <button 
                    @click="triggerImport"
                    class="px-3.5 py-2 bg-white border border-primary/20 text-primary hover:bg-primary/5 text-[11px] font-black rounded-[14px] flex items-center gap-1.5 transition-all shadow-sm"
                >
                    <span class="material-symbols-outlined text-sm font-bold">upload_file</span>
                    Nhập Excel
                </button>
                
                <button 
                    @click="handleExportExcel"
                    class="px-3.5 py-2 bg-white border border-primary/20 text-primary hover:bg-primary/5 text-[11px] font-black rounded-[14px] flex items-center gap-1.5 transition-all shadow-sm"
                >
                    <span class="material-symbols-outlined text-sm font-bold">download</span>
                    Xuất Excel
                </button>
                
                <button 
                    v-if="vehicles.length > 0"
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
                    {{ editingIndex !== null ? 'Cập nhật thông tin xe' : 'Thêm xe mới' }}
                </h4>
                
                <form @submit.prevent="handleSubmit" class="flex flex-col gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Biển số xe *</label>
                        <input 
                            type="text" 
                            v-model="plateInput"
                            placeholder="Ví dụ: 29C-12345"
                            required
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono"
                        />
                    </div>
                    
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Số mooc</label>
                        <input 
                            type="text" 
                            v-model="moocInput"
                            placeholder="Ví dụ: 29R-01234"
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono"
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

            <!-- Table & Search Card -->
            <div class="lg:col-span-2 flex flex-col gap-4">
                <!-- Search bar -->
                <div class="relative w-full">
                    <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                    <input 
                        type="text" 
                        v-model="searchQuery" 
                        placeholder="Tìm theo biển số xe hoặc số mooc..." 
                        class="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-full text-xs font-semibold focus:outline-none focus:border-primary transition-all"
                    />
                </div>

                <!-- Vehicles Table -->
                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div class="overflow-x-auto max-h-[400px]">
                        <table class="w-full text-left border-collapse text-xs font-semibold">
                            <thead class="bg-gray-50 border-b border-gray-100 sticky top-0 z-10 text-[10px] text-gray-500 uppercase tracking-wider select-none">
                                <tr>
                                    <th class="px-4 py-3 text-center w-14">STT</th>
                                    <th class="px-4 py-3">Biển số xe</th>
                                    <th class="px-4 py-3">Số mooc</th>
                                    <th class="px-4 py-3 text-center w-24">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-50">
                                <tr 
                                    v-for="(v, index) in filteredVehicles" 
                                    :key="v.plateNumber"
                                    :class="['hover:bg-primary/[0.02] transition-colors', editingIndex === index ? 'bg-primary/[0.04]' : '']"
                                >
                                    <td class="px-4 py-3 text-center text-gray-400 font-mono font-bold">{{ index + 1 }}</td>
                                    <td class="px-4 py-3 text-primary font-mono font-black select-all">{{ v.plateNumber }}</td>
                                    <td class="px-4 py-3 font-mono select-all">
                                        <span v-if="v.moocNumber" class="text-primary font-bold">{{ v.moocNumber }}</span>
                                        <span v-else class="text-gray-400 italic font-normal text-[11px]">Chưa cấu hình</span>
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        <div class="flex items-center justify-center gap-1.5">
                                            <button 
                                                @click="startEdit(index)"
                                                class="size-7 rounded-lg text-primary hover:bg-primary/10 flex items-center justify-center transition-all"
                                                title="Sửa thông tin"
                                            >
                                                <span class="material-symbols-outlined text-base">edit</span>
                                            </button>
                                            <button 
                                                @click="deleteVehicle(index)"
                                                class="size-7 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center transition-all"
                                                title="Xóa xe"
                                            >
                                                <span class="material-symbols-outlined text-base">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-if="filteredVehicles.length === 0">
                                    <td colspan="4" class="px-4 py-8 text-center text-gray-400 italic">
                                        Không tìm thấy xe nào phù hợp
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
        
        <!-- Premium Custom Confirm Modal -->
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
                <div 
                    class="w-full max-w-[480px] bg-white rounded-[24px] border border-gray-100 shadow-2xl p-6 flex flex-col gap-4 transform transition-all scale-100"
                >
                    <!-- Header -->
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
                    
                    <!-- Message Content -->
                    <div class="text-xs font-semibold text-gray-600 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto pr-1">
                        {{ confirmDialog.message }}
                    </div>
                    
                    <!-- Footer Buttons -->
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

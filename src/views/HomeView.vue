<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { authStore } from '../stores/auth';
import { WeighbridgeService } from '../services/excel/WeighbridgeService';
import { useToast } from '../composables/useToast';

const router = useRouter();
const { addToast } = useToast();

const vessels = ref<any[]>([]);
const loading = ref(true);
const exporting = ref(false);

const loadData = async () => {
    try {
        loading.value = true;
        vessels.value = await WeighbridgeService.getVessels() || [];
    } catch (e) {
        console.error('Error loading home data:', e);
    } finally {
        loading.value = false;
    }
};

const allBarges = computed(() => {
    const list: any[] = [];
    vessels.value.forEach(v => {
        if (v.barges) {
            v.barges.forEach((b: any) => {
                list.push({
                    ...b,
                    vesselId: v.id,
                    vesselName: v.name,
                    orderNo: b.config?.orderNo || '',
                    locked: b.config?.locked || false
                });
            });
        }
    });
    return list;
});

// Format current date
const formattedDate = computed(() => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('vi-VN', options);
});

const navigateToTool = (tab: 'allocator' | 'printer', bargeId?: number, vesselId?: number) => {
    // We can store target tab/barge details in localStorage or route query
    localStorage.setItem('home_redirect_tab', tab);
    if (bargeId && vesselId) {
        localStorage.setItem('home_redirect_barge_id', String(bargeId));
        localStorage.setItem('home_redirect_vessel_id', String(vesselId));
    }
    router.push('/tools');
};

const exportBargesToExcel = async () => {
    if (allBarges.value.length === 0) return;
    try {
        exporting.value = true;
        addToast('Đang chuẩn bị xuất tệp Excel...', 'info');
        
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Danh sách Sà Lan');
        
        sheet.views = [{ showGridLines: true }];
        
        sheet.columns = [
            { header: 'STT', key: 'stt', width: 6 },
            { header: 'Tên Sà Lan', key: 'name', width: 20 },
            { header: 'Mã Lệnh', key: 'orderNo', width: 15 },
            { header: 'Thuộc Tàu', key: 'vesselName', width: 25 },
            { header: 'Hàng Hóa', key: 'goods', width: 22 },
            { header: 'Mã Hàng', key: 'goodsCode', width: 12 },
            { header: 'Chủ Hàng', key: 'owner', width: 25 },
            { header: 'Trực Ca', key: 'operator', width: 18 },
            { header: 'Loại Hàng (X/N)', key: 'xn', width: 15 },
            { header: 'Trạng Thái', key: 'status', width: 15 },
        ];
        
        sheet.insertRow(1, []);
        sheet.insertRow(2, ['DANH SÁCH SÀ LAN ĐANG VẬN HÀNH HỆ THỐNG']);
        sheet.insertRow(3, [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')} - Tổng số: ${allBarges.value.length} sà lan`]);
        sheet.insertRow(4, []);
        
        sheet.mergeCells('A2:J2');
        sheet.mergeCells('A3:J3');
        
        const titleRow = sheet.getRow(2);
        titleRow.getCell(1).font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: '4A2C32' } };
        titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        titleRow.height = 30;
        
        const subTitleRow = sheet.getRow(3);
        subTitleRow.getCell(1).font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: '666666' } };
        subTitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        subTitleRow.height = 18;
        
        const headerRowNumber = 5;
        const headers = ['STT', 'Tên Sà Lan', 'Mã Lệnh', 'Thuộc Tàu', 'Hàng Hóa', 'Mã Hàng', 'Chủ Hàng', 'Trực Ca', 'Loại Hàng (X/N)', 'Trạng Thái'];
        sheet.getRow(headerRowNumber).values = headers;
        
        const headerRow = sheet.getRow(headerRowNumber);
        headerRow.height = 25;
        headerRow.eachCell((cell) => {
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF6B81' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: 'E5E7EB' } },
                left: { style: 'thin', color: { argb: 'E5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
                right: { style: 'thin', color: { argb: 'E5E7EB' } },
            };
        });
        
        allBarges.value.forEach((b, index) => {
            const rowData = [
                index + 1,
                b.name || '',
                b.orderNo || '-',
                b.vesselName || '',
                b.config?.goods || '-',
                b.config?.goodsCode || '-',
                b.config?.owner || '-',
                b.config?.operator || '-',
                b.config?.xn || '-',
                b.locked ? 'Đã khóa' : 'Đang mở'
            ];
            
            const rNumber = headerRowNumber + 1 + index;
            sheet.getRow(rNumber).values = rowData;
            
            const r = sheet.getRow(rNumber);
            r.height = 20;
            
            r.eachCell((cell, colNum) => {
                cell.font = { name: 'Segoe UI', size: 10, color: { argb: '333333' } };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'F3F4F6' } },
                    left: { style: 'thin', color: { argb: 'F3F4F6' } },
                    bottom: { style: 'thin', color: { argb: 'F3F4F6' } },
                    right: { style: 'thin', color: { argb: 'F3F4F6' } },
                };
                
                if (colNum === 1 || colNum === 3 || colNum === 6 || colNum === 9 || colNum === 10) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }
                
                if (colNum === 10) {
                    if (b.locked) {
                        cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'DC2626' }, bold: true };
                    } else {
                        cell.font = { name: 'Segoe UI', size: 10, color: { argb: '0D9488' }, bold: true };
                    }
                }
            });
        });
        
        sheet.columns.forEach((column) => {
            let maxLen = 0;
            column.eachCell!({ includeEmpty: false }, (cell, rowNum) => {
                if (rowNum >= headerRowNumber) {
                    const value = cell.value ? String(cell.value) : '';
                    if (value.length > maxLen) maxLen = value.length;
                }
            });
            column.width = Math.max(maxLen + 4, column.width || 10);
        });
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Danh_Sach_Sa_Lan_Van_Hanh_${new Date().toISOString().slice(0, 10)}.xlsx`;
        link.click();
        URL.revokeObjectURL(link.href);
        
        addToast('Xuất tệp Excel thành công! 📊', 'success');
    } catch (e) {
        console.error('Error exporting barges to excel:', e);
        addToast('Có lỗi xảy ra khi xuất Excel!', 'error');
    } finally {
        exporting.value = false;
    }
};

onMounted(() => {
    loadData();
});
</script>

<template>
    <div class="flex-1 w-[95%] max-w-[1200px] mx-auto py-8 flex flex-col gap-6 no-print">
        <!-- Welcome Banner -->
        <div class="bg-gradient-to-r from-soft-rose to-primary/10 rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-soft-pink/40 text-left relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <!-- Decorative bg -->
            <div class="absolute -right-10 -bottom-10 text-primary/5 select-none pointer-events-none">
                <span class="material-symbols-outlined text-[200px]">directions_boat</span>
            </div>
            
            <div class="relative z-10 space-y-2">
                <span class="text-[10px] font-black text-primary uppercase tracking-widest bg-white/60 px-3 py-1 rounded-full border border-soft-pink/30">HỆ THỐNG VẬN HÀNH</span>
                <h2 class="text-2xl md:text-3xl font-display font-black text-[#4a2c32] mt-2">
                    Chào buổi sáng, {{ authStore.displayName }}! ✨
                </h2>
                <p class="text-xs md:text-sm font-medium text-[#1b0d11]/60">
                    Chào mừng bạn quay trở lại. Hôm nay là <span class="font-bold text-[#4a2c32]">{{ formattedDate }}</span>.
                </p>
            </div>
            
            <div class="flex gap-3 relative z-10 shrink-0">
                <button 
                    v-if="authStore.role === 'admin'"
                    @click="navigateToTool('allocator')" 
                    class="h-10 px-5 bg-white text-primary border border-soft-pink font-bold rounded-2xl text-xs hover:bg-soft-rose/10 active:scale-95 transition-all flex items-center gap-2 shadow-sm"
                >
                    <span class="material-symbols-outlined text-base">shuffle</span>
                    Phân bổ chuyến
                </button>
                <button 
                    @click="navigateToTool('printer')" 
                    class="h-10 px-5 bg-primary text-white font-bold rounded-2xl text-xs hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 shadow-md shadow-primary/10"
                >
                    <span class="material-symbols-outlined text-base">print</span>
                    In phiếu cân xe
                </button>
            </div>
        </div>

        <!-- Quick Stats Row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-150 flex items-center gap-4 text-left">
                <div class="size-12 bg-primary/5 text-primary rounded-2xl flex items-center justify-center flex-shrink-0 border border-primary/10">
                    <span class="material-symbols-outlined text-2xl">directions_boat</span>
                </div>
                <div>
                    <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Quản lý tàu</p>
                    <h4 class="text-xl font-black text-[#4a2c32] mt-0.5">
                        {{ loading ? '...' : vessels.length }}
                        <span class="text-xs text-gray-400 font-bold ml-0.5">tàu đang làm hàng</span>
                    </h4>
                </div>
            </div>

            <div class="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-150 flex items-center gap-4 text-left">
                <div class="size-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center flex-shrink-0 border border-teal-100">
                    <span class="material-symbols-outlined text-2xl">layers</span>
                </div>
                <div>
                    <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tổng số sà lan</p>
                    <h4 class="text-xl font-black text-teal-600 mt-0.5">
                        {{ loading ? '...' : allBarges.length }}
                        <span class="text-xs text-gray-400 font-bold ml-0.5">sà lan được lập</span>
                    </h4>
                </div>
            </div>

            <div class="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-150 flex items-center gap-4 text-left">
                <div class="size-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center flex-shrink-0 border border-amber-100">
                    <span class="material-symbols-outlined text-2xl">lock_open</span>
                </div>
                <div>
                    <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Đang mở khóa</p>
                    <h4 class="text-xl font-black text-amber-600 mt-0.5">
                        {{ loading ? '...' : allBarges.filter(b => !b.locked).length }}
                        <span class="text-xs text-gray-400 font-bold ml-0.5">sà lan nhận đồng bộ</span>
                    </h4>
                </div>
            </div>
        </div>

        <!-- Main Dashboard Section -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <!-- Left 2 Cols: Recent Barges -->
            <div class="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-150 flex flex-col text-left min-h-[400px]">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-sm font-black text-[#4a2c32] flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-lg font-black">analytics</span>
                        Danh sách sà lan đang vận hành
                    </h3>
                    <div class="flex items-center gap-2">
                        <button 
                            @click="exportBargesToExcel" 
                            :disabled="exporting || allBarges.length === 0 || loading"
                            class="h-8 px-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-[10px] transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Xuất tất cả sà lan ra tệp Excel"
                        >
                            <span v-if="exporting" class="material-symbols-outlined text-xs animate-spin">sync</span>
                            <span v-else class="material-symbols-outlined text-xs">download</span>
                            Xuất Excel ({{ allBarges.length }})
                        </button>
                        <button @click="loadData" class="size-8 rounded-full hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-primary transition-colors border border-gray-100" title="Tải lại dữ liệu">
                            <span class="material-symbols-outlined text-base" :class="{'animate-spin': loading}">refresh</span>
                        </button>
                    </div>
                </div>
                
                <div v-if="loading" class="flex-1 flex flex-col justify-center items-center text-gray-400 text-xs gap-2">
                    <span class="material-symbols-outlined text-2xl animate-spin text-primary">sync</span>
                    Đang tải dữ liệu...
                </div>
                <div v-else-if="allBarges.length === 0" class="flex-1 flex flex-col justify-center items-center text-gray-400 text-xs italic">
                    Chưa có sà lan nào được tạo. Hãy vào tab Quản lý để thêm tàu & sà lan mới.
                </div>
                <div v-else class="flex-1 overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs font-semibold">
                        <thead>
                            <tr class="bg-gray-50 border-b border-gray-100 text-gray-400 font-black uppercase tracking-wider">
                                <th class="py-3 px-4">Sà lan</th>
                                <th class="py-3 px-4">Mã lệnh</th>
                                <th class="py-3 px-4">Thuộc tàu</th>
                                <th class="py-3 px-4 text-center">Trạng thái</th>
                                <th class="py-3 px-4 text-right">Xem nhanh</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 text-[#4a2c32]">
                            <tr v-for="b in allBarges.slice(0, 6)" :key="b.id" class="hover:bg-slate-50 transition-colors">
                                <td class="py-3 px-4 font-bold text-gray-900">{{ b.name }}</td>
                                <td class="py-3 px-4">
                                    <span v-if="b.orderNo" class="px-2 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[9px] font-black whitespace-nowrap">
                                        {{ b.orderNo }}
                                    </span>
                                    <span v-else class="text-gray-400 italic text-[10px]">-</span>
                                </td>
                                <td class="py-3 px-4">
                                    <span class="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[9px] font-black whitespace-nowrap">
                                        {{ b.vesselName }}
                                    </span>
                                </td>
                                <td class="py-3 px-4 text-center">
                                    <span v-if="b.locked" class="inline-flex px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-[9px] font-bold items-center gap-1">
                                        <span class="material-symbols-outlined text-[10px]">lock</span> Khóa
                                    </span>
                                    <span v-else class="inline-flex px-2.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[9px] font-bold items-center gap-1">
                                        <span class="material-symbols-outlined text-[10px]">lock_open</span> Mở
                                    </span>
                                </td>
                                <td class="py-3 px-4 text-right">
                                    <button 
                                        @click="navigateToTool('printer', b.id, b.vesselId)" 
                                        class="px-3 py-1 bg-white border border-soft-pink hover:bg-soft-rose/10 text-primary font-bold rounded-xl text-[10px] transition-all"
                                    >
                                        In phiếu
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Right Col: System Shortcuts & Guide -->
            <div class="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-150 flex flex-col text-left justify-between min-h-[400px]">
                <div class="space-y-6">
                    <h3 class="text-sm font-black text-[#4a2c32] flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-lg font-black">dashboard_customize</span>
                        Tiện ích nhanh
                    </h3>
                    
                    <div class="space-y-4">
                        <div 
                            @click="navigateToTool('printer')"
                            class="p-4 bg-[#fcf8f9] hover:bg-[#faebee] rounded-2xl border border-transparent hover:border-primary/15 transition-all cursor-pointer flex items-start gap-3 group"
                        >
                            <div class="size-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-soft shrink-0">
                                <span class="material-symbols-outlined text-base font-black">print</span>
                            </div>
                            <div>
                                <h4 class="font-bold text-xs text-[#4a2c32] group-hover:text-primary transition-colors">In phiếu nhanh</h4>
                                <p class="text-[10px] text-gray-400 font-bold mt-0.5">Tru cập trực tiếp trang in ấn phiếu cân A5 cho các xe.</p>
                            </div>
                        </div>

                        <div 
                            v-if="authStore.role === 'admin'"
                            @click="navigateToTool('allocator')"
                            class="p-4 bg-[#fcf8f9] hover:bg-[#faebee] rounded-2xl border border-transparent hover:border-primary/15 transition-all cursor-pointer flex items-start gap-3 group"
                        >
                            <div class="size-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-soft shrink-0">
                                <span class="material-symbols-outlined text-base font-black">shuffle</span>
                            </div>
                            <div>
                                <h4 class="font-bold text-xs text-[#4a2c32] group-hover:text-primary transition-colors">Phân bổ tải trọng sà lan</h4>
                                <p class="text-[10px] text-gray-400 font-bold mt-0.5">Tạo các lệnh phân bổ trọng lượng xe sà lan tự động.</p>
                            </div>
                        </div>
                        
                        <div 
                            v-if="authStore.role === 'admin'"
                            @click="router.push('/admin')"
                            class="p-4 bg-[#fcf8f9] hover:bg-[#faebee] rounded-2xl border border-transparent hover:border-primary/15 transition-all cursor-pointer flex items-start gap-3 group"
                        >
                            <div class="size-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shadow-soft shrink-0 border border-amber-100">
                                <span class="material-symbols-outlined text-base font-black">settings_applications</span>
                            </div>
                            <div>
                                <h4 class="font-bold text-xs text-[#4a2c32] group-hover:text-[#b27218] transition-colors">Quản trị tài khoản</h4>
                                <p class="text-[10px] text-gray-400 font-bold mt-0.5">Tạo mới, đổi mật khẩu và quản lý tài khoản nhân viên.</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="border-t border-dashed border-primary/10 pt-4 mt-4 text-[10px] text-gray-400 font-bold flex items-center justify-between">
                    <span>Đám mây kết nối: <span class="text-emerald-500">Đã đồng bộ</span></span>
                    <span>Phiên bản v1.2.0</span>
                </div>
            </div>
        </div>
    </div>
</template>

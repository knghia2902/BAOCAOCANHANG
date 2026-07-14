<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { authStore } from '../stores/auth';
import { WeighbridgeService } from '../services/excel/WeighbridgeService';

const router = useRouter();

const vessels = ref<any[]>([]);
const loading = ref(true);

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

const navigateToTool = (tab: 'allocator' | 'printer', subView?: 'allocator' | 'vehicles' | 'goods', bargeId?: number, vesselId?: number) => {
    localStorage.setItem('home_redirect_tab', tab);
    if (subView) {
        localStorage.setItem('home_redirect_subview', subView);
    } else {
        localStorage.removeItem('home_redirect_subview');
    }
    if (bargeId && vesselId) {
        localStorage.setItem('home_redirect_barge_id', String(bargeId));
        localStorage.setItem('home_redirect_vessel_id', String(vesselId));
    }
    router.push('/tools');
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

        <!-- Main Dashboard Section: Utilities Grid -->
        <div class="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-150 flex flex-col text-left">
            <h3 class="text-sm font-black text-[#4a2c32] flex items-center gap-2 mb-6">
                <span class="material-symbols-outlined text-primary text-lg font-black">dashboard_customize</span>
                Tiện ích hệ thống
            </h3>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <!-- Utility 1: In phiếu nhanh -->
                <div 
                    @click="navigateToTool('printer')"
                    class="p-6 bg-[#fcf8f9] hover:bg-[#faebee] rounded-[2rem] border border-transparent hover:border-primary/15 transition-all cursor-pointer flex flex-col justify-between h-[185px] group relative overflow-hidden"
                >
                    <div class="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-soft shrink-0">
                        <span class="material-symbols-outlined text-xl font-black">print</span>
                    </div>
                    <div>
                        <h4 class="font-black text-xs text-[#4a2c32] group-hover:text-primary transition-colors">In phiếu nhanh</h4>
                        <p class="text-[10px] text-gray-400 font-bold mt-1 leading-normal">Tru cập trực tiếp trang in ấn phiếu cân A5 cho các xe.</p>
                    </div>
                </div>

                <!-- Utility 2: Phân bổ tải trọng sà lan -->
                <div 
                    v-if="authStore.role === 'admin'"
                    @click="navigateToTool('allocator')"
                    class="p-6 bg-[#fcf8f9] hover:bg-[#faebee] rounded-[2rem] border border-transparent hover:border-primary/15 transition-all cursor-pointer flex flex-col justify-between h-[185px] group relative overflow-hidden"
                >
                    <div class="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-soft shrink-0">
                        <span class="material-symbols-outlined text-xl font-black">shuffle</span>
                    </div>
                    <div>
                        <h4 class="font-black text-xs text-[#4a2c32] group-hover:text-primary transition-colors">Phân bổ tải trọng sà lan</h4>
                        <p class="text-[10px] text-gray-400 font-bold mt-1 leading-normal">Tạo các lệnh phân bổ trọng lượng xe sà lan tự động.</p>
                    </div>
                </div>

                <!-- Utility 3: Quản lý hồ sơ phương tiện -->
                <div 
                    v-if="authStore.role === 'admin'"
                    @click="navigateToTool('allocator', 'vehicles')"
                    class="p-6 bg-[#fcf8f9] hover:bg-[#faebee] rounded-[2rem] border border-transparent hover:border-amber-600/15 transition-all cursor-pointer flex flex-col justify-between h-[185px] group relative overflow-hidden"
                >
                    <div class="size-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-soft shrink-0 border border-amber-100">
                        <span class="material-symbols-outlined text-xl font-black">local_shipping</span>
                    </div>
                    <div>
                        <h4 class="font-black text-xs text-[#4a2c32] group-hover:text-[#b27218] transition-colors">Quản lý hồ sơ phương tiện</h4>
                        <p class="text-[10px] text-gray-400 font-bold mt-1 leading-normal">Quản lý và đồng bộ danh sách biển số xe và số moóc.</p>
                    </div>
                </div>
                
                <!-- Utility 4: Quản trị tài khoản -->
                <div 
                    v-if="authStore.role === 'admin'"
                    @click="router.push('/admin')"
                    class="p-6 bg-[#fcf8f9] hover:bg-[#faebee] rounded-[2rem] border border-transparent hover:border-amber-600/15 transition-all cursor-pointer flex flex-col justify-between h-[185px] group relative overflow-hidden"
                >
                    <div class="size-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-soft shrink-0 border border-amber-100">
                        <span class="material-symbols-outlined text-xl font-black">settings_applications</span>
                    </div>
                    <div>
                        <h4 class="font-black text-xs text-[#4a2c32] group-hover:text-[#b27218] transition-colors">Quản trị tài khoản</h4>
                        <p class="text-[10px] text-gray-400 font-bold mt-1 leading-normal">Tạo mới, đổi mật khẩu và quản lý tài khoản nhân viên.</p>
                    </div>
                </div>
            </div>
            
            <div class="border-t border-dashed border-primary/10 pt-4 mt-8 text-[10px] text-gray-400 font-bold flex items-center justify-between">
                <span>Đám mây kết nối: <span class="text-emerald-500">Đã đồng bộ</span></span>
                <span>Phiên bản v1.2.0</span>
            </div>
        </div>
    </div>
</template>

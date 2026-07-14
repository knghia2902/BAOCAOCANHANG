<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authStore } from '../stores/auth';
import { ContentService } from '../services/ContentService';

const router = useRouter();
const allowedTools = ref<string[]>([]);
const loading = ref(true);

onMounted(async () => {
    if (authStore.role === 'staff') {
        allowedTools.value = await ContentService.loadStaffTools();
    } else {
        allowedTools.value = ['converter', 'merger', 'weighbridge', 'allocator', 'vehicles', 'ocr'];
    }
    loading.value = false;
});
</script>

<template>
  <div class="flex-grow w-[95%] max-w-[1200px] mx-auto py-8 flex flex-col gap-6 no-print text-left font-display">
    
    <!-- Title Header banner -->
    <div class="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-gray-150 relative overflow-hidden flex flex-col justify-between">
      <div class="absolute -right-6 -bottom-6 text-primary/5 select-none pointer-events-none">
        <span class="material-symbols-outlined text-[150px]">dashboard_customize</span>
      </div>
      <div class="relative z-10 space-y-2">
        <span class="text-[10px] font-black text-primary uppercase tracking-widest bg-white/60 px-3 py-1 rounded-full border border-soft-pink/30">CÔNG CỤ THÔNG MINH</span>
        <h2 class="text-2xl md:text-3xl font-display font-black text-[#4a2c32] mt-2">
          Danh Sách Công Cụ Hỗ Trợ
        </h2>
        <p class="text-xs md:text-sm font-medium text-[#1b0d11]/60">
          Hãy chọn công cụ bạn muốn sử dụng dưới đây. Các công cụ đều được bảo mật và đồng bộ trực tiếp lên đám mây.
        </p>
      </div>
    </div>

    <!-- Utilities Grid -->
    <div class="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-150 flex flex-col">
      <div v-if="loading" class="py-12 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
        <span class="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
        <span>Đang kiểm tra quyền hạn của bạn...</span>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <!-- Card 1: In phiếu nhanh -->
        <div 
          v-if="allowedTools.includes('weighbridge')"
          @click="router.push('/tools/printer')"
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

        <!-- Card 2: Phân bổ tải trọng sà lan -->
        <div 
          v-if="allowedTools.includes('allocator')"
          @click="router.push('/tools/allocator')"
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

        <!-- Card 3: Quản lý hồ sơ phương tiện -->
        <div 
          v-if="allowedTools.includes('vehicles')"
          @click="router.push('/tools/vehicles')"
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
      </div>
    </div>
  </div>
</template>

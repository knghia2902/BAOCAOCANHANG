<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import WeighbridgePrinter from '../components/tools/WeighbridgePrinter.vue';
import CargoAllocator from '../components/tools/CargoAllocator.vue';
import { authStore } from '../stores/auth';

const router = useRouter();
const activeTab = ref<'allocator' | 'printer'>('allocator');

onMounted(() => {
    const savedTab = localStorage.getItem('home_redirect_tab') as 'allocator' | 'printer' | null;
    if (savedTab) {
        activeTab.value = savedTab;
        localStorage.removeItem('home_redirect_tab');
    } else if (authStore.role === 'staff') {
        // Staff goes directly to In phiếu
        activeTab.value = 'printer';
    }
});
</script>

<template>
  <main class="fixed inset-0 bg-white z-[100] flex flex-col overflow-hidden no-print font-display">
    <!-- Header bar -->
    <header class="bg-white px-6 py-2.5 border-b border-primary/10 flex items-center justify-between shadow-sm shrink-0 no-print">
      <div class="flex items-center gap-2.5">
        <div class="size-9 rounded-full bg-primary flex items-center justify-center text-white shadow-soft">
          <span class="material-symbols-outlined text-lg">print</span>
        </div>
        <div>
          <h2 class="text-sm font-black text-primary leading-tight">
            PHẦN MỀM IN & PHÂN BỔ PHIẾU CÂN
          </h2>
          <p class="text-[10px] font-medium text-[#1b0d11]/60 leading-none">
            Cảng Nguyên Ngọc - Đồng bộ đám mây
          </p>
        </div>
      </div>

      <!-- Tab Navigation -->
      <nav class="flex gap-1 bg-slate-50 border border-primary/5 p-1 rounded-xl">
        <button 
          @click="activeTab = 'allocator'"
          :class="['px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5', activeTab === 'allocator' ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
        >
          <span class="material-symbols-outlined text-sm">shuffle</span>
          Báo cáo cân hàng
        </button>
        <button 
          @click="activeTab = 'printer'"
          :class="['px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5', activeTab === 'printer' ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
        >
          <span class="material-symbols-outlined text-sm">print</span>
          In Phiếu Cân Xe
        </button>
      </nav>
      
      <!-- User info and close button -->
      <div class="flex items-center gap-4">
        <span class="text-xs font-bold text-[#4a2c32]/60 hidden sm:inline">
          {{ authStore.displayName }} ({{ authStore.role === 'admin' ? 'Quản trị viên' : 'Nhân viên' }})
        </span>
        <button 
          @click="router.push('/')" 
          class="size-9 bg-[#fcf8f9] rounded-full flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/5 transition-all shadow-inner"
          title="Quay lại Trang chủ"
        >
          <span class="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </header>

    <!-- Workspace contents -->
    <div class="flex-1 overflow-hidden relative bg-cute-gradient">
      <!-- We keep printer active in background using v-show to listen to BroadcastChannel allocator sync notifications -->
      <CargoAllocator v-show="activeTab === 'allocator'" class="w-full h-full" />
      <WeighbridgePrinter v-show="activeTab === 'printer'" :hide-card="true" class="w-full h-full" />
    </div>
  </main>
</template>

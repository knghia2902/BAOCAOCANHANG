<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import WeighbridgePrinter from '../components/tools/WeighbridgePrinter.vue';
import CargoAllocator from '../components/tools/CargoAllocator.vue';
import BargeProfileManager from '../components/tools/BargeProfileManager.vue';
import { authStore } from '../stores/auth';
import { ContentService } from '../services/ContentService';

const router = useRouter();
const route = useRoute();
const activeTab = ref<'allocator' | 'printer' | 'vehicles'>('allocator');
const allowedTools = ref<string[]>([]);
const loadingTools = ref(true);

const isAllowed = (tab: 'allocator' | 'printer' | 'vehicles') => {
    const idMap = {
        allocator: 'allocator',
        printer: 'weighbridge',
        vehicles: 'vehicles'
    };
    return allowedTools.value.includes(idMap[tab]);
};

const initTabs = async () => {
    loadingTools.value = true;
    if (authStore.role === 'staff') {
        allowedTools.value = await ContentService.loadStaffTools();
    } else {
        allowedTools.value = ['converter', 'merger', 'weighbridge', 'allocator', 'vehicles', 'ocr'];
    }
    loadingTools.value = false;

    const savedTab = localStorage.getItem('home_redirect_tab') as 'allocator' | 'printer' | 'vehicles' | null;
    const initialTab = savedTab || (route.query.tool as 'allocator' | 'printer' | 'vehicles' | null);
    localStorage.removeItem('home_redirect_tab');

    if (initialTab && isAllowed(initialTab)) {
        activeTab.value = initialTab;
    } else {
        if (isAllowed('allocator')) {
            activeTab.value = 'allocator';
        } else if (isAllowed('printer')) {
            activeTab.value = 'printer';
        } else if (isAllowed('vehicles')) {
            activeTab.value = 'vehicles';
        }
    }
};

watch(() => route.query.tool, (newTool) => {
    if (newTool === 'allocator' || newTool === 'printer' || newTool === 'vehicles') {
        if (isAllowed(newTool)) {
            activeTab.value = newTool;
        }
    }
});

onMounted(async () => {
    await initTabs();
});</script>

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
      <nav class="flex gap-1 bg-slate-50 border border-primary/5 p-1 rounded-xl" v-if="!loadingTools">
        <button 
          v-if="isAllowed('allocator')"
          @click="activeTab = 'allocator'"
          :class="['px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5', activeTab === 'allocator' ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
        >
          <span class="material-symbols-outlined text-sm">shuffle</span>
          Báo cáo cân hàng
        </button>
        <button 
          v-if="isAllowed('printer')"
          @click="activeTab = 'printer'"
          :class="['px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5', activeTab === 'printer' ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
        >
          <span class="material-symbols-outlined text-sm">print</span>
          In Phiếu Cân Xe
        </button>
        <button 
          v-if="isAllowed('vehicles')"
          @click="activeTab = 'vehicles'"
          :class="['px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5', activeTab === 'vehicles' ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
        >
          <span class="material-symbols-outlined text-sm">local_shipping</span>
          Hồ sơ phương tiện
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
      <CargoAllocator v-if="!loadingTools && isAllowed('allocator')" v-show="activeTab === 'allocator'" class="w-full h-full" />
      <WeighbridgePrinter v-if="!loadingTools && isAllowed('printer')" v-show="activeTab === 'printer'" :hide-card="true" class="w-full h-full" />
      <BargeProfileManager v-if="!loadingTools && isAllowed('vehicles')" v-show="activeTab === 'vehicles'" class="w-full h-full" />
    </div>
  </main>
</template>

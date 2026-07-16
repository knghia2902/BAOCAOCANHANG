<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import WeighbridgePrinter from '../components/tools/WeighbridgePrinter.vue';
import { authStore } from '../stores/auth';
import { ContentService } from '../services/ContentService';

const router = useRouter();
const allowed = ref(false);
const loading = ref(true);

const checkPermission = async () => {
    loading.value = true;
    if (!authStore.isAuthenticated) {
        return;
    }
    if (authStore.role === 'staff') {
        const staffTools = await ContentService.loadStaffTools();
        if (!staffTools.includes('weighbridge')) {
            router.push('/tools');
            return;
        }
    }
    allowed.value = true;
    loading.value = false;
};

watch(() => [authStore.isAuthenticated, authStore.role], async () => {
    await checkPermission();
}, { immediate: true });
</script>

<template>
  <main v-if="!loading && allowed" class="fixed inset-0 bg-white z-[100] flex flex-col overflow-hidden no-print font-display">
    <header class="bg-white px-6 py-2.5 border-b border-primary/10 flex items-center justify-between shadow-sm shrink-0 no-print">
      <div class="flex items-center gap-2.5">
        <div class="size-9 rounded-full bg-primary flex items-center justify-center text-white shadow-soft">
          <span class="material-symbols-outlined text-lg">print</span>
        </div>
        <div>
          <h2 class="text-sm font-black text-primary leading-tight">
            IN PHIẾU NHANH
          </h2>
          <p class="text-[10px] font-medium text-[#1b0d11]/60 leading-none">
            Cảng Nguyên Ngọc - Đồng bộ đám mây
          </p>
        </div>
      </div>
      
      <div class="flex items-center gap-4">
        <span class="text-xs font-bold text-[#4a2c32]/60 hidden sm:inline">
          {{ authStore.displayName }} ({{ authStore.role === 'admin' ? 'Quản trị viên' : 'Nhân viên' }})
        </span>
        <button 
          @click="router.push('/tools')" 
          class="size-9 bg-[#fcf8f9] rounded-full flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/5 transition-all shadow-inner"
          title="Quay lại danh sách công cụ"
        >
          <span class="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </header>

    <div class="flex-grow min-h-0 relative bg-cute-gradient">
      <WeighbridgePrinter :hide-card="true" class="w-full h-full" />
    </div>
  </main>
</template>

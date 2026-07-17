<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import CargoAllocator from '../components/tools/CargoAllocator.vue';
import { authStore, hasPermission } from '../stores/auth';


const router = useRouter();
const allowed = ref(false);
const loading = ref(true);

const checkPermission = async () => {
    loading.value = true;
    if (!authStore.isAuthenticated) {
        return;
    }
    if (!hasPermission('allocator')) {
        router.push('/tools');
        return;
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
    <header class="bg-white px-6 py-4 border-b border-primary/10 flex items-center justify-between shadow-sm shrink-0 no-print">
      <div class="flex items-center gap-3">
        <div class="size-11 rounded-full bg-primary flex items-center justify-center text-white shadow-soft shrink-0">
          <span class="material-symbols-outlined text-[20px]">shuffle</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <h2 class="text-base font-black text-primary leading-tight">
            DỮ LIỆU CÂN HÀNG
          </h2>
          <p class="text-xs font-semibold text-[#1b0d11]/50 leading-none">
            Cảng Nguyên Ngọc - Đồng bộ đám mây
          </p>
        </div>
      </div>
      
      <div class="flex items-center gap-4">
        <span class="text-xs font-bold text-[#1e293b]/60 hidden sm:inline">
          {{ authStore.displayName }} ({{ authStore.role === 'admin' ? 'Quản trị viên' : 'Nhân viên' }})
        </span>
        <button 
          @click="router.push('/tools')" 
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full text-xs flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
          title="Quay lại danh sách công cụ"
        >
          <span class="material-symbols-outlined text-sm font-black">close</span>
          Đóng
        </button>
      </div>
    </header>

    <div class="flex-grow min-h-0 relative bg-cute-gradient">
      <CargoAllocator class="w-full h-full" />
    </div>
  </main>
</template>

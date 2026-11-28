<script setup lang="ts">
import { useRouter } from 'vue-router';
import { onMounted, onUnmounted } from 'vue';

const router = useRouter();

defineProps<{
  title: string;
  subtitle: string;
  icon: string;
  iconBg: string;
  isFullWidth: boolean;
}>();

const closeTool = () => {
  router.push('/tools');
};

onMounted(() => {
  if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      document.body.style.overflow = 'hidden';
  }
});

onUnmounted(() => {
  document.body.style.overflow = '';
});
</script>

<template>
  <div 
    :class="[
      isFullWidth
        ? 'fixed inset-0 bg-white z-[100] flex flex-col overflow-y-auto md:overflow-hidden no-print font-display' 
        : 'fixed inset-0 bg-cute-gradient z-[100] flex flex-col overflow-y-auto md:overflow-hidden no-print animate-fade-in font-display'
    ]"
  >
    <!-- Workspace Header bar -->
    <header class="bg-white px-4 md:px-6 py-3 md:py-4 border-b border-primary/10 flex items-center justify-between shadow-sm shrink-0 sticky top-0 z-30">
      <div class="flex items-center gap-3">
        <div :class="['size-11 rounded-full flex items-center justify-center text-white shadow-soft shrink-0', iconBg]">
          <span class="material-symbols-outlined text-[20px]">{{ icon }}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <h2 class="text-xl font-display font-black text-primary leading-tight">{{ title }}</h2>
          <p class="text-xs font-semibold text-slate-500 leading-none">{{ subtitle }}</p>
        </div>
      </div>
      
      <button 
        @click="closeTool"
        title="Đóng"
        aria-label="Đóng"
        class="size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all"
      >
        <span class="material-symbols-outlined text-xl">close</span>
      </button>
    </header>

    <!-- Workspace Body -->
    <div class="flex-1 flex flex-col md:flex-row md:overflow-hidden">
      <!-- Slot for Sidebar -->
      <slot name="sidebar" />
      
      <!-- Slot for Mobile Nav -->
      <slot name="mobile-nav" />

      <!-- Main Content Area -->
      <main 
        :class="[
          isFullWidth
            ? 'flex-1 flex flex-col bg-cute-gradient md:overflow-hidden' 
            : 'flex-1 overflow-y-auto p-4 md:p-6 bg-cute-gradient flex flex-col items-center'
        ]"
      >
        <div 
          :class="[
            isFullWidth
              ? 'w-full flex-1 flex flex-col md:h-full md:overflow-hidden' 
              : 'w-full max-w-[1200px] h-full flex flex-col mx-auto'
          ]"
        >
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
    animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>

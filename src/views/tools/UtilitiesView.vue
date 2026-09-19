<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authStore } from '@/stores/auth';
import ToolLayout from '../../layouts/ToolLayout.vue';

const FormatConverter = defineAsyncComponent(() => import('../../components/tools/FormatConverter.vue'));
const ExcelMerger = defineAsyncComponent(() => import('../../components/tools/ExcelMerger.vue'));
const PdfOcrTools = defineAsyncComponent(() => import('../../components/tools/PdfOcrTools.vue'));

const route = useRoute();
const router = useRouter();

const utilitySubTools = [
  { id: 'converter', name: 'Chuyển Đổi Định Dạng', icon: 'swap_horiz' },
  { id: 'merger', name: 'Gộp Excel Thông Minh', icon: 'layers' },
  { id: 'ocr', name: 'Trích Xuất PDF & OCR', icon: 'document_scanner' }
] as const;

const activeTab = ref<'converter' | 'merger' | 'ocr'>('converter');

const allowedTabs = computed(() => {
  if (authStore.role === 'admin') return utilitySubTools;
  const staffTools = authStore.rolePermissions?.[authStore.role || 'staff']?.tools || [];
  return utilitySubTools.filter(sub => staffTools.includes(sub.id));
});

const currentSubTool = computed(() => {
  return utilitySubTools.find(s => s.id === activeTab.value) || utilitySubTools[0];
});

watch(() => route.query.tab, (newTab) => {
  if (newTab === 'converter' || newTab === 'merger' || newTab === 'ocr') {
    activeTab.value = newTab;
    localStorage.setItem('active_utility_tab', newTab);
  }
}, { immediate: true });

onMounted(() => {
  if (!route.query.tab) {
    const saved = localStorage.getItem('active_utility_tab') as 'converter' | 'merger' | 'ocr';
    if (saved) {
      activeTab.value = saved;
      router.replace({ query: { tab: saved } });
    }
  }
});

const setTab = (tab: 'converter' | 'merger' | 'ocr') => {
  activeTab.value = tab;
  localStorage.setItem('active_utility_tab', tab);
  router.push({ query: { tab } });
};

const backToCatalog = () => {
  router.push('/tools');
};
</script>

<template>
  <ToolLayout
    :title="currentSubTool.name.toUpperCase()"
    subtitle="Công cụ tiện ích - Xử lý offline an toàn"
    :icon="currentSubTool.icon"
    iconBg="bg-teal-500"
    :isFullWidth="false"
  >
    <template #sidebar>
      <aside class="hidden md:flex w-64 bg-white border-r border-primary/10 flex-col shrink-0">
        <div class="p-3 border-b border-primary/5 flex items-center justify-between">
          <span class="text-xs font-black text-gray-400 uppercase tracking-wider">Danh sách tiện ích</span>
        </div>
        <div class="flex-1 overflow-y-auto p-2 space-y-1">
          <button 
            v-for="sub in allowedTabs" 
            :key="sub.id"
            @click="setTab(sub.id as any)"
            :class="['w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs font-bold transition-all', activeTab === sub.id ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
          >
            <span class="material-symbols-outlined text-sm">{{ sub.icon }}</span>
            <span class="truncate">{{ sub.name }}</span>
          </button>
        </div>
        <div class="p-3 border-t border-primary/10 bg-gray-50">
          <button 
            @click="backToCatalog" 
            class="w-full py-2 bg-white border border-primary/20 hover:border-primary text-primary font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 hover:bg-primary/10 transition-all shadow-sm"
          >
            <span class="material-symbols-outlined text-xs">arrow_back</span>
            Về Danh Mục
          </button>
        </div>
      </aside>
    </template>

    <template #mobile-nav>
      <div class="flex md:hidden bg-white border-b border-primary/10 p-2 overflow-x-auto gap-2 shrink-0 scrollbar-none whitespace-nowrap">
          <button 
            v-for="sub in allowedTabs" 
            :key="sub.id"
            @click="setTab(sub.id as any)"
            :class="['flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0', activeTab === sub.id ? 'bg-primary text-white shadow-soft' : 'bg-slate-50 text-gray-600 border border-gray-150']"
          >
            <span class="material-symbols-outlined text-sm">{{ sub.icon }}</span>
            <span>{{ sub.name }}</span>
          </button>
      </div>
    </template>

    <Suspense>
      <FormatConverter v-if="activeTab === 'converter'" />
      <ExcelMerger v-else-if="activeTab === 'merger'" />
      <PdfOcrTools v-else-if="activeTab === 'ocr'" />
      <template #fallback>
        <div class="flex items-center justify-center h-full w-full">
          <div class="flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
            <span class="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
            <span>Đang tải công cụ...</span>
          </div>
        </div>
      </template>
    </Suspense>
  </ToolLayout>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted } from 'vue';
import ToolLayout from '../../layouts/ToolLayout.vue';

const WeighbridgePrinter = defineAsyncComponent(() => import('../../components/tools/WeighbridgePrinter.vue'));

onMounted(() => {
    window.dispatchEvent(new CustomEvent('weighbridge-status', { detail: true }));
});

onUnmounted(() => {
    window.dispatchEvent(new CustomEvent('weighbridge-status', { detail: false }));
});
</script>

<template>
  <ToolLayout
    title="BÁO CÁO TỔNG QUAN 🚢"
    subtitle="Cảng Nguyên Ngọc - Đồng bộ đám mây"
    icon="monitoring"
    iconBg="bg-primary"
    :isFullWidth="true"
  >
    <Suspense>
      <WeighbridgePrinter :hide-card="true" />
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

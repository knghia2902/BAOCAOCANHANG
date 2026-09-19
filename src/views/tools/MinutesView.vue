<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import ToolLayout from '../../layouts/ToolLayout.vue';

const BargeMinutes = defineAsyncComponent(() => import('../../components/tools/BargeMinutes.vue'));
</script>

<template>
  <ToolLayout
    title="BIÊN BẢN SÀ LAN 🚢"
    subtitle="Công cụ tiện ích - Xử lý offline an toàn"
    icon="description"
    iconBg="bg-emerald-500"
    :isFullWidth="false"
  >
    <Suspense>
      <BargeMinutes />
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

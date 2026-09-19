<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import ToolLayout from '../../layouts/ToolLayout.vue';

const BargeProfileManager = defineAsyncComponent(() => import('../../components/tools/BargeProfileManager.vue'));
</script>

<template>
  <ToolLayout
    title="QUẢN LÝ HỒ SƠ PHƯƠNG TIỆN 🚢"
    subtitle="Cảng Nguyên Ngọc - Đồng bộ đám mây"
    icon="directions_boat"
    iconBg="bg-primary"
    :isFullWidth="true"
  >
    <Suspense>
      <BargeProfileManager />
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

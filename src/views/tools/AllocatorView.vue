<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import ToolLayout from '../../layouts/ToolLayout.vue';

const CargoAllocator = defineAsyncComponent(() => import('../../components/tools/CargoAllocator.vue'));
</script>

<template>
  <ToolLayout
    title="DỮ LIỆU CÂN HÀNG 🚢"
    subtitle="Cảng Nguyên Ngọc - Đồng bộ đám mây"
    icon="balance"
    iconBg="bg-primary"
    :isFullWidth="true"
  >
    <Suspense>
      <CargoAllocator />
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

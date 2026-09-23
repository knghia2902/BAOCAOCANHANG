<script setup lang="ts">
import ToolLayout from '../../layouts/ToolLayout.vue';
import SingleBargeAllocator from '../../components/tools/SingleBargeAllocator.vue';
</script>

<template>
  <ToolLayout
    title="PHÂN BỔ TẢI TRỌNG 🚢"
    subtitle="Cảng Nguyên Ngọc - Đồng bộ đám mây"
    icon="shuffle"
    iconBg="bg-primary"
    :isFullWidth="true"
  >
    <SingleBargeAllocator />
  </ToolLayout>
</template>

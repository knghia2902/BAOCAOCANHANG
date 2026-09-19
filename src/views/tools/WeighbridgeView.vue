<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import ToolLayout from '../../layouts/ToolLayout.vue';
import WeighbridgePrinter from '../../components/tools/WeighbridgePrinter.vue';

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
    <WeighbridgePrinter :hide-card="true" />
  </ToolLayout>
</template>

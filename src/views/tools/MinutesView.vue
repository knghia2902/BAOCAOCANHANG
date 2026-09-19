<script setup lang="ts">
import ToolLayout from '../../layouts/ToolLayout.vue';
import BargeMinutes from '../../components/tools/BargeMinutes.vue';
</script>

<template>
  <ToolLayout
    title="BIÊN BẢN SÀ LAN 🚢"
    subtitle="Công cụ tiện ích - Xử lý offline an toàn"
    icon="description"
    iconBg="bg-emerald-500"
    :isFullWidth="false"
  >
    <BargeMinutes />
  </ToolLayout>
</template>

<script setup lang="ts">
import ToolLayout from '../../layouts/ToolLayout.vue';
import BargeProfileManager from '../../components/tools/BargeProfileManager.vue';
</script>

<template>
  <ToolLayout
    title="QUẢN LÝ HỒ SƠ PHƯƠNG TIỆN 🚢"
    subtitle="Cảng Nguyên Ngọc - Đồng bộ đám mây"
    icon="directions_boat"
    iconBg="bg-primary"
    :isFullWidth="true"
  >
    <BargeProfileManager />
  </ToolLayout>
</template>

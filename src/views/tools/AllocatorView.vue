<script setup lang="ts">
import ToolLayout from '../../layouts/ToolLayout.vue';
import CargoAllocator from '../../components/tools/CargoAllocator.vue';
</script>

<template>
  <ToolLayout
    title="DỮ LIỆU CÂN HÀNG 🚢"
    subtitle="Cảng Nguyên Ngọc - Đồng bộ đám mây"
    icon="balance"
    iconBg="bg-primary"
    :isFullWidth="true"
  >
    <CargoAllocator />
  </ToolLayout>
</template>

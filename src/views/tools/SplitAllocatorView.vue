<script setup lang="ts">
import ToolLayout from '../../layouts/ToolLayout.vue';
import SingleBargeAllocator from '../../components/tools/SingleBargeAllocator.vue';
</script>

<template>
  <ToolLayout
    title="PHÂN BỔ TẢI TRỌNG 🚢"
    subtitle="Phân bổ định mức tải trọng xe cho từng sà lan độc lập"
    icon="call_split"
    iconBg="bg-indigo-600"
    :isFullWidth="true"
  >
    <SingleBargeAllocator />
  </ToolLayout>
</template>

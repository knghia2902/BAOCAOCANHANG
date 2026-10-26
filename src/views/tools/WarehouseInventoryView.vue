<script setup lang="ts">
import ToolLayout from '../../layouts/ToolLayout.vue';
import WarehouseInventoryManager from '../../components/tools/WarehouseInventoryManager.vue';
</script>

<template>
  <ToolLayout
    title="BÁO CÁO TỒN KHO 4 KHO 🏭"
    subtitle="Cảng Nguyên Ngọc - Báo cáo tồn kho hàng sáng & Zalo"
    icon="warehouse"
    iconBg="bg-primary"
    :isFullWidth="true"
  >
    <div class="flex-1 w-full h-full overflow-y-auto bg-background-light p-4 md:p-6">
      <WarehouseInventoryManager />
    </div>
  </ToolLayout>
</template>

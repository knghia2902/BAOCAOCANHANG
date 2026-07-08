<template>
  <div class="w-full">
    <div class="w-full bg-soft-pink/20 rounded-full h-4 overflow-hidden">
      <div class="bg-primary h-full transition-all duration-300 ease-out" :style="{ width: `${percentage}%` }"></div>
    </div>
    <div v-if="percentage < 100" class="flex items-center justify-center gap-2 mt-2 opacity-70">
      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-sm">{{ statusText }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  statusText: string;
  percentage: number;
}>();
</script>

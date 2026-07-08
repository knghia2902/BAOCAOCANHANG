<template>
  <div class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="px-4 py-3 rounded-xl shadow-lg text-white"
      :class="{
        'bg-red-500': toast.type === 'error',
        'bg-green-500': toast.type === 'success',
        'bg-blue-500': toast.type === 'info'
      }"
    >
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast';

const { toasts } = useToast();
</script>

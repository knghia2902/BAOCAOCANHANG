<template>
  <div
    class="dashed-cloud rounded-[2.5rem] p-10 flex flex-col items-center justify-center gap-4 text-center cursor-pointer border-2 border-dashed border-primary/20 hover:bg-white/50 transition-all"
    :class="{ 'border-primary bg-primary/5': isDragOver }"
    @dragover.prevent="isDragOver = true"
    @dragleave.prevent="isDragOver = false"
    @drop.prevent="handleDrop"
    @click="triggerInput"
  >
    <slot></slot>
    <input
      type="file"
      class="hidden"
      ref="fileInput"
      @change="handleFileSelect"
      :accept="accept"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(defineProps<{
  accept?: string;
}>(), {
  accept: '*'
});

const emit = defineEmits<{
  (e: 'file-selected', file: File): void;
  (e: 'error', message: string): void;
}>();

const isDragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const triggerInput = () => {
  fileInput.value?.click();
};

const handleDrop = (event: DragEvent) => {
  isDragOver.value = false;
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    const f = files[0]; if(f) processFile(f);
  }
};

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const f = target.files[0]; if(f) processFile(f);
    // reset input so same file can be selected again
    target.value = '';
  }
};

const processFile = (file: File) => {
  if (file.size > 15 * 1024 * 1024) {
    emit('error', 'File size exceeds 15MB limit');
    return;
  }
  emit('file-selected', file);
};
</script>


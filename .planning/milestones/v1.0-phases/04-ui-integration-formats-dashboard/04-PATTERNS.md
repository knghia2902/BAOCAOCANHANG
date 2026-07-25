# Phase 4 Patterns

## 1. FileDropzone (`src/components/ui/FileDropzone.vue`)
- **Role:** Reusable drag-and-drop file upload component that handles visual states and basic size validation (15MB limit).
- **Data Flow:** Captures file drops and input selections, validates the file, and emits `@file-selected` or `@error` events to the parent component.
- **Analog:** Extracted and generalized from the upload area pattern inside `src/components/tools/FormatConverter.vue`.
- **Pattern Excerpt:**
```vue
<div
  class="dashed-cloud rounded-[2.5rem] p-10 flex flex-col items-center justify-center gap-4 text-center cursor-pointer hover:bg-white/50 transition-all border-2 border-dashed border-primary/20"
  :class="{ 'border-primary bg-primary/5': isDragOver }"
  @dragover.prevent="isDragOver = true"
  @dragleave.prevent="isDragOver = false"
  @drop.prevent="handleDrop"
  @click="handleLogClick"
>
  <input type="file" ref="fileInput" class="hidden" @change="handleFileSelect" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" />
  <!-- Icon & Upload Message -->
</div>
```

## 2. ConversionProgress (`src/components/ui/ConversionProgress.vue`)
- **Role:** A UI component to present the progress of long-running operations (like OCR or PDF generation) dynamically.
- **Data Flow:** Purely stateless. Receives `statusText` (string) and `percentage` (number) as Vue props and updates the DOM width of a Tailwind progress bar.
- **Analog:** Standard Tailwind UI progress indicators using dynamic width styles bindings.
- **Pattern Excerpt:**
```vue
<template>
  <div class="w-full bg-soft-pink/20 rounded-full h-4 overflow-hidden">
    <div 
      class="bg-primary h-full transition-all duration-300 ease-out"
      :style="{ width: `${percentage}%` }"
    ></div>
  </div>
  <p class="text-sm text-center mt-2 opacity-70">{{ statusText }}</p>
</template>
```

## 3. Toast Management Composable (`src/composables/useToast.ts`)
- **Role:** Global state container for managing temporary notification messages without external libraries.
- **Data Flow:** Exposes a reactive array of toast objects and an `addToast()` function. The composable orchestrates the push/removal and automatically sets a timeout for lifecycle cleanup.
- **Analog:** Similar to the lightweight Vue 3 Composition API stores used in `src/stores/auth.ts`.
- **Pattern Excerpt:**
```typescript
import { ref } from 'vue';

const toasts = ref<{ id: number, message: string, type: 'success' | 'error' | 'info' }[]>([]);
let toastId = 0;

export function useToast() {
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = toastId++;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, 3000);
  };

  return { toasts, addToast };
}
```

## 4. ToastNotification UI (`src/components/ui/ToastNotification.vue`)
- **Role:** The rendering layer for the reactive toast states.
- **Data Flow:** Imports `useToast()`, reads the `toasts` array, and renders a floating `fixed` flex-container on top of the layout.
- **Analog:** Floating alert implementations common in SPA layouts; will use Tailwind for positioning.
- **Pattern Excerpt:**
```vue
<script setup lang="ts">
import { useToast } from '@/composables/useToast';
const { toasts } = useToast();
</script>
<template>
  <div class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
    <div v-for="toast in toasts" :key="toast.id" class="px-4 py-3 rounded-xl shadow-lg ...">
      {{ toast.message }}
    </div>
  </div>
</template>
```

## 5. PdfOcrTools (`src/components/tools/PdfOcrTools.vue`)
- **Role:** The main composite tool interface providing tabbed navigation for PDF Parsing, OCR Processing, and Document Conversion.
- **Data Flow:** Maintains an `activeTab` reactive variable. Employs `FileDropzone` for input, passes data to either `PdfOcrService` or `DocumentConversionService`, binds the `onProgress` callbacks to the `ConversionProgress` UI, and triggers `useToast` upon errors or success.
- **Analog:** Structurally mirrors `src/components/tools/FormatConverter.vue` utilizing the same "cloudy" aesthetic and Tailwind shadow/border utilities.
- **Pattern Excerpt:**
```vue
<script setup lang="ts">
import { ref } from 'vue';
import FileDropzone from '../ui/FileDropzone.vue';
import ConversionProgress from '../ui/ConversionProgress.vue';
import { useToast } from '@/composables/useToast';
import { pdfOcrService } from '@/services/pdf/PdfOcrService';

const activeTab = ref<'pdf' | 'ocr' | 'convert'>('pdf');
const progress = ref({ percentage: 0, text: '' });
const { addToast } = useToast();

const onFileSelected = async (file: File) => {
  // Service processing logic
};
</script>
```

## 6. ToolsView Mod (`src/views/ToolsView.vue`)
- **Role:** Main grid container rendering all independent tool modules.
- **Data Flow:** Injects the new `<PdfOcrTools />` component logically into the existing grid or below it.
- **Analog:** The existing layout displaying `FormatConverter` and `ExcelMerger`.
- **Pattern Excerpt:**
```vue
<script setup lang="ts">
import FormatConverter from '../components/tools/FormatConverter.vue';
import ExcelMerger from '../components/tools/ExcelMerger.vue';
import PdfOcrTools from '../components/tools/PdfOcrTools.vue';
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
    <FormatConverter />
    <ExcelMerger />
  </div>
  <div class="mt-8">
    <PdfOcrTools />
  </div>
</template>
```

## 7. App Global Injection (`src/App.vue`)
- **Role:** The highest root component encompassing the global header and footer.
- **Data Flow:** Required modification to place the `<ToastNotification />` globally so it floats appropriately across route boundaries and during deep application states.
- **Pattern Excerpt:**
```vue
<script setup lang="ts">
// ...
import ToastNotification from './components/ui/ToastNotification.vue';
</script>
<template>
  <div class="layout-container ...">
    <!-- ... -->
    <RouterView />
    <ToastNotification />
  </div>
</template>
```

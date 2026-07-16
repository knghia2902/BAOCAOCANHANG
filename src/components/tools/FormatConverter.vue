<script setup lang="ts">
import { ref } from 'vue';
import { converterService } from '@/services/excel/ConverterService';
import { excelService } from '@/services/excel/ExcelService';
import { ConversionFormat } from '@/types/excel';

const props = defineProps<{
  active?: boolean;
}>();

const selectedFile = ref<File | null>(null);
const sourceFormat = ref<ConversionFormat | null>(null);
const targetFormat = ref<ConversionFormat>(ConversionFormat.CSV);
const isLoading = ref(false);
const logs = ref<{ message: string; type: 'info' | 'success' | 'error' }[]>([]);
const isDragOver = ref(false);
const conversionResult = ref<{ data: any; filename: string; mimeType: string } | null>(null);

const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
  logs.value.push({ message, type });
};

const fileInput = ref<HTMLInputElement | null>(null);

const handleLogClick = () => {
  fileInput.value?.click();
};

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    processFile(target.files[0]);
  }
  target.value = '';
};

const handleDrop = (event: DragEvent) => {
  isDragOver.value = false;
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    processFile(event.dataTransfer.files[0]);
  }
};

const processFile = (file: File) => {
  const validation = converterService.validateFile(file);
  if (validation.isValid) {
    selectedFile.value = file;
    sourceFormat.value = validation.format as ConversionFormat;
    conversionResult.value = null;
    logs.value = [];
    addLog(`Đã nhận file: ${file.name}`, 'success');
    
    // Auto set target format to something different
    if (sourceFormat.value === ConversionFormat.EXCEL) {
      targetFormat.value = ConversionFormat.CSV;
    } else {
      targetFormat.value = ConversionFormat.EXCEL;
    }
  } else {
    addLog(validation.error || 'File không hợp lệ', 'error');
  }
};

const convertFile = async () => {
  if (!selectedFile.value || !sourceFormat.value) return;

  isLoading.value = true;
  addLog(`Đang chuyển đổi: ${sourceFormat.value} → ${targetFormat.value}...`, 'info');

  try {
    const result = await converterService.convert(selectedFile.value, {
      sourceFormat: sourceFormat.value,
      targetFormat: targetFormat.value
    });

    if (result.success && result.data) {
      addLog('Chuyển đổi thành công!', 'success');
      conversionResult.value = {
        data: result.data,
        filename: result.filename,
        mimeType: result.mimeType
      };
    } else {
      addLog(result.error || 'Có lỗi xảy ra', 'error');
    }
  } catch (error) {
    addLog(`Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
  } finally {
    isLoading.value = false;
  }
};

const download = () => {
  if (conversionResult.value) {
    excelService.downloadFile(
      conversionResult.value.data,
      conversionResult.value.filename,
      conversionResult.value.mimeType
    );
    addLog('Đã tải xuống file!', 'success');
  }
};

const reset = () => {
  selectedFile.value = null;
  sourceFormat.value = null;
  conversionResult.value = null;
  logs.value = [];
};
</script>

<template>
  <div class="bg-white rounded-cloud p-8 shadow-xl shadow-primary/5 border-2 border-soft-pink flex flex-col gap-6 relative overflow-hidden h-full">
    <!-- Icon Background -->
    <div class="absolute -right-4 -top-4 opacity-10">
      <span class="material-symbols-outlined text-9xl">swap_horiz</span>
    </div>

    <!-- Header -->
    <div class="flex items-center gap-4 relative z-10">
      <div class="size-16 bg-cute-peach rounded-puffy flex items-center justify-center text-primary">
        <span class="material-symbols-outlined text-4xl">format_list_bulleted</span>
      </div>
      <div>
        <h3 class="text-xl font-display font-bold">Format Converter</h3>
        <p class="text-sm opacity-60">Chuyển đổi Excel ↔ CSV ↔ JSON</p>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 space-y-6 relative z-10">
      
      <!-- Upload Area -->
      <div v-if="!selectedFile" 
        class="dashed-cloud rounded-[2.5rem] p-10 flex flex-col items-center justify-center gap-4 text-center cursor-pointer hover:bg-white/50 transition-all border-2 border-dashed border-primary/20"
        :class="{ 'border-primary bg-primary/5': isDragOver }"
        @dragover.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
        @drop.prevent="handleDrop"
        @click="handleLogClick"
      >
        <input type="file" ref="fileInput" class="hidden" @change="handleFileSelect" accept=".xlsx,.xls,.csv,.json" />
        <div class="size-20 bg-primary/10 rounded-full flex items-center justify-center text-primary">
          <span class="material-symbols-outlined text-5xl">upload_file</span>
        </div>
        <div>
          <p class="font-bold text-primary text-lg">Thả file vào mây nhé!</p>
          <p class="text-xs opacity-50 mt-1">Hỗ trợ .xlsx, .csv, .json (Tối đa 10MB)</p>
        </div>
      </div>

      <!-- File Active Info -->
      <div v-else class="space-y-6">
        <div class="bg-pastel-pink/30 rounded-2xl p-6 flex items-center justify-between border border-soft-pink/50">
          <div class="flex items-center gap-4">
            <div class="size-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm">
              <span class="material-symbols-outlined">{{ sourceFormat === 'xlsx' ? 'table_chart' : 'description' }}</span>
            </div>
            <div>
              <p class="font-bold text-primary truncate max-w-[150px]">{{ selectedFile.name }}</p>
              <p class="text-xs opacity-50 uppercase font-mono">{{ sourceFormat }} • {{ (selectedFile.size / 1024).toFixed(1) }} KB</p>
            </div>
          </div>
          <button @click="reset" class="size-10 rounded-full hover:bg-white flex items-center justify-center text-red-400 transition-colors">
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <!-- Format Selector -->
        <div class="grid grid-cols-1 gap-4">
          <label class="text-sm font-bold opacity-60 ml-2">Chuyển sang định dạng:</label>
          <div class="flex flex-wrap gap-2">
            <button 
              v-for="format in [ConversionFormat.EXCEL, ConversionFormat.CSV, ConversionFormat.JSON]"
              :key="format"
              @click="targetFormat = format"
              class="px-5 py-2.5 rounded-2xl text-sm font-bold transition-all border-2"
              :class="[
                targetFormat === format 
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                  : 'bg-white text-primary border-primary/10 hover:border-primary/30'
              ]"
              :disabled="format === sourceFormat"
            >
              {{ format.toUpperCase() }}
            </button>
          </div>
        </div>

        <!-- Action Button (Unified) -->
        <div>
          <button 
            v-if="!conversionResult"
            @click="convertFile" 
            class="puffy-button py-4 w-full flex items-center justify-center gap-2 group relative overflow-hidden"
            :disabled="isLoading"
          >
            <span v-if="isLoading" class="animate-spin material-symbols-outlined">progress_activity</span>
            <span v-else class="group-hover:rotate-12 transition-transform material-symbols-outlined">magic_button</span>
            <span>{{ isLoading ? 'Đang hô biến...' : 'Biến hoá ngay' }}</span>
            <span v-if="!isLoading" class="absolute right-6 opacity-40 group-hover:opacity-100 transition-opacity">✨</span>
          </button>
          
          <button 
            v-else
            @click="download" 
            class="puffy-button py-4 w-full flex items-center justify-center gap-2 group bg-gradient-to-r from-primary to-[#ff85a2] shadow-lg shadow-primary/20"
          >
            <span class="material-symbols-outlined group-hover:bounce transition-transform">download</span>
            <span>Tải file về máy ✨</span>
          </button>
        </div>
      </div>

      <!-- Result Logs -->
      <div v-if="logs.length > 0" class="mt-4 pt-4 border-t border-soft-pink/20">
        <div class="max-h-24 overflow-y-auto space-y-1 pr-2">
          <div v-for="(log, idx) in logs" :key="idx" 
            class="text-[10px] font-bold flex items-center gap-1.5"
            :class="{ 'text-green-500': log.type === 'success', 'text-red-500': log.type === 'error', 'text-primary/60': log.type === 'info' }"
          >
            <span class="material-symbols-outlined text-[12px]">{{ log.type === 'success' ? 'check_circle' : log.type === 'error' ? 'error' : 'info' }}</span>
            {{ log.message }}
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.dashed-cloud {
  background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='40' ry='40' stroke='%23C1E1C1' stroke-width='3' stroke-dasharray='10%2c 10' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
}
</style>

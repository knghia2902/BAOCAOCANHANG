<script setup lang="ts">
import { ref } from 'vue';
import { pdfOcrService } from '@/services/pdf/PdfOcrService';
import { documentConversionService } from '@/services/conversion/DocumentConversionService';
import { useToast } from '@/composables/useToast';
import { LogService } from '@/services/storage/LogService';
import FileDropzone from '@/components/ui/FileDropzone.vue';
import ConversionProgress from '@/components/ui/ConversionProgress.vue';
import type { PdfOcrResult } from '@/types/pdf';

const activeTab = ref<'pdf' | 'ocr' | 'convert'>('pdf');
const targetFormat = ref<'docx' | 'xlsx'>('docx');
const progress = ref({ text: '', percentage: 0 });
const isProcessing = ref(false);
const previewContainer = ref<HTMLElement | null>(null);

const previewResult = ref<PdfOcrResult | null>(null);
const downloadUrl = ref<string | null>(null);

const { addToast } = useToast();

const updateProgress = (msg: string, pct: number) => {
  progress.value = { text: msg, percentage: pct };
};

const clearPreview = () => {
  if (downloadUrl.value) {
    URL.revokeObjectURL(downloadUrl.value);
    downloadUrl.value = null;
  }
  previewResult.value = null;
};

const selectTab = (tab: 'pdf' | 'ocr' | 'convert') => {
  activeTab.value = tab;
  clearPreview();
};

const onFileSelected = async (file: File) => {
  isProcessing.value = true;
  progress.value = { text: 'Starting...', percentage: 0 };
  clearPreview();
  
  try {
    if (activeTab.value === 'pdf' || activeTab.value === 'ocr') {
      const result = await pdfOcrService.process(file, {
        targetFormat: targetFormat.value,
        useOcr: activeTab.value === 'ocr',
        onProgress: updateProgress
      });
      
      if (result.success && result.data) {
        const blob = new Blob([result.data], { type: result.mimeType });
        downloadUrl.value = URL.createObjectURL(blob);
        previewResult.value = result;
        addToast('File processed successfully! Preview loaded below.', 'success');
        LogService.logAction('Xử lý PDF/OCR', 'Trích xuất file: ' + file.name);
      } else {
        addToast(result.error || 'Failed to process file', 'error');
      }
    } else if (activeTab.value === 'convert') {
      if (file.name.endsWith('.docx')) {
        const result = await documentConversionService.processDocxToPreview(file, previewContainer.value!, { onProgress: updateProgress });
        if (!result.success) throw new Error(result.error);
      } else if (file.name.endsWith('.xlsx')) {
        const result = await documentConversionService.processXlsxToPreview(file, previewContainer.value!, { onProgress: updateProgress });
        if (!result.success) throw new Error(result.error);
      } else {
        throw new Error('Unsupported file format for convert');
      }
      
      const pdfResult = await documentConversionService.exportToPdf(previewContainer.value!, file.name, { onProgress: updateProgress });
      if (pdfResult.success) {
         addToast('Converted to PDF successfully!', 'success');
         LogService.logAction('Chuyển đổi PDF', 'Chuyển đổi file sang PDF');
      } else {
         throw new Error(pdfResult.error);
      }
    }
  } catch (error: any) {
    addToast(error.message || 'An error occurred', 'error');
  } finally {
    isProcessing.value = false;
  }
};
</script>

<template>
  <div class="bg-white/80 backdrop-blur-md rounded-[2rem] p-8 shadow-sm border border-primary/10">
    <div class="flex gap-4 border-b border-primary/10 pb-4 mb-6">
      <button 
        @click="selectTab('pdf')" 
        class="px-4 py-2 rounded-xl transition-colors"
        :class="activeTab === 'pdf' ? 'bg-primary/10 border border-primary font-bold text-primary' : 'hover:bg-gray-100'"
      >
        PDF Extract
      </button>
      <button 
        @click="selectTab('ocr')" 
        class="px-4 py-2 rounded-xl transition-colors"
        :class="activeTab === 'ocr' ? 'bg-primary/10 border border-primary font-bold text-primary' : 'hover:bg-gray-100'"
      >
        Image OCR
      </button>
      <button 
        @click="selectTab('convert')" 
        class="px-4 py-2 rounded-xl transition-colors"
        :class="activeTab === 'convert' ? 'bg-primary/10 border border-primary font-bold text-primary' : 'hover:bg-gray-100'"
      >
        Doc Convert
      </button>
    </div>

    <div v-if="activeTab === 'pdf' || activeTab === 'ocr'" class="mb-6 flex gap-4">
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="radio" value="docx" v-model="targetFormat" @change="clearPreview" /> Word (.docx)
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="radio" value="xlsx" v-model="targetFormat" @change="clearPreview" /> Excel (.xlsx)
      </label>
    </div>

    <FileDropzone 
      @file-selected="onFileSelected" 
      @error="addToast($event, 'error')"
      :accept="activeTab === 'pdf' ? '.pdf' : activeTab === 'ocr' ? '.pdf,.png,.jpg,.jpeg' : '.docx,.xlsx'"
    >
      <div class="size-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto">
        <span class="material-symbols-outlined text-5xl">upload_file</span>
      </div>
      <div class="mt-4">
        <p class="font-bold text-primary text-lg">Upload file</p>
        <p class="text-xs opacity-50 mt-1">Maximum 15MB</p>
      </div>
    </FileDropzone>

    <div v-if="isProcessing" class="mt-6">
      <ConversionProgress :statusText="progress.text" :percentage="progress.percentage" />
    </div>

    <!-- Preview Section -->
    <div v-if="previewResult && downloadUrl" class="mt-8 border-t border-primary/10 pt-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h4 class="text-sm font-black text-primary flex items-center gap-1.5">
          <span class="material-symbols-outlined text-lg">preview</span>
          Xem trước kết quả trích xuất
        </h4>
        
        <div class="flex items-center gap-2">
          <!-- Download Button -->
          <a 
            :href="downloadUrl" 
            :download="previewResult.filename"
            class="px-4 py-2 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
          >
            <span class="material-symbols-outlined text-sm">download</span>
            Tải xuống file ({{ targetFormat === 'xlsx' ? 'Excel' : 'Word' }})
          </a>
          <!-- Close Preview Button -->
          <button 
            @click="clearPreview"
            class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs flex items-center gap-1 transition-all"
          >
            <span class="material-symbols-outlined text-sm">close</span>
            Đóng xem trước
          </button>
        </div>
      </div>

      <!-- Preview Box -->
      <div class="bg-gray-50/50 border border-primary/10 rounded-2xl p-4 overflow-hidden max-h-[500px] flex flex-col shadow-sm">
        <!-- Excel Preview -->
        <div v-if="targetFormat === 'xlsx' && previewResult.pagesGrids && previewResult.pagesGrids.length > 0" class="overflow-auto flex-1 max-w-full select-text scrollbar-thin">
          <div v-for="(grid, pageIdx) in previewResult.pagesGrids" :key="pageIdx" class="mb-8 last:mb-0">
            <div v-if="previewResult.pagesGrids.length > 1" class="text-[10px] font-black text-primary/60 uppercase tracking-wider mb-3">
              Trang {{ pageIdx + 1 }}
            </div>
            
            <table class="border-collapse text-[11px] font-display min-w-full bg-white shadow-sm rounded-xl overflow-hidden border border-primary/5 whitespace-nowrap">
              <tbody>
                <tr 
                  v-for="(row, rowIdx) in grid" 
                  :key="rowIdx"
                  class="hover:bg-primary/5 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <td 
                    v-for="(cell, cellIdx) in row" 
                    :key="cellIdx"
                    class="px-4 py-2.5 border-r border-gray-100 last:border-r-0 whitespace-nowrap min-w-[80px]"
                    :class="[
                      rowIdx === 0 && row.length > 2 ? 'bg-gray-50 font-bold text-[#4a2c32] text-center' : 'text-[#1b0d11]/70',
                      row.length === 1 && rowIdx <= 2 ? 'text-center font-bold text-sm text-primary bg-primary/5 py-3' : ''
                    ]"
                  >
                    {{ cell }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Word Preview -->
        <div v-else-if="previewResult.pagesGrids && previewResult.pagesGrids.length > 0" class="overflow-auto flex-1 p-6 bg-white rounded-2xl border border-primary/5 text-xs text-[#1b0d11]/80 font-serif leading-relaxed select-text text-left max-w-full scrollbar-thin">
          <div v-for="(grid, pageIdx) in previewResult.pagesGrids" :key="pageIdx" class="mb-8 last:mb-0">
            <div v-if="previewResult.pagesGrids.length > 1" class="text-[9px] font-sans font-black text-primary/60 uppercase tracking-wider mb-4 border-b border-primary/10 pb-1.5">
              Trang {{ pageIdx + 1 }}
            </div>
            <div 
              v-for="(row, rowIdx) in grid" 
              :key="rowIdx"
              class="mb-3"
              :class="[
                row.length === 1 && rowIdx <= 2 ? 'text-center font-bold text-base text-primary my-5 font-sans' : '',
                row.length > 1 && rowIdx === 0 ? 'font-sans font-bold text-[#4a2c32]' : ''
              ]"
            >
              {{ row.join('   ') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div ref="previewContainer" class="hidden"></div>
  </div>
</template>

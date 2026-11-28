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
        await LogService.logAction('Xử lý PDF/OCR', 'Trích xuất file: ' + file.name);
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
         await LogService.logAction('Chuyển đổi PDF', 'Chuyển đổi file sang PDF');
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
  <div class="bg-white rounded-[2rem] p-8 shadow-sm border border-primary/5">
    <div class="border-b border-primary/10 pb-4 mb-6">
      <div class="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0 h-8 items-center w-fit gap-1">
        <button 
          @click="selectTab('pdf')" 
          class="px-3 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all flex items-center"
          :class="activeTab === 'pdf' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'"
        >
          PDF Extract
        </button>
        <button 
          @click="selectTab('ocr')" 
          class="px-3 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all flex items-center"
          :class="activeTab === 'ocr' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'"
        >
          Image OCR
        </button>
        <button 
          @click="selectTab('convert')" 
          class="px-3 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all flex items-center"
          :class="activeTab === 'convert' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'"
        >
          Doc Convert
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'pdf' || activeTab === 'ocr'" class="mb-6 flex gap-4 text-sm font-bold text-[#1e293b]">
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
        <p class="font-bold text-primary text-base">Upload file</p>
        <p class="text-xs text-slate-500 mt-1">Maximum 15MB</p>
      </div>
    </FileDropzone>

    <div v-if="isProcessing" class="mt-6">
      <ConversionProgress :statusText="progress.text" :percentage="progress.percentage" />
    </div>

    <!-- Preview Section -->
    <div v-if="previewResult && downloadUrl" class="mt-8 border-t border-primary/10 pt-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h4 class="text-xl font-display font-black text-primary flex items-center gap-1.5">
          <span class="material-symbols-outlined text-2xl">preview</span>
          Xem trước kết quả trích xuất
        </h4>
        
        <div class="flex items-center gap-2">
          <!-- Download Button (Puffy) -->
          <a 
            :href="downloadUrl" 
            :download="previewResult.filename"
            class="px-5 py-2 bg-primary text-white font-bold rounded-full text-xs shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-1.5"
          >
            <span class="material-symbols-outlined text-sm">download</span>
            Tải xuống file ({{ targetFormat === 'xlsx' ? 'Excel' : 'Word' }})
          </a>
          <!-- Close Preview Button -->
          <button 
            @click="clearPreview"
            class="px-3.5 py-2 bg-[#f1f5f9] hover:bg-slate-200 text-[#1e293b] font-bold rounded-2xl text-xs flex items-center gap-1 transition-all"
          >
            <span class="material-symbols-outlined text-sm">close</span>
            Đóng xem trước
          </button>
        </div>
      </div>

      <!-- Preview Box -->
      <div class="bg-white border border-primary/5 rounded-[24px] p-4 overflow-hidden max-h-[500px] flex flex-col shadow-sm">
        <!-- Excel Preview -->
        <div v-if="targetFormat === 'xlsx' && previewResult.pagesGrids && previewResult.pagesGrids.length > 0" class="overflow-auto scrollbar-none flex-1 max-w-full select-text">
          <div v-for="(grid, pageIdx) in previewResult.pagesGrids" :key="pageIdx" class="mb-8 last:mb-0">
            <div v-if="previewResult.pagesGrids.length > 1" class="text-xs font-display font-black text-primary/60 uppercase tracking-wider mb-3">
              Trang {{ pageIdx + 1 }}
            </div>
            
            <div class="bg-white rounded-[24px] border border-primary/5 shadow-sm overflow-hidden">
              <div class="overflow-auto scrollbar-none max-h-[400px]">
                <table class="border-collapse text-xs font-body min-w-full bg-white whitespace-nowrap">
                  <thead v-if="grid.length > 0" class="bg-gray-50 sticky top-0 z-10 border-b border-gray-100">
                    <tr>
                      <th 
                        v-for="(cell, cellIdx) in grid[0]" 
                        :key="cellIdx"
                        class="px-4 py-2.5 border-r border-gray-100 last:border-r-0 whitespace-nowrap min-w-[80px] font-bold text-[#1e293b]"
                        :class="[
                          grid[0] && grid[0].length > 2 ? 'text-center' : 'text-left',
                          grid[0] && grid[0].length === 1 ? 'text-center text-sm text-primary bg-primary/5 py-3' : ''
                        ]"
                      >
                        {{ cell }}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-50">
                    <tr 
                      v-for="(row, rowIdx) in grid.slice(1)" 
                      :key="rowIdx"
                      class="hover:bg-gray-50 transition-colors"
                    >
                      <td 
                        v-for="(cell, cellIdx) in row" 
                        :key="cellIdx"
                        class="px-4 py-2.5 border-r border-gray-100 last:border-r-0 whitespace-nowrap min-w-[80px]"
                        :class="[
                          row.length === 1 && rowIdx < 2 ? 'text-center font-bold text-sm text-primary bg-primary/5 py-3' : 'text-[#1e293b]/80'
                        ]"
                      >
                        {{ cell }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Word Preview -->
        <div v-else-if="previewResult.pagesGrids && previewResult.pagesGrids.length > 0" class="overflow-auto scrollbar-none flex-1 p-6 bg-white rounded-[24px] border border-primary/5 text-xs text-[#1e293b]/80 font-body leading-relaxed select-text text-left max-w-full">
          <div v-for="(grid, pageIdx) in previewResult.pagesGrids" :key="pageIdx" class="mb-8 last:mb-0">
            <div v-if="previewResult.pagesGrids.length > 1" class="text-xs font-body font-black text-primary/60 uppercase tracking-wider mb-4 border-b border-primary/10 pb-1.5">
              Trang {{ pageIdx + 1 }}
            </div>
            <div 
              v-for="(row, rowIdx) in grid" 
              :key="rowIdx"
              class="mb-3"
              :class="[
                row.length === 1 && rowIdx <= 2 ? 'text-center font-bold text-base text-primary my-5 font-body' : '',
                row.length > 1 && rowIdx === 0 ? 'font-body font-bold text-[#1e293b]' : ''
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

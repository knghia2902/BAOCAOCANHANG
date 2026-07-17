<!-- Perfected Excel Smart Merge Tool - Optimized for performance and formatting -->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { mergerService } from '../../services/excel/MergerService';
import { type MergeOptions, type MergeResult } from '../../types/excel';

const files = ref<File[]>([]);
const masterFileIndex = ref(0);
const matchKey = ref('');
const headers = ref<string[]>([]);
const headerRow = ref(1);
const isMerging = ref(false);
const logs = ref<string[]>([]);
const results = ref<MergeResult | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const masterFile = computed(() => files.value[masterFileIndex.value] || null);

const addLog = (msg: string) => {
    logs.value.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
};

const handleFileSelect = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files) {
        const newFiles = Array.from(target.files);
        files.value = [...files.value, ...newFiles];
        addLog(`Đã thêm ${newFiles.length} tệp tin.`);
        if (masterFile.value) {
            await extractHeaders(masterFile.value);
        }
    }
    target.value = '';
};

const extractHeaders = async (file: File) => {
    if (!file) return;
    try {
        const extracted = await mergerService.extractHeaders(file, headerRow.value);
        headers.value = extracted;
        if (extracted.length > 0 && !matchKey.value) {
            matchKey.value = extracted[0] || '';
        }
        addLog(`Đã trích xuất ${extracted.length} cột từ tệp chính.`);
    } catch (err: any) {
        addLog(`Lỗi trích xuất cột: ${err.message}`);
    }
};

const updateMasterHeader = () => {
    if (masterFile.value) {
        extractHeaders(masterFile.value);
    }
};

const removeFile = (index: number) => {
    files.value.splice(index, 1);
    if (masterFileIndex.value >= files.value.length) {
        masterFileIndex.value = Math.max(0, files.value.length - 1);
    }
    if (masterFile.value) {
        extractHeaders(masterFile.value);
    }
};

const startMerge = async () => {
    if (files.value.length < 2 || !masterFile.value) {
        addLog('Cần ít nhất 2 tệp để trộn.');
        return;
    }
    
    isMerging.value = true;
    logs.value = [];
    addLog('Bắt đầu quá trình trộn thông minh...');
    
    try {
        const options: MergeOptions = {
            masterFile: masterFile.value,
            otherFiles: files.value.filter((_, i) => i !== masterFileIndex.value),
            matchKey: matchKey.value,
            headerRow: headerRow.value,
            skipEmpty: true
        };
        
        const result = await mergerService.merge(options);
        results.value = result;
        addLog(`Trộn hoàn tất! Thành công: ${result.successCount}, Lỗi: ${result.errors.length}`);
        
        if (result.errors.length > 0) {
            result.errors.forEach(err => addLog(`⚠️ Lỗi: ${err}`));
        }
    } catch (err: any) {
        addLog(`❌ Lỗi nghiêm trọng: ${err.message}`);
    } finally {
        isMerging.value = false;
    }
};

const downloadResult = () => {
    const res = results.value;
    if (res && res.buffer) {
        mergerService.download(res.buffer, res.filename);
        addLog('Đã tải xuống tệp kết quả. ✨');
    }
};
</script>

<template>
    <div class="space-y-8 animate-fade-in">
        <!-- Header & Instructions -->
        <div class="bg-white rounded-[2.5rem] p-8 md:p-10 soft-shadow border border-primary/5 text-center relative overflow-hidden">
            <div class="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <span class="material-symbols-outlined text-[100px]">hub</span>
            </div>
            <h2 class="text-3xl font-display font-black text-primary mb-4 relative z-10">Excel Smart Merge 🧩</h2>
            <p class="text-sm font-medium text-[#1b0d11]/60 max-w-2xl mx-auto relative z-10 leading-relaxed">
                Trộn nhiều tệp Excel thành một cách thông minh mà không làm mất định dạng. 
                Bạn chỉ cần chọn một tệp gốc, hệ thống sẽ tự động gộp dữ liệu từ các tệp khác dựa trên một khóa chung (như ID hoặc Email). ✨
            </p>
        </div>

        <!-- Step 1: Upload -->
        <div class="bg-white rounded-[2.5rem] p-10 soft-shadow border border-primary/5">
            <h3 class="text-xl font-display font-bold mb-6 flex items-center gap-3">
                <span class="size-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary text-sm font-black">1</span>
                Tải tệp Excel lên
            </h3>
            
            <div class="border-4 border-dashed border-soft-pink/20 rounded-[2rem] p-12 text-center hover:border-primary/20 transition-all cursor-pointer group" @click="fileInput?.click()">
                <input type="file" ref="fileInput" class="hidden" multiple accept=".xlsx,.xls" @change="handleFileSelect" />
                <span class="material-symbols-outlined text-6xl text-primary/20 group-hover:scale-110 group-hover:text-primary/40 transition-all mb-4 block">upload_file</span>
                <p class="font-bold text-gray-400">Kéo thả hoặc nhấn để chọn các tệp Excel cần trộn</p>
                <p class="text-xs text-gray-300 mt-2">Hỗ trợ .xlsx, .xls</p>
            </div>

            <!-- File List -->
            <div v-if="files.length > 0" class="mt-8 space-y-3">
                <div v-for="(file, idx) in files" :key="idx" 
                    :class="['flex items-center justify-between p-4 rounded-2xl border transition-all', masterFileIndex === idx ? 'bg-primary/5 border-primary/20' : 'bg-gray-50 border-transparent']"
                >
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined text-primary">{{ masterFileIndex === idx ? 'stars' : 'description' }}</span>
                        <div>
                            <p class="text-sm font-bold truncate max-w-xs">{{ file.name }}</p>
                            <p class="text-xs text-gray-400 uppercase font-black tracking-widest">{{ (file.size / 1024).toFixed(1) }} KB</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button v-if="masterFileIndex !== idx" @click="masterFileIndex = idx; extractHeaders(file)" class="text-xs font-black uppercase text-primary hover:underline px-3 py-1">Đặt làm gốc</button>
                        <button @click="removeFile(idx)" class="size-8 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all">
                            <span class="material-symbols-outlined text-xl">close</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Step 2: Config -->
        <div v-if="files.length >= 2" class="bg-white rounded-[2.5rem] p-10 soft-shadow border border-primary/5">
            <h3 class="text-xl font-display font-bold mb-6 flex items-center gap-3">
                <span class="size-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary text-sm font-black">2</span>
                Cấu hình Trộn Thông Minh
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                <div class="space-y-4">
                    <label class="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Khóa trùng khớp (Match Key)</label>
                    <div class="relative">
                        <select v-model="matchKey" class="w-full bg-soft-pink/5 p-4 rounded-2xl font-bold text-sm border-none ring-1 ring-primary/10 focus:ring-primary/40 outline-none appearance-none">
                            <option v-for="h in headers" :key="h" :value="h">{{ h }}</option>
                        </select>
                        <span class="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary/30 pointer-events-none">expand_more</span>
                    </div>
                    <p class="text-xs text-gray-400 italic ml-2">* Dữ liệu sẽ được gộp dựa trên cột ID chung này.</p>
                </div>

                <div class="space-y-4">
                    <label class="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Dòng tiêu đề (Header Row)</label>
                    <input type="number" v-model="headerRow" min="1" class="w-full bg-soft-pink/5 p-4 rounded-2xl font-bold text-sm border-none ring-1 ring-primary/10 focus:ring-primary/40 outline-none" @change="updateMasterHeader" />
                    <p class="text-xs text-gray-400 italic ml-2">* Vị trí dòng chứa tên các cột (thường là 1).</p>
                </div>
            </div>

            <button @click="startMerge" :disabled="isMerging" class="w-full mt-10 bg-primary text-white py-5 rounded-2xl font-black text-base shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                <span v-if="isMerging" class="size-5 border-4 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span v-else class="material-symbols-outlined">auto_fix_high</span>
                {{ isMerging ? 'Đang thực hiện phép thuật...' : 'Bắt đầu Trộn Thông Minh ✨' }}
            </button>
        </div>

        <!-- Step 3: Result -->
        <div v-if="results || logs.length > 0" class="bg-background-dark rounded-[2.5rem] p-10 soft-shadow border border-white/5 relative overflow-hidden">
            <div class="absolute -right-20 -top-20 size-64 bg-primary/10 rounded-full blur-3xl"></div>
            
            <h3 class="text-xl font-display font-bold text-white mb-6 flex items-center justify-between relative z-10">
                Log Công việc
                <button v-if="results" @click="downloadResult" class="px-6 py-2 bg-primary text-white rounded-full text-xs font-black shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                    <span class="material-symbols-outlined text-sm">download</span> Tải tệp kết quả
                </button>
            </h3>

            <div class="bg-black/20 rounded-2xl p-6 font-mono text-xs text-gray-400 space-y-2 max-h-[300px] overflow-y-auto relative z-10 custom-scrollbar">
                <div v-for="(log, i) in logs" :key="i" class="flex gap-3">
                    <span class="text-primary/40">{{ i + 1 }}</span>
                    <span :class="log.includes('❌') ? 'text-red-400' : log.includes('⚠️') ? 'text-yellow-400' : 'text-gray-300'">{{ log }}</span>
                </div>
                <div v-if="logs.length === 0" class="text-center py-4 text-gray-600 italic">Hệ thống sẵn sàng...</div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,133,162,0.2); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,133,162,0.4); }
</style>

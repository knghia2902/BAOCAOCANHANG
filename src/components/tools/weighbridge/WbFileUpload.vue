<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
    previewCount: number;
    fileName: string;
    isDragging: boolean;
}>();

const emit = defineEmits<{
    (e: 'file-selected', file: File): void;
    (e: 'save'): void;
    (e: 'cancel'): void;
    (e: 'drag-over', event: DragEvent): void;
    (e: 'drag-leave'): void;
    (e: 'drop', event: DragEvent): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);

const triggerFileInput = () => {
    if (fileInput.value) {
        fileInput.value.click();
    }
};

const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
        const file = target.files[0];
        if (file) emit('file-selected', file);
    }
    if (fileInput.value) fileInput.value.value = '';
};

const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    emit('drag-over', e);
};

const handleDragLeave = () => {
    emit('drag-leave');
};

const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    emit('drop', e);
};
</script>

<template>
    <div class="flex flex-col gap-4">
        <!-- Drag and Drop Panel per DESIGN.md -->
        <div 
            v-if="previewCount === 0"
            @click="triggerFileInput"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
            :class="['border-2 border-dashed rounded-[24px] p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group', isDragging ? 'border-primary bg-primary/5' : 'border-primary/20 hover:border-primary bg-slate-50/50 hover:bg-primary/5']"
        >
            <input 
                type="file" 
                ref="fileInput" 
                @change="handleFileSelect" 
                accept=".xlsx,.xls,.csv" 
                class="hidden" 
            />
            <div class="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <span class="material-symbols-outlined text-2xl">cloud_upload</span>
            </div>
            <div class="text-xs font-display font-black text-slate-800">Kéo & Thả tệp Excel / CSV chứa phiếu cân vào đây</div>
            <div class="text-[11px] text-slate-500 font-semibold">hoặc click để chọn file từ máy tính. Hỗ trợ file .xlsx, .xls, .csv &lt; 20MB.</div>
        </div>

        <!-- Preview panel if loaded -->
        <div v-else class="bg-teal-50/60 border border-teal-200 rounded-[24px] p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-soft">
            <div class="flex items-center gap-3">
                <div class="size-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-xl">analytics</span>
                </div>
                <div class="text-left">
                    <div class="text-xs font-display font-black text-slate-800">Tệp đã nạp: {{ fileName }}</div>
                    <div class="text-[11px] text-slate-600 font-semibold mt-0.5">
                        Phân tích thành công <span class="text-teal-700 font-bold">{{ previewCount }}</span> phiếu cân. Dữ liệu đang ở chế độ xem trước (chưa lưu).
                    </div>
                </div>
            </div>
            
            <div class="flex items-center gap-2 shrink-0">
                <button
                    @click="$emit('save')"
                    class="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-soft flex items-center gap-1.5 transition-all active:scale-95"
                >
                    <span class="material-symbols-outlined text-sm">cloud_sync</span>
                    Lưu dữ liệu
                </button>
                <button
                    @click="$emit('cancel')"
                    class="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all active:scale-95"
                >
                    <span class="material-symbols-outlined text-sm">close</span>
                    Hủy bỏ
                </button>
            </div>
        </div>
    </div>
</template>

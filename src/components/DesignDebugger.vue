<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const isActive = ref(false);
const showGrid = ref(false);
const showOutlines = ref(false);
const isInspecting = ref(false);

const hoveredElement = ref<HTMLElement | null>(null);
const tooltipText = ref('');
const tooltipPos = ref({ x: 0, y: 0 });

// Outline inject styles
const styleTag = ref<HTMLStyleElement | null>(null);

const toggleOutlines = () => {
    showOutlines.value = !showOutlines.value;
    if (showOutlines.value) {
        if (!styleTag.value) {
            styleTag.value = document.createElement('style');
            styleTag.value.innerHTML = `
                .design-debug-outlines * {
                    outline: 1px dashed rgba(74, 120, 194, 0.4) !important;
                }
                .design-debug-outlines *:hover {
                    outline: 1px solid #4a78c2 !important;
                    background-color: rgba(74, 120, 194, 0.03) !important;
                }
            `;
            document.head.appendChild(styleTag.value);
        }
        document.body.classList.add('design-debug-outlines');
    } else {
        document.body.classList.remove('design-debug-outlines');
    }
};

const handleMouseMove = (e: MouseEvent) => {
    if (!isInspecting.value) return;

    // Find the target element under cursor (exclude debugger elements)
    const target = e.target as HTMLElement;
    if (!target || target.closest('.design-debugger-ui')) {
        hoveredElement.value = null;
        return;
    }

    hoveredElement.value = target;

    // Calculate details
    const rect = target.getBoundingClientRect();
    const style = window.getComputedStyle(target);
    
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const padding = `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`;
    const margin = `${style.marginTop} ${style.marginRight} ${style.marginBottom} ${style.marginLeft}`;
    const fontSize = style.fontSize;
    const borderRadius = style.borderRadius;

    // Extract tailwind classes
    const classes = Array.from(target.classList)
        .filter(c => !c.includes('v-') && !c.includes('data-v'))
        .slice(0, 5)
        .join(' ');

    tooltipText.value = `
        <strong>&lt;${target.tagName.toLowerCase()}&gt;</strong> ${classes ? '.' + classes.replace(/ /g, '.') : ''}<br/>
        📐 Kích thước: <strong>${w}px × ${h}px</strong><br/>
        📦 Padding: ${padding.replace(/px/g, '')}<br/>
        🚚 Margin: ${margin.replace(/px/g, '')}<br/>
        🔤 Font size: ${fontSize} | Bo góc: ${borderRadius}
    `;

    // Position tooltip
    tooltipPos.value = {
        x: e.clientX + 15,
        y: e.clientY + 15
    };
};

const handleKeyDown = (e: KeyboardEvent) => {
    // ESC to quit inspect mode
    if (e.key === 'Escape' && isInspecting.value) {
        isInspecting.value = false;
        hoveredElement.value = null;
    }
};

onMounted(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('keydown', handleKeyDown);
    if (styleTag.value) {
        styleTag.value.remove();
    }
    document.body.classList.remove('design-debug-outlines');
});
</script>

<template>
    <!-- MAIN PREVIEW CONTROLLER -->
    <div class="design-debugger-ui fixed bottom-6 right-6 z-[9999] font-display no-print">
        <!-- Collapsed button -->
        <button 
            v-if="!isActive"
            @click="isActive = true"
            class="size-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all group"
            title="Mở Thước Đo Thiết Kế"
        >
            <span class="material-symbols-outlined text-xl group-hover:rotate-45 transition-transform">straighten</span>
        </button>

        <!-- Expanded Panel (Glassmorphism style) -->
        <div 
            v-else
            class="bg-white/80 backdrop-blur-xl border border-primary/20 rounded-[2rem] p-6 shadow-2xl w-64 text-left flex flex-col gap-4 animate-fade-in relative overflow-hidden"
        >
            <div class="flex items-center justify-between border-b border-primary/10 pb-2">
                <span class="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-1.5 select-none">
                    <span class="material-symbols-outlined text-sm">straighten</span>
                    Thước Đo Tạm Thời
                </span>
                <button 
                    @click="isActive = false; isInspecting = false; hoveredElement = null"
                    class="size-6 bg-[#f1f5f9] hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full flex items-center justify-center transition-colors"
                >
                    <span class="material-symbols-outlined text-xs">close</span>
                </button>
            </div>

            <!-- Options Grid -->
            <div class="flex flex-col gap-3">
                <!-- Toggle Inspector -->
                <button 
                    @click="isInspecting = !isInspecting; hoveredElement = null"
                    :class="[
                        'w-full py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all border',
                        isInspecting 
                            ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' 
                            : 'bg-[#f1f5f9] text-[#1e293b] border-transparent hover:bg-primary/5'
                    ]"
                >
                    <span class="material-symbols-outlined text-sm">filter_center_focus</span>
                    <span>{{ isInspecting ? 'Đang soi bố cục' : 'Soi chi tiết (Hover)' }}</span>
                </button>

                <!-- Toggle Outlines -->
                <button 
                    @click="toggleOutlines"
                    :class="[
                        'w-full py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all border',
                        showOutlines 
                            ? 'bg-primary text-white border-primary shadow-md' 
                            : 'bg-[#f1f5f9] text-[#1e293b] border-transparent hover:bg-primary/5'
                    ]"
                >
                    <span class="material-symbols-outlined text-sm">grid_view</span>
                    <span>{{ showOutlines ? 'Ẩn khung viền' : 'Hiện khung viền' }}</span>
                </button>

                <!-- Toggle Columns Grid Overlay -->
                <button 
                    @click="showGrid = !showGrid"
                    :class="[
                        'w-full py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all border',
                        showGrid 
                            ? 'bg-primary text-white border-primary shadow-md' 
                            : 'bg-[#f1f5f9] text-[#1e293b] border-transparent hover:bg-primary/5'
                    ]"
                >
                    <span class="material-symbols-outlined text-sm">view_column</span>
                    <span>{{ showGrid ? 'Ẩn lưới 12 cột' : 'Hiện lưới 12 cột' }}</span>
                </button>
            </div>

            <!-- Muted guide text -->
            <div class="text-[10px] text-gray-400 font-medium border-t border-primary/5 pt-2 select-none">
                * Soi chi tiết (Hover): Di chuột vào bất cứ phần tử nào để đo đạc kích thước và khoảng cách. Bấm ESC để tắt.
            </div>
        </div>
    </div>

    <!-- 12-COLUMN GRID OVERLAY -->
    <div 
        v-if="showGrid" 
        class="fixed inset-0 pointer-events-none z-[9990] grid grid-cols-12 gap-6 w-[95%] max-w-[1200px] mx-auto px-4 md:px-6"
    >
        <div 
            v-for="i in 12" 
            :key="i" 
            class="bg-primary/5 border-x border-primary/10 h-full w-full"
        ></div>
    </div>

    <!-- HOVER TOOLTIP -->
    <div 
        v-if="isInspecting && hoveredElement"
        class="fixed z-[9999] bg-[#1e293b]/90 backdrop-blur-md text-white text-[10px] p-3 rounded-xl border border-white/10 shadow-2xl pointer-events-none leading-relaxed text-left animate-fade-in"
        :style="{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }"
        v-html="tooltipText"
    ></div>
</template>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}
</style>

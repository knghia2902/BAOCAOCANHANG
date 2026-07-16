<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import FormatConverter from '../components/tools/FormatConverter.vue';
import PdfOcrTools from '../components/tools/PdfOcrTools.vue';
import ExcelMerger from '../components/tools/ExcelMerger.vue';
import WeighbridgePrinter from '../components/tools/WeighbridgePrinter.vue';
import CargoAllocator from '../components/tools/CargoAllocator.vue';
import BargeMinutes from '../components/tools/BargeMinutes.vue';
import BargeProfileManager from '../components/tools/BargeProfileManager.vue';
import { authStore } from '../stores/auth';
import { ContentService } from '../services/ContentService';

const route = useRoute();

// Active tool and sub-views
const activeToolId = ref<string | null>(null);
const activeTab = ref<'allocator' | 'printer'>('allocator');
const allowedStaffTools = ref<string[]>([]);
const loading = ref(true);

const loadTools = async () => {
    loading.value = true;
    if (authStore.role === 'staff') {
        allowedStaffTools.value = await ContentService.loadStaffTools();
    } else {
        allowedStaffTools.value = ['converter', 'merger', 'weighbridge', 'allocator', 'vehicles', 'ocr', 'minutes'];
    }
    loading.value = false;
};

watch(() => [authStore.isAuthenticated, authStore.role], async () => {
    await loadTools();
}, { immediate: true });

onMounted(async () => {
    await loadTools();

    const toolParam = route.query.tool;
    if (typeof toolParam === 'string' && toolParam) {
        openTool(toolParam);
    } else if (authStore.role === 'staff') {
        // If staff, go directly to "Phần mềm in phiếu cân xe"
        activeToolId.value = 'weighbridge';
        activeTab.value = 'printer';
    }
});

watch(activeToolId, (newVal) => {
    const isWeighbridge = newVal === 'weighbridge';
    window.dispatchEvent(new CustomEvent('weighbridge-status', { detail: isWeighbridge }));

    if (newVal) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}, { immediate: true });

onUnmounted(() => {
    document.body.style.overflow = '';
    window.dispatchEvent(new CustomEvent('weighbridge-status', { detail: false }));
});

const allTools = [
  {
    id: 'converter',
    name: 'Chuyển Đổi Định Dạng File',
    desc: 'Hỗ trợ chuyển đổi nhanh chóng qua lại giữa các định dạng Excel (.xlsx), CSV và JSON mà không làm mất dữ liệu gốc.',
    icon: 'swap_horiz',
    bgIcon: 'bg-rose-500/10 text-rose-500',
    tags: ['Excel', 'CSV', 'JSON', 'Local Only']
  },
  {
    id: 'merger',
    name: 'Gộp Excel Thông Minh',
    desc: 'Trộn và hợp nhất nhiều tệp bảng tính dựa trên cột khóa chung, giữ nguyên định dạng của tệp chính.',
    icon: 'layers',
    bgIcon: 'bg-sky-500/10 text-sky-500',
    tags: ['Excel', 'Merge', 'Automate']
  },
  {
    id: 'weighbridge',
    name: 'Báo Cáo & In Phiếu Cân Xe 🚢',
    desc: 'Hệ thống gộp quản lý trạm cân: Phân bổ sà lan, in ấn phiếu cân A5 chuyên nghiệp và danh sách xe quản lý.',
    icon: 'print',
    bgIcon: 'bg-primary/10 text-primary',
    tags: ['Báo Cáo', 'In A5', 'Supabase Cloud', 'Phân bổ']
  },
  {
    id: 'ocr',
    name: 'Trích Xuất PDF & OCR',
    desc: 'Quét và nhận diện văn bản (OCR) từ các file ảnh và tệp PDF trực tiếp trong trình duyệt bằng Tesseract.js.',
    icon: 'document_scanner',
    bgIcon: 'bg-teal-500/10 text-teal-600',
    tags: ['PDF Quét', 'Image OCR', 'Browser Only']
  },
  {
    id: 'minutes',
    name: 'Biên Bản Sà Lan 🚢',
    desc: 'Tự động tính toán số liệu xuất kho, xá thẳng và lập bộ 4 biên bản làm hàng sà lan từ file Weight List.',
    icon: 'description',
    bgIcon: 'bg-emerald-500/10 text-emerald-600',
    tags: ['Biên bản sà lan', 'Excel', 'Offline']
  },
  {
    id: 'vehicles',
    name: 'Quản Lý Hồ Sơ Phương Tiện 🚢',
    desc: 'Quản lý thông tin kỹ thuật, giấy tờ đăng kiểm, bảo hiểm và hồ sơ thuyền trưởng, thuyền viên của các phương tiện.',
    icon: 'local_shipping',
    bgIcon: 'bg-amber-500/10 text-amber-600',
    tags: ['Phương tiện', 'Sà lan', 'Thuyền viên', 'Đăng kiểm']
  }
];

const toolsList = computed(() => {
  if (authStore.role === 'admin') {
    return allTools;
  }
  const hasWeighbridgeAccess = allowedStaffTools.value.includes('weighbridge') || allowedStaffTools.value.includes('allocator');
  return allTools.filter(t => {
      if (t.id === 'weighbridge') return hasWeighbridgeAccess;
      if (t.id === 'vehicles') return allowedStaffTools.value.includes('vehicles') || allowedStaffTools.value.includes('barge-profile');
      return allowedStaffTools.value.includes(t.id);
  });
});

const activeToolMetadata = computed(() => {
  return toolsList.value.find(t => t.id === activeToolId.value) || null;
});

const openTool = (id: string) => {
  if (id === 'weighbridge' || id === 'allocator') {
    activeToolId.value = 'weighbridge';
    activeTab.value = 'allocator';
  } else {
    activeToolId.value = id;
  }
};

const handleSidebarSwitch = (id: string) => {
  if (id === 'weighbridge' || id === 'allocator') {
    activeToolId.value = 'weighbridge';
    activeTab.value = 'allocator';
  } else {
    activeToolId.value = id;
  }
};
</script>

<template>
  <main class="flex-grow w-[95%] max-w-[1200px] mx-auto px-6 py-12 w-full font-display text-left">
    <!-- Header Section -->
    <section class="text-center mb-12 relative">
      <div class="absolute -top-10 left-1/2 -translate-x-1/2 text-primary/5 select-none pointer-events-none">
        <span class="material-symbols-outlined text-[130px]">widgets</span>
      </div>
      <h2 class="text-3xl md:text-4xl font-display font-black text-[#4a2c32] mb-3 relative z-10">Làm việc thật vui! ✨</h2>
      <p class="text-sm font-medium text-[#1b0d11]/60 max-w-xl mx-auto leading-relaxed text-center">
        Chọn một công cụ nhỏ để giúp cậu xử lý công việc nhanh hơn nhé. Mọi dữ liệu đều được bảo mật và đồng bộ an toàn!
      </p>
    </section>

    <!-- Loading screen -->
    <div v-if="loading" class="py-12 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
      <span class="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
      <span>Đang kiểm tra quyền hạn của bạn...</span>
    </div>

    <!-- Tools Catalog Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
      <div 
        v-for="tool in toolsList" 
        :key="tool.id"
        class="bg-white rounded-2xl p-6 soft-shadow border border-primary/5 flex flex-col justify-between h-full group hover:border-primary/20 hover:scale-[1.01] transition-all relative overflow-hidden"
      >
        <!-- Background Icon decoration -->
        <div class="absolute -top-6 -right-6 p-6 opacity-[0.03] group-hover:opacity-[0.07] group-hover:scale-110 transition-all pointer-events-none">
          <span class="material-symbols-outlined text-[110px] text-primary">{{ tool.icon }}</span>
        </div>

        <div>
          <!-- Tool Header -->
          <div class="flex items-center gap-3 mb-4">
            <div :class="['size-10 rounded-xl flex items-center justify-center shadow-soft', tool.bgIcon]">
              <span class="material-symbols-outlined text-lg">{{ tool.icon }}</span>
            </div>
            <h3 class="text-base font-display font-black text-[#4a2c32] group-hover:text-primary transition-colors">
              {{ tool.name }}
            </h3>
          </div>

          <!-- Tool Desc -->
          <p class="text-xs font-medium text-[#1b0d11]/60 leading-relaxed mb-6 min-h-[48px]">
            {{ tool.desc }}
          </p>

          <!-- Tool Tags -->
          <div class="flex flex-wrap gap-1.5 mb-6">
            <span 
              v-for="tag in tool.tags" 
              :key="tag" 
              class="text-[9px] font-black px-2.5 py-1 bg-gray-50 text-gray-500 rounded-full border border-gray-100"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <!-- Open Button -->
        <button 
          @click="openTool(tool.id)" 
          class="w-full py-3 bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 hover:bg-primary/5 transition-all shadow-sm"
        >
          <span class="material-symbols-outlined text-base">open_in_new</span>
          Sử dụng công cụ
        </button>
      </div>

      <!-- Placeholder card for future tools -->
      <div class="bg-white/30 rounded-2xl p-6 border border-dashed border-primary/20 flex flex-col justify-center items-center text-center h-full min-h-[220px]">
        <div class="size-11 bg-primary/5 text-primary/30 rounded-full flex items-center justify-center mb-3">
          <span class="material-symbols-outlined text-lg">add_circle</span>
        </div>
        <h3 class="text-xs font-black text-[#4a2c32]/50 mb-1">
          Nhiều công cụ khác sắp ra mắt...
        </h3>
        <p class="text-[10px] text-[#1b0d11]/40 max-w-[190px] mx-auto">
          Chúng mình đang thiết kế thêm nhiều tiện ích văn phòng miễn phí để giúp bạn làm việc thảnh thơi hơn!
        </p>
      </div>
    </div>

    <!-- Fullscreen Workspace Overlay for all tools -->
    <div 
      v-if="activeToolId && activeToolMetadata" 
      :class="[
        (activeToolId === 'weighbridge' || activeToolId === 'vehicles')
          ? 'fixed inset-0 bg-white z-[100] flex flex-col overflow-hidden no-print font-display' 
          : 'fixed inset-0 bg-cute-gradient z-[100] flex flex-col overflow-hidden no-print animate-fade-in font-display'
      ]"
    >
      
      <!-- Workspace Header bar -->
      <header class="bg-white px-6 py-2.5 border-b border-primary/10 flex items-center justify-between shadow-sm shrink-0">
        <div class="flex items-center gap-2.5">
          <div :class="['size-9 rounded-full flex items-center justify-center text-white shadow-soft', (activeToolId === 'weighbridge' || activeToolId === 'vehicles') ? 'bg-primary' : (activeToolMetadata.bgIcon.split(' ')[0] || 'bg-primary')]">
            <span class="material-symbols-outlined text-lg">{{ activeToolId === 'weighbridge' ? 'print' : activeToolMetadata.icon }}</span>
          </div>
          <div>
            <h2 class="text-sm font-black text-primary leading-tight">
              {{ activeToolId === 'weighbridge' ? 'PHẦN MỀM IN PHIẾU CÂN XE' : activeToolMetadata.name }}
            </h2>
            <p class="text-[10px] font-medium text-[#1b0d11]/60 leading-none">
              {{ (activeToolId === 'weighbridge' || activeToolId === 'vehicles') ? 'Cảng Nguyên Ngọc - Đồng bộ đám mây' : 'Công cụ tiện ích - Xử lý offline an toàn' }}
            </p>
          </div>
        </div>

        <!-- 3 Tab Main Navigation for Weighbridge App on Header -->
        <nav v-if="activeToolId === 'weighbridge'" class="flex gap-1 bg-slate-50 border border-primary/5 p-1 rounded-xl">
          <button 
            @click="activeTab = 'allocator'"
            :class="['px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5', activeTab === 'allocator' ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
          >
            <span class="material-symbols-outlined text-sm">shuffle</span>
            Báo cáo cân hàng
          </button>
          <button 
            @click="activeTab = 'printer'"
            :class="['px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5', activeTab === 'printer' ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
          >
            <span class="material-symbols-outlined text-sm">print</span>
            In Phiếu Cân Xe
          </button>
        </nav>
        
        <button 
          @click="activeToolId = null" 
          class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full text-xs flex items-center gap-1 transition-all"
        >
          <span class="material-symbols-outlined text-sm">close</span>
          Đóng
        </button>
      </header>

      <!-- Workspace Body -->
      <div class="flex-1 flex overflow-hidden">
        
        <!-- Left Sidebar: Vessel / Barge hierarchy selection for Weighbridge, standard list for other tools -->
        <aside v-if="activeToolId !== 'weighbridge' && activeToolId !== 'vehicles'" class="w-64 bg-white border-r border-primary/10 flex flex-col shrink-0">
          <div class="p-3 border-b border-primary/5 flex items-center justify-between">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-wider">
              Danh sách công cụ
            </span>
          </div>

          <div class="flex-1 overflow-y-auto p-2 space-y-1">
            <button 
              v-for="tool in toolsList" 
              :key="tool.id"
              @click="handleSidebarSwitch(tool.id)"
              :class="['w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs font-bold transition-all', activeToolId === tool.id ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
            >
              <span class="material-symbols-outlined text-sm">{{ tool.icon }}</span>
              <span class="truncate">{{ tool.name }}</span>
            </button>
          </div>

          <!-- Back to Catalog button -->
          <div class="p-3 border-t border-primary/10 bg-gray-50">
            <button 
              @click="activeToolId = null" 
              class="w-full py-2 bg-white border border-primary/20 hover:border-primary text-primary font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 hover:bg-primary/5 transition-all shadow-sm"
            >
              <span class="material-symbols-outlined text-xs">arrow_back</span>
              Về Trang Chủ
            </button>
          </div>
        </aside>

        <!-- Main Content Area -->
        <main 
          :class="[
            (activeToolId === 'weighbridge' || activeToolId === 'vehicles')
              ? 'flex-1 overflow-hidden flex flex-col bg-cute-gradient' 
              : 'flex-1 overflow-y-auto p-6 bg-cute-gradient flex flex-col items-center'
          ]"
        >
          <div 
            :class="[
              (activeToolId === 'weighbridge' || activeToolId === 'vehicles')
                ? 'w-full h-full flex flex-col overflow-hidden' 
                : 'w-full max-w-[1200px] h-full flex flex-col mx-auto'
            ]"
          >
            <FormatConverter v-if="activeToolId === 'converter'" />
            <ExcelMerger v-else-if="activeToolId === 'merger'" />
            <PdfOcrTools v-else-if="activeToolId === 'ocr'" />
            <BargeMinutes v-else-if="activeToolId === 'minutes'" />
            <BargeProfileManager v-else-if="activeToolId === 'vehicles'" />
            
            <!-- Weighbridge Unified App components -->
            <template v-else-if="activeToolId === 'weighbridge'">
              <!-- Cargo Allocator Tab -->
              <CargoAllocator 
                v-show="activeTab === 'allocator'" 
              />
              
              <!-- Weighbridge Printer Tab -->
              <WeighbridgePrinter 
                v-show="activeTab === 'printer'" 
                :hide-card="true"
              />
            </template>
          </div>
        </main>

      </div>
    </div>
  </main>
</template>

<style scoped>
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
    animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>

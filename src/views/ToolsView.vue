<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { authStore } from '../stores/auth';
import { ContentService } from '../services/ContentService';

const router = useRouter();
const route = useRoute();

const allowedStaffTools = ref<string[]>([]);
const loading = ref(true);

const loadTools = async () => {
    loading.value = true;
    if (authStore.isAuthenticated) {
        if (authStore.role === 'admin') {
            allowedStaffTools.value = ['converter', 'merger', 'weighbridge', 'allocator', 'vehicles', 'ocr', 'minutes'];
        } else {
            try {
                const rolePerms = await ContentService.loadRolePermissions();
                authStore.rolePermissions = rolePerms;
                allowedStaffTools.value = rolePerms[authStore.role || 'staff']?.tools || [];
            } catch (e) {
                console.error(e);
                allowedStaffTools.value = [];
            }
        }
    } else {
        allowedStaffTools.value = [];
    }
    loading.value = false;
};

watch(() => [authStore.isAuthenticated, authStore.role], async () => {
    await loadTools();
}, { immediate: true });

onMounted(async () => {
    await loadTools();
    
    // Check query param for legacy redirects (e.g. ?tool=weighbridge)
    const toolParam = route.query.tool;
    if (typeof toolParam === 'string' && toolParam) {
        if (['converter', 'merger', 'ocr'].includes(toolParam)) {
            router.replace({ path: '/tools/utilities', query: { tab: toolParam } });
        } else {
            router.replace(`/tools/${toolParam}`);
        }
    }
});

const allTools = [
  {
    id: 'weighbridge',
    name: 'Báo Cáo Tổng Quan 🚢',
    desc: 'Báo cáo tổng quan tiến độ làm hàng của các tàu mẹ, theo dõi danh sách sà lan và thống kê khối lượng toàn cảng.',
    icon: 'monitoring',
    bgIcon: 'bg-primary/10 text-primary',
    tags: ['Tổng quan', 'Tiến độ tàu', 'Sà lan', 'Dashboard']
  },
  {
    id: 'allocator',
    name: 'Dữ Liệu Cân Hàng 🚢',
    desc: 'Quản lý dữ liệu cân hàng, theo dõi sổ lịch sử cân và phân bổ trọng lượng xe sà lan tự động.',
    icon: 'balance',
    bgIcon: 'bg-primary/10 text-primary',
    tags: ['Dữ liệu cân', 'Phân bổ', 'Lịch sử cân', 'Excel']
  },
  {
    id: 'vehicles',
    name: 'Quản Lý Hồ Sơ Phương Tiện 🚢',
    desc: 'Quản lý thông tin kỹ thuật, giấy tờ đăng kiểm, bảo hiểm và hồ sơ thuyền trưởng, thuyền viên của các phương tiện.',
    icon: 'directions_boat',
    bgIcon: 'bg-amber-500/10 text-amber-600',
    tags: ['Hồ sơ phương tiện', 'Sà lan', 'Thuyền viên', 'Đăng kiểm']
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
    id: 'utilities',
    name: 'Bộ Công Cụ Tiện Ích Excel & PDF 🛠️',
    desc: 'Tập hợp các tiện ích văn phòng: Chuyển đổi định dạng file (XLSX, CSV, JSON), gộp bảng tính Excel và nhận diện ký tự OCR từ tệp PDF.',
    icon: 'construction',
    bgIcon: 'bg-teal-500/10 text-teal-600',
    tags: ['Excel', 'PDF OCR', 'Chuyển đổi', 'Gộp bảng tính']
  }
];

const toolsList = computed(() => {
  if (authStore.role === 'admin') {
    return allTools;
  }
  return allTools.filter(t => {
      if (t.id === 'utilities') {
          return allowedStaffTools.value.includes('converter') || 
                 allowedStaffTools.value.includes('merger') || 
                 allowedStaffTools.value.includes('ocr');
      }
      if (t.id === 'vehicles') return allowedStaffTools.value.includes('vehicles') || allowedStaffTools.value.includes('barge-profile');
      return allowedStaffTools.value.includes(t.id);
  });
});

const openTool = (id: string) => {
  router.push(`/tools/${id}`);
};
</script>

<template>
  <main class="flex-grow w-[95%] max-w-[1200px] mx-auto px-6 py-12 w-full font-display text-left">
    <!-- Header Section -->
    <section class="text-center mb-12 relative">
      <div class="absolute -top-10 left-1/2 -translate-x-1/2 text-primary/5 select-none pointer-events-none">
        <span class="material-symbols-outlined text-[130px]">widgets</span>
      </div>
      <h2 class="text-3xl md:text-4xl font-display font-black text-[#1e293b] mb-3 relative z-10">Làm việc thật vui! ✨</h2>
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
        class="bg-white rounded-2xl p-5 soft-shadow border border-primary/5 flex flex-col justify-between h-full group hover:border-primary/20 hover:scale-[1.01] transition-all relative overflow-hidden"
      >
        <!-- Background Icon decoration -->
        <div class="absolute -top-6 -right-6 p-6 opacity-[0.03] group-hover:opacity-[0.07] group-hover:scale-110 transition-all pointer-events-none">
          <span class="material-symbols-outlined text-[110px] text-primary">{{ tool.icon }}</span>
        </div>

        <div>
          <!-- Tool Header -->
          <div class="flex items-center gap-3 mb-3">
            <div :class="['size-10 rounded-xl flex items-center justify-center shadow-soft', tool.bgIcon]">
              <span class="material-symbols-outlined text-base">{{ tool.icon }}</span>
            </div>
            <h3 class="text-base font-display font-black text-[#1e293b] group-hover:text-primary transition-colors">
              {{ tool.name }}
            </h3>
          </div>

          <!-- Tool Desc -->
          <p class="text-xs font-medium text-[#1b0d11]/60 leading-relaxed mb-4 min-h-[40px]">
            {{ tool.desc }}
          </p>

          <!-- Tool Tags -->
          <div class="flex flex-wrap gap-1.5 mb-4">
            <span 
              v-for="tag in tool.tags" 
              :key="tag" 
              class="text-xs font-black px-2.5 py-1 bg-gray-50 text-gray-500 rounded-full border border-gray-100"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <!-- Open Button -->
        <button 
          @click="openTool(tool.id)" 
          class="w-full py-2.5 bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 hover:bg-primary/10 transition-all shadow-sm"
        >
          <span class="material-symbols-outlined text-base">open_in_new</span>
          Sử dụng công cụ
        </button>
      </div>

      <!-- Placeholder card for future tools -->
      <div class="bg-white/30 rounded-2xl p-6 border border-dashed border-primary/20 flex flex-col justify-center items-center text-center h-full min-h-[220px]">
        <div class="size-11 bg-primary/5 text-primary/30 rounded-full flex items-center justify-center mb-3">
          <span class="material-symbols-outlined text-base">add_circle</span>
        </div>
        <h3 class="text-xs font-black text-[#1e293b]/50 mb-1">
          Nhiều công cụ khác sắp ra mắt...
        </h3>
        <p class="text-xs text-[#1b0d11]/40 max-w-[190px] mx-auto">
          Chúng mình đang thiết kế thêm nhiều tiện ích văn phòng miễn phí để giúp bạn làm việc thảnh thơi hơn!
        </p>
      </div>
    </div>
  </main>
</template>

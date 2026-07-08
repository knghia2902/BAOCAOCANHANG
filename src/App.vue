<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'
import { onMounted } from 'vue';
import { ContentService } from './services/ContentService';
import { authStore, logout } from './stores/auth';
import ToastNotification from './components/ui/ToastNotification.vue';

const router = useRouter();

const handleHeaderLogout = () => {
    logout();
    router.push('/login');
};

onMounted(async () => {
    // Load all content from Supabase
    await ContentService.loadAll();
});
</script>

<template>
  <div class="layout-container flex h-full grow flex-col min-h-screen bg-slate-50">
    <!-- Top global bar (only if logged in) -->
    <header v-if="authStore.isAuthenticated" class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 no-print font-display">
      <div class="flex items-center gap-3">
        <div class="size-9 bg-primary rounded-full flex items-center justify-center text-white shadow-soft">
          <span class="material-symbols-outlined text-lg">print</span>
        </div>
        <div>
          <h1 class="text-sm font-black text-primary leading-tight">
            PHẦN MỀM IN & PHÂN BỔ PHIẾU CÂN
          </h1>
          <p class="text-[9px] font-bold text-gray-400 leading-none mt-0.5">
            Cảng Nguyên Ngọc - Đồng bộ đám mây
          </p>
        </div>
      </div>

      <!-- Action items -->
      <div class="flex items-center gap-4">
        <!-- Main view link -->
        <router-link 
          to="/" 
          class="text-xs font-bold text-gray-600 hover:text-primary flex items-center gap-1 transition-colors"
        >
          <span class="material-symbols-outlined text-base">home</span>
          Trang chủ
        </router-link>

        <!-- Admin Dashboard Link -->
        <router-link 
          v-if="authStore.role === 'admin'"
          to="/admin" 
          class="text-xs font-bold text-gray-600 hover:text-primary flex items-center gap-1 transition-colors"
        >
          <span class="material-symbols-outlined text-base">settings_applications</span>
          Quản trị tài khoản
        </router-link>
        
        <router-link 
          to="/change-password" 
          class="text-xs font-bold text-gray-600 hover:text-primary flex items-center gap-1 transition-colors"
        >
          <span class="material-symbols-outlined text-base">lock_reset</span>
          Đổi mật khẩu
        </router-link>

        <span class="text-xs font-bold text-gray-400">|</span>

        <!-- User info -->
        <span class="text-xs font-bold text-gray-600">
          Chào, {{ authStore.displayName }}
        </span>

        <!-- Logout -->
        <button 
          @click="handleHeaderLogout"
          class="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors border-l border-gray-200 pl-4"
        >
          <span class="material-symbols-outlined text-base">logout</span>
          Đăng xuất
        </button>
      </div>
    </header>

    <!-- Main Workspace / View Content -->
    <div class="flex-1 flex flex-col min-h-0">
      <RouterView />
    </div>

    <ToastNotification />
  </div>
</template>

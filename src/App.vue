<script setup lang="ts">
import { RouterView, useRouter, useRoute } from 'vue-router'
import { onMounted, ref, onUnmounted, watch } from 'vue';
import { ContentService } from './services/ContentService';
import { authStore, logout, updateStoreProfile } from './stores/auth';
import { authService } from './services/storage/AuthService';
import { StorageService } from './services/storage/StorageService';
import ToastNotification from './components/ui/ToastNotification.vue';

const router = useRouter();
const route = useRoute();
const showDropdown = ref(false);

const toggleDropdown = (e: Event) => {
    e.stopPropagation();
    showDropdown.value = !showDropdown.value;
};

const closeDropdown = () => {
    showDropdown.value = false;
};

const handleHeaderLogout = () => {
    logout();
    router.push('/login');
};

// Profile Edit Modal State
const showProfileModal = ref(false);
const profileForm = ref({
    displayName: '',
    avatar: ''
});
const uploadingAvatar = ref(false);

const openProfileModal = () => {
    profileForm.value = {
        displayName: authStore.displayName || '',
        avatar: authStore.avatar || ''
    };
    showProfileModal.value = true;
    closeDropdown();
};

const handleProfileAvatarUpload = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        uploadingAvatar.value = true;
        const url = await StorageService.uploadImage(target.files[0], 'avatars');
        if (url) {
            profileForm.value.avatar = url;
        }
        uploadingAvatar.value = false;
    }
};

const handleSaveProfile = async () => {
    if (!profileForm.value.displayName.trim()) {
        return;
    }
    
    const success = await authService.updateProfile(
        authStore.user || '',
        profileForm.value.displayName.trim(),
        undefined,
        profileForm.value.avatar
    );
    
    if (success) {
        updateStoreProfile(profileForm.value.displayName.trim(), profileForm.value.avatar);
        showProfileModal.value = false;
    }
};

const allowedTools = ref<string[]>([]);
const loadingTools = ref(true);

const loadTools = async () => {
    loadingTools.value = true;
    if (authStore.isAuthenticated) {
        if (authStore.role === 'admin') {
            allowedTools.value = ['converter', 'merger', 'weighbridge', 'allocator', 'vehicles', 'ocr'];
        } else {
            try {
                const rolePerms = await ContentService.loadRolePermissions();
                authStore.rolePermissions = rolePerms;
                allowedTools.value = rolePerms[authStore.role || 'staff']?.tools || [];
            } catch (e) {
                console.error(e);
                allowedTools.value = [];
            }
        }
    } else {
        allowedTools.value = [];
    }
    loadingTools.value = false;
};

watch(() => [authStore.isAuthenticated, authStore.role], async () => {
    await loadTools();
}, { immediate: true });

watch(() => route.path, (newPath) => {
    const isToolPage = newPath.startsWith('/tools/');
    (document.documentElement.style as any).zoom = isToolPage ? 0.9 : 0.8;
}, { immediate: true });

onMounted(async () => {
    // Load all content from Supabase
    await ContentService.loadAll();
    window.addEventListener('click', closeDropdown);
});

onUnmounted(() => {
    window.removeEventListener('click', closeDropdown);
});
</script>

<template>
  <div class="layout-container flex h-full grow flex-col min-h-screen font-display">
    <!-- Top global floating header (only if logged in) -->
    <header v-if="authStore.isAuthenticated" class="mx-auto mt-6 w-[95%] max-w-[1200px] flex items-center justify-between whitespace-nowrap bg-white px-8 py-4 rounded-full shadow-sm sticky top-6 z-50 border border-soft-pink no-print">
      <div class="flex items-center gap-3">
        <router-link to="/" class="size-10 bg-soft-rose rounded-full flex items-center justify-center text-white glow-primary">
          <span class="material-symbols-outlined text-2xl">magic_button</span>
        </router-link>
        <router-link to="/" class="text-xl font-display font-bold tracking-tight text-soft-rose hover:text-primary transition-colors">Cảng Nguyên Ngọc</router-link>
      </div>
      
      <nav class="hidden md:flex items-center gap-8">
        <router-link to="/" class="flex items-center gap-2 text-sm font-bold text-[#1e293b]/80 hover:text-primary transition-colors" active-class="text-primary">
            <span class="material-symbols-outlined text-lg">home</span>
            Home
        </router-link>
        <router-link v-if="allowedTools.length > 0" to="/tools" class="text-sm font-bold text-[#1e293b]/80 hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary" active-class="text-primary border-primary">Tools</router-link>
        <router-link to="/about" class="text-sm font-bold text-[#1e293b]/80 hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary" active-class="text-primary border-primary">About</router-link>
      </nav>

      <div class="flex items-center gap-3">
        <span class="text-xs font-bold text-[#1e293b]/60 hidden sm:inline">
            Chào, {{ authStore.displayName }}
        </span>
        
        <!-- Avatar Wrapper with Dropdown -->
        <div class="relative flex items-center">
          <div 
            @click="toggleDropdown($event)" 
            class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-11 border-2 border-pastel-pink cursor-pointer hover:border-primary hover:scale-105 active:scale-95 transition-all flex items-center justify-center overflow-hidden" 
            :style="{ backgroundImage: `url(${authStore.avatar || ('https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(authStore.displayName || 'User'))})` }"
            :title="`Tài khoản: ${authStore.displayName} (${authStore.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'})`"
          >
          </div>
 
          <!-- Dropdown Menu -->
          <Transition name="slide-up">
            <div 
              v-if="showDropdown" 
              @click.stop 
              class="absolute right-0 top-14 w-60 bg-white rounded-3xl shadow-xl border border-primary/10 py-3 z-50 overflow-hidden font-display flex flex-col"
            >
              <!-- User Info Header inside Dropdown -->
              <div class="px-4 py-3 border-b border-primary/5 bg-[#f1f5f9]/50 flex items-center gap-3 mb-2">
                <div 
                  class="size-9 bg-center bg-no-repeat bg-cover rounded-full border border-primary/10 shrink-0"
                  :style="{ backgroundImage: `url(${authStore.avatar || ('https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(authStore.displayName || 'User'))})` }"
                ></div>
                <div class="truncate">
                  <p class="text-xs font-black text-primary truncate leading-tight">{{ authStore.displayName }}</p>
                  <p class="text-[9px] font-black uppercase text-gray-400 mt-0.5 tracking-wider">
                    {{ authStore.role === 'admin' ? 'Quản trị viên' : 'Nhân viên' }}
                  </p>
                </div>
              </div>
 
              <!-- Mobile-only Navigation Links -->
              <div class="md:hidden flex flex-col border-b border-primary/5 pb-2 mb-2">
                <router-link 
                  to="/" 
                  @click="closeDropdown"
                  class="px-4 py-2.5 hover:bg-primary/10 text-[#1e293b]/85 font-bold text-xs flex items-center gap-2 transition-colors"
                >
                  <span class="material-symbols-outlined text-base text-primary/60">home</span>
                  Home
                </router-link>
                <router-link 
                  v-if="allowedTools.length > 0"
                  to="/tools" 
                  @click="closeDropdown"
                  class="px-4 py-2.5 hover:bg-primary/10 text-[#1e293b]/85 font-bold text-xs flex items-center gap-2 transition-colors border-t border-primary/5"
                >
                  <span class="material-symbols-outlined text-base text-primary/60">widgets</span>
                  Tools
                </router-link>
                <router-link 
                  to="/about" 
                  @click="closeDropdown"
                  class="px-4 py-2.5 hover:bg-primary/10 text-[#1e293b]/85 font-bold text-xs flex items-center gap-2 transition-colors border-t border-primary/5"
                >
                  <span class="material-symbols-outlined text-base text-primary/60">info</span>
                  About
                </router-link>
              </div>
 
              <!-- Menu Options -->
              <button 
                @click="openProfileModal"
                class="px-4 py-2.5 hover:bg-primary/10 text-[#1e293b]/85 font-bold text-xs flex items-center gap-2 transition-colors text-left"
              >
                <span class="material-symbols-outlined text-base text-primary/60">person</span>
                Chỉnh sửa hồ sơ
              </button>

              <router-link 
                to="/change-password" 
                @click="closeDropdown"
                class="px-4 py-2.5 hover:bg-primary/10 text-[#1e293b]/85 font-bold text-xs flex items-center gap-2 transition-colors border-t border-primary/5"
              >
                <span class="material-symbols-outlined text-base text-primary/60">lock_reset</span>
                Đổi mật khẩu
              </router-link>
 
              <router-link 
                v-if="authStore.role === 'admin'"
                to="/admin" 
                @click="closeDropdown"
                class="px-4 py-2.5 hover:bg-primary/10 text-[#1e293b]/85 font-bold text-xs flex items-center gap-2 transition-colors border-t border-primary/5"
              >
                <span class="material-symbols-outlined text-base text-amber-500">settings_applications</span>
                Trang quản trị (Admin)
              </router-link>
 
              <div class="h-px bg-primary/5 my-1"></div>
 
              <!-- Logout option -->
              <button 
                @click="() => { handleHeaderLogout(); closeDropdown(); }"
                class="px-4 py-2.5 hover:bg-red-50 text-red-600 font-bold text-xs flex items-center gap-2 transition-colors text-left"
              >
                <span class="material-symbols-outlined text-base">logout</span>
                Đăng xuất tài khoản
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </header>
 
    <!-- Main Workspace / View Content -->
    <div class="flex-1 flex flex-col min-h-0">
      <RouterView />
    </div>

    <!-- Edit Profile Modal -->
    <div v-if="showProfileModal" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
         <div class="bg-white w-full max-w-md rounded-[3rem] p-10 card-shadow space-y-6 animate-scale-up relative">
            <header class="flex justify-between items-center">
                <div>
                    <h3 class="text-2xl font-black text-primary">Chỉnh Sửa Hồ Sơ</h3>
                    <p class="text-[10px] font-bold text-gray-400">Cập nhật tên hiển thị và ảnh đại diện của bạn ✨</p>
                </div>
                <button @click="showProfileModal = false" class="size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400">
                     <span class="material-symbols-outlined">close</span>
                </button>
            </header>
            
            <div class="space-y-4">
                <div class="flex flex-col items-center gap-3">
                    <img :src="profileForm.avatar || ('https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(profileForm.displayName || 'User'))" class="size-24 rounded-full border-4 border-pastel-pink shadow-md object-cover" />
                    
                    <label class="px-4 py-2 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-black rounded-full cursor-pointer transition-colors">
                        Tải ảnh lên
                        <input type="file" accept="image/*" @change="handleProfileAvatarUpload" class="hidden" />
                    </label>
                    <span v-if="uploadingAvatar" class="text-[9px] font-bold text-primary animate-pulse">Đang tải lên...</span>
                </div>

                <div class="space-y-1">
                    <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Tên hiển thị</label>
                    <input v-model="profileForm.displayName" placeholder="Tên hiển thị" class="w-full bg-[#f1f5f9] p-4 rounded-2xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                </div>

                <button @click="handleSaveProfile" class="w-full py-4 bg-primary text-white rounded-[2rem] font-black shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-95 transition-all text-xs">Lưu Thay Đổi ✨</button>
            </div>
         </div>
    </div>
 
    <ToastNotification />
  </div>
</template>

<style>
/* Dropdown animation */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease-out;
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>

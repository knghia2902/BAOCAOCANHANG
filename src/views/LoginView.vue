<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login, authStore } from '../stores/auth';

const router = useRouter();
const username = ref('');
const password = ref('');
const error = ref('');
const isLoading = ref(false);

const handleLogin = async () => {
    isLoading.value = true;
    error.value = '';
    
    try {
        const success = await login(username.value, password.value);
        if (success) {
            if (authStore.role === 'admin') {
                router.push('/admin');
            } else {
                router.push('/');
            }
        } else {
            error.value = 'Tên đăng nhập hoặc mật khẩu không đúng!';
        }
    } catch (e) {
        error.value = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
    } finally {
        isLoading.value = false;
    }
};
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-background-light px-4">
        <div class="w-full max-w-md bg-white rounded-[2.5rem] p-10 soft-shadow border border-primary/5 relative overflow-hidden">
            <!-- decorative bg -->
            <div class="absolute -top-10 -right-10 text-pastel-pink/50 floating-1">
                 <span class="material-symbols-outlined text-[150px]">lock_open</span>
            </div>
            
            <div class="relative z-10 text-center mb-8">
                 <div class="size-20 bg-soft-rose rounded-full flex items-center justify-center text-white glow-primary mx-auto mb-4">
                    <span class="material-symbols-outlined text-4xl">magic_button</span>
                </div>
                <h1 class="text-3xl font-display font-bold text-primary">Đăng Nhập</h1>
                <p class="text-[#1b0d11]/50 mt-2 font-medium">Hệ thống quản lý cân hàng Cảng Nguyên Ngọc! ✨</p>
            </div>


            <form @submit.prevent="handleLogin" class="space-y-6 relative z-10">
                <div class="space-y-2 text-left">
                    <label class="font-bold text-sm ml-2 text-primary/80">Username</label>
                    <div class="relative">
                        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40">person</span>
                        <input v-model="username" type="text" class="w-full bg-background-light border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-primary/20 placeholder:font-normal" placeholder="admin" required />
                    </div>
                </div>

                 <div class="space-y-2 text-left">
                    <label class="font-bold text-sm ml-2 text-primary/80">Password</label>
                    <div class="relative">
                        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40">key</span>
                        <input v-model="password" type="password" class="w-full bg-background-light border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-primary/20 placeholder:font-normal" placeholder="••••••" required />
                    </div>
                </div>

                <div v-if="error" class="bg-red-50 text-red-500 p-4 rounded-xl text-sm font-bold flex items-center gap-2">
                    <span class="material-symbols-outlined text-base">error</span>
                    {{ error }}
                </div>

                <button :disabled="isLoading" type="submit" class="w-full bg-primary text-white font-bold py-4 rounded-full shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-base flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                    <span v-if="isLoading" class="material-symbols-outlined animate-spin">progress_activity</span>
                    <span v-else>Unlock Magic ✨</span>
                </button>
            </form>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login, loginAsDemo } from '../stores/auth';

const router = useRouter();
const username = ref('');
const password = ref('');
const error = ref('');
const isLoading = ref(false);

const handleLogin = async () => {
    isLoading.value = true;
    error.value = '';
    
    try {
        const res = await login(username.value, password.value);
        if (res.success) {
            // Mặc định luôn chuyển vào tab Home khi đăng nhập thành công
            router.push('/');
        } else {
            error.value = res.error || 'Tên đăng nhập hoặc mật khẩu không đúng!';
        }
    } catch (e) {
        error.value = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
    } finally {
        isLoading.value = false;
    }
};

const handleDemoLogin = () => {
    loginAsDemo();
    router.push('/');
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
                 <div class="size-20 bg-primary rounded-full flex items-center justify-center text-white glow-primary mx-auto mb-4">
                    <span class="material-symbols-outlined text-4xl">magic_button</span>
                </div>
                <h1 class="text-3xl font-display font-black text-primary">Đăng Nhập</h1>
                <p class="text-slate-500 mt-2 text-sm font-semibold">Hệ thống quản lý cân hàng Cảng Nguyên Ngọc! ✨</p>
            </div>


            <form @submit.prevent="handleLogin" class="space-y-5 relative z-10">
                <div class="space-y-2 text-left">
                    <label class="font-bold text-sm ml-2 text-[#1e293b]">Username</label>
                    <div class="relative">
                        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">person</span>
                        <input v-model="username" type="text" class="w-full bg-[#f1f5f9] border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-sm text-[#1e293b] focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal" placeholder="admin hoặc demo" required />
                    </div>
                </div>

                 <div class="space-y-2 text-left">
                    <label class="font-bold text-sm ml-2 text-[#1e293b]">Password</label>
                    <div class="relative">
                        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">key</span>
                        <input v-model="password" type="password" class="w-full bg-[#f1f5f9] border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-sm text-[#1e293b] focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal" placeholder="••••••" required />
                    </div>
                </div>

                <div v-if="error" class="bg-rose-50 text-rose-600 p-4 rounded-2xl text-sm font-bold flex items-center gap-2">
                    <span class="material-symbols-outlined text-base">error</span>
                    {{ error }}
                </div>

                <button :disabled="isLoading" type="submit" class="w-full bg-primary text-white font-bold py-4 rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all text-base flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer">
                    <span v-if="isLoading" class="material-symbols-outlined animate-spin">progress_activity</span>
                    <span v-else>Đăng Nhập Chính Thức ✨</span>
                </button>

                <!-- Dải phân cách -->
                <div class="relative flex py-1 items-center">
                    <div class="flex-grow border-t border-slate-200"></div>
                    <span class="flex-shrink mx-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Hoặc</span>
                    <div class="flex-grow border-t border-slate-200"></div>
                </div>

                <!-- Nút Vào Thử Nghiệm Sandbox 1-Click -->
                <button
                    type="button"
                    @click="handleDemoLogin"
                    class="w-full bg-white border border-primary/10 hover:border-primary text-primary font-bold py-3.5 rounded-2xl hover:bg-primary/5 active:scale-95 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm group"
                    title="Trải nghiệm full tính năng nhưng an toàn 100% cho dữ liệu"
                >
                    <span class="material-symbols-outlined text-lg text-primary group-hover:scale-110 transition-transform">science</span>
                    <span>Vào Chế Độ Thử Nghiệm (Demo Sandbox)</span>
                </button>
                <p class="text-xs text-center text-slate-500 font-medium leading-tight">
                    🔒 Dành cho người test: Trải nghiệm full tính năng, không ghi đè dữ liệu gốc.
                </p>
            </form>
        </div>
    </div>
</template>

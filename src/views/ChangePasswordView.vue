<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { authService } from '../services/storage/AuthService';
import { authStore } from '../stores/auth';
import { LogService } from '../services/storage/LogService';

const router = useRouter();
const newPassword = ref('');
const confirmPassword = ref('');
const error = ref('');
const success = ref(false);

const handleChangePassword = async () => {
    if (newPassword.value !== confirmPassword.value) {
        error.value = 'Mật khẩu xác nhận không khớp!';
        return;
    }
    if (newPassword.value.length < 6) {
        error.value = 'Mật khẩu phải có ít nhất 6 ký tự!';
        return;
    }

    try {
        await authService.changePassword(newPassword.value);
        authStore.isFirstLogin = false; // Update local state immediately
        success.value = true;
        await LogService.logAction('Đổi mật khẩu', 'Đổi mật khẩu lần đăng nhập đầu tiên');
        setTimeout(() => {
            if (authStore.role === 'admin') {
                router.push('/admin');
            } else {
                router.push('/');
            }
        }, 1500);
    } catch (e) {
        error.value = 'Lỗi khi đổi mật khẩu.';
    }
};
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-background-light px-4">
        <div class="w-full max-w-md bg-white rounded-[2.5rem] p-10 soft-shadow border border-primary/5 text-center">
            <div class="size-16 bg-pastel-lavender rounded-full flex items-center justify-center text-primary mx-auto mb-6 animate-bounce">
                <span class="material-symbols-outlined text-3xl">verified_user</span>
            </div>
            <h2 class="text-2xl font-bold font-display text-primary mb-2">Change Password</h2>
            <p class="text-[#1b0d11]/60 mb-8 text-sm font-medium">Vì lý do bảo mật, vui lòng đổi mật khẩu trong lần đăng nhập đầu tiên nhé!</p>

            <form v-if="!success" @submit.prevent="handleChangePassword" class="space-y-4">
                <input v-model="newPassword" type="password" class="w-full bg-background-light border-none rounded-2xl py-4 px-6 font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none" placeholder="New Password" required />
                <input v-model="confirmPassword" type="password" class="w-full bg-background-light border-none rounded-2xl py-4 px-6 font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Confirm Password" required />
                
                <div v-if="error" class="text-red-500 text-xs font-bold">{{ error }}</div>

                <button type="submit" class="w-full bg-primary text-white font-bold py-4 rounded-full hover:scale-[1.02] transition-all">
                    Update Password
                </button>
            </form>

            <div v-else class="text-green-500 font-bold flex flex-col items-center gap-2">
                <span class="material-symbols-outlined text-4xl">check_circle</span>
                <p>Đổi mật khẩu thành công! <br> Đang chuyển hướng...</p>
            </div>
        </div>
    </div>
</template>

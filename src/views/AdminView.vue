<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { logout } from '../stores/auth';
import { ContentService } from '../services/ContentService';
import { sha256 } from '../services/storage/AuthService';
import { supabase } from '../supabase';

const router = useRouter();

// UI Feedback
const toastMessage = ref('');
const showToast = ref(false);
const triggerToast = (msg: string) => {
    toastMessage.value = msg;
    showToast.value = true;
    setTimeout(() => showToast.value = false, 3000);
};

// Accounts State
const accountsList = ref<any[]>([]);
const showAccountModal = ref(false);
const showResetPasswordModal = ref(false);

const accountForm = ref({
    username: '',
    password: '',
    displayName: '',
    role: 'staff' as 'admin' | 'staff'
});

const resetPasswordForm = ref({
    username: '',
    newPassword: ''
});

const loadAccounts = async () => {
    accountsList.value = await ContentService.loadAccounts();
};

const openCreateAccountModal = () => {
    accountForm.value = {
        username: '',
        password: '',
        displayName: '',
        role: 'staff'
    };
    showAccountModal.value = true;
};

const handleCreateAccount = async () => {
    const usernameClean = accountForm.value.username.trim().toLowerCase();
    if (!usernameClean) {
        triggerToast('Tên đăng nhập không được để trống!');
        return;
    }
    if (!accountForm.value.password) {
        triggerToast('Mật khẩu không được để trống!');
        return;
    }
    const { data: currentSettings } = await supabase.from('content').select('settings').eq('id', 'main').single();
    const settings = currentSettings?.settings || {};
    const accounts = settings.accounts || [];

    const exists = accounts.some((a: any) => a.username === usernameClean);
    if (exists) {
        triggerToast('Tên đăng nhập đã tồn tại!');
        return;
    }

    const hashedPassword = await sha256(accountForm.value.password);
    accounts.push({
        username: usernameClean,
        password: hashedPassword,
        displayName: accountForm.value.displayName || accountForm.value.username,
        role: accountForm.value.role,
        isFirstLogin: true
    });

    const success = await ContentService.saveAccounts(accounts);
    if (success) {
        triggerToast('Tạo tài khoản thành công! 🎉');
        showAccountModal.value = false;
        await loadAccounts();
    } else {
        triggerToast('Có lỗi xảy ra khi lưu tài khoản.');
    }
};

const openResetPasswordModal = (acc: any) => {
    resetPasswordForm.value = {
        username: acc.username,
        newPassword: ''
    };
    showResetPasswordModal.value = true;
};

const handleResetPassword = async () => {
    if (!resetPasswordForm.value.newPassword) {
        triggerToast('Mật khẩu mới không được để trống!');
        return;
    }
    const { data: currentSettings } = await supabase.from('content').select('settings').eq('id', 'main').single();
    const settings = currentSettings?.settings || {};
    const accounts = settings.accounts || [];

    const idx = accounts.findIndex((a: any) => a.username === resetPasswordForm.value.username);
    if (idx !== -1) {
        const hashedPassword = await sha256(resetPasswordForm.value.newPassword);
        accounts[idx].password = hashedPassword;
        accounts[idx].isFirstLogin = true;

        const success = await ContentService.saveAccounts(accounts);
        if (success) {
            triggerToast('Đổi mật khẩu thành công! 🔑');
            showResetPasswordModal.value = false;
            await loadAccounts();
        } else {
            triggerToast('Có lỗi xảy ra khi lưu.');
        }
    }
};

const deleteAccount = async (username: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa tài khoản "${username}" không?`)) {
        const { data: currentSettings } = await supabase.from('content').select('settings').eq('id', 'main').single();
        const settings = currentSettings?.settings || {};
        const accounts = settings.accounts || [];

        const updated = accounts.filter((a: any) => a.username !== username);
        const success = await ContentService.saveAccounts(updated);
        if (success) {
            triggerToast('Đã xóa tài khoản! 🗑️');
            await loadAccounts();
        } else {
            triggerToast('Có lỗi xảy ra khi xóa.');
        }
    }
};

onMounted(async () => {
    await loadAccounts();
});
</script>

<template>
    <div class="min-h-screen bg-slate-50 flex font-display text-[#1b0d11] p-6 gap-6 no-print">
        <!-- Sidebar -->
        <aside class="w-72 bg-white rounded-3xl shadow-sm flex flex-col p-8 z-30 border border-gray-200 shrink-0">
            <div class="flex flex-col items-center mb-10">
                <div class="size-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <span class="material-symbols-outlined text-4xl">admin_panel_settings</span>
                </div>
                <h1 class="font-display font-black text-lg text-primary">ADMIN MODE</h1>
            </div>

            <nav class="flex-1 space-y-2">
                <button class="w-full text-left px-5 py-3 rounded-2xl font-bold bg-primary text-white shadow-lg shadow-primary/20 flex items-center gap-3">
                    <span class="material-symbols-outlined text-xl">group</span>
                    <span>Tài Khoản Staff</span>
                </button>
            </nav>

            <button @click="logout(); router.push('/login')" class="mt-auto px-5 py-3 rounded-2xl font-bold text-red-500 hover:bg-red-50 flex items-center gap-3 transition-all">
                <span class="material-symbols-outlined">logout</span> Đăng xuất
            </button>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 bg-white rounded-3xl border border-gray-200 p-10 overflow-y-auto">
            <header class="flex justify-between items-center mb-10 border-b border-gray-100 pb-6">
                <div>
                    <h2 class="text-2xl font-display font-black text-gray-800">Trang Quản Trị Hệ Thống</h2>
                    <p class="text-gray-400 font-bold text-xs mt-1">Quản lý và cấp quyền truy cập cho nhân viên vận hành.</p>
                </div>
            </header>

            <div class="space-y-8">
                 <div class="flex justify-between items-center">
                    <h3 class="text-lg font-black text-gray-800">Danh sách tài khoản nhân viên</h3>
                    <button @click="openCreateAccountModal" class="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-primary/20 hover:scale-102 active:scale-98 transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">person_add</span> Thêm Tài Khoản
                    </button>
                </div>
                
                <div class="border border-gray-100 rounded-2xl overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse text-xs font-semibold">
                            <thead>
                                <tr class="bg-gray-50 border-b border-gray-100 text-gray-400 font-black uppercase tracking-wider">
                                    <th class="py-3 px-6">Tên hiển thị</th>
                                    <th class="py-3 px-6">Tên đăng nhập</th>
                                    <th class="py-3 px-6">Vai trò</th>
                                    <th class="py-3 px-6 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100 text-[#4a2c32]/95">
                                <tr v-if="accountsList.length === 0">
                                    <td colspan="4" class="py-12 text-center text-gray-400 italic font-medium">Chưa có tài khoản phụ nào được tạo.</td>
                                </tr>
                                <tr v-for="(acc, idx) in accountsList" :key="idx" class="hover:bg-slate-50 transition-colors">
                                    <td class="py-4 px-6 font-bold text-gray-900">{{ acc.displayName }}</td>
                                    <td class="py-4 px-6 font-bold text-gray-600">{{ acc.username }}</td>
                                    <td class="py-4 px-6">
                                        <span class="px-2.5 py-0.5 text-[9px] font-black uppercase rounded-full border"
                                            :class="acc.role === 'admin' ? 'bg-red-50 text-red-500 border-red-200' : 'bg-teal-50 text-teal-600 border-teal-200'"
                                        >
                                            {{ acc.role || 'staff' }}
                                        </span>
                                    </td>
                                    <td class="py-4 px-6 text-right space-x-4">
                                        <button @click="openResetPasswordModal(acc)" class="font-bold text-primary hover:underline">Đổi mật khẩu</button>
                                        <button @click="deleteAccount(acc.username)" class="font-bold text-red-500 hover:text-red-700 hover:underline">Xóa</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>

        <!-- Create Account Modal -->
        <div v-if="showAccountModal" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div class="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl relative border border-gray-200">
                <button @click="showAccountModal = false" class="absolute top-6 right-6 size-8 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:text-primary transition-all">
                     <span class="material-symbols-outlined text-base">close</span>
                </button>
                <h3 class="text-lg font-black text-primary mb-1">Tạo Tài Khoản Mới</h3>
                <p class="text-xs font-bold text-gray-400 mb-6">Cấp tài khoản mới cho nhân viên vận hành.</p>
                
                <div class="space-y-4">
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tên Đăng Nhập</label>
                        <input v-model="accountForm.username" placeholder="Ví dụ: nhanvien01" class="bg-gray-50 p-3.5 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mật khẩu ban đầu</label>
                        <input v-model="accountForm.password" type="password" placeholder="Nhập mật khẩu" class="bg-gray-50 p-3.5 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tên Hiển Thị</label>
                        <input v-model="accountForm.displayName" placeholder="Ví dụ: Nguyễn Văn A" class="bg-gray-50 p-3.5 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Vai Trò</label>
                        <select v-model="accountForm.role" class="w-full bg-gray-50 p-3.5 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer">
                            <option value="staff">Nhân viên (Staff)</option>
                            <option value="admin">Quản trị viên (Admin)</option>
                        </select>
                    </div>
                    
                    <button @click="handleCreateAccount" class="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs mt-4 flex items-center justify-center gap-1">
                        <span class="material-symbols-outlined text-sm">person_add</span> Tạo tài khoản
                    </button>
                </div>
            </div>
        </div>

        <!-- Reset Password Modal -->
        <div v-if="showResetPasswordModal" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div class="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl relative border border-gray-200">
                <button @click="showResetPasswordModal = false" class="absolute top-6 right-6 size-8 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:text-primary transition-all">
                     <span class="material-symbols-outlined text-base">close</span>
                </button>
                <h3 class="text-lg font-black text-primary mb-1">Đổi Mật Khẩu</h3>
                <p class="text-xs font-bold text-gray-400 mb-6">Đặt lại mật khẩu cho tài khoản "{{ resetPasswordForm.username }}".</p>
                
                <div class="space-y-4">
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mật khẩu mới</label>
                        <input v-model="resetPasswordForm.newPassword" type="password" placeholder="Nhập mật khẩu mới" class="bg-gray-50 p-3.5 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    
                    <button @click="handleResetPassword" class="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs mt-4 flex items-center justify-center gap-1">
                        <span class="material-symbols-outlined text-sm">lock_reset</span> Cập nhật mật khẩu
                    </button>
                </div>
            </div>
        </div>

        <!-- Global Toast -->
        <Transition name="fade">
            <div v-if="showToast" class="fixed bottom-6 right-6 bg-gray-900 text-white px-6 py-3.5 rounded-2xl shadow-xl z-[999] flex items-center gap-2 border border-white/10 animate-slide-up text-xs font-bold font-display">
                <span class="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                {{ toastMessage }}
            </div>
        </Transition>
    </div>
</template>

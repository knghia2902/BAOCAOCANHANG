<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { contentStore } from '../stores/content';
import { authStore, logout, updateStoreProfile } from '../stores/auth';
import { ContentService } from '../services/ContentService';
import { StorageService } from '../services/storage/StorageService';
import { authService, sha256 } from '../services/storage/AuthService';
import { supabase } from '../supabase';


const router = useRouter();
const currentTab = ref('dashboard');
const showNotifications = ref(false);

// Project Data
const showProjectModal = ref(false);
const isEditingProject = ref(false);
const newProject = ref<{ id: number | null; title: string; description: string; tag: string; image: string }>({ 
    id: null, 
    title: '', 
    description: '', 
    tag: '', 
    image: '' 
});

// Toolkit Editor State
const showToolkitManager = ref(false);
const isEditingTool = ref(false);
const editingToolIndex = ref(-1);
const newTool = ref({ icon: '', label: '', tool: '' });

const handleToolSelect = (event: Event) => {
    const val = (event.target as HTMLSelectElement).value;
    if (!val) return;
    if (val === 'custom') {
        newTool.value.tool = '';
        newTool.value.icon = '';
        newTool.value.label = '';
        return;
    }
    
    newTool.value.tool = val;
    if (val === '/tools?tool=weighbridge') {
        newTool.value.icon = 'print';
        newTool.value.label = 'In Phiếu Cân Xe';
    } else if (val === '/tools?tool=merger') {
        newTool.value.icon = 'layers';
        newTool.value.label = 'Gộp Excel';
    } else if (val === '/tools?tool=converter') {
        newTool.value.icon = 'swap_horiz';
        newTool.value.label = 'Chuyển Đổi File';
    } else if (val === '/tools?tool=ocr') {
        newTool.value.icon = 'menu_book';
        newTool.value.label = 'PDF & OCR';
    }
};

// Social Links & Icon Picker
const showIconPickerFor = ref<any>(null);
const customIcons: Record<string, string> = {
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a2.7 2.7 0 0 0-2.7-2.7c-1.2 0-2.3.7-2.7 1.8v-1.5H10v7.7h3.1v-4c0-.6.5-1.1 1.1-1.1s1.1.5 1.1 1.1v4H18.5M6.7 8.3c1 0 1.8-.8 1.8-1.8s-.8-1.8-1.8-1.8-1.8.8-1.8 1.8.8 1.8 1.8 1.8m1.5 10.2V10.3H5.2v8.2h3z"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z"/></svg>'
};

const getIconHtml = (iconName: string) => customIcons[iconName] || null;

// Notification Helpers
const unreadCount = computed(() => contentStore.messages.filter(m => !m.isRead).length);
const markAsRead = async (id: any) => {
    const msg = contentStore.messages.find(m => m.id === id);
    if (msg && !msg.isRead) {
        msg.isRead = true;
        await ContentService.markMessageAsRead(id);
    }
};

// Image Drag & Upload
const projectInput = ref<HTMLInputElement | null>(null);
const heroInput = ref<HTMLInputElement | null>(null);

const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });

const getX = (e: MouseEvent | TouchEvent) => ('touches' in e && e.touches.length > 0) ? e.touches[0]!.clientX : (e as MouseEvent).clientX;
const getY = (e: MouseEvent | TouchEvent) => ('touches' in e && e.touches.length > 0) ? e.touches[0]!.clientY : (e as MouseEvent).clientY;

const startDrag = (e: MouseEvent | TouchEvent) => {
    isDragging.value = true;
    dragStart.value = { x: getX(e), y: getY(e) };
};

const onDrag = (e: MouseEvent | TouchEvent) => {
    if (!isDragging.value) return;
    const clientX = getX(e);
    const clientY = getY(e);
    const dx = (clientX - dragStart.value.x) / 5;
    const dy = (clientY - dragStart.value.y) / 5;
    contentStore.hero.position.x = Math.max(0, Math.min(100, contentStore.hero.position.x + dx));
    contentStore.hero.position.y = Math.max(0, Math.min(100, contentStore.hero.position.y + dy));
    dragStart.value = { x: clientX, y: clientY };
};
const stopDrag = () => isDragging.value = false;

// Actions
const saveAll = async () => {
    await ContentService.saveAll();
    triggerToast('All changes saved to cloud! ✨');
};

const triggerHeroImageUpload = () => heroInput.value?.click();
const handleHeroImageUpload = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        triggerToast('Uploading image... ⏳');
        const url = await StorageService.uploadImage(target.files[0], 'hero');
        if (url) {
            const currentUser = authStore.user;
            if (currentUser) {
                await authService.updateProfile(currentUser, authStore.displayName || '', undefined, url);
                updateStoreProfile(authStore.displayName || '', url);
            }
            
            const { data: currentSettings } = await supabase.from('content').select('settings').eq('id', 'main').single();
            const settings = currentSettings?.settings || {};
            if (currentUser === settings.username) {
                contentStore.hero.image = url;
                contentStore.hero.avatar = url;
                await ContentService.saveAll();
            }
            
            triggerToast('Profile image updated successfully! ✨');
        }
    }
    target.value = '';
};

// Consolidated Image Management via handleHeroImageUpload per user request
// @ts-ignore
window.handleHeroImageUpload = handleHeroImageUpload;

// Toolkit CRUD
const addTool = async () => {
    if (newTool.value.label && newTool.value.icon) {
        if (isEditingTool.value && editingToolIndex.value !== -1) {
            const tool = contentStore.toolkit[editingToolIndex.value];
            if (tool) {
                await ContentService.removeTool(tool.label);
                await ContentService.addTool({ ...newTool.value });
                contentStore.toolkit[editingToolIndex.value] = { ...newTool.value };
            }
        } else {
            await ContentService.addTool({ ...newTool.value });
            contentStore.toolkit.push({ ...newTool.value });
        }
        newTool.value = { icon: '', label: '', tool: '' };
        isEditingTool.value = false;
        editingToolIndex.value = -1;
        triggerToast('Toolkit updated!');
    }
};

const editTool = (idx: number) => {
    const tool = contentStore.toolkit[idx];
    if (tool) {
        newTool.value = { 
            icon: tool.icon, 
            label: tool.label, 
            tool: tool.tool || '' 
        };
        isEditingTool.value = true;
        editingToolIndex.value = idx;
    }
};

const cancelEditTool = () => {
    newTool.value = { icon: '', label: '', tool: '' };
    isEditingTool.value = false;
    editingToolIndex.value = -1;
};

const removeTool = async (idx: number) => {
    const tool = contentStore.toolkit[idx];
    if (tool) {
        await ContentService.removeTool(tool.label);
        contentStore.toolkit.splice(idx, 1);
        triggerToast('Tool removed!');
    }
};

// Project CRUD
const triggerProjectImageUpload = () => projectInput.value?.click();
const handleProjectImageUpload = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files?.[0]) {
        const url = await StorageService.uploadImage(target.files[0], 'projects');
        if (url) newProject.value.image = url;
    }
    target.value = '';
};
const addProject = async () => {
    if (!newProject.value.title) return;
    if (isEditingProject.value && newProject.value.id) {
        await ContentService.updateProject({ ...newProject.value });
        const idx = contentStore.projects.findIndex((p: any) => p.id === newProject.value.id);
        if (idx !== -1) contentStore.projects[idx] = { ...newProject.value } as any;
    } else {
        const { id, ...payload } = newProject.value;
        const created = await ContentService.addProject(payload);
        if (created) contentStore.projects.unshift(created);
    }
    showProjectModal.value = false;
    newProject.value = { id: null, title: '', description: '', tag: '', image: '' };
};

const deleteProject = async (idx: number) => {
    if (confirm('Delete project?')) {
        const p = contentStore.projects[idx];
        if (p) {
            await ContentService.deleteProject(p.title);
            contentStore.projects.splice(idx, 1);
        }
    }
};

const deleteMessage = async (id: any) => {
    if (confirm('Delete message?')) {
        const idx = contentStore.messages.findIndex(m => m.id === id);
        if (idx !== -1) contentStore.messages.splice(idx, 1);
    }
};

// Social Links
const addSocialLink = () => {
    contentStore.about.social.push({ id: Date.now(), platform: 'New', url: '', icon: 'link', isSvg: false });
};

const iconPresets = [
    { name: 'facebook', icon: 'facebook', isSvg: true },
    { name: 'instagram', icon: 'instagram', isSvg: true },
    { name: 'linkedin', icon: 'linkedin', isSvg: true },
    { name: 'github', icon: 'github', isSvg: true },
    { name: 'tiktok', icon: 'tiktok', isSvg: true },
    { name: 'globe', icon: 'language', isSvg: false },
    { name: 'mail', icon: 'mail', isSvg: false }
];

const selectIcon = (iconName: string, isSvg: boolean) => {
    if (showIconPickerFor.value) {
        showIconPickerFor.value.icon = iconName;
        showIconPickerFor.value.isSvg = isSvg;
        showIconPickerFor.value = null;
    }
};

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
const showEditAccountModal = ref(false);
const showResetPasswordModal = ref(false);

const accountForm = ref({
    username: '',
    password: '',
    displayName: '',
    role: 'staff' as 'admin' | 'staff',
    avatar: ''
});

const editAccountForm = ref({
    username: '',
    displayName: '',
    role: 'staff' as 'admin' | 'staff',
    avatar: ''
});

const resetPasswordForm = ref({
    username: '',
    newPassword: ''
});

const loadAccounts = async () => {
    accountsList.value = await ContentService.loadAccounts();
};

const handleAccountAvatarUpload = async (e: Event, isEdit: boolean) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        triggerToast('Đang tải ảnh đại diện lên... ⏳');
        const url = await StorageService.uploadImage(target.files[0], 'avatars');
        if (url) {
            if (isEdit) {
                editAccountForm.value.avatar = url;
            } else {
                accountForm.value.avatar = url;
            }
            triggerToast('Ảnh đại diện đã được tải lên! ✨');
        } else {
            triggerToast('Tải ảnh thất bại.');
        }
    }
};

const openCreateAccountModal = () => {
    accountForm.value = {
        username: '',
        password: '',
        displayName: '',
        role: 'staff',
        avatar: ''
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
    
    if (usernameClean === settings.username) {
        triggerToast('Trùng với tên đăng nhập của Admin chính!');
        return;
    }
    
    const exists = accountsList.value.some(acc => acc.username === usernameClean);
    if (exists) {
        triggerToast('Tên đăng nhập này đã tồn tại!');
        return;
    }
    
    const passwordHash = await sha256(accountForm.value.password);
    
    // Set a unique default initials avatar if empty
    const avatarUrl = accountForm.value.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(accountForm.value.displayName.trim() || usernameClean)}`;
    
    const newAcc = {
        username: usernameClean,
        password: passwordHash,
        displayName: accountForm.value.displayName.trim() || usernameClean,
        role: accountForm.value.role,
        avatar: avatarUrl
    };
    
    const updatedAccounts = [...accountsList.value, newAcc];
    const success = await ContentService.saveAccounts(updatedAccounts);
    if (success) {
        accountsList.value = updatedAccounts;
        showAccountModal.value = false;
        triggerToast('Tạo tài khoản thành công! ✨');
    } else {
        triggerToast('Có lỗi xảy ra khi lưu tài khoản.');
    }
};

const openEditAccountModal = (account: any) => {
    editAccountForm.value = {
        username: account.username,
        displayName: account.displayName,
        role: account.role || 'staff',
        avatar: account.avatar || ''
    };
    showEditAccountModal.value = true;
};

const handleEditAccount = async () => {
    if (!editAccountForm.value.displayName.trim()) {
        triggerToast('Tên hiển thị không được để trống!');
        return;
    }
    
    const avatarUrl = editAccountForm.value.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(editAccountForm.value.displayName.trim())}`;
    
    const updatedAccounts = accountsList.value.map(acc => {
        if (acc.username === editAccountForm.value.username) {
            return {
                ...acc,
                displayName: editAccountForm.value.displayName.trim(),
                role: editAccountForm.value.role,
                avatar: avatarUrl
            };
        }
        return acc;
    });
    
    const success = await ContentService.saveAccounts(updatedAccounts);
    if (success) {
        accountsList.value = updatedAccounts;
        showEditAccountModal.value = false;
        triggerToast('Cập nhật tài khoản thành công! ✨');
    } else {
        triggerToast('Có lỗi xảy ra khi lưu tài khoản.');
    }
};

const deleteAccount = async (username: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa tài khoản "${username}"?`)) {
        const updatedAccounts = accountsList.value.filter(acc => acc.username !== username);
        const success = await ContentService.saveAccounts(updatedAccounts);
        if (success) {
            accountsList.value = updatedAccounts;
            triggerToast('Xóa tài khoản thành công! 🗑️');
        } else {
            triggerToast('Có lỗi xảy ra khi xóa tài khoản.');
        }
    }
};

const openResetPasswordModal = (account: any) => {
    resetPasswordForm.value = {
        username: account.username,
        newPassword: ''
    };
    showResetPasswordModal.value = true;
};

const handleResetPassword = async () => {
    if (!resetPasswordForm.value.newPassword) {
        triggerToast('Mật khẩu mới không được để trống!');
        return;
    }
    
    const passwordHash = await sha256(resetPasswordForm.value.newPassword);
    const updatedAccounts = accountsList.value.map(acc => {
        if (acc.username === resetPasswordForm.value.username) {
            return {
                ...acc,
                password: passwordHash
            };
        }
        return acc;
    });
    
    const success = await ContentService.saveAccounts(updatedAccounts);
    if (success) {
        accountsList.value = updatedAccounts;
        showResetPasswordModal.value = false;
        triggerToast('Đặt lại mật khẩu thành công! ✨');
    } else {
        triggerToast('Có lỗi xảy ra khi đặt lại mật khẩu.');
    }
};

const allTools = [
  { id: 'converter', name: 'Chuyển Đổi Định Dạng File' },
  { id: 'merger', name: 'Gộp Excel Thông Minh' },
  { id: 'weighbridge', name: 'In Phiếu Cân Xe 🚢' },
  { id: 'allocator', name: 'Báo cáo cân hàng 🚛' },
  { id: 'vehicles', name: 'Hồ sơ phương tiện sà lan 🚢' },
  { id: 'ocr', name: 'Trích Xuất PDF & OCR' }
];

const staffToolsConfig = ref<string[]>([]);

const loadStaffToolsConfig = async () => {
    staffToolsConfig.value = await ContentService.loadStaffTools();
};

const handleSaveStaffTools = async () => {
    const success = await ContentService.saveStaffTools(staffToolsConfig.value);
    if (success) {
        triggerToast('Cập nhật phân quyền hiển thị công cụ thành công! 🛠️');
    } else {
        triggerToast('Có lỗi xảy ra khi lưu cấu hình.');
    }
};

onMounted(async () => {
    await ContentService.loadAll();
    await loadAccounts();
    await loadStaffToolsConfig();
});
</script>



<template>
    <div class="min-h-screen bg-[#FDF2F5] flex flex-col lg:flex-row font-display text-[#1b0d11] p-4 lg:p-6 gap-4 lg:gap-6">
        <!-- Top Navigation (Mobile Only) -->
        <div class="flex lg:hidden flex-col gap-3 bg-white rounded-[2rem] p-4 shadow-md border border-white/50 shrink-0">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <img :src="authStore.avatar || ('https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(authStore.displayName || 'User'))" class="size-10 rounded-full border border-soft-pink object-cover" />
                    <div class="text-left">
                        <h2 class="text-sm font-black text-primary leading-tight">{{ authStore.displayName }}</h2>
                        <span class="text-[8px] font-black uppercase text-gray-400 tracking-wider">ADMIN MODE</span>
                    </div>
                </div>
                <button @click="logout(); router.push('/login')" class="px-3 py-1.5 rounded-xl font-bold text-xs text-red-500 hover:bg-red-50 flex items-center gap-1.5 transition-all">
                    <span class="material-symbols-outlined text-sm">logout</span> Đăng xuất
                </button>
            </div>
            <div class="h-px bg-gray-100 my-0.5"></div>
            <div class="flex overflow-x-auto gap-2 scrollbar-none whitespace-nowrap pb-0.5">
                <button v-for="tab in ['dashboard', 'about', 'messages', 'accounts']" :key="tab"
                    @click="currentTab = tab"
                    :class="['px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shrink-0', currentTab === tab ? 'bg-primary text-white border-primary shadow-soft' : 'bg-slate-50 text-gray-500 border-gray-150']"
                >
                    <span class="material-symbols-outlined text-sm">
                        {{ tab === 'dashboard' ? 'grid_view' : tab === 'about' ? 'person' : tab === 'messages' ? 'mail' : 'group' }}
                    </span>
                    <span>
                        {{ tab === 'dashboard' ? 'Dashboard' : tab === 'about' ? 'About Me' : tab === 'messages' ? 'Messages' : 'Admin' }}
                    </span>
                </button>
            </div>
        </div>

        <!-- Sidebar (Desktop Only) -->
        <aside class="hidden lg:flex w-72 bg-white rounded-[3rem] shadow-xl flex-col p-8 z-30 border border-white/50 relative overflow-hidden shrink-0">
            <div class="flex flex-col items-center mb-12">
                <div class="relative mb-4 group">
                    <img :src="authStore.avatar || ('https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(authStore.displayName || 'User'))" class="size-24 rounded-full border-4 border-white shadow-xl object-cover transition-transform" />
                    <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white px-4 py-1.5 rounded-full border border-soft-pink shadow-[0_5px_15px_-5px_rgba(255,133,162,0.4)] animate-bounce-short whitespace-nowrap z-10">
                        <span class="text-[10px] font-black text-primary uppercase tracking-widest">ADMIN MODE</span>
                    </div>
                </div>
                <h1 class="font-display font-black text-xl text-primary">{{ authStore.displayName }}</h1>
            </div>

            <nav class="flex-1 space-y-2">
                <button v-for="tab in ['dashboard', 'about', 'messages', 'accounts']" :key="tab"
                    @click="currentTab = tab"
                    :class="['w-full text-left px-5 py-3 rounded-2xl font-bold transition-all flex items-center gap-3', currentTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:bg-soft-pink/10 hover:text-primary']"
                >
                    <span class="material-symbols-outlined text-xl">
                        {{ tab === 'dashboard' ? 'grid_view' : tab === 'about' ? 'person' : tab === 'messages' ? 'mail' : 'group' }}
                    </span>
                    <span class="capitalize">
                        {{ tab === 'about' ? 'About Me' : tab === 'accounts' ? 'Admin' : tab }}
                    </span>
                </button>
            </nav>


            <button @click="logout(); router.push('/login')" class="mt-auto px-5 py-3 rounded-2xl font-bold text-red-300 hover:bg-red-50 flex items-center gap-3 transition-all">
                <span class="material-symbols-outlined">logout</span> Logout
            </button>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 p-2 lg:p-10 overflow-y-auto min-w-0">
            <header class="flex flex-col sm:flex-row justify-between sm:items-center mb-6 lg:mb-10 gap-4">
                <div class="text-left">
                    <h2 class="text-2xl lg:text-3xl font-display font-black">Welcome back, Admin!</h2>
                    <p class="text-gray-400 font-medium">Ready to sprinkle some more magic today? ✨</p>
                </div>

                <div class="flex items-center gap-4">
                    <div class="relative">
                        <button @click="showNotifications = !showNotifications" class="size-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100 relative group">
                            <span class="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors">notifications</span>
                            <div v-if="unreadCount > 0" class="absolute -top-1 -right-1 size-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">{{ unreadCount }}</div>
                        </button>
                        
                        <!-- Notifications Popup -->
                        <div v-if="showNotifications" class="absolute right-0 mt-4 w-80 bg-white rounded-2xl shadow-2xl p-6 z-50 border border-gray-100 animate-fade-in">
                            <h3 class="font-black mb-4 text-sm">Notifications</h3>
                            <div class="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                                <div v-if="contentStore.messages.length === 0" class="text-center py-8 text-gray-400 italic text-xs">No magic letters yet...</div>
                                <div v-for="msg in contentStore.messages.slice().reverse()" :key="msg.id" 
                                    @click="markAsRead(msg.id); currentTab = 'messages'; showNotifications = false"
                                    class="p-4 rounded-2xl cursor-pointer hover:bg-soft-pink/5 transition-colors border"
                                    :class="msg.isRead ? 'bg-gray-50 border-transparent opacity-60' : 'bg-white border-primary/10'"
                                >
                                    <div class="flex items-center gap-2 mb-1">
                                        <div class="size-2 rounded-full" :class="msg.isRead ? 'bg-gray-300' : 'bg-primary shadow-[0_0_5px_rgba(255,133,162,0.5)]'"></div>
                                        <p class="text-[10px] font-black text-primary">{{ msg.name }}</p>
                                    </div>
                                    <p class="text-[10px] text-gray-500 line-clamp-2">{{ msg.content }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button @click="triggerToast('Magic settings are spinning... ✨')" class="size-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100 group">
                        <span class="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors">settings</span>
                    </button>
                </div>
            </header>

            <!-- Dashboard Content -->
            <div v-if="currentTab === 'dashboard'" class="grid grid-cols-12 gap-6 lg:gap-8">
                <!-- Left Column -->
                <div class="col-span-12 lg:col-span-8 flex flex-col">
                    <!-- Edit Content Card -->
                    <div class="bg-white rounded-[2.5rem] p-6 lg:p-10 card-shadow border border-white/50 relative overflow-hidden flex-1">
                        <div class="flex items-center justify-between mb-8">
                            <h3 class="text-lg font-black flex items-center gap-3">
                                <span class="material-symbols-outlined text-primary">home</span> Edit 'Trang chủ' Content
                            </h3>
                            <button @click="saveAll" class="bg-primary text-white px-8 py-2 rounded-full font-black text-sm shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">Save</button>
                        </div>
                        <div class="space-y-6">
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Hero Title</label>
                                <input v-model="contentStore.hero.title" class="w-full bg-[#fcf8f9] p-5 rounded-2xl font-bold text-sm border-none outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Hero Subtitle</label>
                                <textarea v-model="contentStore.hero.subtitle" class="w-full bg-[#fcf8f9] p-5 rounded-2xl font-medium text-sm border-none h-32 resize-none outline-none leading-relaxed focus:ring-2 focus:ring-primary/20"></textarea>
                            </div>
                            <div class="grid grid-cols-2 gap-6">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Button 1</label>
                                    <input v-model="contentStore.hero.primaryButton" class="w-full bg-[#fcf8f9] p-5 rounded-2xl font-bold text-sm border-none outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Button 2</label>
                                    <input v-model="contentStore.hero.secondaryButton" class="w-full bg-[#fcf8f9] p-5 rounded-2xl font-bold text-sm border-none outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="col-span-12 lg:col-span-4 space-y-6 lg:space-y-8">
                    <!-- Stats -->
                    <div class="bg-white rounded-[2.5rem] p-8 card-shadow text-center">
                        <p class="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Portfolio Visitors</p>
                        <h4 class="text-6xl font-black text-primary">{{ contentStore.stats.visitors }}</h4>
                        <p class="text-[10px] font-bold text-gray-300 mt-2">All time views</p>
                    </div>

                    <!-- Image Preview -->
                    <div class="bg-white rounded-[2.5rem] p-8 card-shadow space-y-4 border-2 border-dashed border-primary/20">
                        <h3 class="text-sm font-black text-gray-400 uppercase tracking-widest text-center">Master Profile Image</h3>
                        <div class="flex justify-center p-2">
                             <div class="size-52 blob-shape border-4 border-white shadow-2xl relative overflow-hidden cursor-crosshair group transition-all duration-300"
                                  :style="{ backgroundImage: `url(${authStore.avatar || ('https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(authStore.displayName || 'User'))})`, backgroundPosition: `${contentStore.hero.position.x}% ${contentStore.hero.position.y}%`, backgroundSize: 'cover' }"
                                  @mousedown="startDrag" @touchstart="startDrag" @mousemove="onDrag" @touchmove="onDrag" @mouseup="stopDrag" @touchend="stopDrag">
                                 <div class="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                     <span class="material-symbols-outlined text-white text-3xl">open_with</span>
                                 </div>
                             </div>
                        </div>
                        <button @click="triggerHeroImageUpload" class="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">Change Everywhere</button>
                        <input type="file" ref="heroInput" class="hidden" accept="image/*" @change="handleHeroImageUpload" />
                    </div>
                </div>
            </div>

            <!-- Bottom Dashboard Row (Perfectly Aligned) -->
            <div v-if="currentTab === 'dashboard'" class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch pb-8">
                <!-- Visibility -->
                <div class="bg-white rounded-[2.5rem] p-10 card-shadow border border-white/50 flex flex-col h-full">
                    <h3 class="text-xl font-display font-black mb-8 flex items-center gap-3">
                        <span class="material-symbols-outlined text-primary">visibility</span>
                        Visibility
                    </h3>
                    <div class="grid grid-cols-2 gap-x-8 gap-y-6 flex-1">
                        <div v-for="key in Object.keys(contentStore.visibility)" :key="key" class="flex items-center justify-between group">
                            <span class="text-sm font-bold text-gray-400 group-hover:text-primary transition-colors capitalize">{{ key }}</span>
                            <label class="relative inline-flex items-center cursor-pointer scale-90">
                                <input type="checkbox" v-model="(contentStore.visibility as any)[key]" class="sr-only peer">
                                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Toolkit -->
                <div class="bg-white rounded-[2.5rem] p-10 card-shadow border border-white/50 flex flex-col h-full">
                    <div class="flex justify-between items-center mb-8">
                        <h3 class="text-xl font-display font-black flex items-center gap-3">
                            <span class="material-symbols-outlined text-primary">magic_button</span>
                            Toolkit
                        </h3>
                        <button @click="showToolkitManager = true" class="text-[10px] font-black text-primary hover:underline uppercase tracking-widest">Edit</button>
                    </div>
                    <div class="flex-1 flex items-center justify-center">
                        <div class="flex flex-wrap justify-center gap-4">
                            <div v-for="skill in contentStore.toolkit.slice(0, 4)" :key="skill.label" class="flex flex-col items-center gap-2 group">
                                <div class="size-12 bg-soft-pink/10 rounded-full flex items-center justify-center group-hover:bg-primary/10 transition-colors shadow-sm">
                                    <span class="material-symbols-outlined text-primary text-xl">{{ skill.icon }}</span>
                                </div>
                                <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">{{ skill.label }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tip -->
                <div class="bg-[#FFFCE8] rounded-[2.5rem] p-10 border border-[#FFF5AD] relative overflow-hidden group h-full flex flex-col">
                    <div class="relative z-10 flex flex-col h-full">
                        <div class="flex items-center gap-4 mb-6">
                            <div class="size-12 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-200">
                                <span class="material-symbols-outlined text-white">lightbulb</span>
                            </div>
                            <h4 class="font-black text-yellow-700 text-lg uppercase tracking-widest">Quick Tip</h4>
                        </div>
                        <p class="text-xs leading-relaxed text-yellow-900/60 font-medium flex-1">
                            Drag the image box above to adjust pixel-perfect centering for the homepage circle frame. Changes here will sync instantly to your Navbar and Sidebar! ✨
                        </p>
                        <div class="mt-4 pt-4 border-t border-yellow-200/50">
                            <p class="text-[10px] font-black text-yellow-600/50 uppercase tracking-widest line-clamp-1">Pro Tip: Use high-res portraits</p>
                        </div>
                    </div>
                    <!-- Decorative Icon -->
                    <span class="material-symbols-outlined absolute -bottom-8 -right-8 text-9xl text-yellow-600/5 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">auto_awesome</span>
                </div>
            </div>

            <!-- Other Tabs -->
            <div v-else-if="currentTab === 'projects'" class="space-y-8 max-w-5xl mx-auto">
                 <div class="flex justify-between items-center">
                    <h3 class="text-2xl font-black text-primary">Managed Projects</h3>
                    <button @click="showProjectModal = true; isEditingProject = false" class="bg-primary text-white px-8 py-3 rounded-full font-black text-sm shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                        <span class="material-symbols-outlined">add</span> New Project
                    </button>
                </div>
                <div class="grid grid-cols-2 gap-6">
                    <div v-for="(p, idx) in contentStore.projects" :key="idx" class="bg-white p-6 rounded-[3rem] card-shadow border border-white/40 flex gap-6 group hover:border-primary/20 transition-all">
                        <div class="size-28 rounded-[2rem] bg-cover bg-center shrink-0 border border-gray-100 shadow-sm" :style="{ backgroundImage: `url(${p.image})` }"></div>
                        <div class="flex-1 flex flex-col justify-between py-1">
                             <div>
                                <h4 class="font-black text-xl text-primary truncate">{{ p.title }}</h4>
                                <span class="px-4 py-1 bg-soft-pink/10 text-primary text-[8px] font-black uppercase rounded-full mt-2 inline-block">{{ p.tag }}</span>
                             </div>
                             <div class="flex gap-4">
                                <button @click="isEditingProject = true; newProject = { ...p }; showProjectModal = true" class="text-[11px] font-black text-gray-400 hover:text-primary transition-colors">Edit Details</button>
                                <button @click="deleteProject(idx)" class="text-[11px] font-black text-red-200 hover:text-red-500 transition-colors">Delete</button>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else-if="currentTab === 'about'" class="max-w-2xl mx-auto space-y-8">
                <div class="bg-white rounded-[2.5rem] p-8 card-shadow">
                    <h3 class="text-lg font-black mb-6 flex items-center gap-3">
                        <span class="material-symbols-outlined text-primary">mail</span> Primary Email
                    </h3>
                    <input v-model="contentStore.about.email" class="w-full bg-[#fcf8f9] p-5 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" />
                </div>

                <div class="bg-white rounded-[2.5rem] p-8 card-shadow space-y-6">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-black flex items-center gap-3">
                            <span class="material-symbols-outlined text-primary">share</span> Social Presence
                        </h3>
                        <button @click="addSocialLink" class="text-[10px] font-black text-primary uppercase bg-soft-pink/10 px-4 py-2 rounded-full hover:bg-primary hover:text-white transition-all">+ Add Link</button>
                    </div>
                    <div class="space-y-4">
                         <div v-for="(l, idx) in contentStore.about.social" :key="l.id" class="p-6 bg-[#fcf8f9] rounded-[2rem] relative group border border-transparent hover:border-primary/10 transition-all">
                             <button @click="contentStore.about.social.splice(idx, 1)" class="absolute top-4 right-4 text-red-100 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                                <span class="material-symbols-outlined text-xl">delete</span>
                             </button>
                             <div class="grid grid-cols-2 gap-4 mb-4">
                                 <div class="space-y-1">
                                     <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Platform</label>
                                     <input v-model="l.platform" class="w-full bg-white p-4 rounded-xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/10" />
                                 </div>
                                 <div class="space-y-1">
                                     <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Icon Style</label>
                                     <button @click="showIconPickerFor = l" class="w-full bg-white p-4 rounded-xl text-xs font-black flex items-center justify-between hover:bg-gray-50 transition-colors">
                                         <div class="flex items-center gap-2">
                                             <div v-if="l.isSvg" v-html="getIconHtml(l.icon)" class="size-4"></div>
                                             <span v-else class="material-symbols-outlined text-sm">{{ l.icon }}</span>
                                             <span class="capitalize">{{ l.icon }}</span>
                                         </div>
                                         <span class="material-symbols-outlined text-xs">keyboard_arrow_down</span>
                                     </button>
                                 </div>
                             </div>
                             <div class="space-y-1">
                                 <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Profile URL</label>
                                 <input v-model="l.url" class="w-full bg-white p-4 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-primary/10" placeholder="https://..." />
                             </div>
                         </div>
                    </div>
                </div>
            </div>

            <div v-else-if="currentTab === 'messages'" class="max-w-4xl mx-auto space-y-6">
                <div v-if="contentStore.messages.length === 0" class="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-primary/10">
                    <span class="material-symbols-outlined text-gray-100 text-7xl mb-4 block">drafts</span>
                    <p class="font-black text-gray-300 italic">No magic letters found... 🕊️</p>
                </div>
                <div v-for="m in contentStore.messages.slice().reverse()" :key="m.id" 
                    @click="markAsRead(m.id)"
                    class="bg-white p-8 rounded-[3rem] card-shadow border border-white relative group transition-all"
                    :class="{ 'opacity-60 grayscale-[0.3]': m.isRead }">
                    <div class="flex justify-between items-start mb-6">
                        <div class="flex items-center gap-4">
                            <div class="size-3 rounded-full" :class="m.isRead ? 'bg-gray-200' : 'bg-primary shadow-[0_0_15px_rgba(255,133,162,0.6)]'"></div>
                            <div>
                                <h4 class="font-black text-2xl text-primary">{{ m.name }}</h4>
                                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">{{ m.email }} • {{ m.date }}</p>
                            </div>
                        </div>
                        <div class="flex gap-2">
                             <a :href="`mailto:${m.email}`" class="size-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all">
                                <span class="material-symbols-outlined">reply</span>
                             </a>
                            <button @click.stop="deleteMessage(m.id)" class="size-12 rounded-2xl bg-red-50 text-red-200 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                                <span class="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    </div>
                    <p class="text-[15px] font-medium leading-relaxed italic text-gray-600 bg-[#fcf8f9] p-8 rounded-[2rem] border border-white/40 shadow-inner">"{{ m.content }}"</p>
                </div>
            </div>

            <div v-else-if="currentTab === 'accounts'" class="max-w-5xl mx-auto space-y-8 animate-fade-in">
                 <div class="flex justify-between items-center">
                    <h3 class="text-2xl font-black text-primary">Quản Lý Tài Khoản</h3>
                    <button @click="openCreateAccountModal" class="bg-primary text-white px-8 py-3 rounded-full font-black text-sm shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                        <span class="material-symbols-outlined">person_add</span> Thêm Tài Khoản
                    </button>
                </div>
                
                <div class="bg-white rounded-[3rem] p-8 card-shadow border border-white/40 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="border-b border-primary/10 text-gray-400 text-xs font-black uppercase tracking-wider">
                                    <th class="pb-4 pl-4">Tên hiển thị</th>
                                    <th class="pb-4">Tên đăng nhập</th>
                                    <th class="pb-4">Vai trò</th>
                                    <th class="pb-4 text-right pr-4">Hành động</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-primary/5">
                                <tr v-if="accountsList.length === 0">
                                    <td colspan="4" class="py-12 text-center text-gray-400 italic font-medium">Chưa có tài khoản phụ nào được tạo.</td>
                                </tr>
                                <tr v-for="(acc, idx) in accountsList" :key="idx" class="hover:bg-soft-pink/5 transition-colors">
                                    <td class="py-4 pl-4 font-bold text-sm text-primary flex items-center gap-3">
                                        <img :src="acc.avatar || ('https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(acc.displayName || 'User'))" class="size-8 rounded-full border border-primary/10 object-cover" />
                                        <span>{{ acc.displayName }}</span>
                                    </td>
                                    <td class="py-4 font-bold text-sm text-[#4a2c32]">{{ acc.username }}</td>
                                    <td class="py-4">
                                        <span class="px-3 py-1 text-[9px] font-black uppercase rounded-full"
                                            :class="acc.role === 'admin' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'"
                                        >
                                            {{ acc.role || 'staff' }}
                                        </span>
                                    </td>
                                    <td class="py-4 text-right pr-4 space-x-4">
                                        <button @click="openEditAccountModal(acc)" class="text-xs font-black text-amber-500 hover:underline">Chỉnh sửa</button>
                                        <button @click="openResetPasswordModal(acc)" class="text-xs font-black text-primary hover:underline">Đổi mật khẩu</button>
                                        <button @click="deleteAccount(acc.username)" class="text-xs font-black text-red-400 hover:text-red-600 hover:underline">Xóa</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Phân Quyền Công Cụ Cho Staff Card -->
                <div class="bg-white rounded-[3rem] p-8 card-shadow border border-white/40 flex flex-col gap-6">
                    <div>
                        <h4 class="text-lg font-black text-[#4a2c32] flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary">settings_accessibility</span>
                            Phân Quyền Công Cụ Cho Nhân Viên (Staff)
                        </h4>
                        <p class="text-xs font-bold text-gray-400 mt-1">Chọn các công cụ/module hiển thị cho các tài khoản có vai trò Staff.</p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div v-for="t in allTools" :key="t.id" class="p-4 bg-[#fcf8f9] rounded-2xl flex items-center justify-between border border-transparent hover:border-primary/10 transition-all group">
                            <div class="flex items-center gap-3">
                                <div class="size-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-soft">
                                    <span class="material-symbols-outlined text-sm">
                                        {{ t.id === 'converter' ? 'swap_horiz' : t.id === 'merger' ? 'layers' : t.id === 'weighbridge' ? 'print' : t.id === 'allocator' ? 'shuffle' : t.id === 'vehicles' ? 'local_shipping' : 'document_scanner' }}
                                    </span>
                                </div>
                                <span class="font-bold text-xs text-[#4a2c32] group-hover:text-primary transition-colors">{{ t.name }}</span>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer scale-90">
                                <input type="checkbox" :value="t.id" v-model="staffToolsConfig" class="sr-only peer">
                                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>
                    </div>

                    <div class="flex justify-end pt-2 border-t border-dashed border-primary/10">
                        <button @click="handleSaveStaffTools" class="bg-primary text-white px-8 py-2.5 rounded-full font-black text-xs shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">Lưu phân quyền công cụ</button>
                    </div>
                </div>
            </div>
        </main>



        <!-- Modals: Toolkit Config -->
        <div v-if="showToolkitManager" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div class="bg-white rounded-[3rem] w-full max-w-xl p-10 shadow-2xl animate-scale-up relative border border-white/50">
                <button @click="showToolkitManager = false" class="absolute top-6 right-6 size-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:text-primary transition-all">
                    <span class="material-symbols-outlined">close</span>
                </button>
                <h2 class="text-2xl font-display font-black text-primary mb-2">Toolkit Manager</h2>
                <p class="text-xs font-bold text-gray-400 mb-8">Add or manage your magic skills ✨</p>
                <div class="mb-6">
                    <a href="https://fonts.google.com/icons?selected=Material+Symbols+Outlined" target="_blank" class="text-[10px] font-black text-primary hover:underline uppercase tracking-widest flex items-center gap-1">
                        <span class="material-symbols-outlined text-xs">open_in_new</span> Find Icon Names Here
                    </a>
                </div>
                
                <!-- Tool List in Modal -->
                <div class="max-h-60 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                    <div v-for="(tool, idx) in contentStore.toolkit" :key="idx" class="flex items-center justify-between p-4 bg-[#fcf8f9] rounded-2xl border border-transparent hover:border-primary/10 transition-all">
                        <div class="flex items-center gap-3">
                            <span class="material-symbols-outlined text-primary">{{ tool.icon }}</span>
                            <span class="font-black text-xs">{{ tool.label }}</span>
                        </div>
                        <div class="flex gap-4">
                            <button @click="editTool(idx)" class="text-[10px] font-black text-primary hover:underline">Edit</button>
                            <button @click="removeTool(idx)" class="text-[10px] font-black text-red-300 hover:text-red-500">Remove</button>
                        </div>
                    </div>
                </div>

                <div class="space-y-4 pt-6 border-t border-dashed border-primary/10">
                    <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">{{ isEditingTool ? 'Editing Skill' : 'New Magic Skill' }}</p>
                    
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[9px] font-black text-gray-400 uppercase tracking-wider text-left">Chọn liên kết nhanh công cụ</label>
                        <select 
                            :value="['/tools?tool=weighbridge', '/tools?tool=merger', '/tools?tool=converter', '/tools?tool=ocr'].includes(newTool.tool) ? newTool.tool : ''"
                            @change="handleToolSelect"
                            class="w-full bg-gray-50 px-4 py-3.5 rounded-xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                        >
                            <option value="">-- Nhập tùy chỉnh thủ công dưới đây --</option>
                            <option value="/tools?tool=weighbridge">In Phiếu Cân Xe (Mã lệnh & Sà lan)</option>
                            <option value="/tools?tool=merger">Gộp Excel Thông Minh</option>
                            <option value="/tools?tool=converter">Chuyển Đổi Định Dạng File</option>
                            <option value="/tools?tool=ocr">PDF & OCR Tools</option>
                        </select>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <input v-model="newTool.icon" placeholder="Material Icon Name (ví dụ: print)" class="bg-gray-50 p-4 rounded-xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20" />
                        <input v-model="newTool.label" placeholder="Skill Label (ví dụ: In Phiếu Cân)" class="bg-gray-50 p-4 rounded-xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <input v-model="newTool.tool" placeholder="Linked Tool Path (ví dụ: /tools?tool=weighbridge)" class="w-full bg-gray-50 p-4 rounded-xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20" />
                    <button @click="addTool" class="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-sm">
                        {{ isEditingTool ? 'Update Magic Skill ✨' : 'Add Magic Skill ✨' }}
                    </button>
                    <button v-if="isEditingTool" @click="cancelEditTool" class="w-full py-2 text-gray-400 text-[10px] font-black uppercase tracking-widest">Cancel Editing</button>
                </div>
            </div>
        </div>

        <!-- Project Modal -->
        <div v-if="showProjectModal" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
             <div class="bg-white w-full max-w-xl rounded-[4rem] p-12 card-shadow space-y-8 animate-scale-up relative overflow-hidden">
                <header class="flex justify-between items-center">
                    <div>
                        <h3 class="text-3xl font-black text-primary">{{ isEditingProject ? 'Edit Project' : 'New Creation' }}</h3>
                        <p class="text-[10px] font-bold text-gray-400">Tweak your magic showcase ✨</p>
                    </div>
                    <button @click="showProjectModal = false" class="size-12 bg-[#fcf8f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400">
                         <span class="material-symbols-outlined">close</span>
                    </button>
                </header>
                <div class="space-y-6">
                    <div class="flex justify-center">
                        <div class="relative size-44 rounded-[3rem] bg-gray-50 border-2 border-dashed border-primary/20 flex flex-col items-center justify-center overflow-hidden cursor-pointer group hover:bg-white transition-all shadow-inner" @click="triggerProjectImageUpload">
                            <div v-if="newProject.image" class="absolute inset-0 bg-cover bg-center" :style="{ backgroundImage: `url(${newProject.image})` }"></div>
                            <div class="text-center group-hover:scale-110 transition-transform">
                                <span class="material-symbols-outlined text-4xl text-primary/30">add_photo_alternate</span>
                                <p class="text-[8px] font-black text-primary/30 uppercase mt-2">Upload Artwork</p>
                            </div>
                            <input type="file" ref="projectInput" class="hidden" @change="handleProjectImageUpload" accept="image/*" />
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Title</label>
                            <input v-model="newProject.title" placeholder="Project name" class="w-full bg-[#fcf8f9] p-5 rounded-2xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Type / Tag</label>
                            <input v-model="newProject.tag" placeholder="e.g. Mobile Design" class="w-full bg-[#fcf8f9] p-5 rounded-2xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </div>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Description</label>
                        <textarea v-model="newProject.description" placeholder="Share the story behind this magic..." class="w-full bg-[#fcf8f9] p-5 rounded-2xl text-xs font-bold border-none h-28 resize-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm leading-relaxed"></textarea>
                    </div>
                    <button @click="addProject" class="w-full py-5 bg-primary text-white rounded-[2rem] font-black shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all text-sm">Confirm Changes ✨</button>
                </div>
             </div>
        </div>

        <!-- Icon Picker -->
        <div v-if="showIconPickerFor" class="fixed inset-0 bg-black/70 backdrop-blur-md z-[250] flex items-center justify-center p-6" @click="showIconPickerFor = null">
            <div class="bg-white rounded-[3rem] p-10 max-w-sm w-full grid grid-cols-4 gap-4 shadow-2xl animate-fade-in" @click.stop>
                <button v-for="icon in iconPresets" :key="icon.name" @click="selectIcon(icon.icon, icon.isSvg)" class="size-16 rounded-2xl bg-[#fcf8f9] flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm border border-gray-100">
                    <div v-if="icon.isSvg && getIconHtml(icon.icon)" v-html="getIconHtml(icon.icon)" class="size-8"></div>
                    <span v-else class="material-symbols-outlined">{{ icon.icon }}</span>
                </button>
            </div>
        </div>

        <!-- Create Account Modal -->
        <div v-if="showAccountModal" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
             <div class="bg-white w-full max-w-xl rounded-[4rem] p-12 card-shadow space-y-8 animate-scale-up relative overflow-hidden">
                <header class="flex justify-between items-center">
                    <div>
                        <h3 class="text-3xl font-black text-primary">Tạo Tài Khoản</h3>
                        <p class="text-[10px] font-bold text-gray-400">Tạo thêm tài khoản mới cho nhân viên ✨</p>
                    </div>
                    <button @click="showAccountModal = false" class="size-12 bg-[#fcf8f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400">
                         <span class="material-symbols-outlined">close</span>
                    </button>
                </header>
                <div class="space-y-6">
                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Tên đăng nhập</label>
                            <input v-model="accountForm.username" placeholder="Ví dụ: nguyenvana" class="w-full bg-[#fcf8f9] p-5 rounded-2xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Tên hiển thị</label>
                            <input v-model="accountForm.displayName" placeholder="Ví dụ: Nguyễn Văn A" class="w-full bg-[#fcf8f9] p-5 rounded-2xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Mật khẩu</label>
                            <input v-model="accountForm.password" type="password" placeholder="••••••••" class="w-full bg-[#fcf8f9] p-5 rounded-2xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Vai trò</label>
                            <select v-model="accountForm.role" class="w-full bg-[#fcf8f9] p-5 rounded-2xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm">
                                <option value="staff">Staff (Nhân viên)</option>
                                <option value="admin">Admin (Quản trị viên)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Ảnh Đại Diện (Tùy chọn)</label>
                            <input type="file" accept="image/*" @change="handleAccountAvatarUpload($event, false)" class="w-full bg-[#fcf8f9] p-4.5 rounded-2xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </div>
                        <div v-if="accountForm.avatar" class="flex items-center gap-2 mt-4 ml-2">
                            <img :src="accountForm.avatar" class="size-12 rounded-full border-2 border-primary/20 object-cover" />
                            <button @click="accountForm.avatar = ''" class="text-[10px] font-black text-red-500 hover:underline">Xóa</button>
                        </div>
                    </div>

                    <button @click="handleCreateAccount" class="w-full py-5 bg-primary text-white rounded-[2rem] font-black shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all text-sm">Xác Nhận Tạo ✨</button>
                </div>
             </div>
        </div>

        <!-- Edit Account Modal -->
        <div v-if="showEditAccountModal" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
             <div class="bg-white w-full max-w-xl rounded-[4rem] p-12 card-shadow space-y-8 animate-scale-up relative overflow-hidden">
                <header class="flex justify-between items-center">
                    <div>
                        <h3 class="text-3xl font-black text-primary">Chỉnh Sửa Tài Khoản</h3>
                        <p class="text-[10px] font-bold text-gray-400">Thay đổi thông tin tài khoản: <span class="text-primary font-black">{{ editAccountForm.username }}</span> ✨</p>
                    </div>
                    <button @click="showEditAccountModal = false" class="size-12 bg-[#fcf8f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400">
                         <span class="material-symbols-outlined">close</span>
                    </button>
                </header>
                <div class="space-y-6">
                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Tên hiển thị</label>
                            <input v-model="editAccountForm.displayName" placeholder="Ví dụ: Nguyễn Văn A" class="w-full bg-[#fcf8f9] p-5 rounded-2xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Vai trò</label>
                            <select v-model="editAccountForm.role" class="w-full bg-[#fcf8f9] p-5 rounded-2xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm">
                                <option value="staff">Staff (Nhân viên)</option>
                                <option value="admin">Admin (Quản trị viên)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Ảnh Đại Diện (Tùy chọn)</label>
                            <input type="file" accept="image/*" @change="handleAccountAvatarUpload($event, true)" class="w-full bg-[#fcf8f9] p-4.5 rounded-2xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </div>
                        <div class="flex items-center gap-2 mt-4 ml-2">
                            <img :src="editAccountForm.avatar || ('https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(editAccountForm.displayName || 'User'))" class="size-12 rounded-full border-2 border-primary/20 object-cover" />
                            <button v-if="editAccountForm.avatar" @click="editAccountForm.avatar = ''" class="text-[10px] font-black text-red-500 hover:underline">Xóa</button>
                        </div>
                    </div>

                    <button @click="handleEditAccount" class="w-full py-5 bg-primary text-white rounded-[2rem] font-black shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all text-sm">Lưu Thay Đổi ✨</button>
                </div>
             </div>
        </div>

        <!-- Reset Password Modal -->
        <div v-if="showResetPasswordModal" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
             <div class="bg-white w-full max-w-md rounded-[4rem] p-12 card-shadow space-y-8 animate-scale-up relative overflow-hidden">
                <header class="flex justify-between items-center">
                    <div>
                        <h3 class="text-3xl font-black text-primary">Đặt Lại Mật Khẩu</h3>
                        <p class="text-[10px] font-bold text-gray-400">Đặt lại mật khẩu cho tài khoản: <span class="text-primary font-black">{{ resetPasswordForm.username }}</span></p>
                    </div>
                    <button @click="showResetPasswordModal = false" class="size-12 bg-[#fcf8f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400">
                         <span class="material-symbols-outlined">close</span>
                    </button>
                </header>
                <div class="space-y-6">
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Mật khẩu mới</label>
                        <input v-model="resetPasswordForm.newPassword" type="password" placeholder="••••••••" class="w-full bg-[#fcf8f9] p-5 rounded-2xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                    </div>
                    <button @click="handleResetPassword" class="w-full py-5 bg-primary text-white rounded-[2rem] font-black shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all text-sm">Đặt Lại Mật Khẩu ✨</button>
                </div>
             </div>
        </div>

        <!-- Toast -->
        <div v-if="showToast" class="fixed bottom-12 left-1/2 -translate-x-1/2 bg-[#1b0d11] text-white px-10 py-5 rounded-full font-black text-xs shadow-2xl z-[300] animate-bounce-short tracking-wide border border-white/10 backdrop-blur-xl">
            {{ toastMessage }}
        </div>
    </div>
</template>


<style scoped>
.card-shadow { box-shadow: 0 20px 60px -15px rgba(255, 133, 162, 0.15); }
.blob-shape { border-radius: 64% 36% 27% 73% / 55% 23% 77% 45%; }
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 133, 162, 0.2); border-radius: 10px; }
@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
@keyframes scale-up { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
.animate-scale-up { animation: scale-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
@keyframes bounce-short { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -10px); } }
.animate-bounce-short { animation: bounce-short 2s infinite; }
</style>

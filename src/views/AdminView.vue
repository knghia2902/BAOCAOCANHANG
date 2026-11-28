<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { contentStore } from '../stores/content';
import { authStore, logout, updateStoreProfile } from '../stores/auth';
import { ContentService } from '../services/ContentService';
import { StorageService } from '../services/storage/StorageService';
import { authService, sha256 } from '../services/storage/AuthService';
import { SettingsService } from '../services/storage/SettingsService';
import { LogService } from '../services/storage/LogService';


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
        newTool.value.icon = 'monitoring';
        newTool.value.label = 'Báo Cáo Tổng Quan 🚢';
    } else if (val === '/tools?tool=allocator') {
        newTool.value.icon = 'balance';
        newTool.value.label = 'Dữ Liệu Cân Hàng 🚢';
    } else if (val === '/tools?tool=vehicles') {
        newTool.value.icon = 'directions_boat';
        newTool.value.label = 'Quản Lý Hồ Sơ Phương Tiện 🚢';
    } else if (val === '/tools?tool=minutes') {
        newTool.value.icon = 'description';
        newTool.value.label = 'Biên Bản Sà Lan 🚢';
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
            
            const settings = await SettingsService.getSettings();
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
    role: 'staff' as string,
    avatar: ''
});

const editAccountForm = ref({
    username: '',
    displayName: '',
    role: 'staff' as string,
    avatar: ''
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
    
    const exists = accountsList.value.some(acc => acc.username?.toLowerCase() === usernameClean);
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
    
    const success = await ContentService.createUser(newAcc);
    if (success) {
        await loadAccounts();
        showAccountModal.value = false;
        triggerToast('Tạo tài khoản thành công! ✨');
        await LogService.logAction('Tạo tài khoản', 'Tạo tài khoản mới: ' + usernameClean);
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

    if (editAccountForm.value.username === authStore.user && editAccountForm.value.role !== 'admin') {
        triggerToast('Không thể tự thay đổi chức vụ tài khoản quản trị đang đăng nhập! ⚠️');
        return;
    }
    
    const avatarUrl = editAccountForm.value.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(editAccountForm.value.displayName.trim())}`;
    
    const success = await ContentService.updateUser(editAccountForm.value.username, {
        displayName: editAccountForm.value.displayName.trim(),
        role: editAccountForm.value.role,
        avatar: avatarUrl
    });
    
    if (success) {
        await loadAccounts();
        showEditAccountModal.value = false;
        triggerToast('Cập nhật tài khoản thành công! ✨');
        await LogService.logAction('Sửa tài khoản', 'Cập nhật thông tin tài khoản: ' + editAccountForm.value.username);
    } else {
        triggerToast('Có lỗi xảy ra khi lưu tài khoản.');
    }
};

const deleteAccount = async (username: string) => {
    if (username === authStore.user) {
        triggerToast('Không thể tự xóa tài khoản quản trị đang đăng nhập! ⚠️');
        return;
    }
    if (confirm(`Bạn có chắc chắn muốn xóa tài khoản "${username}"?`)) {
        const success = await ContentService.deleteUser(username);
        if (success) {
            await loadAccounts();
            triggerToast('Xóa tài khoản thành công! 🗑️');
            await LogService.logAction('Xóa tài khoản', 'Xóa tài khoản: ' + username);
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
    const success = await ContentService.resetUserPassword(resetPasswordForm.value.username, passwordHash);
    
    if (success) {
        await loadAccounts();
        showResetPasswordModal.value = false;
        triggerToast('Đặt lại mật khẩu thành công! ✨');
        await LogService.logAction('Đổi mật khẩu', 'Đặt lại mật khẩu cho tài khoản: ' + resetPasswordForm.value.username);
    } else {
        triggerToast('Có lỗi xảy ra khi đặt lại mật khẩu.');
    }
};

const toggleUserStatus = async (account: any) => {
    if (account.username === authStore.user) {
        triggerToast('Không thể tự khóa tài khoản quản trị đang đăng nhập! ⚠️');
        return;
    }
    const newStatus = !account.isActive;
    const actionText = newStatus ? 'mở khóa' : 'khóa';
    if (confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản "${account.username}"?`)) {
        const success = await ContentService.toggleUserStatus(account.username, newStatus);
        if (success) {
            await loadAccounts();
            triggerToast(`Đã ${actionText} tài khoản thành công! ✨`);
            await LogService.logAction('Đổi trạng thái', `${actionText} tài khoản: ` + account.username);
        } else {
            triggerToast('Có lỗi xảy ra khi đổi trạng thái tài khoản.');
        }
    }
};



const staffToolsConfig = ref<string[]>([]);

const loadStaffToolsConfig = async () => {
    staffToolsConfig.value = await ContentService.loadStaffTools();
};




interface RolePermissionConfigLocal {
    label?: string;
    tools: string[];
    description?: string;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    detailPermissions?: Record<string, string[]>;
}

const DEFAULT_ROLE_LABELS: Record<string, string> = {
    admin: 'Quản trị viên',
    staff: 'Nhân viên văn phòng',
    operator: 'Nhân viên vận hành',
    viewer: 'Giám sát (Chỉ xem)'
};

const rolePermissions = ref<Record<string, RolePermissionConfigLocal>>({});
const selectedRoleToConfigure = ref<string>('staff');
const activeSubsystem = ref<string>('vessel_source');
const hasUnsavedRoleChanges = ref(false);

const getRoleDisplayLabel = (key: string): string => {
    const config = rolePermissions.value[key];
    return config?.label?.trim() || DEFAULT_ROLE_LABELS[key] || key;
};

const getRoleAccountCount = (roleKey: string): number => {
    return accountsList.value.filter(acc => (acc.role || 'staff') === roleKey).length;
};

const getRoleEnabledSubsystemsCount = (roleKey: string): number => {
    if (roleKey === 'admin') return allSubsystemsList.length;
    return allSubsystemsList.filter(sub => isSubsystemChecked(roleKey, sub.id)).length;
};

const slugifyRoleKey = (input: string): string => {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
};

type ActionType = 'read' | 'create' | 'update' | 'delete';

interface SubsystemItem {
    id: string;
    name: string;
    description: string;
    icon: string;
    parentLabel?: string;
    tags?: string[];
}

interface ActionPermissionItem {
    name: string;
    permId: string;
    showView: boolean;
    showCreate: boolean;
    showUpdate: boolean;
    showDelete: boolean;
}

const SUBSYSTEM_ORDER = [
    'vessel_source',
    'allocator',
    'warehouse',
    'weighbridge',
    'split',
    'vehicles',
    'minutes',
    'categories'
] as const;

const subsystemGroups = {
    phanHeMain: [
        {
            id: 'vessel_source',
            name: 'Tạo nguồn tàu',
            description: 'Quản lý danh sách nguồn tàu mẹ và các sà lan thuộc tàu',
            icon: 'directions_boat'
        },
        {
            id: 'allocator',
            name: 'Dữ liệu cân',
            description: 'Quản lý phiếu cân, sổ theo dõi và xuất Excel dữ liệu cân',
            icon: 'balance'
        }
    ] as SubsystemItem[],
    phanHeReports: [
        {
            id: 'warehouse',
            name: 'Báo cáo tồn kho',
            description: 'Nạp CSV/Excel tồn kho, cấu hình tồn đầu & sơ đồ kho, khách hàng kho và xuất báo cáo',
            icon: 'warehouse',
            parentLabel: 'Báo cáo'
        },
        {
            id: 'weighbridge',
            name: 'Báo cáo lô hàng',
            description: 'Quản lý lô hàng/chốt tàu, phiếu cân xe, in phiếu & xuất Excel, cài đặt mẫu in & bố cục',
            icon: 'monitoring',
            parentLabel: 'Báo cáo'
        },
        {
            id: 'split',
            name: 'Báo cáo De Heus',
            description: 'Chia tách, phân bổ De Heus theo định mức và xuất báo cáo',
            icon: 'call_split',
            parentLabel: 'Báo cáo'
        }
    ] as SubsystemItem[],
    phanHeOther: [
        {
            id: 'vehicles',
            name: 'Quản lý hồ sơ phương tiện',
            description: 'Quản lý hồ sơ sà lan, thuyền viên & giấy tờ đăng kiểm, bảo hiểm',
            icon: 'local_shipping'
        },
        {
            id: 'minutes',
            name: 'Biên bản',
            description: 'Tải Weight List, lập biên bản và xuất file Excel biên bản làm hàng sà lan',
            icon: 'description'
        }
    ] as SubsystemItem[],
    danhMuc: [
        {
            id: 'categories',
            name: 'Danh mục dùng chung',
            description: 'Quản lý dữ liệu danh mục nền tảng dùng chung cho toàn hệ thống',
            icon: 'category',
            tags: ['Danh sách xe', 'Khách hàng', 'Kho hàng', 'Hàng hóa']
        }
    ] as SubsystemItem[]
};

const allSubsystemsList: SubsystemItem[] = [
    ...subsystemGroups.phanHeMain,
    ...subsystemGroups.phanHeReports,
    ...subsystemGroups.phanHeOther,
    ...subsystemGroups.danhMuc
];

const actionPermissionsMapping: Record<string, ActionPermissionItem[]> = {
    vessel_source: [
        { name: 'Quản lý nguồn tàu', permId: 'vs_vessel_manage', showView: true, showCreate: true, showUpdate: true, showDelete: true },
        { name: 'Quản lý sà lan thuộc tàu', permId: 'vs_barge_manage', showView: true, showCreate: true, showUpdate: true, showDelete: true }
    ],
    allocator: [
        { name: 'Quản lý Phiếu cân & Sổ theo dõi', permId: 'al_data_manage', showView: true, showCreate: true, showUpdate: true, showDelete: true },
        { name: 'Xuất Excel Phiếu cân & Sổ theo dõi', permId: 'al_export', showView: true, showCreate: false, showUpdate: false, showDelete: false }
    ],
    warehouse: [
        { name: 'Nạp dữ liệu CSV / Excel tồn kho', permId: 'wh_import', showView: false, showCreate: true, showUpdate: false, showDelete: false },
        { name: 'Xem & Xuất báo cáo tồn kho', permId: 'wh_export', showView: true, showCreate: false, showUpdate: false, showDelete: false },
        { name: 'Cấu hình tồn đầu & Sơ đồ kho', permId: 'wh_config', showView: false, showCreate: false, showUpdate: true, showDelete: false },
        { name: 'Quản lý khách hàng kho', permId: 'wh_customer_manage', showView: true, showCreate: true, showUpdate: true, showDelete: true },
        { name: 'Xóa phiếu cân tồn kho', permId: 'wh_delete_tickets', showView: false, showCreate: false, showUpdate: false, showDelete: true }
    ],
    weighbridge: [
        { name: 'Quản lý lô hàng / Chốt tàu', permId: 'wb_vessel_manage', showView: true, showCreate: true, showUpdate: true, showDelete: true },
        { name: 'Quản lý phiếu cân xe', permId: 'wb_truck_manage', showView: true, showCreate: true, showUpdate: true, showDelete: true },
        { name: 'In phiếu & Xuất Excel', permId: 'wb_print_export', showView: true, showCreate: false, showUpdate: false, showDelete: false },
        { name: 'Cài đặt mẫu in & bố cục', permId: 'wb_layout_config', showView: true, showCreate: false, showUpdate: true, showDelete: false }
    ],
    split: [
        { name: 'Chia tách & phân bổ De Heus', permId: 'split_manage', showView: true, showCreate: true, showUpdate: true, showDelete: true },
        { name: 'Xuất báo cáo De Heus', permId: 'split_export', showView: true, showCreate: false, showUpdate: false, showDelete: false }
    ],
    vehicles: [
        { name: 'Hồ sơ sà lan, thuyền viên & giấy tờ', permId: 'veh_barge_profile', showView: true, showCreate: true, showUpdate: true, showDelete: true }
    ],
    minutes: [
        { name: 'Tải Weight List & lập biên bản', permId: 'min_create', showView: true, showCreate: true, showUpdate: false, showDelete: false },
        { name: 'Xuất file Excel biên bản', permId: 'min_export', showView: true, showCreate: false, showUpdate: false, showDelete: false }
    ],
    categories: [
        { name: 'Danh sách xe', permId: 'cat_vehicles', showView: true, showCreate: true, showUpdate: true, showDelete: true },
        { name: 'Danh sách khách hàng', permId: 'cat_customers', showView: true, showCreate: true, showUpdate: true, showDelete: true },
        { name: 'Danh sách kho hàng', permId: 'cat_warehouses', showView: true, showCreate: true, showUpdate: true, showDelete: true },
        { name: 'Danh mục hàng hóa', permId: 'cat_goods', showView: true, showCreate: true, showUpdate: true, showDelete: true }
    ]
};

const getAllowedActionsForItem = (item: ActionPermissionItem): ActionType[] => {
    const actions: ActionType[] = [];
    if (item.showView) actions.push('read');
    if (item.showCreate) actions.push('create');
    if (item.showUpdate) actions.push('update');
    if (item.showDelete) actions.push('delete');
    return actions;
};

const getAllowedActionsForPerm = (subsystem: string, permId: string): ActionType[] => {
    const items = actionPermissionsMapping[subsystem] || [];
    const item = items.find(i => i.permId === permId);
    return item ? getAllowedActionsForItem(item) : [];
};

const syncRoleDerivedFlags = (roleConfig: RolePermissionConfigLocal) => {
    if (!Array.isArray(roleConfig.tools)) {
        roleConfig.tools = [];
    }
    if (!roleConfig.detailPermissions) {
        roleConfig.detailPermissions = {};
    }

    const nextTools: string[] = [];
    let hasCreate = false;
    let hasUpdate = false;
    let hasDelete = false;

    for (const subsystem of SUBSYSTEM_ORDER) {
        const perms = roleConfig.detailPermissions[subsystem];
        if (Array.isArray(perms) && perms.length > 0) {
            nextTools.push(subsystem);
            const items = actionPermissionsMapping[subsystem] || [];
            for (const item of items) {
                const hasBareOrWildcard = perms.includes(item.permId) || perms.includes(`${item.permId}:*`);
                if (item.showCreate && (hasBareOrWildcard || perms.includes(`${item.permId}:create`))) {
                    hasCreate = true;
                }
                if (item.showUpdate && (hasBareOrWildcard || perms.includes(`${item.permId}:update`))) {
                    hasUpdate = true;
                }
                if (item.showDelete && (hasBareOrWildcard || perms.includes(`${item.permId}:delete`))) {
                    hasDelete = true;
                }
            }
        }
    }

    delete roleConfig.detailPermissions.utilities;
    roleConfig.tools = nextTools;
    roleConfig.canCreate = hasCreate;
    roleConfig.canUpdate = hasUpdate;
    roleConfig.canDelete = hasDelete;
};

const isActionPermChecked = (role: string, subsystem: string, permId: string, actionType: ActionType) => {
    const roleConfig = rolePermissions.value[role];
    if (!roleConfig) return false;

    if (!Array.isArray(roleConfig.tools) || !roleConfig.tools.includes(subsystem)) {
        return false;
    }

    const allowed = getAllowedActionsForPerm(subsystem, permId);
    if (!allowed.includes(actionType)) {
        return false;
    }

    const perms = roleConfig.detailPermissions?.[subsystem];
    if (!perms || !Array.isArray(perms) || perms.length === 0) {
        return false;
    }

    const specificPerm = `${permId}:${actionType}`;

    // Backwards compatibility: bare permId or wildcard means all allowed actions are enabled
    if (perms.includes(permId) || perms.includes(`${permId}:*`)) {
        return true;
    }

    return perms.includes(specificPerm);
};

const getDefaultPermissionsForSubsystem = (subsystem: string): string[] => {
    const items = actionPermissionsMapping[subsystem];
    if (!items) return [];
    const result: string[] = [];
    for (const item of items) {
        for (const action of getAllowedActionsForItem(item)) {
            result.push(`${item.permId}:${action}`);
        }
    }
    return result;
};

const isSubsystemChecked = (role: string, id: string): boolean => {
    const roleConfig = rolePermissions.value[role];
    if (!roleConfig || !Array.isArray(roleConfig.tools)) return false;
    return roleConfig.tools.includes(id);
};

const enabledActionSubsystems = computed(() => {
    const role = selectedRoleToConfigure.value;
    return allSubsystemsList.filter(sub => isSubsystemChecked(role, sub.id));
});

const onSubsystemCheckboxToggle = (role: string, subsystem: string) => {
    const roleConfig = rolePermissions.value[role];
    if (!roleConfig) return;

    if (!Array.isArray(roleConfig.tools)) {
        roleConfig.tools = [];
    }
    if (!roleConfig.detailPermissions) {
        roleConfig.detailPermissions = {};
    }

    const currentlyChecked = isSubsystemChecked(role, subsystem);

    if (currentlyChecked) {
        roleConfig.tools = roleConfig.tools.filter(t => t !== subsystem);
        roleConfig.detailPermissions[subsystem] = [];
        if (activeSubsystem.value === subsystem) {
            const firstActive = allSubsystemsList.find(s => isSubsystemChecked(role, s.id));
            activeSubsystem.value = firstActive ? firstActive.id : 'vessel_source';
        }
    } else {
        if (!roleConfig.tools.includes(subsystem)) {
            roleConfig.tools.push(subsystem);
        }
        const existing = roleConfig.detailPermissions[subsystem];
        if (!existing || existing.length === 0) {
            roleConfig.detailPermissions[subsystem] = getDefaultPermissionsForSubsystem(subsystem);
        }
        activeSubsystem.value = subsystem;
    }

    syncRoleDerivedFlags(roleConfig);
    hasUnsavedRoleChanges.value = true;
};

const toggleActionPerm = (role: string, subsystem: string, permId: string, actionType: ActionType) => {
    const roleConfig = rolePermissions.value[role];
    if (!roleConfig) return;

    if (!roleConfig.detailPermissions) {
        roleConfig.detailPermissions = {};
    }

    if (!roleConfig.detailPermissions[subsystem]) {
        roleConfig.detailPermissions[subsystem] = [];
    }

    let perms = [...roleConfig.detailPermissions[subsystem]];

    // Backwards compatibility migration: if perms contains the bare permId or wildcard,
    // expand it into the allowed specific actions before toggling.
    if (perms.includes(permId) || perms.includes(`${permId}:*`)) {
        perms = perms.filter(p => p !== permId && p !== `${permId}:*`);
        for (const act of getAllowedActionsForPerm(subsystem, permId)) {
            if (!perms.includes(`${permId}:${act}`)) {
                perms.push(`${permId}:${act}`);
            }
        }
    }

    const specificPerm = `${permId}:${actionType}`;
    const index = perms.indexOf(specificPerm);

    if (index >= 0) {
        perms.splice(index, 1);
    } else {
        perms.push(specificPerm);
        // Auto-check read when checking create/update/delete on a row that has showView: true
        if (actionType !== 'read') {
            const item = (actionPermissionsMapping[subsystem] || []).find(i => i.permId === permId);
            if (item?.showView && !perms.includes(`${permId}:read`)) {
                perms.push(`${permId}:read`);
            }
        }
    }

    roleConfig.detailPermissions[subsystem] = perms;
    syncRoleDerivedFlags(roleConfig);
    hasUnsavedRoleChanges.value = true;
};

const showRoleModal = ref(false);
const roleModalMode = ref<'create' | 'edit'>('create');
const roleModalForm = reactive({
    key: '',
    label: '',
    description: '',
    cloneFrom: ''
});

const roleNames = computed(() => Object.keys(rolePermissions.value).filter(role => role !== 'admin'));
const allRoleKeys = computed(() => [
    ...roleNames.value,
    ...(rolePermissions.value.admin ? ['admin'] : [])
]);

const openCreateRoleModal = () => {
    roleModalMode.value = 'create';
    roleModalForm.key = '';
    roleModalForm.label = '';
    roleModalForm.description = '';
    roleModalForm.cloneFrom = '';
    showRoleModal.value = true;
};

const openEditRoleModal = (roleKey: string) => {
    if (roleKey === 'admin') return;
    const config = rolePermissions.value[roleKey];
    if (!config) return;
    roleModalMode.value = 'edit';
    roleModalForm.key = roleKey;
    roleModalForm.label = getRoleDisplayLabel(roleKey);
    roleModalForm.description = config.description || '';
    roleModalForm.cloneFrom = '';
    showRoleModal.value = true;
};

const submitRoleModal = () => {
    const rawLabel = roleModalForm.label.trim();
    if (!rawLabel) {
        triggerToast('Tên chức vụ không được để trống!');
        return;
    }

    if (roleModalMode.value === 'edit') {
        const config = rolePermissions.value[roleModalForm.key];
        if (!config) return;
        config.label = rawLabel;
        config.description = roleModalForm.description.trim();
        hasUnsavedRoleChanges.value = true;
        showRoleModal.value = false;
        triggerToast(`Đã cập nhật thông tin chức vụ "${rawLabel}". Bấm "Lưu cấu hình" để áp dụng.`);
        return;
    }

    const key = slugifyRoleKey(rawLabel);
    if (!key) {
        triggerToast('Tên chức vụ không hợp lệ!');
        return;
    }
    if (key === 'admin') {
        triggerToast('Không thể tạo chức vụ trùng mã với Quản trị viên!');
        return;
    }
    if (rolePermissions.value[key]) {
        triggerToast('Chức vụ này đã tồn tại!');
        return;
    }

    const sourceRole = roleModalForm.cloneFrom ? rolePermissions.value[roleModalForm.cloneFrom] : null;
    if (sourceRole) {
        const cloned: RolePermissionConfigLocal = JSON.parse(JSON.stringify(sourceRole));
        cloned.label = rawLabel;
        cloned.description = roleModalForm.description.trim() || cloned.description || '';
        syncRoleDerivedFlags(cloned);
        rolePermissions.value[key] = cloned;
    } else {
        rolePermissions.value[key] = {
            label: rawLabel,
            tools: [],
            description: roleModalForm.description.trim(),
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            detailPermissions: {}
        };
    }

    selectedRoleToConfigure.value = key;
    hasUnsavedRoleChanges.value = true;
    showRoleModal.value = false;
    triggerToast(`Đã tạo chức vụ mới: ${rawLabel}! Hãy kiểm tra quyền và bấm Lưu.`);
};

const getSubsystemMeta = (id: string) => allSubsystemsList.find(tool => tool.id === id);

const getSubsystemName = (id: string) => {
    const meta = getSubsystemMeta(id);
    if (!meta) return id;
    return meta.parentLabel ? `${meta.parentLabel} — ${meta.name}` : meta.name;
};

const loadRolePermissionsConfig = async () => {
    try {
        rolePermissions.value = await ContentService.loadRolePermissions();
        hasUnsavedRoleChanges.value = false;
        const roles = Object.keys(rolePermissions.value).filter(r => r !== 'admin');
        if (roles.length > 0 && !roles.includes(selectedRoleToConfigure.value)) {
            selectedRoleToConfigure.value = roles[0] || 'staff';
        }
    } catch (e) {
        console.error('Failed to load role permissions:', e);
    }
};

const handleSaveRolePermissions = async () => {
    for (const [roleKey, roleConfig] of Object.entries(rolePermissions.value)) {
        if (roleKey !== 'admin' && roleConfig) {
            syncRoleDerivedFlags(roleConfig);
        }
    }
    if (rolePermissions.value.staff) {
        staffToolsConfig.value = rolePermissions.value.staff.tools;
        await ContentService.saveStaffTools(staffToolsConfig.value);
    }
    const success = await ContentService.saveRolePermissions(rolePermissions.value);
    if (success) {
        authStore.rolePermissions = JSON.parse(JSON.stringify(rolePermissions.value));
        hasUnsavedRoleChanges.value = false;
        triggerToast('Cập nhật phân quyền chức vụ thành công! 🛠️');
        await LogService.logAction('Phân quyền', 'Cập nhật phân quyền cho các chức vụ');
    } else {
        triggerToast('Có lỗi xảy ra khi lưu cấu hình chức vụ.');
    }
};

const handleDeleteCustomRole = (role: string) => {
    if (role === 'admin') {
        triggerToast('Không thể xóa chức vụ Quản trị viên chính!');
        return;
    }
    const label = getRoleDisplayLabel(role);
    const affectedUsers = accountsList.value.filter(acc => (acc.role || 'staff') === role);
    const warningMsg = affectedUsers.length > 0
        ? `Bạn có chắc chắn muốn xóa chức vụ "${label}" không? Hiện có ${affectedUsers.length} tài khoản đang thuộc chức vụ này và sẽ mất quyền truy cập cho đến khi được gán chức vụ khác.`
        : `Bạn có chắc chắn muốn xóa chức vụ "${label}" không?`;

    if (confirm(warningMsg)) {
        delete rolePermissions.value[role];
        const remainingRoles = Object.keys(rolePermissions.value).filter(r => r !== 'admin');
        selectedRoleToConfigure.value = remainingRoles[0] || 'staff';
        hasUnsavedRoleChanges.value = true;
        triggerToast(`Đã xóa chức vụ: ${label}. Bấm "Lưu cấu hình phân quyền" để áp dụng.`);
    }
};



// === Activity Logs Tab ===
import type { ActivityLog } from '../services/storage/LogService';
const activityLogs = ref<ActivityLog[]>([]);
const logsLoading = ref(false);
const logsSearchQuery = ref('');
const logsFilterAction = ref('all');

const loadLogs = async () => {
    logsLoading.value = true;
    activityLogs.value = await LogService.getLogs();
    logsLoading.value = false;
};

const filteredLogs = computed(() => {
    let logs = activityLogs.value;
    if (logsFilterAction.value !== 'all') {
        logs = logs.filter(l => l.action === logsFilterAction.value);
    }
    if (logsSearchQuery.value.trim()) {
        const q = logsSearchQuery.value.toLowerCase();
        logs = logs.filter(l =>
            l.username.toLowerCase().includes(q) ||
            l.displayName.toLowerCase().includes(q) ||
            l.details.toLowerCase().includes(q) ||
            l.action.toLowerCase().includes(q)
        );
    }
    return logs;
});

// Pagination State for Activity Logs
const logsCurrentPage = ref(1);
const logsPerPage = ref(10);

watch([logsSearchQuery, logsFilterAction], () => {
    logsCurrentPage.value = 1;
});

const paginatedLogs = computed(() => {
    const start = (logsCurrentPage.value - 1) * logsPerPage.value;
    const end = start + logsPerPage.value;
    return filteredLogs.value.slice(start, end);
});

const logsTotalPages = computed(() => {
    return Math.ceil(filteredLogs.value.length / logsPerPage.value) || 1;
});

const logsNextPage = () => {
    if (logsCurrentPage.value < logsTotalPages.value) {
        logsCurrentPage.value++;
    }
};

const logsPrevPage = () => {
    if (logsCurrentPage.value > 1) {
        logsCurrentPage.value--;
    }
};

const uniqueActions = computed(() => {
    const actions = new Set(activityLogs.value.map(l => l.action));
    return Array.from(actions).sort();
});

const formatLogTime = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const getActionColor = (action: string) => {
    if (action.includes('Đăng nhập')) return 'bg-teal-50 text-teal-600';
    if (action.includes('Đăng xuất')) return 'bg-slate-100 text-slate-600';
    if (action.includes('Xóa')) return 'bg-rose-50 text-rose-600';
    if (action.includes('Tạo')) return 'bg-primary/10 text-primary';
    if (action.includes('Sửa') || action.includes('Cập nhật') || action.includes('Lưu')) return 'bg-amber-50 text-amber-600';
    if (action.includes('mật khẩu') || action.includes('Đổi')) return 'bg-slate-100 text-[#1e293b]';
    if (action.includes('Phân quyền')) return 'bg-primary/10 text-primary';
    return 'bg-primary/10 text-primary';
};

const getActionIcon = (action: string) => {
    if (action.includes('Đăng nhập')) return 'login';
    if (action.includes('Đăng xuất')) return 'logout';
    if (action.includes('Xóa')) return 'delete';
    if (action.includes('Tạo')) return 'person_add';
    if (action.includes('Sửa') || action.includes('Cập nhật') || action.includes('Lưu')) return 'edit';
    if (action.includes('mật khẩu') || action.includes('Đổi')) return 'lock_reset';
    if (action.includes('Phân quyền')) return 'admin_panel_settings';
    return 'history';
};

// Load logs when switching to the logs tab
watch(currentTab, (val) => {
    if (val === 'logs') loadLogs();
});

onMounted(async () => {
    await Promise.all([
        ContentService.loadAll(),
        loadAccounts(),
        loadStaffToolsConfig(),
        loadRolePermissionsConfig()
    ]);
});
</script>



<template>
    <div class="min-h-screen bg-background-light flex flex-col lg:flex-row text-[#1e293b] p-4 lg:p-6 gap-4 lg:gap-6">
        <!-- Top Navigation (Mobile Only) -->
        <div class="flex lg:hidden flex-col gap-3 bg-white rounded-[2rem] p-4 shadow-md border border-white/50 shrink-0">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <img :src="authStore.avatar || ('https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(authStore.displayName || 'User'))" class="size-10 rounded-full border border-soft-pink object-cover" />
                    <div class="text-left">
                        <h2 class="text-sm font-black text-primary leading-tight">{{ authStore.displayName }}</h2>
                        <span class="text-xs font-black uppercase text-gray-400 tracking-wider">ADMIN MODE</span>
                    </div>
                </div>
                <button @click="logout(); router.push('/login')" class="px-3 py-1.5 rounded-xl font-bold text-xs text-red-500 hover:bg-red-50 flex items-center gap-1.5 transition-all">
                    <span class="material-symbols-outlined text-sm">logout</span> Đăng xuất
                </button>
            </div>
            <div class="h-px bg-gray-100 my-0.5"></div>
            <div class="flex overflow-x-auto gap-2 scrollbar-none whitespace-nowrap pb-0.5">
                <button v-for="tab in ['dashboard', 'about', 'messages', 'accounts', 'logs']" :key="tab"
                    @click="currentTab = tab"
                    :class="['px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shrink-0', currentTab === tab ? 'bg-primary text-white border-primary shadow-soft' : 'bg-slate-50 text-gray-500 border-slate-200']"
                >
                    <span class="material-symbols-outlined text-sm">
                        {{ tab === 'dashboard' ? 'grid_view' : tab === 'about' ? 'person' : tab === 'messages' ? 'mail' : tab === 'logs' ? 'history' : 'group' }}
                    </span>
                    <span>
                        {{ tab === 'dashboard' ? 'Dashboard' : tab === 'about' ? 'About Me' : tab === 'messages' ? 'Messages' : tab === 'logs' ? 'Logs' : 'Admin' }}
                    </span>
                </button>
            </div>
        </div>

        <!-- Sidebar (Desktop Only) -->
        <aside class="hidden lg:flex w-72 bg-white rounded-[3rem] shadow-xl flex-col p-8 z-30 border border-white/50 relative overflow-hidden shrink-0">
            <div class="flex flex-col items-center mb-12">
                <div class="relative mb-4 group">
                    <img :src="authStore.avatar || ('https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(authStore.displayName || 'User'))" class="size-24 rounded-full border-4 border-white shadow-xl object-cover transition-transform" />
                    <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white px-4 py-1.5 rounded-full border border-soft-pink shadow-[0_5px_15px_-5px_rgba(74,120,194,0.25)] animate-bounce-short whitespace-nowrap z-10">
                        <span class="text-xs font-black text-primary uppercase tracking-widest">ADMIN MODE</span>
                    </div>
                </div>
                <h1 class="font-display font-black text-xl text-primary">{{ authStore.displayName }}</h1>
            </div>

            <nav class="flex-1 space-y-2">
                <button v-for="tab in ['dashboard', 'about', 'messages', 'accounts', 'logs']" :key="tab"
                    @click="currentTab = tab"
                    :class="['w-full text-left px-5 py-3 rounded-2xl font-bold transition-all flex items-center gap-3', currentTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:bg-soft-pink/10 hover:text-primary']"
                >
                    <span class="material-symbols-outlined text-xl">
                        {{ tab === 'dashboard' ? 'grid_view' : tab === 'about' ? 'person' : tab === 'messages' ? 'mail' : tab === 'logs' ? 'history' : 'group' }}
                    </span>
                    <span class="capitalize">
                        {{ tab === 'about' ? 'About Me' : tab === 'accounts' ? 'Admin' : tab === 'logs' ? 'Logs' : tab }}
                    </span>
                </button>
            </nav>


            <button @click="logout(); router.push('/login')" class="mt-auto px-5 py-3 rounded-2xl font-bold text-red-300 hover:bg-red-50 flex items-center gap-3 transition-all">
                <span class="material-symbols-outlined">logout</span> Logout
            </button>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 pt-2 lg:pt-10 px-2 lg:px-10 pb-2 lg:pb-0 overflow-y-auto min-w-0">
            <header class="flex flex-col sm:flex-row justify-between sm:items-center mb-6 lg:mb-10 gap-4">
                <div class="text-left">
                    <h2 class="text-xl lg:text-3xl font-display font-black">Welcome back, Admin!</h2>
                    <p class="text-gray-400 font-medium">Ready to sprinkle some more magic today? ✨</p>
                </div>

                <div class="flex items-center gap-4">
                    <div class="relative">
                        <button @click="showNotifications = !showNotifications" class="size-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100 relative group">
                            <span class="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors">notifications</span>
                            <div v-if="unreadCount > 0" class="absolute -top-1 -right-1 size-5 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">{{ unreadCount }}</div>
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
                                        <div class="size-2 rounded-full" :class="msg.isRead ? 'bg-gray-300' : 'bg-primary shadow-[0_0_5px_rgba(74,120,194,0.5)]'"></div>
                                        <p class="text-xs font-black text-primary">{{ msg.name }}</p>
                                    </div>
                                    <p class="text-xs text-gray-500 line-clamp-2">{{ msg.content }}</p>
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
                            <h3 class="text-base font-black flex items-center gap-3">
                                <span class="material-symbols-outlined text-primary">home</span> Edit 'Trang chủ' Content
                            </h3>
                            <button @click="saveAll" class="bg-primary text-white px-8 py-2 rounded-full font-black text-sm shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">Save</button>
                        </div>
                        <div class="space-y-6">
                            <div class="space-y-2">
                                <label class="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Hero Title</label>
                                <input v-model="contentStore.hero.title" class="w-full bg-[#f1f5f9] p-5 rounded-2xl font-bold text-sm border-none outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div class="space-y-2">
                                <label class="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Hero Subtitle</label>
                                <textarea v-model="contentStore.hero.subtitle" class="w-full bg-[#f1f5f9] p-5 rounded-2xl font-medium text-sm border-none h-32 resize-none outline-none leading-relaxed focus:ring-2 focus:ring-primary/20"></textarea>
                            </div>
                            <div class="grid grid-cols-2 gap-6">
                                <div class="space-y-2">
                                    <label class="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Button 1</label>
                                    <input v-model="contentStore.hero.primaryButton" class="w-full bg-[#f1f5f9] p-5 rounded-2xl font-bold text-sm border-none outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div class="space-y-2">
                                    <label class="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Button 2</label>
                                    <input v-model="contentStore.hero.secondaryButton" class="w-full bg-[#f1f5f9] p-5 rounded-2xl font-bold text-sm border-none outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="col-span-12 lg:col-span-4 space-y-6 lg:space-y-8">
                    <!-- Stats -->
                    <div class="bg-white rounded-[2.5rem] p-8 card-shadow text-center">
                        <p class="text-xs font-black text-primary uppercase tracking-[0.2em] mb-4">Portfolio Visitors</p>
                        <h4 class="text-6xl font-black text-primary">{{ contentStore.stats.visitors }}</h4>
                        <p class="text-xs font-bold text-gray-300 mt-2">All time views</p>
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
            <div v-if="currentTab === 'dashboard'" class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch pb-0 lg:pb-0">
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
                        <button @click="showToolkitManager = true" class="text-xs font-black text-primary hover:underline uppercase tracking-widest">Edit</button>
                    </div>
                    <div class="flex-1 flex items-center justify-center">
                        <div class="flex flex-wrap justify-center gap-4">
                            <div v-for="skill in contentStore.toolkit.slice(0, 4)" :key="skill.label" class="flex flex-col items-center gap-2 group">
                                <div class="size-12 bg-soft-pink/10 rounded-full flex items-center justify-center group-hover:bg-primary/10 transition-colors shadow-sm">
                                    <span class="material-symbols-outlined text-primary text-xl">{{ skill.icon }}</span>
                                </div>
                                <span class="text-xs font-black text-gray-400 uppercase tracking-widest">{{ skill.label }}</span>
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
                            <h4 class="font-black text-yellow-700 text-base uppercase tracking-widest">Quick Tip</h4>
                        </div>
                        <p class="text-xs leading-relaxed text-yellow-900/60 font-medium flex-1">
                            Drag the image box above to adjust pixel-perfect centering for the homepage circle frame. Changes here will sync instantly to your Navbar and Sidebar! ✨
                        </p>
                        <div class="mt-4 pt-4 border-t border-yellow-200/50">
                            <p class="text-xs font-black text-yellow-600/50 uppercase tracking-widest line-clamp-1">Pro Tip: Use high-res portraits</p>
                        </div>
                    </div>
                    <!-- Decorative Icon -->
                    <span class="material-symbols-outlined absolute -bottom-8 -right-8 text-9xl text-yellow-600/5 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">auto_awesome</span>
                </div>
            </div>

            <!-- Other Tabs -->
            <div v-else-if="currentTab === 'projects'" class="space-y-8 max-w-5xl mx-auto">
                 <div class="flex justify-between items-center">
                    <h3 class="text-xl font-black text-primary">Managed Projects</h3>
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
                                <span class="px-4 py-1 bg-soft-pink/10 text-primary text-xs font-black uppercase rounded-full mt-2 inline-block">{{ p.tag }}</span>
                             </div>
                             <div class="flex gap-4">
                                <button @click="isEditingProject = true; newProject = { ...p }; showProjectModal = true" class="text-xs font-black text-gray-400 hover:text-primary transition-colors">Edit Details</button>
                                <button @click="deleteProject(idx)" class="text-xs font-black text-red-200 hover:text-red-500 transition-colors">Delete</button>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else-if="currentTab === 'about'" class="max-w-2xl mx-auto space-y-8">
                <div class="bg-white rounded-[2.5rem] p-8 card-shadow">
                    <h3 class="text-base font-black mb-6 flex items-center gap-3">
                        <span class="material-symbols-outlined text-primary">mail</span> Primary Email
                    </h3>
                    <input v-model="contentStore.about.email" class="w-full bg-[#f1f5f9] p-5 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" />
                </div>

                <div class="bg-white rounded-[2.5rem] p-8 card-shadow space-y-6">
                    <div class="flex items-center justify-between">
                        <h3 class="text-base font-black flex items-center gap-3">
                            <span class="material-symbols-outlined text-primary">share</span> Social Presence
                        </h3>
                        <button @click="addSocialLink" class="text-xs font-black text-primary uppercase bg-soft-pink/10 px-4 py-2 rounded-full hover:bg-primary hover:text-white transition-all">+ Add Link</button>
                    </div>
                    <div class="space-y-4">
                         <div v-for="(l, idx) in contentStore.about.social" :key="l.id" class="p-6 bg-[#f1f5f9] rounded-[2rem] relative group border border-transparent hover:border-primary/10 transition-all">
                             <button @click="contentStore.about.social.splice(idx, 1)" class="absolute top-4 right-4 text-red-100 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                                <span class="material-symbols-outlined text-xl">delete</span>
                             </button>
                             <div class="grid grid-cols-2 gap-4 mb-4">
                                 <div class="space-y-1">
                                     <label class="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Platform</label>
                                     <input v-model="l.platform" class="w-full bg-white p-4 rounded-xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/10" />
                                 </div>
                                 <div class="space-y-1">
                                     <label class="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Icon Style</label>
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
                                 <label class="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Profile URL</label>
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
                            <div class="size-3 rounded-full" :class="m.isRead ? 'bg-gray-200' : 'bg-primary shadow-[0_0_15px_rgba(74,120,194,0.5)]'"></div>
                            <div>
                                <h4 class="font-black text-xl text-primary">{{ m.name }}</h4>
                                <p class="text-xs font-black text-gray-400 uppercase tracking-widest">{{ m.email }} • {{ m.date }}</p>
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
                    <p class="text-[15px] font-medium leading-relaxed italic text-gray-600 bg-[#f1f5f9] p-8 rounded-[2rem] border border-white/40 shadow-inner">"{{ m.content }}"</p>
                </div>
            </div>

            <div v-else-if="currentTab === 'accounts'" class="max-w-7xl mx-auto space-y-8 animate-fade-in">
                 <div class="flex justify-between items-center">
                    <h3 class="text-xl font-display font-black text-primary">Quản Lý Tài Khoản</h3>
                    <button @click="openCreateAccountModal" class="bg-primary text-white px-7 py-2.5 rounded-full font-bold text-sm shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-2">
                        <span class="material-symbols-outlined">person_add</span> Thêm Tài Khoản
                    </button>
                </div>
                
                <div class="bg-white rounded-[24px] p-6 card-shadow border border-primary/5 overflow-hidden">
                    <div class="overflow-auto scrollbar-none max-h-[520px]">
                        <table class="w-full text-left border-collapse whitespace-nowrap">
                            <thead class="sticky top-0 z-10 bg-gray-50">
                                <tr class="border-b border-primary/10 text-slate-500 text-xs font-display font-black uppercase tracking-wider">
                                    <th class="py-3 pl-4">Tên hiển thị</th>
                                    <th class="py-3">Tên đăng nhập</th>
                                    <th class="py-3">Chức vụ</th>
                                    <th class="py-3">Trạng thái</th>
                                    <th class="py-3 text-right pr-4">Hành động</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-primary/5">
                                <tr v-if="accountsList.length === 0">
                                    <td colspan="5" class="py-12 text-center text-gray-400 italic font-medium">Chưa có tài khoản nào được tạo.</td>
                                </tr>
                                <tr v-for="(acc, idx) in accountsList" :key="idx" class="hover:bg-gray-50 transition-colors">
                                    <td class="py-4 pl-4 font-bold text-sm text-primary flex items-center gap-3">
                                        <img :src="acc.avatar || ('https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(acc.displayName || 'User'))" class="size-8 rounded-full border border-primary/10 object-cover" />
                                        <span>{{ acc.displayName }}</span>
                                    </td>
                                    <td class="py-4 font-bold text-sm text-[#1e293b]">{{ acc.username }}</td>
                                    <td class="py-4">
                                        <span class="px-3 py-1 text-xs font-black rounded-full"
                                            :class="acc.role === 'admin' ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'"
                                        >
                                            {{ getRoleDisplayLabel(acc.role || 'staff') }}
                                        </span>
                                    </td>
                                    <td class="py-4">
                                        <span class="inline-flex items-center px-3 py-1 text-xs font-bold rounded-full"
                                            :class="acc.isActive !== false ? 'bg-teal-50 text-teal-600' : 'bg-rose-50 text-rose-600'"
                                        >
                                            {{ acc.isActive !== false ? 'Hoạt động' : 'Đã khóa' }}
                                        </span>
                                    </td>
                                    <td class="py-4 text-right pr-4">
                                        <div class="inline-flex items-center justify-end gap-1.5">
                                            <button
                                                @click="toggleUserStatus(acc)"
                                                :disabled="acc.username === authStore.user"
                                                :title="acc.username === authStore.user ? 'Không thể tự khóa tài khoản đang đăng nhập' : (acc.isActive !== false ? 'Khóa tài khoản' : 'Mở khóa tài khoản')"
                                                class="size-8 rounded-full flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                :class="acc.isActive !== false ? 'bg-rose-50 text-rose-500 hover:bg-rose-100' : 'bg-teal-50 text-teal-600 hover:bg-teal-100'"
                                            >
                                                <span class="material-symbols-outlined text-[18px]">{{ acc.isActive !== false ? 'lock' : 'lock_open' }}</span>
                                            </button>
                                            <button
                                                @click="openEditAccountModal(acc)"
                                                title="Chỉnh sửa tài khoản"
                                                class="size-8 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center active:scale-95 transition-all"
                                            >
                                                <span class="material-symbols-outlined text-[18px]">edit</span>
                                            </button>
                                            <button
                                                @click="openResetPasswordModal(acc)"
                                                title="Đổi mật khẩu"
                                                class="size-8 rounded-full bg-primary/5 text-primary hover:bg-primary/15 flex items-center justify-center active:scale-95 transition-all"
                                            >
                                                <span class="material-symbols-outlined text-[18px]">key</span>
                                            </button>
                                            <button
                                                @click="deleteAccount(acc.username)"
                                                :disabled="acc.username === authStore.user"
                                                :title="acc.username === authStore.user ? 'Không thể tự xóa tài khoản đang đăng nhập' : 'Xóa tài khoản'"
                                                class="size-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <span class="material-symbols-outlined text-[18px]">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 2-Column Detached Layout: Left Standalone Role Directory Card · Right Standalone Permission Config Card -->
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <!-- LEFT STANDALONE CARD: Danh sách Chức vụ -->
                    <div class="lg:col-span-4 lg:sticky lg:top-6 bg-white rounded-[2.5rem] p-6 card-shadow border border-primary/5 space-y-4 text-left">
                        <div class="flex items-center justify-between gap-2 pb-4 border-b border-primary/10">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-primary">badge</span>
                                <h4 class="text-base font-display font-black text-[#1e293b]">Danh sách Chức vụ</h4>
                                <span class="px-2 py-0.5 rounded-full bg-[#f1f5f9] text-slate-500 text-xs font-bold">
                                    {{ allRoleKeys.length }}
                                </span>
                            </div>
                            <button
                                @click="openCreateRoleModal"
                                class="h-8 px-3 bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20 rounded-xl font-display font-bold text-xs transition-all flex items-center gap-1 active:scale-95 shrink-0"
                            >
                                <span class="material-symbols-outlined text-sm">add</span>
                                Thêm
                            </button>
                        </div>

                        <div class="space-y-2.5">
                            <button
                                v-for="r in allRoleKeys"
                                :key="r"
                                type="button"
                                @click="selectedRoleToConfigure = r"
                                class="w-full text-left p-4 rounded-2xl border transition-all flex flex-col gap-2 relative overflow-hidden group"
                                :class="selectedRoleToConfigure === r
                                    ? 'bg-primary/[0.04] border-primary ring-1 ring-primary/20 shadow-sm'
                                    : 'bg-[#f8fafc] border-slate-200/80 hover:bg-white hover:border-primary/40'"
                            >
                                <span
                                    v-if="selectedRoleToConfigure === r"
                                    class="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary"
                                ></span>

                                <div class="flex items-center justify-between gap-2">
                                    <span
                                        class="font-display font-black text-sm truncate transition-colors"
                                        :class="selectedRoleToConfigure === r ? 'text-primary' : 'text-[#1e293b] group-hover:text-primary'"
                                    >
                                        {{ getRoleDisplayLabel(r) }}
                                    </span>
                                    <span
                                        v-if="r === 'admin'"
                                        class="shrink-0 px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-xs font-bold"
                                    >
                                        Hệ thống
                                    </span>
                                </div>

                                <p class="text-xs font-semibold text-slate-400 line-clamp-1">
                                    {{ rolePermissions[r]?.description || (r === 'admin' ? 'Toàn quyền quản trị hệ thống' : 'Chưa có mô tả chức vụ') }}
                                </p>

                                <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60 text-xs font-bold text-slate-500">
                                    <span class="inline-flex items-center gap-1">
                                        <span class="material-symbols-outlined text-sm text-slate-400">group</span>
                                        {{ getRoleAccountCount(r) }} nhân sự
                                    </span>
                                    <span
                                        class="inline-flex items-center gap-1"
                                        :class="r === 'admin' ? 'text-teal-600' : 'text-primary'"
                                    >
                                        <span class="material-symbols-outlined text-sm">{{ r === 'admin' ? 'verified_user' : 'apps' }}</span>
                                        {{ r === 'admin' ? 'Toàn quyền' : `${getRoleEnabledSubsystemsCount(r)}/${allSubsystemsList.length} phân hệ` }}
                                    </span>
                                </div>
                            </button>
                        </div>
                    </div>

                    <!-- RIGHT STANDALONE CARD: Quản Lý & Phân Quyền Chức Vụ -->
                    <div v-if="rolePermissions[selectedRoleToConfigure]" class="lg:col-span-8 bg-white rounded-[2.5rem] p-6 md:p-8 card-shadow border border-primary/5 flex flex-col gap-6">
                        <!-- Top Header Bar -->
                        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-primary/10 pb-5">
                            <div class="text-left min-w-0">
                                <div class="flex flex-wrap items-center gap-2">
                                    <h4 class="text-xl font-display font-black text-[#1e293b] flex items-center gap-2">
                                        <span class="material-symbols-outlined text-primary">admin_panel_settings</span>
                                        {{ getRoleDisplayLabel(selectedRoleToConfigure) }}
                                    </h4>
                                    <span class="px-2.5 py-0.5 rounded-full bg-[#f1f5f9] text-slate-500 text-xs font-bold">
                                        Mã: {{ selectedRoleToConfigure }}
                                    </span>
                                    <span class="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-600 text-xs font-bold">
                                        {{ getRoleAccountCount(selectedRoleToConfigure) }} nhân sự
                                    </span>
                                    <span v-if="hasUnsavedRoleChanges" class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 text-xs font-bold">
                                        Chưa lưu thay đổi
                                    </span>
                                </div>
                                <p class="text-xs font-semibold text-slate-500 mt-1">
                                    {{ rolePermissions[selectedRoleToConfigure]?.description || 'Cấu hình phạm vi phân hệ và quyền thao tác chi tiết cho chức vụ này.' }}
                                </p>
                            </div>

                            <div class="flex items-center gap-2 shrink-0">
                                <template v-if="selectedRoleToConfigure !== 'admin'">
                                    <button
                                        @click="openEditRoleModal(selectedRoleToConfigure)"
                                        title="Chỉnh sửa tên & mô tả chức vụ"
                                        class="size-9 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center transition-all active:scale-95"
                                    >
                                        <span class="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button
                                        @click="handleDeleteCustomRole(selectedRoleToConfigure)"
                                        title="Xóa chức vụ này"
                                        class="size-9 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-all active:scale-95"
                                    >
                                        <span class="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </template>
                                <button
                                    @click="handleSaveRolePermissions"
                                    class="bg-primary text-white px-6 py-2.5 font-display font-bold text-xs rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-1.5"
                                >
                                    <span class="material-symbols-outlined text-base">save</span>
                                    Lưu phân quyền
                                </button>
                            </div>
                        </div>

                        <!-- Admin Read-only Notice -->
                        <div v-if="selectedRoleToConfigure === 'admin'" class="bg-primary/[0.04] border border-primary/15 rounded-2xl p-6 text-left flex items-start gap-4">
                            <div class="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <span class="material-symbols-outlined text-2xl">shield_person</span>
                            </div>
                            <div class="space-y-1">
                                <h6 class="text-sm font-display font-black text-[#1e293b]">Chức vụ Quản trị viên mặc định có toàn quyền</h6>
                                <p class="text-xs font-semibold text-slate-500 leading-relaxed">
                                    Tài khoản thuộc chức vụ Quản trị viên luôn được cấp đầy đủ quyền Xem, Thêm, Sửa, Xóa trên toàn bộ {{ allSubsystemsList.length }} phân hệ và trang Quản trị hệ thống. Để giới hạn quyền cho nhân sự, vui lòng chọn hoặc tạo mới một chức vụ khác ở cột bên trái.
                                </p>
                            </div>
                        </div>

                        <!-- Non-Admin Role Permissions -->
                        <template v-else>

                        <!-- Grid for Subsystems (Oct 25 Design) -->
                        <div class="space-y-3.5 text-left">
                            <h4 class="text-xs font-display font-black text-slate-500 uppercase tracking-wider">
                                Phân quyền truy cập các Phân hệ (Subsystem)
                            </h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div
                                    v-for="sub in allSubsystemsList"
                                    :key="sub.id"
                                    @click="activeSubsystem = sub.id"
                                    class="p-4 bg-white rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer select-none group"
                                    :class="activeSubsystem === sub.id
                                        ? 'border-primary ring-1 ring-primary/20 bg-primary/[0.02] shadow-sm'
                                        : 'border-slate-200 hover:border-primary/40'"
                                >
                                    <div class="flex items-center gap-3.5 pr-2">
                                        <label class="relative flex items-center cursor-pointer shrink-0" @click.stop>
                                            <input
                                                type="checkbox"
                                                :checked="isSubsystemChecked(selectedRoleToConfigure, sub.id)"
                                                @change="onSubsystemCheckboxToggle(selectedRoleToConfigure, sub.id)"
                                                class="sr-only peer"
                                            />
                                            <div
                                                class="size-6 rounded-full flex items-center justify-center transition-all border-2"
                                                :class="isSubsystemChecked(selectedRoleToConfigure, sub.id)
                                                    ? 'bg-primary border-primary text-white'
                                                    : 'bg-white border-slate-300 text-transparent'"
                                            >
                                                <span class="material-symbols-outlined text-base font-bold scale-90">check</span>
                                            </div>
                                        </label>

                                        <div class="flex flex-col gap-0.5 text-left">
                                            <span
                                                class="font-display font-black text-xs transition-colors"
                                                :class="activeSubsystem === sub.id ? 'text-primary' : 'text-[#1e293b] group-hover:text-primary'"
                                            >
                                                {{ sub.name }}
                                            </span>
                                            <span class="text-xs font-semibold text-slate-400 leading-normal">
                                                {{ sub.description }}
                                            </span>
                                        </div>
                                    </div>

                                    <div class="size-9 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center border border-slate-200/80 shrink-0">
                                        <span class="material-symbols-outlined text-base">
                                            {{ sub.icon }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Actions Permissions Table List (Only Selected Subsystems) -->
                        <div v-if="enabledActionSubsystems.length > 0" class="space-y-6">
                            <h4 class="text-xs font-display font-black text-slate-500 uppercase tracking-wider text-left">
                                Chi tiết quyền hạn thao tác (Actions Permissions)
                            </h4>

                            <div v-for="sub in enabledActionSubsystems" :key="sub.id" class="space-y-2.5 text-left animate-fade-in">
                                <div class="flex items-center gap-2 px-1">
                                    <span class="material-symbols-outlined text-base text-primary">
                                        {{ sub.icon }}
                                    </span>
                                    <span class="text-xs font-display font-black text-[#1e293b] uppercase tracking-wide">
                                        {{ getSubsystemName(sub.id) }}
                                    </span>
                                </div>

                                <div class="bg-white rounded-[24px] border border-primary/5 overflow-auto scrollbar-none max-h-[420px] shadow-sm">
                                    <table class="w-full border-collapse">
                                        <thead class="sticky top-0 z-10 bg-gray-50">
                                            <tr class="border-b border-slate-200 text-left">
                                                <th class="py-3 px-5 text-xs font-display font-black text-slate-500 uppercase tracking-wider w-[40%]">Chức năng</th>
                                                <th class="py-3 px-5 text-xs font-display font-black text-slate-500 uppercase tracking-wider text-center w-[15%]">Xem</th>
                                                <th class="py-3 px-5 text-xs font-display font-black text-slate-500 uppercase tracking-wider text-center w-[15%]">Thêm</th>
                                                <th class="py-3 px-5 text-xs font-display font-black text-slate-500 uppercase tracking-wider text-center w-[15%]">Sửa</th>
                                                <th class="py-3 px-5 text-xs font-display font-black text-slate-500 uppercase tracking-wider text-center w-[15%]">Xóa</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-slate-100">
                                            <tr v-for="act in actionPermissionsMapping[sub.id]" :key="act.permId" class="hover:bg-slate-50/70 transition-colors">
                                                <td class="py-3.5 px-5 text-xs font-bold text-[#1e293b]">
                                                    {{ act.name }}
                                                </td>
                                                <!-- Xem -->
                                                <td class="py-3.5 px-5 text-center">
                                                    <label v-if="act.showView" class="relative inline-flex items-center justify-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            :checked="isActionPermChecked(selectedRoleToConfigure, sub.id, act.permId, 'read')"
                                                            @change="toggleActionPerm(selectedRoleToConfigure, sub.id, act.permId, 'read')"
                                                            class="sr-only peer"
                                                        />
                                                        <div class="size-5 bg-white border-2 border-slate-300 rounded-full flex items-center justify-center transition-all peer-checked:bg-primary peer-checked:border-primary">
                                                            <span class="material-symbols-outlined text-white text-xs font-bold scale-75">check</span>
                                                        </div>
                                                    </label>
                                                    <div v-else class="size-5 mx-auto bg-slate-100 border border-slate-200 rounded-full cursor-not-allowed"></div>
                                                </td>
                                                <!-- Thêm -->
                                                <td class="py-3.5 px-5 text-center">
                                                    <label v-if="act.showCreate" class="relative inline-flex items-center justify-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            :checked="isActionPermChecked(selectedRoleToConfigure, sub.id, act.permId, 'create')"
                                                            @change="toggleActionPerm(selectedRoleToConfigure, sub.id, act.permId, 'create')"
                                                            class="sr-only peer"
                                                        />
                                                        <div class="size-5 bg-white border-2 border-slate-300 rounded-full flex items-center justify-center transition-all peer-checked:bg-primary peer-checked:border-primary">
                                                            <span class="material-symbols-outlined text-white text-xs font-bold scale-75">check</span>
                                                        </div>
                                                    </label>
                                                    <div v-else class="size-5 mx-auto bg-slate-100 border border-slate-200 rounded-full cursor-not-allowed"></div>
                                                </td>
                                                <!-- Sửa -->
                                                <td class="py-3.5 px-5 text-center">
                                                    <label v-if="act.showUpdate" class="relative inline-flex items-center justify-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            :checked="isActionPermChecked(selectedRoleToConfigure, sub.id, act.permId, 'update')"
                                                            @change="toggleActionPerm(selectedRoleToConfigure, sub.id, act.permId, 'update')"
                                                            class="sr-only peer"
                                                        />
                                                        <div class="size-5 bg-white border-2 border-slate-300 rounded-full flex items-center justify-center transition-all peer-checked:bg-primary peer-checked:border-primary">
                                                            <span class="material-symbols-outlined text-white text-xs font-bold scale-75">check</span>
                                                        </div>
                                                    </label>
                                                    <div v-else class="size-5 mx-auto bg-slate-100 border border-slate-200 rounded-full cursor-not-allowed"></div>
                                                </td>
                                                <!-- Xóa -->
                                                <td class="py-3.5 px-5 text-center">
                                                    <label v-if="act.showDelete" class="relative inline-flex items-center justify-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            :checked="isActionPermChecked(selectedRoleToConfigure, sub.id, act.permId, 'delete')"
                                                            @change="toggleActionPerm(selectedRoleToConfigure, sub.id, act.permId, 'delete')"
                                                            class="sr-only peer"
                                                        />
                                                        <div class="size-5 bg-white border-2 border-slate-300 rounded-full flex items-center justify-center transition-all peer-checked:bg-primary peer-checked:border-primary">
                                                            <span class="material-symbols-outlined text-white text-xs font-bold scale-75">check</span>
                                                        </div>
                                                    </label>
                                                    <div v-else class="size-5 mx-auto bg-slate-100 border border-slate-200 rounded-full cursor-not-allowed"></div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        </template>

                        <div class="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-dashed border-primary/10">
                            <span v-if="hasUnsavedRoleChanges" class="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm">info</span>
                                Bạn có thay đổi phân quyền chưa lưu. Bấm nút bên phải để áp dụng.
                            </span>
                            <span v-else class="text-xs font-semibold text-slate-400">
                                Cấu hình đã được đồng bộ.
                            </span>
                            <button @click="handleSaveRolePermissions" class="bg-primary text-white px-8 py-2.5 font-display font-bold text-xs rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all">
                                Lưu cấu hình phân quyền
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Logs Tab Content -->
            <div v-else-if="currentTab === 'logs'" class="max-w-6xl mx-auto space-y-6 animate-fade-in">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 class="text-xl font-black text-primary flex items-center gap-2">
                            <span class="material-symbols-outlined text-xl">history</span>
                            Lịch Sử Hoạt Động
                        </h3>
                        <p class="text-xs font-bold text-gray-400 mt-1">Theo dõi lịch sử thao tác, truy cập của người dùng trên hệ thống.</p>
                    </div>
                    <button @click="loadLogs" :disabled="logsLoading" class="bg-primary text-white px-6 py-2.5 rounded-full font-bold text-xs shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-2 disabled:opacity-50">
                        <span class="material-symbols-outlined text-sm" :class="logsLoading ? 'animate-spin' : ''">refresh</span>
                        Làm mới
                    </button>
                </div>

                <!-- Filters -->
                <div class="bg-white rounded-[2rem] p-5 card-shadow border border-primary/5 flex flex-col sm:flex-row gap-3">
                    <div class="relative flex-1">
                        <span class="material-symbols-outlined text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 text-base">search</span>
                        <input v-model="logsSearchQuery" type="text" placeholder="Tìm kiếm theo tên, hành động, chi tiết..." class="w-full bg-[#f1f5f9] pl-11 pr-4 py-3 rounded-2xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <select v-model="logsFilterAction" class="bg-[#f1f5f9] px-4 py-3 rounded-2xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer min-w-[180px]">
                        <option value="all">Tất cả hành động</option>
                        <option v-for="action in uniqueActions" :key="action" :value="action">{{ action }}</option>
                    </select>
                </div>

                <!-- Logs Table -->
                <div class="bg-white rounded-[24px] p-6 sm:p-8 card-shadow border border-primary/5 overflow-hidden">
                    <!-- Loading State -->
                    <div v-if="logsLoading" class="flex flex-col items-center justify-center py-16 gap-4">
                        <div class="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <p class="text-xs font-bold text-gray-400">Đang tải lịch sử...</p>
                    </div>

                    <!-- Empty State -->
                    <div v-else-if="filteredLogs.length === 0" class="flex flex-col items-center justify-center py-16 gap-4">
                        <div class="size-20 bg-gray-50 rounded-full flex items-center justify-center">
                            <span class="material-symbols-outlined text-4xl text-gray-200">receipt_long</span>
                        </div>
                        <div class="text-center">
                            <p class="text-sm font-black text-gray-400">Chưa có lịch sử hoạt động</p>
                            <p class="text-xs font-bold text-gray-300 mt-1">Các thao tác trên hệ thống sẽ được ghi nhận tại đây.</p>
                        </div>
                    </div>

                    <!-- Table -->
                    <div v-else class="flex flex-col">
                        <div class="text-right mb-3 shrink-0">
                            <span class="text-xs font-bold text-slate-400">Hiển thị {{ paginatedLogs.length }} / {{ filteredLogs.length }} bản ghi (Tổng {{ activityLogs.length }})</span>
                        </div>
                        <div class="overflow-auto scrollbar-none max-h-[520px]">
                            <table class="w-full text-left border-collapse whitespace-nowrap">
                                <thead class="sticky top-0 z-10 bg-gray-50">
                                    <tr class="border-b border-primary/10 text-slate-500 text-xs font-display font-black uppercase tracking-wider">
                                        <th class="py-3 pl-4">Thời gian</th>
                                        <th class="py-3">Người dùng</th>
                                        <th class="py-3">Chức vụ</th>
                                        <th class="py-3">Hành động</th>
                                        <th class="py-3 pr-4">Chi tiết</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-primary/5">
                                    <tr v-for="log in paginatedLogs" :key="log.id" class="hover:bg-gray-50 transition-colors">
                                        <td class="py-3.5 pl-4 text-xs font-bold text-gray-400">
                                            {{ formatLogTime(log.timestamp) }}
                                        </td>
                                        <td class="py-3.5">
                                            <div class="flex items-center gap-2">
                                                <div class="size-7 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <span class="text-xs font-black text-primary">{{ (log.displayName || log.username || '?').charAt(0).toUpperCase() }}</span>
                                                </div>
                                                <div>
                                                    <p class="text-xs font-black text-[#1e293b]">{{ log.displayName }}</p>
                                                    <p class="text-xs font-bold text-gray-300">@{{ log.username }}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="py-3.5">
                                            <span class="px-2.5 py-1 text-xs font-black rounded-full"
                                                :class="log.role === 'admin' ? 'bg-rose-50 text-rose-600' : log.role === 'system' ? 'bg-gray-100 text-gray-500' : 'bg-teal-50 text-teal-600'"
                                            >
                                                {{ log.role === 'system' ? 'Hệ thống' : getRoleDisplayLabel(log.role) }}
                                            </span>
                                        </td>
                                        <td class="py-3.5">
                                            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black" :class="getActionColor(log.action)">
                                                <span class="material-symbols-outlined text-xs">{{ getActionIcon(log.action) }}</span>
                                                {{ log.action }}
                                            </span>
                                        </td>
                                        <td class="py-3.5 pr-4 text-xs font-bold text-gray-500 max-w-xs truncate">
                                            {{ log.details }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Pagination controls (Pinned outside scroll area) -->
                        <div v-if="filteredLogs.length > 0" class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 text-xs shrink-0">
                            <button 
                                @click="logsPrevPage" 
                                :disabled="logsCurrentPage === 1"
                                class="px-4 py-2 bg-gray-50 hover:bg-primary hover:text-white border border-gray-200 text-gray-500 font-black rounded-xl transition-all disabled:opacity-40 disabled:hover:bg-gray-50 disabled:hover:text-gray-500"
                            >
                                Trước
                            </button>
                            <span class="font-bold text-gray-400">
                                Trang <strong class="text-[#1e293b]">{{ logsCurrentPage }}</strong> / {{ logsTotalPages }}
                            </span>
                            <button 
                                @click="logsNextPage" 
                                :disabled="logsCurrentPage === logsTotalPages"
                                class="px-4 py-2 bg-gray-50 hover:bg-primary hover:text-white border border-gray-200 text-gray-500 font-black rounded-xl transition-all disabled:opacity-40 disabled:hover:bg-gray-50 disabled:hover:text-gray-500"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>



        <!-- Modals: Toolkit Config -->
        <div v-if="showToolkitManager" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div class="bg-white rounded-[2rem] w-full max-w-xl p-8 shadow-2xl animate-scale-up relative border border-primary/10">
                <button @click="showToolkitManager = false" class="absolute top-6 right-6 size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all">
                    <span class="material-symbols-outlined">close</span>
                </button>
                <h2 class="text-xl font-display font-black text-primary mb-2">Toolkit Manager</h2>
                <p class="text-xs font-bold text-gray-400 mb-8">Add or manage your magic skills ✨</p>
                <div class="mb-6">
                    <a href="https://fonts.google.com/icons?selected=Material+Symbols+Outlined" target="_blank" class="text-xs font-black text-primary hover:underline uppercase tracking-widest flex items-center gap-1">
                        <span class="material-symbols-outlined text-xs">open_in_new</span> Find Icon Names Here
                    </a>
                </div>
                
                <!-- Tool List in Modal -->
                <div class="max-h-60 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                    <div v-for="(tool, idx) in contentStore.toolkit" :key="idx" class="flex items-center justify-between p-4 bg-[#f1f5f9] rounded-2xl border border-transparent hover:border-primary/10 transition-all">
                        <div class="flex items-center gap-3">
                            <span class="material-symbols-outlined text-primary">{{ tool.icon }}</span>
                            <span class="font-black text-xs">{{ tool.label }}</span>
                        </div>
                        <div class="flex gap-4">
                            <button @click="editTool(idx)" class="text-xs font-black text-primary hover:underline">Edit</button>
                            <button @click="removeTool(idx)" class="text-xs font-black text-red-300 hover:text-red-500">Remove</button>
                        </div>
                    </div>
                </div>

                <div class="space-y-4 pt-6 border-t border-dashed border-primary/10">
                    <p class="text-xs font-black text-gray-400 uppercase tracking-widest text-center">{{ isEditingTool ? 'Editing Skill' : 'New Magic Skill' }}</p>
                    
                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-black text-gray-400 uppercase tracking-wider text-left">Chọn liên kết nhanh công cụ</label>
                        <select 
                            :value="['/tools?tool=weighbridge', '/tools?tool=allocator', '/tools?tool=vehicles', '/tools?tool=minutes', '/tools?tool=merger', '/tools?tool=converter', '/tools?tool=ocr'].includes(newTool.tool) ? newTool.tool : ''"
                            @change="handleToolSelect"
                            class="w-full bg-gray-50 px-4 py-3.5 rounded-xl text-xs font-black border-none outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                        >
                            <option value="">-- Nhập tùy chỉnh thủ công dưới đây --</option>
                            <option value="/tools?tool=weighbridge">Báo Cáo Tổng Quan 🚢</option>
                            <option value="/tools?tool=allocator">Dữ Liệu Cân Hàng 🚢</option>
                            <option value="/tools?tool=vehicles">Quản Lý Hồ Sơ Phương Tiện 🚢</option>
                            <option value="/tools?tool=minutes">Biên Bản Sà Lan 🚢</option>
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
                    <button @click="addTool" class="w-full py-4 bg-primary text-white font-bold rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all text-sm">
                        {{ isEditingTool ? 'Update Magic Skill ✨' : 'Add Magic Skill ✨' }}
                    </button>
                    <button v-if="isEditingTool" @click="cancelEditTool" class="w-full py-2 text-gray-400 text-xs font-black uppercase tracking-widest">Cancel Editing</button>
                </div>
            </div>
        </div>

        <!-- Project Modal -->
        <div v-if="showProjectModal" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
             <div class="bg-white w-full max-w-xl rounded-[2rem] p-8 card-shadow border border-primary/10 space-y-6 animate-scale-up relative overflow-hidden">
                <header class="flex justify-between items-center">
                    <div>
                        <h3 class="text-xl font-display font-black text-primary">{{ isEditingProject ? 'Edit Project' : 'New Creation' }}</h3>
                        <p class="text-xs font-semibold text-slate-500">Tweak your magic showcase ✨</p>
                    </div>
                    <button @click="showProjectModal = false" class="size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all">
                         <span class="material-symbols-outlined">close</span>
                    </button>
                </header>
                <div class="space-y-6">
                    <div class="flex justify-center">
                        <div class="relative size-44 rounded-[2rem] bg-gray-50 border-2 border-dashed border-primary/20 flex flex-col items-center justify-center overflow-hidden cursor-pointer group hover:bg-white transition-all shadow-inner" @click="triggerProjectImageUpload">
                            <div v-if="newProject.image" class="absolute inset-0 bg-cover bg-center" :style="{ backgroundImage: `url(${newProject.image})` }"></div>
                            <div class="text-center group-hover:scale-110 transition-transform">
                                <span class="material-symbols-outlined text-4xl text-primary/30">add_photo_alternate</span>
                                <p class="text-xs font-black text-primary/30 uppercase mt-2">Upload Artwork</p>
                            </div>
                            <input type="file" ref="projectInput" class="hidden" @change="handleProjectImageUpload" accept="image/*" />
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-xs font-black text-slate-500 uppercase tracking-widest ml-2">Title</label>
                            <input v-model="newProject.title" placeholder="Project name" class="w-full bg-[#f1f5f9] p-4 rounded-2xl text-sm font-bold text-[#1e293b] border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs font-black text-slate-500 uppercase tracking-widest ml-2">Type / Tag</label>
                            <input v-model="newProject.tag" placeholder="e.g. Mobile Design" class="w-full bg-[#f1f5f9] p-4 rounded-2xl text-sm font-bold text-[#1e293b] border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </div>
                    </div>
                    <div class="space-y-1">
                        <label class="text-xs font-black text-slate-500 uppercase tracking-widest ml-2">Description</label>
                        <textarea v-model="newProject.description" placeholder="Share the story behind this magic..." class="w-full bg-[#f1f5f9] p-4 rounded-2xl text-sm font-semibold text-[#1e293b] border-none h-28 resize-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm leading-relaxed"></textarea>
                    </div>
                    <button @click="addProject" class="w-full py-4 bg-primary text-white font-bold rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all text-sm">Confirm Changes ✨</button>
                </div>
             </div>
        </div>

        <!-- Icon Picker -->
        <div v-if="showIconPickerFor" class="fixed inset-0 bg-black/70 backdrop-blur-md z-[250] flex items-center justify-center p-6" @click="showIconPickerFor = null">
            <div class="bg-white rounded-[2rem] p-8 max-w-sm w-full grid grid-cols-4 gap-4 shadow-2xl animate-fade-in" @click.stop>
                <button v-for="icon in iconPresets" :key="icon.name" @click="selectIcon(icon.icon, icon.isSvg)" class="size-16 rounded-2xl bg-[#f1f5f9] flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm border border-gray-100">
                    <div v-if="icon.isSvg && getIconHtml(icon.icon)" v-html="getIconHtml(icon.icon)" class="size-8"></div>
                    <span v-else class="material-symbols-outlined">{{ icon.icon }}</span>
                </button>
            </div>
        </div>

        <!-- Create Account Modal -->
        <div v-if="showAccountModal" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
             <div class="bg-white w-full max-w-xl rounded-[2rem] p-8 card-shadow border border-primary/10 space-y-6 animate-scale-up relative overflow-hidden">
                <header class="flex justify-between items-center">
                    <div>
                        <h3 class="text-xl font-display font-black text-primary">Tạo Tài Khoản</h3>
                        <p class="text-xs font-semibold text-slate-500">Tạo thêm tài khoản mới cho nhân viên ✨</p>
                    </div>
                    <button @click="showAccountModal = false" class="size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all">
                         <span class="material-symbols-outlined">close</span>
                    </button>
                </header>
                <div class="space-y-6">
                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-xs font-black text-slate-500 uppercase tracking-widest ml-2">Tên đăng nhập</label>
                            <input v-model="accountForm.username" placeholder="Ví dụ: nguyenvana" class="w-full bg-[#f1f5f9] p-4 rounded-2xl text-sm font-bold text-[#1e293b] border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs font-black text-slate-500 uppercase tracking-widest ml-2">Tên hiển thị</label>
                            <input v-model="accountForm.displayName" placeholder="Ví dụ: Nguyễn Văn A" class="w-full bg-[#f1f5f9] p-4 rounded-2xl text-sm font-bold text-[#1e293b] border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-xs font-black text-slate-500 uppercase tracking-widest ml-2">Mật khẩu</label>
                            <input v-model="accountForm.password" type="password" placeholder="••••••••" class="w-full bg-[#f1f5f9] p-4 rounded-2xl text-sm font-bold text-[#1e293b] border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs font-black text-slate-500 uppercase tracking-widest ml-2">Chức vụ</label>
                            <select v-model="accountForm.role" class="w-full bg-[#f1f5f9] p-4 rounded-2xl text-sm font-bold text-[#1e293b] border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm">
                                <option value="admin">{{ getRoleDisplayLabel('admin') }}</option>
                                <option v-for="r in roleNames" :key="r" :value="r">
                                    {{ getRoleDisplayLabel(r) }}
                                </option>
                            </select>
                        </div>
                    </div>
                    


                    <button @click="handleCreateAccount" class="w-full py-4 bg-primary text-white font-bold rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all text-sm">Xác Nhận Tạo ✨</button>
                </div>
             </div>
        </div>

        <!-- Edit Account Modal -->
        <div v-if="showEditAccountModal" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
             <div class="bg-white w-full max-w-xl rounded-[2rem] p-8 card-shadow border border-primary/10 space-y-6 animate-scale-up relative overflow-hidden">
                <header class="flex justify-between items-center">
                    <div>
                        <h3 class="text-xl font-display font-black text-primary">Chỉnh Sửa Tài Khoản</h3>
                        <p class="text-xs font-semibold text-slate-500">Thay đổi thông tin tài khoản: <span class="text-primary font-black">{{ editAccountForm.username }}</span> ✨</p>
                    </div>
                    <button @click="showEditAccountModal = false" class="size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all">
                         <span class="material-symbols-outlined">close</span>
                    </button>
                </header>
                <div class="space-y-6">
                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-xs font-black text-slate-500 uppercase tracking-widest ml-2">Tên hiển thị</label>
                            <input v-model="editAccountForm.displayName" placeholder="Ví dụ: Nguyễn Văn A" class="w-full bg-[#f1f5f9] p-4 rounded-2xl text-sm font-bold text-[#1e293b] border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs font-black text-slate-500 uppercase tracking-widest ml-2">Chức vụ</label>
                            <select v-model="editAccountForm.role" class="w-full bg-[#f1f5f9] p-4 rounded-2xl text-sm font-bold text-[#1e293b] border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm">
                                <option value="admin">{{ getRoleDisplayLabel('admin') }}</option>
                                <option v-for="r in roleNames" :key="r" :value="r">
                                    {{ getRoleDisplayLabel(r) }}
                                </option>
                                <option
                                    v-if="editAccountForm.role && editAccountForm.role !== 'admin' && !roleNames.includes(editAccountForm.role)"
                                    :value="editAccountForm.role"
                                >
                                    {{ getRoleDisplayLabel(editAccountForm.role) }} (Chức vụ đã bị xóa)
                                </option>
                            </select>
                        </div>
                    </div>
                    


                    <button @click="handleEditAccount" class="w-full py-4 bg-primary text-white font-bold rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all text-sm">Lưu Thay Đổi ✨</button>
                </div>
             </div>
        </div>

        <!-- Reset Password Modal -->
        <div v-if="showResetPasswordModal" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
             <div class="bg-white w-full max-w-md rounded-[2rem] p-8 card-shadow border border-primary/10 space-y-6 animate-scale-up relative overflow-hidden">
                <header class="flex justify-between items-center">
                    <div>
                        <h3 class="text-xl font-display font-black text-primary">Đặt Lại Mật Khẩu</h3>
                        <p class="text-xs font-semibold text-slate-500">Đặt lại mật khẩu cho tài khoản: <span class="text-primary font-black">{{ resetPasswordForm.username }}</span></p>
                    </div>
                    <button @click="showResetPasswordModal = false" class="size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all">
                         <span class="material-symbols-outlined">close</span>
                    </button>
                </header>
                <div class="space-y-6">
                    <div class="space-y-1">
                        <label class="text-xs font-black text-slate-500 uppercase tracking-widest ml-2">Mật khẩu mới</label>
                        <input v-model="resetPasswordForm.newPassword" type="password" placeholder="••••••••" class="w-full bg-[#f1f5f9] p-4 rounded-2xl text-sm font-bold text-[#1e293b] border-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                    </div>
                    <button @click="handleResetPassword" class="w-full py-4 bg-primary text-white font-bold rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all text-sm">Đặt Lại Mật Khẩu ✨</button>
                </div>
             </div>
        </div>

        <!-- Create / Edit Role (Chức Vụ) Modal -->
        <div v-if="showRoleModal" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div class="bg-white w-full max-w-lg rounded-[2rem] p-8 card-shadow border border-primary/10 space-y-6 animate-scale-up relative text-left">
                <header class="flex justify-between items-start gap-4">
                    <div>
                        <h3 class="text-xl font-display font-black text-[#1e293b]">
                            {{ roleModalMode === 'create' ? 'Tạo Chức Vụ Mới' : 'Chỉnh Sửa Chức Vụ' }}
                        </h3>
                        <p class="text-xs font-semibold text-slate-500 mt-1">
                            {{ roleModalMode === 'create'
                                ? 'Thiết lập tên, mô tả và sao chép nhanh bộ quyền mẫu nếu cần.'
                                : `Cập nhật tên hiển thị & mô tả cho mã chức vụ "${roleModalForm.key}".` }}
                        </p>
                    </div>
                    <button @click="showRoleModal = false" class="size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all shrink-0">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </header>

                <div class="space-y-4">
                    <div class="space-y-1.5">
                        <label class="text-xs font-display font-black text-slate-600 uppercase tracking-wider ml-1">Tên chức vụ *</label>
                        <input
                            v-model="roleModalForm.label"
                            @keyup.enter="submitRoleModal"
                            type="text"
                            placeholder="Ví dụ: Kế toán kho, Điều độ cảng..."
                            class="w-full bg-[#f1f5f9] px-4 py-3.5 rounded-2xl text-xs font-bold text-[#1e293b] border border-transparent focus:border-primary/40 outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    <div class="space-y-1.5">
                        <label class="text-xs font-display font-black text-slate-600 uppercase tracking-wider ml-1">Mô tả chức vụ</label>
                        <input
                            v-model="roleModalForm.description"
                            @keyup.enter="submitRoleModal"
                            type="text"
                            placeholder="Ví dụ: Phụ trách đối chiếu tồn kho và xuất báo cáo hàng ngày"
                            class="w-full bg-[#f1f5f9] px-4 py-3.5 rounded-2xl text-xs font-semibold text-[#1e293b] border border-transparent focus:border-primary/40 outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    <div v-if="roleModalMode === 'create'" class="space-y-1.5">
                        <label class="text-xs font-display font-black text-slate-600 uppercase tracking-wider ml-1">Sao chép quyền từ chức vụ có sẵn (Tùy chọn)</label>
                        <select
                            v-model="roleModalForm.cloneFrom"
                            class="w-full bg-[#f1f5f9] px-4 py-3.5 rounded-2xl text-xs font-bold text-[#1e293b] border border-transparent focus:border-primary/40 outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="">Không sao chép (Khởi tạo trống)</option>
                            <option v-for="r in roleNames" :key="r" :value="r">
                                Sao chép từ: {{ getRoleDisplayLabel(r) }} ({{ getRoleEnabledSubsystemsCount(r) }} phân hệ)
                            </option>
                        </select>
                    </div>
                </div>

                <div class="flex items-center justify-end gap-3 pt-2">
                    <button
                        @click="showRoleModal = false"
                        class="bg-white border border-primary/10 hover:border-primary text-primary font-display font-bold text-xs px-5 py-2.5 rounded-2xl hover:bg-primary/5 active:scale-95 transition-all"
                    >
                        Hủy
                    </button>
                    <button
                        @click="submitRoleModal"
                        class="bg-primary text-white font-display font-bold text-xs px-7 py-2.5 rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all"
                    >
                        {{ roleModalMode === 'create' ? 'Tạo chức vụ' : 'Cập nhật chức vụ' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Toast -->
        <div v-if="showToast" class="fixed bottom-12 left-1/2 -translate-x-1/2 bg-[#1e293b] text-white px-10 py-5 rounded-full font-black text-xs shadow-2xl z-[300] animate-bounce-short tracking-wide border border-white/10 backdrop-blur-xl">
            {{ toastMessage }}
        </div>
    </div>
</template>


<style scoped>
.card-shadow { box-shadow: 0 20px 60px -15px rgba(74, 120, 194, 0.12); }
.blob-shape { border-radius: 64% 36% 27% 73% / 55% 23% 77% 45%; }
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(74, 120, 194, 0.2); border-radius: 10px; }
@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
@keyframes scale-up { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
.animate-scale-up { animation: scale-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
@keyframes bounce-short { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -10px); } }
.animate-bounce-short { animation: bounce-short 2s infinite; }
</style>

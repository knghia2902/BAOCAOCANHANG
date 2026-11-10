<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';

const props = defineProps<{
    activeKey: string;
    isCollapsed?: boolean;
    isPinned?: boolean;
}>();

const emit = defineEmits<{
    (e: 'select-node', key: string): void;
    (e: 'update:isCollapsed', collapsed: boolean): void;
    (e: 'update:isPinned', pinned: boolean): void;
}>();

// Pin state: Default false (Mặc định ẩn vào trong)
const localPinned = ref(props.isPinned ?? false);
const pinned = computed({
    get: () => (props.isPinned !== undefined ? props.isPinned : localPinned.value),
    set: (val: boolean) => {
        localPinned.value = val;
        emit('update:isPinned', val);
        emit('update:isCollapsed', !val);
    }
});

// Hover and Drawer state
const isHovered = ref(false);
const isMobileOpen = ref(false);

const isOpen = computed(() => {
    return pinned.value || isHovered.value || isMobileOpen.value;
});

// Hover timer with grace period (180ms) for smooth interaction without accidental flickering
let leaveTimer: ReturnType<typeof setTimeout> | null = null;

const handleMouseEnter = () => {
    if (leaveTimer) {
        clearTimeout(leaveTimer);
        leaveTimer = null;
    }
    isHovered.value = true;
};

const handleMouseLeave = () => {
    if (leaveTimer) {
        clearTimeout(leaveTimer);
    }
    leaveTimer = setTimeout(() => {
        isHovered.value = false;
        leaveTimer = null;
    }, 180);
};

const togglePin = () => {
    pinned.value = !pinned.value;
    if (pinned.value) {
        isHovered.value = true;
    }
};

const hideSidebar = () => {
    pinned.value = false;
    isHovered.value = false;
    isMobileOpen.value = false;
    if (leaveTimer) {
        clearTimeout(leaveTimer);
        leaveTimer = null;
    }
};

const handleTriggerClick = () => {
    isMobileOpen.value = !isMobileOpen.value;
    isHovered.value = true;
};

const handleSelect = (key: string) => {
    emit('select-node', key);
    // Auto-close on mobile/touch screens
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
        hideSidebar();
    }
};

onUnmounted(() => {
    if (leaveTimer) {
        clearTimeout(leaveTimer);
    }
});

// Accordion groups inside sidebar
const expandedGroups = ref<Record<string, boolean>>({
    modules: true,
    reports: true,
    categories: true
});

const toggleGroup = (groupId: string) => {
    expandedGroups.value[groupId] = !expandedGroups.value[groupId];
};

interface NavItem {
    key: string;
    label: string;
    icon: string;
    badge?: string;
    badgeType?: 'primary' | 'teal' | 'rose' | 'slate';
}

const moduleItems: NavItem[] = [
    { key: 'vessel-source', label: 'Tạo nguồn tàu', icon: 'directions_boat' },
    { key: 'scale-data', label: 'Dữ liệu cân', icon: 'balance' }
];

const reportItems: NavItem[] = [
    { key: 'report-inventory', label: 'Báo cáo tồn kho', icon: 'warehouse' },
    { key: 'report-shipment', label: 'Báo cáo lô hàng', icon: 'monitoring' },
    { key: 'report-deheus', label: 'Báo cáo Phân bổ De Heus', icon: 'call_split' }
];

const afterReportItems: NavItem[] = [
    { key: 'vehicles', label: 'Quản lý hồ sơ phương tiện', icon: 'sailing' },
    { key: 'minutes', label: 'Biên bản', icon: 'description' }
];

const categoryItems: NavItem[] = [
    { key: 'category-vehicles', label: 'Danh sách xe', icon: 'local_shipping' },
    { key: 'category-customers', label: 'Danh sách khách hàng', icon: 'groups' },
    { key: 'category-warehouses', label: 'Danh sách kho hàng', icon: 'domain' },
    { key: 'category-goods', label: 'Danh mục hàng hóa', icon: 'inventory_2' }
];

const isReportActive = computed(() => reportItems.some(r => r.key === props.activeKey));
</script>

<template>
    <!-- Outer Container: Manages layout docking vs floating overlay -->
    <div
        :class="[
            'font-display no-print select-none transition-all duration-300 z-40',
            pinned
                ? 'relative shrink-0 w-72 h-full'
                : 'absolute inset-y-0 left-0 flex pointer-events-none'
        ]"
    >
        <!-- Mobile Backdrop Overlay (only on small screens when drawer is open) -->
        <div
            v-if="!pinned && isOpen"
            class="pointer-events-auto fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-30 md:hidden"
            @click="hideSidebar"
        ></div>

        <!-- Left Edge Hover Detection Strip (desktop only - effortless gesture) -->
        <div
            v-if="!pinned"
            class="pointer-events-auto absolute left-0 top-0 bottom-0 w-3 md:w-4 z-30 cursor-pointer"
            @mouseenter="handleMouseEnter"
        ></div>

        <!-- Trigger Tab Button (Nút Tab nổi mép trái khi đang ẩn vào trong) -->
        <div
            v-if="!pinned && !isOpen"
            @mouseenter="handleMouseEnter"
            @click="handleTriggerClick"
            class="pointer-events-auto absolute left-0 top-16 md:top-20 z-30 flex items-center bg-white/95 hover:bg-primary backdrop-blur-md border border-primary/20 hover:border-primary border-l-0 rounded-r-2xl shadow-md hover:shadow-lg py-3 px-2 cursor-pointer transition-all duration-200 group text-primary hover:text-white"
            title="Rê chuột hoặc bấm để mở Sơ đồ cây"
        >
            <div class="flex flex-col items-center gap-1.5 select-none">
                <span class="material-symbols-outlined text-lg group-hover:scale-110 transition-transform">account_tree</span>
                <span class="text-[10px] font-display font-black tracking-widest [writing-mode:vertical-rl] rotate-180 uppercase">
                    Sơ đồ cây
                </span>
                <span class="material-symbols-outlined text-xs group-hover:translate-x-0.5 transition-transform">chevron_right</span>
            </div>
        </div>

        <!-- Sidebar Panel (Thanh Sơ đồ cây chính) -->
        <aside
            @mouseenter="handleMouseEnter"
            @mouseleave="handleMouseLeave"
            :class="[
                'pointer-events-auto flex flex-col bg-white border border-primary/10 overflow-hidden font-display transition-all duration-300 ease-out',
                pinned
                    ? 'w-full h-full rounded-[24px] soft-shadow'
                    : [
                          'absolute top-3.5 md:top-4 bottom-3.5 md:bottom-4 left-3.5 md:left-4 w-72 md:w-80 rounded-[24px] shadow-2xl z-40',
                          isOpen
                              ? 'translate-x-0 opacity-100'
                              : '-translate-x-[calc(100%+3rem)] opacity-0 pointer-events-none'
                      ]
            ]"
        >
            <!-- Sidebar Header (DESIGN.md Mục 5B) -->
            <div class="p-3.5 px-4 border-b border-primary/5 flex items-center justify-between shrink-0 bg-slate-50/50">
                <div class="flex items-center gap-2.5 min-w-0">
                    <div class="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                        <span class="material-symbols-outlined text-lg">account_tree</span>
                    </div>
                    <div class="truncate">
                        <div class="text-xs uppercase font-black tracking-wider text-primary leading-tight">Sơ đồ cây</div>
                        <h2 class="text-xs font-black text-[#1e293b] truncate">Điều hành tập trung</h2>
                    </div>
                </div>

                <!-- Header Action Buttons: Pin & Hide/Close -->
                <div class="flex items-center gap-1.5 shrink-0">
                    <!-- Pin / Unpin Button -->
                    <button
                        type="button"
                        @click="togglePin"
                        :class="[
                            'size-8 rounded-full flex items-center justify-center transition-all cursor-pointer',
                            pinned
                                ? 'bg-primary text-white shadow-soft hover:bg-primary/90'
                                : 'bg-[#f1f5f9] text-gray-400 hover:text-primary hover:scale-105 active:scale-95'
                        ]"
                        :title="pinned ? 'Bỏ ghim (Tự động ẩn khi di chuột ra)' : 'Ghim cố định sơ đồ cây'"
                    >
                        <span class="material-symbols-outlined text-base" :class="{ '-rotate-45': pinned }">
                            push_pin
                        </span>
                    </button>

                    <!-- Hide / Collapse Button -->
                    <button
                        type="button"
                        @click="hideSidebar"
                        class="size-8 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-primary hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="Ẩn sơ đồ cây vào trong"
                    >
                        <span class="material-symbols-outlined text-lg">
                            chevron_left
                        </span>
                    </button>
                </div>
            </div>

            <!-- Tree Navigation Body -->
            <div class="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                <!-- ================= NHÁNH 1: PHÂN HỆ ================= -->
                <div class="space-y-1.5">
                    <button
                        type="button"
                        @click="toggleGroup('modules')"
                        class="w-full flex items-center justify-between px-2 py-1 text-xs font-display font-black uppercase tracking-widest text-gray-400 hover:text-primary transition-colors cursor-pointer group"
                    >
                        <span class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-sm text-primary">folder_open</span>
                            1. Phân hệ
                        </span>
                        <span
                            class="material-symbols-outlined text-sm transition-transform text-gray-400 group-hover:text-primary"
                            :class="{ '-rotate-90': !expandedGroups.modules }"
                        >
                            expand_more
                        </span>
                    </button>

                    <div v-show="expandedGroups.modules" class="space-y-1.5">
                        <!-- Tạo nguồn tàu & Dữ liệu cân -->
                        <button
                            v-for="item in moduleItems"
                            :key="item.key"
                            type="button"
                            @click="handleSelect(item.key)"
                            :class="[
                                'w-full flex items-center gap-2.5 p-2.5 px-3 rounded-[16px] cursor-pointer transition-all text-xs font-black border text-left group',
                                activeKey === item.key
                                    ? 'bg-primary text-white border-primary shadow-soft'
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-100 hover:border-primary/20'
                            ]"
                        >
                            <span
                                :class="[
                                    'material-symbols-outlined text-base shrink-0',
                                    activeKey === item.key ? 'text-white' : 'text-primary group-hover:scale-105 transition-transform'
                                ]"
                            >
                                {{ item.icon }}
                            </span>
                            <span class="truncate flex-1">{{ item.label }}</span>
                            <span
                                v-if="item.badge"
                                :class="[
                                    'px-2 py-0.5 rounded-full text-xs font-bold shrink-0',
                                    activeKey === item.key
                                        ? 'bg-white/20 text-white'
                                        : item.badgeType === 'teal'
                                          ? 'bg-teal-50 text-teal-600 border border-teal-200/60'
                                          : 'bg-primary/10 text-primary'
                                ]"
                            >
                                {{ item.badge }}
                            </span>
                        </button>

                        <!-- Nhánh con: Báo cáo -->
                        <div class="space-y-1.5">
                            <button
                                type="button"
                                @click="toggleGroup('reports')"
                                :class="[
                                    'w-full flex items-center justify-between p-2.5 px-3 rounded-[16px] cursor-pointer transition-all text-xs font-black border text-left',
                                    isReportActive && !expandedGroups.reports
                                        ? 'bg-primary/10 text-primary border-primary/20'
                                        : 'bg-[#f1f5f9]/70 text-[#1e293b] hover:bg-[#f1f5f9] border-slate-200/60'
                                ]"
                            >
                                <span class="flex items-center gap-2.5 min-w-0">
                                    <span class="material-symbols-outlined text-base text-primary shrink-0">bar_chart</span>
                                    <span class="truncate">Báo cáo</span>
                                </span>
                                <span
                                    class="material-symbols-outlined text-sm text-slate-400 transition-transform duration-200"
                                    :class="{ '-rotate-90': !expandedGroups.reports }"
                                >
                                    expand_more
                                </span>
                            </button>

                            <!-- Các mục con trong Báo cáo -->
                            <div
                                v-show="expandedGroups.reports"
                                class="ml-3.5 pl-2.5 border-l-2 border-primary/15 space-y-1.5"
                            >
                                <button
                                    v-for="rep in reportItems"
                                    :key="rep.key"
                                    type="button"
                                    @click="handleSelect(rep.key)"
                                    :class="[
                                        'w-full flex items-center gap-2 p-2 px-3 rounded-[14px] cursor-pointer transition-all text-xs font-black border text-left group',
                                        activeKey === rep.key
                                            ? 'bg-primary text-white border-primary shadow-soft'
                                            : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-100 hover:border-primary/20'
                                    ]"
                                >
                                    <span
                                        :class="[
                                            'material-symbols-outlined text-base shrink-0',
                                            activeKey === rep.key ? 'text-white' : 'text-teal-600'
                                        ]"
                                    >
                                        {{ rep.icon }}
                                    </span>
                                    <span class="truncate flex-1">{{ rep.label }}</span>
                                    <span
                                        v-if="rep.badge"
                                        :class="[
                                            'px-1.5 py-0.5 rounded-full text-xs font-bold shrink-0',
                                            activeKey === rep.key ? 'bg-white/20 text-white' : 'bg-teal-50 text-teal-600'
                                        ]"
                                    >
                                        {{ rep.badge }}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <!-- Quản lý hồ sơ phương tiện & Biên bản -->
                        <button
                            v-for="item in afterReportItems"
                            :key="item.key"
                            type="button"
                            @click="handleSelect(item.key)"
                            :class="[
                                'w-full flex items-center gap-2.5 p-2.5 px-3 rounded-[16px] cursor-pointer transition-all text-xs font-black border text-left group',
                                activeKey === item.key
                                    ? 'bg-primary text-white border-primary shadow-soft'
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-100 hover:border-primary/20'
                            ]"
                        >
                            <span
                                :class="[
                                    'material-symbols-outlined text-base shrink-0',
                                    activeKey === item.key ? 'text-white' : 'text-primary group-hover:scale-105 transition-transform'
                                ]"
                            >
                                {{ item.icon }}
                            </span>
                            <span class="truncate flex-1">{{ item.label }}</span>
                        </button>
                    </div>
                </div>

                <div class="h-px bg-primary/5"></div>

                <!-- ================= NHÁNH 2: DANH MỤC ================= -->
                <div class="space-y-1.5">
                    <button
                        type="button"
                        @click="toggleGroup('categories')"
                        class="w-full flex items-center justify-between px-2 py-1 text-xs font-display font-black uppercase tracking-widest text-gray-400 hover:text-primary transition-colors cursor-pointer group"
                    >
                        <span class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-sm text-teal-600">dataset</span>
                            2. Danh mục
                        </span>
                        <span
                            class="material-symbols-outlined text-sm transition-transform text-gray-400 group-hover:text-primary"
                            :class="{ '-rotate-90': !expandedGroups.categories }"
                        >
                            expand_more
                        </span>
                    </button>

                    <div v-show="expandedGroups.categories" class="space-y-1.5">
                        <button
                            v-for="item in categoryItems"
                            :key="item.key"
                            type="button"
                            @click="handleSelect(item.key)"
                            :class="[
                                'w-full flex items-center gap-2.5 p-2.5 px-3 rounded-[16px] cursor-pointer transition-all text-xs font-black border text-left group',
                                activeKey === item.key
                                    ? 'bg-primary text-white border-primary shadow-soft'
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-100 hover:border-primary/20'
                            ]"
                        >
                            <span
                                :class="[
                                    'material-symbols-outlined text-base shrink-0',
                                    activeKey === item.key ? 'text-white' : 'text-teal-600 group-hover:scale-105 transition-transform'
                                ]"
                            >
                                {{ item.icon }}
                            </span>
                            <span class="truncate flex-1">{{ item.label }}</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Sidebar Footer -->
            <div class="p-3 border-t border-primary/5 bg-slate-50/40 flex items-center justify-between text-xs font-bold text-gray-400 shrink-0">
                <span class="truncate">Cảng Nguyên Ngọc</span>
                <span class="text-primary font-black">v2.2</span>
            </div>
        </aside>
    </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(74, 120, 194, 0.2);
    border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(74, 120, 194, 0.4);
}
</style>

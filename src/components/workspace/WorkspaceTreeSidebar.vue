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

// Pin state: Default false (Mặc định thu gọn thành cột biểu tượng)
const localPinned = ref(props.isPinned ?? false);
const pinned = computed({
    get: () => (props.isPinned !== undefined ? props.isPinned : localPinned.value),
    set: (val: boolean) => {
        localPinned.value = val;
        emit('update:isPinned', val);
        emit('update:isCollapsed', !val);
    }
});

// Hover state
const isHovered = ref(false);

// Expanded when pinned OR when hovered
const isExpanded = computed(() => {
    return pinned.value || isHovered.value;
});

// Hover timer with 180ms grace period to avoid flicker on edge crossings
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

const collapseSidebar = () => {
    pinned.value = false;
    isHovered.value = false;
    if (leaveTimer) {
        clearTimeout(leaveTimer);
        leaveTimer = null;
    }
};

const handleSelect = (key: string) => {
    emit('select-node', key);
    // On small screens, close after selecting
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
        isHovered.value = false;
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
    if (!isExpanded.value) {
        isHovered.value = true;
        expandedGroups.value[groupId] = true;
        return;
    }
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
    <!-- Outer Wrapper: Preserves column space in layout, captures mouseenter/mouseleave -->
    <div
        class="h-full relative font-display select-none shrink-0 no-print transition-all duration-300"
        :class="[
            pinned ? 'w-72' : 'w-[68px]'
        ]"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
    >
        <!-- Actual Sidebar: Collapses to w-[68px] with icons; Expands to w-72 / w-80 on hover as overlay -->
        <aside
            :class="[
                'h-full flex flex-col bg-white rounded-[24px] border border-primary/10 font-display overflow-hidden select-none transition-all duration-300 ease-out',
                pinned
                    ? 'w-full soft-shadow'
                    : isExpanded
                      ? 'absolute top-0 bottom-0 left-0 w-72 md:w-80 shadow-2xl z-40 ring-1 ring-primary/10'
                      : 'w-full soft-shadow'
            ]"
        >
            <!-- Sidebar Header (DESIGN.md Mục 5B) -->
            <div class="p-3.5 px-3.5 border-b border-primary/5 flex items-center justify-between shrink-0 bg-slate-50/50 min-h-[57px]">
                <!-- Expanded Header Title -->
                <div v-if="isExpanded" class="flex items-center gap-2.5 min-w-0">
                    <div class="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                        <span class="material-symbols-outlined text-lg">account_tree</span>
                    </div>
                    <div class="truncate">
                        <div class="text-xs uppercase font-black tracking-wider text-primary leading-tight">Sơ đồ cây</div>
                        <h2 class="text-xs font-black text-[#1e293b] truncate">Điều hành tập trung</h2>
                    </div>
                </div>

                <!-- Collapsed Header Icon -->
                <div
                    v-else
                    class="mx-auto size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 cursor-pointer"
                    title="Sơ đồ cây - Rê chuột để mở rộng"
                    @click="isHovered = true"
                >
                    <span class="material-symbols-outlined text-lg">account_tree</span>
                </div>

                <!-- Header Action Buttons (Only when expanded) -->
                <div v-if="isExpanded" class="flex items-center gap-1 shrink-0">
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
                        :title="pinned ? 'Bỏ ghim (Tự động thu gọn khi di chuột ra)' : 'Ghim cố định sơ đồ cây'"
                    >
                        <span class="material-symbols-outlined text-base" :class="{ '-rotate-45': pinned }">
                            push_pin
                        </span>
                    </button>

                    <!-- Collapse Button -->
                    <button
                        type="button"
                        @click="collapseSidebar"
                        class="size-8 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-primary hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="Thu gọn thành cột biểu tượng"
                    >
                        <span class="material-symbols-outlined text-lg">
                            chevron_left
                        </span>
                    </button>
                </div>
            </div>

            <!-- Tree Navigation Body -->
            <div class="flex-1 overflow-y-auto p-2.5 space-y-3.5 custom-scrollbar">
                <!-- ================= NHÁNH 1: PHÂN HỆ ================= -->
                <div class="space-y-1.5">
                    <!-- Branch Header -->
                    <button
                        v-if="isExpanded"
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
                    <div v-else class="py-1 flex justify-center" title="1. Phân hệ">
                        <span class="material-symbols-outlined text-base text-primary/70">folder_open</span>
                    </div>

                    <!-- Module Items (Tạo nguồn tàu & Dữ liệu cân) -->
                    <div v-show="!isExpanded || expandedGroups.modules" class="space-y-1.5">
                        <button
                            v-for="item in moduleItems"
                            :key="item.key"
                            type="button"
                            @click="handleSelect(item.key)"
                            :title="item.label"
                            :class="[
                                'w-full flex items-center gap-2.5 p-2 rounded-[16px] cursor-pointer transition-all text-xs font-black border text-left group',
                                !isExpanded ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
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
                            <span v-if="isExpanded" class="truncate flex-1">{{ item.label }}</span>
                            <span
                                v-if="isExpanded && item.badge"
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
                            <!-- Báo cáo Accordion Header (Chỉ hiện khi mở rộng) -->
                            <button
                                v-if="isExpanded"
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

                            <!-- Các mục con Báo cáo (Kho, Lô hàng, De Heus) -->
                            <div
                                v-show="!isExpanded || expandedGroups.reports"
                                :class="[
                                    !isExpanded
                                        ? 'space-y-1.5'
                                        : 'ml-3.5 pl-2.5 border-l-2 border-primary/15 space-y-1.5'
                                ]"
                            >
                                <button
                                    v-for="rep in reportItems"
                                    :key="rep.key"
                                    type="button"
                                    @click="handleSelect(rep.key)"
                                    :title="rep.label"
                                    :class="[
                                        'w-full flex items-center gap-2 rounded-[14px] cursor-pointer transition-all text-xs font-black border text-left group',
                                        !isExpanded ? 'justify-center px-0 py-2.5 rounded-[16px]' : 'p-2 px-3',
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
                                    <span v-if="isExpanded" class="truncate flex-1">{{ rep.label }}</span>
                                    <span
                                        v-if="isExpanded && rep.badge"
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
                            :title="item.label"
                            :class="[
                                'w-full flex items-center gap-2.5 p-2 rounded-[16px] cursor-pointer transition-all text-xs font-black border text-left group',
                                !isExpanded ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
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
                            <span v-if="isExpanded" class="truncate flex-1">{{ item.label }}</span>
                        </button>
                    </div>
                </div>

                <div class="h-px bg-primary/5"></div>

                <!-- ================= NHÁNH 2: DANH MỤC ================= -->
                <div class="space-y-1.5">
                    <button
                        v-if="isExpanded"
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
                    <div v-else class="py-1 flex justify-center" title="2. Danh mục">
                        <span class="material-symbols-outlined text-base text-teal-600">dataset</span>
                    </div>

                    <div v-show="!isExpanded || expandedGroups.categories" class="space-y-1.5">
                        <button
                            v-for="item in categoryItems"
                            :key="item.key"
                            type="button"
                            @click="handleSelect(item.key)"
                            :title="item.label"
                            :class="[
                                'w-full flex items-center gap-2.5 p-2 rounded-[16px] cursor-pointer transition-all text-xs font-black border text-left group',
                                !isExpanded ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
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
                            <span v-if="isExpanded" class="truncate flex-1">{{ item.label }}</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Sidebar Footer -->
            <div class="p-3 border-t border-primary/5 bg-slate-50/40 flex items-center justify-between text-xs font-bold text-gray-400 shrink-0">
                <template v-if="isExpanded">
                    <span class="truncate">Cảng Nguyên Ngọc</span>
                    <span class="text-primary font-black">v2.2</span>
                </template>
                <span v-else class="material-symbols-outlined text-base text-primary/60 mx-auto" title="Cảng Nguyên Ngọc v2.2">anchor</span>
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

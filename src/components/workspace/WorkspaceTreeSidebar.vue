<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
    activeKey: string;
    isCollapsed?: boolean;
}>();

const emit = defineEmits<{
    (e: 'select-node', key: string): void;
    (e: 'update:isCollapsed', collapsed: boolean): void;
}>();

const localCollapsed = ref(false);
const collapsed = computed({
    get: () => (props.isCollapsed !== undefined ? props.isCollapsed : localCollapsed.value),
    set: (val: boolean) => {
        localCollapsed.value = val;
        emit('update:isCollapsed', val);
    }
});

const expandedGroups = ref<Record<string, boolean>>({
    modules: true,
    reports: true,
    categories: true
});

const toggleGroup = (groupId: string) => {
    if (collapsed.value) {
        collapsed.value = false;
        expandedGroups.value[groupId] = true;
        return;
    }
    expandedGroups.value[groupId] = !expandedGroups.value[groupId];
};

const handleSelect = (key: string) => {
    emit('select-node', key);
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
    <aside
        :class="[
            'h-full flex flex-col bg-white rounded-[24px] soft-shadow border border-primary/5 transition-all duration-300 select-none shrink-0 font-display overflow-hidden no-print',
            collapsed ? 'w-[68px]' : 'w-72'
        ]"
    >
        <!-- Sidebar Header (DESIGN.md Mục 5B) -->
        <div class="p-3.5 px-4 border-b border-primary/5 flex items-center justify-between shrink-0 bg-slate-50/50">
            <div v-if="!collapsed" class="flex items-center gap-2.5 min-w-0">
                <div class="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                    <span class="material-symbols-outlined text-lg">account_tree</span>
                </div>
                <div class="truncate">
                    <div class="text-xs uppercase font-black tracking-wider text-primary leading-tight">Sơ đồ cây</div>
                    <h2 class="text-xs font-black text-[#1e293b] truncate">Điều hành tập trung</h2>
                </div>
            </div>

            <!-- Icon Button Tròn Thu gọn / Mở rộng (DESIGN.md Mục 4) -->
            <button
                type="button"
                @click="collapsed = !collapsed"
                class="size-8 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-primary hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
                :class="{ 'mx-auto': collapsed }"
                :title="collapsed ? 'Mở rộng sơ đồ cây' : 'Thu gọn sơ đồ cây'"
            >
                <span
                    class="material-symbols-outlined text-lg transition-transform duration-300"
                    :class="{ 'rotate-180': collapsed }"
                >
                    chevron_left
                </span>
            </button>
        </div>

        <!-- Tree Navigation Body -->
        <div class="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
            <!-- ================= NHÁNH 1: PHÂN HỆ ================= -->
            <div class="space-y-1.5">
                <button
                    v-if="!collapsed"
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
                    <span class="material-symbols-outlined text-base text-primary">folder_open</span>
                </div>

                <div v-show="collapsed || expandedGroups.modules" class="space-y-1.5">
                    <!-- Tạo nguồn tàu & Dữ liệu cân -->
                    <button
                        v-for="item in moduleItems"
                        :key="item.key"
                        type="button"
                        @click="handleSelect(item.key)"
                        :title="collapsed ? item.label : undefined"
                        :class="[
                            'w-full flex items-center gap-2.5 p-2.5 px-3 rounded-[16px] cursor-pointer transition-all text-xs font-black border text-left group',
                            collapsed ? 'justify-center px-0' : '',
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
                        <span v-if="!collapsed" class="truncate flex-1">{{ item.label }}</span>
                        <span
                            v-if="!collapsed && item.badge"
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
                            v-if="!collapsed"
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
                            v-show="collapsed || expandedGroups.reports"
                            :class="[
                                collapsed
                                    ? 'space-y-1.5'
                                    : 'ml-3.5 pl-2.5 border-l-2 border-primary/15 space-y-1.5'
                            ]"
                        >
                            <button
                                v-for="rep in reportItems"
                                :key="rep.key"
                                type="button"
                                @click="handleSelect(rep.key)"
                                :title="collapsed ? rep.label : undefined"
                                :class="[
                                    'w-full flex items-center gap-2 p-2 px-3 rounded-[14px] cursor-pointer transition-all text-xs font-black border text-left group',
                                    collapsed ? 'justify-center px-0 p-2.5 rounded-[16px]' : '',
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
                                <span v-if="!collapsed" class="truncate flex-1">{{ rep.label }}</span>
                                <span
                                    v-if="!collapsed && rep.badge"
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
                        :title="collapsed ? item.label : undefined"
                        :class="[
                            'w-full flex items-center gap-2.5 p-2.5 px-3 rounded-[16px] cursor-pointer transition-all text-xs font-black border text-left group',
                            collapsed ? 'justify-center px-0' : '',
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
                        <span v-if="!collapsed" class="truncate flex-1">{{ item.label }}</span>
                    </button>
                </div>
            </div>

            <div class="h-px bg-primary/5"></div>

            <!-- ================= NHÁNH 2: DANH MỤC ================= -->
            <div class="space-y-1.5">
                <button
                    v-if="!collapsed"
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

                <div v-show="collapsed || expandedGroups.categories" class="space-y-1.5">
                    <button
                        v-for="item in categoryItems"
                        :key="item.key"
                        type="button"
                        @click="handleSelect(item.key)"
                        :title="collapsed ? item.label : undefined"
                        :class="[
                            'w-full flex items-center gap-2.5 p-2.5 px-3 rounded-[16px] cursor-pointer transition-all text-xs font-black border text-left group',
                            collapsed ? 'justify-center px-0' : '',
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
                        <span v-if="!collapsed" class="truncate flex-1">{{ item.label }}</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Sidebar Footer -->
        <div class="p-3 border-t border-primary/5 bg-slate-50/40 flex items-center justify-between text-xs font-bold text-gray-400 shrink-0">
            <template v-if="!collapsed">
                <span class="truncate">Cảng Nguyên Ngọc</span>
                <span class="text-primary font-black">v2.2</span>
            </template>
            <span v-else class="material-symbols-outlined text-base text-primary/60 mx-auto">anchor</span>
        </div>
    </aside>
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

<script setup lang="ts">
import { ref, computed, watch, onMounted, defineAsyncComponent, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authStore } from '@/stores/auth';
import WorkspaceTreeSidebar from '@/components/workspace/WorkspaceTreeSidebar.vue';
import { canAccessWorkspaceTab } from '@/services/auth/PermissionService';

// Default active tab loaded eagerly for instant initial render
import WeighbridgeDataImporter from '@/components/workspace/WeighbridgeDataImporter.vue';

// Secondary workspace & tool tabs loaded lazily on demand
const WarehouseInventoryManager = defineAsyncComponent(() => import('@/components/tools/WarehouseInventoryManager.vue'));
const WeighbridgePrinter = defineAsyncComponent(() => import('@/components/tools/WeighbridgePrinter.vue'));
const SingleBargeAllocator = defineAsyncComponent(() => import('@/components/tools/SingleBargeAllocator.vue'));
const BargeProfileManager = defineAsyncComponent(() => import('@/components/tools/BargeProfileManager.vue'));
const BargeMinutes = defineAsyncComponent(() => import('@/components/tools/BargeMinutes.vue'));
const VehicleManager = defineAsyncComponent(() => import('@/components/tools/VehicleManager.vue'));
const GoodsManager = defineAsyncComponent(() => import('@/components/tools/GoodsManager.vue'));
const VesselSourceManager = defineAsyncComponent(() => import('@/components/workspace/VesselSourceManager.vue'));
const MasterCategoryManager = defineAsyncComponent(() => import('@/components/workspace/MasterCategoryManager.vue'));

const route = useRoute();
const router = useRouter();

const activeKey = ref<string>('');
const isSidebarPinned = ref(false);

const nodeMetaMap: Record<string, { title: string; subtitle: string; icon: string; group: string }> = {
    'vessel-source': {
        title: 'TẠO NGUỒN TÀU 🚢',
        subtitle: 'Phân hệ 1 • Khai báo tàu mẹ & sà lan tiếp nhận (Độc lập dữ liệu cân)',
        icon: 'directions_boat',
        group: 'Phân hệ'
    },
    'scale-data': {
        title: 'DỮ LIỆU CÂN ⚖️',
        subtitle: 'Phân hệ 1 • File 1: Nhập kho & Nhập thẳng • File 2: Xuất kho & Xuất thẳng xuống sà lan',
        icon: 'balance',
        group: 'Phân hệ'
    },
    'report-inventory': {
        title: 'BÁO CÁO TỒN KHO 🏭',
        subtitle: 'Báo cáo • Tồn kho hàng sáng, cộng dồn lũy kế & ảnh Zalo',
        icon: 'warehouse',
        group: 'Báo cáo'
    },
    'report-shipment': {
        title: 'BÁO CÁO LÔ HÀNG 🚢',
        subtitle: 'Báo cáo • Tiến độ dỡ tàu, bảng kê tổng hợp sà lan & kho',
        icon: 'monitoring',
        group: 'Báo cáo'
    },
    'report-deheus': {
        title: 'BÁO CÁO PHÂN BỔ DE HEUS 🔀',
        subtitle: 'Báo cáo • Phân bổ tải trọng xe sà lan theo định mức',
        icon: 'call_split',
        group: 'Báo cáo'
    },
    'vehicles': {
        title: 'QUẢN LÝ HỒ SƠ PHƯƠNG TIỆN 🚢',
        subtitle: 'Phân hệ 1 • Hồ sơ đăng kiểm, bảo hiểm, bằng cấp thuyền viên',
        icon: 'sailing',
        group: 'Phân hệ'
    },
    'minutes': {
        title: 'BIÊN BẢN SÀ LAN 📋',
        subtitle: 'Phân hệ 1 • Lập bộ 4 biên bản giao nhận hàng hóa tự động',
        icon: 'description',
        group: 'Phân hệ'
    },
    'category-vehicles': {
        title: 'DANH SÁCH XE VẬN TẢI 🚛',
        subtitle: 'Danh mục 2 • Biển số xe đầu kéo & số sơ-mi rơ-moóc',
        icon: 'local_shipping',
        group: 'Danh mục'
    },
    'category-customers': {
        title: 'DANH SÁCH KHÁCH HÀNG / ĐỐI TÁC 🤝',
        subtitle: 'Danh mục 2 • Chủ hàng lưu thông qua cảng (Eastwood, GBD, De Heus...)',
        icon: 'groups',
        group: 'Danh mục'
    },
    'category-warehouses': {
        title: 'DANH SÁCH KHO HÀNG 🏢',
        subtitle: 'Danh mục 2 • Cấu hình Kho 1, Kho 2, Kho 3, Kho 4 & sức chứa',
        icon: 'domain',
        group: 'Danh mục'
    },
    'category-goods': {
        title: 'DANH MỤC HÀNG HÓA 📦',
        subtitle: 'Danh mục 2 • Quy chuẩn loại hàng hóa dùng chung toàn cảng',
        icon: 'inventory_2',
        group: 'Danh mục'
    }
};

const currentMeta = computed(() => {
    return (
        nodeMetaMap[activeKey.value] || {
            title: 'KHÔNG GIAN ĐIỀU HÀNH HỢP NHẤT 🚢',
            subtitle: 'Cảng Nguyên Ngọc • Đồng bộ đám mây',
            icon: 'account_tree',
            group: 'Hệ thống'
        }
    );
});

const hasAccessibleTab = computed(() => {
    return !!activeKey.value && !!nodeMetaMap[activeKey.value] && canAccessWorkspaceTab(activeKey.value);
});

const activeComponent = computed<Component | null>(() => {
    if (!hasAccessibleTab.value) return null;
    switch (activeKey.value) {
        case 'vessel-source':
            return VesselSourceManager;
        case 'scale-data':
            return WeighbridgeDataImporter;
        case 'report-inventory':
            return WarehouseInventoryManager;
        case 'report-shipment':
            return WeighbridgePrinter;
        case 'report-deheus':
            return SingleBargeAllocator;
        case 'vehicles':
            return BargeProfileManager;
        case 'minutes':
            return BargeMinutes;
        case 'category-vehicles':
            return VehicleManager;
        case 'category-goods':
            return GoodsManager;
        default:
            if (activeKey.value.startsWith('category-')) {
                return MasterCategoryManager;
            }
            return null;
    }
});

const ALL_WORKSPACE_KEYS = [
    'scale-data',
    'vessel-source',
    'report-shipment',
    'report-inventory',
    'report-deheus',
    'vehicles',
    'minutes',
    'category-vehicles',
    'category-customers',
    'category-warehouses',
    'category-goods'
];

const getFirstAccessibleTab = (): string | null => {
    for (const key of ALL_WORKSPACE_KEYS) {
        if (canAccessWorkspaceTab(key)) {
            return key;
        }
    }
    return null;
};

const ensureAccessibleTab = (targetKey?: string) => {
    if (targetKey && nodeMetaMap[targetKey] && canAccessWorkspaceTab(targetKey)) {
        activeKey.value = targetKey;
    } else {
        const fallback = getFirstAccessibleTab();
        activeKey.value = fallback || '';
        if (fallback) {
            if (route.query.tab !== fallback) {
                router.replace({ query: { ...route.query, tab: fallback } });
            }
        } else if (route.query.tab !== undefined) {
            const { tab: _removed, ...restQuery } = route.query;
            router.replace({ query: restQuery });
        }
    }
};

const handleSelectNode = (key: string) => {
    if (!canAccessWorkspaceTab(key)) {
        return;
    }
    activeKey.value = key;
    router.replace({ query: { ...route.query, tab: key } });
};

onMounted(() => {
    const tabQuery = typeof route.query.tab === 'string' ? route.query.tab : undefined;
    ensureAccessibleTab(tabQuery);
});

watch(
    () => route.query.tab,
    newTab => {
        if (typeof newTab === 'string') {
            ensureAccessibleTab(newTab);
        }
    }
);

watch(
    () => [authStore.role, authStore.rolePermissions],
    () => {
        const tabQuery = typeof route.query.tab === 'string' ? route.query.tab : activeKey.value || undefined;
        ensureAccessibleTab(tabQuery);
    },
    { deep: true }
);
</script>

<template>
    <div class="fixed inset-0 bg-white z-[100] flex flex-col overflow-hidden no-print">
        <!-- Top Workspace Header Bar (Chuẩn ToolLayout.vue & DESIGN.md Mục 5A) -->
        <header class="bg-white px-4 md:px-6 py-3 border-b border-primary/10 flex items-center justify-between shadow-sm shrink-0 sticky top-0 z-30">
            <!-- Left: Back Button & Current Module Title -->
            <div class="flex items-center gap-3 md:gap-4 min-w-0">
                <router-link
                    to="/"
                    class="size-10 rounded-full bg-[#f1f5f9] hover:bg-primary/20 flex items-center justify-center text-primary transition-all shadow-sm active:scale-95 shrink-0"
                    title="Quay lại Trang chủ"
                >
                    <span class="material-symbols-outlined text-xl">arrow_back</span>
                </router-link>

                <div class="h-6 w-px bg-primary/10 hidden sm:block shrink-0"></div>

                <div class="flex items-center gap-3 min-w-0">
                    <div class="size-10 bg-primary rounded-2xl flex items-center justify-center text-white shadow-md shrink-0">
                        <span class="material-symbols-outlined text-xl">{{ currentMeta.icon }}</span>
                    </div>
                    <div class="min-w-0">
                        <h1 class="text-base md:text-lg font-display font-black tracking-tight text-[#1e293b] leading-none truncate">
                            {{ currentMeta.title }}
                        </h1>
                    </div>
                </div>
            </div>

            <!-- Right: Demo Sandbox Badge (only in demo mode) -->
            <div v-if="authStore.isDemoMode" class="flex items-center gap-3 shrink-0">
                <div
                    class="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shrink-0 shadow-xs"
                    title="Đang ở chế độ Thử Nghiệm Sandbox - Không ảnh hưởng dữ liệu thật"
                >
                    <span class="material-symbols-outlined text-sm text-amber-600">science</span>
                    <span class="hidden sm:inline">Sandbox Test</span>
                </div>
            </div>
        </header>

        <!-- Main Workspace Body (bg-cute-gradient + Left Tree Sidebar + Right Dynamic View) -->
        <div class="flex-1 bg-cute-gradient flex flex-col md:flex-row overflow-hidden relative p-3.5 md:p-4 gap-3.5 md:gap-4 min-h-0">
            <!-- Left Tree Sidebar Navigation (Mặc định ẩn vào trong, rê chuột hiện ra) -->
            <WorkspaceTreeSidebar
                :active-key="activeKey"
                v-model:is-pinned="isSidebarPinned"
                @select-node="handleSelectNode"
            />

            <!-- Right Active Tool / Category View -->
            <main class="flex-1 flex flex-col min-w-0 h-full overflow-y-auto custom-workspace-scroll">
                <KeepAlive v-if="hasAccessibleTab && activeComponent" :max="12">
                    <component
                        :is="activeComponent"
                        :key="`${activeKey}-${authStore.user || 'guest'}-${authStore.isDemoMode ? 'demo' : 'prod'}`"
                        :category-key="activeKey"
                        :hide-card="true"
                        @navigate-to-scale="handleSelectNode('scale-data')"
                        @view-inventory="handleSelectNode('report-inventory')"
                        @view-shipment="handleSelectNode('report-shipment')"
                        @view-deheus="handleSelectNode('report-deheus')"
                    />
                </KeepAlive>
                <div
                    v-else
                    class="flex-1 flex items-center justify-center p-6"
                >
                    <div class="bg-white rounded-[2rem] border border-primary/10 p-8 md:p-10 shadow-sm max-w-md w-full text-center">
                        <div class="size-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
                            <span class="material-symbols-outlined text-3xl">lock</span>
                        </div>
                        <h2 class="text-xl font-display font-black text-[#1e293b] mb-2">
                            Chưa được phân quyền truy cập
                        </h2>
                        <p class="text-xs font-medium text-slate-500 leading-relaxed mb-6">
                            Tài khoản của bạn hiện chưa có quyền truy cập vào phân hệ hoặc danh mục nào trong Workspace. Vui lòng liên hệ quản trị viên để được cấp quyền.
                        </p>
                        <router-link
                            to="/"
                            class="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all"
                        >
                            <span class="material-symbols-outlined text-base">home</span>
                            <span>Quay về Trang chủ</span>
                        </router-link>
                    </div>
                </div>
            </main>
        </div>
    </div>
</template>

<style scoped>
.custom-workspace-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
.custom-workspace-scroll::-webkit-scrollbar-thumb {
    background: rgba(74, 120, 194, 0.25);
    border-radius: 9999px;
}
.custom-workspace-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(74, 120, 194, 0.45);
}
</style>

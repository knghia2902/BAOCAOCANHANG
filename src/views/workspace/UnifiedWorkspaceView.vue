<script setup lang="ts">
import { ref, computed, watch, onMounted, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authStore } from '@/stores/auth';
import WorkspaceTreeSidebar from '@/components/workspace/WorkspaceTreeSidebar.vue';

// Existing tools components
import WarehouseInventoryManager from '@/components/tools/WarehouseInventoryManager.vue';
import WeighbridgePrinter from '@/components/tools/WeighbridgePrinter.vue';
import SingleBargeAllocator from '@/components/tools/SingleBargeAllocator.vue';
import BargeProfileManager from '@/components/tools/BargeProfileManager.vue';
import BargeMinutes from '@/components/tools/BargeMinutes.vue';
import VehicleManager from '@/components/tools/VehicleManager.vue';
import GoodsManager from '@/components/tools/GoodsManager.vue';

// Workspace specific components
import VesselSourceManager from '@/components/workspace/VesselSourceManager.vue';
import WeighbridgeDataImporter from '@/components/workspace/WeighbridgeDataImporter.vue';
import MasterCategoryManager from '@/components/workspace/MasterCategoryManager.vue';

const route = useRoute();
const router = useRouter();

const activeKey = ref<string>('scale-data');
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

const activeComponent = computed<Component>(() => {
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
            return WeighbridgeDataImporter;
    }
});

const handleSelectNode = (key: string) => {
    activeKey.value = key;
    router.replace({ query: { ...route.query, tab: key } });
};

onMounted(() => {
    const tabQuery = route.query.tab;
    if (typeof tabQuery === 'string' && nodeMetaMap[tabQuery]) {
        activeKey.value = tabQuery;
    }
});

watch(
    () => route.query.tab,
    newTab => {
        if (typeof newTab === 'string' && nodeMetaMap[newTab] && newTab !== activeKey.value) {
            activeKey.value = newTab;
        }
    }
);
</script>

<template>
    <div class="fixed inset-0 bg-white z-[100] flex flex-col overflow-hidden no-print font-display">
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

            <!-- Right: User Profile Pill -->
            <div class="flex items-center gap-3 shrink-0">
                <div
                    v-if="authStore.isDemoMode"
                    class="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shrink-0 shadow-xs"
                    title="Đang ở chế độ Thử Nghiệm Sandbox - Không ảnh hưởng dữ liệu thật"
                >
                    <span class="material-symbols-outlined text-sm text-amber-600">science</span>
                    <span class="hidden sm:inline">Sandbox Test</span>
                </div>
                <div
                    v-if="authStore.isAuthenticated"
                    class="flex items-center gap-2.5 bg-[#f1f5f9]/50 border border-primary/10 rounded-full pl-3 pr-1 py-1"
                >
                    <span class="text-xs font-bold text-[#1e293b]/70 hidden sm:inline">{{ authStore.displayName }}</span>
                    <div
                        class="size-8 rounded-full bg-cover bg-center border border-white shadow-sm"
                        :style="{
                            backgroundImage: `url(${authStore.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(authStore.displayName || 'User')})`
                        }"
                    ></div>
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
                <KeepAlive :max="12">
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

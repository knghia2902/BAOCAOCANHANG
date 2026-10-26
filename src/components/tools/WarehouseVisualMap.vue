<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { authStore, canUpdate } from '@/stores/auth';
import {
    WarehouseInventoryService,
    ALL_WAREHOUSES,
    snapMapVertex,
    createWarehousePresetPolygons,
    getDefaultVisualMapState
} from '@/services/excel/WarehouseInventoryService';
import type {
    WarehouseId,
    WarehouseConfig,
    WarehouseVisualMapState,
    WarehouseMapVertex
} from '@/types/excel';

const props = defineProps<{
    configs: Record<WarehouseId, WarehouseConfig>;
    closingStocks: Record<WarehouseId, number>;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const { addToast } = useToast();

const mapState = ref<WarehouseVisualMapState>(getDefaultVisualMapState());
const loading = ref(false);
const saving = ref(false);
const isEditing = ref(false);
const enableSnap = ref(true);

// Active selection in Edit mode
const selectedWarehouseId = ref<WarehouseId>('KHO 1');
const selectedPolygonIdx = ref<number>(0);
const selectedVertexIdx = ref<number | null>(null);

// Live drag state
const svgRef = ref<SVGSVGElement | null>(null);
const draggingState = ref<{
    warehouseId: WarehouseId;
    polygonIdx: number;
    vertexIdx: number;
    currentVertex: WarehouseMapVertex;
} | null>(null);

// Role-based permission check: Anyone can view, only authorized roles can edit
const canEditMap = computed<boolean>(() => {
    return authStore.role === 'admin' || canUpdate();
});

// Watch permission changes (e.g. logout)
watch(canEditMap, (allowed) => {
    if (!allowed) {
        isEditing.value = false;
    }
});

// Geometry constants for SVG layout (viewBox 0 0 1320 680)
const SVG_WIDTH = 1320;
const SVG_HEIGHT = 680;
const TOP_Y = 78;
const BODY_H = 532;
const BOTTOM_Y = TOP_Y + BODY_H; // 610
const FOOTER_H = 48;
const COL_W = 224;

const CONT_COL_X = 18;
const WAREHOUSE_COLS: Record<WarehouseId, { x: number; w: number; numberSide: 'left' | 'between' | 'right' | 'none' }> = {
    'KHO 1': { x: 280, w: COL_W, numberSide: 'left' },
    'KHO 2': { x: 542, w: COL_W, numberSide: 'between' },
    'KHO 3': { x: 804, w: COL_W, numberSide: 'none' },
    'KHO 4': { x: 1068, w: COL_W, numberSide: 'right' }
};

const totalContainers = computed<number>(() => {
    const cy = mapState.value.containerYard;
    if (cy.overrideTotalConts != null && !isNaN(Number(cy.overrideTotalConts))) {
        return Number(cy.overrideTotalConts);
    }
    return (Number(cy.loadedConts) || 0) + (Number(cy.emptyConts) || 0);
});

const activeZoneConfig = computed(() => {
    return mapState.value.warehouses[selectedWarehouseId.value];
});

function formatTons(val: number | undefined | null): string {
    const num = Number(val) || 0;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatArea(val: number): string {
    return Number(val || 0).toLocaleString('en-US');
}

function getEffectiveCustomerName(whId: WarehouseId): string {
    const zone = mapState.value.warehouses[whId];
    if (zone?.customCustomerName && zone.customCustomerName.trim()) {
        return zone.customCustomerName.trim();
    }
    const raw = props.configs[whId]?.currentCustomer || (whId === 'KHO 4' ? 'EASTWOOD' : 'GỖ BÌNH ĐỊNH');
    if (/EASTWOOD/i.test(raw)) return 'EASTWOOD';
    return raw;
}

function getEffectiveStockTons(whId: WarehouseId): number {
    const zone = mapState.value.warehouses[whId];
    if (zone?.overrideStockTons != null && !isNaN(Number(zone.overrideStockTons))) {
        return Number(zone.overrideStockTons);
    }
    return Number(props.closingStocks[whId]) || 0;
}

// Convert normalized warehouse vertex (xRatio, bayY) -> SVG pixel (x, y)
function vertexToSvgPoint(whId: WarehouseId, v: WarehouseMapVertex): { x: number; y: number } {
    const col = WAREHOUSE_COLS[whId];
    const totalBays = Math.max(1, mapState.value.warehouses[whId]?.totalBays || 6);
    const x = col.x + Math.max(0, Math.min(1, v.xRatio)) * col.w;
    const y = BOTTOM_Y - (Math.max(0, Math.min(totalBays, v.bayY)) / totalBays) * BODY_H;
    return {
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1))
    };
}

function polygonToPointsAttr(whId: WarehouseId, vertices: WarehouseMapVertex[]): string {
    return vertices
        .map(v => {
            const pt = vertexToSvgPoint(whId, v);
            return `${pt.x},${pt.y}`;
        })
        .join(' ');
}

function getBayLineY(whId: WarehouseId, bayIndex: number): number {
    const totalBays = Math.max(1, mapState.value.warehouses[whId]?.totalBays || 6);
    return Number((BOTTOM_Y - (bayIndex / totalBays) * BODY_H).toFixed(1));
}

function getBayCenterY(whId: WarehouseId, bayNumber1Based: number): number {
    const totalBays = Math.max(1, mapState.value.warehouses[whId]?.totalBays || 6);
    return Number((BOTTOM_Y - ((bayNumber1Based - 0.5) / totalBays) * BODY_H).toFixed(1));
}

function getMidpoint(v1: WarehouseMapVertex, v2: WarehouseMapVertex): WarehouseMapVertex {
    return {
        xRatio: Number(((v1.xRatio + v2.xRatio) / 2).toFixed(3)),
        bayY: Number(((v1.bayY + v2.bayY) / 2).toFixed(2))
    };
}

function selectWarehouseForEdit(whId: WarehouseId, polyIdx = 0) {
    selectedWarehouseId.value = whId;
    selectedPolygonIdx.value = polyIdx;
    selectedVertexIdx.value = null;
}

function clientToSvgCoords(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgRef.value;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const scaleX = SVG_WIDTH / rect.width;
    const scaleY = SVG_HEIGHT / rect.height;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function startDragVertex(whId: WarehouseId, polygonIdx: number, vertexIdx: number, e: PointerEvent) {
    if (!isEditing.value || !canEditMap.value) return;
    e.stopPropagation();
    e.preventDefault();
    selectedWarehouseId.value = whId;
    selectedPolygonIdx.value = polygonIdx;
    selectedVertexIdx.value = vertexIdx;

    const poly = mapState.value.warehouses[whId]?.polygons[polygonIdx];
    const vertex = poly?.vertices[vertexIdx];
    if (!vertex) return;

    draggingState.value = {
        warehouseId: whId,
        polygonIdx,
        vertexIdx,
        currentVertex: { ...vertex }
    };

    window.addEventListener('pointermove', onPointerMoveVertex);
    window.addEventListener('pointerup', onPointerUpVertex);
}

function onPointerMoveVertex(e: PointerEvent) {
    const drag = draggingState.value;
    if (!drag) return;
    const svgPt = clientToSvgCoords(e.clientX, e.clientY);
    if (!svgPt) return;

    const whId = drag.warehouseId;
    const col = WAREHOUSE_COLS[whId];
    const zone = mapState.value.warehouses[whId];
    if (!zone) return;

    const rawXRatio = (svgPt.x - col.x) / col.w;
    const rawBayY = ((BOTTOM_Y - svgPt.y) / BODY_H) * zone.totalBays;

    const snapped = snapMapVertex(
        { xRatio: rawXRatio, bayY: rawBayY },
        zone.totalBays,
        enableSnap.value
    );

    const poly = zone.polygons[drag.polygonIdx];
    if (poly && poly.vertices[drag.vertexIdx]) {
        poly.vertices[drag.vertexIdx] = snapped;
        drag.currentVertex = snapped;
    }
}

function onPointerUpVertex() {
    draggingState.value = null;
    window.removeEventListener('pointermove', onPointerMoveVertex);
    window.removeEventListener('pointerup', onPointerUpVertex);
}

function insertVertexAtEdge(whId: WarehouseId, polygonIdx: number, edgeStartIdx: number) {
    if (!isEditing.value || !canEditMap.value) return;
    const zone = mapState.value.warehouses[whId];
    const poly = zone?.polygons[polygonIdx];
    if (!poly || poly.vertices.length < 3) return;

    const v1 = poly.vertices[edgeStartIdx]!;
    const v2 = poly.vertices[(edgeStartIdx + 1) % poly.vertices.length]!;
    const mid = snapMapVertex(getMidpoint(v1, v2), zone.totalBays, enableSnap.value);

    poly.vertices.splice(edgeStartIdx + 1, 0, mid);
    selectedWarehouseId.value = whId;
    selectedPolygonIdx.value = polygonIdx;
    selectedVertexIdx.value = edgeStartIdx + 1;
}

function removeVertex(whId: WarehouseId, polygonIdx: number, vertexIdx: number) {
    if (!isEditing.value || !canEditMap.value) return;
    const zone = mapState.value.warehouses[whId];
    const poly = zone?.polygons[polygonIdx];
    if (!poly) return;
    if (poly.vertices.length <= 3) {
        addToast('Một khối đa giác cần tối thiểu 3 đỉnh!', 'info');
        return;
    }
    poly.vertices.splice(vertexIdx, 1);
    selectedVertexIdx.value = null;
}

function addNewPolygonCluster(whId: WarehouseId) {
    const zone = mapState.value.warehouses[whId];
    if (!zone) return;
    const newIdx = zone.polygons.length + 1;
    zone.polygons.push({
        id: `${whId}_cluster_${Date.now()}`,
        label: `Cụm hàng ${newIdx}`,
        vertices: [
            { xRatio: 0.2, bayY: 1 },
            { xRatio: 0.2, bayY: 3 },
            { xRatio: 0.8, bayY: 3 },
            { xRatio: 0.8, bayY: 1 }
        ]
    });
    selectedPolygonIdx.value = zone.polygons.length - 1;
    selectedVertexIdx.value = null;
    addToast(`Đã thêm cụm hàng mới vào ${whId}. Hãy kéo các đỉnh đến vị trí mong muốn!`, 'info');
}

function deleteSelectedPolygonCluster(whId: WarehouseId) {
    const zone = mapState.value.warehouses[whId];
    if (!zone) return;
    if (zone.polygons.length <= 1) {
        // If only 1 polygon left, allow clearing to a small bottom strip or warn
        addToast('Mỗi kho cần ít nhất 1 khối đa giác (bạn có thể kéo thu nhỏ nếu kho trống).', 'info');
        return;
    }
    zone.polygons.splice(selectedPolygonIdx.value, 1);
    selectedPolygonIdx.value = 0;
    selectedVertexIdx.value = null;
}

function applyPresetToWarehouse(whId: WarehouseId, preset: 'DEFAULT' | 'FULL' | 'ANGLED_AISLE' | 'STEPPED_AISLE') {
    const zone = mapState.value.warehouses[whId];
    if (!zone) return;
    zone.polygons = createWarehousePresetPolygons(whId, zone.totalBays, preset);
    selectedPolygonIdx.value = 0;
    selectedVertexIdx.value = null;
    addToast(`Đã áp dụng mẫu hình cho ${whId}`, 'success');
}

function setUpdatedNow6AM() {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    mapState.value.updatedAtLabel = `06h00, ${d}/${m}/${y}`;
}

async function loadMapState() {
    loading.value = true;
    try {
        mapState.value = await WarehouseInventoryService.getVisualMapState();
    } catch (err: any) {
        console.error('Lỗi tải sơ đồ kho:', err);
    } finally {
        loading.value = false;
    }
}

async function handleSaveMapState() {
    if (!canEditMap.value) {
        addToast('Bạn không có quyền chỉnh sửa sơ đồ kho!', 'error');
        return;
    }
    saving.value = true;
    try {
        mapState.value.updatedBy = authStore.displayName || authStore.user || 'Admin';
        await WarehouseInventoryService.saveVisualMapState(mapState.value);
        isEditing.value = false;
        selectedVertexIdx.value = null;
        addToast('Đã lưu Sơ đồ kho cảng lên hệ thống!', 'success');
    } catch (err: any) {
        addToast('Lỗi lưu sơ đồ kho: ' + (err?.message || err), 'error');
    } finally {
        saving.value = false;
    }
}

onMounted(() => {
    loadMapState();
});
</script>

<template>
    <div class="flex flex-col gap-3.5 h-full min-h-0">
        <!-- Top Control Bar -->
        <div class="bg-white rounded-[24px] px-4 py-3 border border-primary/5 soft-shadow flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div class="flex items-center gap-3">
                <button
                    type="button"
                    @click="emit('close')"
                    class="px-3.5 py-2 bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl text-xs hover:bg-primary/5 active:scale-95 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="Quay lại bảng dữ liệu tồn kho"
                >
                    <span class="material-symbols-outlined text-sm">arrow_back</span>
                    <span>Quay lại</span>
                </button>

                <div class="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-xl">map</span>
                </div>
                <div>
                    <div class="text-xl font-display font-black text-[#1e293b] flex flex-wrap items-center gap-2">
                        <span>SƠ ĐỒ TRỰC QUAN KHO CẢNG NGUYÊN NGỌC</span>
                        <span
                            v-if="isEditing"
                            class="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300"
                        >
                            ĐANG CHỈNH SỬA (KÉO THẢ ĐỈNH ĐA GIÁC)
                        </span>
                        <span
                            v-else
                            class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-600 border border-teal-200"
                        >
                            CHẾ ĐỘ XEM THEO DÕI
                        </span>
                    </div>
                    <div class="text-xs font-semibold text-slate-500">
                        Số tấn tồn kho tự động đồng bộ từ bảng FINAL 4 Kho •
                        <span v-if="mapState.updatedBy">Cập nhật lần cuối bởi <b>{{ mapState.updatedBy }}</b></span>
                        <span v-else>Hiển thị trực tiếp cho toàn bộ người xem</span>
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-wrap items-center gap-2">
                <!-- Role-gated Edit & Save Controls -->
                <template v-if="canEditMap">
                    <button
                        v-if="!isEditing"
                        type="button"
                        @click="isEditing = true"
                        class="px-4 py-2 bg-primary text-white font-bold rounded-full text-xs shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                        <span class="material-symbols-outlined text-sm">edit_square</span>
                        <span>Chỉnh sửa sơ đồ</span>
                    </button>

                    <template v-else>
                        <button
                            type="button"
                            @click="loadMapState(); isEditing = false"
                            class="px-3.5 py-2 bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl text-xs hover:bg-primary/5 active:scale-95 transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                        >
                            <span class="material-symbols-outlined text-sm">close</span>
                            <span>Hủy</span>
                        </button>

                        <button
                            type="button"
                            @click="handleSaveMapState"
                            :disabled="saving"
                            class="px-4 py-2 bg-primary text-white font-bold rounded-full text-xs shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <span class="material-symbols-outlined text-sm">{{ saving ? 'sync' : 'save' }}</span>
                            <span>{{ saving ? 'Đang lưu...' : 'Lưu sơ đồ' }}</span>
                        </button>
                    </template>
                </template>
            </div>
        </div>

        <!-- Edit Toolbar Drawer (Visible only when isEditing && canEditMap) -->
        <div
            v-if="isEditing && canEditMap"
            class="bg-white rounded-[24px] p-4 border-2 border-primary/20 shadow-sm flex flex-col gap-3 shrink-0"
        >
            <!-- Row 1: General Info + Container Yard + Snapping Toggle -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end border-b border-slate-100 pb-3">
                <div class="lg:col-span-3 flex flex-col gap-1">
                    <label class="text-xs font-bold text-slate-600">Tiêu đề sơ đồ</label>
                    <input
                        v-model="mapState.title"
                        type="text"
                        class="h-8 px-3 bg-[#f1f5f9] border border-slate-200 rounded-2xl text-xs font-bold text-[#1e293b]"
                    />
                </div>

                <div class="lg:col-span-3 flex flex-col gap-1">
                    <div class="flex items-center justify-between">
                        <label class="text-xs font-bold text-slate-600">Thời điểm cập nhật</label>
                        <button
                            type="button"
                            @click="setUpdatedNow6AM"
                            class="text-xs font-black text-primary hover:underline cursor-pointer"
                        >
                            Đặt 06h00 hôm nay
                        </button>
                    </div>
                    <input
                        v-model="mapState.updatedAtLabel"
                        type="text"
                        placeholder="06h00, 26/10/2026"
                        class="h-8 px-3 bg-[#f1f5f9] border border-slate-200 rounded-2xl text-xs font-bold text-[#1e293b]"
                    />
                </div>

                <div class="lg:col-span-2 flex flex-col gap-1">
                    <label class="text-xs font-bold text-slate-600">Bãi Cont — Có hàng</label>
                    <input
                        v-model.number="mapState.containerYard.loadedConts"
                        type="number"
                        min="0"
                        class="h-8 px-3 bg-[#f1f5f9] border border-slate-200 rounded-2xl text-xs font-bold text-[#1e293b]"
                    />
                </div>

                <div class="lg:col-span-2 flex flex-col gap-1">
                    <label class="text-xs font-bold text-slate-600">Bãi Cont — Cont rỗng</label>
                    <input
                        v-model.number="mapState.containerYard.emptyConts"
                        type="number"
                        min="0"
                        class="h-8 px-3 bg-[#f1f5f9] border border-slate-200 rounded-2xl text-xs font-bold text-[#1e293b]"
                    />
                </div>

                <div class="lg:col-span-2 flex items-center justify-end gap-2 h-8">
                    <label class="flex items-center gap-1.5 text-xs font-bold text-[#1e293b] cursor-pointer select-none bg-primary/5 px-3 py-1.5 rounded-2xl border border-primary/20">
                        <input
                            v-model="enableSnap"
                            type="checkbox"
                            class="rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span>Bắt dính vạch ô (Snap)</span>
                    </label>
                </div>
            </div>

            <!-- Row 2: Per-Warehouse Polygon & Stock Controls -->
            <div class="flex flex-wrap items-center justify-between gap-3">
                <!-- Warehouse Selector Tabs -->
                <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-slate-500 mr-1">Đang chỉnh:</span>
                    <button
                        v-for="whId in ALL_WAREHOUSES"
                        :key="whId"
                        type="button"
                        @click="selectWarehouseForEdit(whId, 0)"
                        :class="[
                            'px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5',
                            selectedWarehouseId === whId
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-[#f1f5f9] text-slate-700 hover:bg-slate-200'
                        ]"
                    >
                        <span
                            class="size-3 rounded-sm border border-black/30 inline-block"
                            :style="{ backgroundColor: mapState.warehouses[whId].fillColor }"
                        ></span>
                        <span>{{ whId }}</span>
                    </button>
                </div>

                <!-- Selected Warehouse Quick Config -->
                <div class="flex flex-wrap items-center gap-2.5">
                    <div class="flex items-center gap-1.5">
                        <span class="text-xs font-bold text-slate-500">Mặt hàng:</span>
                        <input
                            v-model="activeZoneConfig.cargoName"
                            type="text"
                            class="h-7 px-2.5 w-36 bg-[#f1f5f9] border border-slate-200 rounded-lg text-xs font-bold text-[#1e293b]"
                        />
                    </div>

                    <div class="flex items-center gap-1.5">
                        <span class="text-xs font-bold text-slate-500">Số tấn (Ghi đè):</span>
                        <input
                            :value="activeZoneConfig.overrideStockTons ?? ''"
                            @input="(e) => {
                                const val = (e.target as HTMLInputElement).value.trim();
                                activeZoneConfig.overrideStockTons = val === '' ? null : Number(val);
                            }"
                            type="number"
                            step="0.01"
                            :placeholder="`Tự động: ${formatTons(closingStocks[selectedWarehouseId])} T`"
                            class="h-7 px-2.5 w-40 bg-[#f1f5f9] border border-slate-200 rounded-lg text-xs font-bold text-[#1e293b]"
                            title="Để trống để tự động lấy số Tồn cuối từ bảng FINAL"
                        />
                        <button
                            v-if="activeZoneConfig.overrideStockTons != null"
                            type="button"
                            @click="activeZoneConfig.overrideStockTons = null"
                            class="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                            title="Quay về dùng số tự động từ bảng FINAL"
                        >
                            Dùng tự động
                        </button>
                    </div>

                    <div class="flex items-center gap-1.5">
                        <span class="text-xs font-bold text-slate-500">Màu:</span>
                        <input
                            v-model="activeZoneConfig.fillColor"
                            type="color"
                            class="size-7 rounded cursor-pointer border border-slate-300 bg-white p-0.5"
                        />
                    </div>

                    <!-- Polygon Cluster Selector & Add/Remove -->
                    <div class="flex items-center gap-1 pl-2 border-l border-slate-200">
                        <select
                            v-model.number="selectedPolygonIdx"
                            class="h-7 px-2 bg-[#f1f5f9] border border-slate-200 rounded-lg text-xs font-bold text-[#1e293b]"
                        >
                            <option
                                v-for="(poly, pIdx) in activeZoneConfig.polygons"
                                :key="poly.id"
                                :value="pIdx"
                            >
                                Cụm {{ pIdx + 1 }} ({{ poly.vertices.length }} đỉnh)
                            </option>
                        </select>

                        <button
                            type="button"
                            @click="addNewPolygonCluster(selectedWarehouseId)"
                            class="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-xs font-black cursor-pointer flex items-center gap-1"
                            title="Thêm 1 đống hàng / cụm đa giác lẻ mới trong kho này"
                        >
                            <span class="material-symbols-outlined text-xs">add</span>
                            <span>Thêm cụm</span>
                        </button>

                        <button
                            v-if="activeZoneConfig.polygons.length > 1"
                            type="button"
                            @click="deleteSelectedPolygonCluster(selectedWarehouseId)"
                            class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-black cursor-pointer"
                            title="Xóa cụm hàng đang chọn"
                        >
                            Xóa cụm
                        </button>
                    </div>

                    <!-- Quick Shape Presets -->
                    <div class="flex items-center gap-1 pl-2 border-l border-slate-200">
                        <span class="text-xs font-bold text-slate-500">Mẫu nhanh:</span>
                        <button
                            type="button"
                            @click="applyPresetToWarehouse(selectedWarehouseId, 'DEFAULT')"
                            class="px-2 py-1 bg-[#f1f5f9] hover:bg-primary hover:text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                        >
                            Mẫu chuẩn
                        </button>
                        <button
                            type="button"
                            @click="applyPresetToWarehouse(selectedWarehouseId, 'FULL')"
                            class="px-2 py-1 bg-[#f1f5f9] hover:bg-primary hover:text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                        >
                            Đầy kho
                        </button>
                        <button
                            type="button"
                            @click="applyPresetToWarehouse(selectedWarehouseId, 'ANGLED_AISLE')"
                            class="px-2 py-1 bg-[#f1f5f9] hover:bg-primary hover:text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                        >
                            Vát chéo
                        </button>
                        <button
                            type="button"
                            @click="applyPresetToWarehouse(selectedWarehouseId, 'STEPPED_AISLE')"
                            class="px-2 py-1 bg-[#f1f5f9] hover:bg-primary hover:text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                        >
                            Bậc thang
                        </button>
                    </div>
                </div>
            </div>

            <!-- Instruction hint -->
            <div class="text-xs font-semibold text-slate-500 flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-1.5 rounded-xl">
                <div>
                    💡 <b>Mẹo thao tác:</b> Nắm kéo các <b>nút tròn trắng viền xanh</b> để thay đổi hình dáng vùng hàng • Bấm vào <b>chấm nhỏ màu xanh giữa cạnh</b> để thêm đỉnh mới • Nhấp đúp (double-click) vào một đỉnh để xóa đỉnh đó.
                </div>
                <div v-if="draggingState" class="text-primary font-black">
                    Đang kéo tại {{ draggingState.warehouseId }}: Ô {{ draggingState.currentVertex.bayY }} • Ngang {{ Math.round(draggingState.currentVertex.xRatio * 100) }}%
                </div>
            </div>
        </div>

        <!-- Main Interactive SVG Map Canvas -->
        <div class="bg-white rounded-[24px] p-4 border border-primary/5 soft-shadow flex-1 flex items-center justify-center overflow-auto min-h-[520px]">
            <svg
                ref="svgRef"
                :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`"
                class="w-full max-w-[1320px] h-auto select-none border border-slate-200/80 rounded-xl bg-white shadow-sm"
            >
                <!-- Clean white background for export -->
                <rect x="0" y="0" :width="SVG_WIDTH" :height="SVG_HEIGHT" fill="#ffffff" />

                <!-- Diagram Main Title -->
                <text
                    :x="SVG_WIDTH / 2"
                    y="36"
                    text-anchor="middle"
                    font-family="Cambria, Georgia, 'Times New Roman', serif"
                    font-size="26"
                    font-weight="bold"
                    fill="#4f71be"
                >
                    {{ mapState.title }}
                </text>

                <!-- Updated Timestamp Subtitle -->
                <text
                    x="18"
                    y="64"
                    font-family="Cambria, Georgia, 'Times New Roman', serif"
                    font-size="16.5"
                    fill="#111827"
                >
                    Cập nhật số liệu đến {{ mapState.updatedAtLabel }}
                </text>

                <!-- ========================================================= -->
                <!-- COLUMN 1: BÃI CONT                                        -->
                <!-- ========================================================= -->
                <g>
                    <!-- Container Yard Body -->
                    <rect
                        :x="CONT_COL_X"
                        :y="TOP_Y"
                        :width="COL_W"
                        :height="BODY_H"
                        :fill="mapState.containerYard.fillColor || '#FADBD8'"
                    />

                    <!-- Container Summary Info Box -->
                    <rect
                        :x="CONT_COL_X + 44"
                        :y="TOP_Y + 8"
                        width="136"
                        height="108"
                        fill="#ffffff"
                        stroke="#943634"
                        stroke-width="1.2"
                    />
                    <text
                        :x="CONT_COL_X + COL_W / 2"
                        :y="TOP_Y + 34"
                        text-anchor="middle"
                        font-family="Cambria, Georgia, 'Times New Roman', serif"
                        font-size="14.5"
                        font-weight="bold"
                        fill="#111827"
                    >
                        Cont có hàng: {{ mapState.containerYard.loadedConts }}
                    </text>
                    <text
                        :x="CONT_COL_X + COL_W / 2"
                        :y="TOP_Y + 66"
                        text-anchor="middle"
                        font-family="Cambria, Georgia, 'Times New Roman', serif"
                        font-size="14.5"
                        font-weight="bold"
                        fill="#111827"
                    >
                        Cont rỗng: {{ mapState.containerYard.emptyConts }}
                    </text>
                    <text
                        :x="CONT_COL_X + COL_W / 2"
                        :y="TOP_Y + 100"
                        text-anchor="middle"
                        font-family="Cambria, Georgia, 'Times New Roman', serif"
                        font-size="14.5"
                        font-weight="bold"
                        fill="#111827"
                    >
                        Total: {{ totalContainers }}
                    </text>

                    <!-- Footer Banner: BÃI CONT -->
                    <rect
                        :x="CONT_COL_X"
                        :y="BOTTOM_Y"
                        :width="COL_W"
                        :height="FOOTER_H"
                        fill="#D9E1F2"
                        stroke="#94A3B8"
                        stroke-width="1"
                    />
                    <text
                        :x="CONT_COL_X + COL_W / 2"
                        :y="BOTTOM_Y + 30"
                        text-anchor="middle"
                        font-family="Cambria, Georgia, 'Times New Roman', serif"
                        font-size="17"
                        font-weight="bold"
                        fill="#1e293b"
                    >
                        BÃI CONT
                    </text>
                </g>

                <!-- ========================================================= -->
                <!-- COLUMNS 2..5: KHO 1, KHO 2, KHO 3, KHO 4                  -->
                <!-- ========================================================= -->
                <g
                    v-for="whId in ALL_WAREHOUSES"
                    :key="whId"
                    @click="isEditing && selectWarehouseForEdit(whId, 0)"
                >
                    <!-- White Warehouse Interior Base -->
                    <rect
                        :x="WAREHOUSE_COLS[whId].x"
                        :y="TOP_Y"
                        :width="WAREHOUSE_COLS[whId].w"
                        :height="BODY_H"
                        fill="#ffffff"
                    />

                    <!-- Cargo Polygons inside Warehouse -->
                    <g
                        v-for="(poly, pIdx) in mapState.warehouses[whId].polygons"
                        :key="poly.id"
                    >
                        <polygon
                            :points="polygonToPointsAttr(whId, poly.vertices)"
                            :fill="poly.color || mapState.warehouses[whId].fillColor"
                            :stroke="isEditing && selectedWarehouseId === whId && selectedPolygonIdx === pIdx ? '#1d4ed8' : 'none'"
                            :stroke-width="isEditing && selectedWarehouseId === whId && selectedPolygonIdx === pIdx ? 1.5 : 0"
                            :stroke-dasharray="isEditing && selectedWarehouseId === whId && selectedPolygonIdx === pIdx ? '4,2' : undefined"
                            class="transition-opacity"
                            @click.stop="isEditing && selectWarehouseForEdit(whId, pIdx)"
                        />
                    </g>

                    <!-- Horizontal Dashed Bay Dividers (drawn OVER cargo fill, matching TVPL image) -->
                    <template v-for="bayIdx in (mapState.warehouses[whId].totalBays - 1)" :key="`${whId}_line_${bayIdx}`">
                        <line
                            :x1="WAREHOUSE_COLS[whId].x"
                            :y1="getBayLineY(whId, bayIdx)"
                            :x2="WAREHOUSE_COLS[whId].x + WAREHOUSE_COLS[whId].w"
                            :y2="getBayLineY(whId, bayIdx)"
                            stroke="#334155"
                            stroke-width="1"
                            stroke-dasharray="3,2"
                            pointer-events="none"
                        />
                    </template>

                    <!-- Bay Numbers (1..N from bottom to top) -->
                    <template v-for="bayNum in mapState.warehouses[whId].totalBays" :key="`${whId}_num_${bayNum}`">
                        <!-- KHO 1: Left side numbers 1..6 -->
                        <text
                            v-if="WAREHOUSE_COLS[whId].numberSide === 'left'"
                            :x="WAREHOUSE_COLS[whId].x - 6"
                            :y="getBayCenterY(whId, bayNum) + 5"
                            text-anchor="end"
                            font-family="Cambria, Georgia, 'Times New Roman', serif"
                            font-size="13.5"
                            font-weight="bold"
                            fill="#111827"
                            pointer-events="none"
                        >
                            {{ bayNum }}
                        </text>

                        <!-- Between KHO 2 and KHO 3: Center gap numbers 1..11 -->
                        <text
                            v-else-if="WAREHOUSE_COLS[whId].numberSide === 'between'"
                            :x="WAREHOUSE_COLS['KHO 2'].x + COL_W + 19"
                            :y="getBayCenterY(whId, bayNum) + 5"
                            text-anchor="middle"
                            font-family="Cambria, Georgia, 'Times New Roman', serif"
                            font-size="13.5"
                            font-weight="bold"
                            fill="#111827"
                            pointer-events="none"
                        >
                            {{ bayNum }}
                        </text>

                        <!-- KHO 4: Right side numbers 1..12 -->
                        <text
                            v-else-if="WAREHOUSE_COLS[whId].numberSide === 'right'"
                            :x="WAREHOUSE_COLS[whId].x + COL_W + 6"
                            :y="getBayCenterY(whId, bayNum) + 5"
                            text-anchor="start"
                            font-family="Cambria, Georgia, 'Times New Roman', serif"
                            font-size="13.5"
                            font-weight="bold"
                            fill="#111827"
                            pointer-events="none"
                        >
                            {{ bayNum }}
                        </text>
                    </template>

                    <!-- Outer Thick Black Warehouse Walls -->
                    <rect
                        :x="WAREHOUSE_COLS[whId].x"
                        :y="TOP_Y"
                        :width="WAREHOUSE_COLS[whId].w"
                        :height="BODY_H"
                        fill="none"
                        stroke="#000000"
                        stroke-width="2.5"
                        pointer-events="none"
                    />

                    <!-- Warehouse Doors (Bottom & Side Doors matching TVPL diagram) -->
                    <!-- Bottom Entrance Door -->
                    <rect
                        :x="whId === 'KHO 3' ? WAREHOUSE_COLS[whId].x + 134 : WAREHOUSE_COLS[whId].x + 88"
                        :y="BOTTOM_Y - 8"
                        width="48"
                        height="8"
                        fill="#ffffff"
                        stroke="#111827"
                        stroke-width="0.9"
                        pointer-events="none"
                    />

                    <!-- KHO 2 Left Side Door (around Bay 8.2 - 9.3) -->
                    <rect
                        v-if="whId === 'KHO 2'"
                        :x="WAREHOUSE_COLS[whId].x - 4"
                        :y="getBayLineY('KHO 2', 9.35)"
                        width="10"
                        height="54"
                        fill="#ffffff"
                        stroke="#111827"
                        stroke-width="0.9"
                        pointer-events="none"
                    />

                    <!-- KHO 3 Right Side Upper Door (around Bay 10.1 - 11) -->
                    <rect
                        v-if="whId === 'KHO 3'"
                        :x="WAREHOUSE_COLS[whId].x + COL_W - 6"
                        :y="TOP_Y"
                        width="9"
                        height="44"
                        fill="#ffffff"
                        stroke="#111827"
                        stroke-width="0.9"
                        pointer-events="none"
                    />

                    <!-- KHO 4 Left Side Door (around Bay 6.3 - 7.5) -->
                    <rect
                        v-if="whId === 'KHO 4'"
                        :x="WAREHOUSE_COLS[whId].x - 4"
                        :y="getBayLineY('KHO 4', 7.55)"
                        width="10"
                        height="54"
                        fill="#ffffff"
                        stroke="#111827"
                        stroke-width="0.9"
                        pointer-events="none"
                    />

                    <!-- KHO 4 Conveyor Belt ("Băng tải") Symbol -->
                    <g
                        v-if="whId === 'KHO 4' && mapState.warehouses['KHO 4'].showConveyor !== false"
                        pointer-events="none"
                    >
                        <!-- Blue dashed right-pointing arrow -->
                        <polygon
                            :points="`
                                ${WAREHOUSE_COLS['KHO 4'].x + 28},${getBayLineY('KHO 4', 5.95)}
                                ${WAREHOUSE_COLS['KHO 4'].x + 96},${getBayLineY('KHO 4', 5.95)}
                                ${WAREHOUSE_COLS['KHO 4'].x + 96},${getBayLineY('KHO 4', 6.12)}
                                ${WAREHOUSE_COLS['KHO 4'].x + 112},${getBayLineY('KHO 4', 5.80)}
                                ${WAREHOUSE_COLS['KHO 4'].x + 96},${getBayLineY('KHO 4', 5.48)}
                                ${WAREHOUSE_COLS['KHO 4'].x + 96},${getBayLineY('KHO 4', 5.65)}
                                ${WAREHOUSE_COLS['KHO 4'].x + 28},${getBayLineY('KHO 4', 5.65)}
                            `"
                            fill="#5B9BD5"
                            stroke="#2F5597"
                            stroke-width="1.2"
                            stroke-dasharray="3,2"
                        />
                        <!-- "Băng tải" Box -->
                        <rect
                            :x="WAREHOUSE_COLS['KHO 4'].x + 20"
                            :y="getBayLineY('KHO 4', 5.62)"
                            width="68"
                            height="25"
                            fill="#ffffff"
                            stroke="#943634"
                            stroke-width="1.1"
                        />
                        <text
                            :x="WAREHOUSE_COLS['KHO 4'].x + 54"
                            :y="getBayLineY('KHO 4', 5.62) + 17"
                            text-anchor="middle"
                            font-family="Cambria, Georgia, 'Times New Roman', serif"
                            font-size="13.5"
                            font-weight="bold"
                            fill="#111827"
                        >
                            Băng tải
                        </text>
                    </g>

                    <!-- Floating Top Customer & Tonnage Info Card -->
                    <g pointer-events="none">
                        <rect
                            :x="WAREHOUSE_COLS[whId].x + 44"
                            :y="TOP_Y + 4"
                            width="136"
                            height="70"
                            fill="#ffffff"
                            stroke="#943634"
                            stroke-width="1.2"
                        />
                        <text
                            :x="WAREHOUSE_COLS[whId].x + COL_W / 2"
                            :y="TOP_Y + 24"
                            text-anchor="middle"
                            font-family="Cambria, Georgia, 'Times New Roman', serif"
                            font-size="14.5"
                            font-weight="bold"
                            fill="#E31B23"
                        >
                            {{ getEffectiveCustomerName(whId) }}
                        </text>
                        <text
                            :x="WAREHOUSE_COLS[whId].x + COL_W / 2"
                            :y="TOP_Y + 45"
                            text-anchor="middle"
                            font-family="Cambria, Georgia, 'Times New Roman', serif"
                            font-size="14.5"
                            font-weight="bold"
                            fill="#000000"
                        >
                            {{ mapState.warehouses[whId].cargoName || 'VIÊN NÉN GỖ' }}
                        </text>
                        <text
                            :x="WAREHOUSE_COLS[whId].x + COL_W / 2"
                            :y="TOP_Y + 65"
                            text-anchor="middle"
                            font-family="Cambria, Georgia, 'Times New Roman', serif"
                            font-size="15"
                            font-weight="bold"
                            fill="#000000"
                        >
                            {{ formatTons(getEffectiveStockTons(whId)) }} T
                        </text>
                    </g>

                    <!-- Footer Banner: KHO X (Area m²) -->
                    <rect
                        :x="WAREHOUSE_COLS[whId].x"
                        :y="BOTTOM_Y"
                        :width="COL_W"
                        :height="FOOTER_H"
                        fill="#D9E1F2"
                        stroke="#64748B"
                        stroke-width="1"
                    />
                    <text
                        :x="WAREHOUSE_COLS[whId].x + COL_W / 2"
                        :y="BOTTOM_Y + 30"
                        text-anchor="middle"
                        font-family="Cambria, Georgia, 'Times New Roman', serif"
                        font-size="17"
                        font-weight="bold"
                        fill="#1e293b"
                    >
                        {{ whId }} ({{ formatArea(mapState.warehouses[whId].areaM2) }} m²)
                    </text>

                    <!-- ===================================================== -->
                    <!-- INTERACTIVE VERTEX & MIDPOINT HANDLES (EDIT MODE ONLY)-->
                    <!-- ===================================================== -->
                    <g v-if="isEditing && canEditMap" data-edit-only="true">
                        <template
                            v-for="(poly, pIdx) in mapState.warehouses[whId].polygons"
                            :key="`${poly.id}_handles`"
                        >
                            <!-- Edge Midpoint Handles (Click to insert new vertex) -->
                            <circle
                                v-for="(v, vIdx) in poly.vertices"
                                :key="`${poly.id}_mid_${vIdx}`"
                                :cx="vertexToSvgPoint(whId, getMidpoint(v, poly.vertices[(vIdx + 1) % poly.vertices.length]!)).x"
                                :cy="vertexToSvgPoint(whId, getMidpoint(v, poly.vertices[(vIdx + 1) % poly.vertices.length]!)).y"
                                r="4.5"
                                fill="#3b82f6"
                                fill-opacity="0.65"
                                stroke="#ffffff"
                                stroke-width="1.5"
                                class="cursor-copy hover:scale-125 transition-transform"
                                @click.stop="insertVertexAtEdge(whId, pIdx, vIdx)"
                            >
                                <title>Bấm để chèn thêm điểm uốn mới trên cạnh này</title>
                            </circle>

                            <!-- Primary Draggable Vertex Handles -->
                            <circle
                                v-for="(v, vIdx) in poly.vertices"
                                :key="`${poly.id}_v_${vIdx}`"
                                :cx="vertexToSvgPoint(whId, v).x"
                                :cy="vertexToSvgPoint(whId, v).y"
                                :r="selectedWarehouseId === whId && selectedPolygonIdx === pIdx && selectedVertexIdx === vIdx ? 7.5 : 6"
                                :fill="selectedWarehouseId === whId && selectedPolygonIdx === pIdx && selectedVertexIdx === vIdx ? '#f59e0b' : '#ffffff'"
                                stroke="#1d4ed8"
                                stroke-width="2.2"
                                class="cursor-grab active:cursor-grabbing"
                                @pointerdown="startDragVertex(whId, pIdx, vIdx, $event)"
                                @dblclick.stop="removeVertex(whId, pIdx, vIdx)"
                            >
                                <title>Kéo để di chuyển đỉnh (Ô {{ v.bayY }}) • Nhấp đúp để xóa đỉnh</title>
                            </circle>
                        </template>
                    </g>
                </g>
            </svg>
        </div>
    </div>
</template>

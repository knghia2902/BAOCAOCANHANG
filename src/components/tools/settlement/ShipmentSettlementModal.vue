<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { Vessel, Barge } from '@/services/excel/WeighbridgeService';
import type {
    SettlementContract,
    DailyFuelPrice,
    BargeDemurrageItem,
    SettlementSummary,
    SettlementTicketFlows
} from '@/types/settlement';
import {
    DEFAULT_GREEN_WOOD_CONTRACT,
    calculateBargeDemurrage,
    calculateAverageFuelPrice,
    resolveFuelTier,
    computeSettlementSummary
} from '@/services/settlement/BargeDemurrageService';
import { SettlementExcelExporter } from '@/services/excel/SettlementExcelExporter';
import BargeDemurrageTable from './BargeDemurrageTable.vue';
import DebitNotePreview from './DebitNotePreview.vue';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
    isOpen: boolean;
    vessel: Vessel | null;
    barges: Barge[];
    allTickets?: any[];
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'export', summary: SettlementSummary): void;
}>();

const { addToast } = useToast();

const activeTab = ref<'demurrage' | 'debitNote' | 'fuel'>('demurrage');
const currentContract = ref<SettlementContract>(DEFAULT_GREEN_WOOD_CONTRACT);
const selectedFuelTierId = ref<string>('tier_3');

// Nhật ký giá dầu DO mặc định (mẫu tàu EPOCH WIND)
const dailyFuelPrices = ref<DailyFuelPrice[]>([
    { date: '2026-10-19', price: 28800 },
    { date: '2026-10-20', price: 28800 },
    { date: '2026-10-21', price: 28800 },
    { date: '2026-10-22', price: 29250 },
    { date: '2026-10-23', price: 29250 },
    { date: '2026-10-24', price: 29250 },
    { date: '2026-10-25', price: 29250 },
    { date: '2026-10-26', price: 29250 },
    { date: '2026-10-27', price: 29250 },
    { date: '2026-10-28', price: 29250 },
    { date: '2026-10-29', price: 30240 },
    { date: '2026-10-30', price: 30240 }
]);

const newFuelDate = ref('');
const newFuelPrice = ref<number>(29000);

// Danh sách sà lan lưu neo
const demurrageBarges = ref<BargeDemurrageItem[]>([]);

// Tùy chỉnh dịch vụ
const serviceSelections = ref<Record<string, { enabled?: boolean; customPrice?: number; customQuantity?: number }>>({});

const isExporting = ref(false);

function initBargesFromProps() {
    if (!props.barges || props.barges.length === 0) {
        demurrageBarges.value = [];
        return;
    }

    demurrageBarges.value = props.barges.map(b => {
        // Lấy ngày giờ đến/rời từ cột db hoặc config nếu có
        const arr = b.arrival_time || b.config?.arrivalTime || '';
        const dep = b.departure_time || b.config?.departureTime || '';

        // Tổng tấn thực nhận/giao: tính từ danh sách xe của sà lan hoặc allTickets
        const matchedTickets = Array.isArray(b.trucks) && b.trucks.length > 0
            ? b.trucks
            : (Array.isArray(props.allTickets)
                ? props.allTickets.filter((t: any) => t.barge_id === b.id || t.bargeName === b.name)
                : []);

        const totalNetKg = matchedTickets.reduce((sum: number, t: any) => sum + (Number(t.weightNet) || 0), 0);
        const dischargedTons = Math.round((totalNetKg / 1000) * 100) / 100;

        const calc = calculateBargeDemurrage(
            arr,
            dep,
            dischargedTons,
            currentContract.value.freeDemurrageDays,
            currentContract.value.demurrageRatePerTonDay
        );

        return {
            bargeId: b.id,
            bargeName: b.name,
            arrivalTime: arr,
            departureTime: dep,
            receivedTons: dischargedTons,
            dischargedTons,
            totalDays: calc.totalDays,
            freeDays: calc.freeDays,
            excessDaysRaw: calc.excessDaysRaw,
            excessDaysRounded: calc.excessDaysRounded,
            ratePerTonDay: currentContract.value.demurrageRatePerTonDay,
            amount: calc.amount,
            area: 'Nguyên Ngọc'
        };
    });
}

watch(() => props.barges, () => {
    initBargesFromProps();
}, { immediate: true, deep: true });

// Tự động phân loại khối lượng từ allTickets
const ticketTonnage = computed(() => {
    let expWarehouse = 0;
    let dirBarge = 0;

    if (Array.isArray(props.allTickets) && props.allTickets.length > 0) {
        for (const t of props.allTickets) {
            const flow = String(t.flowType || t.flow_type || '').toUpperCase();
            const note = String(t.note || t.sourceOrRemark || '').toUpperCase();
            const yard = String(t.yard || t.originWarehouseName || '').toUpperCase();
            const tons = (Number(t.weightNet) || 0) > 200 ? (Number(t.weightNet) / 1000) : (Number(t.weightNet) || 0);

            if (flow === 'EXPORT' || note.includes('XUẤT KHO') || yard.includes('KHO')) {
                expWarehouse += tons;
            } else {
                dirBarge += tons;
            }
        }
    } else {
        // Fallback từ các sà lan của tàu mẫu
        expWarehouse = 8181.13;
        dirBarge = 2319.49;
    }

    return {
        exportWarehouseTons: Math.round(expWarehouse * 100) / 100,
        directBargeTons: Math.round(dirBarge * 100) / 100,
        customsTons: Math.round((expWarehouse + dirBarge) * 100) / 100
    };
});

// Tính giá dầu bình quân
const averageFuelPrice = computed(() => {
    return calculateAverageFuelPrice(dailyFuelPrices.value);
});

// Tự động gợi ý bậc dầu khi đổi nhật ký giá dầu
function autoSelectFuelTier() {
    const tier = resolveFuelTier(averageFuelPrice.value, currentContract.value.fuelTiers);
    selectedFuelTierId.value = tier.id;
    addToast(`Đã áp dụng khung giá dầu: ${tier.label} (Giá TB: ${averageFuelPrice.value.toLocaleString('vi-VN')} đ/lít)`, 'info');
}

function handleAddFuelPrice() {
    if (!newFuelDate.value || !newFuelPrice.value) {
        addToast('Vui lòng chọn ngày và mức giá dầu!', 'error');
        return;
    }
    dailyFuelPrices.value.push({
        date: newFuelDate.value,
        price: Number(newFuelPrice.value)
    });
    newFuelDate.value = '';
    autoSelectFuelTier();
}

function handleRemoveFuelPrice(idx: number) {
    dailyFuelPrices.value.splice(idx, 1);
    autoSelectFuelTier();
}

// Tổng hợp quyết toán phản ứng thời gian thực
const currentSummary = computed<SettlementSummary>(() => {
    return computeSettlementSummary({
        vesselName: props.vessel?.name || 'EPOCH WIND',
        contract: currentContract.value,
        fuelTierId: selectedFuelTierId.value,
        dailyFuelPrices: dailyFuelPrices.value,
        barges: demurrageBarges.value,
        serviceSelections: serviceSelections.value,
        totalExportWarehouseTons: ticketTonnage.value.exportWarehouseTons,
        totalDirectBargeTons: ticketTonnage.value.directBargeTons,
        totalCustomsTons: ticketTonnage.value.customsTons,
        truckingDetails: [
            { serviceId: 'truck_binh_phuoc', quantityTons: 61.2 },
            { serviceId: 'truck_tan_hiep', quantityTons: 172.5 },
            { serviceId: 'truck_tan_khanh', quantityTons: 35.8 }
        ]
    });
});

function handleToggleItem(payload: { isDntt1: boolean; id: string; enabled: boolean }) {
    const existing = serviceSelections.value[payload.id] || {};
    existing.enabled = payload.enabled;
    serviceSelections.value[payload.id] = existing;
}

const classifiedTicketFlows = computed<SettlementTicketFlows>(() => {
    const exportWarehouseTickets: any[] = [];
    const directBargeTickets: any[] = [];
    const truckRoadTickets: any[] = [];

    if (Array.isArray(props.allTickets) && props.allTickets.length > 0) {
        for (const t of props.allTickets) {
            const flow = String(t.flowType || t.flow_type || '').toUpperCase();
            const note = String(t.note || t.sourceOrRemark || '').toUpperCase();
            const yard = String(t.yard || t.originWarehouseName || '').toUpperCase();

            if (flow === 'TRUCK') {
                truckRoadTickets.push(t);
            } else if (flow === 'EXPORT' || note.includes('XUẤT KHO') || yard.includes('KHO')) {
                exportWarehouseTickets.push(t);
            } else {
                directBargeTickets.push(t);
            }
        }
    }

    return {
        exportWarehouseTickets,
        directBargeTickets,
        truckRoadTickets
    };
});

async function handleExportExcel() {
    if (isExporting.value) return;
    isExporting.value = true;
    try {
        const filename = await SettlementExcelExporter.exportSettlementWorkbook(
            currentSummary.value,
            classifiedTicketFlows.value
        );
        addToast(`Đã xuất file Quyết toán & ĐNTT thành công (${filename})!`, 'success');
        emit('export', currentSummary.value);
    } catch (error) {
        console.error('Lỗi xuất Excel quyết toán:', error);
        addToast('Có lỗi khi tạo file Excel quyết toán. Vui lòng thử lại.', 'error');
    } finally {
        isExporting.value = false;
    }
}

onMounted(() => {
    initBargesFromProps();
});
</script>

<template>
    <div
        v-if="isOpen"
        class="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
    >
        <div
            class="bg-background-light w-full max-w-6xl max-h-[92vh] rounded-[2rem] border border-primary/20 shadow-2xl flex flex-col overflow-hidden"
            @click.stop
        >
            <!-- Modal Header -->
            <div class="px-6 py-4 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0">
                <div class="flex items-center gap-3">
                    <div class="size-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                        <span class="material-symbols-outlined text-xl">receipt_long</span>
                    </div>
                    <div>
                        <h2 class="text-base font-display font-black text-[#1e293b] flex items-center gap-2">
                            <span>QUYẾT TOÁN LÔ HÀNG & ĐỀ NGHỊ THANH TOÁN</span>
                            <span class="px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-mono font-bold">
                                {{ vessel?.name || 'EPOCH WIND' }}
                            </span>
                        </h2>
                        <p class="text-xs text-slate-500 font-medium mt-0.5">
                            {{ currentContract.customerName }} • HĐ: <span class="font-mono font-bold text-slate-700">{{ currentContract.agreementNo }}</span>
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        @click="emit('close')"
                        class="size-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer"
                        title="Đóng"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>
            </div>

            <!-- Top Controls Bar -->
            <div class="bg-white px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <!-- Tabs navigation -->
                <div class="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0 h-8 items-center gap-1">
                    <button
                        type="button"
                        @click="activeTab = 'demurrage'"
                        class="px-3 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all flex items-center gap-1.5 cursor-pointer"
                        :class="activeTab === 'demurrage' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'"
                    >
                        <span class="material-symbols-outlined text-[13px]">directions_boat</span>
                        <span>1. Bảng kê Lưu sà lan</span>
                    </button>
                    <button
                        type="button"
                        @click="activeTab = 'debitNote'"
                        class="px-3 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all flex items-center gap-1.5 cursor-pointer"
                        :class="activeTab === 'debitNote' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'"
                    >
                        <span class="material-symbols-outlined text-[13px]">description</span>
                        <span>2. Xem trước ĐNTT 1 & 2</span>
                    </button>
                    <button
                        type="button"
                        @click="activeTab = 'fuel'"
                        class="px-3 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all flex items-center gap-1.5 cursor-pointer"
                        :class="activeTab === 'fuel' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'"
                    >
                        <span class="material-symbols-outlined text-[13px]">local_gas_station</span>
                        <span>3. Nhật ký Giá dầu DO</span>
                    </button>
                </div>

                <!-- Fuel Tier Selector -->
                <div class="flex items-center gap-2">
                    <label class="text-xs font-bold text-slate-600">Bậc giá dầu áp dụng:</label>
                    <select
                        v-model="selectedFuelTierId"
                        class="h-7 px-3 bg-white border border-slate-200 rounded-[8px] text-xs font-bold text-[#1e293b] focus:outline-none focus:border-primary font-mono cursor-pointer"
                    >
                        <option
                            v-for="tier in currentContract.fuelTiers"
                            :key="tier.id"
                            :value="tier.id"
                        >
                            {{ tier.label }} (VND/lít)
                        </option>
                    </select>

                    <button
                        type="button"
                        @click="autoSelectFuelTier"
                        class="h-7 px-2.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-[8px] text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                        title="Tự động chọn bậc theo giá dầu DO trung bình của các ngày làm hàng"
                    >
                        <span class="material-symbols-outlined text-[13px]">auto_mode</span>
                        <span>Khớp giá TB</span>
                    </button>
                </div>
            </div>

            <!-- Modal Body Content -->
            <div class="flex-1 overflow-y-auto p-6 space-y-4">
                <!-- TAB 1: BẢNG KÊ LƯU SÀ LAN -->
                <div v-show="activeTab === 'demurrage'">
                    <BargeDemurrageTable
                        v-model="demurrageBarges"
                        :free-days="currentContract.freeDemurrageDays"
                        :rate-per-ton-day="currentContract.demurrageRatePerTonDay"
                        :vat-rate="currentContract.vatRate"
                    />
                </div>

                <!-- TAB 2: XEM TRƯỚC ĐNTT -->
                <div v-show="activeTab === 'debitNote'">
                    <DebitNotePreview
                        :summary="currentSummary"
                        @toggle:item="handleToggleItem"
                    />
                </div>

                <!-- TAB 3: NHẬT KÝ GIÁ DẦU DO -->
                <div v-show="activeTab === 'fuel'" class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-display font-black text-[#1e293b] uppercase">
                                NHẬT KÝ GIÁ DẦU DO VÙNG 1 (PETROLIMEX)
                            </h3>
                            <p class="text-xs text-slate-500">
                                Giá dầu trung bình trong suốt thời gian làm hàng:
                                <span class="font-mono font-black text-primary text-sm">{{ averageFuelPrice.toLocaleString('vi-VN') }} đ/lít</span>
                            </p>
                        </div>

                        <!-- Add fuel price inline form -->
                        <div class="flex items-center gap-2">
                            <input
                                v-model="newFuelDate"
                                type="date"
                                class="h-7 px-2 text-xs bg-white border border-slate-200 rounded-[8px]"
                            />
                            <input
                                v-model.number="newFuelPrice"
                                type="number"
                                placeholder="29000"
                                class="h-7 w-24 px-2 text-xs bg-white border border-slate-200 rounded-[8px] font-mono text-right"
                            />
                            <button
                                type="button"
                                @click="handleAddFuelPrice"
                                class="h-7 px-3 bg-primary text-white rounded-[8px] text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer flex items-center gap-1"
                            >
                                <span class="material-symbols-outlined text-[13px]">add</span>
                                <span>Thêm ngày</span>
                            </button>
                        </div>
                    </div>

                    <!-- Daily prices table -->
                    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white max-w-xl">
                        <table class="w-full text-left text-xs whitespace-nowrap">
                            <thead class="bg-slate-50 text-[11px] font-black uppercase text-slate-600 border-b border-slate-200">
                                <tr>
                                    <th class="px-3 py-2 w-10 text-center">STT</th>
                                    <th class="px-3 py-2">Ngày áp dụng</th>
                                    <th class="px-3 py-2 text-right">Giá dầu DO (VNĐ/lít)</th>
                                    <th class="px-3 py-2 text-center w-12">Xóa</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 font-medium">
                                <tr v-for="(p, idx) in dailyFuelPrices" :key="idx" class="hover:bg-slate-50">
                                    <td class="px-3 py-1.5 text-center text-slate-400 font-mono">{{ idx + 1 }}</td>
                                    <td class="px-3 py-1.5 font-mono font-bold">{{ p.date }}</td>
                                    <td class="px-3 py-1.5 text-right font-mono text-primary font-bold">
                                        {{ p.price.toLocaleString('vi-VN') }} đ
                                    </td>
                                    <td class="px-3 py-1.5 text-center">
                                        <button
                                            type="button"
                                            @click="handleRemoveFuelPrice(idx)"
                                            class="size-6 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors inline-flex items-center justify-center cursor-pointer"
                                            title="Xóa dòng"
                                        >
                                            <span class="material-symbols-outlined text-[14px]">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Modal Footer Toolbar -->
            <div class="px-6 py-3.5 bg-white border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <!-- Summary Tonnages & Amount -->
                <div class="flex items-center gap-4 text-xs font-semibold text-slate-600">
                    <div>
                        Xuất kho: <span class="font-mono font-black text-slate-900">{{ ticketTonnage.exportWarehouseTons }}</span> tấn
                    </div>
                    <div>
                        Xe-sà lan: <span class="font-mono font-black text-slate-900">{{ ticketTonnage.directBargeTons }}</span> tấn
                    </div>
                    <div>
                        Tổng tiền DNTT 1: <span class="font-mono font-black text-primary text-sm">{{ currentSummary.totalAmountDntt1.toLocaleString('vi-VN') }} đ</span>
                    </div>
                </div>

                <!-- Action buttons -->
                <div class="flex items-center gap-3">
                    <button
                        type="button"
                        @click="emit('close')"
                        class="h-9 px-4 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 active:scale-95 transition-all text-xs cursor-pointer shadow-sm"
                    >
                        Đóng
                    </button>

                    <button
                        type="button"
                        @click="handleExportExcel"
                        :disabled="isExporting"
                        class="h-9 px-5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all text-xs flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <span v-if="isExporting" class="material-symbols-outlined text-base animate-spin">sync</span>
                        <span v-else class="material-symbols-outlined text-base">download</span>
                        <span>{{ isExporting ? 'Đang kết xuất 8 Sheets...' : 'Xuất Excel Trọn Gói (8 Sheets)' }}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

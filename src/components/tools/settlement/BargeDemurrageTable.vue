<script setup lang="ts">
import { computed } from 'vue';
import type { BargeDemurrageItem } from '@/types/settlement';
import { calculateBargeDemurrage } from '@/services/settlement/BargeDemurrageService';

const props = withDefaults(defineProps<{
    modelValue: BargeDemurrageItem[];
    freeDays?: number;
    ratePerTonDay?: number;
    vatRate?: number;
}>(), {
    freeDays: 7,
    ratePerTonDay: 3000,
    vatRate: 0.08
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: BargeDemurrageItem[]): void;
}>();

function formatNumber(num: number | undefined | null, decimals = 2): string {
    if (num === undefined || num === null || isNaN(num)) return '-';
    return Number(num).toLocaleString('vi-VN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatVnd(num: number | undefined | null): string {
    if (!num || num === 0) return '-';
    return Number(num).toLocaleString('vi-VN') + ' đ';
}

function handleTimeChange(item: BargeDemurrageItem) {
    const res = calculateBargeDemurrage(
        item.arrivalTime,
        item.departureTime,
        item.dischargedTons,
        props.freeDays,
        props.ratePerTonDay
    );

    item.totalDays = res.totalDays;
    item.freeDays = res.freeDays;
    item.excessDaysRaw = res.excessDaysRaw;
    item.excessDaysRounded = res.excessDaysRounded;
    item.amount = res.amount;

    emit('update:modelValue', [...props.modelValue]);
}

const totalDischargedTons = computed(() => {
    return props.modelValue.reduce((sum, b) => sum + (b.dischargedTons || 0), 0);
});

const subTotalDemurrage = computed(() => {
    return props.modelValue.reduce((sum, b) => sum + (b.amount || 0), 0);
});

const vatAmount = computed(() => {
    return Math.round(subTotalDemurrage.value * props.vatRate);
});

const totalAmount = computed(() => {
    return subTotalDemurrage.value + vatAmount.value;
});
</script>

<template>
    <div class="space-y-3">
        <!-- Title & Subtitle banner -->
        <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
                <h3 class="text-sm font-display font-black text-[#1e293b] flex items-center gap-1.5 uppercase tracking-wide">
                    <span class="material-symbols-outlined text-primary text-base">directions_boat</span>
                    BẢNG KÊ CHI TIẾT LƯU PHƯƠNG TIỆN (LƯU SÀ LAN)
                </h3>
                <p class="text-xs text-slate-500 font-medium">
                    Nhập Ngày đến cảng & Ngày rời phao để tự động tính số ngày vượt lưu (định mức miễn phí: {{ freeDays }} ngày, đơn giá: {{ formatNumber(ratePerTonDay, 0) }} đ/tấn/ngày)
                </p>
            </div>
            <div class="flex items-center gap-2">
                <span class="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-200">
                    Quy tắc làm tròn: lẻ ≤ 0.5 ngày tính 0.5, lẻ > 0.5 tính 1.0 ngày
                </span>
            </div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
            <table class="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead class="bg-slate-50 text-[11px] font-black uppercase text-slate-600 tracking-wider border-b border-slate-200">
                    <tr>
                        <th class="px-3 py-2.5 text-center w-10">STT</th>
                        <th class="px-3 py-2.5">Số phương tiện</th>
                        <th class="px-3 py-2.5 min-w-[170px]">Ngày đến cảng</th>
                        <th class="px-3 py-2.5 min-w-[170px]">Ngày rời phao</th>
                        <th class="px-3 py-2.5 text-right">Khối lượng (Tấn)</th>
                        <th class="px-3 py-2.5 text-center">Tổng ngày (ngày)</th>
                        <th class="px-3 py-2.5 text-center">Lưu cơ bản</th>
                        <th class="px-3 py-2.5 text-center">Vượt lưu thô</th>
                        <th class="px-3 py-2.5 text-center font-black text-rose-600">Vượt lưu (làm tròn)</th>
                        <th class="px-3 py-2.5 text-right">Đơn giá (đ/tấn/ngày)</th>
                        <th class="px-3 py-2.5 text-right font-black text-primary">THÀNH TIỀN</th>
                        <th class="px-3 py-2.5 text-center">KHU VỰC</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 font-medium">
                    <tr
                        v-for="(b, idx) in modelValue"
                        :key="b.bargeId || idx"
                        class="hover:bg-slate-50/80 transition-colors"
                        :class="{ 'bg-rose-50/20': b.amount > 0 }"
                    >
                        <td class="px-3 py-2 text-center text-slate-400 font-mono font-bold">{{ idx + 1 }}</td>
                        <td class="px-3 py-2 font-mono font-black text-primary">{{ b.bargeName }}</td>
                        
                        <!-- Ngày đến cảng (User editable) -->
                        <td class="px-3 py-1.5">
                            <input
                                v-model="b.arrivalTime"
                                type="text"
                                placeholder="YYYY-MM-DD HH:mm"
                                @change="handleTimeChange(b)"
                                class="w-full h-7 px-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-primary rounded-[8px] text-xs font-mono font-semibold text-[#1e293b] outline-none transition-all"
                            />
                        </td>

                        <!-- Ngày rời phao (User editable) -->
                        <td class="px-3 py-1.5">
                            <input
                                v-model="b.departureTime"
                                type="text"
                                placeholder="YYYY-MM-DD HH:mm"
                                @change="handleTimeChange(b)"
                                class="w-full h-7 px-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-primary rounded-[8px] text-xs font-mono font-semibold text-[#1e293b] outline-none transition-all"
                            />
                        </td>

                        <!-- Khối lượng thực giao (tấn) -->
                        <td class="px-3 py-2 text-right font-mono font-bold text-slate-700">
                            {{ formatNumber(b.dischargedTons, 2) }}
                        </td>

                        <!-- Tổng ngày thực hiện -->
                        <td class="px-3 py-2 text-center font-mono font-bold">
                            {{ b.totalDays > 0 ? formatNumber(b.totalDays, 1) : '-' }}
                        </td>

                        <!-- Số ngày lưu cơ bản -->
                        <td class="px-3 py-2 text-center font-mono text-slate-500">
                            {{ b.freeDays }}
                        </td>

                        <!-- Số ngày vượt lưu thô -->
                        <td class="px-3 py-2 text-center font-mono" :class="b.excessDaysRaw > 0 ? 'text-amber-700 font-bold' : 'text-slate-400'">
                            {{ b.excessDaysRaw > 0 ? formatNumber(b.excessDaysRaw, 1) : '-' }}
                        </td>

                        <!-- Số ngày vượt lưu làm tròn (0.5/1) -->
                        <td class="px-3 py-2 text-center font-mono font-black">
                            <span
                                v-if="b.excessDaysRounded > 0"
                                class="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200"
                            >
                                {{ b.excessDaysRounded }} ngày
                            </span>
                            <span v-else class="text-slate-400 font-normal">-</span>
                        </td>

                        <!-- Đơn giá lưu -->
                        <td class="px-3 py-2 text-right font-mono text-slate-600">
                            {{ formatNumber(b.ratePerTonDay, 0) }}
                        </td>

                        <!-- Thành tiền -->
                        <td class="px-3 py-2 text-right font-mono font-black" :class="b.amount > 0 ? 'text-rose-600' : 'text-slate-400'">
                            {{ b.amount > 0 ? formatVnd(b.amount) : '-' }}
                        </td>

                        <!-- Khu vực -->
                        <td class="px-3 py-2 text-center font-semibold text-slate-600">
                            {{ b.area || 'Nguyên Ngọc' }}
                        </td>
                    </tr>

                    <tr v-if="modelValue.length === 0">
                        <td colspan="12" class="px-4 py-8 text-center text-slate-400 italic">
                            Chưa có sà lan nào được gán cho tàu này.
                        </td>
                    </tr>
                </tbody>

                <!-- Summary Footer -->
                <tfoot class="bg-slate-50/90 font-display font-black text-xs border-t-2 border-slate-300">
                    <tr>
                        <td colspan="4" class="px-3 py-2.5 text-right uppercase tracking-wider text-slate-700">
                            Tổng cộng sà lan:
                        </td>
                        <td class="px-3 py-2.5 text-right font-mono text-slate-900">
                            {{ formatNumber(totalDischargedTons, 2) }}
                        </td>
                        <td colspan="5" class="px-3 py-2.5 text-right uppercase tracking-wider text-slate-700">
                            Tổng tiền lưu sà lan:
                        </td>
                        <td class="px-3 py-2.5 text-right font-mono text-rose-600 text-sm">
                            {{ formatVnd(subTotalDemurrage) }}
                        </td>
                        <td></td>
                    </tr>
                    <tr>
                        <td colspan="9" class="px-3 py-2 text-right uppercase tracking-wider text-slate-500 font-semibold">
                            Thuế GTGT 8%:
                        </td>
                        <td colspan="2" class="px-3 py-2 text-right font-mono text-slate-700">
                            {{ formatVnd(vatAmount) }}
                        </td>
                        <td></td>
                    </tr>
                    <tr class="bg-primary/5 text-primary">
                        <td colspan="9" class="px-3 py-2.5 text-right uppercase tracking-wider font-black text-sm">
                            Tổng tiền thanh toán Lưu Phương Tiện:
                        </td>
                        <td colspan="2" class="px-3 py-2.5 text-right font-mono font-black text-base text-primary">
                            {{ formatVnd(totalAmount) }}
                        </td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>
</template>

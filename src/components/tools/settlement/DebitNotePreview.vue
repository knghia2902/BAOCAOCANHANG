<script setup lang="ts">
import { ref, computed } from 'vue';
import type { SettlementSummary, DebitNoteLineItem } from '@/types/settlement';
import { numberToVietnameseWords, numberToEnglishWords } from '@/services/settlement/numberToWords';

const props = defineProps<{
    summary: SettlementSummary;
}>();

const emit = defineEmits<{
    (e: 'update:itemQuantity', payload: { isDntt1: boolean; id: string; qty: number }): void;
    (e: 'update:itemPrice', payload: { isDntt1: boolean; id: string; price: number }): void;
    (e: 'toggle:item', payload: { isDntt1: boolean; id: string; enabled: boolean }): void;
}>();

const activeTab = ref<'DNTT1' | 'DNTT2'>('DNTT1');

function formatNumber(num: number | undefined | null, decimals = 2): string {
    if (num === undefined || num === null || isNaN(num)) return '-';
    return Number(num).toLocaleString('vi-VN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatVnd(num: number | undefined | null): string {
    if (!num || num === 0) return '0 đ';
    return Number(num).toLocaleString('vi-VN') + ' đ';
}

const activeItems = computed<DebitNoteLineItem[]>(() => {
    return activeTab.value === 'DNTT1' ? props.summary.itemsDntt1 : props.summary.itemsDntt2;
});

const activeSubTotal = computed(() => {
    return activeItems.value.filter(i => i.enabled).reduce((sum, i) => sum + i.amount, 0);
});

const activeVat = computed(() => {
    return Math.round(activeSubTotal.value * props.summary.vatRate);
});

const activeTotal = computed(() => {
    return activeSubTotal.value + activeVat.value;
});

const activeWordsVi = computed(() => {
    return numberToVietnameseWords(activeTotal.value);
});

const activeWordsEn = computed(() => {
    return numberToEnglishWords(activeTotal.value);
});
</script>

<template>
    <div class="space-y-4">
        <!-- Sub-tab switcher -->
        <div class="flex items-center justify-between border-b border-slate-200 pb-2">
            <div class="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0 h-8 items-center gap-1">
                <button
                    type="button"
                    @click="activeTab = 'DNTT1'"
                    class="px-3 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all flex items-center gap-1.5 cursor-pointer"
                    :class="activeTab === 'DNTT1' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'"
                >
                    <span class="material-symbols-outlined text-[13px]">sailing</span>
                    <span>DNTT 1: Dịch vụ Cảng & Sà lan</span>
                </button>
                <button
                    type="button"
                    @click="activeTab = 'DNTT2'"
                    class="px-3 py-1 rounded-lg text-xs font-display font-bold h-6.5 transition-all flex items-center gap-1.5 cursor-pointer"
                    :class="activeTab === 'DNTT2' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'"
                >
                    <span class="material-symbols-outlined text-[13px]">local_shipping</span>
                    <span>DNTT 2: Cước Vận tải Xe bộ</span>
                </button>
            </div>

            <!-- Price Tier Badge -->
            <div class="flex items-center gap-2">
                <span class="text-xs text-slate-500 font-semibold">Khung giá dầu áp dụng:</span>
                <span class="h-6.5 px-2.5 bg-blue-50 text-primary border border-blue-200 rounded-[8px] text-xs font-bold font-mono flex items-center gap-1">
                    <span class="material-symbols-outlined text-[13px]">local_gas_station</span>
                    <span>{{ summary.fuelTier.label }} (VNĐ/lít)</span>
                </span>
            </div>
        </div>

        <!-- Official Debit Note Card (Paper Style) -->
        <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 font-sans text-slate-800 text-xs">
            <!-- Header Letterhead -->
            <div class="flex justify-between items-start border-b border-slate-200 pb-4">
                <div class="space-y-1">
                    <div class="text-sm font-display font-black text-primary tracking-wide uppercase">
                        {{ summary.beneficiaryInfo.name }}
                    </div>
                    <div class="text-xs text-slate-500">
                        Cảng Nguyên Ngọc • Tân Hưng, Đồng Nai / Long An • Hotline: 0988.xxx.xxx
                    </div>
                </div>
                <div class="text-right space-y-1">
                    <div class="text-base font-display font-black text-slate-900 tracking-wide uppercase">
                        ĐỀ NGHỊ THANH TOÁN
                    </div>
                    <div class="text-xs italic text-blue-600 font-medium tracking-wider">
                        DEBIT NOTE ({{ activeTab === 'DNTT1' ? 'PHẦN CẢNG & SÀ LAN' : 'PHẦN CƯỚC XE BỘ' }})
                    </div>
                    <div class="text-xs font-mono font-bold text-slate-600">
                        Service Order: <span class="text-primary">{{ summary.serviceOrderNo }}</span>
                    </div>
                </div>
            </div>

            <!-- Meta details grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-xs bg-slate-50/60 p-3.5 rounded-xl border border-slate-200/60">
                <div class="flex items-baseline gap-2">
                    <span class="font-bold text-slate-600 shrink-0">Kính gửi / To:</span>
                    <span class="font-black text-[#1e293b]">{{ summary.customerName }}</span>
                </div>
                <div class="flex items-baseline gap-2">
                    <span class="font-bold text-slate-600 shrink-0">Căn cứ Hợp đồng số / Agreement No:</span>
                    <span class="font-black font-mono text-primary">{{ summary.agreementNo }}</span>
                </div>
                <div class="flex items-baseline gap-2">
                    <span class="font-bold text-slate-600 shrink-0">Tên tàu làm hàng / Vessel's Name:</span>
                    <span class="font-black text-rose-700 font-mono">{{ summary.vesselName }}</span>
                </div>
                <div class="flex items-baseline gap-2">
                    <span class="font-bold text-slate-600 shrink-0">Tên hàng hóa / Cargo:</span>
                    <span class="font-semibold text-slate-800">{{ summary.cargoName }}</span>
                </div>
                <div class="flex items-baseline gap-2">
                    <span class="font-bold text-slate-600 shrink-0">Thời gian bắt đầu / Starting time:</span>
                    <span class="font-mono">{{ summary.startingTime }}</span>
                </div>
                <div class="flex items-baseline gap-2">
                    <span class="font-bold text-slate-600 shrink-0">Thời gian kết thúc / Ending time:</span>
                    <span class="font-mono">{{ summary.endingTime }}</span>
                </div>
            </div>

            <!-- Service Items Table -->
            <div class="overflow-x-auto rounded-xl border border-slate-200">
                <table class="w-full text-left border-collapse text-xs whitespace-nowrap">
                    <thead class="bg-slate-50 text-[11px] font-black uppercase text-slate-600 tracking-wider border-b border-slate-200">
                        <tr>
                            <th class="px-3 py-2 text-center w-10">Bật</th>
                            <th class="px-3 py-2 text-center w-8">STT</th>
                            <th class="px-3 py-2 min-w-[280px]">Mô tả dịch vụ / Service Descriptions</th>
                            <th class="px-3 py-2 text-center w-14">ĐVT</th>
                            <th class="px-3 py-2 text-right w-28">Số lượng (Qty)</th>
                            <th class="px-3 py-2 text-right w-28">Đơn giá (VND)</th>
                            <th class="px-3 py-2 text-right w-32 font-black text-primary">Thành tiền (VNĐ)</th>
                            <th class="px-3 py-2 text-center w-28">Mức giá dầu</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 font-medium">
                        <tr
                            v-for="item in activeItems"
                            :key="item.id"
                            class="hover:bg-slate-50/70 transition-colors"
                            :class="{ 'opacity-40 line-through bg-slate-50/40': !item.enabled }"
                        >
                            <td class="px-3 py-2 text-center">
                                <input
                                    type="checkbox"
                                    :checked="item.enabled"
                                    @change="emit('toggle:item', { isDntt1: activeTab === 'DNTT1', id: item.id, enabled: ($event.target as HTMLInputElement).checked })"
                                    class="rounded text-primary focus:ring-primary size-4 cursor-pointer"
                                />
                            </td>
                            <td class="px-3 py-2 text-center text-slate-400 font-mono font-bold">{{ item.stt }}</td>
                            <td class="px-3 py-2 whitespace-normal leading-relaxed">
                                <div class="font-bold text-slate-900">{{ item.serviceName }}</div>
                                <div v-if="item.subTitle" class="text-[11px] text-slate-500 italic">{{ item.subTitle }}</div>
                                <div v-if="item.contractRef" class="text-[10px] text-primary/80 font-mono mt-0.5">
                                    Căn cứ: {{ item.contractRef }}
                                </div>
                            </td>
                            <td class="px-3 py-2 text-center font-semibold text-slate-600">{{ item.unit }}</td>
                            
                            <!-- Quantity -->
                            <td class="px-3 py-2 text-right font-mono font-bold text-slate-800">
                                <span v-if="item.id.includes('luu_salan')">-</span>
                                <span v-else>{{ formatNumber(item.quantity, 2) }}</span>
                            </td>

                            <!-- Unit Price -->
                            <td class="px-3 py-2 text-right font-mono text-slate-700">
                                <span v-if="item.id.includes('luu_salan')">-</span>
                                <span v-else>{{ formatNumber(item.unitPrice, 0) }}</span>
                            </td>

                            <!-- Amount -->
                            <td class="px-3 py-2 text-right font-mono font-black text-primary">
                                {{ formatVnd(item.amount) }}
                            </td>

                            <!-- Fuel Tier Label -->
                            <td class="px-3 py-2 text-center font-mono text-[11px] text-slate-500">
                                {{ item.fuelTierLabel }}
                            </td>
                        </tr>
                    </tbody>

                    <!-- Calculation Totals -->
                    <tfoot class="bg-slate-50 font-display font-black text-xs border-t-2 border-slate-300">
                        <tr>
                            <td colspan="6" class="px-4 py-2.5 text-right uppercase tracking-wider text-slate-700">
                                Tổng tiền chưa Thuế / Total amount w/o VAT:
                            </td>
                            <td class="px-3 py-2.5 text-right font-mono text-slate-900 text-sm">
                                {{ formatVnd(activeSubTotal) }}
                            </td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="6" class="px-4 py-2 text-right uppercase tracking-wider text-slate-500 font-semibold">
                                Thuế VAT (8%) / VAT (8%):
                            </td>
                            <td class="px-3 py-2 text-right font-mono text-slate-700">
                                {{ formatVnd(activeVat) }}
                            </td>
                            <td></td>
                        </tr>
                        <tr class="bg-primary/5 text-primary">
                            <td colspan="6" class="px-4 py-2.5 text-right uppercase tracking-wider text-sm font-black">
                                Tổng Cộng / Total w/t VAT:
                            </td>
                            <td class="px-3 py-2.5 text-right font-mono font-black text-base text-primary">
                                {{ formatVnd(activeTotal) }}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- Amount in words (Bilingual) -->
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <div class="text-xs text-slate-800">
                    <span class="font-bold text-slate-600">Số tiền bằng chữ: </span>
                    <span class="font-bold italic text-slate-900">{{ activeWordsVi }}</span>
                </div>
                <div class="text-xs text-blue-700">
                    <span class="font-semibold text-slate-500">In words: </span>
                    <span class="italic font-medium">{{ activeWordsEn }}</span>
                </div>
            </div>

            <!-- Beneficiary Banking Details -->
            <div class="border-t border-slate-200 pt-3 text-xs space-y-1 text-slate-600">
                <div class="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Thông tin thụ hưởng / Beneficiary details:</div>
                <div class="flex items-baseline gap-2">
                    <span class="font-semibold">Tài khoản thụ hưởng / Beneficiary:</span>
                    <span class="font-black text-[#1e293b]">{{ summary.beneficiaryInfo.name }}</span>
                </div>
                <div class="flex items-baseline gap-2">
                    <span class="font-semibold">Số tài khoản / Account Number:</span>
                    <span class="font-black font-mono text-primary text-sm">{{ summary.beneficiaryInfo.accountNo }}</span>
                    <span>tại</span>
                    <span class="font-bold text-slate-800">{{ summary.beneficiaryInfo.bank }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

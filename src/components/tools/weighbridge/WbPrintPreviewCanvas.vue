<script setup lang="ts">
import type { PrintElement } from '@/services/weighbridge/WeighbridgeService';

defineProps<{
    elements?: PrintElement[];
    widthMm?: number;
    heightMm?: number;
    ticketData?: Record<string, any>;
}>();

const emit = defineEmits<{
    (e: 'selectElement', element: PrintElement): void;
}>();
</script>

<template>
    <div class="bg-gray-100/70 rounded-[24px] p-6 flex flex-col items-center justify-center min-h-[400px] border border-primary/5 shadow-inner overflow-auto scrollbar-none">
        <!-- Canvas paper container simulating physical ticket -->
        <div 
            class="bg-white rounded-lg shadow-md border border-gray-300 relative overflow-hidden transition-all print:shadow-none print:border-none"
            :style="{
                width: (widthMm || 210) * 3.78 + 'px',
                minHeight: (heightMm || 148) * 3.78 + 'px'
            }"
        >
            <!-- Watermark / Decorative header -->
            <div class="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                    <h4 class="font-display font-bold text-sm text-[#1e293b] tracking-tight">CẢNG BIỂN NGUYÊN NGỌC</h4>
                    <p class="text-xs text-slate-500">HỆ THỐNG TRẠM CÂN TỰ ĐỘNG</p>
                </div>
                <span class="text-xs font-mono font-bold text-primary">PHIẾU CÂN XE</span>
            </div>

            <!-- Dynamic Print Elements Simulation -->
            <div class="p-6 relative text-xs">
                <slot>
                    <div class="space-y-3 font-mono text-gray-700">
                        <div class="flex justify-between border-b border-dashed border-gray-200 pb-2">
                            <span class="text-slate-500">Số phiếu:</span>
                            <span class="font-bold text-[#1e293b]">{{ ticketData?.ticketNo || 'PK-0001' }}</span>
                        </div>
                        <div class="flex justify-between border-b border-dashed border-gray-200 pb-2">
                            <span class="text-slate-500">Biển số xe:</span>
                            <span class="font-bold text-[#1e293b]">{{ ticketData?.plateNumber || '51C-123.45' }}</span>
                        </div>
                        <div class="flex justify-between border-b border-dashed border-gray-200 pb-2">
                            <span class="text-slate-500">Khối lượng tổng:</span>
                            <span class="font-bold text-[#1e293b]">{{ ticketData?.weight1 ? ticketData.weight1.toLocaleString() + ' kg' : '25,400 kg' }}</span>
                        </div>
                        <div class="flex justify-between border-b border-dashed border-gray-200 pb-2">
                            <span class="text-slate-500">Tự trọng:</span>
                            <span class="font-bold text-[#1e293b]">{{ ticketData?.weight2 ? ticketData.weight2.toLocaleString() + ' kg' : '10,200 kg' }}</span>
                        </div>
                        <div class="flex justify-between border-b border-dashed border-gray-200 pb-2">
                            <span class="text-slate-500">Khối lượng hàng:</span>
                            <span class="font-bold text-teal-600 text-sm">{{ ticketData?.weightNet ? ticketData.weightNet.toLocaleString() + ' kg' : '15,200 kg' }}</span>
                        </div>
                    </div>
                </slot>
            </div>

            <!-- Signatures line -->
            <div class="p-6 pt-4 grid grid-cols-2 gap-4 text-center text-xs text-slate-500">
                <div>
                    <p class="font-bold text-slate-600 mb-8">Người giao nhận</p>
                    <p>(Ký, ghi rõ họ tên)</p>
                </div>
                <div>
                    <p class="font-bold text-slate-600 mb-8">Nhân viên bàn cân</p>
                    <p>(Ký, ghi rõ họ tên)</p>
                </div>
            </div>
        </div>
    </div>
</template>

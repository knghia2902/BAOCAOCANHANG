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
    <div class="bg-gray-100/70 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[400px] border border-gray-200/60 shadow-inner overflow-auto">
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
                    <h4 class="font-bold text-sm text-gray-900 tracking-tight">C?NG BI?N NGUY�N NG?C</h4>
                    <p class="text-[10px] text-gray-400">H? TH?NG TR?M C�N T? �?NG</p>
                </div>
                <span class="text-xs font-mono font-bold text-primary">PHI?U C�N XE</span>
            </div>

            <!-- Dynamic Print Elements Simulation -->
            <div class="p-6 relative text-xs">
                <slot>
                    <div class="space-y-3 font-mono text-gray-700">
                        <div class="flex justify-between border-b border-dashed border-gray-200 pb-2">
                            <span class="text-gray-400">S? phi?u:</span>
                            <span class="font-bold text-gray-900">{{ ticketData?.ticketNo || 'PK-0001' }}</span>
                        </div>
                        <div class="flex justify-between border-b border-dashed border-gray-200 pb-2">
                            <span class="text-gray-400">Bi?n s? xe:</span>
                            <span class="font-bold text-gray-900">{{ ticketData?.plateNumber || '51C-123.45' }}</span>
                        </div>
                        <div class="flex justify-between border-b border-dashed border-gray-200 pb-2">
                            <span class="text-gray-400">Kh?i l�?ng t?ng:</span>
                            <span class="font-bold text-gray-900">{{ ticketData?.weight1 ? ticketData.weight1.toLocaleString() + ' kg' : '25,400 kg' }}</span>
                        </div>
                        <div class="flex justify-between border-b border-dashed border-gray-200 pb-2">
                            <span class="text-gray-400">T? tr?ng:</span>
                            <span class="font-bold text-gray-900">{{ ticketData?.weight2 ? ticketData.weight2.toLocaleString() + ' kg' : '10,200 kg' }}</span>
                        </div>
                        <div class="flex justify-between border-b border-dashed border-gray-200 pb-2">
                            <span class="text-gray-400">Kh?i l�?ng h�ng:</span>
                            <span class="font-bold text-emerald-600 text-sm">{{ ticketData?.weightNet ? ticketData.weightNet.toLocaleString() + ' kg' : '15,200 kg' }}</span>
                        </div>
                    </div>
                </slot>
            </div>

            <!-- Signatures line -->
            <div class="p-6 pt-4 grid grid-cols-2 gap-4 text-center text-[10px] text-gray-400">
                <div>
                    <p class="font-bold text-gray-600 mb-8">Ng�?i giao nh?n</p>
                    <p>(K?, ghi r? h? t�n)</p>
                </div>
                <div>
                    <p class="font-bold text-gray-600 mb-8">Nh�n vi�n b�n c�n</p>
                    <p>(K?, ghi r? h? t�n)</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { BargeConfig } from '@/services/weighbridge/WeighbridgeService';

const props = defineProps<{
    config: BargeConfig;
    isReadOnly?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:config', config: BargeConfig): void;
    (e: 'save'): void;
}>();

const updateField = (field: keyof BargeConfig, value: any) => {
    emit('update:config', {
        ...props.config,
        [field]: value
    });
};
</script>

<template>
    <div class="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 class="text-sm font-bold text-gray-800 flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-base">tune</span>
                C?u h?nh th�ng s? phi?u in
            </h3>
            <span v-if="isReadOnly" class="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded">Ch? xem</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
                <label class="font-bold text-gray-600 block mb-1">T�n h�ng h�a</label>
                <input 
                    :value="config.goods" 
                    @input="updateField('goods', ($event.target as HTMLInputElement).value)"
                    :disabled="isReadOnly"
                    type="text" 
                    class="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary/50 text-gray-800 font-medium"
                />
            </div>

            <div>
                <label class="font-bold text-gray-600 block mb-1">M? h�ng h�a</label>
                <input 
                    :value="config.goodsCode" 
                    @input="updateField('goodsCode', ($event.target as HTMLInputElement).value)"
                    :disabled="isReadOnly"
                    type="text" 
                    class="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary/50 text-gray-800 font-medium"
                />
            </div>

            <div>
                <label class="font-bold text-gray-600 block mb-1">Ch? h�ng (Kh�ch h�ng)</label>
                <input 
                    :value="config.owner" 
                    @input="updateField('owner', ($event.target as HTMLInputElement).value)"
                    :disabled="isReadOnly"
                    type="text" 
                    class="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary/50 text-gray-800 font-medium"
                />
            </div>

            <div>
                <label class="font-bold text-gray-600 block mb-1">��n v? v?n h�nh (X� nghi?p)</label>
                <input 
                    :value="config.xn" 
                    @input="updateField('xn', ($event.target as HTMLInputElement).value)"
                    :disabled="isReadOnly"
                    type="text" 
                    class="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary/50 text-gray-800 font-medium"
                />
            </div>

            <div>
                <label class="font-bold text-gray-600 block mb-1">Ti?n t? s? phi?u</label>
                <input 
                    :value="config.ticketPrefix" 
                    @input="updateField('ticketPrefix', ($event.target as HTMLInputElement).value)"
                    :disabled="isReadOnly"
                    type="text" 
                    class="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary/50 text-gray-800 font-medium"
                />
            </div>

            <div>
                <label class="font-bold text-gray-600 block mb-1">S? b?t �?u</label>
                <input 
                    :value="config.ticketSeed" 
                    @input="updateField('ticketSeed', ($event.target as HTMLInputElement).value)"
                    :disabled="isReadOnly"
                    type="text" 
                    class="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary/50 text-gray-800 font-medium"
                />
            </div>
        </div>

        <div v-if="!isReadOnly" class="pt-2 flex justify-end">
            <button 
                @click="emit('save')"
                type="button"
                class="px-4 py-2 bg-primary text-white font-bold text-xs rounded-xl shadow-xs hover:bg-primary-dark transition-colors flex items-center gap-1.5"
            >
                <span class="material-symbols-outlined text-sm">save</span>
                L�u c?u h?nh
            </button>
        </div>
    </div>
</template>

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
    <div class="bg-white rounded-[24px] p-5 border border-primary/5 shadow-xs space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 class="text-sm font-display font-bold text-[#1e293b] flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-base">tune</span>
                Cấu hình thông số phiếu in
            </h3>
            <span v-if="isReadOnly" class="text-xs bg-slate-100 text-slate-500 font-bold px-2.5 py-0.5 rounded-xl">Chỉ xem</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
                <label class="font-bold text-slate-600 block mb-1">Tên hàng hóa</label>
                <input 
                    :value="config.goods" 
                    @input="updateField('goods', ($event.target as HTMLInputElement).value)"
                    :disabled="isReadOnly"
                    type="text" 
                    class="w-full bg-[#f1f5f9] border border-slate-200 rounded-2xl px-3.5 py-2 outline-none focus:border-primary text-[#1e293b] font-semibold"
                />
            </div>

            <div>
                <label class="font-bold text-slate-600 block mb-1">Mã hàng hóa</label>
                <input 
                    :value="config.goodsCode" 
                    @input="updateField('goodsCode', ($event.target as HTMLInputElement).value)"
                    :disabled="isReadOnly"
                    type="text" 
                    class="w-full bg-[#f1f5f9] border border-slate-200 rounded-2xl px-3.5 py-2 outline-none focus:border-primary text-[#1e293b] font-semibold"
                />
            </div>

            <div>
                <label class="font-bold text-slate-600 block mb-1">Chủ hàng (Khách hàng)</label>
                <input 
                    :value="config.owner" 
                    @input="updateField('owner', ($event.target as HTMLInputElement).value)"
                    :disabled="isReadOnly"
                    type="text" 
                    class="w-full bg-[#f1f5f9] border border-slate-200 rounded-2xl px-3.5 py-2 outline-none focus:border-primary text-[#1e293b] font-semibold"
                />
            </div>

            <div>
                <label class="font-bold text-slate-600 block mb-1">Đơn vị vận hành (Xí nghiệp)</label>
                <input 
                    :value="config.xn" 
                    @input="updateField('xn', ($event.target as HTMLInputElement).value)"
                    :disabled="isReadOnly"
                    type="text" 
                    class="w-full bg-[#f1f5f9] border border-slate-200 rounded-2xl px-3.5 py-2 outline-none focus:border-primary text-[#1e293b] font-semibold"
                />
            </div>

            <div>
                <label class="font-bold text-slate-600 block mb-1">Tiền tố số phiếu</label>
                <input 
                    :value="config.ticketPrefix" 
                    @input="updateField('ticketPrefix', ($event.target as HTMLInputElement).value)"
                    :disabled="isReadOnly"
                    type="text" 
                    class="w-full bg-[#f1f5f9] border border-slate-200 rounded-2xl px-3.5 py-2 outline-none focus:border-primary text-[#1e293b] font-semibold"
                />
            </div>

            <div>
                <label class="font-bold text-slate-600 block mb-1">Số bắt đầu</label>
                <input 
                    :value="config.ticketSeed" 
                    @input="updateField('ticketSeed', ($event.target as HTMLInputElement).value)"
                    :disabled="isReadOnly"
                    type="text" 
                    class="w-full bg-[#f1f5f9] border border-slate-200 rounded-2xl px-3.5 py-2 outline-none focus:border-primary text-[#1e293b] font-semibold"
                />
            </div>
        </div>

        <div v-if="!isReadOnly" class="pt-2 flex justify-end">
            <button 
                @click="emit('save')"
                type="button"
                class="px-5 py-2 bg-primary text-white font-bold text-xs rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-1.5"
            >
                <span class="material-symbols-outlined text-sm">save</span>
                Lưu cấu hình
            </button>
        </div>
    </div>
</template>

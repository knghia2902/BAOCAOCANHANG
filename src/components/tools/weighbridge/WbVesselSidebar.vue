<script setup lang="ts">
import { computed } from 'vue';
import type { Vessel } from '@/services/weighbridge/WeighbridgeService';

const props = defineProps<{
    vessels: Vessel[];
    activeVesselId: number | null;
    activeBargeName: string | null;
    filterStatus: 'all' | 'in_progress' | 'done';
}>();

const emit = defineEmits<{
    (e: 'selectVessel', id: number): void;
    (e: 'selectBarge', name: string): void;
    (e: 'setFilterStatus', status: 'all' | 'in_progress' | 'done'): void;
    (e: 'createVessel'): void;
    (e: 'createBarge'): void;
}>();

const filteredVessels = computed(() => {
    if (props.filterStatus === 'all') return props.vessels;
    return props.vessels.filter(v => (v.status || 'in_progress') === props.filterStatus);
});
</script>

<template>
    <div class="w-72 bg-white border-r border-primary/5 flex flex-col h-full shrink-0 shadow-sm">
        <!-- Header & Status Tabs -->
        <div class="p-4 border-b border-gray-100">
            <div class="flex items-center justify-between mb-3">
                <h2 class="font-display font-bold text-sm text-[#1e293b] flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary text-base">sailing</span>
                    Danh sách Tàu &amp; Sà lan
                </h2>
                <button 
                    @click="emit('createVessel')"
                    class="size-7 rounded-[8px] bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                    title="Thêm tàu mới"
                >
                    <span class="material-symbols-outlined text-sm">add</span>
                </button>
            </div>

            <!-- Status Switcher Tabs (DESIGN.md Mục 6) -->
            <div class="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 h-8 items-center text-xs font-bold">
                <button 
                    @click="emit('setFilterStatus', 'in_progress')"
                    :class="[
                        'flex-1 px-2 py-0.5 h-6.5 rounded-lg font-display font-bold transition-all text-center',
                        filterStatus === 'in_progress' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                    ]"
                >
                    Đang làm
                </button>
                <button 
                    @click="emit('setFilterStatus', 'done')"
                    :class="[
                        'flex-1 px-2 py-0.5 h-6.5 rounded-lg font-display font-bold transition-all text-center',
                        filterStatus === 'done' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                    ]"
                >
                    Đã xong
                </button>
                <button 
                    @click="emit('setFilterStatus', 'all')"
                    :class="[
                        'flex-1 px-2 py-0.5 h-6.5 rounded-lg font-display font-bold transition-all text-center',
                        filterStatus === 'all' ? 'bg-primary text-white shadow-soft' : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                    ]"
                >
                    Tất cả
                </button>
            </div>
        </div>

        <!-- Vessel & Barge List -->
        <div class="flex-1 overflow-y-auto scrollbar-none p-3 space-y-2">
            <div v-if="filteredVessels.length === 0" class="text-center py-8 text-gray-400 text-xs">
                <span class="material-symbols-outlined text-3xl mb-1 block">directions_boat</span>
                Không có tàu nào phù hợp
            </div>

            <div 
                v-for="vessel in filteredVessels" 
                :key="vessel.id"
                class="rounded-xl border border-gray-100 overflow-hidden transition-all bg-white"
                :class="activeVesselId === vessel.id ? 'border-primary/30 ring-1 ring-primary/20' : ''"
            >
                <div 
                    @click="emit('selectVessel', vessel.id)"
                    class="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    :class="activeVesselId === vessel.id ? 'bg-primary/5 font-bold text-primary' : 'text-gray-700'"
                >
                    <div class="flex items-center gap-2 truncate">
                        <span class="material-symbols-outlined text-base text-primary/70">directions_boat</span>
                        <span class="text-xs font-bold truncate">{{ vessel.name }}</span>
                    </div>
                    <span 
                        :class="[
                            'text-xs px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0',
                            vessel.status === 'done' ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'
                        ]"
                    >
                        {{ vessel.status === 'done' ? 'Xong' : 'Đang làm' }}
                    </span>
                </div>

                <!-- Barge Accordion for Active Vessel -->
                <div v-if="activeVesselId === vessel.id && (vessel.barges || []).length > 0" class="bg-gray-50/50 p-2 space-y-1 border-t border-gray-100">
                    <div 
                        v-for="barge in vessel.barges" 
                        :key="barge.name"
                        @click="emit('selectBarge', barge.name)"
                        :class="[
                            'px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer flex items-center justify-between transition-colors',
                            activeBargeName === barge.name ? 'bg-white shadow-xs text-primary font-bold' : 'text-gray-600 hover:bg-white/60'
                        ]"
                    >
                        <span class="truncate">{{ barge.name }}</span>
                        <span v-if="barge.goods" class="text-xs text-gray-400 truncate max-w-[80px]">{{ barge.goods }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

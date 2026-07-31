<script setup lang="ts">
defineProps<{
    totalTickets: number;
    totalNetWeightTons: string;
    uniquePlates: number;
}>();
</script>

<template>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Tổng phiếu cân -->
        <div class="bg-white rounded-2xl p-4 border border-primary/10 shadow-soft flex items-center gap-3.5">
            <div class="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-2xl">description</span>
            </div>
            <div>
                <div class="text-xs font-bold text-slate-500">Tổng phiếu cân</div>
                <div class="text-xl font-display font-black text-slate-800 mt-0.5">{{ totalTickets }}</div>
            </div>
        </div>

        <!-- Tổng khối lượng tịnh -->
        <div class="bg-white rounded-2xl p-4 border border-teal-200/60 shadow-soft flex items-center gap-3.5">
            <div class="size-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-2xl">scale</span>
            </div>
            <div>
                <div class="text-xs font-bold text-slate-500">Tổng khối lượng tịnh</div>
                <div class="text-xl font-display font-black text-teal-700 mt-0.5">{{ totalNetWeightTons }} <span class="text-xs font-bold text-teal-600">tấn</span></div>
            </div>
        </div>

        <!-- Phương tiện đã cân -->
        <div class="bg-white rounded-2xl p-4 border border-indigo-200/60 shadow-soft flex items-center gap-3.5">
            <div class="size-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-2xl">local_shipping</span>
            </div>
            <div>
                <div class="text-xs font-bold text-slate-500">Phương tiện đã cân</div>
                <div class="text-xl font-display font-black text-slate-800 mt-0.5">{{ uniquePlates }} <span class="text-xs font-bold text-slate-500">xe</span></div>
            </div>
        </div>
    </div>
</template>

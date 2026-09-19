import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Vessel } from '@/services/excel/WeighbridgeService';

export const useWeighbridgeStore = defineStore('weighbridge', () => {
    const vessels = ref<Vessel[]>([]);
    const activeVesselId = ref<number | null>(null);
    const activeBargeName = ref<string | null>(null);
    const isLoading = ref<boolean>(false);
    const filterStatus = ref<'all' | 'in_progress' | 'done'>('in_progress');

    const activeVessel = computed(() => {
        return vessels.value.find(v => v.id === activeVesselId.value) || null;
    });

    const activeBarges = computed(() => {
        return activeVessel.value?.barges || [];
    });

    function setVessels(list: Vessel[]) {
        vessels.value = list;
    }

    function setActiveVessel(id: number | null) {
        activeVesselId.value = id;
    }

    function setActiveBarge(name: string | null) {
        activeBargeName.value = name;
    }

    function setFilterStatus(status: 'all' | 'in_progress' | 'done') {
        filterStatus.value = status;
    }

    return {
        vessels,
        activeVesselId,
        activeBargeName,
        isLoading,
        filterStatus,
        activeVessel,
        activeBarges,
        setVessels,
        setActiveVessel,
        setActiveBarge,
        setFilterStatus
    };
});

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { AllocatorTripItem } from '@/services/excel/AllocatorService';

export const useAllocatorStore = defineStore('allocator', () => {
    const historicalTrips = ref<AllocatorTripItem[]>([]);
    const isLoading = ref<boolean>(false);
    const activeTab = ref<number>(1);
    const totalLoaded = computed(() => historicalTrips.value.length);

    function setTrips(trips: AllocatorTripItem[]) {
        historicalTrips.value = trips;
    }

    function appendTrips(trips: AllocatorTripItem[]) {
        historicalTrips.value.push(...trips);
    }

    function setActiveTab(tab: number) {
        activeTab.value = tab;
    }

    return {
        historicalTrips,
        isLoading,
        activeTab,
        totalLoaded,
        setTrips,
        appendTrips,
        setActiveTab
    };
});

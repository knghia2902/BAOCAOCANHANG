<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';

import { authStore } from '../stores/auth';

import { WeighbridgeService } from '../services/excel/WeighbridgeService';
import { ContentService } from '../services/ContentService';



const vessels = ref<any[]>([]);
const loading = ref(true);
const allowedTools = ref<string[]>([]);
const loadingTools = ref(true);

const loadData = async () => {
    try {
        loading.value = true;
        const data = await WeighbridgeService.getVessels() || [];
        vessels.value = data
            .filter(v => v.name !== 'KHU VỰC PHÚ MỸ')
            .map(v => ({
                ...v,
                barges: (v.barges || []).filter((b: any) => b.config?.site !== 'PhuMy')
            }));
    } catch (e) {
        console.error('Error loading home data:', e);
    } finally {
        loading.value = false;
    }
};

const allBarges = computed(() => {
    const list: any[] = [];
    vessels.value.forEach(v => {
        if (v.barges) {
            v.barges.forEach((b: any) => {
                list.push({
                    ...b,
                    vesselId: v.id,
                    vesselName: v.name,
                    orderNo: b.config?.orderNo || '',
                    locked: b.config?.locked || false
                });
            });
        }
    });
    return list;
});



const loadToolsConfig = async () => {
    loadingTools.value = true;
    if (authStore.role === 'staff') {
        allowedTools.value = await ContentService.loadStaffTools();
    } else {
        allowedTools.value = ['converter', 'merger', 'weighbridge', 'allocator', 'vehicles', 'ocr'];
    }
    loadingTools.value = false;
};

// Format current date
const formattedDate = computed(() => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('vi-VN', options);
});

// Greeting based on time of day
const greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
});

watch(() => [authStore.isAuthenticated, authStore.role], async () => {
    await loadToolsConfig();
}, { immediate: true });

onMounted(async () => {
    loadData();
});
</script>

<template>
    <!-- Floating decorations -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div class="absolute top-[15%] left-[10%] text-strawberry-cream floating-1 twinkle opacity-40">
            <span class="material-symbols-outlined text-4xl">colors_spark</span>
        </div>
        <div class="absolute bottom-[20%] right-[15%] text-strawberry-cream floating-2 twinkle opacity-40">
            <span class="material-symbols-outlined text-5xl">anchor</span>
        </div>
        <div class="absolute top-[60%] left-[5%] text-strawberry-cream floating-1 twinkle opacity-20" style="animation-delay: 2s">
            <span class="material-symbols-outlined text-6xl">flare</span>
        </div>
        <div class="absolute top-[40%] right-[10%] text-strawberry-cream floating-2 twinkle opacity-30" style="animation-delay: 1s">
            <span class="material-symbols-outlined text-3xl">magic_button</span>
        </div>
    </div>

    <main class="flex-1 flex flex-col max-w-[1200px] mx-auto px-4 md:px-10 pb-20 w-full pt-10">
        <!-- Hero Section -->
        <section class="flex flex-col-reverse lg:flex-row items-center justify-between py-16 lg:py-24 gap-12">
            <div class="flex flex-col gap-8 flex-1 text-center lg:text-left">
                <div class="flex flex-col gap-4">
                    <div class="flex items-center gap-2 justify-center lg:justify-start">
                        <span class="text-primary font-bold tracking-widest uppercase text-xs">Hệ thống vận hành</span>
                        <span class="material-symbols-outlined text-primary text-sm">auto_awesome</span>
                    </div>
                    <h1 class="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight text-[#1e293b]">
                        {{ greeting }}, {{ authStore.displayName }}! ✨
                    </h1>
                    <p class="text-lg md:text-xl text-[#1e293b]/60 max-w-xl mx-auto lg:mx-0 font-medium whitespace-pre-line">
                        Hôm nay là <span class="font-bold text-[#1e293b]">{{ formattedDate }}</span>.
                        Hệ thống sẵn sàng phục vụ bạn.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-4 justify-center lg:justify-start">
                    <router-link to="/tools" class="min-w-[180px] h-14 flex items-center justify-center rounded-full bg-primary text-white font-bold text-lg glow-primary hover:translate-y-[-2px] transition-all">
                        Mở công cụ
                    </router-link>
                    <router-link v-if="authStore.role === 'admin'" to="/admin" class="min-w-[180px] h-14 flex items-center justify-center rounded-full border-2 border-strawberry-cream font-bold text-lg hover:bg-white/50 transition-all text-primary">
                        Quản trị
                    </router-link>
                </div>
            </div>
            <div class="relative flex-1 flex justify-center items-center">
                <div class="absolute -top-10 right-10 text-primary floating-1">
                    <span class="material-symbols-outlined text-4xl">directions_boat</span>
                </div>
                <div class="absolute -bottom-10 left-0 text-strawberry-cream floating-2">
                    <span class="material-symbols-outlined text-5xl">auto_awesome</span>
                </div>
                <div class="absolute top-20 -left-10 text-primary/60 floating-1" style="animation-delay: 1s;">
                    <span class="material-symbols-outlined text-3xl">star_rate</span>
                </div>
                <div class="relative size-[320px] md:size-[400px] blob-shape bg-primary/10 flex items-center justify-center p-6 overflow-hidden shadow-2xl glow-primary">
                    <!-- Stats inside blob -->
                    <div class="flex flex-col items-center gap-4 text-center z-10">
                        <span class="material-symbols-outlined text-primary text-6xl">sailing</span>
                        <div class="flex flex-col gap-1">
                            <span class="text-5xl font-black text-primary">{{ loading ? '...' : vessels.length }}</span>
                            <span class="text-sm font-bold text-[#1e293b]/60">tàu đang làm hàng</span>
                        </div>
                        <div class="flex gap-6 mt-2">
                            <div class="flex flex-col items-center">
                                <span class="text-2xl font-black text-teal-600">{{ loading ? '...' : allBarges.length }}</span>
                                <span class="text-[10px] font-bold text-[#1e293b]/50">sà lan</span>
                            </div>
                            <div class="flex flex-col items-center">
                                <span class="text-2xl font-black text-amber-600">{{ loading ? '...' : allBarges.filter(b => !b.locked).length }}</span>
                                <span class="text-[10px] font-bold text-[#1e293b]/50">đang mở</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Toolkit Section -->
        <section class="py-10 bg-white/20 rounded-xl backdrop-blur-sm border border-white/40 mb-20">
            <div class="flex flex-col items-center gap-4 mb-10">
                <h2 class="text-3xl md:text-4xl font-bold text-center text-[#1e293b]">Tiện ích hệ thống</h2>
                <div class="h-1.5 w-24 bg-primary rounded-full glow-primary"></div>
            </div>
            <div class="flex flex-wrap justify-center gap-4 md:gap-6 px-4" v-if="!loadingTools">
                <!-- Dashboard / Báo cáo tổng quan -->
                <router-link
                    v-if="allowedTools.includes('weighbridge')"
                    to="/tools/printer"
                    class="group flex flex-col items-center gap-3 p-6 bg-white/60 border border-soft-pink/10 rounded-xl transition-all cursor-pointer backdrop-blur-md shadow-sm hover:shadow-md hover:scale-105 hover:border-primary/30 hover:bg-white/80"
                >
                    <div class="size-16 rounded-full bg-white flex items-center justify-center shadow-sm text-primary transition-colors group-hover:bg-primary/5">
                        <span class="material-symbols-outlined text-3xl">print</span>
                    </div>
                    <div class="text-center">
                        <p class="font-bold text-lg leading-none">Dashboard</p>
                        <p class="text-[10px] text-primary font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">Click to use ✨</p>
                    </div>
                </router-link>

                <!-- Dữ liệu cân hàng -->
                <router-link
                    v-if="allowedTools.includes('allocator')"
                    to="/tools/allocator"
                    class="group flex flex-col items-center gap-3 p-6 bg-white/60 border border-soft-pink/10 rounded-xl transition-all cursor-pointer backdrop-blur-md shadow-sm hover:shadow-md hover:scale-105 hover:border-primary/30 hover:bg-white/80"
                >
                    <div class="size-16 rounded-full bg-white flex items-center justify-center shadow-sm text-primary transition-colors group-hover:bg-primary/5">
                        <span class="material-symbols-outlined text-3xl">shuffle</span>
                    </div>
                    <div class="text-center">
                        <p class="font-bold text-lg leading-none">Cân hàng</p>
                        <p class="text-[10px] text-primary font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">Click to use ✨</p>
                    </div>
                </router-link>

                <!-- Quản lý hồ sơ phương tiện -->
                <router-link
                    v-if="allowedTools.includes('vehicles')"
                    to="/tools/vehicles"
                    class="group flex flex-col items-center gap-3 p-6 bg-white/60 border border-soft-pink/10 rounded-xl transition-all cursor-pointer backdrop-blur-md shadow-sm hover:shadow-md hover:scale-105 hover:border-primary/30 hover:bg-white/80"
                >
                    <div class="size-16 rounded-full bg-white flex items-center justify-center shadow-sm text-primary transition-colors group-hover:bg-primary/5">
                        <span class="material-symbols-outlined text-3xl">local_shipping</span>
                    </div>
                    <div class="text-center">
                        <p class="font-bold text-lg leading-none">Phương tiện</p>
                        <p class="text-[10px] text-primary font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">Click to use ✨</p>
                    </div>
                </router-link>

                <!-- Biên bản sà lan -->
                <router-link
                    to="/tools?tool=minutes"
                    class="group flex flex-col items-center gap-3 p-6 bg-white/60 border border-soft-pink/10 rounded-xl transition-all cursor-pointer backdrop-blur-md shadow-sm hover:shadow-md hover:scale-105 hover:border-primary/30 hover:bg-white/80"
                >
                    <div class="size-16 rounded-full bg-white flex items-center justify-center shadow-sm text-primary transition-colors group-hover:bg-primary/5">
                        <span class="material-symbols-outlined text-3xl">description</span>
                    </div>
                    <div class="text-center">
                        <p class="font-bold text-lg leading-none">Biên bản</p>
                        <p class="text-[10px] text-primary font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">Click to use ✨</p>
                    </div>
                </router-link>

                <!-- Bộ công cụ Excel/PDF -->
                <router-link
                    to="/tools?tool=utilities"
                    class="group flex flex-col items-center gap-3 p-6 bg-white/60 border border-soft-pink/10 rounded-xl transition-all cursor-pointer backdrop-blur-md shadow-sm hover:shadow-md hover:scale-105 hover:border-primary/30 hover:bg-white/80"
                >
                    <div class="size-16 rounded-full bg-white flex items-center justify-center shadow-sm text-primary transition-colors group-hover:bg-primary/5">
                        <span class="material-symbols-outlined text-3xl">construction</span>
                    </div>
                    <div class="text-center">
                        <p class="font-bold text-lg leading-none">Excel & PDF</p>
                        <p class="text-[10px] text-primary font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">Click to use ✨</p>
                    </div>
                </router-link>

                <!-- Admin panel -->
                <router-link
                    v-if="authStore.role === 'admin'"
                    to="/admin"
                    class="group flex flex-col items-center gap-3 p-6 bg-white/60 border border-soft-pink/10 rounded-xl transition-all cursor-pointer backdrop-blur-md shadow-sm hover:shadow-md hover:scale-105 hover:border-primary/30 hover:bg-white/80"
                >
                    <div class="size-16 rounded-full bg-white flex items-center justify-center shadow-sm text-primary transition-colors group-hover:bg-primary/5">
                        <span class="material-symbols-outlined text-3xl">settings_applications</span>
                    </div>
                    <div class="text-center">
                        <p class="font-bold text-lg leading-none">Quản trị</p>
                        <p class="text-[10px] text-primary font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">Click to use ✨</p>
                    </div>
                </router-link>
            </div>
        </section>

        <!-- Quick Stats Section -->
        <section class="py-10">
            <div class="flex items-center justify-between mb-10 px-4">
                <h2 class="text-3xl md:text-4xl font-bold text-[#1e293b]">Tổng quan hệ thống</h2>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                <!-- Stat Card 1: Vessels -->
                <div class="bg-white rounded-[2rem] p-6 pb-8 text-center border border-primary/5 hover:-translate-y-2 transition-transform duration-300 shadow-sm hover:shadow-xl flex flex-col items-center">
                    <div class="relative w-full aspect-[4/3] rounded-[1.5rem] overflow-hidden mb-4 flex items-center justify-center bg-primary/5">
                        <span class="material-symbols-outlined text-primary text-7xl opacity-20">directions_boat</span>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="text-6xl font-black text-primary">{{ loading ? '...' : vessels.length }}</span>
                        </div>
                    </div>
                    <div class="inline-block px-4 py-1.5 bg-primary/10 rounded-full mb-4">
                        <span class="text-xs font-bold text-primary uppercase tracking-wider">Đang hoạt động</span>
                    </div>
                    <h3 class="text-2xl font-bold mb-2 text-primary">Tàu hàng</h3>
                    <p class="text-[#1e293b]/60 font-medium leading-relaxed max-w-sm mx-auto">Số tàu đang thực hiện xếp dỡ hàng hóa tại cảng.</p>
                </div>

                <!-- Stat Card 2: Barges -->
                <div class="bg-white rounded-[2rem] p-6 pb-8 text-center border border-teal-600/5 hover:-translate-y-2 transition-transform duration-300 shadow-sm hover:shadow-xl flex flex-col items-center">
                    <div class="relative w-full aspect-[4/3] rounded-[1.5rem] overflow-hidden mb-4 flex items-center justify-center bg-teal-50">
                        <span class="material-symbols-outlined text-teal-600 text-7xl opacity-20">layers</span>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="text-6xl font-black text-teal-600">{{ loading ? '...' : allBarges.length }}</span>
                        </div>
                    </div>
                    <div class="inline-block px-4 py-1.5 bg-teal-50 rounded-full mb-4">
                        <span class="text-xs font-bold text-teal-600 uppercase tracking-wider">Đã lập</span>
                    </div>
                    <h3 class="text-2xl font-bold mb-2 text-teal-600">Sà lan</h3>
                    <p class="text-[#1e293b]/60 font-medium leading-relaxed max-w-sm mx-auto">Tổng số sà lan đã được lập hồ sơ trong hệ thống.</p>
                </div>

                <!-- Stat Card 3: Unlocked -->
                <div class="bg-white rounded-[2rem] p-6 pb-8 text-center border border-amber-600/5 hover:-translate-y-2 transition-transform duration-300 shadow-sm hover:shadow-xl flex flex-col items-center">
                    <div class="relative w-full aspect-[4/3] rounded-[1.5rem] overflow-hidden mb-4 flex items-center justify-center bg-amber-50">
                        <span class="material-symbols-outlined text-amber-600 text-7xl opacity-20">lock_open</span>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="text-6xl font-black text-amber-600">{{ loading ? '...' : allBarges.filter(b => !b.locked).length }}</span>
                        </div>
                    </div>
                    <div class="inline-block px-4 py-1.5 bg-amber-50 rounded-full mb-4">
                        <span class="text-xs font-bold text-amber-600 uppercase tracking-wider">Đồng bộ</span>
                    </div>
                    <h3 class="text-2xl font-bold mb-2 text-amber-600">Đang mở khóa</h3>
                    <p class="text-[#1e293b]/60 font-medium leading-relaxed max-w-sm mx-auto">Sà lan đang nhận đồng bộ dữ liệu từ đám mây.</p>
                </div>
            </div>
        </section>
    </main>
</template>

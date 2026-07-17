<script setup lang="ts">
import { computed } from 'vue';
import { contentStore } from '../stores/content';

const aboutData = computed(() => {
    const hero = contentStore.hero || {};
    const about = contentStore.about || {};
    const socials = about.social || [];
    
    const fbSocial = socials.find((s: any) => s.platform.toLowerCase() === 'facebook');
    const instaSocial = socials.find((s: any) => s.platform.toLowerCase() === 'instagram');

    return {
        title: 'Giới Thiệu Bản Thân',
        name: hero.title ? hero.title.replace("Hi, I'm ", "") : 'Ngọc Ánh',
        avatar: hero.avatar || 'https://ngocanhcute.vercel.app/avatar.jpg',
        bio: hero.subtitle || 'Chào mọi người! Mình là Ngọc Ánh. Đây là góc nhỏ chứa các công cụ tiện ích hỗ trợ công việc in ấn và báo cáo cân hàng tại Cảng Nguyên Ngọc.',
        facebook: fbSocial ? fbSocial.url : 'https://facebook.com',
        instagram: instaSocial ? instaSocial.url : 'https://instagram.com'
    };
});
</script>

<template>
    <div class="flex-1 w-[95%] max-w-[1000px] mx-auto py-8 flex flex-col gap-8 text-left no-print font-display">
        <!-- Hero Profile Card -->
        <div class="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-gray-150 flex flex-col md:flex-row items-center gap-8">
            <div 
                class="size-36 md:size-44 bg-center bg-no-repeat bg-cover rounded-full border-4 border-pastel-pink shrink-0 shadow-md"
                :style="{ backgroundImage: `url(${aboutData.avatar})` }"
            ></div>
            
            <div class="space-y-4 flex-1">
                <span class="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-full border border-primary/10">DEVELOPER & CREATOR</span>
                <h2 class="text-2xl md:text-3xl font-display font-black text-[#1e293b]">
                    {{ aboutData.name }} ✨
                </h2>
                <p class="text-xs md:text-sm font-semibold text-[#1b0d11]/70 leading-relaxed">
                    {{ aboutData.bio }}
                </p>
                
                <!-- Social media connections -->
                <div class="flex gap-3 pt-2">
                    <a 
                        v-if="aboutData.facebook"
                        :href="aboutData.facebook" 
                        target="_blank" 
                        class="h-9 px-4 bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold rounded-xl text-[10px] flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                        <span class="material-symbols-outlined text-xs">share</span>
                        Facebook
                    </a>
                    <a 
                        v-if="aboutData.instagram"
                        :href="aboutData.instagram" 
                        target="_blank" 
                        class="h-9 px-4 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F56040] hover:scale-[1.02] text-white font-bold rounded-xl text-[10px] flex items-center gap-1.5 transition-all shadow-sm"
                    >
                        <span class="material-symbols-outlined text-xs">photo_camera</span>
                        Instagram
                    </a>
                </div>
            </div>
        </div>

        <!-- Software Features Grid -->
        <div class="space-y-4">
            <h3 class="text-sm font-black text-[#1e293b] flex items-center gap-2 ml-2">
                <span class="material-symbols-outlined text-primary text-lg font-black">verified</span>
                Về Hệ Thống Báo Cáo & In Phiếu Cân Xe
            </h3>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Feature 1 -->
                <div class="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-150 space-y-3">
                    <div class="size-10 bg-primary/5 text-primary rounded-xl flex items-center justify-center border border-primary/10 shadow-inner">
                        <span class="material-symbols-outlined text-lg font-black">security</span>
                    </div>
                    <h4 class="font-bold text-xs text-[#1e293b]">Bảo Mật Tuyệt Đối</h4>
                    <p class="text-[10px] text-gray-400 font-bold leading-relaxed">
                        Toàn bộ dữ liệu xử lý trực tiếp tại trình duyệt client-side. Tập tin Excel và tài liệu cân hàng của cảng không bao giờ được gửi lên máy chủ của bên thứ ba, bảo vệ thông tin nội bộ hoàn toàn.
                    </p>
                </div>

                <!-- Feature 2 -->
                <div class="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-150 space-y-3">
                    <div class="size-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center border border-teal-100 shadow-inner">
                        <span class="material-symbols-outlined text-lg font-black">offline_bolt</span>
                    </div>
                    <h4 class="font-bold text-xs text-[#1e293b]">Đồng Bộ Thông Minh</h4>
                    <p class="text-[10px] text-gray-400 font-bold leading-relaxed">
                        Chuyển đổi dữ liệu phân bổ xe sang biểu mẫu phiếu cân A5 chỉ với một chạm. Hệ thống tự động kiểm tra trạng thái khóa của sà lan để ngăn chặn việc ghi đè sai lệch dữ liệu.
                    </p>
                </div>

                <!-- Feature 3 -->
                <div class="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-150 space-y-3">
                    <div class="size-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100 shadow-inner">
                        <span class="material-symbols-outlined text-lg font-black">update</span>
                    </div>
                    <h4 class="font-bold text-xs text-[#1e293b]">Tối Ưu Vận Hành</h4>
                    <p class="text-[10px] text-gray-400 font-bold leading-relaxed">
                        Thuật toán tự động tăng số phiếu cân theo chu kỳ tháng và reset tự động vào ngày đầu tháng theo định dạng tiêu chuẩn `xxxxxx/mmyy`, hạn chế tối đa sai sót thủ công.
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

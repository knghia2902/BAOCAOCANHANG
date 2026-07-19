<script setup lang="ts">
import { ref, computed } from 'vue';

interface Step {
    title: string;
    icon: string;
    description: string;
    noteType?: 'success' | 'warning' | 'info';
    noteText?: string;
    image?: string;
}

interface TaskGuide {
    taskName: string;
    icon: string;
    description: string;
    steps: Step[];
}

interface ToolDoc {
    id: string;
    title: string;
    icon: string;
    description: string;
    tasks: TaskGuide[];
}

const searchQuery = ref('');
const activeToolId = ref('vehicles'); // Mặc định mở Quản lý hồ sơ phương tiện

const docsData = ref<ToolDoc[]>([
    {
        id: 'vehicles',
        title: 'Quản lý hồ sơ phương tiện',
        icon: 'directions_boat',
        description: 'Hướng dẫn quản lý danh sách sa lan, cập nhật chứng chỉ đăng kiểm, bảo hiểm và giám sát hồ sơ thuyền viên để đủ điều kiện bốc xếp.',
        tasks: [
            {
                taskName: 'Thêm mới & Quản lý Sa lan',
                icon: 'add_circle',
                description: 'Khai báo các phương tiện sa lan mới và quản lý thông tin kỹ thuật cơ bản.',
                steps: [
                    {
                        title: 'Chọn Khu vực hoạt động',
                        icon: 'location_on',
                        description: 'Tại màn hình chính của "Quản lý hồ sơ phương tiện", chọn tab khu vực tương ứng: "Cảng Nguyên Ngọc" hoặc "Khu vực Phú Mỹ" để xem danh sách sa lan của khu vực đó.'
                    },
                    {
                        title: 'Thêm mới Sa lan',
                        icon: 'edit_square',
                        description: 'Nhấn nút "+ Thêm sa lan" ở góc trên bên phải. Nhập tên sa lan (ví dụ: SG-7889), chọn loại hàng hóa mặc định, chủ sở hữu, đơn vị vận hành và số thứ tự sắp xếp.',
                        noteType: 'info',
                        noteText: 'Số thứ tự giúp sa lan hiển thị ưu tiên theo thứ tự mong muốn trong danh sách in phiếu và phân bổ.'
                    },
                    {
                        title: 'Lưu thông tin kỹ thuật',
                        icon: 'save',
                        description: 'Nhập trọng tải (Tấn) và công suất máy (HP) của sa lan để phục vụ việc tính định mức và kiểm tra điều kiện bố trí thuyền viên tự động.'
                    }
                ]
            },
            {
                taskName: 'Cập nhật & Đính kèm chứng chỉ (GCN, Đăng kiểm, Bảo hiểm)',
                icon: 'file_present',
                description: 'Cập nhật số hiệu, hạn hiệu lực và ảnh chụp của 3 loại giấy tờ bắt buộc.',
                steps: [
                    {
                        title: 'Mở bảng cập nhật hồ sơ',
                        icon: 'border_color',
                        description: 'Tìm sa lan cần cập nhật trong danh sách, nhấn vào nút "Cập nhật hồ sơ" (biểu tượng bút chì) ở dòng tương ứng để mở khung chỉnh sửa chi tiết.'
                    },
                    {
                        title: 'Nhập thông tin chứng chỉ',
                        icon: 'badge',
                        description: 'Nhập đầy đủ số hiệu giấy tờ, ngày cấp và ngày hết hạn cho cả 3 mục: Giấy chứng nhận (GCN) đăng ký, Đăng kiểm và Bảo hiểm.',
                        noteType: 'warning',
                        noteText: 'Nếu giấy tờ có giá trị vô hạn, tích chọn vào ô "Vô hạn" bên cạnh để hệ thống không tính ngày hết hạn.'
                    },
                    {
                        title: 'Tải lên hình ảnh đính kèm (Bắt buộc)',
                        icon: 'upload_file',
                        description: 'Nhấn nút "Tải ảnh" ở mỗi đầu mục giấy tờ để tải lên ảnh chụp chứng chỉ từ thiết bị của bạn.',
                        noteType: 'success',
                        noteText: 'Hệ thống lưu trữ ảnh an toàn trên đám mây. Bạn có thể nhấn nút "Xem" để xem lại hoặc "Xóa" để cập nhật ảnh mới.'
                    }
                ]
            },
            {
                taskName: 'Giám sát Trạng thái hồ sơ & Thuyền viên',
                icon: 'verified_user',
                description: 'Kiểm tra trạng thái đủ điều kiện hoạt động của phương tiện dựa trên màu sắc trực quan.',
                steps: [
                    {
                        title: 'Xem màu sắc Trạng thái ô điều kiện',
                        icon: 'palette',
                        description: 'Trong khung cập nhật hồ sơ, mỗi ô điều kiện (GCN, Đăng kiểm, Bảo hiểm, Thuyền viên) sẽ tự động đổi màu: Màu Xanh lá (Đầy đủ giấy tờ còn hạn và có ảnh đính kèm), Màu Đỏ (Bị thiếu ảnh, thiếu số hiệu hoặc đã hết hạn hiệu lực).',
                        noteType: 'info',
                        noteText: 'Người dùng có thể dễ dàng nhận biết hồ sơ đang thiếu ở phần nào để bổ sung kịp thời.',
                        image: '/doc_color_status.png'
                    },
                    {
                        title: 'Kiểm tra định mức định biên Thuyền viên',
                        icon: 'groups',
                        description: 'Hệ thống tự động tính toán số lượng thuyền viên tối thiểu dựa trên Trọng tải và Công suất máy (HP) của sa lan theo quy định hàng hải (cần tối thiểu bao nhiêu thuyền trưởng hạng mấy, máy trưởng hạng mấy, thủy thủ và bắt buộc phải có sổ thuyền viên).',
                        noteType: 'warning',
                        noteText: 'Thiếu định biên thuyền viên hoặc thiếu ảnh đính kèm sẽ làm trạng thái Thuyền viên báo Đỏ (THIẾU) và ngăn sa lan hoạt động.'
                    },
                    {
                        title: 'Trạng thái tổng quát của Sa lan',
                        icon: 'task_alt',
                        description: 'Tại bảng danh sách chính, cột Trạng thái hồ sơ sẽ hiển thị chữ "ĐỦ" (màu xanh lá) chỉ khi cả 4 điều kiện trên đều đạt màu xanh. Khi đó hệ thống sẽ hiển thị nhãn "Cho phép" hoạt động bốc xếp hàng hóa.'
                    }
                ]
            }
        ]
    },
    {
        id: 'weighbridge',
        title: 'Phần mềm in phiếu cân xe',
        icon: 'print',
        description: 'Hướng dẫn nhập dữ liệu cân xe, thiết kế mẫu phiếu cân A5 tùy biến và quy trình in ấn chuẩn xác không bị co lệch.',
        tasks: [
            {
                taskName: 'Thiết kế & Cấu hình Mẫu phiếu',
                icon: 'design_services',
                description: 'Kéo thả, căn chỉnh các thành phần phiếu in trên canvas trực quan.',
                steps: [
                    {
                        title: 'Mở Trình thiết kế phiếu',
                        icon: 'settings',
                        description: 'Chuyển sang tab "Cấu hình mẫu phiếu" trong công cụ Weighbridge Printer để mở trình thiết kế canvas khổ A5.'
                    },
                    {
                        title: 'Kéo thả và chỉnh sửa phần tử',
                        icon: 'open_with',
                        description: 'Nhấp chọn các phần tử trên canvas hoặc nhấn các nút thêm chữ tĩnh, thêm trường dữ liệu động. Kéo thả để thay đổi vị trí trực tiếp hoặc nhập thông số tọa độ X, Y (đơn vị mm), độ rộng W, H (mm) và cỡ chữ (pt) ở cột cài đặt bên trái.'
                    },
                    {
                        title: 'Khóa / Mở khóa thiết kế',
                        icon: 'lock',
                        description: 'Nhấn nút "Khóa mẫu phiếu" sau khi thiết kế xong để tránh vô tình kéo lệch vị trí trong quá trình nhập liệu hàng ngày.'
                    }
                ]
            },
            {
                taskName: 'Quy trình In phiếu A5 chuẩn xác',
                icon: 'print',
                description: 'Thiết lập thông số in ấn trên trình duyệt để phiếu in ra đúng kích thước 100% không bị co nhỏ.',
                steps: [
                    {
                        title: 'Nhập Excel hoặc thêm dữ liệu xe',
                        icon: 'border_all',
                        description: 'Tải tệp Excel báo cáo cân xe hàng ngày lên hoặc nhấn "+ Thêm xe" để nhập thông số biển số, trọng lượng cân lần 1, lần 2.'
                    },
                    {
                        title: 'Nhấn In phiếu',
                        icon: 'print',
                        description: 'Nhấn nút in (biểu tượng máy in) tại dòng xe tương ứng hoặc chọn "In hàng loạt (A5)" ở đầu bảng. Hệ thống sẽ gọi lệnh in thông qua một iframe ẩn để giữ trang sạch.'
                    },
                    {
                        title: 'Thiết lập hộp thoại In của trình duyệt',
                        icon: 'tune',
                        description: 'Trong hộp thoại in hiện ra, bạn CẦN chọn các cài đặt sau: Khổ giấy: A5 (148 x 210 mm) dạng Landscape (Nằm ngang); Lề (Margins): None (Không có); Tỷ lệ (Scale): 100% hoặc Mặc định (Default).',
                        noteType: 'success',
                        noteText: 'Các cài đặt này giúp bản in khớp khít 100% theo đúng tọa độ milimet đã thiết kế trên canvas mẫu phiếu.'
                    }
                ]
            }
        ]
    },
    {
        id: 'allocator',
        title: 'Phần mềm phân bổ hàng hóa',
        icon: 'query_stats',
        description: 'Hướng dẫn điều phối hàng hóa cho các phương tiện vận chuyển và đồng bộ dữ liệu khối lượng.',
        tasks: [
            {
                taskName: 'Cấu hình và Điều phối phân bổ',
                icon: 'account_tree',
                description: 'Chia tải trọng hàng hóa cho các sa lan đang tiếp nhận.',
                steps: [
                    {
                        title: 'Khởi tạo đợt phân bổ',
                        icon: 'playlist_add',
                        description: 'Chọn tàu hoạt động và chọn các sa lan đang làm hàng để đưa vào bảng phân bổ tải trọng.'
                    },
                    {
                        title: 'Thiết lập quy tắc & Định mức',
                        icon: 'rule',
                        description: 'Nhập quy tắc chia hàng (tỷ lệ phần trăm hoặc trọng lượng cụ thể tối đa cho từng phương tiện) để hệ thống tự động tính toán phân chia lượng hàng hóa đổ xuống.'
                    },
                    {
                        title: 'Đồng bộ dữ liệu phân bổ',
                        icon: 'cloud_sync',
                        description: 'Nhấn nút "Đồng bộ đám mây" để cập nhật dữ liệu phân bổ lên hệ thống quản lý chung của cảng.'
                    }
                ]
            }
        ]
    },
    {
        id: 'excel-tools',
        title: 'Gộp & Chuyển đổi file Excel',
        icon: 'table_view',
        description: 'Hướng dẫn gộp nhiều file Excel cùng cấu trúc và chuyển đổi định dạng tệp báo cáo cân nhanh chóng.',
        tasks: [
            {
                taskName: 'Gộp nhiều tệp Excel báo cáo',
                icon: 'merge_type',
                description: 'Hợp nhất dữ liệu từ nhiều ca làm việc hoặc nhiều trạm cân.',
                steps: [
                    {
                        title: 'Tải các tệp Excel lên',
                        icon: 'cloud_upload',
                        description: 'Kéo thả hoặc nhấp chọn tải lên danh sách các tệp Excel cần gộp (phần mềm hỗ trợ xử lý trực tiếp trên trình duyệt nên rất an toàn và bảo mật dữ liệu).'
                    },
                    {
                        title: 'Cấu hình ánh xạ cột',
                        icon: 'alt_route',
                        description: 'Nếu các file có tiêu đề cột hơi khác nhau, chọn cột mốc để hệ thống tự động căn hàng dữ liệu tương ứng.'
                    },
                    {
                        title: 'Tải file kết quả',
                        icon: 'download',
                        description: 'Nhấn nút "Gộp & Tải xuống" để lưu tệp Excel duy nhất đã được hợp nhất tất cả dữ liệu từ các tệp nguồn.'
                    }
                ]
            }
        ]
    },
    {
        id: 'ocr',
        title: 'Công cụ nhận dạng chữ OCR',
        icon: 'text_fields',
        description: 'Hướng dẫn quét hình ảnh hoặc file PDF hóa đơn, phiếu cân để trích xuất văn bản tự động.',
        tasks: [
            {
                taskName: 'Quét và Trích xuất văn bản',
                icon: 'document_scanner',
                description: 'Chuyển đổi hình ảnh hóa đơn, phiếu cân giấy thành dữ liệu text kỹ thuật số.',
                steps: [
                    {
                        title: 'Chọn file hình ảnh hoặc PDF',
                        icon: 'image',
                        description: 'Tải lên hình chụp phiếu cân hoặc trang tài liệu PDF cần quét chữ.'
                    },
                    {
                        title: 'Chọn ngôn ngữ nhận dạng',
                        icon: 'translate',
                        description: 'Chọn ngôn ngữ tương ứng (Tiếng Việt hoặc Tiếng Anh) để công cụ tối ưu hóa độ chính xác nhận dạng chữ.'
                    },
                    {
                        title: 'Trích xuất và Sao chép',
                        icon: 'content_copy',
                        description: 'Đợi hệ thống xử lý OCR chạy xong trong vài giây, sau đó quét chọn văn bản kết quả ở khung bên dưới để Sao chép hoặc tải về file `.txt`.'
                    }
                ]
            }
        ]
    }
]);

// Lọc tài liệu theo từ khóa tìm kiếm
const filteredDocs = computed(() => {
    const q = searchQuery.value.toLowerCase().trim();
    if (!q) return docsData.value;
    
    return docsData.value.map(tool => {
        // Lọc các task thỏa mãn từ khóa
        const filteredTasks = tool.tasks.map(task => {
            const taskMatches = task.taskName.toLowerCase().includes(q) || task.description.toLowerCase().includes(q);
            const filteredSteps = task.steps.filter(step => 
                step.title.toLowerCase().includes(q) || 
                step.description.toLowerCase().includes(q) ||
                (step.noteText && step.noteText.toLowerCase().includes(q))
            );
            
            if (taskMatches || filteredSteps.length > 0) {
                return {
                    ...task,
                    steps: taskMatches ? task.steps : filteredSteps // Nếu task match thì giữ nguyên các bước, nếu chỉ bước match thì lọc bước
                };
            }
            return null;
        }).filter((t): t is TaskGuide => t !== null);
        
        if (tool.title.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q) || filteredTasks.length > 0) {
            return {
                ...tool,
                tasks: filteredTasks
            };
        }
        return null;
    }).filter((doc): doc is ToolDoc => doc !== null);
});

// Lấy thông tin tài liệu hiện đang active
const activeDoc = computed(() => {
    return docsData.value.find(doc => doc.id === activeToolId.value);
});

const selectTool = (id: string) => {
    activeToolId.value = id;
};
</script>

<template>
    <div class="flex-1 flex flex-col min-h-0 bg-[#f8fafc] py-6 px-4 sm:px-6 lg:px-8">
        <!-- Banner Header -->
        <div class="mx-auto w-full max-w-[1200px] mb-6 bg-gradient-to-r from-primary to-teal-600 rounded-[24px] p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
            <div class="absolute right-0 bottom-0 opacity-10 translate-x-10 translate-y-10">
                <span class="material-symbols-outlined text-[200px]">menu_book</span>
            </div>
            <div class="relative z-10 max-w-2xl">
                <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
                    <span class="material-symbols-outlined text-sm">support_agent</span>
                    Trung tâm hỗ trợ sử dụng
                </div>
                <h1 class="text-xl sm:text-3xl font-black mb-2 tracking-tight">Document Hướng Dẫn Sử Dụng</h1>
                <p class="text-xs sm:text-sm text-white/80 font-bold">
                    Các tài liệu hướng dẫn chi tiết từng bước, giúp người vận hành cảng dễ dàng làm quen và thao tác chính xác trên các công cụ của hệ thống.
                </p>
            </div>
        </div>

        <!-- Main Content Area with Sidebar -->
        <div class="mx-auto w-full max-w-[1200px] flex-1 flex flex-col md:flex-row gap-6 min-h-0">
            <!-- Left Sidebar -->
            <div class="w-full md:w-80 flex flex-col gap-4 shrink-0">
                <!-- Search bar -->
                <div class="bg-white p-3 rounded-2xl border border-primary/5 soft-shadow flex items-center gap-2">
                    <span class="material-symbols-outlined text-gray-400 text-lg">search</span>
                    <input 
                        v-model="searchQuery" 
                        type="text" 
                        placeholder="Tìm hướng dẫn..." 
                        class="w-full text-xs focus:outline-none font-bold text-[#1e293b] placeholder-gray-400 bg-transparent"
                    />
                    <button 
                        v-if="searchQuery" 
                        @click="searchQuery = ''" 
                        class="text-gray-400 hover:text-gray-600"
                    >
                        <span class="material-symbols-outlined text-xs">close</span>
                    </button>
                </div>

                <!-- Navigation List -->
                <div class="bg-white rounded-2xl border border-primary/5 soft-shadow p-2 flex flex-col gap-1">
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-1.5 select-none">
                        Danh mục hướng dẫn
                    </span>
                    <button 
                        v-for="tool in filteredDocs" 
                        :key="tool.id"
                        @click="selectTool(tool.id)"
                        :class="[
                            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all duration-200',
                            activeToolId === tool.id 
                                ? 'bg-primary text-white shadow-soft scale-[1.02]' 
                                : 'text-[#1e293b]/70 hover:bg-slate-50 hover:text-primary'
                        ]"
                    >
                        <span class="material-symbols-outlined text-lg shrink-0">{{ tool.icon }}</span>
                        <span class="truncate flex-1">{{ tool.title }}</span>
                        <span v-if="activeToolId === tool.id" class="material-symbols-outlined text-xs">chevron_right</span>
                    </button>
                    <div v-if="filteredDocs.length === 0" class="p-4 text-center text-xs text-gray-400 font-bold italic">
                        Không tìm thấy hướng dẫn nào khớp từ khóa
                    </div>
                </div>
            </div>

            <!-- Right Detail Panel -->
            <div class="flex-1 min-w-0 bg-white rounded-3xl border border-primary/5 soft-shadow p-6 flex flex-col overflow-y-auto">
                <div v-if="activeDoc" class="space-y-6">
                    <!-- Tool Title and Header -->
                    <div class="border-b border-gray-100 pb-5">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="size-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                                <span class="material-symbols-outlined text-xl">{{ activeDoc.icon }}</span>
                            </div>
                            <h2 class="text-lg sm:text-xl font-black text-[#1e293b] tracking-tight">{{ activeDoc.title }}</h2>
                        </div>
                        <p class="text-xs text-gray-500 font-bold leading-relaxed">{{ activeDoc.description }}</p>
                    </div>

                    <!-- Steps for each task -->
                    <div class="space-y-8">
                        <div 
                            v-for="(task, tIdx) in activeDoc.tasks" 
                            :key="tIdx" 
                            class="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 sm:p-5 space-y-4"
                        >
                            <div class="flex items-center gap-2 border-b border-dashed border-slate-200 pb-3">
                                <span class="material-symbols-outlined text-lg text-primary">{{ task.icon }}</span>
                                <h3 class="text-xs sm:text-sm font-black text-[#1e293b] uppercase tracking-wider">{{ task.taskName }}</h3>
                            </div>
                            
                            <p class="text-xs text-gray-400 font-bold italic mb-2">{{ task.description }}</p>

                            <!-- Vertical Steps List -->
                            <div class="relative pl-6 border-l-2 border-primary/20 space-y-6 ml-3">
                                <div 
                                    v-for="(step, sIdx) in task.steps" 
                                    :key="sIdx"
                                    class="relative group"
                                >
                                    <!-- Step Circle Number Badge -->
                                    <div class="absolute -left-[35px] top-0 size-6 bg-white border-2 border-primary rounded-full flex items-center justify-center text-xs font-black text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                        {{ sIdx + 1 }}
                                    </div>
                                    
                                    <!-- Step Header -->
                                    <div class="flex items-center gap-1.5 mb-1">
                                        <span class="material-symbols-outlined text-sm text-gray-500">{{ step.icon }}</span>
                                        <h4 class="text-xs sm:text-sm font-bold text-[#1e293b]">{{ step.title }}</h4>
                                    </div>

                                    <!-- Step Description -->
                                    <p class="text-xs text-gray-500 font-bold leading-relaxed pl-5 sm:pl-6">{{ step.description }}</p>

                                    <!-- Step Alert Note Box -->
                                    <div 
                                        v-if="step.noteText" 
                                        :class="[
                                            'mt-2.5 ml-5 sm:ml-6 p-3 rounded-xl border text-xs font-bold flex gap-2 items-start',
                                            step.noteType === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                            step.noteType === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                            'bg-blue-50 border-blue-100 text-blue-700'
                                        ]"
                                    >
                                        <span class="material-symbols-outlined text-sm shrink-0 mt-0.5">
                                            {{ step.noteType === 'success' ? 'check_circle' : step.noteType === 'warning' ? 'warning' : 'info' }}
                                        </span>
                                        <span class="leading-relaxed">{{ step.noteText }}</span>
                                    </div>

                                    <!-- Step Image -->
                                    <div v-if="step.image" class="mt-4 mx-auto max-w-full md:max-w-xl rounded-md overflow-hidden border border-gray-200 shadow-sm bg-white p-1">
                                        <img :src="step.image" alt="Minh họa bước" class="w-full h-auto object-cover rounded" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-else class="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <span class="material-symbols-outlined text-[64px] text-gray-300 mb-2">menu_book</span>
                    <p class="text-sm font-bold text-gray-400 italic">Chọn một tài liệu hướng dẫn ở danh mục bên trái để bắt đầu xem.</p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.shadow-soft {
    box-shadow: 0 4px 20px -2px rgba(136, 171, 218, 0.15);
}
.soft-shadow {
    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.04);
}
</style>

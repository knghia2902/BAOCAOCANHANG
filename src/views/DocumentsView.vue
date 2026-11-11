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
    badge?: string;
    description: string;
    tasks: TaskGuide[];
}

const searchQuery = ref('');
const activeToolId = ref('workflow-main'); // Mặc định mở Quy trình tổng thể 4 bước

const docsData = ref<ToolDoc[]>([
    {
        id: 'workflow-main',
        title: 'Quy trình Tổng quan 4 Bước',
        icon: 'account_tree',
        badge: 'Quy chuẩn',
        description: 'Luồng nghiệp vụ khép kín từ lúc khởi tạo lệnh làm hàng, nạp dữ liệu xe cân, kiểm tra đối soát số liệu đến chốt báo cáo và gửi Zalo điều hành.',
        tasks: [
            {
                taskName: 'Quy trình vận hành chuẩn 4 giai đoạn',
                icon: 'sync_alt',
                description: 'Toàn bộ chu trình thao tác hàng ngày dành cho nhân viên điều hành và theo dõi số liệu.',
                steps: [
                    {
                        title: 'Bước 1: Khởi tạo Lệnh (Tạo Nguồn Tàu & Sà lan)',
                        icon: 'directions_boat',
                        description: 'Trước khi xe bắt đầu cân, nhân viên truy cập Không gian làm việc hợp nhất (Workspace) > chọn "Tạo Nguồn Tàu". Khai báo thông tin Tàu mẹ, Loại hàng hóa, Khách hàng/Đối tác và gán danh sách các Sà lan tiếp nhận kèm Mã lệnh (Order No).',
                        noteType: 'info',
                        noteText: 'Khai báo chuẩn xác Mã lệnh và tên sà lan ngay từ đầu giúp hệ thống tự động nhận diện và phân luồng dữ liệu xe cân chính xác 100%.'
                    },
                    {
                        title: 'Bước 2: Nạp dữ liệu cân xe (Weighbridge Data)',
                        icon: 'balance',
                        description: 'Chuyển sang mục "Dữ liệu cân" trong Workspace, chọn đúng nguồn tàu đang làm hàng và nạp tệp Excel lượt cân xuất từ trạm cân: File 1 (Nhập kho & Nhập thẳng) và File 2 (Xuất kho & Xuất thẳng sà lan).',
                        noteType: 'info',
                        noteText: 'Hệ thống tự động lọc trùng chuyến cân và chuẩn hóa biển số. Kiểm tra kỹ số lượng dòng nạp thành công báo trên màn hình.'
                    },
                    {
                        title: 'Bước 3: Kiểm tra & Đối soát số liệu tại Báo cáo Tồn kho và Cân hàng',
                        icon: 'fact_check',
                        description: 'Chuyển ngay sang tab "Báo cáo tồn kho" và "Báo cáo cân hàng (Lô hàng)" để rà soát. Soát xét độ lệch khối lượng: KL Tịnh (Net) = KL Tổng (Gross) - KL Bì (Tare), kiểm tra phân luồng kho và tính hợp lý của từng lượt xe.',
                        noteType: 'warning',
                        noteText: 'QUY TẮC AN TOÀN: Khi phát hiện sai lệch khối lượng hoặc lỗi dữ liệu, nhân viên BẮT BUỘC báo ngay cho Admin để kiểm tra và chỉnh sửa, tuyệt đối không tự ý can thiệp.'
                    },
                    {
                        title: 'Bước 4: Kết thúc quy trình & Gửi báo cáo',
                        icon: 'task_alt',
                        description: 'Sau khi số liệu đã chuẩn xác 100%, nhấn "Xuất Excel" để lưu trữ tệp báo cáo chính thức; đồng thời bấm tạo ảnh Báo cáo tồn kho trên web và gửi trực tiếp vào nhóm Zalo điều hành của Cảng theo ca.',
                        noteType: 'success',
                        noteText: 'Hoàn tất quy trình ca làm việc. File báo cáo Excel và ảnh Zalo là căn cứ đối soát và điều hành giao nhận chính thức của Cảng.'
                    }
                ]
            }
        ]
    },
    {
        id: 'vessel-source',
        title: '1. Khởi tạo Lệnh (Tạo Nguồn Tàu)',
        icon: 'directions_boat',
        badge: 'Bước 1',
        description: 'Hướng dẫn chi tiết khai báo Tàu mẹ, Chủ hàng, Loại hàng hóa và cấu hình danh sách Sà lan tiếp nhận kèm Mã lệnh làm hàng.',
        tasks: [
            {
                taskName: 'Khai báo Nguồn Tàu & Sà lan tiếp nhận',
                icon: 'add_circle',
                description: 'Thao tác tạo mới hoặc cập nhật thông tin tàu làm hàng trong hệ thống Workspace.',
                steps: [
                    {
                        title: 'Vào Không gian làm việc hợp nhất (Workspace)',
                        icon: 'domain',
                        description: 'Từ thanh điều hướng chính của web, chọn "Workspace" (Không gian điều hành hợp nhất) và nhấp chọn mục "Tạo Nguồn Tàu 🚢" trên cây menu bên trái.'
                    },
                    {
                        title: 'Khai báo thông tin Tàu mẹ & Chủ hàng',
                        icon: 'edit_document',
                        description: 'Nhấn nút "+ Thêm nguồn tàu mới". Nhập Tên tàu mẹ (ví dụ: MV GLORY, TÀU ĐÔNG PHÚ...), chọn Khách hàng / Chủ hàng (De Heus, CJ, Japfa...) và chọn Loại hàng hóa (Ngô hạt, Bã nành, Lúa mì...).',
                        noteType: 'info',
                        noteText: 'Nếu khách hàng hoặc loại hàng chưa có sẵn trong danh mục, có thể chuyển sang nhập thủ công hoặc liên hệ Admin bổ sung vào Danh mục chung.'
                    },
                    {
                        title: 'Thiết lập danh sách Sà lan tiếp nhận & Mã lệnh (Order)',
                        icon: 'sailing',
                        description: 'Tại bảng danh sách sà lan của tàu mẹ vừa tạo, nhấn "+ Thêm sà lan". Điền chính xác Tên sà lan (ví dụ: SG-8899, VL-1234...) và nhập Mã lệnh (Order No) tương ứng với từng sà lan.',
                        noteType: 'warning',
                        noteText: 'Mỗi sà lan gắn liền với một mã lệnh làm việc. Khai báo đúng mã lệnh giúp phân luồng cân tự động nhận diện chính xác xe nào đổ xuống sà lan nào.'
                    },
                    {
                        title: 'Lưu và Đồng bộ đám mây',
                        icon: 'cloud_sync',
                        description: 'Nhấn "Lưu nguồn tàu". Dữ liệu sẽ được tự động đồng bộ lên máy chủ đám mây Supabase để tất cả các máy trạm của nhân viên cùng ca có thể truy cập tức thì.',
                        noteType: 'success',
                        noteText: 'Nguồn tàu vừa tạo sẽ xuất hiện ngay ở đầu danh sách để dễ dàng lựa chọn ở bước nạp dữ liệu cân tiếp theo.'
                    }
                ]
            }
        ]
    },
    {
        id: 'scale-data',
        title: '2. Nạp dữ liệu cân xe',
        icon: 'balance',
        badge: 'Bước 2',
        description: 'Hướng dẫn chọn nguồn tàu và nạp các tệp Excel xuất từ phần mềm trạm cân (File 1 Nhập kho/nhập thẳng và File 2 Xuất kho/xuất thẳng sà lan).',
        tasks: [
            {
                taskName: 'Quy trình nạp dữ liệu cân theo ca',
                icon: 'upload_file',
                description: 'Nạp danh sách lượt xe cân tự động từ tệp Excel vào cơ sở dữ liệu hệ thống.',
                steps: [
                    {
                        title: 'Chọn Tàu mẹ & Đợt làm hàng',
                        icon: 'filter_list',
                        description: 'Tại mục "Dữ liệu cân ⚖️" trên cây thư mục Workspace, mở hộp chọn nguồn tàu và nhấp chọn đúng Tàu mẹ đang làm việc đã được tạo ở Bước 1.'
                    },
                    {
                        title: 'Chuẩn bị tệp Excel xuất từ phần mềm trạm cân',
                        icon: 'file_open',
                        description: 'Xuất tệp báo cáo chi tiết lượt cân từ trạm cân ra định dạng Excel (.xlsx hoặc .xls). Đảm bảo tệp chứa đầy đủ các cột: Số phiếu, Biển số xe, Khối lượng tổng (Gross), Khối lượng bì (Tare), Khối lượng hàng (Net), Ngày giờ cân.'
                    },
                    {
                        title: 'Nạp File 1 (Nhập kho & Nhập thẳng)',
                        icon: 'input',
                        description: 'Nhấn vào khu vực "File 1: Nhập kho & Nhập thẳng", chọn tệp Excel tương ứng. Hệ thống sẽ quét từng dòng, tự động nhận diện mã kho (Kho 1, Kho 2, Kho 3, Kho 4) hoặc các chuyến xá thẳng.',
                        noteType: 'info',
                        noteText: 'Hệ thống có cơ chế tự động loại trừ các chuyến cân trùng lặp và chuẩn hóa biển số xe đầu kéo / rơ-moóc.'
                    },
                    {
                        title: 'Nạp File 2 (Xuất kho & Xuất thẳng sà lan)',
                        icon: 'output',
                        description: 'Nhấn nạp "File 2: Xuất kho & Xuất thẳng sà lan". Hệ thống sẽ tự động so khớp tên sà lan và mã lệnh trên phiếu cân với danh sách sà lan của tàu mẹ đã cấu hình.',
                        noteType: 'success',
                        noteText: 'Sau khi nạp xong, bảng dữ liệu cân sẽ hiển thị tổng số xe và tổng khối lượng đã nạp. Kiểm tra nhanh số lượng lượt xe trước khi chuyển qua bước đối soát.'
                    }
                ]
            }
        ]
    },
    {
        id: 'verification',
        title: '3. Kiểm tra & Đối soát số liệu',
        icon: 'fact_check',
        badge: 'Bước 3',
        description: 'Quy chuẩn đối soát số liệu tại Báo cáo tồn kho và Báo cáo cân hàng. Hướng dẫn kiểm tra độ lệch khối lượng và nguyên tắc báo Admin xử lý khi có lỗi.',
        tasks: [
            {
                taskName: 'Kiểm tra số liệu tại Báo cáo Tồn kho',
                icon: 'warehouse',
                description: 'Rà soát cân đối hàng ngày và lũy kế tại 4 kho hàng của Cảng.',
                steps: [
                    {
                        title: 'Mở phân hệ Báo cáo tồn kho',
                        icon: 'monitoring',
                        description: 'Từ màn hình Dữ liệu cân hoặc Sidebar Workspace, nhấp nút "Báo cáo tồn kho 🏭". Chọn ngày báo cáo và ca làm việc cần kiểm tra.'
                    },
                    {
                        title: 'Kiểm tra cân đối Nhập - Xuất - Tồn 4 Kho',
                        icon: 'calculate',
                        description: 'Rà soát số liệu từng kho (Kho 1, 2, 3, 4). Công thức chuẩn: Tồn cuối = Tồn đầu + Nhập trong ca - Xuất trong ca. Kiểm tra các dòng xe xá thẳng xem số liệu đã tách bạch rõ ràng hay chưa.'
                    },
                    {
                        title: 'Đối soát chênh lệch khối lượng Phiếu nhà máy vs Thực cân',
                        icon: 'difference',
                        description: 'Đối với hàng nhập kho có phiếu nhà máy, kiểm tra cột "KL Nhà máy" và cột "KL Thực cân". Đảm bảo độ chênh lệch nằm trong ngưỡng dung sai hao hụt cho phép của cảng.',
                        noteType: 'warning',
                        noteText: 'Nếu phát hiện lệch số liệu bất thường hoặc xe bị âm khối lượng, phải ghi nhận lại ngay số phiếu và biển số xe.'
                    }
                ]
            },
            {
                taskName: 'Kiểm tra số liệu tại Báo cáo Cân hàng (Lô hàng)',
                icon: 'receipt_long',
                description: 'Đối soát độ lệch khối lượng của từng lượt xe và tổng sản lượng từng sà lan.',
                steps: [
                    {
                        title: 'Mở Báo cáo lô hàng / Báo cáo cân',
                        icon: 'list_alt',
                        description: 'Chuyển sang mục "Báo cáo lô hàng 🚢" (hoặc "In phiếu cân xe"). Kiểm tra bảng kê tổng hợp chi tiết theo từng sà lan và từng xe vận tải.'
                    },
                    {
                        title: 'Kiểm tra độ lệch khối lượng Net / Tổng (Gross - Tare = Net)',
                        icon: 'scale',
                        description: 'Soát xét từng lượt cân: Khối lượng Tổng (Gross) trừ Khối lượng Bì/Xe rỗng (Tare) phải bằng chính xác Khối lượng Tịnh (Net). Tuyệt đối không để sót các xe chưa cân lần 2 (thiếu Tare) dẫn đến KL Net bằng 0 hoặc sai số lớn.'
                    },
                    {
                        title: 'Quy tắc an toàn: Báo ngay cho Admin khi phát hiện lỗi',
                        icon: 'admin_panel_settings',
                        description: 'Khi phát hiện bất kỳ sai sót nào (lệch khối lượng, sai sà lan tiếp nhận, nhầm kho, chuyến cân bị trùng hoặc lỗi chính tả biển số): Nhân viên KHÔNG được tự ý chỉnh sửa tùy tiện trên phần mềm.',
                        noteType: 'warning',
                        noteText: 'BẮT BUỘC: Nhân viên lập tức báo cho Quản trị viên (Admin) phụ trách ca để Admin kiểm tra dữ liệu gốc và thực hiện chỉnh sửa chính thức, đảm bảo tính toàn vẹn của hệ thống.'
                    }
                ]
            }
        ]
    },
    {
        id: 'reporting',
        title: '4. Kết thúc & Gửi báo cáo',
        icon: 'send_and_archive',
        badge: 'Bước 4',
        description: 'Quy trình hoàn tất ca làm việc: Xuất file Excel báo cáo chính thức và tạo ảnh Báo cáo Tồn kho gửi nhóm Zalo điều hành cảng.',
        tasks: [
            {
                taskName: 'Xuất Excel và Truyền thông kết quả ca làm việc',
                icon: 'share',
                description: 'Đóng ca và gửi kết quả số liệu cho ban điều hành cảng.',
                steps: [
                    {
                        title: 'Xác nhận số liệu đã đối soát 100% chuẩn xác',
                        icon: 'verified',
                        description: 'Sau khi đã kiểm tra xong Báo cáo tồn kho và Báo cáo lô hàng, xác nhận toàn bộ số liệu không còn sai lệch, không còn xe thiếu cân và đã được Admin phê duyệt (nếu có hiệu chỉnh).'
                    },
                    {
                        title: 'Xuất tệp Excel Báo cáo chính thức',
                        icon: 'table_view',
                        description: 'Tại giao diện Báo cáo tồn kho và Báo cáo lô hàng, nhấn nút "Xuất Excel" (màu xanh thương hiệu). Tệp Excel được tạo chuẩn hóa chứa đầy đủ công thức và định dạng theo mẫu của Cảng để lưu trữ nội bộ và gửi đối tác.',
                        noteType: 'info',
                        noteText: 'Tệp Excel xuất ra là tài liệu chính thức phục vụ đối soát số liệu, quyết toán ca và lưu trữ hồ sơ cảng.'
                    },
                    {
                        title: 'Tạo ảnh Báo cáo tồn kho tự động',
                        icon: 'image',
                        description: 'Tại giao diện Báo cáo tồn kho, sử dụng nút "Chụp ảnh báo cáo / Ảnh Zalo". Hệ thống sẽ tự động chụp bảng số liệu tồn kho thành file ảnh rõ nét, bố cục vừa vặn với màn hình điện thoại.'
                    },
                    {
                        title: 'Gửi ảnh lên Nhóm Zalo điều hành',
                        icon: 'chat',
                        description: 'Mở nhóm Zalo điều hành ca của Cảng, gửi ảnh báo cáo vừa tải về kèm ghi chú vắn tắt về tiến độ ca làm việc. Kết thúc quy trình làm việc của ca.',
                        noteType: 'success',
                        noteText: 'Hoàn tất quy trình nhập và kiểm tra số liệu ca làm việc an toàn, chính xác và kịp thời!'
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

    return docsData.value
        .map(tool => {
            const toolMatches =
                tool.title.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q);

            const filteredTasks = tool.tasks
                .map(task => {
                    const taskMatches =
                        task.taskName.toLowerCase().includes(q) ||
                        task.description.toLowerCase().includes(q);
                    const filteredSteps = task.steps.filter(
                        step =>
                            step.title.toLowerCase().includes(q) ||
                            step.description.toLowerCase().includes(q) ||
                            (step.noteText && step.noteText.toLowerCase().includes(q))
                    );

                    if (taskMatches || filteredSteps.length > 0) {
                        return {
                            ...task,
                            steps: taskMatches ? task.steps : filteredSteps
                        };
                    }
                    return null;
                })
                .filter((t): t is TaskGuide => t !== null);

            if (toolMatches || filteredTasks.length > 0) {
                return {
                    ...tool,
                    tasks: filteredTasks
                };
            }
            return null;
        })
        .filter((doc): doc is ToolDoc => doc !== null);
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
    <div class="flex-1 flex flex-col min-h-0 bg-[#f8fafc] py-6 px-4 sm:px-6 lg:px-8 font-sans">
        <!-- Banner Header -->
        <div
            class="mx-auto w-full max-w-[1200px] mb-6 bg-gradient-to-r from-primary to-teal-600 rounded-[28px] p-6 sm:p-8 text-white shadow-lg relative overflow-hidden"
        >
            <div class="absolute right-0 bottom-0 opacity-10 translate-x-10 translate-y-10 pointer-events-none">
                <span class="material-symbols-outlined text-[200px]">menu_book</span>
            </div>
            <div class="relative z-10 max-w-3xl">
                <div
                    class="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs font-bold uppercase tracking-wider mb-3 text-white"
                >
                    <span class="material-symbols-outlined text-sm">menu_book</span>
                    Cẩm Nang Vận Hành & Hướng Dẫn Nhân Viên
                </div>
                <h1 class="text-2xl sm:text-3xl font-display font-black mb-2 tracking-tight">
                    Quy Trình Nhập & Kiểm Tra Số Liệu
                </h1>
                <p class="text-xs sm:text-sm text-white/90 font-medium leading-relaxed mb-4">
                    Tài liệu chuẩn hóa 4 bước dành cho nhân viên điều hành và trạm cân tại Cảng: Từ khởi tạo lệnh nguồn tàu, nạp dữ liệu xe cân, kiểm tra đối soát lệch khối lượng đến xuất file báo cáo và gửi ảnh Zalo.
                </p>
                <div class="flex flex-wrap items-center gap-3">
                    <router-link
                        to="/workspace"
                        class="inline-flex items-center gap-2 px-4 py-2 bg-white text-primary text-xs font-display font-bold rounded-full shadow-md hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <span class="material-symbols-outlined text-base">rocket_launch</span>
                        Mở Không Gian Làm Việc (Workspace)
                    </router-link>
                    <div class="inline-flex items-center gap-1 text-[11px] text-white/80 font-bold px-3 py-1.5 bg-black/10 rounded-full">
                        <span class="material-symbols-outlined text-sm text-teal-300">verified</span>
                        Quy chuẩn vận hành nội bộ cảng
                    </div>
                </div>
            </div>
        </div>

        <!-- 4-Steps Quick Indicator Bar -->
        <div class="mx-auto w-full max-w-[1200px] mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
                @click="selectTool('vessel-source')"
                :class="[
                    'p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3',
                    activeToolId === 'vessel-source'
                        ? 'bg-primary text-white border-primary shadow-soft'
                        : 'bg-white border-slate-200 hover:border-primary/40 hover:bg-slate-50 text-[#1e293b]'
                ]"
            >
                <div
                    :class="[
                        'size-9 rounded-xl flex items-center justify-center shrink-0 font-display font-black text-xs',
                        activeToolId === 'vessel-source' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                    ]"
                >
                    01
                </div>
                <div class="min-w-0">
                    <div class="text-[10px] font-bold uppercase tracking-wider opacity-75">Bước 1</div>
                    <div class="text-xs font-display font-black truncate">Tạo Nguồn Tàu</div>
                </div>
            </button>

            <button
                @click="selectTool('scale-data')"
                :class="[
                    'p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3',
                    activeToolId === 'scale-data'
                        ? 'bg-primary text-white border-primary shadow-soft'
                        : 'bg-white border-slate-200 hover:border-primary/40 hover:bg-slate-50 text-[#1e293b]'
                ]"
            >
                <div
                    :class="[
                        'size-9 rounded-xl flex items-center justify-center shrink-0 font-display font-black text-xs',
                        activeToolId === 'scale-data' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                    ]"
                >
                    02
                </div>
                <div class="min-w-0">
                    <div class="text-[10px] font-bold uppercase tracking-wider opacity-75">Bước 2</div>
                    <div class="text-xs font-display font-black truncate">Nạp Dữ Liệu Cân</div>
                </div>
            </button>

            <button
                @click="selectTool('verification')"
                :class="[
                    'p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3',
                    activeToolId === 'verification'
                        ? 'bg-primary text-white border-primary shadow-soft'
                        : 'bg-white border-slate-200 hover:border-primary/40 hover:bg-slate-50 text-[#1e293b]'
                ]"
            >
                <div
                    :class="[
                        'size-9 rounded-xl flex items-center justify-center shrink-0 font-display font-black text-xs',
                        activeToolId === 'verification' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                    ]"
                >
                    03
                </div>
                <div class="min-w-0">
                    <div class="text-[10px] font-bold uppercase tracking-wider opacity-75">Bước 3</div>
                    <div class="text-xs font-display font-black truncate">Kiểm Tra Đối Soát</div>
                </div>
            </button>

            <button
                @click="selectTool('reporting')"
                :class="[
                    'p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3',
                    activeToolId === 'reporting'
                        ? 'bg-primary text-white border-primary shadow-soft'
                        : 'bg-white border-slate-200 hover:border-primary/40 hover:bg-slate-50 text-[#1e293b]'
                ]"
            >
                <div
                    :class="[
                        'size-9 rounded-xl flex items-center justify-center shrink-0 font-display font-black text-xs',
                        activeToolId === 'reporting' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                    ]"
                >
                    04
                </div>
                <div class="min-w-0">
                    <div class="text-[10px] font-bold uppercase tracking-wider opacity-75">Bước 4</div>
                    <div class="text-xs font-display font-black truncate">Xuất Excel & Zalo</div>
                </div>
            </button>
        </div>

        <!-- Main Content Area with Sidebar -->
        <div class="mx-auto w-full max-w-[1200px] flex-1 flex flex-col md:flex-row gap-6 min-h-0">
            <!-- Left Sidebar -->
            <div class="w-full md:w-80 flex flex-col gap-4 shrink-0">
                <!-- Search bar -->
                <div class="bg-white p-3 rounded-2xl border border-primary/10 soft-shadow flex items-center gap-2">
                    <span class="material-symbols-outlined text-gray-400 text-lg">search</span>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Tìm bước hoặc quy trình..."
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
                <div class="bg-white rounded-2xl border border-primary/10 soft-shadow p-2 flex flex-col gap-1">
                    <span
                        class="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-1.5 select-none"
                    >
                        Danh mục hướng dẫn
                    </span>
                    <button
                        v-for="tool in filteredDocs"
                        :key="tool.id"
                        @click="selectTool(tool.id)"
                        :class="[
                            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all duration-200',
                            activeToolId === tool.id
                                ? 'bg-primary text-white shadow-soft scale-[1.01]'
                                : 'text-[#1e293b]/80 hover:bg-slate-50 hover:text-primary'
                        ]"
                    >
                        <span class="material-symbols-outlined text-lg shrink-0">{{ tool.icon }}</span>
                        <span class="truncate flex-1 font-display font-bold">{{ tool.title }}</span>
                        <span
                            v-if="tool.badge"
                            :class="[
                                'text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase shrink-0',
                                activeToolId === tool.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                            ]"
                        >
                            {{ tool.badge }}
                        </span>
                        <span v-if="activeToolId === tool.id" class="material-symbols-outlined text-xs">
                            chevron_right
                        </span>
                    </button>
                    <div
                        v-if="filteredDocs.length === 0"
                        class="p-4 text-center text-xs text-gray-400 font-bold italic"
                    >
                        Không tìm thấy hướng dẫn nào khớp từ khóa
                    </div>
                </div>

                <!-- Support Box -->
                <div class="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-[#1e293b]">
                    <div class="flex items-center gap-2 text-teal-800 font-display font-black text-xs mb-1">
                        <span class="material-symbols-outlined text-base">support</span>
                        Hỗ Trợ Kỹ Thuật & Sửa Lỗi
                    </div>
                    <p class="text-[11px] text-teal-900/80 leading-relaxed font-medium">
                        Khi phát hiện số liệu cân bị sai lệch, không tự ý chỉnh sửa. Hãy liên hệ ngay với <strong class="font-bold">Quản trị viên (Admin)</strong> của ca để được xử lý trên hệ thống.
                    </p>
                </div>
            </div>

            <!-- Right Detail Panel -->
            <div
                class="flex-1 min-w-0 bg-white rounded-3xl border border-primary/10 soft-shadow p-6 sm:p-7 flex flex-col overflow-y-auto"
            >
                <div v-if="activeDoc" class="space-y-6">
                    <!-- Tool Title and Header -->
                    <div class="border-b border-gray-100 pb-5">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="size-11 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0">
                                <span class="material-symbols-outlined text-2xl">{{ activeDoc.icon }}</span>
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h2 class="text-lg sm:text-xl font-display font-black text-[#1e293b] tracking-tight">
                                        {{ activeDoc.title }}
                                    </h2>
                                    <span
                                        v-if="activeDoc.badge"
                                        class="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase"
                                    >
                                        {{ activeDoc.badge }}
                                    </span>
                                </div>
                                <p class="text-xs text-gray-500 font-medium leading-relaxed mt-1">
                                    {{ activeDoc.description }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Steps for each task -->
                    <div class="space-y-8">
                        <div
                            v-for="(task, tIdx) in activeDoc.tasks"
                            :key="tIdx"
                            class="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-4 sm:p-6 space-y-4"
                        >
                            <div class="flex items-center gap-2 border-b border-dashed border-slate-200 pb-3">
                                <span class="material-symbols-outlined text-lg text-primary">{{ task.icon }}</span>
                                <h3 class="text-xs sm:text-sm font-display font-black text-[#1e293b] uppercase tracking-wider">
                                    {{ task.taskName }}
                                </h3>
                            </div>

                            <p class="text-xs text-gray-500 font-medium italic mb-2">{{ task.description }}</p>

                            <!-- Vertical Steps List -->
                            <div class="relative pl-6 sm:pl-7 border-l-2 border-primary/20 space-y-6 ml-3">
                                <div
                                    v-for="(step, sIdx) in task.steps"
                                    :key="sIdx"
                                    class="relative group"
                                >
                                    <!-- Step Circle Number Badge -->
                                    <div
                                        class="absolute -left-[35px] sm:-left-[39px] top-0 size-6 bg-white border-2 border-primary rounded-full flex items-center justify-center text-xs font-display font-black text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-sm"
                                    >
                                        {{ sIdx + 1 }}
                                    </div>

                                    <!-- Step Header -->
                                    <div class="flex items-center gap-1.5 mb-1">
                                        <span class="material-symbols-outlined text-sm text-primary">{{ step.icon }}</span>
                                        <h4 class="text-xs sm:text-sm font-display font-black text-[#1e293b]">
                                            {{ step.title }}
                                        </h4>
                                    </div>

                                    <!-- Step Description -->
                                    <p class="text-xs text-gray-600 font-medium leading-relaxed pl-5 sm:pl-6">
                                        {{ step.description }}
                                    </p>

                                    <!-- Step Alert Note Box -->
                                    <div
                                        v-if="step.noteText"
                                        :class="[
                                            'mt-2.5 ml-5 sm:ml-6 p-3 rounded-xl border text-xs font-medium flex gap-2.5 items-start',
                                            step.noteType === 'success'
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                                : step.noteType === 'warning'
                                                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                                                  : 'bg-blue-50 border-blue-200 text-blue-900'
                                        ]"
                                    >
                                        <span class="material-symbols-outlined text-base shrink-0 mt-0.5">
                                            {{
                                                step.noteType === 'success'
                                                    ? 'check_circle'
                                                    : step.noteType === 'warning'
                                                      ? 'warning'
                                                      : 'info'
                                            }}
                                        </span>
                                        <span class="leading-relaxed">{{ step.noteText }}</span>
                                    </div>

                                    <!-- Step Image -->
                                    <div
                                        v-if="step.image"
                                        class="mt-4 mx-auto max-w-full md:max-w-xl rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white p-1"
                                    >
                                        <img
                                            :src="step.image"
                                            alt="Minh họa bước"
                                            class="w-full h-auto object-cover rounded-lg"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-else class="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <span class="material-symbols-outlined text-[64px] text-gray-300 mb-2">menu_book</span>
                    <p class="text-sm font-bold text-gray-400 italic">
                        Chọn một mục hướng dẫn ở danh mục bên trái hoặc thanh 4 bước bên trên để xem chi tiết.
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.shadow-soft {
    box-shadow: 0 4px 20px -2px rgba(74, 120, 194, 0.2);
}
.soft-shadow {
    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05);
}
</style>

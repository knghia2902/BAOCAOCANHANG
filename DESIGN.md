# Tài Liệu Hướng Dẫn Thiết Kế Đồng Bộ (Design System)
Dự án: **Báo Cáo Cân Hàng & Quản Lý Hồ Sơ Phương Tiện (Ngoc Anh Portfolio & Utilities)**

Tài liệu này quy chuẩn hóa các thành phần giao diện (UI) trong dự án để đảm bảo tính đồng bộ theo phong cách **Playful Pastel Blue & Slate** (Dễ thương, bo góc mềm mại, kết hợp với các tông màu xanh navy/slate chuyên nghiệp cho công ty).

---

## 1. Bảng Quy Chuẩn Hệ Màu (Color System)

| Tên Màu (Token) | Mã Màu (Hex/RGB) | Vai Trò & Ứng Dụng | Lớp Tailwind (Ví dụ) |
| :--- | :--- | :--- | :--- |
| **Primary (Chủ đạo)** | `#4a78c2` | Màu nhấn chính, tiêu đề thương hiệu, nút CTA chính, viền tiêu điểm. | `bg-primary`, `text-primary` |
| **Primary Hover** | `#3b5e9c` (Tối hơn 15%) | Trạng thái hover của nút bấm chủ đạo. | `hover:bg-[#3b5e9c]` |
| **Text Main (Chữ chính)**| `#1e293b` (Slate-800) | Màu chữ cho toàn bộ tiêu đề banner, nhãn input, văn bản bảng dữ liệu. | `text-[#1e293b]` |
| **Text Muted (Chữ phụ)** | `#64748b` (Slate-500) | Mô tả phụ, chú thích chân trang, thời gian hệ thống. | `text-gray-400` / `text-slate-500` |
| **Background App** | `#f0f4f8` | Màu nền toàn màn hình của toàn bộ ứng dụng (body background). | `bg-background-light` / `--soft-rose` |
| **Card / Container** | `#ffffff` | Nền các thẻ chính, sidebar, banner chào mừng, bảng dữ liệu. | `bg-white` |
| **Input / Button Gray** | `#f1f5f9` (Slate-100) | Nền các ô nhập liệu (input), nút phụ, popover đính kèm file. | `bg-[#f1f5f9]` |
| **Soft Pink / Blue** | `#e2ecfc` | Viền nhạt bao quanh thẻ, popover, trạng thái hover của danh sách. | `border-soft-pink` / `hover:bg-[#e2ecfc]` |
| **Soft Rose** | `#6495ed` | Màu đổ bóng của nút Puffy chính. | `#6495ed` |
| **Success State** | `#0d9488` (Teal-600) | Trạng thái "ĐỦ hồ sơ", "Đã đồng bộ", "Cho phép". | `text-teal-600`, `bg-teal-50` |
| **Warning State** | `#e11d48` (Rose-600) | Trạng thái "THIẾU hồ sơ", nút "Xóa", "Không cho phép". | `text-rose-600`, `bg-rose-50` |

---

## 2. Bảng Quy Chuẩn Typography (Cỡ Chữ & Trọng Số)

Hệ thống phông chữ tối ưu hóa (Chỉ sử dụng 2 phông để đảm bảo hiệu năng tải trang và tính đồng bộ kích thước hiển thị):
*   **Font Tiêu Đề / Nhấn Mạnh / Tên sà lan (Display Font)**: `Space Grotesk` (Phông chữ hình học hiện đại, nét đậm cá tính).
*   **Font Nội Dung / Số liệu / Bảng biểu (Body Font)**: `Quicksand` (Phông chữ bo tròn nhẹ, cực kỳ rõ nét khi hiển thị số liệu cân và văn bản nhỏ).

Giao diện web được tối ưu hóa đồng bộ về **5 cỡ chữ cốt lõi** dưới đây (đảm bảo cỡ chữ nhỏ nhất hiển thị trên màn hình là 12px để tăng độ đọc hiểu và bảo vệ an toàn cho phôi in):

| Cấp Bậc (Typography Level) | Cỡ Chữ (Size) | Trọng Số (Weight) | Ứng Dụng Thực Tế | Lớp Tailwind Mẫu |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Title / Banner** | `3xl` (30px) | `font-black` (900) | Tiêu đề chào mừng ở trang chủ, tên trang quản trị. | `text-3xl font-display font-black` |
| **Section / Modal Title**| `xl` (20px) | `font-black` (900) | Tiêu đề của từng phân khu, tiêu đề các popup hộp thoại. | `text-xl font-display font-black` |
| **Card Title / Menu** | `base` (16px) | `font-bold` (700) | Tên các công cụ chính, nút bấm lớn, tiêu đề phụ. | `text-base font-bold` |
| **Body text / Form Input**| `sm` (14px) | `font-bold` / `semibold`| Chữ nội dung form nhập liệu, nhãn dữ liệu chính. | `text-sm font-bold` |
| **Table Detail / Desc / Label** | `xs` (12px) | `font-semibold` / `bold`| Cỡ chữ nhỏ nhất trên UI: số liệu bảng, nhãn phụ, thẻ trạng thái. | `text-xs font-semibold` |

---

## 3. Bảng Quy Chuẩn Bo Góc (Border Radius)

Ứng dụng phong cách bo tròn mềm mại (Playful style) nhưng có phân cấp rõ ràng theo kích thước khối:

| Cỡ Bo Góc (Radius Token) | Giá Trị Thực Tế | Ứng Dụng UI | Lớp Tailwind Mẫu |
| :--- | :--- | :--- | :--- |
| **Khối Lớn (Extra Large)**| `2.5rem` (40px) | Banner chào mừng, thẻ quản trị chính, vùng bao ngoài bảng. | `rounded-[2.5rem]` |
| **Khối Vừa (Large)** | `2rem` (32px) | Sidebar máy tính, hộp thoại popup thông tin chính, thẻ thống kê. | `rounded-[2rem]` / `rounded-[24px]` |
| **Khối Nhỏ (Medium)** | `1.5rem` (24px) | Menu thả xuống (dropdown avatar), popover đính kèm ảnh. | `rounded-3xl` |
| **Khối Nhập Liệu (Input)**| `1rem` (16px) | Trường nhập liệu (Input text), ô Textarea, nút bấm chính. | `rounded-2xl` |
| **Nút Nhỏ/Bảng (Action)** | `0.75rem` (12px)| Nút "Chỉnh sửa", "Xóa", thẻ trạng thái Đủ/Thiếu trong bảng. | `rounded-xl` |
| **Hình Tròn (Circle)** | `9999px` | Ảnh đại diện (avatar), nút Đóng hình tròn, Header nổi. | `rounded-full` |

---

## 4. Quy Chuẩn Thiết Kế Các Loại Nút (Buttons Spec)

| Loại Nút | Thiết Kế Gốc (Nền & Viền) | Trạng Thế Tương Tác (Hover / Active) | Mã Tailwind Chuẩn |
| :--- | :--- | :--- | :--- |
| **Primary (Puffy)** | Nền `primary` (`#4a78c2`), chữ trắng, bóng dưới `#6495ed` dày 4px. | **Hover**: dịch xuống 2px, bóng mỏng 2px.<br>**Active**: co lại 95%, dịch xuống 4px, mất bóng. | `bg-primary text-white font-bold rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all` |
| **Secondary (Outline)**| Nền trắng, viền mỏng màu `primary/10`, chữ màu `primary`. | **Hover**: Nền chuyển sang màu xanh pastel nhạt (`bg-primary/5`), viền đổi sang màu `primary`. | `bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl hover:bg-primary/5 active:scale-95 transition-all shadow-sm` |
| **Icon Button (Tròn)** | Nền `bg-[#f1f5f9]`, chữ xám nhạt (`text-gray-400`). | **Hover**: Biểu tượng đổi sang đỏ hoặc xanh lá, phóng to nhẹ (`scale-105`). | `size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all` |
| **Table Action (Chữ)** | Nền `bg-[#f1f5f9]`, chữ `text-primary`, viền `border-soft-pink`. | **Hover**: Đảo ngược thành nền `bg-primary` chữ trắng (`text-white`). | `px-2.5 py-1 bg-[#f1f5f9] hover:bg-primary hover:text-white border border-soft-pink text-primary font-black rounded-xl text-[10px] transition-all whitespace-nowrap shadow-sm` |
| **Table Action Icon (Edit)** | Nền xanh nhạt `bg-primary/5`, chữ `text-primary`, kích thước `32x32px` hình tròn. | **Hover**: Nền `bg-primary/10`. <br>**Active**: co lại 95%. | `size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all active:scale-95` |
| **Table Action Icon (Delete)** | Nền đỏ nhạt `bg-red-50`, chữ `text-red-500`, kích thước `32x32px` hình tròn. | **Hover**: Nền `bg-red-100`. <br>**Active**: co lại 95%. | `size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95` |
| **Table Action Icon (Print)** | Nền xanh lá nhạt `bg-teal-50`, chữ `text-teal-600`, kích thước `32x32px` hình tròn. | **Hover**: Nền `bg-teal-100`. <br>**Active**: co lại 95%. | `size-8 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-600 flex items-center justify-center transition-all active:scale-95` |

---

## 5. Quy Chuẩn Bố Cục & Vị Trí (Layout & Component Grid)

### A. Thanh Điều Hướng Nổi (Global Floating Header)
*   **Vị trí**: Cố định trên cùng (Sticky), rộng `95%` tổng chiều ngang, chiều rộng tối đa (`max-w-[1200px]`), căn giữa (`mx-auto`), khoảng cách trên cách đỉnh `mt-6`.
*   **Thiết kế**: Nền trắng đục có hiệu ứng mờ kính (`backdrop-blur bg-white/80`), bo góc tròn tuyệt đối (`rounded-full`), có viền mỏng màu xanh nhạt (`border-soft-pink`).
*   **z-index**: Phải luôn đặt `z-index: 50` để không bị đè bởi các popover bên dưới.

### B. Thanh Bên Tiêu Chuẩn (Sidebar - Desktop Only)
*   **Chiều rộng**: Cố định `w-72` (288px), bo góc lớn (`rounded-[3rem]`).
*   **Căn chỉnh bên trong**: Căn cột dọc (`flex flex-col`), đệm trong `p-8` (32px).
*   **Trạng thái kích hoạt (Active)**: Mục menu đang chọn phải đổi nền thành trắng tinh, đổi màu chữ thành `text-primary`, có bóng đổ nhẹ.

### C. Vùng Dữ Liệu Bảng (Data Table Container)
*   **Bao bọc bảng**: Bảng dữ liệu luôn phải nằm trong một thẻ div có nền trắng (`bg-white`), bo góc vừa (`rounded-[24px]`), viền mỏng (`border-primary/5`).
*   **Cuộn bảng (Scroll)**: Phải giới hạn chiều cao tối đa của vùng chứa bảng và đặt `overflow-auto` để tự động xuất hiện thanh cuộn ngang/dọc trên màn hình nhỏ.
*   **Hàng tiêu đề (thead)**: Tiêu đề cột dùng nền xám nhạt (`bg-gray-50`), luôn cố định trên cùng khi cuộn dọc (`sticky top-0 z-10`).
*   **Các hàng dữ liệu (tbody tr)**: Đệm dòng rộng rãi (`py-2.5` hoặc `py-3`), hover vào dòng sẽ đổi nền xám dịu mắt (`hover:bg-gray-50`) để dễ theo dõi số liệu.

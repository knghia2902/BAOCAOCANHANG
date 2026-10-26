# Rules

## Git & Deployment Workflow
- Sau khi hoàn thành chỉnh sửa mã nguồn hoặc hoàn thành bất kỳ yêu cầu nào của người dùng, **BẮT BUỘC** thực hiện đầy đủ quy trình commit, push và theo dõi deploy:
  1. **BẮT BUỘC kiểm tra cả Type, Test & Build nội bộ trước khi push:**
     - Chạy `npm test` để đảm bảo toàn bộ unit test đều PASS.
     - Chạy `npm run build` (hoặc `npx vue-tsc -b`) để đảm bảo không có lỗi biên dịch TypeScript/Vite làm hỏng build. Nếu có lỗi phải fix triệt để trước khi đẩy.
  2. **Chuẩn bị và tạo Commit:**
     - Chạy `git add .` để đưa các file thay đổi vào staging.
     - Chạy `git commit -m "feat/fix/chore: <mô tả ngắn gọn về thay đổi>"` với commit message rõ ràng.
  3. **Đẩy mã nguồn lên Remote:**
     - Chạy `git push origin master` (hoặc nhánh đang phát triển).
     - Kiểm tra kết quả lệnh push đảm bảo exit code 0.
  4. **BẮT BUỘC THEO DÕI QUÁ TRÌNH CI & DEPLOY (Follow CI Run):**
     - Sau khi push, sử dụng GitHub CLI (`gh run list -L 1` hoặc `gh run watch`) để theo dõi pipeline GitHub Actions đang chạy cho commit vừa đẩy.
     - Đợi và xác nhận pipeline hoàn tất với trạng thái **`success` (xanh)**.
     - Nếu pipeline bị **`failure` (đỏ)**: Bắt buộc dùng `gh run view <run-id> --log-failed` để điều tra lỗi ngay lập tức, khắc phục và lặp lại quy trình cho đến khi deploy thành công.
     - Tuyệt đối không dừng lại hoặc báo hoàn thành cho người dùng khi CI đang bị fail hoặc chưa theo dõi xong kết quả deploy.

## Database Migration Workflow
- Khi một tính năng mới hoặc bản cập nhật có tạo hoặc thay đổi bảng cơ sở dữ liệu Supabase (có file `.sql` mới trong `database/migrations/`):
  1. **BẮT BUỘC nhắc người dùng ngay trong phản hồi:** Nêu rõ tên file migration SQL, đường dẫn file và hướng dẫn các bước dán vào Supabase SQL Editor (kèm link Dashboard).
  2. Tuyệt đối không được âm thầm dựa vào fallback mà không nhắc nhở người dùng chạy database chính thức.

## UI & Design System Workflow (DESIGN.md)
- Khi tạo mới, chỉnh sửa hoặc refactor bất kỳ trang (View) hay thành phần giao diện (Component) nào trong dự án, **BẮT BUỘC** đọc và tuân thủ nghiêm ngặt quy chuẩn thiết kế tại `DESIGN.md`:
  1. **Hệ Màu (Color System):**
     - Màu chủ đạo: `primary` (`#4a78c2`, hover `#3b5e9c`), nền ứng dụng `bg-background-light` (`#f0f4f8`), nền thẻ `bg-white`, nền ô nhập liệu/nút phụ `bg-[#f1f5f9]`, chữ chính `text-[#1e293b]`, chữ phụ `text-slate-500` / `text-gray-400`.
     - Trạng thái: Thành công dùng `text-teal-600` / `bg-teal-50`, Cảnh báo/Xóa dùng `text-rose-600` / `bg-rose-50`.
  2. **Typography (Cỡ chữ & Phông chữ):**
     - Tiêu đề / Nhấn mạnh dùng `font-display font-black` (`Space Grotesk`), nội dung / số liệu dùng `Quicksand`.
     - Cỡ chữ nhỏ nhất trên giao diện là `12px` (`text-xs`). Tiêu đề Banner dùng `text-3xl font-display font-black`, tiêu đề phân khu / Modal dùng `text-xl font-display font-black`.
  3. **Phân Cấp Bo Góc (Border Radius):**
     - Khối lớn: `rounded-[2.5rem]` (40px); Khối vừa / Sidebar / Modal: `rounded-[2rem]` hoặc `rounded-[24px]`; Khối nhỏ: `rounded-3xl`; Input / Nút phụ: `rounded-2xl`; Nút hành động nhỏ trong bảng: `rounded-xl`; Nút Puffy / Icon tròn: `rounded-full`.
  4. **Quy Chuẩn Nút Bấm (Buttons Spec):**
     - **Primary (Puffy):** `bg-primary text-white font-bold rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all`
     - **Secondary (Outline):** `bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl hover:bg-primary/5 active:scale-95 transition-all shadow-sm`
     - **Icon Button (Tròn):** `size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all`
     - **Table Action Icon (Edit / Delete / Print):** Kích thước `size-8 rounded-full` (`bg-primary/5 text-primary` cho Sửa, `bg-red-50 text-red-500` cho Xóa, `bg-teal-50 text-teal-600` cho In) kèm `active:scale-95 transition-all`.



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


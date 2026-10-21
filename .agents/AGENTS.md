# Rules

## Git Workflow
- Sau khi hoàn thành chỉnh sửa mã nguồn hoặc hoàn thành yêu cầu của người dùng, hãy luôn tự động thực hiện commit và push các thay đổi lên GitHub:
  1. **BẮT BUỘC kiểm tra build trước khi push:** Chạy `npm run build` (hoặc `npx vue-tsc -b`) để đảm bảo không có lỗi biên dịch TypeScript/Vite làm hỏng CI/CD deploy trên GitHub/Vercel/Netlify. Nếu có lỗi phải fix ngay trước khi đẩy.
  2. Chạy `git add .` để chuẩn bị các file thay đổi.
  3. Thực hiện `git commit -m "feat/fix/chore: <mô tả ngắn gọn về thay đổi>"` với thông điệp rõ ràng.
  4. Chạy `git push origin master` (hoặc nhánh đang phát triển) để đẩy mã nguồn lên GitHub.
  5. Kiểm tra kết quả lệnh push đảm bảo trạng thái thành công (exit code 0 và remote nhận đủ commit).

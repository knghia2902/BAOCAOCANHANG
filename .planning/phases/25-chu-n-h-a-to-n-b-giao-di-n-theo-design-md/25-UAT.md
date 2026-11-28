---
status: complete
phase: 25-chu-n-h-a-to-n-b-giao-di-n-theo-design-md
source: [25-01-SUMMARY.md]
started: 2026-11-26T08:45:00Z
updated: 2026-11-28T02:33:07Z
---

## Current Test

[testing complete]

## Tests

### 1. Hệ thống Font & Thanh điều hướng nổi (Header)
expected: Mở ứng dụng (đã đăng nhập). Thanh điều hướng nổi phía trên cùng có nền kính mờ (trắng bán trong suốt), viền xanh pastel nhạt, logo & chữ "Cảng Nguyên Ngọc" màu xanh chủ đạo (#4a78c2). Tiêu đề hiển thị bằng Space Grotesk đậm, nội dung & menu dùng Quicksand rõ nét; khi mở modal "Chỉnh sửa hồ sơ" từ avatar, hộp thoại bo góc mềm (rounded-[2rem]) với nút "Lưu Thay Đổi" dạng Puffy có bóng xanh phía dưới.
result: pass

### 2. Trang Chủ (HomeView)
expected: Tiêu đề chào mừng dùng font đậm sắc nét; nút "Mở Workspace" có kiểu Puffy nổi (bóng xanh #6495ed dưới chân, nhún xuống khi hover/nhấn); nút "Quản trị" (nếu là Admin) kiểu viền mảnh nền trắng bo góc 16px; khối "Tiện ích hệ thống" bo góc lớn mềm mại và toàn bộ nhãn phụ ("sà lan", "đang mở", "Click to use") đều rõ nét (>= 12px).
result: issue
reported: "Nút quản trị không đúng phải bo góc như bản cũ, và màu, mờ cũng như bản cũ, sử dụng lại thiết kế cũ cho nút này"
severity: cosmetic

### 3. Trang Đăng nhập & Đổi mật khẩu (LoginView & ChangePasswordView)
expected: Màn hình đăng nhập hiển thị biểu tượng xanh chủ đạo, ô nhập liệu nền xám nhạt (#f1f5f9) chữ đậm rõ ràng, nút "Đăng Nhập Chính Thức" dạng Puffy, nút Demo Sandbox dạng viền mảnh đồng bộ, và dòng ghi chú bên dưới đủ cỡ chữ dễ đọc (>= 12px).
result: issue
reported: "Bỏ dòng 🔒 Dành cho người test: Trải nghiệm full tính năng, không ghi đè dữ liệu gốc. Vào Chế Độ Thử Nghiệm (Demo Sandbox) làm gọn nhỏ thôi"
severity: cosmetic

### 4. Trang Tài liệu (Docs) & Giới thiệu (About)
expected: Mở tab Docs: nền xanh xám nhạt đồng bộ toàn app, banner bo góc lớn, các nút Bước 1–4 và hộp lưu ý (màu teal cho thành công, xanh chủ đạo cho thông tin) hiển thị rõ chữ >= 12px. Mở tab About: viền các thẻ hiển thị rõ nét (không bị mất viền), chữ mô tả dễ đọc.
result: pass

### 5. Trang Quản trị (AdminView) — Màu sắc, Bảng & Modal
expected: Mở /admin: không còn bóng đổ/vệt màu hồng cũ; bảng Tài khoản và bảng Lịch sử hoạt động nằm trong khung bo góc rounded-[24px] có tiêu đề cột cố định khi cuộn; nhãn hành động trong Logs dùng hệ màu chuẩn (teal/primary/slate/amber/rose); mở thử modal Tạo/Sửa tài khoản thấy hộp thoại bo góc chuẩn (không quá tròn), nút đóng tròn đều và nút xác nhận dạng Puffy.
result: issue
reported: "Thêm vào DESIGN.md cho thanh Scroll này nhỏ xuống hoặc bỏ luôn chỉ cần scroll chuột không cần hiện thanh đó. Phải cuộn xuống dưới cùng mới hiện trước sau để chuyển, bất tiện"
severity: major

### 6. Không gian làm việc & Sơ đồ cây (UnifiedWorkspaceView & WorkspaceTreeSidebar)
expected: Mở /workspace: cây menu bên trái các mục con bo góc đều (rounded-2xl), nút ghim và thu gọn phản hồi mượt khi hover/nhấn, chữ nội dung kế thừa Quicksand gọn gàng.
result: issue
reported: "Bỏ phần admin trong này đi hiển thị ở ngoài là được sửa lại UAT đi"
severity: cosmetic

## Summary

total: 6
passed: 2
issues: 4
pending: 0
skipped: 0

## Gaps

- gap_id: G-25-2
  truth: "Nút 'Quản trị' trên Trang Chủ (HomeView) giữ đúng thiết kế cũ: bo góc tròn (rounded-full), nền trong suốt mờ (hover:bg-white/50), viền border-2 border-strawberry-cream, chữ text-primary; khu vực Tiện ích hệ thống giữ đúng bo góc & độ mờ bản cũ và rút gọn 'Hồ Sơ Phương Tiện'."
  status: resolved
  resolved_by: 25-05-PLAN.md
  resolved_at: 2026-11-28
  reason: "User reported: Nút quản trị không đúng phải bo góc như bản cũ, và màu, mờ cũng như bản cũ, sử dụng lại thiết kế cũ cho nút này; phần tiện ích mở rộng sửa lại như bản cũ, bỏ chữ Quản lý"
  severity: cosmetic
  test: 2
  artifacts:
    - src/views/HomeView.vue
  missing: []
- gap_id: G-25-3
  truth: "Trang Đăng nhập (LoginView) không hiển thị dòng ghi chú '🔒 Dành cho người test...' và nút 'Vào Chế Độ Thử Nghiệm (Demo Sandbox)' được làm gọn nhỏ."
  status: resolved
  resolved_by: 25-05-PLAN.md
  resolved_at: 2026-11-28
  reason: "User reported: Bỏ dòng 🔒 Dành cho người test: Trải nghiệm full tính năng, không ghi đè dữ liệu gốc. Vào Chế Độ Thử Nghiệm (Demo Sandbox) làm gọn nhỏ thôi"
  severity: cosmetic
  test: 3
  artifacts:
    - src/views/LoginView.vue
  missing: []
- gap_id: G-25-5
  truth: "Thanh cuộn bảng dữ liệu được ẩn (scrollbar-none) theo quy chuẩn bổ sung vào DESIGN.md và thanh phân trang (Trước / Sau) trong bảng Lịch Sử Hoạt Động được ghim cố định bên ngoài vùng cuộn."
  status: resolved
  resolved_by: 25-05-PLAN.md
  resolved_at: 2026-11-28
  reason: "User reported: Thêm vào DESIGN.md cho thanh Scroll này nhỏ xuống hoặc bỏ luôn chỉ cần scroll chuột không cần hiện thanh đó. Phải cuộn xuống dưới cùng mới hiện trước sau để chuyển, bất tiện"
  severity: major
  test: 5
  artifacts:
    - DESIGN.md
    - src/views/AdminView.vue
  missing: []
- gap_id: G-25-6
  truth: "Header trong Workspace (UnifiedWorkspaceView) bỏ cụm hiển thị tên/avatar tài khoản góc phải vì đã có ở Header ngoài."
  status: resolved
  resolved_by: 25-05-PLAN.md
  resolved_at: 2026-11-28
  reason: "User reported: Bỏ phần admin trong này đi hiển thị ở ngoài là được sửa lại UAT đi"
  severity: cosmetic
  test: 6
  artifacts:
    - src/views/workspace/UnifiedWorkspaceView.vue
  missing: []

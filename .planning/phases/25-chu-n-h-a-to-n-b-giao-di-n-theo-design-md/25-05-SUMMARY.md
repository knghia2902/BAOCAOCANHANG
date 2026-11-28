---
phase: 25-chu-n-h-a-to-n-b-giao-di-n-theo-design-md
plan: 05
subsystem: ui
tags: [uat-fix, design-system, home, login, admin, workspace]
gap_closure: true
gap_ids:
  - G-25-2
  - G-25-3
  - G-25-5
  - G-25-6
key-files:
  modified:
    - DESIGN.md
    - src/views/HomeView.vue
    - src/views/LoginView.vue
    - src/views/AdminView.vue
    - src/views/workspace/UnifiedWorkspaceView.vue
completed: 2026-11-28
---

# Phase 25 Plan 05: Khắc phục phản hồi UAT Wave 1 — Summary

**Hoàn tất toàn bộ 4 điểm chỉnh sửa từ UAT Wave 1 (`G-25-2`, `G-25-3`, `G-25-5`, `G-25-6`).**

## Accomplishments

- **`G-25-2` ([HomeView.vue](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/src/views/HomeView.vue)):**
  - Khôi phục nút **Quản trị** về đúng thiết kế gốc (`rounded-full border-2 border-strawberry-cream font-bold text-lg hover:bg-white/50 text-primary`).
  - Khôi phục khu vực **Tiện ích hệ thống** về đúng bo góc & độ trong suốt bản cũ (`bg-white/20 rounded-[4rem] border-white/40`, thẻ con `bg-white/60 border-soft-pink/10 rounded-[4rem] hover:bg-white/80`, tiêu đề `text-lg`).
  - Rút gọn nhãn `Quản Lý Hồ Sơ Phương Tiện` thành `Hồ Sơ Phương Tiện`.
- **`G-25-3` ([LoginView.vue](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/src/views/LoginView.vue)):**
  - Xóa dòng ghi chú `🔒 Dành cho người test: Trải nghiệm full tính năng, không ghi đè dữ liệu gốc.`.
  - Thu gọn nút **Chế Độ Thử Nghiệm (Demo Sandbox)** thành nút nhỏ gọn (`inline-flex px-4 py-2 rounded-full text-xs`) căn giữa.
- **`G-25-5` ([DESIGN.md](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/DESIGN.md), [AdminView.vue](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/src/views/AdminView.vue)):**
  - Bổ sung quy chuẩn ẩn thanh cuộn (`scrollbar-none`) và ghim cố định thanh phân trang bên ngoài vùng cuộn vào Mục 5C `DESIGN.md`.
  - Áp dụng `scrollbar-none` cho các bảng trong `AdminView.vue`; tách bộ đếm bản ghi và thanh phân trang (`Trước` / `Trang X / Y` / `Sau`) ra ngoài vùng cuộn bảng Lịch Sử Hoạt Động để luôn hiển thị cố định ở đáy card.
- **`G-25-6` ([UnifiedWorkspaceView.vue](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/src/views/workspace/UnifiedWorkspaceView.vue)):**
  - Gỡ cụm hiển thị tên & avatar tài khoản góc trên bên phải bên trong Workspace (giữ hiển thị ở Header ngoài).

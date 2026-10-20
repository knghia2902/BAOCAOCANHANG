---
phase: quick
plan: 261020-vmi
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/tools/SingleBargeAllocator.vue
autonomous: true
must_haves:
  truths:
    - "Left sidebar no longer shows the barge cards list box under [Chưa phân bổ | Đã phân bổ]"
    - "Right panel in Tab 1 displays the list of barges (filtered by Chưa phân bổ / Đã phân bổ) when no barge is selected"
    - "Clicking a barge row in the right panel loads and displays that barge's weighbridge tickets"
    - "Clicking [Chưa phân bổ] or [Đã phân bổ] on the left sidebar or clicking the Back button returns to the barge list on the right"
  artifacts:
    - path: "src/components/tools/SingleBargeAllocator.vue"
      provides: "Sidebar status switcher without barge list + Right panel barge list -> ticket drill-down"
---

<objective>
Tinh chỉnh giao diện PHÂN BỔ TẢI TRỌNG (`SingleBargeAllocator.vue`):
1. Bỏ danh sách thẻ tàu/sà lan ở Sidebar bên trái (ô khoanh đỏ dưới 2 nút Chưa phân bổ / Đã phân bổ).
2. Ở khung bên phải (Tab 1), thay vì hiện ngay các dòng phiếu cân thì hiển thị danh sách tàu/sà lan (theo trạng thái Chưa phân bổ / Đã phân bổ đang chọn ở Sidebar trái).
3. Khi click vào một tàu/sà lan ở bảng bên phải thì mới tự động nạp và hiển thị danh sách các dòng phiếu cân của tàu/sà lan đó (kèm nút quay lại danh sách tàu).
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Bỏ danh sách tàu ở Sidebar trái và hiển thị danh sách tàu ở bảng bên phải trước khi mở phiếu cân</name>
  <files>src/components/tools/SingleBargeAllocator.vue</files>
  <action>
    1. Trong Sidebar trái (`SingleBargeAllocator.vue`):
       - Xóa khối danh sách thẻ sà lan dưới 2 nút `[Chưa phân bổ]` và `[Đã phân bổ]`, chỉ giữ lại tiêu đề và 2 nút chuyển tab trạng thái.
       - Đặt `isConfigExpanded = ref(true)` mặc định để phần cài đặt hiển thị cân đối ở Sidebar trái.
    2. Trong logic trạng thái & điều hướng:
       - Không tự động chọn `activeBargeId` khi mới vào trang (`activeBargeId = ref(null)`), để khung bên phải mặc định hiển thị danh sách tàu/sà lan.
       - Khi nhấn `[Chưa phân bổ]` hoặc `[Đã phân bổ]` ở Sidebar trái (`switchBargeStatusTab`), đặt `activeBargeId = null` và `activeDataTab = 'source'` để hiển thị danh sách tàu tương ứng bên phải.
       - Tạo hàm `selectBargeFromList(barge)` khi click vào tàu ở bảng bên phải: gán `activeBargeId = barge.id`, `activeVesselId = barge.vesselId`, `historyBargeFilter = 'current'`, và gọi `loadTicketsFromSourceBarge(false)` (không bật hộp thoại xác nhận) để nạp ngay phiếu cân của tàu đó và hiển thị bảng phiếu cân.
       - Tạo hàm `backToBargeList()` đặt `activeBargeId = null` để quay lại danh sách tàu.
    3. Trong khung bên phải (`activeDataTab === 'source'`):
       - Khi `!activeBargeId`: Hiển thị bảng danh sách tàu/sà lan (STT, Tên tàu/sà lan, Mã lệnh, Tàu chủ quản, Loại hàng, Trạng thái, Thao tác). Click vào dòng tàu sẽ gọi `selectBargeFromList(barge)`.
       - Khi `activeBargeId` đã chọn: Hiển thị nút `← Danh sách tàu` trên thanh công cụ và hiển thị bảng các dòng phiếu cân của tàu đó.
  </action>
  <verify>npm run build</verify>
  <done>Build passes with 0 errors and UI matches user requirements.</done>
</task>

</tasks>

# Phase 26: Khởi tạo Tồn đầu Bãi Container Eastwood — Context

**Gathered:** 2026-11-28 (từ phiên `/gsd-explore`)
**Status:** Ready for planning / execution

## Locked Decisions

1. **Số liệu tồn đầu kỳ thực tế tại cảng:**
   - **782 cont rỗng** (đang nằm bãi, đã xá hàng — trạng thái `EMPTY_YARD`)
   - **122 cont đã trả nhà máy** (đã hoàn tất — trạng thái `RETURNED`)
   - **Tổng cộng: 904 container** (0 cont có hàng tồn cũ trước mốc 26/11/2026).
2. **Định dạng đầu vào:**
   - Upload **file Excel (`.xlsx`) hoặc CSV (`.csv`)** chỉ cần **1 cột chứa Số Container** (không yêu cầu ngày giờ lịch sử).
   - Cho phép chọn trạng thái khởi tạo khi upload:
     - `Cont rỗng (đang nằm bãi)` (`EMPTY_YARD`)
     - `Đã trả nhà máy` (`RETURNED`)
     - *(Tùy chọn mở rộng)* `Cont có hàng` (`LOADED`)
   - Cho phép chọn **Ngày chốt tồn đầu** (mặc định `2026-11-25`, gắn mốc giờ `23:59:59` để mọi phiếu cân từ `2026-11-26` trở đi đều có `eventDatetime` mới hơn và tự động cập nhật trạng thái).
3. **Quy tắc tách Tồn đầu kỳ vs Phát sinh hàng ngày:**
   - Bản ghi tồn đầu kỳ được nhận diện bằng `soPhieu = 'TON_DAU'` (hoặc prefix `id` `BASELINE_...`, không cần sửa schema DB trên Supabase!).
   - **`Trạng thái bãi` (`computeContainerStatuses`) & `Sơ đồ kho`:** TÍNH GỘP cả bản ghi tồn đầu kỳ và phát sinh phiếu cân.
     - Cont thuộc 782 cont rỗng khi có phiếu `LẤY CONT RỖNG` từ `26/11/2026` → tự chuyển `EMPTY_YARD → RETURNED`.
     - Cont thuộc 122 cont đã trả khi có phiếu `HẠ CONT` từ `26/11/2026` → tự chuyển `RETURNED → LOADED`.
     - Không gắn cảnh báo thiếu phiếu Hạ Cont cho các cont tồn đầu kỳ (`isBaselineEvent(ev)`).
   - **`Báo cáo ngày (REPORT)` (`computeContainerDailyReport`) & 3 tab chi tiết (`Hạ Cont`, `Load Cont`, `Trả Cont`):** LOẠI TRỪ bản ghi tồn đầu kỳ để báo cáo ngày chỉ đếm sạch phát sinh từ `26/11/2026` trở đi.
   - Trên tab `Trạng thái bãi`, bản ghi tồn đầu hiển thị nhãn rõ ràng (VD: `Tồn đầu (25/11/2026)` thay vì để trống hoặc lẫn với ngày cân thực tế).
4. **Hành vi an toàn khi upload:**
   - Tự động trích xuất mã container từ mọi cột/dòng hợp lệ (hỗ trợ cả file có/không có header), chuẩn hóa in hoa, lọc trùng.
   - Hiển thị **xem trước số lượng mã cont hợp lệ & số dòng trùng bị gộp** ngay trong modal trước khi bấm xác nhận lưu.
   - Hỗ trợ nút **Xóa riêng dữ liệu Tồn đầu kỳ** nếu người dùng muốn nạp lại danh sách chốt mà không ảnh hưởng phiếu cân đã import từ `26/11/2026`.

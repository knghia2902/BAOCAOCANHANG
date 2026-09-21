---
title: Nâng cấp đồng bộ sà lan trực tiếp từ Phiếu cân import theo Mã lệnh
date: 2026-09-21
priority: high
status: pending
---

# Nâng cấp đồng bộ sà lan trực tiếp từ Phiếu cân import theo Mã lệnh

## Bối cảnh
Trước đây, Báo cáo tổng quan (WeighbridgePrinter.vue) đồng bộ danh sách xe của sà lan từ llocator_generated_trips (kết quả thuật toán phân bổ tải trọng của Tab 2 trong CargoAllocator). Nay quy trình đã bỏ tab phân bổ, dữ liệu phiếu cân import lên sẽ được dùng trực tiếp để đưa vào sà lan.

## Yêu cầu kỹ thuật
- Trong WeighbridgePrinter.vue:
  - Hàm syncFromAllocatorActiveBarge và syncFromAllocator đọc trực tiếp từ llocator_tickets (dữ liệu phiếu cân import ở Tab 1).
  - Lọc chính xác các phiếu cân có orderNo trùng khớp với arge.config.orderNo (không phân biệt chữ hoa/thường).
  - Map trực tiếp các trường từ CSVRecord sang đối tượng Truck:
    - 	icketNo: 	.ticketNo
    - plateNumber: 	.plateNumber
    - driver: 	.driverName
    - weight1: 	.weight1
    - weight2: 	.weight2
    - weightNet: 	.weightNet
    - dateIn: ghép dateInStr + 	imeInStr (hoặc định dạng ISO)
    - dateOut: ghép dateOutStr + 	imeOutStr (hoặc định dạng ISO)
    - 
ote: 	.notes
    - cargoType: 	.cargoType
    - customer: 	.customer
    - orderNo: 	.orderNo
  - Đảm bảo kiểm tra sà lan bị khóa (nếu khóa thì từ chối đồng bộ).
  - Khi đồng bộ thành công, cập nhật giao diện sà lan ngay lập tức mà không làm ảnh hưởng hay xóa dữ liệu phiếu cân gốc ở Tab 1.

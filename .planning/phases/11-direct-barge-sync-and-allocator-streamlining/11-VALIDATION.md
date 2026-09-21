# Phase 11: Direct Barge Sync & Allocator Streamlining - Validation Strategy

**Date:** 2026-09-21  
**Status:** Approved  

## Validation Checklist

### 1. Build Verification
- [ ] Command: 
pm run build
- [ ] Must compile clean with zero TypeScript (ue-tsc) or Vite bundle errors.

### 2. Direct Barge Sync Verification
- [ ] Import weighbridge tickets with valid orderNo (e.g. LENH01).
- [ ] Navigate to Báo cáo tổng quan -> Select barge with orderNo = 'LENH01'.
- [ ] Click Đồng bộ từ Dữ liệu cân hàng.
- [ ] Verify: Only trucks with orderNo = 'LENH01' are added.
- [ ] Verify: All truck fields (plateNumber, ticketNo, driver, weight1, weight2, weightNet, dateIn, dateOut, cargoType, customer) are correctly mapped.
- [ ] Verify: Tab 1 in Dữ liệu cân hàng is NOT cleared by this sync.

### 3. Cargo Allocator UI & Workflow Verification
- [ ] Navigate to Dữ liệu cân hàng: Verify only 2 tabs exist (1. Phiếu cân, 2. Theo dõi). Tab Phân bổ is completely removed.
- [ ] Verify top cards: Quy tắc phân bổ and Cấu hình tải trọng xe are removed. Only Cấu hình chung remains.
- [ ] In Tab 1 (Phiếu cân): Click Lưu vào Sổ theo dõi.
- [ ] Verify: Tickets are saved to Tab 2 (Theo dõi).
- [ ] Verify: Tab 1 is reset to empty.
- [ ] In Tab 2 (Theo dõi): Verify column headers and values match Tab 1's criteria.
- [ ] In Tab 2: Click Xuất Excel -> verify file contains the standard 14 columns matching the import format.

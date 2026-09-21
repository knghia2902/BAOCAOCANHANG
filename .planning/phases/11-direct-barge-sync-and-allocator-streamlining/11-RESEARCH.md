# Phase 11: Direct Barge Sync & Allocator Streamlining - Research Document

**Date:** 2026-09-21  
**Status:** Complete & Ready for Planning  
**Requirements Addressed:** SYNC-DIRECT-01, SYNC-DIRECT-02, SYNC-DIRECT-03, SYNC-DIRECT-04, SYNC-DIRECT-05

---

## 1. Executive Summary

### 1.1 Motivation & Current Problem
In the current system:
- In CargoAllocator.vue:
  - **Tab 1 (Phiếu cân)** imports raw weighbridge CSV/Excel records into csvRecords.
  - **Tab 2 (Phân bổ)** runs a distribution & splitting algorithm (egenerateAllocatedTrips) to generate synthetic split trips (generatedTrips).
  - **Tab 3 (Theo dõi)** stores historical records into llocator_history_trips / weighbridge_tracking.
  - Top section contains 3 cards: Cấu hình chung, Quy tắc phân bổ, and Cấu hình tải trọng xe.
- In WeighbridgePrinter.vue (Báo cáo tổng quan):
  - When syncing data into a barge, syncFromAllocatorActiveBarge() and syncFromAllocator() query settings.allocator_generated_trips.
  - This couples the barge synchronization directly to Tab 2's synthetic allocation.

### 1.2 The New Workflow
1. **Remove Tab 2 (Phân bổ)** entirely from CargoAllocator.vue. The allocation algorithm and vehicle splitting are no longer used.
2. **Streamline Top Config Cards**: Remove Quy tắc phân bổ and Cấu hình tải trọng xe from the top of CargoAllocator.vue. Keep only general configs (e.g. ticket number patterns/series if needed).
3. **Direct Barge Sync in Báo cáo tổng quan**:
   - WeighbridgePrinter.vue sync reads directly from llocator_tickets (stored in Supabase content.settings.allocator_tickets or IndexedDB).
   - Filter tickets strictly matching arge.config.orderNo with 	icket.orderNo (case-insensitive trim).
   - Direct field mapping from CSVRecord to Truck model (	icketNo, plateNumber, driverName, weight1, weight2, weightNet, dateIn, dateOut, 
otes, cargoType, customer, orderNo).
   - Syncing to barges is non-destructive: it does NOT modify or clear Tab 1.
4. **Independent Lưu vào Sổ theo dõi & Clear Tab 1**:
   - Place a button Lưu vào Sổ theo dõi on the toolbar of Tab 1 (Phiếu cân).
   - When clicked, all tickets in csvRecords are persisted into the tracking table (weighbridge_tracking via AllocatorService.saveTrips or bulk insert).
   - Once saved successfully, clear csvRecords, reset the file input, and save the empty state to remote llocator_tickets.
5. **Standardize Tab 2 (Theo dõi) Schema**:
   - Tab 2 displays the exact same column criteria as Tab 1's imported file:
     STT, Số phiếu, Mã lệnh, Số xe, Khách hàng, Loại hàng, TL1 (kg), TL2 (kg), Khối lượng (kg), Thời gian vào, Thời gian ra, Tên sà lan, Tài xế, Ghi chú.
   - Excel export (compileAndDownload) for Tab 2 exports using this clean 14-column layout matching the import format.

---

## 2. Technical Architecture & File Changes

### 2.1 src/components/tools/WeighbridgePrinter.vue
- Update syncFromAllocator() and syncFromAllocatorActiveBarge():
  - Source data: load llocator_tickets instead of llocator_generated_trips.
  - Filter by isBargeMatch(ticket, barge) matching 	icket.orderNo with arge.config.orderNo.
  - Map CSVRecord to Truck:
    `	ypescript
    const importedTrucks: Truck[] = matchedTrips.map((t: any, idx: number) => {
        let dIn = '';
        let dOut = '';
        if (t.dateInStr && t.timeInStr) {
            dIn = ${t.dateInStr}T;
        } else if (t.dateInStr) {
            dIn = t.dateInStr;
        }
        if (t.dateOutStr && t.timeOutStr) {
            dOut = ${t.dateOutStr}T;
        } else if (t.dateOutStr) {
            dOut = t.dateOutStr;
        }
        return {
            id: Date.now() + idx,
            barge_id: barge.id,
            ticketNo: t.ticketNo || '',
            sourceTicketNo: t.ticketNo || '',
            plateNumber: t.plateNumber || '',
            driver: t.driverName || '',
            weight1: Number(t.weight1) || 0,
            weight2: Number(t.weight2) || 0,
            weightNet: Number(t.weightNet) || 0,
            dateIn: dIn,
            dateOut: dOut,
            note: t.notes || '',
            cargoType: t.cargoType || '',
            customer: t.customer || '',
            orderNo: t.orderNo || ''
        };
    });
    `
  - Update user toast messages and modal descriptions if they mention Báo cáo phân bổ -> change to Dữ liệu cân hàng / Phiếu cân.

### 2.2 src/components/tools/CargoAllocator.vue
- Remove Tab 2 (2. Phân bổ). Rename remaining tabs:
  - ctiveDataTab: 'source' | 'history' (or 'source' | 'generated')
  - Tab 1 label: 1. Phiếu cân ()
  - Tab 2 label: 2. Theo dõi ()
- Remove card 2 (Quy tắc phân bổ) and card 3 (Cấu hình tải trọng xe). Keep card 1 (Cấu hình chung).
- Move action Lưu vào Sổ Theo Dõi to Tab 1:
  - Save csvRecords into tracking history (AllocatorService.saveTrips).
  - Upon success: csvRecords.value = [], csvFile.value = null, save empty llocator_tickets to Supabase & IndexedDB.
  - Show success toast and switch to Tab 2 to let user review.
- Standardize Tab 2 table headers and cells to match Tab 1:
  - Headers: STT, Số phiếu, Mã lệnh, Số xe, Khách hàng, Loại hàng, TL1, TL2, Khối lượng hàng, Thời gian vào, Thời gian ra, Sà lan, Tài xế, Ghi chú.
- Update compileAndDownload:
  - Output Excel columns conforming strictly to the standardized 14-column format.

---

## 3. Validation Architecture
- Build check: 
pm run build (ue-tsc --noEmit && vite build).
- Functional tests:
  1. Import sample Excel/CSV in Tab 1 -> verify tickets render properly with orderNo.
  2. In Báo cáo tổng quan, open a barge with a configured orderNo -> Click Đồng bộ -> verify trucks populate correctly matching orderNo.
  3. Verify Tab 1 data remains intact after sync.
  4. In Tab 1, click Lưu vào Sổ theo dõi -> verify tickets are saved to Tab 2 and Tab 1 is cleared.
  5. In Tab 2, verify columns match the import format and export Excel downloads correctly.

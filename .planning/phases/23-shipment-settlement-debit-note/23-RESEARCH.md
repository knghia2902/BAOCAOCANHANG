# Phase 23: Research & Technical Approach

## 1. Domain & Requirements Summary
- **Mã yêu cầu:** `SETTLE-01`, `SETTLE-02`, `SETTLE-03`, `SETTLE-04`.
- **Mục tiêu:** Xây dựng module Quyết toán Lô hàng & Đề nghị thanh toán (DNTT 1 & 2), Bảng kê lưu sà lan theo công thức cảng biển (làm tròn nấc 0.5/1 ngày), áp ma trận biểu giá Hợp đồng 7 bậc giá dầu Petrolimex Vùng 1, và xuất tệp Excel trọn gói 8 sheet chuẩn mẫu cảng.
- **Môi trường:** Chạy hoàn toàn client-side trên trình duyệt, phát triển và kiểm thử toàn diện trên môi trường web local (`npm run dev`) trước.

## 2. Technical Decisions & Architecture

### 2.1. Cấu trúc Dữ liệu Hợp đồng & Ma trận Giá dầu (SETTLE-01)
- Tạo kiểu dữ liệu `SettlementContract`:
  ```ts
  export interface FuelTier {
      id: string;
      label: string; // "< 20,000", "20,000 - 25,000", "25,001 - 30,000", ...
      minPrice: number;
      maxPrice: number;
  }

  export interface ContractServiceItem {
      id: string;
      code: string;
      name: string; // Tên hiển thị trên DNTT
      subTitle?: string; // Ghi chú dòng 2
      unit: string; // Tấn, VNĐ...
      contractRef: string; // "Hợp đồng số 01-2026/GW-TVPL và Phụ lục số 2"
      category: 'STEVEDORING' | 'TRUCKING' | 'CUSTOMS' | 'DEMURRAGE' | 'OTHER';
      tierPrices: Record<string, number>; // fuelTierId -> unitPrice
  }

  export interface SettlementContract {
      id: string;
      customerName: string;
      cargoName: string;
      agreementNo: string;
      serviceOrderPrefix?: string;
      fuelTiers: FuelTier[];
      services: ContractServiceItem[];
      freeDemurrageDays: number; // Mặc định 7 ngày
      demurrageRatePerTonDay: number; // Mặc định 3,000 đ/tấn/ngày
      vatRate: number; // Mặc định 0.08 (8%)
      beneficiaryInfo: {
          name: string;
          accountNo: string;
          bank: string;
      };
  }
  ```
- Lưu trữ: Lưu trong Supabase table `content` (field `settings.settlement_contracts`) và cache IndexedDB, đồng thời có bộ template mặc định nạp sẵn hợp đồng Green Wood / Gỗ Bình Định (01-2026).

### 2.2. Dịch vụ Tính toán Lưu sà lan & Phân loại Weightlist (SETTLE-02)
- Tạo service `BargeDemurrageService.ts`:
  - `calculateDemurrage(bargeName, arrDateStr, depDateStr, totalTons, freeDays, rate)`:
    - Tính số ngày thực tế: `(depDate - arrDate) / 86400000`, làm tròn 1 chữ số thập phân (`round(..., 1)`).
    - Tính vượt lưu thô: `totalDays - freeDays`.
    - Làm tròn cảng biển:
      ```ts
      if (excessDays <= 0) return { totalDays, excessDays: 0, roundedDays: 0, amount: 0 };
      const intPart = Math.floor(excessDays);
      const frac = Math.round((excessDays - intPart) * 10) / 10;
      let roundedDays = intPart;
      if (frac > 0.5) roundedDays += 1.0;
      else if (frac > 0) roundedDays += 0.5;
      const amount = Math.round(roundedDays * rate * totalTons);
      ```
  - `splitTicketsByFlowType(tickets)`:
    - Nhóm 1: `EXPORT` (hàng xuất kho ra sà lan -> nạp sheet `EXPORT XUẤT KHO`).
    - Nhóm 2: `DIRECT` (hàng xe sang sà lan trực tiếp -> nạp sheet `WL XUẤT SALAN`).
    - Nhóm 3: `TRUCK` (hàng các xe tải vận chuyển về cảng -> nạp sheet `TRUCK `).

### 2.3. Trình chuyển đổi Số thành Chữ Song ngữ (SETTLE-03)
- Tạo tiện ích `numberToWords.ts`:
  - `numberToVietnameseWords(amount: number): string`
  - `numberToEnglishWords(amount: number): string`
  - Đảm bảo xử lý chính xác đến hàng tỷ, hàng triệu, hàng nghìn và đuôi "đồng chẵn" / "Dong".

### 2.4. Trình kết xuất Excel 8 Sheet (SETTLE-04)
- Tạo `SettlementExcelExporter.ts` sử dụng thư viện `exceljs` đã có sẵn trong dự án:
  - Tạo workbook gồm 8 sheet: `DNTT 1`, `Giá dầu`, `BK SALAN`, `EXPORT XUẤT KHO`, `WL XUẤT SALAN`, `LƯU SÀ LAN`, `DNTT 2`, `TRUCK `.
  - Áp dụng font Cambria chuẩn công văn, bảng kẻ line mảnh, dòng tổng cộng in đậm viền kép, giữ nguyên công thức sống `SUM`, `SUBTOTAL`, `ROUND`.

## 3. Lộ trình Phân chia Plans
1. **Plan 23-01:** Tạo `SettlementTypes.ts`, `BargeDemurrageService.ts`, và `numberToWords.ts` kèm bộ unit tests đầy đủ kiểm tra khớp 100% với số liệu tàu `EPOCH WIND`.
2. **Plan 23-02:** Xây dựng giao diện Modal/Tab Quyết toán Lô hàng (`ShipmentSettlementModal.vue`): bảng kê sà lan cho phép nhập Ngày đến / Ngày rời, bộ chọn bậc giá dầu, trình chọn dịch vụ gắn số HĐ, bảng xem trước DNTT 1 & 2 song ngữ.
3. **Plan 23-03:** Triển khai `SettlementExcelExporter.ts` xuất trọn gói 8 sheet Excel chuẩn mẫu và tích hợp nút "Quyết toán & Xuất ĐNTT" vào giao diện Báo cáo lô hàng (`WeighbridgePrinter.vue`).

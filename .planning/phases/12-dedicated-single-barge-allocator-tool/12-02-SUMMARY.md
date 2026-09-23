# Plan Summary: 12-02 Dedicated Single-Barge Allocator Tool (Tab 2 Allocation & Tab 3 Tracking Book)

## Summary of Accomplishments
1. **Tab 2: Allocation Engine & Preview**:
   - Single target barge selection with auto-detection for `NÔNG SẢN_DE HEUS` (or first barge in active vessels list).
   - Dynamic weight splitting algorithm:
     - Splits tickets where `weightTons > limitTons` into `Math.ceil(totalTons / limitTons)` sub-trips.
     - Supports `even` (equal distribution), `random` (bounded random variation), and `max` (greedily filling initial trucks).
     - Net weight sum across all sub-trips matches 100% of original ticket net weight.
     - Sequential timestamp distribution based on `spacingStrategy` and `timeIntervalMinutes`.
   - Real-time preview table showing generated sub-trips, gross/tare/net weights, dates/times, and ticket numbers.
   - Live banner summarizing target barge name, order number, trip count, total tonnage, and average tonnage.
   - **Direct Sync to Barge**: One-click "Đồng bộ vào Sà lan" maps trips to `Truck` interface and stores into `WeighbridgeService.saveTrucks(bargeId, ...)`.
   - **Save to Tracking Book**: One-click "Lưu vào Sổ theo dõi" saves all trips to `split_history_trips` (IndexedDB) and navigates to Tab 3.
2. **Tab 3: Sổ theo dõi (Allocated Tracking Book) & Excel Export**:
   - Standard 14-column layout matching the original tracking book format.
   - Real-time search filter across plate number, ticket number, order number, barge, cargo type.
   - Quick inline editing for `orderNo`.
   - Pagination controls (10, 20, 50, 100 per page).
   - Row deletion and "Xóa sạch sổ" action with safety confirmation.
   - Professional Excel `.xlsx` export using `exceljs`:
     - File name: `SO_THEO_DOI_PHAN_BO_[TÊN_SÀ_LAN]_[YYYY-MM-DD].xlsx`.
     - Merged headers, statistics subtitle, styled Indigo header row, number formatting with thousand separators, auto-fitted column widths.

## Verification
- Clean build via `npm run build` completed in 42s with zero TypeScript and template errors.

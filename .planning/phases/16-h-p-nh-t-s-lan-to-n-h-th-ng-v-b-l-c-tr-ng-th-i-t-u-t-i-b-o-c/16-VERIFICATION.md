---
phase: 16-h-p-nh-t-s-lan-to-n-h-th-ng-v-b-l-c-tr-ng-th-i-t-u-t-i-b-o-c
verified: 2026-10-16T22:12:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
---

# Phase 16: Hợp nhất sà lan toàn hệ thống và bộ lọc trạng thái tàu tại Báo cáo tổng quan - Verification Report

**Phase Goal:** Hợp nhất toàn bộ dữ liệu sà lan (cả tàu đang làm hàng và tàu đã xong) tại bảng Báo cáo tổng quan để phục vụ tính phí cầu bến không bị chia cắt theo tab của Sidebar; đồng thời bổ sung bộ lọc Trạng thái tàu độc lập [Tất cả tàu | Tàu đang làm hàng | Tàu đã xong] trên thanh công cụ lọc.
**Verified:** 2026-10-16T22:12:00Z
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Bảng Danh sách quản lý tất cả sà lan tại Báo cáo tổng quan hiển thị đầy đủ sà lan của cả tàu đang làm và tàu đã xong | ✓ VERIFIED | `allBarges` lặp qua toàn bộ `vessels.value` thay vì giới hạn theo `selectedVesselStatusTab` |
| 2 | Trên thanh công cụ lọc của bảng có dropdown Trạng thái tàu với 3 tùy chọn: Tất cả trạng thái tàu (mặc định), Tàu đang làm hàng, Tàu đã xong | ✓ VERIFIED | Thêm `<select v-model="globalFilterVesselStatus">` với 3 options `""`, `"in_progress"`, `"done"` |
| 3 | Bộ lọc Trạng thái tàu hoạt động độc lập và có thể kết hợp với bộ lọc Kỳ tính phí hoặc dùng riêng lẻ | ✓ VERIFIED | `filteredAllBarges` áp dụng lọc `vesselStatus` song song với `globalFilterType` và `globalBargeSearchQuery` |
| 4 | Thẻ thống kê Tổng số sà lan và Tàu phản ánh đúng số liệu toàn diện hoặc theo trạng thái được lọc | ✓ VERIFIED | Thẻ số tàu hiển thị theo `globalFilterVesselStatus` hoặc tổng số tàu; thẻ sà lan hiển thị `allBarges.length` |
| 5 | Cấu trúc bảng hiển thị và file Excel xuất ra giữ nguyên theo form hiện tại | ✓ VERIFIED | Không thêm badge/cột thừa; tiêu đề phụ Excel đính kèm trạng thái lọc nếu có |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/tools/WeighbridgePrinter.vue` | Hợp nhất allBarges toàn hệ thống và bộ lọc trạng thái tàu độc lập | ✓ EXISTS + SUBSTANTIVE | Hợp nhất dữ liệu, thêm reactive filter, cập nhật template & xuất Excel |

**Artifacts:** 1/1 verified

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| UNIFY-BARGES-01 | ✓ SATISFIED | - |
| VESSEL-FILTER-01 | ✓ SATISFIED | - |

**Coverage:** 2/2 requirements satisfied

## Gaps Summary

**No gaps found.** Phase goal achieved. All requirements and must-haves verified.

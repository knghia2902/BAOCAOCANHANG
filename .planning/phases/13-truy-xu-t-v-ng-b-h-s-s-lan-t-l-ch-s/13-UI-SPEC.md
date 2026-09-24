---
phase: 13
slug: truy-xu-t-v-ng-b-h-s-s-lan-t-l-ch-s
status: draft
shadcn_initialized: false
preset: none
created: 2026-09-24
---

# Phase 13 — UI Design Contract

> Visual and interaction contract for frontend Phase 13: Truy xuất và đồng bộ hồ sơ sà lan từ lịch sử.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (TailwindCSS 3.4.17) |
| Preset | not applicable |
| Component library | Custom Single File Components (Vue 3 Composition API) |
| Icon library | Material Symbols Outlined |
| Font | Fredoka (display/headings), Noto Sans (body/labels) |

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing |
| md | 16px | Default element spacing |
| lg | 24px | Section padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions: none

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 12px (text-xs) | 500 / 600 | 1.4 |
| Label | 11px / 12px | 700 / 900 (font-black) | 1.2 |
| Heading | 14px / 16px | 800 / 900 | 1.3 |
| Display | 20px / 24px | 900 | 1.2 |

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#f0f4f8` / `#ffffff` | Background, surfaces |
| Secondary (30%) | `#f8fafc` / `#e2e8f0` | Cards, input backgrounds, borders |
| Accent (10%) | `#4a78c2` (`primary`) | Nút "Truy xuất hồ sơ cũ", nút Lưu, active tabs |
| Success | `#059669` (`emerald-600`) | Toast thành công, badge "Cho phép", badge "Đủ" |
| Warning | `#d97706` (`amber-600`) | Cảnh báo chưa nhập tên sà lan |
| Destructive | `#e11d48` (`rose-600`) | Hủy thao tác, badge "Không cho phép" |

Accent reserved for: Nút "Truy xuất hồ sơ cũ", Primary Action buttons, Active toggle states.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (Nút truy xuất) | `Truy xuất hồ sơ cũ` (icon `history`) |
| Empty name warning | `Vui lòng nhập tên sà lan trước khi truy xuất!` |
| Not found feedback | `Không tìm thấy dữ liệu cũ của sà lan [TÊN_SÀ_LAN]!` |
| Confirmation title | `Đồng bộ hồ sơ sà lan cũ` |
| Confirmation message | `Tìm thấy hồ sơ sà lan [TÊN] từ tàu [TÀU_MẸ] (ngày [NGÀY]). Bạn có muốn đồng bộ dữ liệu sang sà lan này không?` |
| Confirmation OK button | `Đồng ý đồng bộ` |
| Confirmation Cancel button | `Hủy bỏ` |
| Success Toast | `Đã đồng bộ dữ liệu hồ sơ cũ của sà lan [TÊN] thành công!` |

---

## UI Considerations & States

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| Empty input | Ô Tên sà lan để trống | ✅ covered | Bấm nút hiển thị Toast cảnh báo: "Vui lòng nhập tên sà lan trước khi truy xuất!" |
| Zero match | Không tìm thấy sà lan cũ cùng tên | ✅ covered | Toast cảnh báo màu cam: "Không tìm thấy dữ liệu cũ của sà lan [TÊN]!" |
| Success match | Tìm thấy >= 1 bản ghi cũ | ✅ covered | Mở hộp thoại xác nhận với thông tin bản ghi gần nhất |
| User confirms | Bấm "Đồng ý đồng bộ" | ✅ covered | Tự động điền form, cập nhật tính hợp lệ (GCN, ĐK, BH, Thuyền viên), Toast thành công |
| User cancels | Bấm "Hủy bỏ" hoặc đóng modal | ✅ covered | Giữ nguyên dữ liệu form hiện tại không thay đổi |

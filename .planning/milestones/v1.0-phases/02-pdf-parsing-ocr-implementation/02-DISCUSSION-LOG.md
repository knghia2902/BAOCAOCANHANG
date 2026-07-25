# Phase 2: PDF Parsing & OCR Implementation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 2-PDF Parsing & OCR Implementation
**Areas discussed:** Y-Coordinate Grouping, OCR Resolution Scale

---

## Thuật toán gom nhóm dòng theo trục Y (Y-Coordinate Grouping)

| Option | Description | Selected |
|--------|-------------|----------|
| **Tính toán động theo chiều cao font chữ (Dynamic Threshold)** | Gom nhóm hai đoạn chữ vào cùng một dòng nếu chênh lệch tọa độ Y nhỏ hơn 50% chiều cao trung bình của font chữ đó. Cách này thích ứng tốt với cả tài liệu có cỡ chữ rất nhỏ hoặc tiêu đề lớn. | ✓ |
| **Sử dụng ngưỡng cố định (Fixed Threshold)** | Thiết lập một ngưỡng chênh lệch cố định (ví dụ: 3px đến 5px) cho toàn bộ tài liệu. Đơn giản để cài đặt nhưng có thể hoạt động kém nếu tài liệu có nhiều kích cỡ chữ khác nhau. | |

**User's choice:** Tính toán động theo chiều cao font chữ (Dynamic Threshold)
**Notes:** Quyết định này tăng tính ổn định của việc nhận dạng dòng chữ cho các văn bản PDF phức tạp chứa nhiều loại cỡ chữ khác nhau.

---

## Độ phân giải Render Canvas cho OCR (Resolution Scale)

| Option | Description | Selected |
|--------|-------------|----------|
| **Scale 2.0x** | Điểm cân bằng tối ưu giữa hiệu năng và độ chính xác. Giúp các chữ nhỏ và các dấu tiếng Việt hiển thị rõ nét hơn để OCR nhận diện chuẩn, dung lượng ảnh ở mức vừa phải (~15MB/trang). | ✓ |
| **Scale 1.5x** | Tốc độ xử lý nhanh hơn, tốn ít bộ nhớ hơn, nhưng có thể bị nhận diện sai lệch nhiều ở các chữ nhỏ hoặc tài liệu scan độ phân giải thấp. | |
| **Scale 3.0x** | Tăng tối đa độ chính xác cho tài liệu mờ, tuy nhiên xử lý rất chậm và có nguy cơ làm crash tab trình duyệt của người dùng trên máy cấu hình yếu nếu file PDF có nhiều trang. | |

**User's choice:** Scale 2.0x
**Notes:** Giúp cân bằng tốt hiệu năng và độ chính xác của Tesseract OCR đối với tiếng Việt (vốn có nhiều dấu thanh dễ bị mất nếu ảnh bị mờ).

---

## the agent's Discretion

- **Hỗ trợ ngôn ngữ OCR**: Chạy đồng thời `eng+vie` để hỗ trợ nhận diện song ngữ Anh - Việt.
- **Dựng cột Excel (Column Reconstruction)**: Gom nhóm tọa độ X để suy luận ra các cột trong Excel.

## Deferred Ideas

None — discussion stayed within phase scope

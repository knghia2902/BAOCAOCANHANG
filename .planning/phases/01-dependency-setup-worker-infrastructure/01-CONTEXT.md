# Phase 1: Dependency Setup & Worker Infrastructure - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase này tập trung hoàn toàn vào việc thiết lập hạ tầng phụ thuộc và cơ chế chạy Worker:
1. Cài đặt các thư viện cốt lõi cho xử lý PDF, OCR và định dạng tài liệu client-side (`pdfjs-dist`, `tesseract.js`, `docx`, `docx-preview`, `html2pdf.js`).
2. Giải quyết cấu hình bundle của Vite 7 và thiết lập kiểu dữ liệu trong TypeScript để đảm bảo ứng dụng build thành công không lỗi.
3. Thiết lập liên kết nạp PDF.js Worker từ CDN công khai và tạo cơ chế kiểm tra (Diagnostic Check) để xác minh hạ tầng hoạt động tốt trước khi xây dựng giao diện ở các phase sau.

</domain>

<decisions>
## Implementation Decisions

### Dependency Setup & Worker Infrastructure
- **D-01:** Sử dụng CDN công khai (như `cdnjs.cloudflare.com` hoặc `unpkg.com`) để nạp PDF.js Worker thay vì đóng gói cục bộ (Local Bundling). Lựa chọn này giúp tránh các xung đột MIME type và lỗi đường dẫn khi deploy trên các nền tảng hosting tĩnh (Netlify/Vercel), đồng thời tuân thủ tiêu chí thành công của ROADMAP.md.
- **D-02:** Cài đặt các thư viện client-side sau:
  - `pdfjs-dist` (xử lý nội dung PDF số và render canvas).
  - `tesseract.js` (nhận diện ký tự quang học OCR).
  - `docx` (tạo file Word `.docx` động).
  - `docx-preview` (hiển thị bản xem trước file Word trong DOM).
  - `html2pdf.js` (chuyển đổi HTML xem trước sang PDF thông qua luồng in ấn DOM).
- **D-03:** Cấu hình Tesseract.js sử dụng dữ liệu huấn luyện ngôn ngữ (`eng+vie`) tải trực tiếp từ CDN công khai mặc định của thư viện để giữ kích thước mã nguồn dự án tối ưu.
- **D-04:** Phát triển một module chẩn đoán hạ tầng (`src/services/infrastructure/DiagnosticService.ts` hoặc tương tự) để kiểm chứng việc tải thư viện và Worker hoạt động thành công độc lập trước khi tích hợp vào UI.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Requirements & Roadmap
- `.planning/ROADMAP.md` §Phase 1: Dependency Setup & Worker Infrastructure — Các tiêu chí thành công và kế hoạch thực hiện của Phase 1.
- `.planning/REQUIREMENTS.md` §v1 Requirements — Đặc tả các yêu cầu kỹ thuật cần chuẩn bị nền tảng.
- `.planning/codebase/STACK.md` — Cấu hình stack công nghệ hiện tại (Vite 7, TypeScript 5.9, Vue 3.5).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Dù chưa có code liên quan đến PDF/OCR, các dịch vụ hiện có như `src/services/excel/ConverterService.ts` và `src/services/excel/MergerService.ts` là mẫu chuẩn để tổ chức các Service xử lý file dưới dạng Class độc lập.

### Established Patterns
- **Service Abstraction Layer**: Mọi giao tiếp với thư viện ngoài (như PDF.js, Tesseract.js) cần được bọc trong các file Service nằm ở `src/services/` thay vì gọi trực tiếp từ UI.

### Integration Points
- `package.json` — Nơi khai báo các thư viện phụ thuộc mới.
- `vite.config.ts` — Cấu hình bundler cho các thư viện đặc thù (nếu có).
- `tsconfig.app.json` — Cấu hình TypeScript compiler options và khai báo các kiểu (Types) mới.

</code_context>

<specifics>
## Specific Ideas

- Để kiểm chứng việc nạp PDF.js CDN worker và Tesseract.js hoạt động thành công trong console mà không cần UI phức tạp, có thể viết một script kiểm thử tự động nhỏ chạy trong hàm `mounted` của `App.vue` trong môi trường phát triển (dev environment only).

</specifics>

<deferred>
## Deferred Ideas

- Không có ý tưởng nào bị trì hoãn ngoài phạm vi của Phase 1.

</deferred>

---
*Phase: 01-dependency-setup-worker-infrastructure*
*Context gathered: 2026-05-29*

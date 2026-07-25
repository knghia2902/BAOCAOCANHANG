# Góc Nhỏ Tiện Ích Của Ánh (Ngoc Anh Portfolio & Utilities)

## What This Is

A personal portfolio website and utility dashboard for Ngoc Anh. It displays her projects, profile, and contact details, and provides lightweight web tools (such as spreadsheet mergers and file format converters) that execute serverless, directly inside the user's browser.

## Core Value

Enable serverless, high-performance client-side document processing and formatting tools directly within the browser, keeping user files private and secure.

## Current State

Shipped version **v1.0** containing PDF parsing, client-side OCR, and Word/Excel conversion pipelines. The site is fully functional, serverless, and runs directly in the user's browser.

## Requirements

### Validated

- ✓ User can view profile, projects, tools directory, and contact form — v0
- ✓ User can submit messages via contact form, synchronized with Supabase — v0
- ✓ Admin can authenticate using credentials retrieved from the Supabase database settings — v0
- ✓ Admin can customize hero info, view, read, and delete contact messages, and add/edit/delete projects — v0
- ✓ User can merge multiple Excel (.xlsx) files matching a primary key client-side — v0
- ✓ User can convert Excel to CSV / JSON, and CSV to Excel client-side — v0
- ✓ Unique visitors tracked via 30-day client-side localStorage checks — v0
- ✓ User can convert digital and scanned PDF files to Excel (.xlsx) format client-side — v1.0 (Phase 2)
- ✓ User can convert digital and scanned PDF files to Word (.docx) format client-side — v1.0 (Phase 2)
- ✓ User can convert Word (.docx) and Excel (.xlsx) documents to PDF format client-side — v1.0 (Phase 3)
- ✓ User can perform OCR on scanned PDF pages and uploaded images to extract text — v1.0 (Phase 2)
- ✓ User interface displays status indicators, conversion progress bars, and document previews for PDF/OCR conversions — v1.0 (Phase 4)

### Active

(None - All milestone requirements completed. Ready for next milestone definitions.)

### Out of Scope

- Cloud-side PDF/OCR processing — All conversions must run client-side in the browser to maintain zero-cost serverless hosting and file privacy.
- Advanced document styling conversion — High-fidelity layout preservation (e.g. matching exact custom fonts or complex vector paths) is out of scope; focus is on text and table data extraction.

## Context

- The codebase is a Vue 3 (Composition API) SPA built with TypeScript, Tailwind CSS, and Vite.
- Supabase is used as a backend for portfolio content, message history, and visitor statistics.
- Already contains client-side Excel tools built with `exceljs`.
- Shipped client-side OCR, PDF extraction, and document conversion pipelines under v1.0.

## Constraints

- **Execution**: Browser-only — No server-side document conversion API.
- **Dependencies**: Client libraries only — Must use npm packages that compile and run cleanly in the browser environment (e.g., `pdfjs-dist`, `tesseract.js`, `docx`).
- **Performance**: Browser Memory limits — Files larger than 20MB may be throttled or warned to prevent crashing the browser tab.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Client-side OCR (Tesseract.js) | Serverless execution, no cloud hosting fees, high security for user documents | ✓ Good |
| Client-side PDF Parsing (pdfjs-dist) | Powerful library to parse digital PDFs and render pages into canvases for OCR | ✓ Good |
| ticketNo-based deduplication | Prevents skipping new trips when a plate number has existing trips on the barge | ✓ Good |

---
*Last updated: 2026-07-25 after v1.0 milestone*

# Phase 3 Research: Document Conversion Pipelines

## Executive Summary
This research addresses what is required to correctly plan and execute **Phase 03: document-conversion-pipelines**. The phase focuses on implementing two client-side conversion paths: DOCX to PDF (CONV-04) and XLSX to PDF (CONV-05). It uses a "render-then-print" strategy, meaning the documents are first rendered to the browser's DOM and then captured into a PDF using `html2pdf.js`.

## Core Requirements to Plan Well

### 1. Library Integration & Pitfalls
- **`docx-preview`**: Used for DOCX. Contains a `renderAsync(document, container)` method that reads an ArrayBuffer/Blob and injects HTML into the provided container. Type definitions exist in `src/types/docx-preview.d.ts`.
- **`exceljs`**: Used for XLSX. Already present in the project. We will need to read the first worksheet (D-04 constraint) and manually build an HTML `<table>` element with the data to inject into a container.
- **`html2pdf.js`**: **CRITICAL PITFALL**: Must be imported dynamically (e.g., `const html2pdf = (await import('html2pdf.js')).default;`) inside the execution method. Statically importing it will cause a "self is not defined" error as noted in Phase 1 research.
- **PDF Configuration**: The `html2pdf.js` options must follow the standardized A4 format configuration (D-06):
  ```javascript
  {
    margin: 10,
    filename: file.name.replace(/\.[^/.]+$/, '') + '_converted.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }
  ```

### 2. Service Architecture Patterns
- Based on Phase 2 (`PdfOcrService`) and Phase 1 (`ConverterService`), logic should be encapsulated in a service class, exporting both the class and a singleton instance.
- The pipeline follows: **Upload → Parse → Preview → Export PDF**. 
- A unified progress tracking callback should be supported to report: 0-20% (Reading), 20-70% (Rendering), 70-100% (Exporting).
- File size validation must enforce a strict **15MB limit** (D-08), overriding the 10MB pattern found in `ConverterService.ts`.

### 3. Implementation Steps for Plans
- **Plan 03-01 (DOCX → PDF)**: Needs a service method to accept a File and a target DOM container. Uses FileReader/ArrayBuffer to pass the file to `docx-preview`.
- **Plan 03-02 (XLSX → PDF)**: Needs a service method to read the file using `exceljs`, iterate rows of the first sheet, construct an HTML string or DOM nodes (`<table>`, `<tr>`, `<td>`), and append to the target DOM container.
- Both pipelines need an `exportToPdf(container, filename)` shared method to invoke `html2pdf.js`.

## Validation Architecture

To ensure robust implementation according to the Nyquist Validation framework, the following validation checkpoints must be accounted for in the execution of these plans:

### 1. Pre-Execution Validation
- **Size Limit Enforcement**: The service must aggressively reject any file `> 15 * 1024 * 1024` bytes before allocating memory or invoking parsers.
- **Format Verification**: The service must check the file extension and MIME type.

### 2. State & DOM Validation
- **Container Injection**: Verify that the target HTML element is successfully populated. For DOCX, ensure `docx-preview` injected child nodes. For XLSX, ensure a `<table>` element was created and appended.
- **Progress Callback Testing**: Ensure the `onProgress` function is invoked at each key lifecycle stage (Read, Render, Export) with monotonically increasing percentages.

### 3. Integration Validation
- **Dynamic Import Success**: Ensure the `html2pdf.js` library does not block the thread or throw SSR/Window errors upon instantiation.
- **Export Trigger**: Ensure `html2pdf().from(element).save()` resolves successfully and initiates the browser's download behavior.
- **Filename Accuracy**: Verify that the generated PDF filename strictly adheres to the `{originalName}_converted.pdf` pattern.

### 4. Excel Specific Validation
- **Single Sheet Restriction**: Verify that only `workbook.worksheets[0]` (or `getWorksheet(1)`) is parsed.
- **Empty Cell Handling**: Verify that undefined or null cells from `exceljs` are rendered as empty `<td>` elements in the HTML table to maintain layout alignment.

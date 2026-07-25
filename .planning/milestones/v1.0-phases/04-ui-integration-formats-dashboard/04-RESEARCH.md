# Phase 4 Research: UI Integration & Formats Dashboard

## 1. Context & Objectives
Phase 4 focuses on integrating the `PdfOcrService` and `DocumentConversionService` (created in Phase 2 & 3) into the user interface. It requires implementing a modern, responsive UI in the `/tools` route that perfectly matches the existing application's aesthetic.

**Key Deliverables:**
1. A tabbed interface (`PdfOcrTools.vue`) to switch between:
   - PDF Parsing
   - OCR Processing
   - Document Conversion
2. A reusable `FileDropzone.vue` enforcing a 15MB file limit.
3. A `ConversionProgress.vue` for real-time progress callbacks.
4. A `ToastNotification.vue` to elegantly handle errors and system states.

## 2. Existing Architecture & Integration Points

### 2.1 The `/tools` View
- **Location:** `src/views/ToolsView.vue`
- **Current Layout:** A grid layout (`grid-cols-1 lg:grid-cols-2`) containing two tools (`FormatConverter.vue`, `ExcelMerger.vue`).
- **Integration Plan:** Introduce `PdfOcrTools.vue` as a new wrapper component. Given that `PdfOcrTools.vue` handles three distinct conversion modes with complex UIs, it should either span full width below the existing grid or be integrated cohesively into the `ToolsView.vue` layout.

### 2.2 Service Integration
- **`PdfOcrService.process(file, options)`** (in `src/services/pdf/PdfOcrService.ts`):
  - Will be invoked for PDF Parsing (`useOcr: false`) and OCR Processing (`useOcr: true`).
  - Emits real-time progress via the `onProgress(message, percentage)` callback.
- **`DocumentConversionService`** (in `src/services/conversion/DocumentConversionService.ts`):
  - Will be invoked for the Document Conversion tab.
  - Contains `processDocxToPreview`, `processXlsxToPreview`, and `exportToPdf`.
  - Also emits `onProgress`.
- **Validation Wrapper:** `DocumentConversionService` already contains a `validateFile` method checking for a 15MB limit, but the requirement specifies the UI dropzone should also reject files larger than 15MB visually and via Toast before even passing to services.

### 2.3 Component Styles & Patterns
- **Styling:** The project utilizes Tailwind CSS and Google Material Symbols (e.g., `<span class="material-symbols-outlined">`).
- **Reusability:** The `04-UI-SPEC.md` mandates extracting `FileDropzone`, `ConversionProgress`, and `ToastNotification` into reusable components so they can be consumed by both `PdfOcrTools.vue` and potentially refactored into existing tools later.
- **State Management:** A lightweight composable (e.g., `src/composables/useToast.ts`) should be created to manage Toast states since there is no external toast library installed in `package.json`.

## 3. Recommended Component Structure

1. **`src/components/tools/PdfOcrTools.vue`**:
   - Manages an `activeTab` reactive state.
   - Houses the `<FileDropzone>` for user inputs.
   - Interacts with the backend services.
   - Displays `<ConversionProgress>` when processing.
2. **`src/components/ui/FileDropzone.vue`**:
   - Handles `@dragover.prevent`, `@dragleave.prevent`, and `@drop.prevent`.
   - Checks `file.size <= 15 * 1024 * 1024`.
   - Emits `@file-selected` or `@error` (to trigger Toast).
3. **`src/components/ui/ConversionProgress.vue`**:
   - Props: `statusText` (string), `percentage` (number).
   - Render a smooth transitioning Tailwind progress bar (`w-[percentage]`) and a spinner.
4. **`src/components/ui/ToastNotification.vue`** & **`src/composables/useToast.ts`**:
   - A reactive array of toast objects.
   - Auto-removes toasts after 3000ms using `setTimeout`.

## 4. Validation Architecture

As required by the Nyquist Validation framework, we must ensure these UI updates integrate smoothly without regressions.

**1. Verification Requirements:**
- **UI-01 Validation:** Verify the tabs correctly switch the context and the correct underlying service methods are prepared (e.g., `useOcr` flags change).
- **UI-02 Validation:** Attempt uploading a >15MB file. Confirm it does not proceed to the service layer and a clear Toast notification appears.
- **UI-03 Validation:** During a mock or real heavy conversion, verify the progress bar updates incrementally and the status string updates dynamically without freezing the DOM.

**2. Manual UAT Scenarios:**
- **Scenario A (File Size Limit):** Drop a 20MB file. Expected: Red Toast error, input cleared.
- **Scenario B (OCR Progress):** Drop an image on the OCR tab. Expected: Progress bar mounts, percentage climbs from 0 to 100, text changes ("Initializing Tesseract..." -> "Recognizing text..."), finally prompts download.
- **Scenario C (Responsiveness):** Shrink browser window to mobile width. Expected: Tabs become scrollable or stack gracefully; dropzone padding scales down.

## 5. Execution Plan
- **Plan 04-01:** Scaffold the `ui` folder in `src/components/` and build `FileDropzone.vue`, `ConversionProgress.vue`, and `ToastNotification.vue` with `useToast.ts`.
- **Plan 04-02:** Build `PdfOcrTools.vue`, integrate it into `ToolsView.vue`, bind it to the existing `PdfOcrService` and `DocumentConversionService`, and apply final polish.

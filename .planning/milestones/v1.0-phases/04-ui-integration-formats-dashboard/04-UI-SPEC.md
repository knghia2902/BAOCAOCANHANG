# Phase 4 UI Specification: UI Integration & Formats Dashboard

## 1. Overview
This document outlines the visual and interaction contracts for Phase 4. This phase introduces the user interface for the serverless PDF and OCR utility dashboard on the `/tools` page. It integrates the conversion pipelines established in previous phases with a responsive, modern interface that strictly matches the existing application's aesthetic.

## 2. Visual & Interaction Contracts

### 2.1. Tool Tabs (UI-01)
- **Location:** The `/tools` route.
- **Component:** A tabbed navigation structure (e.g., `PdfOcrTabs.vue`).
- **Behavior:** Allows users to switch seamlessly between different tool contexts:
  - PDF Parsing (Digital PDF to Word/Excel)
  - OCR Processing (Scanned Image/PDF to Text/Word/Excel)
  - Document Conversion (Word/Excel to PDF)
- **Styling:** 
  - Kế thừa phong cách hiện có (Inherits existing app style).
  - Active tabs have distinct highlighting (e.g., brand color border/background).
  - Inactive tabs are muted with hover state transitions (`hover:bg-gray-100` or equivalent dark mode classes).

### 2.2. Drag-and-Drop Dropzone (UI-02)
- **Component:** Reusable file upload area (`FileDropzone.vue`).
- **Behavior:**
  - **Idle State:** Prompts the user to drag and drop files or click to browse.
  - **Drag-Over State:** Visual feedback when a file is dragged over the area (e.g., border color change, background tint).
  - **Validation:** 
    - Enforces a strict **15MB file size limit**.
    - If a file exceeds 15MB, the dropzone rejects the file and triggers an Error Toast.
    - Validates file extensions based on the active tab context.
- **Styling:** Dashed borders, clear iconography (upload icon), and centered typography using standard Tailwind utility classes.

### 2.3. Progress Indicators (UI-03 & User Decisions)
- **Component:** Reusable progress tracker (`ProgressBar.vue` or integrated UI).
- **Behavior:** 
  - Displays prominently during heavy processing phases (OCR, PDF generation).
  - **Percentage Bar:** A progress bar that fills from 0% to 100% based on real-time callbacks.
  - **Status Text & Spinner:** A side-by-side status spinner and current stage text (e.g., "Initializing Tesseract...", "Parsing Document...", "Converting...").
- **Styling:** 
  - Smooth CSS width transitions for the bar (`transition-width duration-300 ease-in-out`).
  - Animated SVG spinner (`animate-spin`).

### 2.4. Error & Status Notifications (User Decisions)
- **Component:** Toast Notification system (`Toast.vue`).
- **Behavior:**
  - Handles errors (e.g., "File too large", "Conversion failed", "Invalid format").
  - **Location:** Floating at the corner of the screen (e.g., bottom-right or top-right).
  - **Auto-dismiss:** Toasts should automatically disappear after a few seconds (e.g., 3-5 seconds).
- **Styling:** Standard error color scheme (red/amber) utilizing Tailwind utilities, appearing above all other content (`z-50`).

## 3. Component Structure (Suggested)

- **`ToolsView.vue`**: The main page container layout.
- **`PdfOcrTools.vue`**: Wrapper component managing the active tab state and rendering the appropriate tool component.
- **`FileDropzone.vue`**: UI component for file selection and 15MB size validation.
- **`ConversionProgress.vue`**: UI component combining the progress bar, percentage text, and status spinner.
- **`ToastNotification.vue`**: Global or local corner notification component for error handling.

## 4. State Management Integration
- Use Vue 3 Composition API (`ref`, `reactive`) for local UI states (active tab, selected files, progress percentage, current status text).
- Coordinate with `PdfOcrService` to trigger conversions and listen to progress events.
- Toast notifications may use a lightweight global store or a composable (`useToast()`) to allow any tool to trigger an error message.

## 5. Styling Guidelines (Tailwind CSS)
- **Consistency:** Must inherit the existing application's design language, keeping it modern and unified.
- **Colors:** Utilize existing theme colors defined in `tailwind.config.js`.
- **Spacing:** Use standard Tailwind spacing scales (`p-4`, `p-6`, `gap-4`).
- **Responsiveness:** Ensure tabs and dropzones resize elegantly on smaller screens (e.g., stacking tabs or scaling down text).

# Architecture

**Analysis Date:** 2026-05-29

## Pattern Overview

**Overall:** Client-Side Single-Page Application (SPA) with Layered Service Architecture.

**Key Characteristics:**
- **Component-Driven UI:** Decoupled Vue components using the Composition API (`<script setup lang="ts">`).
- **Service Abstraction Layer:** All external library calls (Supabase, ExcelJS) and logic are encapsulated in services. UI components do not interact directly with APIs or Excel files.
- **Reactive State Management:** Lightweight global store powered by Vue's `reactive` reactivity engine and persistent `localStorage` sync.
- **Route-Based Protection:** Route guard middleware ensuring administrative paths are locked.

## Layers

**UI / Views Layer (`src/views/`, `src/components/`):**
- Purpose: Render views, layouts, and components; handle user interface events.
- Contains: Single File Components (`*.vue`) styling and presentation logic.
- Depends on: Store layer (for state data) and Service layer (for triggering actions).

**State / Store Layer (`src/stores/`):**
- Purpose: Maintain central, reactive application state and orchestrate auth session tracking.
- Contains: `auth.ts`, `content.ts`.
- Depends on: Services for server communication.
- Used by: Views and UI components.

**Service Layer (`src/services/`):**
- Purpose: Encapsulate business logic, database transactions, image uploading, visitor tracking, and file formatting.
- Contains: `ContentService.ts`, `VisitorTracker.ts`, and subsystems like `excel/` and `storage/`.
- Depends on: Infrastructure adapters (`src/supabase.ts`, browser databases).
- Used by: Stores and UI components.

**Infrastructure / Adapter Layer:**
- Purpose: Initialize connections to persistent state providers (IndexedDB, cloud services).
- Contains: `src/supabase.ts`, `src/services/storage/DBContext.ts`.

## Data Flow

**Bootstrap / Load Flow:**
1. Browser loads `index.html` which loads entry file `src/main.ts`.
2. `main.ts` initializes the router and mounts `src/App.vue`.
3. `App.vue`'s `onMounted` triggers:
   - `ContentService.loadAll()`: Fetches page contents, projects, toolkit, and messages from Supabase, loading them into `contentStore`.
   - `VisitorTracker.trackVisit()`: Increments the cloud database visitor counter if it's the user's first visit in 30 days.

**Excel Merge Flow:**
1. User uploads files to `src/components/tools/ExcelMerger.vue`.
2. UI extracts spreadsheet headers using `mergerService.extractHeaders()`.
3. User selects a matching key column, then triggers the merge.
4. UI calls `mergerService.merge()` with the configuration options.
5. Service uses `ExcelService` to load the workbook buffers, compares rows matching the key, copies column data, writes the output buffer, and returns it to the component.
6. The component triggers a browser file download using `mergerService.download()`.

## Key Abstractions

**Content Service (`src/services/ContentService.ts`):**
- Purpose: Manage Supabase database synchronization for projects, messages, toolkit, and stats.
- Pattern: Exported Namespace Object containing asynchronous data handlers.

**Storage Service (`src/services/storage/StorageService.ts`):**
- Purpose: Handle asset uploads and deletions from the cloud storage bucket.
- Pattern: Exported Namespace Object interfacing with Supabase storage API.

**Excel Service Class (`src/services/excel/ExcelService.ts`):**
- Purpose: Low-level file system read/write wrappers using `exceljs`.
- Pattern: Class with helper functions (`readExcel`, `writeExcel`, `downloadFile`).

## Entry Points

**Root Entry:**
- Location: `src/main.ts`
- Triggers: Browser page load.
- Responsibilities: Imports styles, configures router, and mounts the application.

**SPA Shell:**
- Location: `src/App.vue`
- Triggers: Mounted hook.
- Responsibilities: Triggers global data fetching, handles navigation header rendering and visitor tracking.

## Error Handling

**Strategy:** Services catch exceptions locally to prevent app crashing, print warnings to the developer console, and return status indicators (e.g. `success: false` or `null`) which components process to show descriptive notifications to the user.
- **Supabase Errors:** Destructured `error` properties from queries are checked and logged.
- **Excel Parsing Errors:** Wrapped in `try/catch` inside `excel/*` services and reported back through result interfaces containing error array logs.

---

*Architecture analysis: 2026-05-29*
*Update when major patterns change*

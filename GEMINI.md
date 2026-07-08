<!-- GSD:project-start source:PROJECT.md -->
## Project

**Góc Nhỏ Tiện Ích Của Ánh (Ngoc Anh Portfolio & Utilities)**

A personal portfolio website and utility dashboard for Ngoc Anh. It displays her projects, profile, and contact details, and provides lightweight web tools (such as spreadsheet mergers and file format converters) that execute serverless, directly inside the user's browser.

**Core Value:** Enable serverless, high-performance client-side document processing and formatting tools directly within the browser, keeping user files private and secure.

### Constraints

- **Execution**: Browser-only — No server-side document conversion API.
- **Dependencies**: Client libraries only — Must use npm packages that compile and run cleanly in the browser environment (e.g., `pdfjs-dist`, `tesseract.js`, `docx`).
- **Performance**: Browser Memory limits — Files larger than 20MB may be throttled or warned to prevent crashing the browser tab.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ~5.9.3 - All application code, state management, routes, and services.
- JavaScript - Build configurations (`postcss.config.js`, `tailwind.config.js`).
- HTML5 - Application root structure (`index.html`).
- CSS3 - Core layout styling and tailwind directives (`src/style.css`).
## Runtime
- Web Browser - Client-side execution of all app logic and UI.
- Node.js - Used strictly as a local build-time environment and dev server.
- npm - Dependency management.
- Lockfile: `package-lock.json` present.
## Frameworks
- Vue 3.5.24 - UI library utilizing composition API `<script setup lang="ts">`.
- Vue Router 4.6.4 - Single-Page Application (SPA) client-side routing.
- Vite 7.2.4 - Module bundler and development server.
- vue-tsc 3.1.4 - TypeScript compiler and type checking for Vue files.
- TailwindCSS 3.4.17 - Utility-first CSS framework.
- PostCSS 8.5.6 & Autoprefixer 10.4.23 - CSS styling processing.
## Key Dependencies
- `exceljs` ^4.4.0 - Used client-side in `src/services/excel/ConverterService.ts` and `src/services/excel/MergerService.ts` to parse, manipulate, and generate spreadsheet buffers.
- `@supabase/supabase-js` ^2.90.1 - Client SDK used in `src/supabase.ts` for database CRUD, file storage (assets), and custom setting lookup.
- `idb` ^8.0.3 - Promise-based Wrapper for IndexedDB, initialized in `src/services/storage/DBContext.ts`.
## Configuration
- Configured via `.env` files (client variables prefixed with `VITE_`).
- Required Keys:
- `vite.config.ts` - Vite plugins (Vue) and `@` path alias mapping.
- `tsconfig.json` & `tsconfig.app.json` & `tsconfig.node.json` - Compiler configurations.
- `tailwind.config.js` & `postcss.config.js` - Styling engine configurations.
- `vercel.json` & `netlify.toml` - Hosting redirect rules for fallback SPA routing.
## Platform Requirements
- Windows/macOS/Linux with Node.js and npm.
- Supabase project credentials.
- Static Hosting (Netlify, Vercel).
- Client-side environment variables configured on the platform.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- PascalCase for Vue components (`ExcelMerger.vue`, `HomeView.vue`).
- PascalCase for Service files (`ContentService.ts`, `VisitorTracker.ts`).
- camelCase for stores, configuration, types, and utility code (`auth.ts`, `content.ts`, `router.ts`).
- kebab-case for system config files (`package.json`, `tailwind.config.js`).
- camelCase for all function names and class methods (e.g. `validateFile()`, `excelToCsv()`).
- No specific prefix/suffix is required for async functions.
- camelCase for standard local variables and properties.
- UPPER_SNAKE_CASE for class-level constants and local storage keys (e.g. `VISITOR_KEY`, `VISIT_EXPIRY_DAYS`, `DB_NAME`, `STORE_NAME`).
- PascalCase for all types, interfaces, and enums (e.g. `ConversionOptions`, `MergeResult`).
- Note on Prefixes: Legacy code includes the prefix `I` on some interfaces (`IExcelService`, `IColumnConfig`), but modern type files (`types/excel.ts`) omit the prefix.
## Code Style
- 4-space indentation is standard across all `.ts` files.
- Semicolons are required at the end of statements.
- Single quotes are used for string literals (`'portfolio-assets'`).
- Tailwind CSS class strings are used for component styling in Vue templates.
- Handled at build-time. Types are verified using `vue-tsc` during the compilation step.
## Import Organization
- `@/*` resolved to `./src/*` configured in `tsconfig.app.json` and `vite.config.ts`.
## Error Handling
- Localized `try/catch` wrappers around external API transactions, IndexedDB operations, and Excel file loading.
- Failed operations log failures via `console.error('Context message', error)` and return fallback values (e.g., `false`, `null`, or error result wrapper objects) to allow UI components to fail gracefully.
## Module Design
- Reusable UI elements are default-exported from single-file Vue components.
- Service definitions utilize two separate styles:
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- **Component-Driven UI:** Decoupled Vue components using the Composition API (`<script setup lang="ts">`).
- **Service Abstraction Layer:** All external library calls (Supabase, ExcelJS) and logic are encapsulated in services. UI components do not interact directly with APIs or Excel files.
- **Reactive State Management:** Lightweight global store powered by Vue's `reactive` reactivity engine and persistent `localStorage` sync.
- **Route-Based Protection:** Route guard middleware ensuring administrative paths are locked.
## Layers
- Purpose: Render views, layouts, and components; handle user interface events.
- Contains: Single File Components (`*.vue`) styling and presentation logic.
- Depends on: Store layer (for state data) and Service layer (for triggering actions).
- Purpose: Maintain central, reactive application state and orchestrate auth session tracking.
- Contains: `auth.ts`, `content.ts`.
- Depends on: Services for server communication.
- Used by: Views and UI components.
- Purpose: Encapsulate business logic, database transactions, image uploading, visitor tracking, and file formatting.
- Contains: `ContentService.ts`, `VisitorTracker.ts`, and subsystems like `excel/` and `storage/`.
- Depends on: Infrastructure adapters (`src/supabase.ts`, browser databases).
- Used by: Stores and UI components.
- Purpose: Initialize connections to persistent state providers (IndexedDB, cloud services).
- Contains: `src/supabase.ts`, `src/services/storage/DBContext.ts`.
## Data Flow
## Key Abstractions
- Purpose: Manage Supabase database synchronization for projects, messages, toolkit, and stats.
- Pattern: Exported Namespace Object containing asynchronous data handlers.
- Purpose: Handle asset uploads and deletions from the cloud storage bucket.
- Pattern: Exported Namespace Object interfacing with Supabase storage API.
- Purpose: Low-level file system read/write wrappers using `exceljs`.
- Pattern: Class with helper functions (`readExcel`, `writeExcel`, `downloadFile`).
## Entry Points
- Location: `src/main.ts`
- Triggers: Browser page load.
- Responsibilities: Imports styles, configures router, and mounts the application.
- Location: `src/App.vue`
- Triggers: Mounted hook.
- Responsibilities: Triggers global data fetching, handles navigation header rendering and visitor tracking.
## Error Handling
- **Supabase Errors:** Destructured `error` properties from queries are checked and logged.
- **Excel Parsing Errors:** Wrapped in `try/catch` inside `excel/*` services and reported back through result interfaces containing error array logs.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.agent/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

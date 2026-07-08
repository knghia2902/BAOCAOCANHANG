# Coding Conventions

**Analysis Date:** 2026-05-29

## Naming Patterns

**Files:**
- PascalCase for Vue components (`ExcelMerger.vue`, `HomeView.vue`).
- PascalCase for Service files (`ContentService.ts`, `VisitorTracker.ts`).
- camelCase for stores, configuration, types, and utility code (`auth.ts`, `content.ts`, `router.ts`).
- kebab-case for system config files (`package.json`, `tailwind.config.js`).

**Functions & Methods:**
- camelCase for all function names and class methods (e.g. `validateFile()`, `excelToCsv()`).
- No specific prefix/suffix is required for async functions.

**Variables & Constants:**
- camelCase for standard local variables and properties.
- UPPER_SNAKE_CASE for class-level constants and local storage keys (e.g. `VISITOR_KEY`, `VISIT_EXPIRY_DAYS`, `DB_NAME`, `STORE_NAME`).

**Types & Interfaces:**
- PascalCase for all types, interfaces, and enums (e.g. `ConversionOptions`, `MergeResult`).
- Note on Prefixes: Legacy code includes the prefix `I` on some interfaces (`IExcelService`, `IColumnConfig`), but modern type files (`types/excel.ts`) omit the prefix.

## Code Style

**Formatting:**
- 4-space indentation is standard across all `.ts` files.
- Semicolons are required at the end of statements.
- Single quotes are used for string literals (`'portfolio-assets'`).
- Tailwind CSS class strings are used for component styling in Vue templates.

**Linting:**
- Handled at build-time. Types are verified using `vue-tsc` during the compilation step.

## Import Organization

**Order:**
1. External packages (`vue`, `vue-router`, `exceljs`, `@supabase/supabase-js`).
2. Absolute path alias imports using the `@` mapping (`@/supabase`, `@/stores/content`).
3. Relative path imports (`../services/excel/ExcelService`, `./interfaces`).

**Path Aliases:**
- `@/*` resolved to `./src/*` configured in `tsconfig.app.json` and `vite.config.ts`.

## Error Handling

**Patterns:**
- Localized `try/catch` wrappers around external API transactions, IndexedDB operations, and Excel file loading.
- Failed operations log failures via `console.error('Context message', error)` and return fallback values (e.g., `false`, `null`, or error result wrapper objects) to allow UI components to fail gracefully.

## Module Design

**Patterns:**
- Reusable UI elements are default-exported from single-file Vue components.
- Service definitions utilize two separate styles:
  - **Class Instance Export:** A class is defined and a instantiated singleton instance is exported (e.g. `export const mergerService = new MergerService()`).
  - **Static Namespace Object:** A constant object holds multiple service functions and is exported directly (e.g. `export const ContentService = { ... }`).

---

*Convention analysis: 2026-05-29*
*Update when patterns change*

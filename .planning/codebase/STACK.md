# Technology Stack

**Analysis Date:** 2026-05-29

## Languages

**Primary:**
- TypeScript ~5.9.3 - All application code, state management, routes, and services.

**Secondary:**
- JavaScript - Build configurations (`postcss.config.js`, `tailwind.config.js`).
- HTML5 - Application root structure (`index.html`).
- CSS3 - Core layout styling and tailwind directives (`src/style.css`).

## Runtime

**Environment:**
- Web Browser - Client-side execution of all app logic and UI.
- Node.js - Used strictly as a local build-time environment and dev server.

**Package Manager:**
- npm - Dependency management.
- Lockfile: `package-lock.json` present.

## Frameworks

**Core:**
- Vue 3.5.24 - UI library utilizing composition API `<script setup lang="ts">`.
- Vue Router 4.6.4 - Single-Page Application (SPA) client-side routing.

**Build/Dev:**
- Vite 7.2.4 - Module bundler and development server.
- vue-tsc 3.1.4 - TypeScript compiler and type checking for Vue files.
- TailwindCSS 3.4.17 - Utility-first CSS framework.
- PostCSS 8.5.6 & Autoprefixer 10.4.23 - CSS styling processing.

## Key Dependencies

**Critical:**
- `exceljs` ^4.4.0 - Used client-side in `src/services/excel/ConverterService.ts` and `src/services/excel/MergerService.ts` to parse, manipulate, and generate spreadsheet buffers.
- `@supabase/supabase-js` ^2.90.1 - Client SDK used in `src/supabase.ts` for database CRUD, file storage (assets), and custom setting lookup.
- `idb` ^8.0.3 - Promise-based Wrapper for IndexedDB, initialized in `src/services/storage/DBContext.ts`.

## Configuration

**Environment:**
- Configured via `.env` files (client variables prefixed with `VITE_`).
- Required Keys:
  - `VITE_SUPABASE_URL` - Supabase API endpoint.
  - `VITE_SUPABASE_ANON_KEY` - Supabase public access key.

**Build:**
- `vite.config.ts` - Vite plugins (Vue) and `@` path alias mapping.
- `tsconfig.json` & `tsconfig.app.json` & `tsconfig.node.json` - Compiler configurations.
- `tailwind.config.js` & `postcss.config.js` - Styling engine configurations.
- `vercel.json` & `netlify.toml` - Hosting redirect rules for fallback SPA routing.

## Platform Requirements

**Development:**
- Windows/macOS/Linux with Node.js and npm.
- Supabase project credentials.

**Production:**
- Static Hosting (Netlify, Vercel).
- Client-side environment variables configured on the platform.

---

*Stack analysis: 2026-05-29*
*Update after major dependency changes*

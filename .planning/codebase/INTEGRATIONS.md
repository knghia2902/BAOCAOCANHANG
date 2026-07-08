# External Integrations

**Analysis Date:** 2026-05-29

## APIs & External Services

**Supabase Services:**
- Database, Storage, and Config Provider
  - SDK/Client: `@supabase/supabase-js` ^2.90.1
  - Auth: API credentials loaded from environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  - Tables Used:
    - `content` - Global portfolio content (hero, visibility, stats, about), admin login settings, and unique visitor tracking counters.
    - `projects` - Portfolio project details (title, description, tag, image).
    - `tools` - Navigation/toolkit items (icon, label, tool redirect).
    - `messages` - Contact form submissions (name, email, content, date, status).

## Data Storage

**Databases:**
- PostgreSQL on Supabase - Cloud database holding content metadata, projects list, messages, and administration credentials.
  - Connection: REST API wrapper initialized client-side via `createClient` in `src/supabase.ts`.

**File Storage:**
- Supabase Storage - Asset bucket for portfolio images.
  - Client: `supabase.storage` in `src/services/storage/StorageService.ts`.
  - Bucket: `portfolio-assets`.
  - Folders: Path variables passed to upload functions (e.g. `general`).

**Local Browser Storage:**
- LocalStorage:
  - `auth_session` - Persistent reactive state for user authentication. Tracked/synced via watcher on `authStore` in `src/stores/auth.ts`.
  - `portfolio_visitor_tracked` - Checks for returning visitors within 30 days in `src/services/VisitorTracker.ts`.
- IndexedDB:
  - Database: `ngocanh-portfolio-db`
  - Store: `keyval`
  - Client: Wrapper `idb` in `src/services/storage/DBContext.ts` (prepared for local caching / offline support).

## Authentication & Identity

**Auth Provider:**
- Custom Settings-Based Authentication:
  - Implementation: Matches input credentials against settings stored in the `content` table (retrieved by `AuthService.ts`).
  - Session Storage: Saved locally in `localStorage` under `auth_session`.

## CI/CD & Deployment

**Hosting:**
- Netlify / Vercel:
  - Rewrites configured in `netlify.toml` and `vercel.json` respectively to ensure client-side history API routing works (`/*` -> `/index.html`).

---

*Integration audit: 2026-05-29*
*Update when adding/removing external services*

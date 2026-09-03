# DESCU — 二手智选 · AI-powered second-hand marketplace (Mexico)

DESCU lets people photograph an item, have AI write the listing, and sell it to buyers nearby —
with in-app chat, price negotiation, meet-up or shipping, escrow payments via Stripe and an
admin back-office. Web app + Android/iOS shells (Capacitor) + serverless API (Vercel), all in this repo.

- **Web**: https://descu.ai
- **Stack**: React 18 · Vite · Tailwind · TanStack Query · Supabase (Auth, Postgres, Realtime, Storage) · Express on Vercel · Stripe · Google Gemini · Capacitor 8

## Quick start

```bash
git clone https://github.com/siyutech2024-cmd/DESCU.git && cd DESCU
cp .env.example .env          # fill in Supabase / Stripe / Gemini keys
npm install
npm run server                # local API  → http://localhost:3000
npm run dev                   # web app    → http://localhost:5173 (proxies /api to :3000)
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with `/api` proxy |
| `npm run server` | Local Express API (`server/dev.ts`, hot reload) |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Jest unit tests (API client, mappers, route table) |
| `npm run android:build` | Build web + `cap sync android` |
| `npm run android:open` / `ios:open` | Open the native project |

## Project layout

```
src/            React app — app/ (shell), features/ (hooks + React Query), lib/ (api client,
                toast, errors), i18n/, components/, pages/, admin/, services/
api/            Vercel functions — index.ts (Express app) + _lib/{app,routes,controllers,…}
server/dev.ts   Runs the same Express app locally
database/       SQL migrations / legacy scripts
android/ ios/   Capacitor projects
docs/           Setup, deployment and Android guides
```

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full map, data flow and conventions.

## Environment

All variables are documented in [`.env.example`](.env.example). Frontend values are prefixed
`VITE_`; the API reads `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `GEMINI_API_KEY`, `CRON_SECRET`. On Vercel set them in the project
settings; locally put them in `.env`.

## Deployment

- **Web + API**: Vercel. `vercel.json` rewrites `/api/(.*)` to `api/index.ts` and routes
  crawlers to `api/prerender.ts`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and
  [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md).
- **Scheduled AI review**: `.github/workflows/auto-review.yml` calls `/api/cron/auto-review`
  hourly with `CRON_SECRET`.
- **Android**: [docs/android/ANDROID_BUILD_GUIDE.md](docs/android/ANDROID_BUILD_GUIDE.md).
  Copy `android/keystore.properties.example` → `android/keystore.properties` and place the
  release keystore at `android/app/descu-release.jks`. **Signing material is git-ignored —
  keep it out of the repository.**

## Documentation

| Topic | Where |
| --- | --- |
| Architecture & conventions | `docs/ARCHITECTURE.md` |
| First-time setup, Google OAuth, admin account | `docs/setup/` |
| Database schema & migrations | `docs/setup/DATABASE_SCHEMA.md`, `database/` |
| Android build, signing, Play Store | `docs/android/` |
| Admin back-office guide | `docs/setup/ADMIN_GUIDE.md` |

## License

Proprietary — © DESCU. All rights reserved.

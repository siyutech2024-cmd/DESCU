# DESCU — Architecture

DESCU is an AI-assisted second-hand marketplace for Mexico. One repository holds the
web app, the API and the Capacitor mobile shells.

```
.
├── index.html            Vite entry (SEO meta, GTM) → src/main.tsx
├── src/                  React 18 frontend
│   ├── main.tsx          Bootstraps <App/>; chunk-reload + AbortError guards
│   ├── App.tsx           BrowserRouter: /admin/* → AdminApp (lazy), /* → marketplace
│   ├── app/              Shell: AppProviders, MarketplaceApp (routes + chrome), PageLoader
│   ├── features/         Domain logic as hooks (React Query) — no JSX except providers
│   │   ├── auth/         AuthProvider (session, OAuth hash/deep-link, login modal) + authService
│   │   ├── products/     useProducts (infinite feed), useProductFilters, useFavorites,
│   │   │                 useCreateProduct, productMapper, productsApi
│   │   ├── chat/         useConversations (query + Supabase realtime), conversationMapper
│   │   ├── orders/       useOrders (30 s polling)
│   │   └── location/     useGeolocation
│   ├── lib/              Cross-cutting utilities
│   │   ├── api/client.ts apiFetch / api.* — base URL, JSON, bearer auth, ApiError
│   │   ├── errors.ts     getErrorMessage, isAbortError, isUnauthorized
│   │   ├── queryClient.ts QueryClient defaults + queryKeys
│   │   └── toast.ts      notify.* (react-hot-toast) — the one toast API
│   ├── i18n/             LanguageProvider + locales/{zh,en,es}.ts
│   ├── contexts/         RegionContext (currency / region, syncs language)
│   ├── components/       Presentational + modal components (props in, callbacks out)
│   ├── pages/            Route-level pages (Home, Product, Profile, Chat, UserProfile, Privacy)
│   ├── admin/            Back-office SPA (own layout, auth, toaster) — separate bundle
│   ├── services/         Supabase client, chat/favorite/rating/location/gemini services
│   ├── hooks/            useDebounce, useSEO
│   └── types.ts          Shared domain types
├── api/                  Vercel serverless functions
│   ├── index.ts          Express app entry — vercel.json rewrites /api/(.*) here
│   ├── _lib/
│   │   ├── app.ts        createApp(): CORS, raw-body webhooks, JSON, registerRoutes
│   │   ├── routes/       One Router per domain (products, chat, orders, stripe, users,
│   │   │                 admin, cron, seoLocation, ratings, negotiations, system)
│   │   ├── controllers/  Request handlers shared by routes
│   │   ├── services/     auditService (AI review), translation, order notifications
│   │   ├── middleware/   requireAuth (Supabase JWT), requireAdmin
│   │   ├── lib/stripe.ts Lazy Stripe client
│   │   └── db/supabase.ts Server-side Supabase client
│   ├── prerender.ts, sitemap.ts, rss.ts, llms-full.ts, indexnow.ts   SEO functions
├── server/dev.ts         Local API server running the same Express app (npm run server)
├── database/             SQL: migrations/ (ordered), legacy/ (historic one-offs), scripts/
├── android/ ios/         Capacitor native projects (web build synced from dist/)
├── docs/                 Guides: setup/, android/, DEPLOYMENT.md, archive/
├── scripts/              Admin/ops scripts (icons, seeding, signing helpers)
└── marketing/            Store screenshots and social images
```

## Data flow

1. **UI → hooks.** Pages and components receive plain props from `MarketplaceApp`, which
   composes feature hooks. Components never talk to the network directly except through
   `@/lib/api/client` or the Supabase client.
2. **Hooks → API.** `features/*` use `@tanstack/react-query` for server state. Query keys
   live in `lib/queryClient.ts`; realtime events (Supabase channels) *invalidate* queries
   rather than mutating local copies.
3. **API client.** `api.get/post/put/patch/delete(path, body?, { auth, params, headers })`.
   `auth: 'required'` attaches the Supabase JWT and throws `ApiError(401)` when signed out;
   `'optional'` attaches it when present; `'none'` (default) never does. Non-2xx → `ApiError`
   with `.status`, `.message` (from `{error|message}`) and `.body`.
4. **Backend.** `api/index.ts` exports the Express app for Vercel. `createApp()` mounts one
   router per domain. Controllers are thin; Supabase is the database (RLS + service role).
   Stripe webhooks need the raw body — registered in `app.ts` before `express.json()`.

## Conventions

- Path alias `@/` → `src/`. Backend relative imports use `.js` extensions (ESM on Vercel;
  jest maps them back).
- TypeScript `strict` and `noUnusedLocals` are on. `any` is tolerated in legacy components
  but new code should be typed.
- Notifications go through `notify` (`@/lib/toast`). The `<Toaster/>` is mounted once in
  `AppProviders` (the admin mounts its own).
- Auth-gated actions call `requireUser(fn)` from `useAuth()` — it opens the login modal
  when signed out.
- Route table is guarded by `api/_lib/__tests__/routes.test.ts`; update `EXPECTED_ROUTES`
  deliberately when adding endpoints.

## Local development

```bash
cp .env.example .env         # fill Supabase / Stripe / Gemini keys
npm install
npm run server               # API on :3000 (tsx watch)
npm run dev                  # Vite on :5173, proxies /api → :3000
npm test                     # jest
npm run typecheck            # tsc --noEmit
```

## Mobile

`npm run android:build` builds the web app and syncs it into `android/`. Signing needs
`android/keystore.properties` (see `keystore.properties.example`) and the release keystore —
neither is tracked in git.

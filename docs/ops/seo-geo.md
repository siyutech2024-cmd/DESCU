# SEO / GEO surfaces

Everything a search engine or answer engine sees is generated server-side; the SPA only mirrors it.

| Surface | Source | Notes |
| --- | --- | --- |
| `/`, `/como-funciona`, `/buy/{category}/in/{city}`, `/product/{id}` for crawler user agents | `api/prerender.ts` (rewrites in `vercel.json`) | Static HTML + JSON-LD. `?lang=en|zh` variants; canonical + hreflang per variant. Empty landing pages are `noindex,follow`; unknown slugs 404. |
| Same URLs for people | SPA (`src/app/MarketplaceApp.tsx`, `src/hooks/useSEO.tsx`) | `?lang=` is honoured by `LanguageProvider`. `/buy/...` renders the feed with the category preselected. |
| `/sitemap.xml` | `api/sitemap.ts` | Static pages, non-empty landing pages, active products (image + hreflang). `lastmod` from data; bump `STATIC_LASTMOD` when templates change. |
| `/robots.txt`, `/llms.txt` | `public/` | AI crawler allow-list; `llms.txt` holds the quotable facts — keep in sync with `api/_lib/seo/site.ts`. |
| `/llms-full.txt`, `/rss.xml` | `api/llms-full.ts`, `api/rss.ts` | Plain-text catalog / feed. |

Shared content and facts: `api/_lib/seo/site.ts` (fee, shipping, category labels, how-it-works copy — also imported by the SPA page) and `api/_lib/seo/cities.ts` (landing-page cities and the spellings matched against `products.city/town/location_display_name`).

Adding a city: append to `SEO_CITIES` with its `patterns` (lowercase, `_` for accented letters, metro municipalities). The sitemap and landing links pick it up automatically.

Tests: `api/_lib/__tests__/seo.prerender.test.ts`.

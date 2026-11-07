# The Magnet Engine: implementation plan

Spec: `offers/conversations-workshop/2026-11-06-design.md`, sections 5 (engine) and 6 (Idea Generator). The design doc wins on any conflict. Pattern source: `apps/shortlist-report`.

## Goal

One Next.js app that any workshop attendee deploys to their own free Netlify account with one button. Every attendee runs the same code; their magnet is defined by one pasted settings block (YAML or JSON) saved from a password-protected admin page. No code or file editing.

## Facts checked in current docs (2026-11-06)

- Next.js on Netlify runs through the OpenNext adapter with zero config (`build.command = "npm run build"`, `publish = ".next"`). `next/after` is supported but bounded by the function limit.
- Synchronous function limit: **60 seconds, not configurable**. Background functions: **15 minutes**, available on the Free plan, return 202 at once, retry on error after 1 and 3 minutes.
- Netlify Blobs (`@netlify/blobs`): `getStore({ name, consistency: "strong" })`, `get(key, { type: "json" })`, `getWithMetadata` (etag), `setJSON(key, value, { onlyIfMatch, onlyIfNew })`, `list({ prefix })`, `delete`. Context is injected automatically inside Netlify functions; outside Netlify there is none.
- Deploy button: `https://app.netlify.com/start/deploy?repository=<public GitHub repo>`; `[template.environment]` in `netlify.toml` lists env vars the deployer is asked for (the value is the label). Repo must be public.
- Claude: raw HTTP `POST /v1/messages`, `anthropic-version: 2026-10-21` (no temperature), structured output via `output_config.format = { type: "json_schema", schema }` (no min/max constraints, `additionalProperties: false` everywhere). Default model `claude-sonnet-5-5` ($2 / $10 per MTok), override with `AI_MODEL`.
- Apify actors (all pay-per-event, work on the Free plan): `harvestapi~linkedin-profile-scraper` $0.004/profile, `harvestapi~linkedin-profile-posts` $0.002/post, `apify~instagram-profile-scraper` $0.0026/profile (tested on a public business account: bio, counts, link, 12 latest posts, 5 seconds). YouTube and websites are read with plain fetch at $0.

## Architecture

```
src/lib/settings.ts        zod schema + YAML/JSON parse + friendly error list
src/lib/store.ts           Netlify Blobs, or a .data/ file store when not on Netlify (dev only)
src/lib/safe-url.ts        URL validation + SSRF guard (public hosts only, manual redirects re-checked)
src/lib/sources/*.ts       website, linkedin, youtube, instagram -> one Evidence shape
src/lib/ai.ts              prompt with the quality rules, structured output, sentence guard
src/lib/jobs.ts            create report, run job (lease via etag), trigger background fn or after()
src/lib/limits.ts          per-IP rate limit, daily cap, URL de-dup
src/lib/crm.ts             opt-in webhook POST
src/app/page.tsx           live / public page (prefilled ?url=, signed &sig= skips opt-in)
src/app/r/[id]/[key]       the report link (loader while building, then the report)
src/app/admin              settings paste, build sent reports (+3 notes), signed links, list, leads
netlify/functions/build-report-background.mts   runs one job (15 min budget)
netlify/functions/cleanup.mts                    daily expiry of old reports and leads
```

Report flow: `POST /api/reports` validates the URL for the configured source, applies rate limit + daily cap, stores a `queued` record with a random link key, returns `/r/<id>/<key>`, and triggers the job (Netlify: background function, authenticated with an HMAC derived from `ADMIN_PASSWORD`; dev: `after()`). The report page polls `/api/r/<id>/<key>`.

Modes: live (no opt-in), public (`publicMode.optIn: true`, first name + email, posted to the CRM webhook), sent (admin pre-built, quiet loader, never opt-in), signed pre-filled links (admin makes them; skip opt-in).

## Quality rules (design 5.5) in the prompt

Second person; every finding answers "so what" for this reader; never describe how the report was made (no methodology, data sources, limits, AI); thin read means fewer, specific findings, never generic padding; headline, intros, buttons are fixed settings text. A code guard drops any sentence that still mentions scraping, AI, data limits or methodology.

## Security

Secrets only in env vars; `.env.example` placeholders; `.gitignore` covers `.env*` and `.data/`. No logging of keys, emails, names or URLs. Every input URL validated per source; website fetches resolve DNS once, refuse private and reserved ranges (BlockList), and pin the connection to the checked address on every redirect hop. Signatures use a random stored secret, never the admin password. React escapes all AI text (no `dangerouslySetInnerHTML` for content). Colors, pixel ids, logo and CTA URLs validated by strict patterns. Admin compare is timing-safe and rate limited.

## Steps

1. Scaffold (package.json, configs, netlify.toml, env example, gitignore). Deps: next, react, react-dom, zod, yaml, @netlify/blobs.
2. Settings schema + parser + unit tests.
3. Store + limits + safe-url + unit tests.
4. Sources (port Shortlist readers, add Instagram) + unit tests on parsers.
5. AI prompt + job runner + background function.
6. Pages: live/public, report, admin. Pixels.
7. Real runs (about 8 total): website (newsletterlabs.co), YouTube channel, LinkedIn, Instagram; measure Apify + Claude cost per report.
8. IDEA-GENERATOR.md (interview prompt pack, footprint rule, 3 worked settings blocks validated by the parser), README for beginners.
9. lint, typecheck, test, build; commit `apps/magnet-engine` only on `nichewire`; no push.

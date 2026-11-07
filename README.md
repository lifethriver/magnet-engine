# The Magnet Engine

Your own personalized lead magnet. A prospect pastes one public link (their website, LinkedIn profile, YouTube channel or Instagram profile), and in under a minute they get a custom report written to them, with your button at the end.

You never edit code. Everything a prospect sees comes from one **settings block** that the Idea Generator writes for you and you paste into your admin page.

## What you need before you start

Create these free accounts first (about 15 minutes):

1. **Netlify** at netlify.com. This is where your magnet lives. The free plan is enough.
2. **GitHub** at github.com. Netlify uses it to keep a copy of your magnet's code. You'll never need to open it.
3. **Apify** at apify.com. It reads LinkedIn and Instagram profiles for you. The free plan includes $5 of credit every month.
4. **Anthropic** at console.anthropic.com. This is the Claude AI that writes each report. Add a small prepaid credit, such as $5.
5. Optional: a domain or subdomain you own, like `report.yourbusiness.com`.

## Step 1: Deploy (one click)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/lifethriver/magnet-engine)

Click the **Deploy to Netlify** button above (it's in your workshop course too). Netlify asks you to connect GitHub, then asks for three keys:

| Box Netlify shows | What to paste | Where to find it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Claude key (starts with `sk-ant-`) | console.anthropic.com, then **API keys**, then **Create key** |
| `APIFY_TOKEN` | Your Apify token | console.apify.com, then **Settings**, then **API & Integrations** |
| `ADMIN_PASSWORD` | A password you make up, 12 or more characters | You choose it. Write it down. |

Click **Deploy**. After two or three minutes Netlify gives you an address like `https://your-magnet.netlify.app`. Open it and you'll see an "Almost there" page. That's correct: it just needs your settings.

Your keys stay in Netlify's private settings. They're never in the code and never shown to visitors.

## Step 2: Make your settings with the Idea Generator

Open `IDEA-GENERATOR.md` (it's in your workshop course too). Copy the prompt into Claude or ChatGPT and answer its questions. At the end it gives you a settings block, conversation scripts, and a build spec.

## Step 3: Paste your settings

1. Go to `https://your-magnet.netlify.app/admin`.
2. Sign in with your `ADMIN_PASSWORD`.
3. Paste the whole settings block into the box on the **Settings** tab.
4. Click **Check**. If it lists a problem, paste the message back into your Idea Generator chat and say "fix this".
5. Click **Save and go live**. Open your magnet's address and you'll see your page.

You can paste a new block any time. Reports you already sent keep their content.

## Step 4: Test it on 3 real prospects

On the **Build reports** tab, paste up to 10 prospect links (one per line) and click **Build reports**. Each takes about a minute. Open each one from the **Reports** tab and read it as if you were the prospect. If a section feels generic, make that section's `asks` more demanding in your settings (tell it to name specific videos, posts or pages), save, and click **Rebuild** on the report.

## The four ways to use your magnet

1. **Sent links (the main way).** Build a report ahead of time on the **Build reports** tab, check it, then send the link in your DM or email. The prospect sees a finished report with no forms. You can add up to 3 notes from your conversation with them (for example, their answers to 3 quick questions), and the report uses them.
2. **Pre-filled links.** On the **Pre-filled links** tab, paste prospect links to get links to your magnet with their page already filled in. Nothing is built or spent until they open it and click your button. These links also skip the email opt-in.
3. **Live page.** Share `your-magnet.netlify.app` (or add `?url=` with their link). Anyone can paste their own link and watch their report build.
4. **Public mode.** Set `publicMode: optIn: true` in your settings to ask for first name and email before the report. Each lead appears on the **Leads** tab and, if you add `crmWebhookUrl`, is sent to your CRM (GoHighLevel inbound webhook, Zapier, Make, or Kit and Beehiiv through Zapier). The webhook receives `firstName`, `email`, `magnet`, `sourceUrl`, `reportUrl` and `createdAt`.

## Protecting your credits

Every public report costs you a few cents, so the engine limits strangers:

- `limits: dailyReports` is the most public reports per day across everyone (default 20). After that, visitors see "come back tomorrow." Reports you build in the admin page don't count against it.
- `limits: perVisitorPerDay` is the most reports one visitor can start per day (default 3), and nobody can start more than 2 in 10 minutes.
- If someone asks for the same link twice in a week, they get the same report again at no cost.

## What each report costs (measured 2026-11-06)

These were real runs on the engine, on Apify's Free plan and Claude Sonnet 5.5 (`claude-sonnet-5-5`).

| Source | Apify | Claude | Total per report | Build time |
|---|---|---|---|---|
| Website | $0 (read directly) | about $0.02 | **about $0.02** | 11 seconds |
| YouTube channel | $0 (read directly) | $0.020 to $0.024 | **about $0.02** | 14 seconds |
| LinkedIn profile + 5 posts | $0.014 | about $0.02 | **about $0.035** | 16 to 18 seconds |
| Instagram profile (public only) | $0.0026 | about $0.017 | **about $0.02** | 16 seconds |

LinkedIn and Instagram are "paid sources": Apify charges per profile ($0.004 for a LinkedIn profile plus $0.002 per post read, $0.0026 per Instagram profile). Apify's free $5 monthly credit covers roughly 350 LinkedIn reports or 1,900 Instagram reports. Reading more LinkedIn posts (`linkedinPosts`, up to 30) raises the cost by $0.002 each. Website and YouTube reads are free.

Your admin page shows the actual cost of every report on the **Reports** tab.

## Connect your own domain

1. In Netlify, open your site, then **Domain management**, then **Add a domain**.
2. Type your domain or subdomain (for example `report.yourbusiness.com`) and follow the steps.
3. Netlify shows you the exact DNS record to add where you bought your domain (for a subdomain, it's usually a CNAME record pointing to `your-magnet.netlify.app`).
4. Netlify adds the secure padlock (HTTPS) for you, usually within an hour.

## Changing a key later

In Netlify, open your site, then **Site configuration**, then **Environment variables**. Edit the key, then go to **Deploys** and click **Trigger deploy** so the change takes effect. Pre-filled links you already sent keep working.

## If something goes wrong

- **The admin page says a key is missing.** Add it under Environment variables (above) and redeploy.
- **A report says "Apify is out of credit" or "Anthropic is out of credit."** Add credit in that account. Nothing else needs to change.
- **"That account is private."** Instagram reports only work on public accounts.
- **"We couldn't find enough public information."** The link was wrong or the page was empty. Check the link and try again.
- **A report never finishes.** After 8 minutes it's marked failed. Click **Rebuild** on the Reports tab.

## Rules the engine follows (so you don't have to)

- Every report is written to the reader ("you"), and every finding says what it means for them.
- It never explains how it was made, never mentions AI, data or "what we couldn't see," and never adds a methodology section.
- If there isn't much to read, the report is shorter but still specific. It never pads with generic advice.
- Your headline, section titles, intros, closing and button text appear exactly as you wrote them.
- Only read public professional, business or creator pages. Never run a private person's personal account through the tool. A human sends every message.

---

## For whoever maintains this template

Plain Next.js 16 (App Router) on Netlify through the OpenNext adapter (zero config). Dependencies: `next`, `react`, `react-dom`, `zod`, `yaml`, `@netlify/blobs`.

- **Storage:** Netlify Blobs store `magnet-engine` (strong consistency). Keys: `settings/current`, `secret/signing`, `report/<id>`, `lead/<id>`, `url/<hash>`, `count/...`. Off Netlify, `npm run dev` uses a git-ignored `.data/` folder; a production build off Netlify refuses to start storage unless `MAGNET_LOCAL_STORE=1`.
- **Jobs:** `/api/reports` and the admin build route create a record and call the background function `netlify/functions/build-report-background.mts` (15 minute limit; ordinary Netlify functions stop at 60 seconds), signed with the site's signing secret. Off Netlify the job runs in `next/after`. A lease token stops two workers spending credits on one report.
- **Secrets and limits:** `secret/signing` is a random 32-byte key the site creates on first use (`onlyIfNew`) and uses for pre-filled link signatures, job signatures and hashed visitor IPs; nothing is derived from `ADMIN_PASSWORD` (minimum 12 characters). Visitor limits key IPv6 by /64. Opt-ins have their own limit (3 per 10 minutes, 10 per day per visitor), taken before a lead is saved or sent. Admin sign-in allows 10 wrong passwords per visitor and 50 site-wide per 15 minutes.
- **Cleanup:** `netlify/functions/cleanup.mts` runs daily and deletes reports and leads older than `keepReportsDays`, plus old counters.
- **Sources:** `src/lib/sources/`. Website (`safe-fetch.ts`: http/https only, default ports, the name is resolved once, every address is checked against a `node:net` BlockList of private, loopback, link-local, CGNAT, multicast, reserved, NAT64, 6to4, Teredo and IPv4-mapped ranges, and the connection is pinned to the checked address with a custom `lookup`, on every redirect hop; HTML is stripped in one linear pass), YouTube (Videos page; the public `feeds/videos.xml` feed is used when it answers, and it returned 404 on 2026-11-06), LinkedIn (`harvestapi~linkedin-profile-scraper` + `harvestapi~linkedin-profile-posts`), Instagram (`apify~instagram-profile-scraper`, read 4 of 4 public business accounts in testing, 5 to 19 seconds).
- **AI:** `src/lib/ai.ts`, raw HTTP to `/v1/messages` with `anthropic-version: 2026-10-21`, a JSON schema in `output_config.format`, effort `medium`, and server-side refusal fallback on Sonnet/Opus. A sentence filter removes anything that describes the process. Override the model with the optional `AI_MODEL` env var.
- **Settings:** `src/lib/settings.ts` (zod, strict, friendly errors). `npm run check-settings -- examples/*.yaml` validates blocks; a unit test keeps the three blocks in `IDEA-GENERATOR.md` and `examples/` valid and identical.
- **Deploy button:** the public template repo is https://github.com/lifethriver/magnet-engine. The button URL is `https://app.netlify.com/start/deploy?repository=https://github.com/lifethriver/magnet-engine`; `netlify.toml` `[template.environment]` makes Netlify ask for the three keys (each value is the hint label shown next to the box, never a default).

```
npm install
cp .env.example .env.local   # fill in your own keys
npm run dev                  # http://localhost:3000, admin at /admin
npm test && npm run typecheck && npm run lint && npm run build
```

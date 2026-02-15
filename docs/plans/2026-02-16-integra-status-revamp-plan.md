# Integra Status Revamp — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite integra-status from vanilla SPA to Next.js 15 + Tailwind v4 + shadcn/ui with Integra branding, wow animations, inline troubleshooting, and @IntegraWatchBot Telegram alerts.

**Architecture:** Next.js App Router with SSR (revalidate: 30s), health check engine ported from existing JS to TypeScript, Vercel Cron + KV for Telegram bot state management. All 76 endpoints enriched with descriptions, links, and commonIssues.

**Tech Stack:** Next.js 15, TypeScript, Tailwind v4, shadcn/ui, Vercel KV, Telegram Bot API, Integra brand kit (Euclid Circular B, Geist Mono, coral-pink gradients)

**Design doc:** `docs/plans/2026-02-16-integra-status-revamp-design.md`

---

### Task 1: Scaffold Next.js project

**Files:**
- Create: `package.json` (overwrite existing)
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`
- Create: `app/globals.css`
- Create: `app/layout.tsx`
- Create: `app/page.tsx` (placeholder)
- Create: `tailwind.config.ts`
- Delete: `server.js` (no longer needed)
- Delete: `public/index.html` (replaced by Next.js)
- Delete: `public/app.js` (replaced by React components)
- Delete: `public/style.css` (replaced by Tailwind)

**Step 1: Initialize Next.js with TypeScript + Tailwind**

```bash
cd /Users/adamboudj/projects/integra-status
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm --yes
```

Note: This will conflict with existing files. Before running, move old files:
```bash
mkdir -p _old
mv server.js public/index.html public/app.js public/style.css _old/
```

**Step 2: Install additional dependencies**

```bash
npm install @vercel/kv lucide-react
npm install -D @tailwindcss/postcss
```

**Step 3: Copy Integra brand kit**

Copy `globals.css` from `/Users/adamboudj/projects/integra-brand/kit/globals.css` to `app/globals.css`.
Copy `integra-logo.tsx` from `/Users/adamboudj/projects/integra-brand/kit/integra-logo.tsx` to `components/integra-logo.tsx`.
Copy logo SVGs from `/Users/adamboudj/projects/integra-brand/public/logos/` to `public/logos/`.

**Step 4: Set up postcss.config.mjs**

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

**Step 5: Create root layout with Integra fonts**

`app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const euclidCircularB = localFont({
  src: [
    { path: "../public/fonts/EuclidCircularB-Regular.woff2", weight: "400" },
    { path: "../public/fonts/EuclidCircularB-Medium.woff2", weight: "500" },
    { path: "../public/fonts/EuclidCircularB-Semibold.woff2", weight: "600" },
    { path: "../public/fonts/EuclidCircularB-Bold.woff2", weight: "700" },
  ],
  variable: "--font-sans",
});

const geistMono = localFont({
  src: "../public/fonts/GeistMono-Regular.woff2",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Integra Status",
  description: "Real-time infrastructure status for Integra Layer",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${euclidCircularB.variable} ${geistMono.variable}`}>
      <body className="bg-surface font-sans text-text antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-brand focus:text-white focus:rounded">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
```

**Step 6: Create placeholder page**

`app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main id="main" className="min-h-screen flex items-center justify-center">
      <h1 className="text-3xl font-semibold">Integra Status</h1>
    </main>
  );
}
```

**Step 7: Verify build**

```bash
npm run build
npm run dev
```
Expected: Next.js dev server starts, shows "Integra Status" at localhost:3000

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 + Tailwind v4 + Integra brand kit"
```

---

### Task 2: Port TypeScript types and health config

**Files:**
- Create: `lib/types.ts`
- Create: `lib/health-config.ts` (port from `_old/` or existing `lib/health-config.js`)
- Keep: `lib/health-config.js` in `_old/` for reference

**Step 1: Define TypeScript types**

`lib/types.ts`:
```typescript
export type CheckType =
  | "evm-rpc"
  | "cosmos-rpc"
  | "cosmos-rest"
  | "http-json"
  | "http-get"
  | "websocket"
  | "api-health"
  | "http-reachable"
  | "deep-health"
  | "graphql"
  | "cosmos-peer-check";

export type Status = "UP" | "DOWN" | "DEGRADED";
export type Category = "blockchain" | "validators" | "apis" | "frontends" | "external";
export type Environment = "prod" | "dev" | "staging" | "release";

export type Owner = {
  name: string;
  role: string;
  contact: string;
};

export type CommonIssue = {
  cause: string;
  fix: string;
};

export type Endpoint = {
  id: string;
  name: string;
  description: string;
  richDescription: string;
  category: Category;
  environment: Environment;
  checkType: CheckType;
  url: string;
  timeout: number;
  enabled: boolean;
  expectedChainId?: string;
  healthUrl?: string;
  peerIp?: string;
  publicRpc?: string;
  links: {
    endpoint: string;
    docs?: string;
    repo?: string;
  };
  commonIssues: CommonIssue[];
  dependsOn: string[];
  impacts: string[];
  impactDescription?: string;
  owner: Owner;
  tags: string[];
};

export type AppGroup = {
  id: string;
  name: string;
  icon: string;
  description: string;
  endpoints: string[];
};

export type CheckResult = {
  id: string;
  name: string;
  url: string;
  category: Category;
  environment: Environment;
  status: Status;
  responseTimeMs: number;
  timestamp: string;
  details: Record<string, unknown>;
  error: string | null;
  dependsOn: string[];
  impacts: string[];
  impactDescription: string | null;
  description: string | null;
  richDescription: string | null;
  owner: Owner | null;
  links: { endpoint: string; docs?: string; repo?: string };
  commonIssues: CommonIssue[];
  tags: string[];
};

export type HealthSummary = {
  timestamp: string;
  total: number;
  up: number;
  degraded: number;
  down: number;
  appGroups: AppGroup[];
  dependencyGraph: Record<string, { dependsOn: string[]; requiredBy: string[] }>;
  impactMap: Record<string, Array<{ id: string; name: string }>>;
  results: CheckResult[];
  history: {
    sparklines: Record<string, (number | null)[]>;
    uptimes: Record<string, number>;
    incidents: Array<{ id: string; fromStatus: string; toStatus: string; at: number }>;
    dataPoints: number;
    spanMinutes: number;
  };
};
```

**Step 2: Port health-config.js to TypeScript**

Convert `lib/health-config.js` → `lib/health-config.ts`. Key changes:
- Add types to all endpoint objects
- Add `links` field (map `docsUrl`/`repoUrl` to `links.docs`/`links.repo`, set `links.endpoint` to `url`)
- Add `commonIssues` array to each endpoint (2-3 items per endpoint based on its checkType and description)
- Export typed functions

This is a large file (~300 lines). Port mechanically — each endpoint gets:
```typescript
links: {
  endpoint: ep.url,
  docs: ep.docsUrl || undefined,
  repo: ep.repoUrl || undefined,
},
commonIssues: [
  // 2-3 relevant causes based on the endpoint type and infrastructure
],
```

**Step 3: Verify types compile**

```bash
npx tsc --noEmit
```
Expected: No type errors

**Step 4: Commit**

```bash
git add lib/types.ts lib/health-config.ts
git commit -m "feat: add TypeScript types and port health config with commonIssues"
```

---

### Task 3: Port health check engine to TypeScript

**Files:**
- Create: `lib/health.ts` (port from `lib/health.js`)
- Create: `lib/history.ts` (port from `lib/history.js`)

**Step 1: Port health.ts**

Convert `lib/health.js` → `lib/health.ts`. Key changes:
- Replace `require('http')` / `require('https')` with `import`
- Use native `fetch` instead of raw http/https (Next.js 15 has enhanced fetch)
- Type all function signatures with `Endpoint` and `CheckResult`
- Keep all 11 check types: `checkEvmRpc`, `checkCosmosRpc`, `checkCosmosRest`, `checkHttpJson`, `checkHttpGet`, `checkWebsocket`, `checkApiHealth`, `checkHttpReachable`, `checkDeepHealth`, `checkGraphql`, `checkCosmosPeer`
- Port `result()` builder to include new fields (`links`, `commonIssues`, `richDescription`)

Important: The existing `httpRequest` uses Node.js `http`/`https` with `rejectUnauthorized: false`. When porting to `fetch`, use a custom agent or keep the Node.js approach for server-side only. Since this runs in Route Handlers (Node.js runtime), keep the http/https approach but with TypeScript types.

**Step 2: Port history.ts**

Convert `lib/history.js` → `lib/history.ts`. Key changes:
- Type the history data structure
- Keep `/tmp/integra-history.json` persistence (works on Vercel serverless)
- Type `recordSnapshot`, `getSparklines`, `getUptimes`, `getIncidents`

**Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add lib/health.ts lib/history.ts
git commit -m "feat: port health check engine and history to TypeScript"
```

---

### Task 4: Create health API route

**Files:**
- Create: `app/api/health/route.ts`

**Step 1: Create the route handler**

Port `api/health.js` → `app/api/health/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { checkAll } from "@/lib/health";
import { getEndpoint, getImpactedServices, APP_GROUPS } from "@/lib/health-config";
import { loadHistory, saveHistory, recordSnapshot, getSparklines, getUptimes, getIncidents } from "@/lib/history";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const envFilter = searchParams.get("env");
  const catFilter = searchParams.get("category");

  const opts: Record<string, string> = {};
  if (envFilter) opts.environment = envFilter;
  if (catFilter) opts.category = catFilter;

  const results = await checkAll(opts);

  // Build impact map
  const impactMap: Record<string, Array<{ id: string; name: string }>> = {};
  for (const r of results) {
    if (r.status === "DOWN" || r.status === "DEGRADED") {
      const impacted = getImpactedServices(r.id);
      if (impacted.length > 0) {
        impactMap[r.id] = impacted.map((id) => {
          const ep = getEndpoint(id);
          return { id, name: ep ? ep.name : id };
        });
      }
    }
  }

  // Record history
  let hist = loadHistory();
  hist = recordSnapshot(hist, results);
  saveHistory(hist);

  const sparklines = getSparklines(hist);
  const uptimes = getUptimes(hist);
  const incidents = getIncidents(hist);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    total: results.length,
    up: results.filter((r) => r.status === "UP").length,
    degraded: results.filter((r) => r.status === "DEGRADED").length,
    down: results.filter((r) => r.status === "DOWN").length,
    appGroups: APP_GROUPS,
    impactMap,
    results,
    history: {
      sparklines,
      uptimes,
      incidents,
      dataPoints: hist.snapshots.length,
      spanMinutes: hist.snapshots.length > 1
        ? Math.round((hist.snapshots[hist.snapshots.length - 1].t - hist.snapshots[0].t) / 60000)
        : 0,
    },
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "s-maxage=10, stale-while-revalidate=20",
    },
  });
}
```

**Step 2: Test locally**

```bash
npm run dev
# Visit http://localhost:3000/api/health
```
Expected: JSON response with all endpoint statuses, sparklines, uptimes

**Step 3: Commit**

```bash
git add app/api/health/route.ts
git commit -m "feat: add health API route handler"
```

---

### Task 5: Build core UI components

**Files:**
- Create: `components/header.tsx`
- Create: `components/summary-bar.tsx`
- Create: `components/status-badge.tsx`
- Create: `components/sparkline.tsx`
- Create: `components/endpoint-links.tsx`
- Create: `components/troubleshooting-hint.tsx`
- Create: `components/footer.tsx`

**Step 1: Initialize shadcn/ui**

```bash
npx shadcn@latest init --defaults
npx shadcn@latest add badge card button tooltip input
```

**Step 2: Build header component**

`components/header.tsx` — Integra logo + "Infrastructure Status" + last-checked time + refresh countdown pill with pulsing dot. Brand gradient bottom border (1px, animated 8s shift).

**Step 3: Build summary bar**

`components/summary-bar.tsx` — Sticky bar below header. Three pills (operational/degraded/down) with counter roll-up animation. Overall status text. Glassmorphism: `backdrop-blur-xl bg-white/70`. Status-tinted subtle background wash.

**Step 4: Build status badge**

`components/status-badge.tsx` — UP (green-to-emerald gradient), DEGRADED (amber gradient), DOWN (red-to-crimson gradient). Includes text label (never color-only).

**Step 5: Build sparkline**

`components/sparkline.tsx` — Client component (`'use client'`). Inline SVG with `stroke-dashoffset` draw-in animation (800ms). Hover shows crosshair + floating tooltip pill with value/timestamp. Handles -1 for DOWN values (dip visualization). `will-change: stroke-dashoffset`.

**Step 6: Build endpoint links**

`components/endpoint-links.tsx` — Three icon links (ExternalLink, BookOpen, Github from lucide-react). Slide-in on hover (opacity 0→1, translateX 8→0). Copy URL button with checkmark morph.

**Step 7: Build troubleshooting hint**

`components/troubleshooting-hint.tsx` — Warm-toned box (amber-50 bg, amber-200 border). Shows "Possible causes:" with bullet list from `commonIssues`. Only renders when status is DOWN or DEGRADED.

**Step 8: Build footer**

`components/footer.tsx` — "Monitoring {N} endpoints across {M} categories" + Integra mark + auto-refresh indicator.

**Step 9: Verify build**

```bash
npm run build
```

**Step 10: Commit**

```bash
git add components/
git commit -m "feat: add core UI components with animations and Integra branding"
```

---

### Task 6: Build endpoint card and category section

**Files:**
- Create: `components/endpoint-card.tsx`
- Create: `components/category-section.tsx`

**Step 1: Build endpoint card**

`components/endpoint-card.tsx` — The core UI unit. Contains:
- Status dot (pulsing: green 2s, red 1s)
- Name (semibold) + human-readable description
- Response time in mono font
- Sparkline
- Endpoint links (slide-in on hover)
- Troubleshooting hint (when DOWN/DEGRADED)
- Hover: `translateY(-2px)` + shadow elevation (200ms ease)
- State change flash: red glow on DOWN, green shimmer on recovery
- Link to `/service/[id]` detail page
- Staggered entrance: fade-in + slide-up, 50ms stagger (capped 1s total)

**Step 2: Build category section**

`components/category-section.tsx` — Client component for collapse/expand. Contains:
- Category icon + name + "X/Y operational" counter
- 4px left border colored by worst status
- Chevron with 180° rotation (spring physics via CSS)
- Slide-down expand animation
- List of endpoint cards

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add components/endpoint-card.tsx components/category-section.tsx
git commit -m "feat: add endpoint card and collapsible category section"
```

---

### Task 7: Build search and filter bar

**Files:**
- Create: `components/search-bar.tsx`

**Step 1: Build search + filter**

`components/search-bar.tsx` — Client component:
- Full-width input: "Search {N} endpoints..."
- Focus: width expand + brand gradient bottom border fade-in
- Debounced 200ms search matching id/name/description/tags
- Category filter chips below (Blockchain, Validators, Backend, Frontend, External)
- Active chips: brand gradient border with slow gradient rotation (4s)
- Keyboard: '/' focuses search, Escape clears

**Step 2: Commit**

```bash
git add components/search-bar.tsx
git commit -m "feat: add search bar with debounce and category filter chips"
```

---

### Task 8: Build dashboard page

**Files:**
- Modify: `app/page.tsx`

**Step 1: Implement dashboard page**

`app/page.tsx` — Server component that:
1. Fetches health data from `/api/health` (internal fetch, revalidates every 30s)
2. Computes summary counts
3. Renders: Header → Summary Bar → Search/Filters → Category Sections → Footer
4. Wraps interactive parts in a client `<DashboardClient>` component that receives server data as props

**Step 2: Create client wrapper**

`components/dashboard-client.tsx` — Client component that handles:
- Search state and filtering
- Category collapse state
- Auto-refresh countdown (30s timer, refetches via `router.refresh()`)
- Staggered card entrance animation triggers
- Toast notifications for status changes
- Scroll progress bar (thin brand-gradient at top)

**Step 3: Add loading skeleton**

`app/loading.tsx` — Skeleton shimmer cards with brand pink-light gradient sweep. Matches layout structure.

**Step 4: Verify locally**

```bash
npm run dev
# Visit http://localhost:3000
```
Expected: Full dashboard with live health data, search, filters, animations

**Step 5: Commit**

```bash
git add app/page.tsx app/loading.tsx components/dashboard-client.tsx
git commit -m "feat: implement dashboard page with SSR health data and client interactivity"
```

---

### Task 9: Build service detail page

**Files:**
- Create: `app/service/[id]/page.tsx`
- Create: `components/dependency-graph.tsx`
- Create: `components/incident-timeline.tsx`

**Step 1: Build detail page**

`app/service/[id]/page.tsx` — Server component:
- Fetches health data, finds endpoint by ID
- Full metadata card: name, description (richDescription), owner, tags, environment
- Large sparkline (last 100 points)
- Response time stats (avg, min, max, p99)
- Direct links section (endpoint, docs, repo)
- Troubleshooting section (always visible, shows all commonIssues)
- Dependency graph
- Incident timeline
- Back button → dashboard

**Step 2: Build dependency graph**

`components/dependency-graph.tsx` — SVG visualization:
- Center node = current endpoint
- Left = dependsOn (upstream)
- Right = requiredBy (downstream)
- Color-coded by current status
- Clickable nodes → navigate to that service's detail page
- Animated edges on load

**Step 3: Build incident timeline**

`components/incident-timeline.tsx` — Vertical timeline:
- Status dots connected by vertical line
- Timestamp + "UP → DOWN" transition labels
- Color-coded dots (green/amber/red)
- "Show more" pagination (5 at a time)

**Step 4: Verify locally**

```bash
npm run dev
# Visit http://localhost:3000/service/mainnet-evm-rpc
```

**Step 5: Commit**

```bash
git add app/service/ components/dependency-graph.tsx components/incident-timeline.tsx
git commit -m "feat: add service detail page with dependency graph and incident timeline"
```

---

### Task 10: Add CSS animations and visual effects

**Files:**
- Modify: `app/globals.css`
- Create: `lib/animations.ts` (animation utility constants)

**Step 1: Add keyframe animations to globals.css**

Add to `app/globals.css`:
- `@keyframes pulse-green` — 2s infinite, for UP dots
- `@keyframes pulse-red` — 1s infinite, for DOWN dots
- `@keyframes shimmer` — skeleton loading sweep
- `@keyframes gradient-shift` — 8s header border gradient animation
- `@keyframes fade-slide-up` — card entrance (opacity 0→1, translateY 12→0)
- `@keyframes glow-red` — state change flash (box-shadow pulse)
- `@keyframes shimmer-green` — recovery sweep (background gradient left→right)
- `@keyframes gradient-rotate` — active filter chip border rotation
- `@keyframes draw-sparkline` — stroke-dashoffset for sparkline SVG
- `@keyframes counter-rollup` — for animated numbers (CSS @property)
- `@keyframes scroll-progress` — thin bar at top
- Tailwind utility classes for each animation
- `@media (prefers-reduced-motion: reduce)` — disable all non-essential animations

**Step 2: Add CSS @property for animated numbers**

```css
@property --num {
  syntax: "<integer>";
  initial-value: 0;
  inherits: false;
}
```

**Step 3: Create animation constants**

`lib/animations.ts` — export stagger delay calculation, spring easing curves, duration constants.

**Step 4: Verify animations work**

```bash
npm run dev
```
Check: card entrance stagger, sparkline draw, hover lifts, gradient effects

**Step 5: Commit**

```bash
git add app/globals.css lib/animations.ts
git commit -m "feat: add keyframe animations, gradients, and reduced-motion support"
```

---

### Task 11: Implement Telegram bot

**Files:**
- Create: `lib/telegram.ts`
- Create: `app/api/cron/route.ts`
- Modify: `vercel.json` (add cron schedule)

**Step 1: Create Telegram module**

`lib/telegram.ts`:
- `sendMessage(chatId, text, parseMode)` — POST to Telegram Bot API
- `formatAlert(transition, endpoint, result)` — format alert message with emoji, details, causes, link
- `formatDailyDigest(summary)` — format "All operational" or "N endpoints degraded" summary
- `formatGroupedAlert(transitions)` — combine multiple transitions into one message
- Rate limiting: max 30 messages/second (Telegram limit)

**Step 2: Create cron route handler**

`app/api/cron/route.ts`:
- `export const runtime = "nodejs"`
- Fetch `/api/health` (internal)
- Load previous state from Vercel KV (`status:{id}`)
- Compare: detect transitions (UP→DOWN, DOWN→UP, etc.)
- Flap protection: check `flap:{id}` counter, suppress if >3 in 5min
- Group alerts: if multiple transitions, send one grouped message
- Recovery delay: only send recovery after 2 consecutive UP checks
- Daily digest: check `digest:last`, send at 08:00 UTC if due
- Save new state to KV

**Step 3: Update vercel.json**

```json
{
  "crons": [{ "path": "/api/cron", "schedule": "* * * * *" }],
  "functions": {
    "app/api/health/route.ts": { "maxDuration": 30 },
    "app/api/cron/route.ts": { "maxDuration": 30 }
  }
}
```

**Step 4: Test locally with mock KV**

For local dev, create a simple in-memory KV mock. Test transition detection logic manually by comparing two health check results.

**Step 5: Commit**

```bash
git add lib/telegram.ts app/api/cron/route.ts vercel.json
git commit -m "feat: add Telegram bot with Vercel Cron, flap protection, and daily digest"
```

---

### Task 12: Update vercel.json, CLAUDE.md, and deploy config

**Files:**
- Modify: `vercel.json`
- Modify: `CLAUDE.md`
- Modify: `package.json`
- Delete: `_old/` directory

**Step 1: Update vercel.json for Next.js**

Replace the old static-site vercel.json with Next.js-compatible config including cron.

**Step 2: Update CLAUDE.md**

Update to reflect new Next.js stack, new file structure, new commands:
```markdown
# Integra Status Page

Real-time infrastructure status page for Integra Layer.

**Stack**: Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui
**Deployed**: Vercel (status.integralayer.com)

## Structure
[new structure]

## Development
npm run dev    # localhost:3000
npm run build  # production build

## Environment Variables
TELEGRAM_BOT_TOKEN  — @IntegraWatchBot token
TELEGRAM_CHANNEL_ID — Alert channel ID
KV_REST_API_URL     — Vercel KV endpoint
KV_REST_API_TOKEN   — Vercel KV auth token
```

**Step 3: Clean up old files**

```bash
rm -rf _old/
```

**Step 4: Verify full build**

```bash
npm run build
```
Expected: Clean build, all pages render

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: update project config, docs, and clean up old vanilla files"
```

---

### Task 13: Deep UI review

**Files:** All component files

**Step 1: Run deep UI review**

Use the `deep-ui-review:ui-review` skill/agent to audit the entire project:
- Accessibility (WCAG AA+)
- Color contrast
- Typography
- Spacing/layout
- Keyboard navigation
- Screen reader compatibility
- Responsive design
- Performance
- Design system consistency

**Step 2: Fix findings**

Address all critical and high-severity findings from the audit.

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: address UI review findings — accessibility, contrast, responsiveness"
```

---

### Task 14: Deploy and verify

**Step 1: Set environment variables on Vercel**

```bash
vercel env add TELEGRAM_BOT_TOKEN
vercel env add TELEGRAM_CHANNEL_ID
vercel env add KV_REST_API_URL
vercel env add KV_REST_API_TOKEN
```

**Step 2: Deploy to Vercel**

```bash
vercel --prod
```

**Step 3: Verify live site**

- Visit https://status.integralayer.com
- Check all categories load with health data
- Click through to service detail pages
- Test search and filter chips
- Test responsive layout (mobile/tablet/desktop)
- Verify animations play correctly
- Check accessibility with browser dev tools

**Step 4: Test Telegram bot**

- Wait for cron to fire (1 minute)
- Check Telegram channel for daily digest or status messages
- Manually take down a test endpoint and verify alert arrives

**Step 5: Commit any deploy fixes**

```bash
git add -A
git commit -m "fix: deploy adjustments"
```

**Step 6: Push and create PR**

```bash
git push origin feature/integra-status-revamp
gh pr create --title "Integra Status Revamp — Next.js + Telegram Bot" --body "Full rewrite..."
```

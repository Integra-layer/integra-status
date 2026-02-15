# Integra Status Revamp — Design Document

**Date:** 2026-02-16
**Status:** Approved
**Author:** Adam Boudj

## Overview

Full rewrite of integra-status from vanilla HTML/JS/CSS SPA to Next.js 15 + Tailwind v4 + shadcn/ui. Adds Integra branding, inline troubleshooting hints, endpoint links, wow-factor animations, and a Telegram alert bot (@IntegraWatchBot).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Stack | Next.js 15 + Tailwind v4 + shadcn/ui | Matches Integra ecosystem (Connect, Explorer, HazeLab) |
| Bot architecture | Vercel Cron + Telegram API | Zero extra infra, everything in one Vercel project |
| Alert target | Telegram Channel | Professional, subscribable, scales beyond one person |
| Troubleshooting | Inline hints per endpoint | Immediate context when something is down, no navigation |
| Approach | Full rewrite (not incremental) | Codebase is small (~4K LOC), clean port is faster |

## Architecture

### Project Structure

```
integra-status/
├── app/
│   ├── layout.tsx              # Root: Euclid Circular B, metadata, Integra brand
│   ├── page.tsx                # Dashboard overview (SSR, revalidate: 30)
│   ├── service/
│   │   └── [id]/
│   │       └── page.tsx        # Service detail with troubleshooting
│   ├── api/
│   │   ├── health/
│   │   │   └── route.ts        # Health check engine (port existing logic)
│   │   └── cron/
│   │       └── route.ts        # Vercel Cron: poll, compare, Telegram alerts
│   └── globals.css             # Integra brand kit drop-in (Tailwind v4 @theme)
├── components/
│   ├── header.tsx              # Logo + title + last-checked + refresh countdown
│   ├── summary-bar.tsx         # Sticky: X up / Y degraded / Z down pills
│   ├── category-section.tsx    # Collapsible category card with status border
│   ├── endpoint-card.tsx       # Status dot, name, description, sparkline, response time
│   ├── troubleshooting-hint.tsx # Inline causes + fixes (shown on DOWN/DEGRADED)
│   ├── dependency-graph.tsx    # SVG blast radius visualization
│   ├── sparkline.tsx           # Inline SVG sparkline with draw animation
│   ├── search-bar.tsx          # Debounced search + category filter chips
│   ├── status-badge.tsx        # UP/DOWN/DEGRADED with semantic colors
│   ├── endpoint-links.tsx      # Direct links: endpoint URL, docs, repo
│   └── footer.tsx              # "Monitoring 76 endpoints" + Integra mark
├── lib/
│   ├── health-config.ts        # Typed endpoint registry (76 endpoints)
│   ├── health.ts               # 11 check type implementations
│   ├── history.ts              # Ring buffer for sparkline data
│   ├── types.ts                # TypeScript types
│   └── telegram.ts             # Bot API: sendMessage, formatAlert, rate limiting
├── public/
│   ├── favicon.ico
│   └── logos/
├── vercel.json                 # Cron schedule
├── next.config.ts
├── tsconfig.json
└── package.json
```

### Key Architectural Decisions

- **Server Components by default** — dashboard fetches health data server-side, streams to client
- **`revalidate: 30`** — ISR revalidates every 30 seconds for near-fresh data
- **Client components** only for search, sparkline hover, category collapse (`'use client'`)
- **Vercel Cron** schedules `/api/cron` every 60 seconds for bot alerts
- **Vercel KV** (Redis) stores bot state for transition detection

## UI Design

### Layout

- **Header:** Integra mark (40px) + "Infrastructure Status" semibold + last-checked time + auto-refresh countdown pill with pulsing dot. Subtle brand gradient bottom border (1px).
- **Summary Bar (sticky):** Three pills — operational (green) / degraded (warning) / down (danger). Overall status text. Glassmorphism background with status-tinted wash.
- **Search + Filters:** Full-width input + category filter chips with brand gradient active state.
- **Category Sections:** Collapsible cards with icon + name + "X/Y operational" counter. 4px left border colored by worst status.
- **Endpoint Cards:** Status dot (pulsing) + name (semibold) + description + response time (mono) + sparkline. Link icons reveal on hover. Troubleshooting hints appear inline when DOWN/DEGRADED.
- **Footer:** Endpoint count + "Powered by Integra" + auto-refresh indicator.

### Service Detail Page (`/service/[id]`)

- Full metadata card
- Large sparkline (last 100 checks)
- Dependency graph (depends on / impacts)
- Incident timeline (recent state changes)
- Owner info + direct links
- Troubleshooting section (always visible)

### Responsive Breakpoints

- **Mobile (<640px):** Single column, stacked cards, search collapses, sticky summary
- **Tablet (640-1024px):** Two-column endpoint grid
- **Desktop (1024px+):** Full layout with optional sidebar category nav

## Visual Effects & Animations

### Entrance

- **Staggered card reveal:** fade-in + slide-up, 50ms stagger per card (cascade waterfall)
- **Counter roll-up:** summary numbers animate 0 → actual (600ms ease-out)
- **Sparkline draw-in:** `stroke-dashoffset` animation right-to-left (800ms)
- **Category expand:** slide down with spring easing

### Status Transitions

- **Status dot pulse:** green 2s infinite, red 1s (faster = attention)
- **State change flash:** UP→DOWN card gets red glow border pulse (1.5s)
- **Recovery shimmer:** DOWN→UP green shimmer sweep left-to-right
- **Digit morphing:** response time numbers morph via CSS `@property`

### Hover & Interaction

- **Card lift:** `translateY(-2px)` + shadow elevation (200ms ease)
- **Sparkline tooltip:** crosshair + floating pill with value/timestamp
- **Link icons slide-in:** opacity 0→1, translateX 8→0 on card hover
- **Active filter chips:** brand gradient border with slow gradient rotation (4s)
- **Search focus:** width expand + gradient bottom border fade-in

### Gradients

- **Header border:** animated brand gradient (slow shift, 8s loop)
- **Summary glassmorphism:** backdrop-blur(12px) + semi-transparent surface + status tint
- **Down cards:** left border pulses danger red ↔ dark red
- **Status badges:** green-to-emerald / red-to-crimson gradients
- **Page background:** subtle radial gradient (brand pink at 2% opacity)

### Loading

- **Skeleton shimmer:** brand pink-light gradient sweep left→right
- **Refresh ring:** circular progress fills over 30s, brand-gradient flash on reset
- **First load:** Integra mark fade-in at center, dissolves into dashboard

### Micro-interactions

- **Collapse chevron:** 180° rotation with spring physics
- **Toasts:** slide-in from bottom-right with bounce, auto-dismiss with shrinking progress bar
- **Copy URL:** button morphs to checkmark with green flash
- **Scroll progress:** thin brand-gradient bar at page top

### Performance

- All animations use `transform` + `opacity` only (GPU-composited)
- `prefers-reduced-motion: reduce` disables non-essential animations
- Stagger delays capped at 1s total
- `will-change` applied judiciously on animated SVGs

## Telegram Bot (@IntegraWatchBot)

### Architecture

Two entry points:
1. **Vercel Cron** (`/api/cron`) — runs every 60s, detects transitions, pushes alerts to channel
2. **Webhook** (`/api/telegram/webhook`) — receives user commands and button callbacks

### Bot Commands

| Command | Description | Response |
|---------|-------------|----------|
| `/status` | Full status overview | Summary card with inline keyboard buttons per category |
| `/check <name>` | Check specific endpoint | Detailed card with sparkline ASCII, response time, links |
| `/category <name>` | List endpoints in category | Category card with status dots per endpoint + buttons |
| `/down` | List all DOWN endpoints | List with causes and fix suggestions |
| `/degraded` | List all DEGRADED endpoints | List with warnings and details |
| `/subscribe` | Subscribe to alerts (DM) | Confirms subscription, stores chat ID in KV |
| `/unsubscribe` | Unsubscribe from alerts | Confirms removal |
| `/help` | Command list + bot info | Formatted help card with all commands |
| `/ping` | Bot health check | "Pong! Latency: Xms" |

### Inline Keyboards

**Status overview buttons:**
```
[ 🟢 Blockchain (8/8) ] [ ⚡ Validators (4/4) ]
[ 🔧 Backend (10/12)  ] [ 🌐 Frontend (15/17) ]
[ 🔗 External (11/11) ] [ 🔄 Refresh          ]
```

**Category drill-down buttons:**
```
[ Mainnet EVM RPC 🟢     ] [ Mainnet Cosmos RPC 🟢  ]
[ Testnet EVM RPC 🟡     ] [ Explorer GraphQL 🟢    ]
[ ◀ Back to Overview     ] [ 🔄 Refresh             ]
```

**Endpoint detail buttons:**
```
[ 🔗 Open Endpoint ] [ 📄 Docs ] [ 💻 Repo ]
[ ◀ Back to Category ] [ 🔄 Re-check ]
```

### Message Design (HTML parse mode)

**Status Overview:**
```
⬡ <b>Integra Infrastructure Status</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 <b>42</b> Operational
🟡 <b>2</b> Degraded
🔴 <b>1</b> Down
━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱ Updated: 02:15 UTC
📊 Uptime (1h): 98.7%

Select a category below for details.
```

**Alert Message:**
```
🔴 <b>DOWN: Mainnet EVM RPC</b>

⏱ Detected: 2026-02-16 02:15:00 UTC
📍 <code>https://adamboudj.integralayer.com/rpc</code>
📂 Category: Blockchain
⏳ Response: timeout

━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 <b>Possible causes:</b>
  • intgd service stopped or crashed
  • Disk full on validator EC2
  • Node fell behind sync

⚠️ <b>Impact:</b> Explorer v2 loses EVM data
━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 <a href="https://status.integralayer.com">Status Page</a>
```

**Recovery Message:**
```
🟢 <b>RECOVERED: Mainnet EVM RPC</b>

⏱ Recovered: 2026-02-16 02:19:32 UTC
⏳ Downtime: <b>4m 32s</b>
📈 Response: 142ms

━━━━━━━━━━━━━━━━━━━━━━━━━━
All systems operational ✓
```

**Daily Digest (08:00 UTC):**
```
📊 <b>Daily Infrastructure Report</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━

🟢 <b>42/45</b> endpoints operational

<b>24h Summary:</b>
  ✅ Uptime: 99.2%
  🔴 Incidents: 3
  ⏱ Avg response: 234ms
  🔁 Longest outage: 4m 32s (EVM RPC)

<b>Currently degraded (>1h):</b>
  🟡 Testnet EVM RPC — syncing
  🟡 Dashboard API (Dev) — slow responses

━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Full report: status.integralayer.com
```

**Endpoint Detail:**
```
🔍 <b>Mainnet EVM RPC</b>

<i>JSON-RPC gateway for EVM smart contracts
and transactions on Integra mainnet</i>

━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: 🟢 <b>UP</b>
Response: <code>142ms</code>
Block: <code>#312,847</code>
Chain ID: <code>0x6669</code>
Peers: <code>12</code>
Uptime (1h): <code>100%</code>

📊 Last 20 checks:
<code>▁▂▃▂▁▂▃▄▃▂▁▂▃▂▁▂▃▂▁▂</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Owner: Adam Boudj (infra)
🏷 Tags: EVM, Cosmos SDK
🌐 Env: mainnet (prod)
```

### Callback Query Handling

Bot processes inline keyboard button presses via callback queries:
- `cat:{category}` — show category detail
- `ep:{endpoint_id}` — show endpoint detail
- `refresh` — re-fetch and update the message in-place (edit message)
- `back:overview` — go back to status overview
- `back:cat:{category}` — go back to category
- `recheck:{endpoint_id}` — run a single endpoint check and update
- `subscribe` / `unsubscribe` — toggle alert subscription

Messages are edited in-place (not new messages) for clean UX — `editMessageText` + `editMessageReplyMarkup`.

### ASCII Sparklines

Since Telegram doesn't render SVG, use Unicode block characters for sparklines:
```
▁▂▃▄▅▆▇█  (U+2581-U+2588)
```
Map response times to 8 levels. DOWN values shown as `▁` (floor) in red context.

### Alert Types

| Transition | Emoji | Example |
|-----------|-------|---------|
| UP → DOWN | `🔴` | `🔴 DOWN: Mainnet EVM RPC` |
| UP → DEGRADED | `🟡` | `🟡 DEGRADED: Explorer GraphQL` |
| DOWN → UP | `🟢` | `🟢 RECOVERED: Mainnet EVM RPC (was down 4m 32s)` |
| DEGRADED → UP | `🟢` | `🟢 RECOVERED: Explorer GraphQL` |
| DOWN → DEGRADED | `🟠` | `🟠 IMPROVING: Mainnet EVM RPC (still degraded)` |

### Anti-Fatigue Rules

- **Flap protection:** 3+ oscillations in 5 min → consolidate into one "flapping" alert, suppress until stable 2 min
- **Grouped alerts:** multiple downs in same 60s check → ONE message listing all
- **Recovery delay:** 2 consecutive UP checks before sending recovery
- **Daily digest:** 08:00 UTC summary with 24h stats
- **Edit-in-place:** Refresh button edits existing message instead of sending new ones

### State Storage (Vercel KV)

- `status:{endpoint_id}` → last known status + timestamp
- `flap:{endpoint_id}` → transition count in rolling 5min window
- `digest:last` → timestamp of last daily digest
- `subscribers` → set of chat IDs for DM alerts
- `webhook:secret` → webhook verification secret

### Configuration

- `TELEGRAM_BOT_TOKEN` env var
- `TELEGRAM_CHANNEL_ID` env var
- `TELEGRAM_WEBHOOK_SECRET` env var
- `vercel.json`: cron + webhook route

## Data Model

```typescript
type Endpoint = {
  id: string;
  name: string;
  description: string;
  category: "blockchain" | "validators" | "backend" | "frontend" | "external";
  checkType: CheckType;
  url: string;
  links: {
    endpoint: string;
    docs?: string;
    repo?: string;
  };
  commonIssues: Array<{
    cause: string;
    fix: string;
  }>;
  dependsOn?: string[];
  impacts?: string[];
  owner: string;
  environment: "mainnet" | "testnet" | "external";
  tags?: string[];
};
```

## Branding

- **Font primary:** Euclid Circular B (headings + body)
- **Font mono:** Geist Mono (response times, addresses)
- **Primary color:** #FF6D49 (coral)
- **Brand gradient:** linear-gradient(135deg, #FFAFD6, #F34499, #FC4E23, #F71227)
- **Status colors:** Success #1FC16B, Warning #FA7319, Danger #FA3748
- **Surfaces:** Light: #FAFAF8 bg, #FFFFFF cards. Dark: #0A0A0F bg, rgba(23,23,28,0.7) cards
- **Logo:** IntegraLogo component from brand kit
- **Drop-in:** Copy `globals.css` from integra-brand/kit/

## Accessibility

- WCAG AA minimum (AAA where brand colors allow)
- Skip-to-content link
- Status communicated via text + color (never color alone)
- Focus-visible rings (brand pink)
- `prefers-reduced-motion` support
- Semantic HTML: `<main>`, `<nav>`, `<section>`, `<article>`
- ARIA labels on all interactive elements

## Out of Scope

- Authentication / login
- Database (beyond Vercel KV for bot state)
- Admin panel
- Historical data beyond ring buffer (last 100 checks)
- Dark mode toggle (follow system preference only)

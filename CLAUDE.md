# Integra Status Page

Real-time infrastructure status page for Integra Layer — blockchain, validators, APIs, and services.

**Repo**: `Integra-layer/integra-status` (GitHub)
**Stack**: Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui
**Deployed**: EC2 (`3.92.110.107` / `status.integralayer.com`) via Caddy reverse proxy

## Structure

```
integra-status/
├── app/
│   ├── layout.tsx              # Root layout: Geist fonts, metadata, skip-to-content
│   ├── page.tsx                # Dashboard (ISR, revalidate: 30s)
│   ├── loading.tsx             # Skeleton shimmer loading state
│   ├── globals.css             # Tailwind v4 @theme + Integra brand tokens + animations
│   ├── service/
│   │   └── [id]/
│   │       └── page.tsx        # Service detail: sparkline, deps, incidents, troubleshooting
│   └── api/
│       ├── health/
│       │   └── route.ts        # Health check engine (68 endpoints, 11 check types)
│       ├── cron/
│       │   └── route.ts        # Cron: poll + Telegram alerts (called by system crontab)
│       └── telegram/
│           └── webhook/
│               └── route.ts    # Telegram bot commands + callback queries
├── components/
│   ├── header.tsx              # Logo + title + last-checked + gradient border
│   ├── summary-bar.tsx         # Sticky: up/degraded/down pills with counters
│   ├── search-bar.tsx          # Debounced search + category filter chips
│   ├── category-section.tsx    # Collapsible category with status border
│   ├── endpoint-card.tsx       # Status dot, sparkline, links, owner pill, troubleshooting
│   ├── status-badge.tsx        # UP/DOWN/DEGRADED with pulsing dot
│   ├── sparkline.tsx           # Inline SVG with draw animation + hover tooltip
│   ├── endpoint-links.tsx      # Endpoint/docs/repo icon links
│   ├── troubleshooting-hint.tsx# Inline causes + fixes for DOWN/DEGRADED
│   ├── dependency-graph.tsx    # SVG dependency visualization
│   ├── incident-timeline.tsx   # Vertical timeline of state changes
│   ├── dashboard-client.tsx    # Client wrapper for search, filter, auto-refresh
│   ├── footer.tsx              # Endpoint count + Integra mark
│   ├── integra-logo.tsx        # SVG logo (full/mark variants)
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── types.ts                # TypeScript types (Owner has telegram field)
│   ├── health-config.ts        # 68 endpoints, OWNERS with Telegram handles, CTO_TELEGRAM
│   ├── health.ts               # 11 check type implementations
│   ├── history.ts              # Ring buffer for sparklines/incidents
│   ├── telegram.ts             # Telegram Bot API wrapper
│   ├── telegram-messages.ts    # Message formatters (HTML parse mode) with owner @mentions
│   ├── telegram-keyboards.ts   # Inline keyboard builders
│   ├── animations.ts           # Animation timing constants
│   └── utils.ts                # cn() utility (clsx + tailwind-merge)
├── vercel.json                 # Legacy Vercel config (not used on EC2)
├── next.config.ts              # output: "standalone"
├── tsconfig.json
└── package.json
```

## Deployment (EC2)

- **Host**: `3.92.110.107` (same EC2 as validator + explorer)
- **DNS**: `status.integralayer.com` → Route53 A record → `3.92.110.107`
- **Proxy**: Caddy reverse proxy with TLS
- **Process**: systemd service (standalone Next.js server)
- **Build**: `npm run build` → produces `.next/standalone/server.js`
- **Cron**: System crontab calls `/api/cron` every 60s for Telegram alerts

### Deploy steps

```bash
# Local
npm run build              # verify build passes
npx tsc --noEmit           # type-check
git push origin main

# On EC2
ssh -i ~/.ssh/integra-validator-key.pem ubuntu@3.92.110.107
cd /path/to/integra-status
git pull && npm run build && sudo systemctl restart integra-status
```

## Development

```bash
npm run dev    # localhost:3000
npm run build  # production build
npx tsc --noEmit  # type-check without building
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | @IntegraHealthBot token |
| `TELEGRAM_CHANNEL_ID` | Alert channel chat ID |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook verification secret |
| `CRON_SECRET` | Cron endpoint auth secret |
| `KV_REST_API_URL` | Vercel KV endpoint (state storage for alert transitions) |
| `KV_REST_API_TOKEN` | Vercel KV auth token |

## Ownership Model

Every endpoint has an `owner` (defined in `OWNERS` in `lib/health-config.ts`). Each owner has a `telegram` handle used for @mentions in alerts.

| Key | Name | Telegram | Primary Responsibility |
|-----|------|----------|----------------------|
| adam | Adam Boudj | @adamboudj | Blockchain infra, validators, explorer, status page, docs |
| nawar | Nawar | @iamnawar | Backend APIs (passport, dashboard, notification) |
| kalki | Kalki | @yourdevkalki | City APIs, City frontends, DiceBear |
| tara | Tara | @TaraMathews | Frontend (dashboard, website, whitepaper, portal, staking) |
| parth | Parth | @parthbisht22 | External APIs (supply, price, web3auth, absinthe, walletconnect) |

### Alert @mention logic

- **DOWN/DEGRADED alerts** (`formatAlert`): `👤 Owner: @handle` + `cc @adamboudj` (CTO always pinged unless Adam IS the owner)
- **Recovery alerts** (`formatRecovery`): Same pattern — owners know when their service recovers
- **Grouped alerts** (`formatGroupedAlert`): Collects unique handles from all transitions, deduplicates, always includes CTO
- The `CTO_TELEGRAM` constant in `health-config.ts` controls the always-ping handle

### Website display

- **Endpoint cards** (`endpoint-card.tsx`): Show `👤 Owner · @handle` with clickable Telegram link
- **Service detail page** (`app/service/[id]/page.tsx`): Shows `Owner — @handle` (linked) plus role

## Key Points

- 68 endpoints across 5 categories (blockchain, validators, apis, frontends, external)
- 11 check types: evm-rpc, cosmos-rpc, cosmos-rest, http-json, http-get, websocket, api-health, http-reachable, deep-health, graphql, cosmos-peer-check
- Each endpoint has inline troubleshooting hints, direct links, and owner attribution
- Telegram bot (@IntegraHealthBot) supports 9 commands + inline keyboard navigation
- ISR with 30s revalidation — page cached between checks, loads fast
- Cron alerts with flap protection, recovery delay, and owner @mentions
- History stored in `/tmp/integra-history.json` (ring buffer, 120 snapshots)

## Gotchas

- `output: "standalone"` in next.config.ts is required for EC2 deployment
- `vercel.json` crons/functions config is ignored on EC2 — use system crontab instead
- `@vercel/kv` works from EC2 (it's a REST API client) — just needs env vars
- History in `/tmp/` resets on process restart — cron keeps it populated
- The primary EVM RPC URL points to `adamboudj.integralayer.com/rpc` (the old `evm.integralayer.com` URL has SSL issues)

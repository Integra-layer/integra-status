# Integra Status Page

Real-time infrastructure status page for Integra Layer — blockchain, validators, APIs, and services.

**Repo**: `Integra-layer/integra-status` (GitHub)
**Stack**: Next.js 15.5 + TypeScript + Tailwind v4 + shadcn/ui + React 19
**Live**: https://status.integralayer.com
**Bot**: @IntegraHealthBot (Telegram)

## EC2 Deployment

| Detail | Value |
|--------|-------|
| **EC2 IP** | `3.92.110.107` |
| **SSH** | `ssh -i ~/.ssh/integra-validator-key.pem ubuntu@3.92.110.107` |
| **App path** | `/opt/integra-status` (NOT `/home/ubuntu/`) |
| **Branch** | `main` |
| **DNS** | `status.integralayer.com` → Route53 A record → `3.92.110.107` |
| **Proxy** | Caddy reverse proxy (`status.integralayer.com { reverse_proxy localhost:3003 }`) |
| **Systemd** | `integra-status.service` — runs `npx next start -p 3003` as ubuntu |
| **Env file** | `/opt/integra-status/.env.local` |
| **Cron** | ubuntu crontab: `* * * * * curl ... http://localhost:3003/api/cron` |
| **Monitor** | root crontab: `* * * * * /opt/integra-monitor/monitor.sh` (separate validator monitor) |
| **Shared EC2** | Same box hosts: validator node, explorer v2, Blockscout, Hasura, Callisto |

### Deploy commands

```bash
# Local — verify first
npx tsc --noEmit && npm run build
git push origin main

# EC2 — pull, build, restart
ssh -i ~/.ssh/integra-validator-key.pem ubuntu@3.92.110.107
cd /opt/integra-status && sudo git pull origin main && sudo npm run build && sudo systemctl restart integra-status
```

### One-liner deploy from local

```bash
ssh -i ~/.ssh/integra-validator-key.pem ubuntu@3.92.110.107 \
  "cd /opt/integra-status && sudo git pull origin main && sudo npm run build 2>&1 && sudo systemctl restart integra-status"
```

## Development

```bash
npm run dev        # localhost:3000
npm run build      # production build
npx tsc --noEmit   # type-check only
```

## Structure

```
integra-status/
├── app/
│   ├── layout.tsx              # Root layout: Geist fonts, metadata, skip-to-content
│   ├── page.tsx                # Dashboard (ISR, revalidate: 30s)
│   ├── loading.tsx             # Skeleton shimmer loading state
│   ├── globals.css             # Tailwind v4 @theme + Integra brand tokens + animations
│   ├── service/[id]/page.tsx   # Service detail: sparkline, deps, incidents, owner
│   └── api/
│       ├── health/route.ts     # Health check engine (55 enabled / 68 total, 11 check types)
│       ├── cron/route.ts       # Cron: poll → detect transitions → Telegram alerts
│       └── telegram/webhook/route.ts  # Bot commands + callback queries
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
│   ├── uptime-bar.tsx          # Colored bar of uptime buckets
│   ├── impact-warning.tsx      # Blast radius warning for down services
│   ├── dashboard-client.tsx    # Client wrapper: search, filter, auto-refresh
│   ├── footer.tsx              # Endpoint count + Integra mark
│   ├── integra-logo.tsx        # SVG logo (full/mark variants)
│   └── ui/                     # shadcn/ui primitives (card, badge, etc.)
├── lib/
│   ├── types.ts                # TypeScript types (Owner has telegram field)
│   ├── health-config.ts        # 68 endpoints, OWNERS with Telegram handles, CTO_TELEGRAM
│   ├── health.ts               # 11 check type implementations
│   ├── history.ts              # Ring buffer for sparklines/incidents (/tmp/integra-history.json)
│   ├── local-kv.ts             # File-based KV store (/tmp/integra-kv.json) — replaces @vercel/kv
│   ├── telegram.ts             # Telegram Bot API wrapper (sendMessage, setWebhook, etc.)
│   ├── telegram-messages.ts    # Message formatters (HTML parse mode) with owner @mentions
│   ├── telegram-keyboards.ts   # Inline keyboard builders
│   ├── animations.ts           # Animation timing constants
│   └── utils.ts                # cn() utility (clsx + tailwind-merge)
├── next.config.ts              # output: "standalone", optimizePackageImports
├── vercel.json                 # Legacy (ignored on EC2)
├── tsconfig.json
└── package.json
```

## Environment Variables

All in `/opt/integra-status/.env.local` on EC2:

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | @IntegraHealthBot token |
| `TELEGRAM_CHANNEL_ID` | Alert channel chat ID (`-1003735955169`) |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook verification secret |
| `CRON_SECRET` | Bearer token for `/api/cron` endpoint auth |

**Note**: No `KV_REST_API_URL` / `KV_REST_API_TOKEN` needed — we use `lib/local-kv.ts` (file-based KV in `/tmp/integra-kv.json`) instead of `@vercel/kv`.

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

- **DOWN/DEGRADED** (`formatAlert`): `👤 Owner: @handle` + `cc @adamboudj` (CTO always pinged unless Adam IS the owner)
- **Recovery** (`formatRecovery`): Same pattern — owners know when their service recovers
- **Grouped** (`formatGroupedAlert`): Collects unique handles from all transitions, deduplicates, always includes CTO
- `CTO_TELEGRAM` constant in `health-config.ts` controls the always-ping handle

### Alert frequency

- Cron runs **every 60s** via ubuntu crontab
- **All transitions require 2 consecutive checks** (~2 min) before alerting — DOWN, DEGRADED, and recovery
- **Flap protection**: max 3 transitions per endpoint per 5-min window, then suppressed
- **Daily digest**: 08:00 UTC summary to channel (no @mentions)
- **No repeated pings** while status stays the same

### Website display

- **Endpoint cards** (`endpoint-card.tsx`): `👤 Owner · @handle` with clickable `t.me/` link
- **Service detail page** (`app/service/[id]/page.tsx`): `Owner — @handle` (linked) + role

## Endpoint Categories

68 total endpoints (55 enabled) across 5 categories:

| Category | Count | Examples |
|----------|-------|---------|
| blockchain | 14 | Mainnet/testnet EVM RPC, Cosmos RPC, REST/LCD, WebSocket |
| validators | 4 | Validator 1-3 (DigitalOcean), Adam's node (AWS) |
| apis | 14 | Dashboard API, Notification, City API, Passport, Supply, Pricing |
| frontends | 16 | Explorer, Dashboard, City Builder, Docs, Staking, Portal, Blockscout |
| external | 10 | GitHub, Vercel, Web3Auth, OpenAI, Alchemy, Twitter, Google OAuth |

### 11 Check Types

`evm-rpc` · `cosmos-rpc` · `cosmos-rest` · `http-json` · `http-get` · `websocket` · `api-health` · `http-reachable` · `deep-health` · `graphql` · `cosmos-peer-check`

## App Groups (Simple View)

8 groups: Dashboard, Explorer, City, XP Portal, Blockchain Nodes, Validators, Websites & Docs, Other APIs, External Services

## State Storage

| File | Purpose | Persistence |
|------|---------|-------------|
| `/tmp/integra-history.json` | Sparklines, uptimes, incidents (ring buffer, 120 snapshots) | Resets on process restart |
| `/tmp/integra-kv.json` | Alert state: status transitions, flap counters, subscriber list | Resets on process restart |

Both files are rebuilt by the cron within minutes of a restart.

## Telegram Bot

Bot: **@IntegraHealthBot** — 9 commands + inline keyboard navigation

| Command | Description |
|---------|-------------|
| `/status` | Full infrastructure overview |
| `/check <name>` | Check specific endpoint |
| `/category <name>` | Endpoints in a category |
| `/down` | All DOWN endpoints |
| `/degraded` | All DEGRADED endpoints |
| `/subscribe` | Subscribe to DM alerts |
| `/unsubscribe` | Unsubscribe |
| `/ping` | Bot health check |
| `/help` | Command list |

## Key Architecture

- **ISR**: 30s revalidation — page is cached between checks, loads fast
- **Standalone output**: `next.config.ts` has `output: "standalone"` for EC2 deployment
- **Dependency graph**: BFS traversal computes blast radius (transitive impact of each endpoint going down)
- **Each endpoint** has: inline troubleshooting hints, direct links (endpoint/docs/repo), owner attribution, tags, rich descriptions

## Gotchas

- **App path is `/opt/integra-status`** — NOT `/home/ubuntu/integra-status`
- **Git branch must be `main`** — EC2 was previously stuck on a deleted feature branch. If git fetch fails with `couldn't find remote ref`, fix with: `sudo git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'` then `sudo git fetch origin`
- **`output: "standalone"`** in next.config.ts is required for EC2 — without it, `next start` won't work
- **`vercel.json`** crons/functions config is ignored on EC2 — use system crontab instead
- **No `@vercel/kv`** — replaced with `lib/local-kv.ts` (file-based). Don't add KV env vars.
- **History + KV in `/tmp/`** reset on process restart — cron repopulates within minutes
- **Two separate monitors on EC2**: (1) ubuntu crontab → `/api/cron` (status page alerts), (2) root crontab → `/opt/integra-monitor/monitor.sh` (validator health). Don't confuse them.
- **Primary EVM RPC** points to `adamboudj.integralayer.com/rpc` (the old `evm.integralayer.com` URL has SSL issues)
- **Shared EC2**: this box also runs the validator, explorer v2, Blockscout, Hasura, Callisto — be careful with disk/memory

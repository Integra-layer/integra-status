# Integra Status Page

Real-time infrastructure status page for Integra Layer — blockchain, validators, APIs, and services.

**Repo**: `Integra-layer/integra-status` (GitHub)
**Stack**: Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui
**Deployed**: Vercel (status.integralayer.com)

## Structure

```
integra-status/
├── app/
│   ├── layout.tsx              # Root layout: Geist fonts, metadata, skip-to-content
│   ├── page.tsx                # Dashboard (SSR, revalidate: 30s)
│   ├── loading.tsx             # Skeleton shimmer loading state
│   ├── globals.css             # Tailwind v4 @theme + Integra brand tokens + animations
│   ├── service/
│   │   └── [id]/
│   │       └── page.tsx        # Service detail: sparkline, deps, incidents, troubleshooting
│   └── api/
│       ├── health/
│       │   └── route.ts        # Health check engine (69 endpoints, 11 check types)
│       ├── cron/
│       │   └── route.ts        # Vercel Cron: poll + Telegram alerts (every 60s)
│       └── telegram/
│           └── webhook/
│               └── route.ts    # Telegram bot commands + callback queries
├── components/
│   ├── header.tsx              # Logo + title + last-checked + gradient border
│   ├── summary-bar.tsx         # Sticky: up/degraded/down pills with counters
│   ├── search-bar.tsx          # Debounced search + category filter chips
│   ├── category-section.tsx    # Collapsible category with status border
│   ├── endpoint-card.tsx       # Status dot, sparkline, links, troubleshooting
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
│   ├── types.ts                # TypeScript types
│   ├── health-config.ts        # 69 endpoints with links + commonIssues
│   ├── health.ts               # 11 check type implementations
│   ├── history.ts              # Ring buffer for sparklines/incidents
│   ├── telegram.ts             # Telegram Bot API wrapper
│   ├── telegram-messages.ts    # Message formatters (HTML parse mode)
│   ├── telegram-keyboards.ts   # Inline keyboard builders
│   ├── animations.ts           # Animation timing constants
│   └── utils.ts                # cn() utility (clsx + tailwind-merge)
├── vercel.json                 # Cron schedule + function config
├── next.config.ts
├── tsconfig.json
└── package.json
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
| `TELEGRAM_BOT_TOKEN` | @IntegraWatchBot token |
| `TELEGRAM_CHANNEL_ID` | Alert channel chat ID |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook verification secret |
| `CRON_SECRET` | Vercel Cron auth secret |
| `KV_REST_API_URL` | Vercel KV endpoint |
| `KV_REST_API_TOKEN` | Vercel KV auth token |

## Key Points

- 69 endpoints across 5 categories (blockchain, validators, apis, frontends, external)
- 11 check types: evm-rpc, cosmos-rpc, cosmos-rest, http-json, http-get, websocket, api-health, http-reachable, deep-health, graphql, cosmos-peer-check
- Each endpoint has inline troubleshooting hints and direct links
- Telegram bot supports 9 commands + inline keyboard navigation
- Auto-refresh every 30s via ISR + client-side router.refresh()
- Vercel Cron alerts every 60s with flap protection and recovery delay

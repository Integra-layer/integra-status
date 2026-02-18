# Integra Status Page

Real-time infrastructure status page for the Integra Layer blockchain. Monitors 68 endpoints across blockchain nodes, validators, APIs, explorers, and services.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui
- Telegram Bot (@IntegraHealthBot)
- ISR (Incremental Static Regeneration, 30s revalidate)
- Deployed on EC2 via systemd + Caddy reverse proxy

## Live URLs

- **Status page:** https://status.integralayer.com
- **Cron endpoint:** `/api/cron` (called every minute via crontab)

## Project Structure

```
app/
  layout.tsx              # Root layout (Geist fonts, metadata)
  page.tsx                # Dashboard (ISR, revalidate: 30s)
  loading.tsx             # Skeleton shimmer loading state
  api/
    cron/route.ts         # Cron endpoint — runs all health checks
    status/route.ts       # Status API
    telegram/route.ts     # Telegram webhook handler
lib/
  checks/                 # Health check implementations by category
  telegram.ts             # Telegram bot integration
  store.ts                # File-based KV store for check results
  types.ts                # TypeScript type definitions
components/               # UI components (status cards, charts)
```

## Health Check Categories

11 categories monitoring 68 endpoints:
1. Blockchain RPC (CometBFT)
2. REST API (Cosmos LCD)
3. gRPC endpoints
4. EVM JSON-RPC
5. WebSocket connections
6. Validator status
7. Explorer (Big Dipper)
8. Blockscout (EVM explorer)
9. Documentation site
10. External services
11. DNS resolution

## Alert System

- **Telegram alerts** sent on status changes (up→down, down→up)
- **Flap protection:** Requires 3 consecutive failures before alerting (prevents noise from transient issues)
- **File-based KV:** Check results stored in local JSON files (not a database)

## Commands

```bash
npm run dev        # Development server (localhost:3000)
npm run build      # Production build
npx tsc --noEmit   # Type-check only
npm run lint       # ESLint
```

## Coding Standards

- Server Components by default, `"use client"` only when needed
- All health check functions must handle timeouts gracefully (5s default)
- New checks must be registered in the check runner and added to the category map
- Use `const` over `let`, never `var`
- Named exports preferred
- Error responses must include the check name and endpoint for debugging

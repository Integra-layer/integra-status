# AGENTS.md — integra-status operational guide

Fast context for any agent or developer. CLAUDE.md holds deployment credentials and environment variable details; this file holds the operational context an agent needs (build/deploy/test/gotchas). When this file and CLAUDE.md disagree about deploy facts, CLAUDE.md wins (it has the live host details). Plain Markdown, no required fields.

---

## 1. What it is

Real-time infrastructure status page for Integra Layer — blockchain validators, APIs, and frontends. Runs as a Next.js 15 App Router app with a Telegram bot (@IntegraHealthBot) for alerts.

Stack (from `package.json`): **Next.js ^15.1.0 · React ^19.0.0 · TypeScript ^5.7.0 · Tailwind CSS ^4.0.0 · shadcn/ui · Vitest ^4.1.5 · Node 20** (pinned in `.github/workflows/test.yml`). Package manager: **npm** (lockfile: `package-lock.json`).

---

## 2. Architecture / data flow

```
Browser ──► Next.js App Router (ISR 30s) ──► app/page.tsx (server)
                                              └─ /api/health/route.ts  ← 43 enabled probes, 14 check types
                                              └─ /api/cron/route.ts    ← state transitions → Telegram alerts
                                              └─ /api/telegram/webhook/route.ts ← bot commands

System crontab (every 60s) ─► curl localhost:3003/api/cron
State storage: /tmp/integra-history.json (ring buffer, 120 snapshots)
               /tmp/integra-kv.json      (alert state, flap counters)
Telegram: @IntegraHealthBot ──► lib/telegram.ts / telegram-messages.ts
```

**Deployed on Vultr signer1 at `45.77.139.208`** (same box as Integra-Amsterdam validator). NOT on Vercel — `vercel.json` is present for legacy reference but ignored on the host. Caddy reverse-proxies `status.integralayer.com` → `localhost:3003`. Systemd unit: `integra-status.service`.

---

## 3. Repo layout

```
integra-status/
├── app/
│   ├── page.tsx                 # Dashboard (ISR, revalidate: 30s)
│   ├── api/health/route.ts      # Health check engine
│   ├── api/cron/route.ts        # Polling → Telegram alerts
│   └── api/telegram/webhook/route.ts
├── components/                  # UI components (cards, sparklines, dependency graph, etc.)
├── lib/
│   ├── health-config.ts         # 68 endpoints (43 enabled / 21 disabled), OWNERS, APP_GROUPS
│   ├── health.ts                # 14 check type implementations (evm-rpc, cosmos-rpc, etc.)
│   ├── history.ts               # Ring buffer → /tmp/integra-history.json
│   ├── local-kv.ts              # File-based KV → /tmp/integra-kv.json (replaces @vercel/kv)
│   ├── telegram*.ts             # Bot API, formatters, keyboards
│   ├── types.ts                 # TypeScript type definitions
│   └── __tests__/               # Vitest unit tests (4 test files)
├── next.config.ts               # output: "standalone" (required for EC2/Vultr deploy)
├── vercel.json                  # Legacy — ignored on Vultr host
└── package.json                 # Scripts: dev · build · start · lint · test · test:coverage
```

---

## 4. Build / test / lint / run

All commands from `package.json` scripts and `.github/workflows/test.yml`:

```bash
# Install (Node 20 required — pinned in CI)
npm ci

# Type-check only (fast; run before committing)
npx tsc --noEmit

# Test (Vitest, unit only — no network; runs lib/**/__tests__/**/*.test.ts)
npm test                  # vitest run
npm run test:watch        # vitest (interactive)
npm run test:coverage     # vitest run --coverage

# Lint
npm run lint              # next lint

# Build (requires Node 20; output: standalone in .next/standalone/)
npm run build

# Run locally
npm run dev               # localhost:3000

# CI pipeline order (from .github/workflows/test.yml): tsc → test → build
```

CI runs on every push/PR to `main` (`.github/workflows/test.yml`). All three steps must pass before merging.

---

## 5. Branch & environment / deploy model

| | main |
|---|---|
| Serves | https://status.integralayer.com (real users) |
| Host | Vultr `45.77.139.208` (Integra-Amsterdam signer) |
| Deploy trigger | **Manual** — SSH + pull + build + systemctl restart |
| Proxy | Caddy → localhost:3003 |
| Branch source | `main` — confirmed in CLAUDE.md deploy commands |

Only one branch exists: `main`. There is no staging environment. No auto-deploy (Vercel/App Runner/Amplify) is wired — the host pulls `main` manually via SSH.

**Deploy command (from CLAUDE.md):**
```bash
ssh -i ~/.ssh/integra root@45.77.139.208 \
  "cd /opt/integra-status && git pull origin main && npm run build 2>&1 && systemctl restart integra-status"
```

**Rollback:** `git revert <sha>` on the host, then rebuild + restart. No snapshot/image rollback available — history and KV state are in `/tmp/` and reset on restart regardless.

---

## 6. Caching / performance model

- **ISR**: page revalidates every 30 seconds. Aggressive caching; health data is never stale by more than 30s.
- **State persistence**: `/tmp/` — both `integra-history.json` and `integra-kv.json` are rebuilt by cron within minutes of a restart. Do not rely on them surviving a `systemctl restart`.
- **Alert flap protection**: max 3 transitions per endpoint per 5-min window, then suppressed. All transitions require 2 consecutive checks (~2 min) before alerting.
- **Daily digest**: 08:00 UTC to Telegram channel (no @mentions).
- **`output: "standalone"`** in `next.config.ts` is required — it bundles the server into `.next/standalone/` for deployment without a full `node_modules` tree.

---

## 7. Security & secrets

Secrets live in `/opt/integra-status/.env.local` on the Vultr host. Never commit to git.

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | @IntegraHealthBot token |
| `TELEGRAM_CHANNEL_ID` | Alert channel ID (`-1003735955169`) |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook verification |
| `CRON_SECRET` | Bearer token for `/api/cron` auth |

No `NEXT_PUBLIC_*` secrets. No `@vercel/kv` credentials — replaced by `lib/local-kv.ts`.

SSH: `ssh -i ~/.ssh/integra root@45.77.139.208`

---

## 8. DO-NOT / danger list

- **Never force-push `main`**. This is the live production branch. Direct mutation breaks the running service.
- **Never re-enable a retired endpoint** without first confirming the underlying infrastructure is restored. The retirement gate in `lib/__tests__/health-config.test.ts` enforces the list — CI will fail. Retired mainnet IDs are enumerated there (lines 259–281 of the test file).
- **Never add `@vercel/kv` or Vercel KV env vars**. The dependency was intentionally dropped (`b781ab9`). `lib/local-kv.ts` is the replacement.
- **Never remove `output: "standalone"` from `next.config.ts`**. Without it, `next start` fails on the Vultr host.
- **Never add new mainnet probes**. Mainnet is permanently retired (2026-05-10). `mainnet.integralayer.com` is NXDOMAIN.
- **Never ignore the co-location risk**. `45.77.139.208` runs both the status page AND the Integra-Amsterdam testnet validator (CometBFT 26656/26657). Heavy build jobs (`npm run build`) compete for CPU/memory with the validator. Keep builds brief; watch disk usage.
- **Never leave `vercel.json` crons enabled expecting them to run**. On Vultr, crons run via system crontab (`* * * * * curl ... http://localhost:3003/api/cron`), not Vercel.
- **Ask first before touching `.env.local`** on the host. It contains live bot tokens and the cron secret — corruption silences the entire alert pipeline.

---

## 9. Known pitfalls / fixed bugs

- **PR #11** (`23e5e67`): Flapping alert storm was fixed by collapsing multiple endpoint transitions into one grouped Telegram message. The flap-protection logic (3 transitions / 5-min window) was added at the same time.
- **PR #10** (`37cd394`): Alerter-liveness thresholds were too tight (15/60 min) and caused false DOWN alerts. Relaxed to 30/120 min.
- **`b781ab9`**: `@vercel/kv` removed because the host is not Vercel. If you see `KV_REST_API_URL not set` errors, the wrong version of the code is deployed.
- **Git fetch trap**: If `git pull` on the host fails with `couldn't find remote ref`, run: `sudo git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'` then `sudo git fetch origin`. This happens if the host was checked out on a now-deleted feature branch.
- **App path is `/opt/integra-status`** — NOT `/home/ubuntu/integra-status`. Using the wrong path silently deploys nothing.
- **Legacy EC2 box (`3.92.110.107`) is decommissioned**. Any reference to that IP or the AWS archive node (`3.208.92.57`) is dead. Do not attempt SSH.
- **Testnet host `46.225.231.81` (Helsinki)** — this is the testnet chain endpoint, not a status-page host.

---

## 10. Deploy flow + rollback

**Deploy (manual, from local machine):**
```bash
# 1. Verify locally first
npx tsc --noEmit && npm run build && npm test

# 2. Push to main
git push origin main

# 3. SSH pull + build + restart on host
ssh -i ~/.ssh/integra root@45.77.139.208 \
  "cd /opt/integra-status && git pull origin main && npm run build 2>&1 && systemctl restart integra-status"

# 4. Verify
curl -s https://status.integralayer.com/api/health | head -c 200
```

**Rollback:**
```bash
# On the host: identify the previous commit
ssh -i ~/.ssh/integra root@45.77.139.208
cd /opt/integra-status
git log --oneline -5
git checkout <previous-sha>      # detach HEAD to known-good commit
npm run build && systemctl restart integra-status
# Then revert properly on main and re-deploy
```

Note: `/tmp/` state resets on every restart — history ring buffer and alert KV repopulate from the cron within 1–2 minutes.

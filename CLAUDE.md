# Integra Status Page

Real-time infrastructure status page for Integralayer — blockchain, validators, APIs, and services.

**Repo**: `Integra-layer/integra-status` (GitHub)
**Language**: JavaScript (vanilla)
**Deployed**: Vercel

## Structure

```
integra-status/
├── server.js              # Express server (local dev)
├── api/health.js          # Vercel serverless health endpoint
├── lib/
│   ├── health-config.js   # Endpoint registry (what to check)
│   ├── health.js          # Health check engine
│   └── history.js         # Check history storage
├── public/
│   ├── index.html         # Status dashboard UI
│   ├── app.js             # Client-side JS
│   ├── style.css          # Styling
│   └── favicon.png
├── package.json
└── vercel.json            # Vercel deployment config
```

## Development

```bash
# No build step — static site + serverless function
vercel dev     # Local development
```

## Key Points

- ~12 files total — lightweight status dashboard
- Checks: EVM RPC, Cosmos RPC, REST API, Explorer, and other endpoints
- Serverless API at `/api/health` runs checks on demand
- No framework — vanilla HTML/JS/CSS frontend
- Deployed to Vercel with zero-config

// app/api/deploy/route.ts — Webhook to mark endpoints as deploying
// Called by CI before SSH deploy to suppress false DOWN alerts.

import { NextResponse } from "next/server";
import { localKv as kv } from "@/lib/local-kv";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// Max deploy duration before auto-expiry (10 minutes)
const DEPLOY_TTL_SECONDS = 600;

export async function POST(request: Request) {
  // Auth: same CRON_SECRET used by cron endpoint
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { endpoints, action } = body as {
      endpoints: string[];
      action?: "start" | "end";
    };

    if (!Array.isArray(endpoints) || endpoints.length === 0) {
      return NextResponse.json(
        { error: "endpoints array required" },
        { status: 400 },
      );
    }

    const isEnd = action === "end";

    for (const id of endpoints) {
      const key = `deploying:${id}`;
      if (isEnd) {
        await kv.del(key);
      } else {
        await kv.set(key, { at: Date.now() }, { ex: DEPLOY_TTL_SECONDS });
      }
    }

    return NextResponse.json({
      ok: true,
      action: isEnd ? "end" : "start",
      endpoints,
      ttlSeconds: isEnd ? 0 : DEPLOY_TTL_SECONDS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

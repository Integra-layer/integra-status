import { NextResponse } from "next/server";
import { localKv as kv } from "@/lib/local-kv";
import { checkAll, runCheck } from "@/lib/health";
import { getEndpoint, getEndpoints, CATEGORIES, APP_GROUPS } from "@/lib/health-config";
import { loadHistory, getSparklines, getUptimes } from "@/lib/history";
import { sendMessage, editMessage, answerCallbackQuery } from "@/lib/telegram";
import {
  formatStatusOverview,
  formatEndpointDetail,
  formatCategoryDetail,
  formatHelp,
} from "@/lib/telegram-messages";
import {
  overviewKeyboard,
  categoryKeyboard,
  endpointKeyboard,
} from "@/lib/telegram-keyboards";
import type { HealthSummary, CheckResult, Category } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 15;

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";

export async function POST(request: Request) {
  // Verify webhook secret
  if (WEBHOOK_SECRET) {
    const token = request.headers.get("x-telegram-bot-api-secret-token");
    if (token !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const update = await request.json();

    if (update.message?.text) {
      await handleCommand(update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

async function handleCommand(message: {
  chat: { id: number };
  text: string;
  date: number;
}) {
  const chatId = message.chat.id;
  const text = message.text.trim();
  const [cmd, ...args] = text.split(/\s+/);
  const command = cmd.toLowerCase().replace(/^\//, "").replace(/@\w+$/, "");

  switch (command) {
    case "status": {
      const results = await checkAll();
      const summary = buildSummary(results);
      const categoryCounts = getCategoryCounts(results);
      await sendMessage(
        chatId,
        formatStatusOverview(summary),
        "HTML",
        overviewKeyboard(categoryCounts),
      );
      break;
    }

    case "check": {
      const query = args.join(" ").toLowerCase();
      if (!query) {
        await sendMessage(
          chatId,
          "Usage: /check <endpoint name>\nExample: /check mainnet evm rpc",
        );
        break;
      }
      const endpoints = getEndpoints({ enabledOnly: true });
      const match = endpoints.find(
        (ep) =>
          ep.id.toLowerCase().includes(query) ||
          ep.name.toLowerCase().includes(query),
      );
      if (!match) {
        await sendMessage(chatId, `No endpoint found matching "${query}".`);
        break;
      }
      const result = await runCheck(match);
      const hist = loadHistory();
      const sparklines = getSparklines(hist);
      const uptimes = getUptimes(hist);
      await sendMessage(
        chatId,
        formatEndpointDetail(
          result,
          sparklines[match.id] ?? [],
          uptimes[match.id] != null ? uptimes[match.id] / 100 : undefined,
        ),
        "HTML",
        endpointKeyboard(match.id, result.links, result.category),
      );
      break;
    }

    case "category": {
      const catQuery = args.join(" ").toLowerCase();
      if (!catQuery) {
        await sendMessage(
          chatId,
          `Usage: /category <name>\nAvailable: ${CATEGORIES.join(", ")}`,
        );
        break;
      }
      const matchedCat = CATEGORIES.find((c) =>
        c.toLowerCase().includes(catQuery),
      );
      if (!matchedCat) {
        await sendMessage(
          chatId,
          `Unknown category. Available: ${CATEGORIES.join(", ")}`,
        );
        break;
      }
      const results = await checkAll({ category: matchedCat });
      await sendMessage(
        chatId,
        formatCategoryDetail(matchedCat, results),
        "HTML",
        categoryKeyboard(matchedCat, results),
      );
      break;
    }

    case "down": {
      const results = await checkAll();
      const down = results.filter((r) => r.status === "DOWN");
      if (down.length === 0) {
        await sendMessage(chatId, "No endpoints are currently DOWN.");
      } else {
        const lines = down.map(
          (r) => `<b>${r.name}</b>\n   ${r.error ?? "Unreachable"}`,
        );
        await sendMessage(
          chatId,
          `<b>${down.length} endpoint(s) DOWN:</b>\n\n${lines.join("\n\n")}`,
          "HTML",
        );
      }
      break;
    }

    case "degraded": {
      const results = await checkAll();
      const degraded = results.filter((r) => r.status === "DEGRADED");
      if (degraded.length === 0) {
        await sendMessage(chatId, "No endpoints are currently degraded.");
      } else {
        const lines = degraded.map(
          (r) => `<b>${r.name}</b>\n   ${r.error ?? "Slow response"}`,
        );
        await sendMessage(
          chatId,
          `<b>${degraded.length} endpoint(s) DEGRADED:</b>\n\n${lines.join("\n\n")}`,
          "HTML",
        );
      }
      break;
    }

    case "subscribe": {
      await kv.sadd("subscribers", String(chatId));
      await sendMessage(
        chatId,
        "Subscribed to status alerts. You will receive DM notifications when services go down or recover.\n\nUse /unsubscribe to stop.",
      );
      break;
    }

    case "unsubscribe": {
      await kv.srem("subscribers", String(chatId));
      await sendMessage(chatId, "Unsubscribed from status alerts.");
      break;
    }

    case "ping": {
      const latency = Date.now() - message.date * 1000;
      await sendMessage(chatId, `Pong! Latency: ${Math.max(0, latency)}ms`);
      break;
    }

    case "help":
    case "start": {
      await sendMessage(chatId, formatHelp(), "HTML");
      break;
    }

    default: {
      await sendMessage(
        chatId,
        "Unknown command. Use /help to see available commands.",
      );
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Callback query handler
// ---------------------------------------------------------------------------

async function handleCallbackQuery(query: {
  id: string;
  message?: { chat: { id: number }; message_id: number };
  data?: string;
}) {
  const data = query.data ?? "";
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;

  if (!chatId || !messageId) {
    await answerCallbackQuery(query.id);
    return;
  }

  try {
    if (data === "refresh" || data === "back:overview") {
      const results = await checkAll();
      const summary = buildSummary(results);
      const categoryCounts = getCategoryCounts(results);
      await editMessage(
        chatId,
        messageId,
        formatStatusOverview(summary),
        "HTML",
        overviewKeyboard(categoryCounts),
      );
    } else if (data.startsWith("cat:")) {
      const cat = data.slice(4) as Category;
      const results = await checkAll({ category: cat });
      await editMessage(
        chatId,
        messageId,
        formatCategoryDetail(cat, results),
        "HTML",
        categoryKeyboard(cat, results),
      );
    } else if (data.startsWith("back:cat:")) {
      const cat = data.slice(9) as Category;
      const results = await checkAll({ category: cat });
      await editMessage(
        chatId,
        messageId,
        formatCategoryDetail(cat, results),
        "HTML",
        categoryKeyboard(cat, results),
      );
    } else if (data.startsWith("ep:")) {
      const epId = data.slice(3);
      const ep = getEndpoint(epId);
      if (ep) {
        const result = await runCheck(ep);
        const hist = loadHistory();
        const sparklines = getSparklines(hist);
        const uptimes = getUptimes(hist);
        await editMessage(
          chatId,
          messageId,
          formatEndpointDetail(
            result,
            sparklines[epId] ?? [],
            uptimes[epId] != null ? uptimes[epId] / 100 : undefined,
          ),
          "HTML",
          endpointKeyboard(epId, result.links, result.category),
        );
      }
    } else if (data.startsWith("recheck:")) {
      const epId = data.slice(8);
      const ep = getEndpoint(epId);
      if (ep) {
        const result = await runCheck(ep);
        const hist = loadHistory();
        const sparklines = getSparklines(hist);
        const uptimes = getUptimes(hist);
        await editMessage(
          chatId,
          messageId,
          formatEndpointDetail(
            result,
            sparklines[epId] ?? [],
            uptimes[epId] != null ? uptimes[epId] / 100 : undefined,
          ),
          "HTML",
          endpointKeyboard(epId, result.links, result.category),
        );
      }
    }
  } catch (err) {
    console.error("Callback query error:", err);
  }

  await answerCallbackQuery(query.id);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSummary(results: CheckResult[]): HealthSummary {
  return {
    timestamp: new Date().toISOString(),
    total: results.length,
    up: results.filter((r) => r.status === "UP").length,
    degraded: results.filter((r) => r.status === "DEGRADED").length,
    down: results.filter((r) => r.status === "DOWN").length,
    appGroups: APP_GROUPS,
    dependencyGraph: {},
    impactMap: {},
    results,
    history: {
      sparklines: {},
      uptimes: {},
      incidents: [],
      dataPoints: 0,
      spanMinutes: 0,
    },
  };
}

function getCategoryCounts(
  results: CheckResult[],
): Record<string, { up: number; total: number }> {
  const counts: Record<string, { up: number; total: number }> = {};
  for (const cat of CATEGORIES) {
    const catResults = results.filter((r) => r.category === cat);
    counts[cat] = {
      up: catResults.filter((r) => r.status === "UP").length,
      total: catResults.length,
    };
  }
  return counts;
}

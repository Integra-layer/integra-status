// lib/telegram-messages.ts — Message formatters (HTML parse mode) for @IntegraHealthBot

import type { CheckResult, HealthSummary } from "./types";
import { CTO_TELEGRAM } from "./health-config";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_PAGE_URL = "https://status.integralayer.com";
const REPO_URL = "https://github.com/Integra-layer/integra-status";
const RULE = "━".repeat(26); // ━ x26 — visual divider
const STATUS_EMOJI: Record<string, string> = {
  UP: "🟢", // 🟢
  DEGRADED: "🟡", // 🟡
  DOWN: "🔴", // 🔴
  DEPLOYING: "🔵", // 🔵
};

// ---------------------------------------------------------------------------
// HTML escaping — Telegram HTML parse mode requires &<> escaped in dynamic
// content. Without this, an endpoint name or error containing `<` will fail
// the entire message parse and the alert is silently dropped.
// ---------------------------------------------------------------------------

export function escapeHtml(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function statusEmoji(status: string): string {
  return STATUS_EMOJI[status] ?? "⚪"; // ⚪ for unknown
}

function statusLabel(toStatus: string): string {
  if (toStatus === "DOWN") return "DOWN";
  if (toStatus === "DEGRADED") return "DEGRADED";
  if (toStatus === "DEPLOYING") return "DEPLOYING";
  return "RECOVERED";
}

function nowUtc(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function ownerMention(result: CheckResult): string[] {
  // Returns lines for Owner + cc CTO (deduped if owner IS the CTO).
  if (!result.owner?.telegram) return [];
  const handle = result.owner.telegram;
  const lines = [`👤 Owner: @${escapeHtml(handle)}`];
  if (handle !== CTO_TELEGRAM) {
    lines.push(`cc @${escapeHtml(CTO_TELEGRAM)}`);
  }
  return lines;
}

function quickLinkFooter(result?: CheckResult): string[] {
  // Footer with status page + repo + (optional) endpoint URL for fast triage.
  const lines = [
    `🔗 <a href="${STATUS_PAGE_URL}">Status</a> · <a href="${REPO_URL}">Repo</a>`,
  ];
  if (result?.url) {
    lines[0] += ` · <a href="${escapeHtml(result.url)}">Endpoint</a>`;
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Single-endpoint alert (DOWN / DEGRADED / DEPLOYING / RECOVERED)
// ---------------------------------------------------------------------------

export function formatAlert(
  transition: { fromStatus: string; toStatus: string },
  result: CheckResult,
): string {
  const emoji = statusEmoji(transition.toStatus);
  const label = statusLabel(transition.toStatus);

  const lines = [
    `${emoji} <b>${label}: ${escapeHtml(result.name)}</b>`,
    ``,
    `⏰ ${nowUtc()}`,
    `📍 <code>${escapeHtml(result.url)}</code>`,
    `📂 ${escapeHtml(result.category)} · ${escapeHtml(result.environment)}`,
    result.error
      ? `⚠️ ${escapeHtml(result.error)}`
      : `⚡ ${result.responseTimeMs}ms`,
  ];

  if (result.commonIssues.length > 0 && transition.toStatus !== "UP") {
    lines.push(``, RULE, `💡 <b>Possible causes:</b>`);
    for (const issue of result.commonIssues.slice(0, 3)) {
      lines.push(`  • ${escapeHtml(issue.cause)}`);
    }
  }

  if (result.impactDescription && transition.toStatus !== "UP") {
    lines.push(``, `⚠️ <b>Impact:</b> ${escapeHtml(result.impactDescription)}`);
  }

  const mentions = ownerMention(result);
  if (mentions.length > 0) {
    lines.push(``, ...mentions);
  }

  lines.push(RULE, ...quickLinkFooter(result));
  return lines.join("\n");
}

export function formatRecovery(
  result: CheckResult,
  downtimeSeconds: number,
): string {
  const lines = [
    `🟢 <b>RECOVERED: ${escapeHtml(result.name)}</b>`,
    ``,
    `⏰ ${nowUtc()}`,
    `⏳ Downtime: <b>${formatDuration(downtimeSeconds)}</b>`,
    `⚡ Response: ${result.responseTimeMs}ms`,
  ];

  const mentions = ownerMention(result);
  if (mentions.length > 0) {
    lines.push(``, ...mentions);
  }

  lines.push(``, RULE, `All systems operational ✓`, ...quickLinkFooter(result));
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Flapping-incident alerts — collapse a slow-flapping endpoint (the City
// of Integra API on 2026-05-21) into ONE incident instead of paging on
// every DOWN/UP transition. See lib/incident-tracker.ts.
// ---------------------------------------------------------------------------

export function formatFlapStart(result: CheckResult, flapCount: number): string {
  const lines = [
    `🔁 <b>FLAPPING: ${escapeHtml(result.name)}</b>`,
    ``,
    `⏰ ${nowUtc()}`,
    `📂 ${escapeHtml(result.category)} · ${escapeHtml(result.environment)}`,
    `📊 ${flapCount} status changes in the last hour — the service is unstable.`,
    ``,
    `🔕 Per-change alerts are now collapsed into this incident. Next update within 60m, or once it stabilises.`,
  ];

  if (result.impactDescription) {
    lines.push(``, `⚠️ <b>Impact:</b> ${escapeHtml(result.impactDescription)}`);
  }

  const mentions = ownerMention(result);
  if (mentions.length > 0) {
    lines.push(``, ...mentions);
  }

  lines.push(RULE, ...quickLinkFooter(result));
  return lines.join("\n");
}

export function formatFlapDigest(
  result: CheckResult,
  flapCount: number,
  openForSeconds: number,
): string {
  const lines = [
    `🔁 <b>STILL FLAPPING: ${escapeHtml(result.name)}</b>`,
    ``,
    `⏰ ${nowUtc()}`,
    `📊 ${flapCount} status changes · unstable for ${formatDuration(openForSeconds)}`,
    `📍 Currently: ${statusEmoji(result.status)} <b>${escapeHtml(result.status)}</b>`,
  ];

  if (result.impactDescription) {
    lines.push(``, `⚠️ <b>Impact:</b> ${escapeHtml(result.impactDescription)}`);
  }

  const mentions = ownerMention(result);
  if (mentions.length > 0) {
    lines.push(``, ...mentions);
  }

  lines.push(RULE, ...quickLinkFooter(result));
  return lines.join("\n");
}

export function formatIncidentResolved(
  result: CheckResult,
  stableForSeconds: number,
): string {
  const stable = formatDuration(stableForSeconds);

  if (result.status === "UP") {
    const lines = [
      `✅ <b>STABILISED: ${escapeHtml(result.name)}</b>`,
      ``,
      `⏰ ${nowUtc()}`,
      `⏳ UP and stable for ${stable} — the flapping incident is resolved.`,
      `⚡ Response: ${result.responseTimeMs}ms`,
    ];
    const mentions = ownerMention(result);
    if (mentions.length > 0) {
      lines.push(``, ...mentions);
    }
    lines.push(``, RULE, `All systems operational ✓`, ...quickLinkFooter(result));
    return lines.join("\n");
  }

  // Flapping stopped, but the endpoint settled into a steady non-UP
  // state — page it once, properly, with causes + impact.
  const lines = [
    `${statusEmoji(result.status)} <b>SETTLED ${statusLabel(result.status)}: ${escapeHtml(result.name)}</b>`,
    ``,
    `⏰ ${nowUtc()}`,
    `⏳ Flapping stopped — steadily ${escapeHtml(result.status)} for ${stable}.`,
    result.error
      ? `⚠️ ${escapeHtml(result.error)}`
      : `⚡ ${result.responseTimeMs}ms`,
  ];

  if (result.commonIssues.length > 0) {
    lines.push(``, RULE, `💡 <b>Possible causes:</b>`);
    for (const issue of result.commonIssues.slice(0, 3)) {
      lines.push(`  • ${escapeHtml(issue.cause)}`);
    }
  }

  if (result.impactDescription) {
    lines.push(``, `⚠️ <b>Impact:</b> ${escapeHtml(result.impactDescription)}`);
  }

  const mentions = ownerMention(result);
  if (mentions.length > 0) {
    lines.push(``, ...mentions);
  }

  lines.push(RULE, ...quickLinkFooter(result));
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Grouped alert (multiple transitions in same cron tick)
// ---------------------------------------------------------------------------

export function formatGroupedAlert(
  transitions: Array<{
    result: CheckResult;
    fromStatus: string;
    toStatus: string;
  }>,
): string {
  const downCount = transitions.filter((t) => t.toStatus === "DOWN").length;
  const degCount = transitions.filter((t) => t.toStatus === "DEGRADED").length;
  const upCount = transitions.filter((t) => t.toStatus === "UP").length;

  const summary = [
    downCount > 0 ? `${downCount} DOWN` : null,
    degCount > 0 ? `${degCount} DEGRADED` : null,
    upCount > 0 ? `${upCount} RECOVERED` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const lines = [
    `⚠️ <b>Multiple Status Changes</b> (${transitions.length})`,
    summary,
    ``,
    RULE,
  ];

  // Per-row detail: emoji, name, transition, error/response, impact (1-line), owner
  for (const t of transitions) {
    const emoji = statusEmoji(t.toStatus);
    const fromEmoji = statusEmoji(t.fromStatus);
    const r = t.result;

    lines.push(
      `${emoji} <b>${escapeHtml(r.name)}</b>`,
      `   ${fromEmoji} ${escapeHtml(t.fromStatus)} → ${emoji} ${escapeHtml(t.toStatus)}`,
    );
    if (r.error && t.toStatus !== "UP") {
      lines.push(`   ⚠️ ${escapeHtml(truncate(r.error, 120))}`);
    } else if (t.toStatus === "UP") {
      lines.push(`   ✓ ${r.responseTimeMs}ms`);
    }
    if (r.impactDescription && t.toStatus !== "UP") {
      lines.push(`   💥 ${escapeHtml(truncate(r.impactDescription, 120))}`);
    }
    if (r.owner?.telegram) {
      lines.push(`   👤 @${escapeHtml(r.owner.telegram)}`);
    }
    lines.push(``);
  }

  lines.push(RULE, `⏰ ${nowUtc()}`);

  // Dedup'd cc line — owners across all transitions + CTO
  const handles = new Set<string>();
  handles.add(CTO_TELEGRAM);
  for (const t of transitions) {
    if (t.result.owner?.telegram) handles.add(t.result.owner.telegram);
  }
  const mentions = [...handles].map((h) => `@${escapeHtml(h)}`).join(" ");
  lines.push(`👤 cc ${mentions}`);
  lines.push(...quickLinkFooter());
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// /status overview — used by command + daily digest header
// ---------------------------------------------------------------------------

export function formatStatusOverview(summary: HealthSummary): string {
  const ts = new Date(summary.timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  const lines = [
    `⬡ <b>Integra Infrastructure Status</b>`,
    ``,
    RULE,
    `🟢 <b>${summary.up}</b> Operational`,
    summary.degraded > 0 ? `🟡 <b>${summary.degraded}</b> Degraded` : null,
    summary.down > 0 ? `🔴 <b>${summary.down}</b> Down` : null,
    summary.deploying > 0 ? `🔵 <b>${summary.deploying}</b> Deploying` : null,
    RULE,
    ``,
    `⏰ Updated: ${ts} UTC`,
    ``,
    `Select a category below for details.`,
  ];
  return lines.filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Daily digest — overview header PLUS specific DOWN/DEGRADED endpoints.
// Falls back to "All systems operational" when nothing's wrong.
// ---------------------------------------------------------------------------

export function formatDailyDigest(summary: HealthSummary): string {
  const ts = new Date(summary.timestamp).toLocaleString("en-US", {
    timeZone: "UTC",
    hour12: false,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const down = summary.results.filter((r) => r.status === "DOWN");
  const degraded = summary.results.filter((r) => r.status === "DEGRADED");

  const lines = [
    `📊 <b>Integra Daily Digest</b>`,
    `<i>${ts} UTC</i>`,
    ``,
    RULE,
    `🟢 <b>${summary.up}</b> Operational`,
    summary.degraded > 0 ? `🟡 <b>${summary.degraded}</b> Degraded` : null,
    summary.down > 0 ? `🔴 <b>${summary.down}</b> Down` : null,
    summary.deploying > 0 ? `🔵 <b>${summary.deploying}</b> Deploying` : null,
    RULE,
  ];

  if (down.length === 0 && degraded.length === 0) {
    lines.push(``, `All systems operational ✓`);
  } else {
    if (down.length > 0) {
      lines.push(``, `🔴 <b>DOWN (${down.length})</b>`);
      for (const r of down) {
        const owner = r.owner?.telegram ? ` · @${escapeHtml(r.owner.telegram)}` : "";
        const reason = r.error ? `: ${escapeHtml(truncate(r.error, 80))}` : "";
        lines.push(`  • <b>${escapeHtml(r.name)}</b>${owner}${reason}`);
      }
    }
    if (degraded.length > 0) {
      lines.push(``, `🟡 <b>DEGRADED (${degraded.length})</b>`);
      for (const r of degraded) {
        const owner = r.owner?.telegram ? ` · @${escapeHtml(r.owner.telegram)}` : "";
        const reason = r.error ? `: ${escapeHtml(truncate(r.error, 80))}` : "";
        lines.push(`  • <b>${escapeHtml(r.name)}</b>${owner}${reason}`);
      }
    }
  }

  lines.push(``, ...quickLinkFooter());
  return lines.filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Endpoint detail — used by /check command and inline keyboard navigation
// ---------------------------------------------------------------------------

export function formatEndpointDetail(
  result: CheckResult,
  sparkData: (number | null)[],
  uptime: number | undefined,
): string {
  const desc = result.richDescription || result.description;
  const lines = [
    `🔍 <b>${escapeHtml(result.name)}</b>`,
    ``,
    desc ? `<i>${escapeHtml(desc)}</i>` : null,
    ``,
    RULE,
    `Status: ${statusEmoji(result.status)} <b>${escapeHtml(result.status)}</b>`,
    `Response: <code>${result.responseTimeMs}ms</code>`,
    uptime != null ? `Uptime: <code>${(uptime * 100).toFixed(1)}%</code>` : null,
    ``,
    sparkData.length > 0 ? `📊 Last ${sparkData.length} checks:` : null,
    sparkData.length > 0 ? `<code>${asciiSparkline(sparkData, 20)}</code>` : null,
    ``,
    RULE,
    result.owner
      ? `👤 Owner: ${escapeHtml(result.owner.name)} (${escapeHtml(result.owner.role)})`
      : null,
    result.tags.length > 0 ? `🏷 Tags: ${escapeHtml(result.tags.join(", "))}` : null,
    `🌐 Env: ${escapeHtml(result.environment)}`,
  ];
  return lines.filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Category detail — list of endpoints in a category, used by /category
// ---------------------------------------------------------------------------

export function formatCategoryDetail(
  category: string,
  results: CheckResult[],
): string {
  const lines = [`📂 <b>${escapeHtml(category)}</b>`, ``];
  for (const r of results) {
    lines.push(
      `${statusEmoji(r.status)} ${escapeHtml(r.name)} — <code>${r.responseTimeMs}ms</code>`,
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// /help command output
// ---------------------------------------------------------------------------

export function formatHelp(): string {
  return [
    `⬡ <b>IntegraHealthBot Commands</b>`,
    ``,
    `/status — Full infrastructure overview`,
    `/check &lt;name&gt; — Check specific endpoint`,
    `/category &lt;name&gt; — Endpoints in a category`,
    `/down — All DOWN endpoints`,
    `/degraded — All DEGRADED endpoints`,
    `/subscribe — Subscribe to DM alerts`,
    `/unsubscribe — Unsubscribe`,
    `/ping — Bot health check`,
    `/help — This message`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Sparkline utility — used in endpoint detail
// ---------------------------------------------------------------------------

export function asciiSparkline(data: (number | null)[], width: number): string {
  const chars = "▁▂▃▄▅▆▇█";
  const values = data.slice(-width);
  const valid = values.filter((v): v is number => v !== null && v > 0);
  if (valid.length === 0) return "▁".repeat(width);
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  return values
    .map((v) => {
      if (v === null || v <= 0) return "▁";
      const idx = Math.min(
        Math.floor(((v - min) / range) * (chars.length - 1)),
        chars.length - 1,
      );
      return chars[idx];
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

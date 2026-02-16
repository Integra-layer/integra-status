// lib/telegram-messages.ts — Message formatters (HTML parse mode) for @IntegraHealthBot

import type { CheckResult, HealthSummary } from "./types";
import { CTO_TELEGRAM } from "./health-config";

export function formatStatusOverview(summary: HealthSummary): string {
  const lines = [
    `\u2B21 <b>Integra Infrastructure Status</b>`,
    ``,
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
    `\uD83D\uDFE2 <b>${summary.up}</b> Operational`,
    summary.degraded > 0
      ? `\uD83D\uDFE1 <b>${summary.degraded}</b> Degraded`
      : null,
    summary.down > 0 ? `\uD83D\uDD34 <b>${summary.down}</b> Down` : null,
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
    ``,
    `\u23F1 Updated: ${new Date(summary.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`,
    ``,
    `Select a category below for details.`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function formatAlert(
  transition: { fromStatus: string; toStatus: string },
  result: CheckResult,
): string {
  const emoji =
    transition.toStatus === "DOWN"
      ? "\uD83D\uDD34"
      : transition.toStatus === "DEGRADED"
        ? "\uD83D\uDFE1"
        : "\uD83D\uDFE2";
  const label =
    transition.toStatus === "DOWN"
      ? "DOWN"
      : transition.toStatus === "DEGRADED"
        ? "DEGRADED"
        : "RECOVERED";

  const lines = [
    `${emoji} <b>${label}: ${result.name}</b>`,
    ``,
    `\u23F1 Detected: ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`,
    `\uD83D\uDCCD <code>${result.url}</code>`,
    `\uD83D\uDCC2 Category: ${result.category}`,
    result.error
      ? `\u26A0\uFE0F ${result.error}`
      : `\u23F3 Response: ${result.responseTimeMs}ms`,
  ];

  if (result.commonIssues.length > 0 && transition.toStatus !== "UP") {
    lines.push(
      ``,
      `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
    );
    lines.push(`\uD83D\uDCA1 <b>Possible causes:</b>`);
    for (const issue of result.commonIssues.slice(0, 3)) {
      lines.push(`  \u2022 ${issue.cause}`);
    }
  }

  if (result.impactDescription) {
    lines.push(``, `\u26A0\uFE0F <b>Impact:</b> ${result.impactDescription}`);
  }

  // Owner @mention + CTO ping (avoid double mention if CTO is the owner)
  if (result.owner?.telegram) {
    lines.push(``, `\uD83D\uDC64 Owner: @${result.owner.telegram}`);
    if (result.owner.telegram !== CTO_TELEGRAM) {
      lines.push(`cc @${CTO_TELEGRAM}`);
    }
  }

  lines.push(
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
  );
  return lines.join("\n");
}

export function formatRecovery(
  result: CheckResult,
  downtimeSeconds: number,
): string {
  const mins = Math.floor(downtimeSeconds / 60);
  const secs = downtimeSeconds % 60;
  const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const lines = [
    `\uD83D\uDFE2 <b>RECOVERED: ${result.name}</b>`,
    ``,
    `\u23F1 Recovered: ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`,
    `\u23F3 Downtime: <b>${duration}</b>`,
    `\uD83D\uDCC8 Response: ${result.responseTimeMs}ms`,
  ];

  if (result.owner?.telegram) {
    lines.push(``, `\uD83D\uDC64 Owner: @${result.owner.telegram}`);
    if (result.owner.telegram !== CTO_TELEGRAM) {
      lines.push(`cc @${CTO_TELEGRAM}`);
    }
  }

  lines.push(
    ``,
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
    `All systems operational \u2713`,
  );
  return lines.join("\n");
}

export function formatEndpointDetail(
  result: CheckResult,
  sparkData: (number | null)[],
  uptime: number | undefined,
): string {
  const lines = [
    `\uD83D\uDD0D <b>${result.name}</b>`,
    ``,
    result.richDescription
      ? `<i>${result.richDescription}</i>`
      : result.description
        ? `<i>${result.description}</i>`
        : null,
    ``,
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
    `Status: ${result.status === "UP" ? "\uD83D\uDFE2" : result.status === "DEGRADED" ? "\uD83D\uDFE1" : "\uD83D\uDD34"} <b>${result.status}</b>`,
    `Response: <code>${result.responseTimeMs}ms</code>`,
    uptime != null
      ? `Uptime: <code>${(uptime * 100).toFixed(1)}%</code>`
      : null,
    ``,
    sparkData.length > 0
      ? `\uD83D\uDCCA Last ${sparkData.length} checks:`
      : null,
    sparkData.length > 0
      ? `<code>${asciiSparkline(sparkData, 20)}</code>`
      : null,
    ``,
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
    result.owner
      ? `\uD83D\uDC64 Owner: ${result.owner.name} (${result.owner.role})`
      : null,
    result.tags.length > 0
      ? `\uD83C\uDFF7 Tags: ${result.tags.join(", ")}`
      : null,
    `\uD83C\uDF10 Env: ${result.environment}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function formatCategoryDetail(
  category: string,
  results: CheckResult[],
): string {
  const lines = [`\uD83D\uDCC2 <b>${category}</b>`, ``];
  for (const r of results) {
    const dot =
      r.status === "UP"
        ? "\uD83D\uDFE2"
        : r.status === "DEGRADED"
          ? "\uD83D\uDFE1"
          : "\uD83D\uDD34";
    lines.push(`${dot} ${r.name} \u2014 <code>${r.responseTimeMs}ms</code>`);
  }
  return lines.join("\n");
}

export function formatGroupedAlert(
  transitions: Array<{
    result: CheckResult;
    fromStatus: string;
    toStatus: string;
  }>,
): string {
  const lines = [
    `\u26A0\uFE0F <b>Multiple Status Changes</b>`,
    ``,
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
  ];
  for (const t of transitions) {
    const emoji =
      t.toStatus === "DOWN"
        ? "\uD83D\uDD34"
        : t.toStatus === "DEGRADED"
          ? "\uD83D\uDFE1"
          : "\uD83D\uDFE2";
    lines.push(
      `${emoji} ${t.result.name}: ${t.fromStatus} \u2192 ${t.toStatus}`,
    );
  }
  lines.push(
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
  );
  lines.push(
    `\u23F1 ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`,
  );

  // Collect unique owner handles from all transitions, always include CTO
  const handles = new Set<string>();
  handles.add(CTO_TELEGRAM);
  for (const t of transitions) {
    if (t.result.owner?.telegram) {
      handles.add(t.result.owner.telegram);
    }
  }
  const mentions = [...handles].map((h) => `@${h}`).join(" ");
  lines.push(`\uD83D\uDC64 cc ${mentions}`);

  return lines.join("\n");
}

export function formatHelp(): string {
  return [
    `\u2B21 <b>IntegraHealthBot Commands</b>`,
    ``,
    `/status \u2014 Full infrastructure overview`,
    `/check &lt;name&gt; \u2014 Check specific endpoint`,
    `/category &lt;name&gt; \u2014 Endpoints in a category`,
    `/down \u2014 All DOWN endpoints`,
    `/degraded \u2014 All DEGRADED endpoints`,
    `/subscribe \u2014 Subscribe to DM alerts`,
    `/unsubscribe \u2014 Unsubscribe`,
    `/ping \u2014 Bot health check`,
    `/help \u2014 This message`,
  ].join("\n");
}

export function asciiSparkline(
  data: (number | null)[],
  width: number,
): string {
  const chars = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588";
  const values = data.slice(-width);
  const valid = values.filter((v): v is number => v !== null && v > 0);
  if (valid.length === 0) return "\u2581".repeat(width);
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  return values
    .map((v) => {
      if (v === null || v <= 0) return "\u2581";
      const idx = Math.min(
        Math.floor(((v - min) / range) * (chars.length - 1)),
        chars.length - 1,
      );
      return chars[idx];
    })
    .join("");
}

// lib/__tests__/telegram-messages.test.ts
//
// These tests pin behaviour for the Telegram formatters that fan out to the
// alert channel and operator DMs. The HTML escaping checks matter most:
// Telegram silently drops messages with malformed HTML, so a single unescaped
// `<` in an endpoint name or error string would mean a missed page.

import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  formatAlert,
  formatRecovery,
  formatGroupedAlert,
  formatStatusOverview,
  formatDailyDigest,
  formatEndpointDetail,
  formatCategoryDetail,
  formatHelp,
  asciiSparkline,
  formatFlapStart,
  formatFlapDigest,
  formatIncidentResolved,
} from "../telegram-messages";
import type { CheckResult, HealthSummary, Owner } from "../types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const adamOwner: Owner = {
  name: "Adam Boudj",
  role: "CTO / Infrastructure",
  contact: "adam@integralayer.com",
  telegram: "adamboudj",
};

const nawarOwner: Owner = {
  name: "Nawar",
  role: "Backend Engineering",
  contact: "nawar@integralayer.com",
  telegram: "iamnawar",
};

function makeResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    id: "test-endpoint",
    name: "Test Endpoint",
    url: "https://example.com/health",
    category: "apis",
    environment: "prod",
    status: "DOWN",
    responseTimeMs: 1234,
    timestamp: "2026-05-10T12:00:00Z",
    details: {},
    error: "connection refused",
    dependsOn: [],
    impacts: [],
    impactDescription: null,
    description: null,
    richDescription: null,
    owner: nawarOwner,
    links: { endpoint: "https://example.com/health" },
    commonIssues: [],
    tags: [],
    ...overrides,
  };
}

function makeSummary(overrides: Partial<HealthSummary> = {}): HealthSummary {
  return {
    timestamp: "2026-05-10T12:00:00Z",
    total: 10,
    up: 8,
    degraded: 1,
    down: 1,
    deploying: 0,
    appGroups: [],
    dependencyGraph: {},
    impactMap: {},
    results: [],
    history: {
      sparklines: {},
      uptimes: {},
      incidents: [],
      dataPoints: 0,
      spanMinutes: 0,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// escapeHtml — Telegram HTML parse mode safety
// ---------------------------------------------------------------------------

describe("escapeHtml", () => {
  it("escapes the three HTML-significant characters", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml("foo<bar>baz&qux")).toBe("foo&lt;bar&gt;baz&amp;qux");
  });

  it("handles null/undefined safely", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("leaves safe strings unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
    expect(escapeHtml("Adam's box")).toBe("Adam's box");
    expect(escapeHtml("port 8080")).toBe("port 8080");
  });

  it("escapes & before < and > so single-pass results are valid", () => {
    // If we escaped < → &lt; first, a literal `&` would become `&amp;lt;`.
    // The implementation must escape `&` first.
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});

// ---------------------------------------------------------------------------
// formatAlert — single-endpoint DOWN/DEGRADED/RECOVERED
// ---------------------------------------------------------------------------

describe("formatAlert", () => {
  it("renders DOWN with name, URL, error, owner, and CTO cc", () => {
    const out = formatAlert(
      { fromStatus: "UP", toStatus: "DOWN" },
      makeResult({ name: "Dashboard API", error: "HTTP 503" }),
    );
    expect(out).toContain("DOWN: Dashboard API");
    expect(out).toContain("🔴");
    expect(out).toContain("HTTP 503");
    expect(out).toContain("@iamnawar");
    expect(out).toContain("cc @adamboudj");
    expect(out).toContain("https://status.integralayer.com");
  });

  it("does NOT add cc CTO line when owner IS the CTO (no double-mention)", () => {
    const out = formatAlert(
      { fromStatus: "UP", toStatus: "DOWN" },
      makeResult({ owner: adamOwner }),
    );
    expect(out).toContain("@adamboudj");
    expect(out).not.toContain("cc @adamboudj");
  });

  it("HTML-escapes endpoint name and error to prevent parse-mode failure", () => {
    const out = formatAlert(
      { fromStatus: "UP", toStatus: "DOWN" },
      makeResult({
        name: "Service <prod>",
        error: "Got <html>error</html> & retry failed",
      }),
    );
    expect(out).toContain("Service &lt;prod&gt;");
    expect(out).toContain("Got &lt;html&gt;error&lt;/html&gt; &amp; retry failed");
    expect(out).not.toMatch(/<script|<html>error/);
  });

  it("includes possible causes (max 3) on DOWN/DEGRADED only", () => {
    const result = makeResult({
      commonIssues: [
        { cause: "Cause A", fix: "Fix A" },
        { cause: "Cause B", fix: "Fix B" },
        { cause: "Cause C", fix: "Fix C" },
        { cause: "Cause D should be cut", fix: "Fix D" },
      ],
    });
    const downOut = formatAlert({ fromStatus: "UP", toStatus: "DOWN" }, result);
    expect(downOut).toContain("Possible causes");
    expect(downOut).toContain("Cause A");
    expect(downOut).toContain("Cause C");
    expect(downOut).not.toContain("Cause D should be cut");

    const upOut = formatAlert({ fromStatus: "DOWN", toStatus: "UP" }, result);
    expect(upOut).not.toContain("Possible causes");
  });

  it("renders DEPLOYING with the blue label", () => {
    const out = formatAlert(
      { fromStatus: "DOWN", toStatus: "DEPLOYING" },
      makeResult(),
    );
    expect(out).toContain("DEPLOYING:");
    expect(out).toContain("🔵");
  });

  it("emits the quick-link footer with status + repo + endpoint URL", () => {
    const out = formatAlert(
      { fromStatus: "UP", toStatus: "DOWN" },
      makeResult({ url: "https://api.example.com" }),
    );
    expect(out).toContain("https://status.integralayer.com");
    expect(out).toContain("github.com/Integra-layer/integra-status");
    expect(out).toContain("https://api.example.com");
  });
});

// ---------------------------------------------------------------------------
// formatRecovery
// ---------------------------------------------------------------------------

describe("formatRecovery", () => {
  it("formats sub-minute downtime in seconds", () => {
    const out = formatRecovery(makeResult({ status: "UP" }), 42);
    expect(out).toContain("42s");
    expect(out).toContain("RECOVERED");
  });

  it("formats minute-scale downtime as Xm Ys", () => {
    const out = formatRecovery(makeResult({ status: "UP" }), 125);
    expect(out).toContain("2m 5s");
  });

  it("formats hour-scale downtime as Xh Ym", () => {
    const out = formatRecovery(makeResult({ status: "UP" }), 3 * 3600 + 14 * 60);
    expect(out).toContain("3h 14m");
  });

  it("HTML-escapes the recovery name", () => {
    const out = formatRecovery(
      makeResult({ status: "UP", name: "Service <test>" }),
      30,
    );
    expect(out).toContain("Service &lt;test&gt;");
  });

  it("includes the quick-link footer", () => {
    const out = formatRecovery(makeResult({ status: "UP" }), 30);
    expect(out).toContain("status.integralayer.com");
  });
});

// ---------------------------------------------------------------------------
// formatGroupedAlert — multi-endpoint enrichment
// ---------------------------------------------------------------------------

describe("formatGroupedAlert", () => {
  it("renders summary header with DOWN / DEGRADED / RECOVERED counts", () => {
    const out = formatGroupedAlert([
      {
        result: makeResult({ name: "A" }),
        fromStatus: "UP",
        toStatus: "DOWN",
      },
      {
        result: makeResult({ name: "B", status: "UP", error: null }),
        fromStatus: "DOWN",
        toStatus: "UP",
      },
      {
        result: makeResult({ name: "C", status: "DEGRADED" }),
        fromStatus: "UP",
        toStatus: "DEGRADED",
      },
    ]);
    expect(out).toContain("Multiple Status Changes");
    expect(out).toContain("(3)");
    expect(out).toContain("1 DOWN");
    expect(out).toContain("1 DEGRADED");
    expect(out).toContain("1 RECOVERED");
  });

  it("includes per-row error and impact (the missing-detail bug)", () => {
    const out = formatGroupedAlert([
      {
        result: makeResult({
          name: "Dashboard API",
          error: "DB pool exhausted",
          impactDescription: "Dashboard fully unavailable",
        }),
        fromStatus: "UP",
        toStatus: "DOWN",
      },
    ]);
    expect(out).toContain("Dashboard API");
    expect(out).toContain("DB pool exhausted");
    expect(out).toContain("Dashboard fully unavailable");
  });

  it("dedups owner mentions and always includes CTO at the bottom", () => {
    const out = formatGroupedAlert([
      {
        result: makeResult({ name: "A", owner: nawarOwner }),
        fromStatus: "UP",
        toStatus: "DOWN",
      },
      {
        result: makeResult({ name: "B", owner: nawarOwner }),
        fromStatus: "UP",
        toStatus: "DOWN",
      },
      {
        result: makeResult({ name: "C", owner: adamOwner }),
        fromStatus: "UP",
        toStatus: "DOWN",
      },
    ]);
    // CTO mention once + Nawar once at the bottom (per-row mentions are separate).
    const ccLine = out.split("\n").find((l) => l.startsWith("👤 cc"));
    expect(ccLine).toBeDefined();
    expect(ccLine).toContain("@adamboudj");
    expect(ccLine).toContain("@iamnawar");
    // Each handle appears exactly once in the cc line.
    expect(ccLine!.match(/@adamboudj/g)?.length).toBe(1);
    expect(ccLine!.match(/@iamnawar/g)?.length).toBe(1);
  });

  it("HTML-escapes per-row dynamic content", () => {
    const out = formatGroupedAlert([
      {
        result: makeResult({
          name: "<bad>",
          error: "err with <html>",
          impactDescription: "impact <a>",
        }),
        fromStatus: "UP",
        toStatus: "DOWN",
      },
    ]);
    expect(out).toContain("&lt;bad&gt;");
    expect(out).toContain("err with &lt;html&gt;");
    expect(out).toContain("impact &lt;a&gt;");
  });

  it("does NOT show error for RECOVERED rows (uses ✓ + responseTime)", () => {
    const out = formatGroupedAlert([
      {
        result: makeResult({
          name: "Recovered Service",
          status: "UP",
          error: null,
          responseTimeMs: 250,
        }),
        fromStatus: "DOWN",
        toStatus: "UP",
      },
    ]);
    expect(out).toContain("Recovered Service");
    expect(out).toContain("250ms");
  });
});

// ---------------------------------------------------------------------------
// formatStatusOverview / formatDailyDigest
// ---------------------------------------------------------------------------

describe("formatStatusOverview", () => {
  it("hides DOWN/DEGRADED lines when counts are zero", () => {
    const out = formatStatusOverview(
      makeSummary({ up: 10, degraded: 0, down: 0 }),
    );
    expect(out).toContain("10");
    expect(out).toContain("Operational");
    expect(out).not.toContain("Degraded");
    expect(out).not.toContain("Down");
  });

  it("shows DEPLOYING line only when > 0", () => {
    const withDeploy = formatStatusOverview(
      makeSummary({ up: 5, deploying: 1 }),
    );
    expect(withDeploy).toContain("Deploying");

    const noDeploy = formatStatusOverview(
      makeSummary({ up: 5, deploying: 0 }),
    );
    expect(noDeploy).not.toContain("Deploying");
  });
});

describe("formatDailyDigest", () => {
  it("emits 'All systems operational' when no issues", () => {
    const out = formatDailyDigest(
      makeSummary({ up: 10, degraded: 0, down: 0, results: [] }),
    );
    expect(out).toContain("All systems operational");
  });

  it("lists specific DOWN endpoints with owner + error reason", () => {
    const downResult = makeResult({
      name: "Dashboard API",
      error: "HTTP 503",
      owner: nawarOwner,
    });
    const out = formatDailyDigest(
      makeSummary({ up: 9, down: 1, results: [downResult] }),
    );
    expect(out).toContain("DOWN (1)");
    expect(out).toContain("Dashboard API");
    expect(out).toContain("@iamnawar");
    expect(out).toContain("HTTP 503");
  });

  it("lists DEGRADED separately from DOWN", () => {
    const degraded = makeResult({
      name: "Slow Service",
      status: "DEGRADED",
      error: "p99 > 5s",
    });
    const down = makeResult({ name: "Dead Service", status: "DOWN" });
    const out = formatDailyDigest(
      makeSummary({
        up: 8,
        degraded: 1,
        down: 1,
        results: [degraded, down],
      }),
    );
    expect(out).toContain("DOWN (1)");
    expect(out).toContain("Dead Service");
    expect(out).toContain("DEGRADED (1)");
    expect(out).toContain("Slow Service");
    expect(out).toContain("p99 &gt; 5s");
  });
});

// ---------------------------------------------------------------------------
// formatEndpointDetail / formatCategoryDetail / formatHelp
// ---------------------------------------------------------------------------

describe("formatEndpointDetail", () => {
  it("renders status, response time, owner, and tags", () => {
    const out = formatEndpointDetail(
      makeResult({
        status: "UP",
        tags: ["NestJS", "PostgreSQL"],
        owner: nawarOwner,
      }),
      [],
      0.995,
    );
    expect(out).toContain("UP");
    expect(out).toContain("Nawar");
    expect(out).toContain("99.5%");
    expect(out).toContain("NestJS, PostgreSQL");
  });

  it("escapes a description containing HTML", () => {
    const out = formatEndpointDetail(
      makeResult({
        status: "UP",
        description: "Test <api> & legacy",
      }),
      [],
      undefined,
    );
    expect(out).toContain("Test &lt;api&gt; &amp; legacy");
  });
});

describe("formatCategoryDetail", () => {
  it("renders one row per result with the correct status emoji", () => {
    const out = formatCategoryDetail("apis", [
      makeResult({ name: "A", status: "UP", responseTimeMs: 100 }),
      makeResult({ name: "B", status: "DEGRADED", responseTimeMs: 200 }),
      makeResult({ name: "C", status: "DOWN", responseTimeMs: 0 }),
    ]);
    expect(out).toContain("🟢 A");
    expect(out).toContain("🟡 B");
    expect(out).toContain("🔴 C");
    expect(out).toContain("100ms");
  });
});

describe("formatHelp", () => {
  it("returns the static command list with the correct bot name", () => {
    const out = formatHelp();
    expect(out).toContain("IntegraHealthBot");
    expect(out).toContain("/status");
    expect(out).toContain("/check");
    expect(out).toContain("/category");
    expect(out).toContain("/down");
    expect(out).toContain("/degraded");
  });
});

// ---------------------------------------------------------------------------
// asciiSparkline
// ---------------------------------------------------------------------------

describe("asciiSparkline", () => {
  it("returns the right width even with all-null input", () => {
    expect(asciiSparkline([null, null, null], 10).length).toBe(10);
  });

  it("uses the highest block char for the max value", () => {
    const out = asciiSparkline([1, 2, 3, 4, 5, 6, 7, 8], 8);
    expect(out.length).toBe(8);
    expect(out).toContain("█");
  });

  it("treats zero/negative values as missing data", () => {
    expect(asciiSparkline([0, 0, 0], 3)).toBe("▁▁▁");
  });
});

// ---------------------------------------------------------------------------
// Flapping-incident formatters
// ---------------------------------------------------------------------------

describe("formatFlapStart", () => {
  it("renders the flap count + impact and HTML-escapes the name", () => {
    const out = formatFlapStart(
      makeResult({ name: "City <API>", impactDescription: "Game down" }),
      6,
    );
    expect(out).toContain("FLAPPING: City &lt;API&gt;");
    expect(out).toContain("6 status changes");
    expect(out).toContain("Game down");
    expect(out).toContain("🔁");
  });
});

describe("formatFlapDigest", () => {
  it("shows the open duration and current status", () => {
    const out = formatFlapDigest(
      makeResult({ name: "City API", status: "DOWN" }),
      9,
      2 * 3600 + 5 * 60,
    );
    expect(out).toContain("STILL FLAPPING");
    expect(out).toContain("9 status changes");
    expect(out).toContain("2h 5m");
    expect(out).toContain("DOWN");
  });
});

describe("formatIncidentResolved", () => {
  it("reports a clean UP recovery", () => {
    const out = formatIncidentResolved(
      makeResult({ name: "City API", status: "UP" }),
      30 * 60,
    );
    expect(out).toContain("STABILISED: City API");
    expect(out).toContain("30m");
    expect(out).toContain("All systems operational");
  });

  it("pages with error + causes when the endpoint settles non-UP", () => {
    const out = formatIncidentResolved(
      makeResult({
        name: "City API",
        status: "DOWN",
        error: "HTTP 503",
        commonIssues: [{ cause: "App Runner overload", fix: "scale up" }],
      }),
      45 * 60,
    );
    expect(out).toContain("SETTLED DOWN");
    expect(out).toContain("HTTP 503");
    expect(out).toContain("App Runner overload");
  });
});

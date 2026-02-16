import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { checkAll } from "@/lib/health";
import { getEndpoint, getDependencyGraph, APP_GROUPS } from "@/lib/health-config";
import {
  loadHistory,
  recordSnapshot,
  saveHistory,
  getSparklines,
  getUptimes,
  getIncidents,
} from "@/lib/history";
import { StatusBadge } from "@/components/status-badge";
import { Sparkline } from "@/components/sparkline";
import { EndpointLinks } from "@/components/endpoint-links";
import { TroubleshootingHint } from "@/components/troubleshooting-hint";
import { DependencyGraph } from "@/components/dependency-graph";
import { IncidentTimeline } from "@/components/incident-timeline";
import { UptimeBar } from "@/components/uptime-bar";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const endpoint = getEndpoint(id);
  if (!endpoint) notFound();

  const results = await checkAll();
  const result = results.find((r) => r.id === id);
  if (!result) notFound();

  // Record history for sparklines
  let hist = loadHistory();
  hist = recordSnapshot(hist, results);
  saveHistory(hist);

  const sparklines = getSparklines(hist);
  const uptimes = getUptimes(hist);
  const incidents = getIncidents(hist);
  const depGraph = getDependencyGraph();

  // Compute response time stats from sparkline data
  const sparkData = sparklines[id] ?? [];
  const validTimes = sparkData.filter(
    (v): v is number => v !== null && v > 0,
  );
  const stats = {
    avg:
      validTimes.length > 0
        ? Math.round(
            validTimes.reduce((a, b) => a + b, 0) / validTimes.length,
          )
        : 0,
    min: validTimes.length > 0 ? Math.min(...validTimes) : 0,
    max: validTimes.length > 0 ? Math.max(...validTimes) : 0,
    p99:
      validTimes.length > 0
        ? validTimes.sort((a, b) => a - b)[
            Math.floor(validTimes.length * 0.99)
          ]
        : 0,
  };

  // Get dependency info for this endpoint
  const node = depGraph[id];
  const dependsOn = node?.dependsOn ?? [];
  const requiredBy = node?.requiredBy ?? [];

  // Build uptime bar buckets from sparkline data (true = responded, false = timeout/null)
  const uptimeBuckets = sparkData.map((v) => (v === null ? null : v > 0));

  // Filter incidents for this endpoint
  const endpointIncidents = incidents.filter((inc) => inc.id === id);

  return (
    <div className="min-h-screen bg-surface page-transition">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        {/* Header card */}
        <div className="rounded-xl border border-border-strong/30 bg-surface-card p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-text">
                {result.name}
              </h1>
              <p className="text-sm text-text-muted mt-1">
                {result.richDescription || result.description}
              </p>
            </div>
            <StatusBadge status={result.status} />
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <div>
              <p className="text-xs text-text-muted">Environment</p>
              <p className="text-sm font-medium capitalize">
                {result.environment}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Category</p>
              <p className="text-sm font-medium capitalize">
                {result.category}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Owner</p>
              <p className="text-sm font-medium">
                {result.owner ? (
                  <>
                    {result.owner.name}
                    {result.owner.telegram && (
                      <>
                        {" — "}
                        <a
                          href={`https://t.me/${result.owner.telegram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          @{result.owner.telegram}
                        </a>
                      </>
                    )}
                  </>
                ) : (
                  "\u2014"
                )}
              </p>
              {result.owner?.role && (
                <p className="text-xs text-text-muted mt-0.5">
                  {result.owner.role}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-text-muted">Uptime</p>
              <p className="text-sm font-medium font-mono">
                {uptimes[id] != null
                  ? `${(uptimes[id] * 100).toFixed(1)}%`
                  : "\u2014"}
              </p>
            </div>
          </div>

          {/* Tags */}
          {result.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {result.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-text-muted dark:bg-neutral-800"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Response time sparkline (large) */}
        <div className="rounded-xl border border-border-strong/30 bg-surface-card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Response Time</h2>
          <Sparkline data={sparkData} width={600} height={80} />
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div>
              <p className="text-xs text-text-muted">Average</p>
              <p className="font-mono text-sm">{stats.avg}ms</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Min</p>
              <p className="font-mono text-sm">{stats.min}ms</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Max</p>
              <p className="font-mono text-sm">{stats.max}ms</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">p99</p>
              <p className="font-mono text-sm">{stats.p99}ms</p>
            </div>
          </div>
        </div>

        {/* Uptime history bar */}
        {uptimeBuckets.length > 0 && (
          <div className="rounded-xl border border-border-strong/30 bg-surface-card p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Uptime History</h2>
            <UptimeBar buckets={uptimeBuckets} />
          </div>
        )}

        {/* Links */}
        <div className="rounded-xl border border-border-strong/30 bg-surface-card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Direct Links</h2>
          <EndpointLinks links={result.links} />
        </div>

        {/* Troubleshooting (always visible on detail page) */}
        {result.commonIssues.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Troubleshooting</h2>
            <TroubleshootingHint
              issues={result.commonIssues}
              status={result.status === "UP" ? "DEGRADED" : result.status}
            />
          </div>
        )}

        {/* Dependency graph */}
        {(dependsOn.length > 0 || requiredBy.length > 0) && (
          <div className="rounded-xl border border-border-strong/30 bg-surface-card p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Dependencies</h2>
            <DependencyGraph
              currentId={id}
              dependsOn={dependsOn}
              requiredBy={requiredBy}
              results={results}
              dependencyGraph={depGraph}
            />
          </div>
        )}

        {/* Incident timeline */}
        {endpointIncidents.length > 0 && (
          <div className="rounded-xl border border-border-strong/30 bg-surface-card p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Incidents</h2>
            <IncidentTimeline incidents={endpointIncidents} />
          </div>
        )}
      </div>
    </div>
  );
}

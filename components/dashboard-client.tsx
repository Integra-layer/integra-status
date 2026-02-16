"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Blocks, Shield, Server, Globe, Link2, ChevronDown } from "lucide-react";
import { Header } from "@/components/header";
import { SummaryBar } from "@/components/summary-bar";
import { SearchBar, type ViewMode } from "@/components/search-bar";
import { SimpleView } from "@/components/simple-view";
import { CategorySection } from "@/components/category-section";
import { IncidentTimeline } from "@/components/incident-timeline";
import { Footer } from "@/components/footer";
import { ErrorBoundary } from "@/components/error-boundary";
import { getAllBlastRadii } from "@/lib/graph-utils";
import { capitalize } from "@/lib/utils";

const NetworkGraph = dynamic(() => import("@/components/network-graph").then(m => ({ default: m.NetworkGraph })), { ssr: false });
const Celebration = dynamic(() => import("@/components/celebration").then(m => ({ default: m.Celebration })), { ssr: false });
import type { HealthSummary, Category, Environment } from "@/lib/types";

// ---------------------------------------------------------------------------
// Category icon map
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  blockchain: <Blocks className="h-5 w-5" />,
  validators: <Shield className="h-5 w-5" />,
  apis: <Server className="h-5 w-5" />,
  frontends: <Globe className="h-5 w-5" />,
  external: <Link2 className="h-5 w-5" />,
};

// ---------------------------------------------------------------------------
// Dashboard client component
// ---------------------------------------------------------------------------

type DashboardClientProps = {
  data: HealthSummary;
  categories: Category[];
};

export function DashboardClient({ data, categories }: DashboardClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [activeEnvironment, setActiveEnvironment] = useState<Environment | "all">("all");
  const [showTimeline, setShowTimeline] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("integra-view-mode") as ViewMode) || "detailed";
    }
    return "detailed";
  });

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("integra-view-mode", mode);
  }, []);

  // Compute blast radii from dependency graph (client-side BFS)
  const blastRadii = useMemo(
    () => getAllBlastRadii(data.dependencyGraph),
    [data.dependencyGraph],
  );

  // Track previous statuses for flash animations
  const prevStatusRef = useRef<Record<string, string>>({});
  const [flashClasses, setFlashClasses] = useState<Record<string, string>>({});

  useEffect(() => {
    const prev = prevStatusRef.current;
    const next: Record<string, string> = {};
    const flashes: Record<string, string> = {};

    for (const r of data.results) {
      next[r.id] = r.status;
      const old = prev[r.id];
      if (old && old !== r.status) {
        if (r.status === "DOWN" || r.status === "DEGRADED") {
          flashes[r.id] = "status-flash-down";
        } else if (r.status === "UP" && (old === "DOWN" || old === "DEGRADED")) {
          flashes[r.id] = "status-flash-recovery";
        }
      }
    }

    prevStatusRef.current = next;

    if (Object.keys(flashes).length > 0) {
      setFlashClasses(flashes);
      const timer = setTimeout(() => setFlashClasses({}), 1500);
      return () => clearTimeout(timer);
    }
  }, [data.results]);

  // Scroll progress bar
  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-refresh: trigger ISR revalidation every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 60_000);
    return () => clearInterval(interval);
  }, [router]);

  // Category toggle
  const toggleCategory = useCallback((category: string) => {
    setActiveCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  }, []);

  // Filter results by search query, active categories, and environment
  const filteredResults = data.results.filter((r) => {
    if (activeCategories.length > 0 && !activeCategories.includes(r.category)) {
      return false;
    }
    if (activeEnvironment !== "all" && r.environment !== activeEnvironment) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const haystack = [r.id, r.name, r.description ?? "", ...(r.tags ?? [])]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // Group filtered results by category
  const categoryResults: Array<{
    name: string;
    icon: React.ReactNode;
    results: typeof filteredResults;
  }> = [];

  for (const cat of categories) {
    const catResults = filteredResults.filter((r) => r.category === cat);
    if (catResults.length > 0) {
      categoryResults.push({
        name: capitalize(cat),
        icon: CATEGORY_ICONS[cat] ?? <Server className="h-5 w-5" />,
        results: catResults,
      });
    }
  }

  // Recent incidents (last 10)
  const recentIncidents = useMemo(() => {
    const sorted = [...data.history.incidents].sort((a, b) => b.at - a.at);
    return sorted.slice(0, 10);
  }, [data.history.incidents]);

  // Endpoint ID → name map for incident timeline
  const endpointNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of data.results) {
      map[r.id] = r.name;
    }
    return map;
  }, [data.results]);

  const allUp = data.down === 0 && data.degraded === 0;

  return (
    <div className="min-h-screen bg-surface page-transition">
      {/* Scroll progress bar */}
      <div
        className="scroll-progress"
        style={{ width: `${scrollProgress}%` }}
        aria-hidden="true"
      />

      {/* All-UP celebration confetti */}
      <Celebration allUp={allUp} />

      <Header lastChecked={data.timestamp} endpointCount={data.total} />
      <SummaryBar up={data.up} degraded={data.degraded} down={data.down} />

      {/* Screen reader announcement for critical alerts */}
      {data.down > 0 && (
        <div aria-live="assertive" className="sr-only">
          {data.down} service{data.down !== 1 ? "s" : ""} currently down.
        </div>
      )}

      <ErrorBoundary>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <SearchBar
            endpointCount={data.total}
            categories={categories}
            activeCategories={activeCategories}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onCategoryToggle={toggleCategory}
            activeEnvironment={activeEnvironment}
            onEnvironmentChange={setActiveEnvironment}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
        </div>

        {/* Network graph — visible in both views */}
        <div className="mb-6">
          <NetworkGraph data={data} compact={viewMode === "simple"} />
        </div>

        {viewMode === "simple" ? (
          <SimpleView data={data} categories={categories} />
        ) : (
          <>
            {/* Category sections */}
            <div className="space-y-4">
              {categoryResults.map((cat) => (
                <CategorySection
                  key={cat.name}
                  name={cat.name}
                  icon={cat.icon}
                  results={cat.results}
                  sparklines={data.history.sparklines}
                  uptimes={data.history.uptimes}
                  defaultOpen={cat.results.some(
                    (r) => r.status === "DOWN" || r.status === "DEGRADED",
                  )}
                  blastRadii={blastRadii}
                  impactMap={data.impactMap}
                  dependencyGraph={data.dependencyGraph}
                  allResults={data.results}
                  flashClasses={flashClasses}
                />
              ))}

              {categoryResults.length === 0 && (
                <div className="rounded-xl border border-border-strong/30 bg-surface-card p-8 text-center">
                  <p className="text-sm text-text-muted">
                    No endpoints match your search.
                  </p>
                </div>
              )}
            </div>

            {/* Incident timeline (collapsible) */}
            {recentIncidents.length > 0 && (
              <div className="mt-6 rounded-xl border border-border-strong/30 bg-surface-card dark:bg-surface-dark-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowTimeline((p) => !p)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <h2 className="text-sm font-semibold">Recent Incidents</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {recentIncidents.length} event{recentIncidents.length !== 1 ? "s" : ""}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showTimeline ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>
                {showTimeline && (
                  <div className="border-t border-border-strong/20 p-4">
                    <IncidentTimeline incidents={recentIncidents} endpointNames={endpointNames} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      </ErrorBoundary>

      <Footer endpointCount={data.total} categoryCount={categories.length} />
    </div>
  );
}

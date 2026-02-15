"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Blocks, Shield, Server, Globe, Link2 } from "lucide-react";
import { Header } from "@/components/header";
import { SummaryBar } from "@/components/summary-bar";
import { SearchBar } from "@/components/search-bar";
import { CategorySection } from "@/components/category-section";
import { Footer } from "@/components/footer";
import type { HealthSummary, Category } from "@/lib/types";

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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

  // Auto-refresh: trigger ISR revalidation every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 30_000);
    return () => clearInterval(interval);
  }, [router]);

  // Category toggle: add if not present, remove if already active
  const toggleCategory = useCallback((category: string) => {
    setActiveCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  }, []);

  // Filter results by search query and active categories (AND logic)
  const filteredResults = data.results.filter((r) => {
    // Category filter
    if (
      activeCategories.length > 0 &&
      !activeCategories.includes(r.category)
    ) {
      return false;
    }

    // Search filter: match across id, name, description, tags
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const haystack = [
        r.id,
        r.name,
        r.description ?? "",
        ...(r.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }

    return true;
  });

  // Group filtered results by category, preserving category order
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

  return (
    <div className="min-h-screen bg-surface">
      <Header lastChecked={data.timestamp} endpointCount={data.total} />
      <SummaryBar up={data.up} degraded={data.degraded} down={data.down} />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <SearchBar
            endpointCount={data.total}
            categories={categories}
            activeCategories={activeCategories}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onCategoryToggle={toggleCategory}
          />
        </div>

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
            />
          ))}

          {categoryResults.length === 0 && (
            <div className="rounded-lg border border-border-strong/30 bg-surface-card p-8 text-center">
              <p className="text-sm text-text-muted">
                No endpoints match your search.
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer
        endpointCount={data.total}
        categoryCount={categories.length}
      />
    </div>
  );
}

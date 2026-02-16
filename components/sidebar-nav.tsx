"use client";

import { useScrollSpy } from "@/hooks/use-scroll-spy";
import type { CheckResult } from "@/lib/types";

type SidebarNavProps = {
  categories: Array<{
    name: string;
    icon: React.ReactNode;
    results: CheckResult[];
  }>;
};

const STATUS_DOT = {
  UP: "bg-emerald-500",
  DEGRADED: "bg-amber-500",
  DOWN: "bg-red-500",
} as const;

function getWorstStatus(results: CheckResult[]): "UP" | "DEGRADED" | "DOWN" {
  if (results.some((r) => r.status === "DOWN")) return "DOWN";
  if (results.some((r) => r.status === "DEGRADED")) return "DEGRADED";
  return "UP";
}

export function SidebarNav({ categories }: SidebarNavProps) {
  const sectionIds = categories.map(
    (cat) => `category-${cat.name.toLowerCase()}`,
  );
  const activeId = useScrollSpy(sectionIds);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <nav
      className="hidden lg:block fixed left-4 top-48 w-44 space-y-1"
      aria-label="Section navigation"
    >
      {categories.map((cat) => {
        const sectionId = `category-${cat.name.toLowerCase()}`;
        const isActive = activeId === sectionId;
        const worst = getWorstStatus(cat.results);
        const upCount = cat.results.filter((r) => r.status === "UP").length;

        return (
          <button
            key={cat.name}
            type="button"
            onClick={() => scrollTo(sectionId)}
            className={`w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-all duration-200 cursor-pointer ${
              isActive
                ? "bg-brand/10 text-brand border-l-2 border-brand"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${STATUS_DOT[worst]}`}
              aria-hidden="true"
            />
            <span className="truncate">{cat.name}</span>
            <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
              {upCount}/{cat.results.length}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

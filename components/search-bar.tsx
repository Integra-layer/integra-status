"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { Environment } from "@/lib/types";

export type ViewMode = "simple" | "detailed";

type SearchBarProps = {
  endpointCount: number;
  categories: string[];
  activeCategories: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCategoryToggle: (category: string) => void;
  activeEnvironment?: Environment | "all";
  onEnvironmentChange?: (env: Environment | "all") => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const ENVIRONMENTS: Array<{ key: Environment | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "prod", label: "Production" },
  { key: "dev", label: "Development" },
  { key: "staging", label: "Staging" },
  { key: "release", label: "Release" },
];

export function SearchBar({
  endpointCount,
  categories,
  activeCategories,
  searchQuery,
  onSearchChange,
  onCategoryToggle,
  activeEnvironment = "all",
  onEnvironmentChange,
  viewMode = "detailed",
  onViewModeChange,
}: SearchBarProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const debouncedChange = useCallback(
    (value: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onSearchChange(value);
      }, 200);
    },
    [onSearchChange],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }

      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        e.preventDefault();
        setLocalQuery("");
        onSearchChange("");
        inputRef.current?.blur();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onSearchChange]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setLocalQuery(value);
    debouncedChange(value);
  }

  return (
    <div className="w-full space-y-3">
      {/* View mode toggle + Environment filter */}
      <div className="flex flex-wrap items-center gap-3">
        {onViewModeChange && (
          <div
            className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-1"
            role="tablist"
            aria-label="View mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "simple"}
              onClick={() => onViewModeChange("simple")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
                viewMode === "simple"
                  ? "bg-white dark:bg-neutral-800 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Simple
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "detailed"}
              onClick={() => onViewModeChange("detailed")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
                viewMode === "detailed"
                  ? "bg-white dark:bg-neutral-800 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Detailed
            </button>
          </div>
        )}

      {/* Environment filter tabs */}
      {onEnvironmentChange && (
        <div
          className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-1 w-fit"
          role="tablist"
          aria-label="Filter by environment"
        >
          {ENVIRONMENTS.map((env) => (
            <button
              key={env.key}
              type="button"
              role="tab"
              aria-selected={activeEnvironment === env.key}
              onClick={() => onEnvironmentChange(env.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
                activeEnvironment === env.key
                  ? "bg-white dark:bg-neutral-800 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {env.label}
            </button>
          ))}
        </div>
      )}
      </div>

      {/* Search input */}
      <div className="group relative">
        <label htmlFor="endpoint-search" className="sr-only">
          Search endpoints
        </label>
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted dark:text-text-light-muted pointer-events-none"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          id="endpoint-search"
          type="search"
          value={localQuery}
          onChange={handleInputChange}
          placeholder={`Search ${endpointCount} endpoints...`}
          className="pl-10 pr-4 h-11 bg-surface-card dark:bg-surface-dark-card border-border-strong/30 dark:border-border-dark-strong/30 rounded-lg text-sm focus-visible:ring-brand/30 focus-visible:border-brand transition-all duration-200"
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
          style={{
            background:
              "linear-gradient(90deg, var(--color-brand-pink), var(--color-brand), var(--color-brand-dark))",
          }}
          aria-hidden="true"
        />
        {!localQuery && (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-text-muted dark:text-text-light-muted">
            /
          </kbd>
        )}
      </div>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by category"
        >
          {categories.map((category) => {
            const isActive = activeCategories.includes(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => onCategoryToggle(category)}
                aria-pressed={isActive}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none ${
                  isActive
                    ? "bg-brand/10 text-brand border-brand hover:bg-brand/20"
                    : "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                }`}
              >
                {capitalize(category)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

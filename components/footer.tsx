import { IntegraLogo } from "@/components/integra-logo";

interface FooterProps {
  endpointCount: number;
  categoryCount: number;
}

export function Footer({ endpointCount, categoryCount }: FooterProps) {
  return (
    <footer className="mt-12 border-t border-border-strong/50 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 sm:flex-row sm:justify-between sm:px-6">
        {/* Left: logo + monitoring info */}
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <IntegraLogo variant="mark" className="h-6 w-6" />
          <span>
            Monitoring {endpointCount} endpoint{endpointCount !== 1 ? "s" : ""}{" "}
            across {categoryCount} categor{categoryCount !== 1 ? "ies" : "y"}
          </span>
        </div>

        {/* Right: auto-refresh indicator */}
        <div className="flex items-center gap-1.5 text-xs text-text-subtle">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-success"
            style={{ animation: "pulse-green 2s ease-in-out infinite" }}
            aria-hidden="true"
          />
          Auto-refreshes every 30s
        </div>
      </div>
    </footer>
  );
}

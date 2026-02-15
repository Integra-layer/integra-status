import { IntegraLogo } from "@/components/integra-logo";

interface HeaderProps {
  lastChecked: string;
  endpointCount: number;
}

function getRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Header({ lastChecked, endpointCount }: HeaderProps) {
  return (
    <header className="relative w-full">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        {/* Left: logo + title */}
        <div className="flex items-center gap-3">
          <IntegraLogo variant="mark" className="h-10 w-10" />
          <h1 className="text-xl font-semibold text-text sm:text-2xl">
            Infrastructure Status
          </h1>
        </div>

        {/* Right: meta info */}
        <div className="flex items-center gap-4 text-sm text-text-muted">
          <span className="hidden sm:inline">
            {endpointCount} endpoint{endpointCount !== 1 ? "s" : ""}
          </span>
          <time
            dateTime={lastChecked}
            title={new Date(lastChecked).toLocaleString()}
            className="tabular-nums"
          >
            Updated {getRelativeTime(lastChecked)}
          </time>
        </div>
      </div>

      {/* Animated brand gradient bottom border */}
      <div
        className="gradient-border-animated h-px w-full"
        aria-hidden="true"
      />
    </header>
  );
}

import type { Status, CommonIssue } from "@/lib/types";

interface TroubleshootingHintProps {
  issues: CommonIssue[];
  status: Status;
}

export function TroubleshootingHint({
  issues,
  status,
}: TroubleshootingHintProps) {
  // Only render for DOWN or DEGRADED with actual issues
  if (status === "UP" || issues.length === 0) {
    return null;
  }

  const isDown = status === "DOWN";
  const containerClass = isDown
    ? "bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800"
    : "bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800";

  const headerClass = isDown
    ? "text-red-800 dark:text-red-300"
    : "text-amber-800 dark:text-amber-300";

  const mutedClass = isDown
    ? "text-red-600 dark:text-red-400"
    : "text-amber-600 dark:text-amber-400";

  return (
    <div
      className={`rounded-xl p-4 ${containerClass}`}
      role={isDown ? "alert" : "status"}
    >
      <h4 className={`mb-2 text-sm font-semibold ${headerClass}`}>
        Possible causes:
      </h4>
      <ul className="space-y-2">
        {issues.map((issue, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                isDown ? "bg-red-400" : "bg-amber-400"
              }`}
              aria-hidden="true"
            />
            <div>
              <span className={headerClass}>{issue.cause}</span>
              <span className={`ml-1 ${mutedClass}`}>
                — Fix: {issue.fix}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

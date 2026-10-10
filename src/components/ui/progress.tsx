import { cn } from "@/lib/utils";

/** Simple deterministic progress/meter bar. `value` is 0–100. */
export function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-secondary", className)}
    >
      <div
        className={cn("h-full rounded-full transition-all", indicatorClassName ?? "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

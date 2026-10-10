import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ComputedMetrics } from "@/lib/financial/calculations";
import type { DerivedMetric } from "@/lib/data/types";
import { Card } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/tooltip";
import { formatMetric } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A single metric tile. Direction colours growth-like metrics meaningfully. */
function MetricTile({
  metric,
  currency,
  signed,
}: {
  metric: DerivedMetric;
  currency: string;
  signed?: boolean;
}) {
  const value = formatMetric(metric, currency);
  const num = metric.value;
  const showTrend = signed && metric.status === "available" && num != null;
  const positive = showTrend && (num as number) >= 0;

  const statusNote =
    metric.status === "unavailable"
      ? "This figure is not present in the dataset."
      : metric.status === "not_meaningful"
        ? metric.note ?? "This value is not meaningfully interpretable."
        : `${metric.method}. Source: FY${metric.sourcePeriods.join(", FY")}.`;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <InfoTooltip content={statusNote}>
          <span className="cursor-help border-b border-dotted border-muted-foreground/40 text-xs font-medium text-muted-foreground">
            {metric.label}
          </span>
        </InfoTooltip>
        {showTrend ? (
          positive ? (
            <TrendingUp className="size-4 text-positive" />
          ) : (
            <TrendingDown className="size-4 text-negative" />
          )
        ) : metric.status === "available" ? null : (
          <Minus className="size-4 text-muted-foreground/50" />
        )}
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-semibold tabular",
          showTrend && (positive ? "text-positive" : "text-negative"),
          metric.status !== "available" && "text-muted-foreground",
        )}
      >
        {value}
      </div>
      {metric.status === "not_meaningful" && (
        <p className="mt-1 text-xs text-caution">Not meaningful</p>
      )}
    </Card>
  );
}

export function MetricCards({
  computed,
  currency,
}: {
  computed: ComputedMetrics;
  currency: string;
}) {
  const m = computed.metrics;
  const order: { id: string; signed?: boolean }[] = [
    { id: "revenue" },
    { id: "revenue_growth", signed: true },
    { id: "net_income", signed: true },
    { id: "net_margin", signed: true },
    { id: "fcf", signed: true },
    { id: "total_debt" },
    { id: "cash" },
    { id: "debt_to_equity" },
    { id: "pe_ratio" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {order.map(({ id, signed }) =>
        m[id] ? <MetricTile key={id} metric={m[id]} currency={currency} signed={signed} /> : null,
      )}
    </div>
  );
}

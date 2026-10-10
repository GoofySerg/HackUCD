import { Scale, CalendarClock } from "lucide-react";
import type { CompanyData } from "@/lib/data/types";
import type { ComputedMetrics } from "@/lib/financial/calculations";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatMetric, formatCurrency, formatDate, NA } from "@/lib/format";

export function ValuationPanel({
  data,
  computed,
}: {
  data: CompanyData;
  computed: ComputedMetrics;
}) {
  const currency = data.identity.currency;
  const v = data.valuation;
  const pe = computed.metrics.pe_ratio;
  const ps = computed.metrics.ps_ratio;
  const fcfYield = computed.metrics.fcf_yield;

  const hasAny =
    pe.status === "available" ||
    ps.status === "available" ||
    (v && (v.marketCapitalization != null || v.earningsPerShare != null));

  const rows: { label: string; value: string }[] = [
    { label: "Share price", value: v?.sharePrice != null ? formatCurrency(v.sharePrice, currency).replace(/([KMBT])$/, "") : NA },
    { label: "Market cap", value: formatCurrency(v?.marketCapitalization ?? null, currency) },
    { label: "Earnings per share", value: v?.earningsPerShare != null ? formatCurrency(v.earningsPerShare, currency) : NA },
    { label: "P/E ratio", value: formatMetric(pe, currency) },
    { label: "P/S ratio", value: formatMetric(ps, currency) },
    { label: "FCF yield", value: formatMetric(fcfYield, currency) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-5 text-accent" />
          Valuation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAny ? (
          <Alert variant="caution">
            <AlertDescription>
              This dataset lacks usable valuation inputs, so StockScope cannot assess whether the
              shares are expensive or inexpensive.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {rows.map((r) => (
                <div key={r.label}>
                  <div className="text-xs text-muted-foreground">{r.label}</div>
                  <div className="tabular text-lg font-semibold">{r.value}</div>
                </div>
              ))}
            </div>
            {v?.asOfDate && (
              <p className="flex items-center gap-1.5 text-xs text-caution">
                <CalendarClock className="size-3.5" />
                Prices as of {formatDate(v.asOfDate)} — may be historical, not live.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Remember: a financially healthy company may still be an expensive investment. These
              metrics use only the supplied data and are not a fair-value estimate.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

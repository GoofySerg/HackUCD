import { Info } from "lucide-react";
import type { CompanyData } from "@/lib/data/types";
import type { ComputedMetrics } from "@/lib/financial/calculations";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatByUnit } from "@/lib/format";

/**
 * Deterministic, plain-language overview of the most important trends. This is
 * NOT AI output — it is generated from the computed metrics so it is always
 * available and always consistent with the numbers on screen.
 */
export function OverviewPanel({
  data,
  computed,
}: {
  data: CompanyData;
  computed: ComputedMetrics;
}) {
  const currency = data.identity.currency;
  const m = computed.metrics;
  const sentences: string[] = [];

  const rg = m.revenue_growth;
  if (rg?.status === "available" && rg.value != null) {
    const dir = rg.value > 0 ? "grew" : rg.value < 0 ? "declined" : "was flat";
    sentences.push(
      `Revenue ${dir} ${formatByUnit(Math.abs(rg.value), "percent", currency)} year over year to ${formatByUnit(m.revenue?.value ?? null, "currency", currency)} in FY${computed.latestFiscalYear}.`,
    );
  } else if (m.revenue?.status === "available") {
    sentences.push(
      `Revenue in FY${computed.latestFiscalYear} was ${formatByUnit(m.revenue.value, "currency", currency)}.`,
    );
  }

  const nm = m.net_margin;
  if (nm?.status === "available" && nm.value != null) {
    const quality = nm.value >= 10 ? "healthy" : nm.value >= 0 ? "thin but positive" : "negative";
    sentences.push(
      `Net profit margin was ${formatByUnit(nm.value, "percent", currency)}, a ${quality} level of profitability.`,
    );
  }

  const fcf = m.fcf;
  if (fcf?.status === "available" && fcf.value != null) {
    sentences.push(
      fcf.value >= 0
        ? `The business generated positive free cash flow of ${formatByUnit(fcf.value, "currency", currency)}.`
        : `Free cash flow was negative at ${formatByUnit(fcf.value, "currency", currency)}, meaning the business consumed cash after capital spending.`,
    );
  }

  const de = m.debt_to_equity;
  if (de?.status === "available" && de.value != null) {
    const lvl = de.value < 1 ? "conservative" : de.value < 2 ? "moderate" : "elevated";
    sentences.push(`Leverage looks ${lvl}, with a debt-to-equity ratio of ${formatByUnit(de.value, "ratio", currency)}.`);
  } else if (de?.status === "not_meaningful") {
    sentences.push(`Debt-to-equity is not meaningfully interpretable (${de.note ?? "equity is zero or negative"}).`);
  }

  if (sentences.length === 0) {
    sentences.push(
      "There is limited complete data to summarise trends. See the metric cards and charts for what is available.",
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="size-4 text-accent" />
          Overview — the key trends in plain language
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-pretty leading-relaxed text-muted-foreground">{sentences.join(" ")}</p>
      </CardContent>
    </Card>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { getCompany } from "@/lib/data/companyRepository";
import { computeMetrics } from "@/lib/financial/calculations";
import { computeHealthScore } from "@/lib/financial/healthScore";
import { detectRedFlags } from "@/lib/financial/redFlags";
import { requestHasReportAccess } from "@/lib/stripe/access";
import { isStripeConfigured, PREMIUM_PRODUCT } from "@/lib/stripe/config";
import { PremiumUnlock } from "@/components/reports/PremiumUnlock";
import { HealthScorePanel } from "@/components/dashboard/HealthScorePanel";
import { RedFlagsPanel } from "@/components/dashboard/RedFlagsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DISCLAIMER_PARAGRAPHS } from "@/lib/disclaimer";
import { formatMetric } from "@/lib/format";

export const dynamic = "force-dynamic";

const PRICE_LABEL = "€2.99";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const data = getCompany(ticker);
  if (!data) notFound();

  const computed = computeMetrics(data);
  const health = computeHealthScore(data);
  const flags = detectRedFlags(data);
  const unlocked = await requestHasReportAccess(data.identity.ticker);
  const stripeConfigured = isStripeConfigured();
  const currency = data.identity.currency;

  const keyMetricIds = ["revenue", "revenue_growth", "net_income", "net_margin", "fcf", "debt_to_equity"];

  return (
    <div className="container py-8 space-y-6">
      <Link
        href={`/company/${data.identity.ticker}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to dashboard
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileText className="size-6 text-primary" />
          Premium Research Report
        </h1>
        <Badge variant="outline">{data.identity.companyName}</Badge>
        {data.dataType === "synthetic" && <Badge variant="caution">Synthetic data</Badge>}
      </div>

      <PremiumUnlock
        ticker={data.identity.ticker}
        unlocked={unlocked}
        stripeConfigured={stripeConfigured}
        priceLabel={PRICE_LABEL}
      />

      <p className="text-sm text-muted-foreground">
        Below is a preview of what the report contains. The full, formatted PDF — using this same
        validated data and analysis — is available once the server confirms your purchase.
      </p>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report contents preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {keyMetricIds.map((id) =>
              computed.metrics[id] ? (
                <div key={id} className="flex justify-between border-b border-border/50 py-1">
                  <span>{computed.metrics[id].label}</span>
                  <span className="tabular font-medium text-foreground">
                    {formatMetric(computed.metrics[id], currency)}
                  </span>
                </div>
              ) : null,
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <HealthScorePanel health={health} />
        <RedFlagsPanel flags={flags} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Included in the PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
            {[
              "Executive summary",
              "Financial health breakdown",
              "Growth & profitability trends",
              "Bull case (AI)",
              "Bear case (AI)",
              "Key risks / red flags",
              "Valuation discussion & limitations",
              "Verified source references",
              "Reporting dates",
              "Educational disclaimer",
            ].map((x) => (
              <li key={x} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" /> {x}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Research limitations & disclaimer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          {DISCLAIMER_PARAGRAPHS.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Note: {PREMIUM_PRODUCT.name} is a test product priced at {PRICE_LABEL}. The free dashboard
        is always accessible without payment.
      </p>
    </div>
  );
}

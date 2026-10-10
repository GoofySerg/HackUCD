import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { getCompany } from "@/lib/data/companyRepository";
import { computeMetrics } from "@/lib/financial/calculations";
import { computeHealthScore } from "@/lib/financial/healthScore";
import { detectRedFlags } from "@/lib/financial/redFlags";
import { isAiConfigured } from "@/lib/ai/openrouter";
import { CompanyHeader } from "@/components/dashboard/CompanyHeader";
import { OverviewPanel } from "@/components/dashboard/OverviewPanel";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { HealthScorePanel } from "@/components/dashboard/HealthScorePanel";
import { RedFlagsPanel } from "@/components/dashboard/RedFlagsPanel";
import { ValuationPanel } from "@/components/dashboard/ValuationPanel";
import { FinancialCharts } from "@/components/charts/FinancialCharts";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import { DisclaimerCard } from "@/components/layout/DisclaimerCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CompanyPage({
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
  const aiConfigured = isAiConfigured();

  return (
    <div className="container py-8 space-y-6">
      <CompanyHeader data={data} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DisclaimerCardWrapper />
        <Link href={`/company/${data.identity.ticker}/report`}>
          <Button variant="outline">
            <FileText /> Premium report
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Financial Dashboard</TabsTrigger>
          <TabsTrigger value="ai">AI Research</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <OverviewPanel data={data} computed={computed} />

          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Key metrics (FY{computed.latestFiscalYear})
            </h2>
            <MetricCards computed={computed} currency={data.identity.currency} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <HealthScorePanel health={health} />
            <RedFlagsPanel flags={flags} />
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Financial trends
            </h2>
            <FinancialCharts trends={computed.trends} currency={data.identity.currency} />
          </section>

          <ValuationPanel data={data} computed={computed} />
        </TabsContent>

        <TabsContent value="ai">
          <AnalysisPanel ticker={data.identity.ticker} aiConfigured={aiConfigured} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DisclaimerCardWrapper() {
  return (
    <div className="min-w-0 flex-1">
      <DisclaimerCard />
    </div>
  );
}

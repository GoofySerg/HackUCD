"use client";

import * as React from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  CircleHelp,
  FlaskConical,
} from "lucide-react";
import type { AnalysisResult, VerifiedFinding } from "@/lib/ai/analysisResult";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type Phase = "idle" | "loading" | "done" | "error";

export function AnalysisPanel({ ticker, aiConfigured }: { ticker: string; aiConfigured: boolean }) {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [result, setResult] = React.useState<AnalysisResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = React.useCallback(
    async (force = false) => {
      setPhase("loading");
      setError(null);
      try {
        const res = await fetch(`/api/analysis/${ticker}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || body.error || `Request failed (${res.status}).`);
        }
        const data = (await res.json()) as AnalysisResult;
        setResult(data);
        setPhase("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    },
    [ticker],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="size-5 text-primary" /> AI Research Analysis
          </h2>
          <p className="text-sm text-muted-foreground">
            Bull &amp; Bear analysts, an evidence reviewer, and a plain-English explainer — powered
            by OpenRouter.
          </p>
        </div>
        <Button onClick={() => run(phase === "done")} disabled={phase === "loading"}>
          {phase === "loading" ? (
            <>
              <Loader2 className="animate-spin" /> Analysing…
            </>
          ) : phase === "done" ? (
            <>
              <RefreshCw /> Regenerate
            </>
          ) : (
            <>
              <Sparkles /> Generate AI Research
            </>
          )}
        </Button>
      </div>

      {!aiConfigured && phase === "idle" && (
        <Alert variant="caution">
          <FlaskConical />
          <div>
            <AlertTitle>Demo mode — live AI is not configured</AlertTitle>
            <AlertDescription>
              No <code>OPENROUTER_API_KEY</code> is set, so clicking Generate shows a clearly
              labelled example assembled from the deterministic engine. Add a key to enable live AI
              analysis.
            </AlertDescription>
          </div>
        </Alert>
      )}

      {phase === "idle" && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Sparkles className="mx-auto mb-3 size-7 text-primary/70" />
            <p>Click &ldquo;Generate AI Research&rdquo; to analyse {ticker}.</p>
          </CardContent>
        </Card>
      )}

      {phase === "loading" && <LoadingState />}

      {phase === "error" && (
        <Alert variant="negative">
          <AlertTriangle />
          <div className="flex-1">
            <AlertTitle>AI analysis failed</AlertTitle>
            <AlertDescription>
              {error} We did not fabricate a result. You can retry.
            </AlertDescription>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => run(true)}>
              <RefreshCw /> Retry
            </Button>
          </div>
        </Alert>
      )}

      {phase === "done" && result && <AnalysisResultView result={result} onRetry={() => run(true)} />}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AnalysisResultView({
  result,
  onRetry,
}: {
  result: AnalysisResult;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {result.mode === "demo" ? (
          <Badge variant="caution" className="gap-1">
            <FlaskConical className="size-3" /> Demo example (not live AI)
          </Badge>
        ) : (
          <Badge variant="positive" className="gap-1">
            <CheckCircle2 className="size-3" /> Live AI · {result.model}
          </Badge>
        )}
        {result.partial && (
          <Badge variant="caution" className="gap-1">
            <AlertTriangle className="size-3" /> Partial — some agents failed
          </Badge>
        )}
        <span>Generated {new Date(result.generatedAt).toLocaleString("en-IE")}</span>
      </div>

      {result.warnings.length > 0 && (
        <Alert variant="caution">
          <AlertTriangle />
          <AlertDescription>
            <ul className="list-disc space-y-0.5 pl-4">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Plain-English summary */}
      {result.summary.status === "ok" && result.summary.content && (
        <Card className="border-accent/30 bg-accent/5">
          <CardHeader>
            <CardTitle className="text-base">Plain-English summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>{result.summary.content.plainEnglishSummary}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <SummaryList title="What the company does" items={[result.summary.content.whatTheCompanyDoes]} />
              <SummaryList title="Financial condition" items={[result.summary.content.financialCondition]} />
              <SummaryList title="Strongest positives" items={result.summary.content.strongestPositives} />
              <SummaryList title="Most important risks" items={result.summary.content.mostImportantRisks} />
            </div>
            {result.summary.content.valuationConsiderations && (
              <SummaryList title="Valuation" items={[result.summary.content.valuationConsiderations]} />
            )}
            {result.summary.content.questionsToInvestigate.length > 0 && (
              <SummaryList
                title="Questions worth investigating"
                items={result.summary.content.questionsToInvestigate}
              />
            )}
          </CardContent>
        </Card>
      )}
      {result.summary.status === "failed" && (
        <Alert variant="caution">
          <AlertTriangle />
          <AlertDescription>
            The plain-English summary could not be generated ({result.summary.error?.message}).
          </AlertDescription>
        </Alert>
      )}

      {/* Bull / Bear */}
      <div className="grid gap-5 lg:grid-cols-2">
        <FindingsColumn
          title="Bull Analyst"
          icon={<TrendingUp className="size-5 text-positive" />}
          accent="positive"
          status={result.bull.status}
          findings={result.bull.findings}
          errorMsg={result.bull.error?.message}
        />
        <FindingsColumn
          title="Bear Analyst"
          icon={<TrendingDown className="size-5 text-negative" />}
          accent="negative"
          status={result.bear.status}
          findings={result.bear.findings}
          errorMsg={result.bear.error?.message}
        />
      </div>

      {/* Evidence review note */}
      {result.review.status === "ok" && result.review.overallNote && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-primary" /> Evidence reviewer
            </CardTitle>
            <CardDescription>
              Citations are additionally verified deterministically in code — only matched source
              and metric ids are shown as evidence-backed.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{result.review.overallNote}</CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onRetry}>
          <RefreshCw /> Regenerate
        </Button>
      </div>
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {clean.length === 1 ? (
        <p className="text-muted-foreground">{clean[0]}</p>
      ) : (
        <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
          {clean.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FindingsColumn({
  title,
  icon,
  accent,
  status,
  findings,
  errorMsg,
}: {
  title: string;
  icon: React.ReactNode;
  accent: "positive" | "negative";
  status: AnalysisResult["bull"]["status"];
  findings: VerifiedFinding[];
  errorMsg?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "failed" ? (
          <Alert variant="negative">
            <AlertTriangle />
            <AlertDescription>This analyst failed: {errorMsg}</AlertDescription>
          </Alert>
        ) : findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No findings returned.</p>
        ) : (
          findings.map((f, i) => <FindingCard key={i} finding={f} accent={accent} />)
        )}
      </CardContent>
    </Card>
  );
}

function FindingCard({ finding, accent }: { finding: VerifiedFinding; accent: "positive" | "negative" }) {
  const hasEvidence = finding.verifiedMetricIds.length > 0 || finding.verifiedSourceIds.length > 0;
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className={`font-medium ${accent === "positive" ? "text-positive" : "text-negative"}`}>
          {finding.title}
        </h4>
        {finding.reviewSupported === false && (
          <Badge variant="caution" className="gap-1 shrink-0">
            <CircleHelp className="size-3" /> review
          </Badge>
        )}
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{finding.explanation}</p>

      {(hasEvidence || finding.rejectedSourceIds.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {finding.verifiedMetricIds.map((id) => (
            <Badge key={`m-${id}`} variant="outline" className="text-[10px]">
              metric:{id}
            </Badge>
          ))}
          {finding.verifiedSourceIds.map((id) => (
            <Badge key={`s-${id}`} variant="accent" className="text-[10px]">
              src:{id}
            </Badge>
          ))}
          {finding.rejectedSourceIds.map((id) => (
            <Badge key={`r-${id}`} variant="caution" className="text-[10px] line-through">
              unverified:{id}
            </Badge>
          ))}
        </div>
      )}

      {finding.limitations && (
        <p className="mt-2 text-xs italic text-muted-foreground/80">Limitations: {finding.limitations}</p>
      )}
      {finding.reviewIssues && finding.reviewIssues.length > 0 && (
        <p className="mt-1 text-xs text-caution">
          Reviewer flagged: {finding.reviewIssues.join("; ")}
        </p>
      )}
    </div>
  );
}

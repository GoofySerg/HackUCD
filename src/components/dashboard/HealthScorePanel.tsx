import { HeartPulse, AlertTriangle } from "lucide-react";
import type { HealthScoreResult } from "@/lib/financial/healthScore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { InfoTooltip } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

function colorFor(score: number): string {
  if (score >= 70) return "bg-positive";
  if (score >= 45) return "bg-caution";
  return "bg-negative";
}
function textFor(score: number): string {
  if (score >= 70) return "text-positive";
  if (score >= 45) return "text-caution";
  return "text-negative";
}

export function HealthScorePanel({ health }: { health: HealthScoreResult }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="size-5 text-primary" />
            Financial Health Score
          </CardTitle>
          <InfoTooltip content="This score rates the financial strength of the BUSINESS using transparent, weighted metrics. It is NOT a measure of whether the STOCK is a safe investment, and it is not a credit rating or a prediction.">
            <span className="cursor-help text-xs text-muted-foreground underline decoration-dotted">
              What is this?
            </span>
          </InfoTooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {health.status === "insufficient_data" ? (
          <Alert variant="caution">
            <AlertTriangle />
            <AlertDescription>{health.summary}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex items-end gap-4">
              <div className={`text-5xl font-bold tabular ${textFor(health.overall!)}`}>
                {health.overall}
                <span className="text-xl text-muted-foreground">/100</span>
              </div>
              <p className="pb-1.5 text-sm text-muted-foreground">{health.summary}</p>
            </div>

            <div className="space-y-3">
              {health.components.map((c) => (
                <div key={c.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <InfoTooltip content={`${c.explanation} Weight: ${(c.weight * 100).toFixed(0)}%. Metrics: ${c.metricsUsed.join(", ")}.`}>
                      <span className="cursor-help border-b border-dotted border-muted-foreground/40 text-muted-foreground">
                        {c.label}
                      </span>
                    </InfoTooltip>
                    <span className="tabular font-medium">
                      {c.score == null ? (
                        <span className="text-caution">insufficient</span>
                      ) : (
                        `${Math.round(c.score)}/100`
                      )}
                    </span>
                  </div>
                  <Progress
                    value={c.score ?? 0}
                    indicatorClassName={c.score == null ? "bg-muted" : colorFor(c.score)}
                  />
                </div>
              ))}
            </div>

            {health.warnings.length > 0 && (
              <div className="rounded-md border border-caution/30 bg-caution/5 p-3 text-xs text-muted-foreground">
                <p className="mb-1 flex items-center gap-1.5 font-medium text-caution">
                  <AlertTriangle className="size-3.5" /> Missing-data notes
                </p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {health.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

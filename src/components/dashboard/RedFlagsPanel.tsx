import { Flag, ShieldCheck } from "lucide-react";
import type { RedFlag } from "@/lib/financial/redFlags";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const severityVariant: Record<RedFlag["severity"], "negative" | "caution" | "default"> = {
  high: "negative",
  medium: "caution",
  low: "default",
};

export function RedFlagsPanel({ flags }: { flags: RedFlag[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flag className="size-5 text-negative" />
          Financial Red Flags
          <Badge variant="outline" className="ml-1">
            {flags.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {flags.length === 0 ? (
          <div className="flex items-center gap-3 rounded-md border border-positive/30 bg-positive/5 p-4 text-sm">
            <ShieldCheck className="size-5 shrink-0 text-positive" />
            <p className="text-muted-foreground">
              No automated red flags detected on the available data.{" "}
              <span className="text-foreground">This is not a guarantee of safety</span> — important
              risks may lie outside the supplied figures.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {flags.map((f) => (
              <li
                key={f.id}
                className="rounded-md border border-border bg-secondary/30 p-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={severityVariant[f.severity]} className="uppercase">
                    {f.severity}
                  </Badge>
                  <span className="font-medium">{f.name}</span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.explanation}</p>
                <p className="mt-1.5 text-xs text-muted-foreground/70">
                  Evidence: {f.evidenceMetricIds.join(", ") || "—"} · Period: FY
                  {f.sourcePeriods.join(", FY")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

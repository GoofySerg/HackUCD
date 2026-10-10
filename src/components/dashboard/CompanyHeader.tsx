import Link from "next/link";
import { ArrowLeft, FlaskConical, CalendarClock, Database } from "lucide-react";
import type { CompanyData } from "@/lib/data/types";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export function CompanyHeader({ data }: { data: CompanyData }) {
  const latest = [...data.statements].sort((a, b) => b.fiscalYear - a.fiscalYear)[0];
  const primarySource = data.sources[0];

  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All companies
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight">{data.identity.companyName}</h1>
            <Badge variant="outline" className="text-sm">
              {data.identity.ticker}
            </Badge>
            {data.dataType === "synthetic" && (
              <Badge variant="caution" className="gap-1">
                <FlaskConical className="size-3" /> Synthetic data
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {data.identity.sector} · {data.identity.industry} · {data.identity.exchange}
          </p>
          <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground">
            {data.identity.description}
          </p>
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CalendarClock className="size-3.5" />
            Latest reporting period: FY{latest?.fiscalYear} (ends{" "}
            {formatDate(latest?.fiscalPeriodEnd ?? null)})
          </div>
          <div className="flex items-center gap-1.5">
            <Database className="size-3.5" />
            Source: {primarySource?.sourceName ?? "—"}
          </div>
          {primarySource?.retrievedAt && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-primary/70" />
              Data retrieved {formatDate(primarySource.retrievedAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

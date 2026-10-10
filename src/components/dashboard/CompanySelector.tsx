"use client";

import * as React from "react";
import Link from "next/link";
import { Search, ArrowRight, FlaskConical, Building2 } from "lucide-react";
import type { CompanySummary } from "@/lib/data/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function CompanySelector({ companies }: { companies: CompanySummary[] }) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.ticker.toLowerCase().includes(q) ||
        c.companyName.toLowerCase().includes(q) ||
        c.sector.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q),
    );
  }, [companies, query]);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search available companies by name, ticker, or sector…"
          aria-label="Search available companies"
          className="h-14 w-full rounded-xl border border-border bg-card pl-12 pr-4 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {companies.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Building2 className="mx-auto mb-3 size-8 opacity-60" />
          <p className="font-medium text-foreground">No company datasets found.</p>
          <p className="mt-1 text-sm">
            Add a JSON file to <code className="text-foreground">data/companies/</code> and refresh.
            See the folder&apos;s README for the schema.
          </p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <p>
            No available companies match &ldquo;{query}&rdquo;. Only companies in the loaded dataset
            can be analysed.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.ticker} href={`/company/${c.ticker}`} className="group">
              <Card className="h-full p-5 transition-all hover:border-primary/50 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold tracking-tight">{c.ticker}</span>
                      {c.dataType === "synthetic" && (
                        <Badge variant="caution" className="gap-1">
                          <FlaskConical className="size-3" /> Synthetic
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{c.companyName}</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{c.sector}</Badge>
                  <span>·</span>
                  <span>
                    {c.fiscalYearsCovered} yr{c.fiscalYearsCovered === 1 ? "" : "s"} · latest FY
                    {c.latestFiscalYear}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { FlaskConical, FileSearch, Scale, ShieldCheck, Sparkles } from "lucide-react";
import { listCompanies } from "@/lib/data/companyRepository";
import { isAiConfigured } from "@/lib/ai/openrouter";
import { CompanySelector } from "@/components/dashboard/CompanySelector";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const companies = listCompanies();
  const hasSynthetic = companies.some((c) => c.dataType === "synthetic");
  const aiLive = isAiConfigured();

  return (
    <div className="container py-10 lg:py-14">
      {/* Hero */}
      <section className="mx-auto max-w-3xl text-center">
        <div className="mb-4 flex justify-center gap-2">
          <Badge variant="accent" className="gap-1">
            <Sparkles className="size-3" /> OpenRouter AI research
          </Badge>
          {hasSynthetic && (
            <Badge variant="caution" className="gap-1">
              <FlaskConical className="size-3" /> Demo data mode
            </Badge>
          )}
        </div>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Understand the company before investing in the stock.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
          StockScope AI turns company financial statements into clear, evidence-backed research —
          financial health, strengths and risks, and what the valuation data can (and can&apos;t)
          tell you. Built for beginners.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {aiLive ? (
            <span className="text-primary">● Live AI analysis is configured.</span>
          ) : (
            <span className="text-caution">
              ● Demo mode: live AI analysis is unavailable until an OpenRouter key is set.
            </span>
          )}
        </p>
      </section>

      {/* Selector */}
      <section className="mx-auto mt-10 max-w-5xl">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Select a company to analyse
        </h2>
        <CompanySelector companies={companies} />
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto mt-16 max-w-5xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          What StockScope answers
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: FileSearch,
              title: "What does it do?",
              body: "A plain-English overview of the business and how it makes money.",
            },
            {
              icon: ShieldCheck,
              title: "How healthy is it?",
              body: "A transparent 0–100 financial health score from real metrics — not a black box.",
            },
            {
              icon: Scale,
              title: "Strengths & risks",
              body: "AI Bull and Bear analysts, plus deterministic red-flag detection with evidence.",
            },
            {
              icon: Sparkles,
              title: "Expensive or cheap?",
              body: "Valuation context from available data — and honesty when it's missing.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-card p-5">
              <f.icon className="size-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Financial health describes the business — it is not a measure of whether the stock is a
          safe investment. Educational use only; not investment advice.
        </p>
      </section>
    </div>
  );
}

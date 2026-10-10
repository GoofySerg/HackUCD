import { SHORT_DISCLAIMER } from "@/lib/disclaimer";

export function Footer() {
  return (
    <footer className="border-t border-border/70 mt-16">
      <div className="container py-8 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">StockScope AI</p>
        <p className="max-w-3xl leading-relaxed">{SHORT_DISCLAIMER}</p>
        <p className="text-xs">
          Built for HackUCD 2026 · Demo datasets are synthetic and clearly labelled.
        </p>
      </div>
    </footer>
  );
}

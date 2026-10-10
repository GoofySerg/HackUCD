import Link from "next/link";
import { LineChart } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-semibold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
            <LineChart className="size-5" />
          </span>
          <span className="text-lg tracking-tight">
            StockScope<span className="text-primary"> AI</span>
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/" className="hidden sm:inline hover:text-foreground transition-colors">
            Companies
          </Link>
          <Link
            href="/#how-it-works"
            className="hidden sm:inline hover:text-foreground transition-colors"
          >
            How it works
          </Link>
          <span className="rounded-full border border-caution/30 bg-caution/10 px-2.5 py-1 text-xs font-medium text-caution">
            Educational tool
          </span>
        </nav>
      </div>
    </header>
  );
}

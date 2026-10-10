"use client";

import * as React from "react";
import { Lock, Loader2, Download, AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export function PremiumUnlock({
  ticker,
  unlocked,
  stripeConfigured,
  priceLabel,
}: {
  ticker: string;
  unlocked: boolean;
  stripeConfigured: boolean;
  priceLabel: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (unlocked) {
    return (
      <Card className="border-positive/30 bg-positive/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <p className="font-medium text-positive">Premium report unlocked</p>
            <p className="text-sm text-muted-foreground">
              Your purchase was verified by the server. Download your PDF below.
            </p>
          </div>
          <a href={`/api/reports/${ticker}`}>
            <Button>
              <Download /> Download PDF
            </Button>
          </a>
        </CardContent>
      </Card>
    );
  }

  if (!stripeConfigured) {
    return (
      <Alert variant="caution">
        <AlertTriangle />
        <div>
          <AlertTitle>Payment setup required</AlertTitle>
          <AlertDescription>
            Stripe is not configured on this server, so the premium purchase is unavailable. Set
            the Stripe sandbox keys in <code>.env.local</code> (see the README) to enable the €2.99
            test checkout. The free dashboard remains fully usable.
          </AlertDescription>
        </div>
      </Alert>
    );
  }

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) {
        throw new Error(body.message || "Could not start checkout.");
      }
      window.location.href = body.url as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-4 py-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Lock className="size-5" />
          </span>
          <div>
            <p className="font-medium">Unlock the premium PDF research report</p>
            <p className="text-sm text-muted-foreground">
              Full executive summary, health breakdown, bull/bear cases, red flags, valuation and
              sources — as a downloadable PDF. One-time {priceLabel} (Stripe sandbox / test mode).
            </p>
          </div>
        </div>
        {error && (
          <Alert variant="negative">
            <AlertTriangle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button onClick={startCheckout} disabled={loading} size="lg">
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Redirecting to Stripe…
            </>
          ) : (
            <>
              <CreditCard /> Unlock for {priceLabel}
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Test mode only — use Stripe test card <code>4242 4242 4242 4242</code>, any future expiry
          and any CVC. No real payment is taken.
        </p>
      </CardContent>
    </Card>
  );
}

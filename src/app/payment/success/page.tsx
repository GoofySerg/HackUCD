"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle, Download, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Status = "verifying" | "paid" | "unpaid" | "error";

function SuccessInner() {
  const search = useSearchParams();
  const sessionId = search.get("session_id");
  const ticker = search.get("ticker");
  const [status, setStatus] = React.useState<Status>("verifying");
  const [message, setMessage] = React.useState<string>("");

  React.useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setMessage("No checkout session was provided.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/stripe/checkout-status?session_id=${encodeURIComponent(sessionId)}`);
        const body = await res.json();
        if (cancelled) return;
        if (res.ok && body.status === "paid") {
          setStatus("paid");
        } else if (body.status === "unpaid") {
          setStatus("unpaid");
          setMessage("The payment has not completed yet.");
        } else {
          setStatus("error");
          setMessage(body.message || "We could not verify this payment.");
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setMessage(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 py-10 text-center">
          {status === "verifying" && (
            <>
              <Loader2 className="mx-auto size-10 animate-spin text-primary" />
              <h1 className="text-xl font-semibold">Verifying your payment…</h1>
              <p className="text-sm text-muted-foreground">
                We&apos;re confirming the payment with Stripe on the server — access is never
                granted from the URL alone.
              </p>
            </>
          )}
          {status === "paid" && (
            <>
              <CheckCircle2 className="mx-auto size-10 text-positive" />
              <h1 className="text-xl font-semibold">Payment confirmed</h1>
              <p className="text-sm text-muted-foreground">
                Your premium report for {ticker} is unlocked on this browser.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                {ticker && (
                  <a href={`/api/reports/${ticker}`}>
                    <Button className="w-full">
                      <Download /> Download PDF report
                    </Button>
                  </a>
                )}
                {ticker && (
                  <Link href={`/company/${ticker}/report`}>
                    <Button variant="outline" className="w-full">
                      Back to report page <ArrowRight />
                    </Button>
                  </Link>
                )}
              </div>
            </>
          )}
          {(status === "unpaid" || status === "error") && (
            <>
              <XCircle className="mx-auto size-10 text-negative" />
              <h1 className="text-xl font-semibold">
                {status === "unpaid" ? "Payment not completed" : "Verification problem"}
              </h1>
              <p className="text-sm text-muted-foreground">{message}</p>
              {ticker && (
                <Link href={`/company/${ticker}/report`}>
                  <Button variant="outline" className="mt-2 w-full">
                    Return to report page
                  </Button>
                </Link>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="container py-12 text-center text-muted-foreground">Loading…</div>}>
      <SuccessInner />
    </Suspense>
  );
}

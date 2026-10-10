import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getStripeConfig } from "@/lib/stripe/config";
import { findBySessionId, newAccessToken, recordPurchase } from "@/lib/stripe/purchases";

/**
 * POST /api/stripe/webhook
 *
 * Verifies the Stripe webhook signature and idempotently records paid
 * checkout sessions. The signature check is REQUIRED — unsigned/invalid
 * requests are rejected. Idempotency is keyed by the Checkout Session id, so
 * duplicate deliveries are safe.
 *
 * NOTE: we read the RAW body (request.text()) because signature verification
 * must run against the exact bytes Stripe sent.
 */
export async function POST(request: Request) {
  const config = getStripeConfig();
  const stripe = getStripe();
  if (!config || !stripe) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }
  if (!config.webhookSecret) {
    return NextResponse.json(
      { error: "webhook_secret_missing", message: "STRIPE_WEBHOOK_SECRET is not set." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_signature", message: err instanceof Error ? err.message : "bad signature" },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === "paid") {
      const ticker = session.metadata?.ticker;
      if (ticker) {
        // Idempotent: if the browser already claimed this session, keep its
        // token; otherwise mint a server-side token so the record exists.
        const existing = findBySessionId(session.id);
        recordPurchase({
          accessToken: existing?.accessToken ?? newAccessToken(),
          ticker,
          sessionId: session.id,
          amount: session.amount_total ?? 0,
          currency: session.currency ?? "eur",
        });
      }
    }
  }

  // Always 200 for handled/ignored events so Stripe stops retrying.
  return NextResponse.json({ received: true });
}

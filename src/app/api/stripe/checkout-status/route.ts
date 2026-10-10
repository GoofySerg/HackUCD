import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStripe, getStripeConfig } from "@/lib/stripe/config";
import { findBySessionId, newAccessToken, recordPurchase } from "@/lib/stripe/purchases";
import { ACCESS_COOKIE } from "@/lib/stripe/access";

/**
 * GET /api/stripe/checkout-status?session_id=...
 *
 * AUTHORITATIVE unlock path. We do NOT trust the success URL alone: we
 * retrieve the session from Stripe and confirm `payment_status === "paid"`.
 * Only then do we record the purchase (idempotent by session id) and set an
 * httpOnly access-token cookie that grants the browser access to the report.
 */
export async function GET(request: Request) {
  const config = getStripeConfig();
  const stripe = getStripe();
  if (!config || !stripe) {
    return NextResponse.json({ status: "stripe_not_configured" }, { status: 503 });
  }

  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ status: "error", message: "session_id required" }, { status: 400 });
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : "retrieve failed" },
      { status: 502 },
    );
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json({ status: "unpaid", paymentStatus: session.payment_status });
  }

  const ticker = session.metadata?.ticker;
  if (!ticker) {
    return NextResponse.json({ status: "error", message: "session missing ticker metadata" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const existing = findBySessionId(session.id);
  const token = existing?.accessToken ?? cookieStore.get(ACCESS_COOKIE)?.value ?? newAccessToken();

  const record = recordPurchase({
    accessToken: token,
    ticker,
    sessionId: session.id,
    amount: session.amount_total ?? 0,
    currency: session.currency ?? "eur",
  });

  // Bind this browser to the purchase's access token.
  cookieStore.set(ACCESS_COOKIE, record.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ status: "paid", ticker: record.ticker });
}

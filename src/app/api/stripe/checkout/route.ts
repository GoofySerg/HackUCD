import { NextResponse } from "next/server";
import { getCompany } from "@/lib/data/companyRepository";
import { getStripe, getStripeConfig, PREMIUM_PRODUCT, appUrl } from "@/lib/stripe/config";

/**
 * POST /api/stripe/checkout  — body: { ticker }
 * Creates a Stripe Checkout Session (TEST mode) for the premium report of the
 * given ticker and returns the hosted checkout URL.
 */
export async function POST(request: Request) {
  const config = getStripeConfig();
  const stripe = getStripe();
  if (!config || !stripe) {
    return NextResponse.json(
      { error: "stripe_not_configured", message: "Stripe is not configured on the server." },
      { status: 503 },
    );
  }

  let ticker: string;
  try {
    const body = (await request.json()) as { ticker?: string };
    if (!body?.ticker) throw new Error("missing ticker");
    ticker = body.ticker.toUpperCase();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "ticker is required." }, { status: 400 });
  }

  const company = getCompany(ticker);
  if (!company) {
    return NextResponse.json(
      { error: "not_found", message: `No dataset for ticker "${ticker}".` },
      { status: 404 },
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: PREMIUM_PRODUCT.currency,
            unit_amount: PREMIUM_PRODUCT.amount,
            product_data: {
              name: `${PREMIUM_PRODUCT.name} — ${company.identity.companyName} (${ticker})`,
              description: PREMIUM_PRODUCT.description,
            },
          },
        },
      ],
      // Metadata lets the webhook know which ticker was purchased.
      metadata: { ticker },
      success_url: `${appUrl()}/payment/success?session_id={CHECKOUT_SESSION_ID}&ticker=${ticker}`,
      cancel_url: `${appUrl()}/company/${ticker}/report?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    return NextResponse.json(
      {
        error: "stripe_error",
        message: err instanceof Error ? err.message : "Failed to create checkout session.",
      },
      { status: 502 },
    );
  }
}

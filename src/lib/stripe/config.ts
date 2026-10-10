/**
 * Stripe configuration & product definition (sandbox / TEST mode only).
 *
 * All keys are read server-side. The app degrades gracefully to a
 * "setup required" state when keys are absent — the payment button is never
 * shown as functional without configuration.
 */
import "server-only";
import Stripe from "stripe";

/** The single premium product offered for the HackUCD bonus. */
export const PREMIUM_PRODUCT = {
  name: "StockScope AI — Premium Company Research Report",
  description: "Full downloadable PDF research report for one company (test product).",
  /** €2.99 expressed in cents, as Stripe expects. */
  amount: 299,
  currency: "eur",
} as const;

export interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string | null;
}

export function getStripeConfig(): StripeConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!secretKey || !publishableKey) return null;
  return {
    secretKey,
    publishableKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || null,
  };
}

export function isStripeConfigured(): boolean {
  return getStripeConfig() !== null;
}

let stripeSingleton: Stripe | null = null;

/** Returns a configured Stripe client, or null in demo mode. */
export function getStripe(): Stripe | null {
  const config = getStripeConfig();
  if (!config) return null;
  if (!stripeSingleton) {
    // Use the account's default API version to avoid coupling the build to a
    // specific pinned version literal.
    stripeSingleton = new Stripe(config.secretKey, { typescript: true });
  }
  return stripeSingleton;
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

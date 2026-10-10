/**
 * Persistent purchase store (local JSON file for the hackathon demo).
 *
 * A purchase grants access to the premium report for a specific ticker. Access
 * is tied to a server-generated, unguessable `accessToken` (also stored in an
 * httpOnly cookie) — NOT to any client-side variable. The PDF route checks
 * this store server-side before serving a report.
 *
 * Payment processing is IDEMPOTENT: each Stripe Checkout Session id is
 * recorded at most once, so duplicate webhook deliveries are safe.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Allow tests (and alternate deployments) to redirect the store location.
const DATA_DIR = process.env.STOCKSCOPE_DATA_DIR
  ? path.resolve(process.env.STOCKSCOPE_DATA_DIR)
  : path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "purchases.json");

export interface PurchaseRecord {
  accessToken: string;
  ticker: string;
  /** Stripe Checkout Session id — the idempotency key. */
  sessionId: string;
  amount: number;
  currency: string;
  createdAt: string;
  status: "paid";
}

interface Store {
  purchases: PurchaseRecord[];
}

function readStore(): Store {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || !Array.isArray(parsed.purchases)) return { purchases: [] };
    return parsed;
  } catch {
    return { purchases: [] };
  }
}

function writeStore(store: Store): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("[purchases] Failed to persist purchase store:", err);
    throw err;
  }
}

/** Generate a cryptographically-random access token. */
export function newAccessToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * Record a paid purchase idempotently. If the sessionId was already recorded,
 * the existing record is returned unchanged (safe for duplicate webhooks).
 */
export function recordPurchase(input: {
  accessToken: string;
  ticker: string;
  sessionId: string;
  amount: number;
  currency: string;
}): PurchaseRecord {
  const store = readStore();
  const existing = store.purchases.find((p) => p.sessionId === input.sessionId);
  if (existing) return existing;

  const record: PurchaseRecord = {
    accessToken: input.accessToken,
    ticker: input.ticker.toUpperCase(),
    sessionId: input.sessionId,
    amount: input.amount,
    currency: input.currency,
    createdAt: new Date().toISOString(),
    status: "paid",
  };
  store.purchases.push(record);
  writeStore(store);
  return record;
}

/** True if the given access token has a paid purchase for the ticker. */
export function hasAccess(accessToken: string | undefined | null, ticker: string): boolean {
  if (!accessToken) return false;
  const store = readStore();
  const t = ticker.toUpperCase();
  return store.purchases.some(
    (p) => p.accessToken === accessToken && p.ticker === t && p.status === "paid",
  );
}

/** Look up a purchase by Stripe session id (used by checkout-status route). */
export function findBySessionId(sessionId: string): PurchaseRecord | null {
  return readStore().purchases.find((p) => p.sessionId === sessionId) ?? null;
}

import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Redirect the purchase store to a temp dir BEFORE importing the module.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "stockscope-test-"));
process.env.STOCKSCOPE_DATA_DIR = TMP;

// Dynamic import after env is set.
const { recordPurchase, hasAccess, findBySessionId, newAccessToken } = await import(
  "@/lib/stripe/purchases"
);

describe("purchase store (Stripe authorization logic)", () => {
  afterAll(() => {
    try {
      fs.rmSync(TMP, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("records a purchase and grants access only to the matching token+ticker", () => {
    const token = newAccessToken();
    recordPurchase({ accessToken: token, ticker: "EXMP", sessionId: "cs_1", amount: 299, currency: "eur" });

    expect(hasAccess(token, "EXMP")).toBe(true);
    expect(hasAccess(token, "exmp")).toBe(true); // case-insensitive ticker
    expect(hasAccess(token, "NOVA")).toBe(false); // different ticker
    expect(hasAccess("some-other-token", "EXMP")).toBe(false); // different token
    expect(hasAccess(undefined, "EXMP")).toBe(false);
  });

  it("is idempotent per Stripe session id (duplicate webhooks are safe)", () => {
    const token = newAccessToken();
    const a = recordPurchase({ accessToken: token, ticker: "EXMP", sessionId: "cs_dup", amount: 299, currency: "eur" });
    const b = recordPurchase({ accessToken: "a-different-token", ticker: "EXMP", sessionId: "cs_dup", amount: 299, currency: "eur" });
    expect(b.accessToken).toBe(a.accessToken); // existing record returned unchanged
    const found = findBySessionId("cs_dup");
    expect(found?.accessToken).toBe(a.accessToken);
  });

  it("generates unguessable tokens", () => {
    expect(newAccessToken()).not.toBe(newAccessToken());
    expect(newAccessToken().length).toBeGreaterThanOrEqual(32);
  });
});

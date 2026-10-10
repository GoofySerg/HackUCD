# StockScope AI — manual end-to-end checklist

Automated tests: `npm run test` (51 Vitest tests). This document covers the
manual demo flow and edge cases that aren't fully exercised by unit tests.

## A. Setup

- [ ] `npm install` completes.
- [ ] `npm run dev` starts; home page loads at http://localhost:3000.
- [ ] Home shows a **Demo mode** badge when no OpenRouter key is set.

## B. Company selection (ordinary company)

- [ ] Example Corp (EXMP) appears in the selector with a **Synthetic** badge.
- [ ] Search filters by name / ticker / sector.
- [ ] Clicking EXMP opens `/company/EXMP`.
- [ ] Header shows name, ticker, sector/industry, description, latest FY,
      source, and retrieval date.
- [ ] Metric cards show Revenue, Revenue growth, Net income, Net margin, FCF,
      Total debt, Cash, Debt-to-equity, P/E — values match the dataset, with
      `—` for unavailable and “n/m” for not-meaningful.
- [ ] Health score renders 0–100 with component bars and a “financial health ≠
      investment safety” tooltip.
- [ ] Red flags list shows severity-ordered flags with evidence + period.
- [ ] Charts render: revenue, net income, margin, FCF, debt (3–5 years).
- [ ] Valuation panel shows P/E, P/S, market cap, EPS; prices show `asOfDate`.

## C. Loss-making company

- [ ] Open NovaBio (NOVA).
- [ ] Health score is low (< 40).
- [ ] Red flags include net loss, negative FCF, revenue decline.
- [ ] P/E shows not-meaningful (negative EPS).

## D. AI research (demo mode, no key)

- [ ] AI Research tab shows a “Demo mode” notice.
- [ ] **Generate AI Research** returns a result labelled **Demo example (not
      live AI)**.
- [ ] Bull/Bear findings show evidence chips; demo findings cite real ids only.
- [ ] Plain-English summary renders; valuation line is honest about data.

## E. AI research (live, with OPENROUTER_API_KEY)

- [ ] Generate shows a loading state, then **Live AI · <model>**.
- [ ] Findings cite metric/source ids; invented ids appear struck-through as
      *unverified* (deterministic validation).
- [ ] Set an invalid model id → UI shows a precise error + Retry (no fake data).
- [ ] Regenerate uses the cache unless “Regenerate” (force) is clicked.

## F. Premium report + Stripe sandbox

Without Stripe keys:
- [ ] Report page shows “payment setup required”; dashboard still usable.
- [ ] `GET /api/reports/EXMP` returns **402**.

With Stripe test keys + `stripe listen`:
- [ ] Click **Unlock for €2.99** → redirected to Stripe Checkout.
- [ ] Pay with `4242 4242 4242 4242` → redirected to `/payment/success`.
- [ ] Success page says it verifies with Stripe (not the URL) → **Payment
      confirmed**.
- [ ] Webhook terminal shows `checkout.session.completed` handled.
- [ ] **Download PDF** returns a valid PDF with all sections.
- [ ] Re-sending the webhook (idempotency) does not create a duplicate unlock.
- [ ] From a different browser / cleared cookies, the report is still locked
      (402) — access is tied to the server-verified token, not a client var.

## G. Edge cases

- [ ] Unknown ticker `/company/ZZZZ` → friendly not-found page.
- [ ] A malformed JSON file in `data/companies/` is excluded; server logs an
      actionable validation error; valid companies still load.
- [ ] A company with one fiscal year: revenue growth shows unavailable.
- [ ] Negative shareholders’ equity: debt-to-equity shows not-meaningful.

## Notes

- Do **not** claim live OpenRouter/Stripe testing succeeded unless real
  credentials were configured and the requests actually completed.

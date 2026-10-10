# StockScope AI

**Understand the company before investing in the stock.**

StockScope AI turns company financial statements into clear, evidence-backed
research for beginner investors. It answers five questions about any company in
its dataset:

1. What does the company do?
2. How financially healthy is it?
3. What are its biggest strengths and weaknesses?
4. What financial risks should investors understand?
5. Does the available valuation data suggest the shares may be expensive or
   inexpensive?

It deliberately separates the **financial strength of the business** from the
**investment risk of the stock**, and it never gives personalised buy/sell
advice. Built for **HackUCD 2026**.

> ⚠️ Educational research tool — **not investment advice**. Financial health is
> not the same as investment safety. AI findings may contain errors; always
> verify against original sources.

---

## 1. What StockScope does (architecture at a glance)

```
Select company  →  View financial data  →  Deterministic metrics + health score
      →  Generate OpenRouter AI analysis (Bull / Bear / Evidence review / Summary)
      →  Inspect evidence & red flags  →  Research summary
      →  Purchase (Stripe sandbox) → unlock downloadable PDF report
```

- **Data layer** (`src/lib/data`) — loads & validates company JSON datasets.
- **Financial engine** (`src/lib/financial`) — deterministic metrics, a
  transparent 0–100 health score, and rule-based red-flag detection. **AI is
  never used for arithmetic.**
- **AI layer** (`src/lib/ai`) — four OpenRouter agents (Bull, Bear, Evidence
  Reviewer, Plain-English Explainer) with structured JSON output and
  **deterministic citation validation**.
- **Payments** (`src/lib/stripe`) — Stripe sandbox checkout + webhook +
  persistent, server-verified report unlocking.
- **Reports** (`src/lib/reports`) — server-side PDF generation (pdfkit).

## 2. Install

Requires Node.js 18.18+ (tested on Node 24). Uses **npm**.

```bash
npm install
```

## 3. Run

```bash
npm run dev      # http://localhost:3000
```

The app works fully in **demo mode** with no API keys: the example companies,
dashboard, metrics, health score, red flags, charts, and a clearly-labelled
demo AI analysis all work. AI and Stripe light up when you add keys.

Other scripts:

```bash
npm run build      # production build
npm run start      # run the production build
npm run typecheck  # tsc --noEmit (strict)
npm run lint       # next lint
npm run test       # vitest (unit tests)
```

## 4. Configure OpenRouter (live AI)

Copy `.env.example` to `.env.local` and set:

```bash
OPENROUTER_API_KEY=sk-or-...          # from https://openrouter.ai/keys
OPENROUTER_MODEL=openai/gpt-4o-mini   # any OpenRouter model; JSON-capable recommended
```

- The key is **server-side only** and never reaches the browser.
- If the key is missing, the AI Research tab shows a labelled demo example and
  explicitly says live AI is unavailable — it does **not** fabricate AI output.
- On provider errors / timeouts / rate limits / invalid JSON, the UI shows a
  precise failure state with a Retry button (never fake content).

## 5. Configure Stripe sandbox (optional €2.99 bonus)

Use **TEST** keys only. In `.env.local`:

```bash
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...        # from `stripe listen`
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Run the webhook forwarder in a separate terminal:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# copy the printed whsec_... into STRIPE_WEBHOOK_SECRET and restart dev
```

Then on a company's **Premium report** page click *Unlock for €2.99* and pay
with the Stripe test card:

```
Card    4242 4242 4242 4242
Expiry  any future date      CVC  any 3 digits      ZIP  any
```

If Stripe keys are absent, the purchase button is replaced by a friendly
“payment setup required” message — the free dashboard still works.

## 6. Where to insert your financial dataset

Drop one JSON file per company into **`data/companies/`**. Valid files are
discovered automatically and appear in the selector on refresh — **no UI or
code changes needed**. See `data/companies/README.md` for full details.

- `data/companies/example-company.json` — synthetic **Example Corp (EXMP)**.
- `data/companies/loss-maker.json` — synthetic loss-making **NovaBio (NOVA)**.

## 7. The JSON schema expected

The canonical shape is documented in `data/companies/README.md` and mirrored in
`data/schemas/company.schema.json`. The authoritative validator is the Zod
schema in `src/lib/data/validation.ts`. Key rules:

- Monetary values in **full currency units** (e.g. `1500000000`, not “1500”).
- `null` for genuinely unavailable values — never `0` as a stand-in.
- `capitalExpenditures` is a **positive magnitude**; FCF = OCF − capex.
- Unique `ticker`, statement `id`s, and source `id`s.

### Using a different dataset format

If your data isn’t in the canonical shape, **don’t rewrite the app**. Add a
conversion function in `src/lib/data/adapters.ts`, register it in `ADAPTERS`,
and set `"schemaFormat": "<your-key>"` in your JSON files. Validation runs after
the adapter, so mapping mistakes produce clear errors.

## 8. How to add a new company

1. Copy `data/companies/example-company.json` → `data/companies/acme.json`.
2. Replace the contents (unique ticker, ≥1 fiscal-year statement, ≥1 source).
3. Refresh. It appears in the selector automatically.

## 9. How financial metrics are calculated

All in `src/lib/financial/calculations.ts`, each returning a value, unit,
method, source periods, and a status (`available` / `unavailable` /
`not_meaningful`):

- **Revenue growth** = `(current − previous) / |previous| × 100` (unavailable
  with one year; not meaningful if previous is 0).
- **Net profit margin** = `netIncome / revenue × 100` (not meaningful if
  revenue is 0; negatives preserved).
- **Debt-to-equity** = `totalDebt / shareholdersEquity` (**not meaningful** if
  equity ≤ 0, rather than a misleading “normal” number).
- **Free cash flow** = `operatingCashFlow − capitalExpenditures` (capex treated
  as a positive magnitude so a negative reported value isn’t double-counted;
  reported FCF used when present).
- **P/E** = `sharePrice / EPS` (not meaningful for EPS ≤ 0).
- Plus P/S, FCF yield, YoY comparisons, and multi-year trend series.

## 10. How financial health scoring works

`src/lib/financial/healthScore.ts` produces a transparent **0–100** score from
five weighted components — Profitability, Growth, Leverage, Cash-flow strength,
and Stability — each mapped from a real metric via documented piecewise-linear
thresholds. Weights (`COMPONENT_WEIGHTS`) are easy to change.

- Missing metrics are **not** scored as 0 and **not** auto-fails; their
  component is dropped and remaining weights are renormalised.
- If data coverage is below `MIN_COVERAGE` (50%), it returns an explicit
  **insufficient-data** state instead of a misleading score.
- It scores the **business**, not the stock — surfaced via tooltip. Not a
  credit rating or prediction.

## 11. How source verification works

Two layers:

1. **Deterministic (code)** — every AI-cited metric id and source id is checked
   against the known id sets in `verifyFinding` (`src/lib/ai/analysis.ts`).
   Unknown ids are rejected and shown struck-through as *unverified*; only
   matched ids display as evidence-backed. The AI cannot invent valid citations.
2. **AI evidence reviewer** — a fourth agent additionally flags unsupported
   claims, missing context, and contradictions. This augments, never replaces,
   the deterministic check.

Dataset text is treated as **untrusted data**: it’s passed as a delimited,
JSON-encoded evidence block, system prompts forbid following embedded
instructions, and `sanitizeForPrompt` strips control/zero-width/bidi characters
and fake role tags.

## 12. How to run tests

```bash
npm run test
```

51 unit tests (Vitest) cover calculations, health scoring, red-flag detection,
dataset validation, missing-data handling, source-ID verification, OpenRouter
error handling (mocked fetch), and Stripe authorization logic (mocked store).
See also `TESTING.md` for the manual end-to-end checklist.

## 13. Demonstrating to judges

1. `npm run dev`, open `http://localhost:3000`.
2. Pick **Example Corp (EXMP)** → dashboard: metric cards, health score, red
   flags, charts, valuation.
3. Open the **AI Research** tab → **Generate AI Research** (live with a key, or
   labelled demo without one). Point out the per-finding evidence chips and the
   struck-through *unverified* citations.
4. Also open **NovaBio (NOVA)** to show a loss-making profile scoring low with
   multiple red flags.
5. Open **Premium report** → with Stripe test keys, buy for €2.99 with
   `4242 4242 4242 4242` → success page verifies with Stripe → download the PDF.
   Show that `/api/reports/EXMP` returns **402** without a verified purchase.

## 14. Current limitations

- Demo datasets are **synthetic** and clearly labelled; no real market data ships.
- Purchases persist to a local JSON file (`data/purchases.json`) suitable for a
  demo, not a multi-instance production deployment. Access is tied to an
  httpOnly cookie token, not a full auth system.
- The AI analysis cache is in-memory (per server process), keyed by
  ticker + datasetVersion + model.
- No live price feed — valuation uses the dataset’s `asOfDate` and shows it.

## Environment variables

See `.env.example`. Summary:

| Variable | Required for | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | Live AI | Server-only. Demo mode without it. |
| `OPENROUTER_MODEL` | Live AI | Default `openai/gpt-4o-mini`. |
| `OPENROUTER_APP_URL` / `OPENROUTER_APP_NAME` | optional | OpenRouter attribution headers. |
| `STRIPE_SECRET_KEY` | Payments | **Test** key only. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Payments | **Test** key only. |
| `STRIPE_WEBHOOK_SECRET` | Payments | From `stripe listen`. |
| `NEXT_PUBLIC_APP_URL` | Payments | Checkout redirect base URL. |

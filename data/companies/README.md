# Company datasets

Drop one JSON file per company in this folder. StockScope automatically
discovers, validates, and lists every **valid** file here — no code or UI
changes required. Invalid files are skipped and their errors are logged to the
server console (and surfaced at `/api/companies?include=invalid`).

## How to add a company

1. Copy `example-company.json` to a new file, e.g. `my-company.json`.
2. Replace the contents with your company's data (see schema below).
3. Save. In `npm run dev` the new company appears immediately on refresh.

> The file **name** does not matter. The company is keyed by its `ticker`.
> Tickers must be unique across all files.

## Canonical schema (what StockScope consumes)

```jsonc
{
  "schemaFormat": "canonical",      // optional; selects an adapter (see below)
  "dataType": "real" | "synthetic", // label real vs. fictional data honestly
  "datasetVersion": "2024.1",        // bump when you edit; busts the AI cache

  "identity": {
    "ticker": "EXMP",
    "companyName": "Example Corp",
    "sector": "Technology",
    "industry": "Enterprise Software",
    "description": "What the company does.",
    "currency": "EUR",               // ISO 4217 3-letter code
    "exchange": "NASDAQ"
  },

  "statements": [                     // one per fiscal year, >= 1 required
    {
      "id": "EXMP-FY2024",           // unique, stable; used for AI citations
      "fiscalYear": 2024,
      "fiscalPeriodEnd": "2024-12-31",
      "revenue": 1500000000,          // FULL currency units, NOT millions
      "operatingIncome": 158000000,
      "netIncome": 96000000,
      "totalAssets": 2000000000,
      "totalLiabilities": 1260000000,
      "shareholdersEquity": 740000000,
      "totalDebt": 820000000,
      "cashAndCashEquivalents": 190000000,
      "operatingCashFlow": 198000000,
      "capitalExpenditures": 160000000, // POSITIVE magnitude of cash spent
      "freeCashFlow": null            // null => derived as OCF - capex
    }
  ],

  "valuation": {                      // or null if unavailable
    "asOfDate": "2025-03-15",         // prices may be historical; shown to user
    "sharePrice": 24.5,
    "sharesOutstanding": 120000000,
    "marketCapitalization": 2940000000,
    "earningsPerShare": 0.8,
    "peRatio": null,                  // null => derived from price / EPS
    "priceToSalesRatio": null
  },

  "sources": [                        // >= 1 required; `id` is cited by the AI
    {
      "id": "src-ar-2024",
      "sourceName": "Example Corp FY2024 Annual Report",
      "sourceURL": "https://example.com/ar-2024",
      "filingDate": "2025-02-20",
      "retrievedAt": "2025-03-15T09:00:00Z",
      "dataType": "synthetic"
    }
  ]
}
```

## Rules

- **Monetary values are in full currency units** (e.g. `1500000000`), never
  unmarked millions/billions.
- Use **`null`** for genuinely unavailable optional values. Never use `0` as a
  stand-in — legitimate `0` and negative values are preserved.
- `capitalExpenditures` is a **positive magnitude** of cash spent; free cash
  flow is computed as `operatingCashFlow - capitalExpenditures`.
- `ticker`, statement `id`s, and source `id`s must each be unique.

## Using your own dataset format

If your data does not match the canonical shape, you do **not** need to rewrite
the app. Instead:

1. Open `src/lib/data/adapters.ts`.
2. Write a conversion function that maps your format to the canonical shape
   (an example is included in comments).
3. Register it in the `ADAPTERS` map under a key, e.g. `"my-format"`.
4. Set `"schemaFormat": "my-format"` at the top of your JSON files.

Validation runs after the adapter, so any mapping mistakes produce clear
errors.

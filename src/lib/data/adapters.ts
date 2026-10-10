/**
 * ============================================================================
 *  DATASET ADAPTER LAYER  —  *** THIS IS WHERE YOU MAP YOUR OWN DATASET ***
 * ============================================================================
 *
 * StockScope consumes a single CANONICAL shape (see types.ts / validation.ts).
 * Raw files in `data/companies/*.json` are passed through an adapter that
 * converts them into that canonical shape BEFORE validation.
 *
 * If YOUR dataset already matches the canonical schema, you do not need to
 * change anything — `identityAdapter` (the default) passes the object through.
 *
 * If YOUR dataset has a different shape (e.g. values in millions, different
 * field names, a flat list of line-items), write a conversion function here
 * and register it in `ADAPTERS`. The UI, calculations, and AI layer do NOT
 * need to change — only this file.
 *
 * An adapter is selected per-file by the top-level `"schemaFormat"` key in the
 * JSON (defaults to "canonical" when absent).
 */
import type { RawCompanyData } from "./validation";

/**
 * An adapter converts an arbitrary parsed-JSON object into the raw canonical
 * shape expected by `companyDataSchema`. It should NOT validate — validation
 * happens afterwards and will surface any mistakes.
 */
export type DatasetAdapter = (raw: unknown) => RawCompanyData;

/**
 * Default adapter: the file is already in canonical format. We cast through
 * `unknown` because validation (Zod) runs immediately after and is the real
 * gatekeeper — the adapter only reshapes.
 */
export const identityAdapter: DatasetAdapter = (raw) => raw as RawCompanyData;

/**
 * ---------------------------------------------------------------------------
 * EXAMPLE custom adapter (commented out).
 *
 * Suppose your dataset looked like this:
 *
 *   {
 *     "schemaFormat": "my-format",
 *     "symbol": "EXMP",
 *     "name": "Example Corp",
 *     "financials": [
 *       { "year": 2023, "revenue_millions": 1500, ... }
 *     ]
 *   }
 *
 * You would convert "millions" -> full units and rename fields here:
 *
 * const myFormatAdapter: DatasetAdapter = (raw) => {
 *   const r = raw as any;
 *   const M = 1_000_000;
 *   return {
 *     identity: {
 *       ticker: r.symbol,
 *       companyName: r.name,
 *       sector: r.sector ?? "Unknown",
 *       industry: r.industry ?? "Unknown",
 *       description: r.description ?? "",
 *       currency: r.currency ?? "USD",
 *       exchange: r.exchange ?? "Unknown",
 *     },
 *     statements: r.financials.map((f: any, i: number) => ({
 *       id: `${r.symbol}-${f.year}`,
 *       fiscalYear: f.year,
 *       fiscalPeriodEnd: f.period_end,
 *       revenue: f.revenue_millions == null ? null : f.revenue_millions * M,
 *       // ...map the remaining monetary fields the same way, using null for
 *       //    genuinely missing values (never 0 as a stand-in).
 *     })),
 *     valuation: null,
 *     sources: r.sources,
 *     dataType: r.dataType ?? "real",
 *     datasetVersion: r.version ?? "1",
 *   };
 * };
 * ---------------------------------------------------------------------------
 */

/** Registry of adapters keyed by the file's `schemaFormat` value. */
export const ADAPTERS: Record<string, DatasetAdapter> = {
  canonical: identityAdapter,
  // "my-format": myFormatAdapter,
};

/**
 * Pick and run the adapter for a parsed JSON object. Falls back to the
 * canonical (identity) adapter when `schemaFormat` is absent or unknown.
 */
export function adaptRawDataset(parsed: unknown): {
  raw: RawCompanyData;
  adapterUsed: string;
  warning?: string;
} {
  const schemaFormat =
    parsed && typeof parsed === "object" && "schemaFormat" in parsed
      ? String((parsed as Record<string, unknown>).schemaFormat)
      : "canonical";

  const adapter = ADAPTERS[schemaFormat];
  if (!adapter) {
    return {
      raw: identityAdapter(parsed),
      adapterUsed: "canonical",
      warning: `Unknown schemaFormat "${schemaFormat}"; falling back to canonical adapter.`,
    };
  }
  return { raw: adapter(parsed), adapterUsed: schemaFormat };
}

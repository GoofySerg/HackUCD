/**
 * Canonical StockScope AI financial data types.
 *
 * These are the SINGLE SOURCE OF TRUTH for the shape of company data that
 * flows through the dashboard, the financial engine, and the AI layer.
 *
 * Design principles:
 *  - Monetary values are stored in FULL currency units (e.g. 1_500_000_000),
 *    never in unmarked "millions" or "billions".
 *  - `null` means "genuinely unavailable". We never substitute 0 for missing.
 *  - Legitimate 0 and negative numbers are preserved.
 *  - Every financial record carries provenance so claims can be traced.
 */

/** Whether a dataset describes real market data or synthetic/fictional data. */
export type DataType = "real" | "synthetic";

/** Identity of the company the dataset describes. */
export interface CompanyIdentity {
  ticker: string;
  companyName: string;
  sector: string;
  industry: string;
  description: string;
  /** ISO 4217 currency code, e.g. "EUR", "USD". */
  currency: string;
  exchange: string;
}

/**
 * A single fiscal-year financial statement snapshot.
 *
 * Monetary fields are in full units of {@link CompanyIdentity.currency}.
 * Any field may be `null` when the underlying figure is unavailable.
 */
export interface FinancialStatement {
  /** Stable id for this statement, used for AI source citation. */
  id: string;
  fiscalYear: number;
  /** ISO date (YYYY-MM-DD) of the fiscal period end. */
  fiscalPeriodEnd: string;

  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;

  totalAssets: number | null;
  totalLiabilities: number | null;
  shareholdersEquity: number | null;
  totalDebt: number | null;
  cashAndCashEquivalents: number | null;

  operatingCashFlow: number | null;
  /**
   * Capital expenditures as reported. SIGN CONVENTION: stored as a POSITIVE
   * magnitude of cash spent on capex. Free cash flow is therefore
   * `operatingCashFlow - capitalExpenditures`. See calculations.ts.
   */
  capitalExpenditures: number | null;
  /**
   * Free cash flow. If provided directly it is used as-is; otherwise the
   * engine derives it from operatingCashFlow and capitalExpenditures.
   */
  freeCashFlow: number | null;
}

/** Point-in-time valuation data (market prices may be historical). */
export interface ValuationData {
  /** ISO date the valuation snapshot was taken (prices may be delayed). */
  asOfDate: string | null;
  sharePrice: number | null;
  sharesOutstanding: number | null;
  marketCapitalization: number | null;
  earningsPerShare: number | null;
  peRatio: number | null;
  priceToSalesRatio: number | null;
}

/** A citable source reference. The `id` is what the AI must cite. */
export interface SourceReference {
  id: string;
  sourceName: string;
  sourceURL: string | null;
  /** ISO date the underlying filing was published. */
  filingDate: string | null;
  /** ISO datetime the data was retrieved into this dataset. */
  retrievedAt: string | null;
  dataType: DataType;
}

/** A complete, validated company dataset. */
export interface CompanyData {
  identity: CompanyIdentity;
  /** One or more fiscal-year statements, sorted ascending by fiscalYear. */
  statements: FinancialStatement[];
  valuation: ValuationData | null;
  sources: SourceReference[];
  /** Overall provenance label for the whole dataset. */
  dataType: DataType;
  /**
   * Monotonic version string for the dataset content. Used as part of the
   * AI/analysis cache key so stale analyses are not reused after edits.
   */
  datasetVersion: string;
}

/** Lightweight summary used to render the company selector without the full dataset. */
export interface CompanySummary {
  ticker: string;
  companyName: string;
  sector: string;
  industry: string;
  description: string;
  currency: string;
  exchange: string;
  dataType: DataType;
  latestFiscalYear: number;
  fiscalYearsCovered: number;
}

// ---------------------------------------------------------------------------
// Derived-metric model (output of the deterministic financial engine).
// ---------------------------------------------------------------------------

/**
 * Status of a derived metric.
 *  - "available": computed from sufficient, valid inputs.
 *  - "unavailable": required inputs were missing.
 *  - "not_meaningful": inputs present but the result is not interpretable
 *    (e.g. P/E with negative EPS, debt/equity with negative equity).
 */
export type MetricStatus = "available" | "unavailable" | "not_meaningful";

export type MetricUnit =
  | "currency"
  | "percent"
  | "ratio"
  | "x" // multiple, e.g. P/E = 18x
  | "count";

/** A single deterministically-computed metric with full provenance. */
export interface DerivedMetric {
  /** Stable id used by the AI as a supportingMetricId. */
  id: string;
  label: string;
  value: number | null;
  unit: MetricUnit;
  status: MetricStatus;
  /** Human-readable formula / method used. */
  method: string;
  /** Fiscal years whose statements contributed to this metric. */
  sourcePeriods: number[];
  /** Optional note (e.g. why a value is not meaningful). */
  note?: string;
}

/** A single year's value in a trend series. */
export interface TrendPoint {
  fiscalYear: number;
  value: number | null;
}

/** A named trend series for charts. */
export interface TrendSeries {
  id: string;
  label: string;
  unit: MetricUnit;
  points: TrendPoint[];
}

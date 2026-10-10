/**
 * Deterministic financial calculation engine.
 *
 * AI is NEVER used for arithmetic. Every number shown in the product comes
 * from here (or directly from the validated data layer).
 *
 * Each metric returns a {@link DerivedMetric} carrying its value, unit,
 * method, source periods, and a status (available / unavailable /
 * not_meaningful). Missing inputs yield "unavailable"; present-but-
 * uninterpretable inputs (e.g. P/E with negative EPS) yield "not_meaningful".
 */
import type {
  CompanyData,
  DerivedMetric,
  FinancialStatement,
  MetricUnit,
  TrendSeries,
  ValuationData,
} from "@/lib/data/types";

const EPS = 1e-9;

function isNum(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function metric(
  id: string,
  label: string,
  unit: MetricUnit,
  method: string,
  sourcePeriods: number[],
): DerivedMetric {
  return { id, label, value: null, unit, status: "unavailable", method, sourcePeriods };
}

/** Latest (most recent fiscalYear) statement. */
export function latestStatement(data: CompanyData): FinancialStatement | null {
  if (data.statements.length === 0) return null;
  return data.statements.reduce((a, b) => (b.fiscalYear > a.fiscalYear ? b : a));
}

/** Statement immediately preceding the latest, if the years are consecutive. */
export function priorStatement(data: CompanyData): FinancialStatement | null {
  const sorted = [...data.statements].sort((a, b) => a.fiscalYear - b.fiscalYear);
  if (sorted.length < 2) return null;
  return sorted[sorted.length - 2];
}

// ---------------------------------------------------------------------------
// Individual metric calculators
// ---------------------------------------------------------------------------

/**
 * Free cash flow = operatingCashFlow - capitalExpenditures.
 *
 * SIGN CONVENTION: capitalExpenditures is stored as a POSITIVE magnitude of
 * cash spent (see types.ts). We therefore subtract it directly and must NOT
 * subtract a negative value (which would incorrectly ADD capex). If a dataset
 * provides `freeCashFlow` directly, that reported value is used as-is.
 */
export function freeCashFlow(s: FinancialStatement): DerivedMetric {
  const m = metric(
    "fcf",
    "Free Cash Flow",
    "currency",
    "operatingCashFlow − capitalExpenditures (capex as positive magnitude)",
    [s.fiscalYear],
  );
  if (isNum(s.freeCashFlow)) {
    return { ...m, value: s.freeCashFlow, status: "available", method: "reported free cash flow" };
  }
  if (isNum(s.operatingCashFlow) && isNum(s.capitalExpenditures)) {
    // Guard against double-negation: treat capex as magnitude of spend.
    const capexMagnitude = Math.abs(s.capitalExpenditures);
    return { ...m, value: s.operatingCashFlow - capexMagnitude, status: "available" };
  }
  return m;
}

/** Net profit margin = netIncome / revenue × 100. */
export function netProfitMargin(s: FinancialStatement): DerivedMetric {
  const m = metric("net_margin", "Net Profit Margin", "percent", "netIncome ÷ revenue × 100", [
    s.fiscalYear,
  ]);
  if (!isNum(s.netIncome) || !isNum(s.revenue)) return m;
  if (Math.abs(s.revenue) < EPS) {
    return { ...m, status: "not_meaningful", note: "Revenue is zero." };
  }
  return { ...m, value: (s.netIncome / s.revenue) * 100, status: "available" };
}

/** Operating margin = operatingIncome / revenue × 100. */
export function operatingMargin(s: FinancialStatement): DerivedMetric {
  const m = metric("op_margin", "Operating Margin", "percent", "operatingIncome ÷ revenue × 100", [
    s.fiscalYear,
  ]);
  if (!isNum(s.operatingIncome) || !isNum(s.revenue)) return m;
  if (Math.abs(s.revenue) < EPS) {
    return { ...m, status: "not_meaningful", note: "Revenue is zero." };
  }
  return { ...m, value: (s.operatingIncome / s.revenue) * 100, status: "available" };
}

/**
 * Debt-to-equity = totalDebt / shareholdersEquity.
 *
 * If equity is zero or negative the ratio is NOT meaningfully interpretable
 * (a negative result would look deceptively "low/normal"), so we flag it.
 */
export function debtToEquity(s: FinancialStatement): DerivedMetric {
  const m = metric("debt_to_equity", "Debt-to-Equity", "ratio", "totalDebt ÷ shareholdersEquity", [
    s.fiscalYear,
  ]);
  if (!isNum(s.totalDebt) || !isNum(s.shareholdersEquity)) return m;
  if (s.shareholdersEquity <= EPS) {
    return {
      ...m,
      status: "not_meaningful",
      note:
        s.shareholdersEquity < -EPS
          ? "Shareholders' equity is negative; the ratio is not interpretable."
          : "Shareholders' equity is zero; the ratio is not interpretable.",
    };
  }
  return { ...m, value: s.totalDebt / s.shareholdersEquity, status: "available" };
}

/** Revenue growth = (current − previous) / |previous| × 100. */
export function revenueGrowth(
  current: FinancialStatement,
  previous: FinancialStatement | null,
): DerivedMetric {
  const periods = previous ? [previous.fiscalYear, current.fiscalYear] : [current.fiscalYear];
  const m = metric(
    "revenue_growth",
    "Revenue Growth (YoY)",
    "percent",
    "(currentRevenue − previousRevenue) ÷ |previousRevenue| × 100",
    periods,
  );
  if (!previous) return { ...m, note: "Only one fiscal year available." };
  if (!isNum(current.revenue) || !isNum(previous.revenue)) return m;
  if (Math.abs(previous.revenue) < EPS) {
    return { ...m, status: "not_meaningful", note: "Previous revenue is zero." };
  }
  return {
    ...m,
    value: ((current.revenue - previous.revenue) / Math.abs(previous.revenue)) * 100,
    status: "available",
  };
}

/** Keys of FinancialStatement whose values are `number | null`. */
type NumericStatementField = {
  [K in keyof FinancialStatement]: FinancialStatement[K] extends number | null ? K : never;
}[keyof FinancialStatement];

/** Generic YoY growth for any numeric statement field. */
export function yoyGrowth(
  id: string,
  label: string,
  field: NumericStatementField,
  current: FinancialStatement,
  previous: FinancialStatement | null,
): DerivedMetric {
  const periods = previous ? [previous.fiscalYear, current.fiscalYear] : [current.fiscalYear];
  const m = metric(id, label, "percent", `(current − previous) ÷ |previous| × 100`, periods);
  if (!previous) return { ...m, note: "Only one fiscal year available." };
  const cur = current[field] as number | null;
  const prev = previous[field] as number | null;
  if (!isNum(cur) || !isNum(prev)) return m;
  if (Math.abs(prev) < EPS) {
    return { ...m, status: "not_meaningful", note: "Previous value is zero." };
  }
  return { ...m, value: ((cur - prev) / Math.abs(prev)) * 100, status: "available" };
}

/** P/E ratio = sharePrice / earningsPerShare. */
export function peRatio(valuation: ValuationData | null): DerivedMetric {
  const m = metric("pe_ratio", "P/E Ratio", "x", "sharePrice ÷ earningsPerShare", []);
  if (!valuation) return m;
  // Prefer a directly-reported, positive P/E.
  if (isNum(valuation.peRatio)) {
    if (valuation.peRatio <= 0) {
      return { ...m, status: "not_meaningful", note: "Reported P/E is non-positive." };
    }
    return { ...m, value: valuation.peRatio, status: "available", method: "reported P/E" };
  }
  if (!isNum(valuation.sharePrice) || !isNum(valuation.earningsPerShare)) return m;
  if (valuation.earningsPerShare <= EPS) {
    return {
      ...m,
      status: "not_meaningful",
      note: "Earnings per share is zero or negative; P/E is not meaningful.",
    };
  }
  return { ...m, value: valuation.sharePrice / valuation.earningsPerShare, status: "available" };
}

/** Price-to-sales ratio (reported, or market cap ÷ revenue). */
export function priceToSales(
  valuation: ValuationData | null,
  latest: FinancialStatement | null,
): DerivedMetric {
  const m = metric("ps_ratio", "Price-to-Sales", "x", "marketCap ÷ revenue", []);
  if (!valuation) return m;
  if (isNum(valuation.priceToSalesRatio)) {
    if (valuation.priceToSalesRatio < 0) {
      return { ...m, status: "not_meaningful", note: "Reported P/S is negative." };
    }
    return {
      ...m,
      value: valuation.priceToSalesRatio,
      status: "available",
      method: "reported P/S",
    };
  }
  if (!isNum(valuation.marketCapitalization) || !latest || !isNum(latest.revenue)) return m;
  if (Math.abs(latest.revenue) < EPS) {
    return { ...m, status: "not_meaningful", note: "Revenue is zero." };
  }
  return {
    ...m,
    value: valuation.marketCapitalization / latest.revenue,
    status: "available",
    sourcePeriods: [latest.fiscalYear],
  };
}

/** Free cash flow yield = FCF ÷ market cap × 100. */
export function freeCashFlowYield(
  valuation: ValuationData | null,
  latest: FinancialStatement | null,
): DerivedMetric {
  const m = metric("fcf_yield", "Free Cash Flow Yield", "percent", "FCF ÷ marketCap × 100", []);
  if (!valuation || !latest || !isNum(valuation.marketCapitalization)) return m;
  if (Math.abs(valuation.marketCapitalization) < EPS) {
    return { ...m, status: "not_meaningful", note: "Market capitalization is zero." };
  }
  const fcf = freeCashFlow(latest);
  if (fcf.status !== "available" || !isNum(fcf.value)) return m;
  return {
    ...m,
    value: (fcf.value / valuation.marketCapitalization) * 100,
    status: "available",
    sourcePeriods: [latest.fiscalYear],
  };
}

// ---------------------------------------------------------------------------
// Trend series (for charts)
// ---------------------------------------------------------------------------

function seriesFromField(
  id: string,
  label: string,
  unit: MetricUnit,
  data: CompanyData,
  pick: (s: FinancialStatement) => number | null,
): TrendSeries {
  const sorted = [...data.statements].sort((a, b) => a.fiscalYear - b.fiscalYear);
  return {
    id,
    label,
    unit,
    points: sorted.map((s) => ({ fiscalYear: s.fiscalYear, value: pick(s) })),
  };
}

export function buildTrends(data: CompanyData): TrendSeries[] {
  return [
    seriesFromField("revenue", "Revenue", "currency", data, (s) => s.revenue),
    seriesFromField("net_income", "Net Income", "currency", data, (s) => s.netIncome),
    seriesFromField("net_margin", "Net Profit Margin", "percent", data, (s) =>
      netProfitMargin(s).value,
    ),
    seriesFromField("fcf", "Free Cash Flow", "currency", data, (s) => freeCashFlow(s).value),
    seriesFromField("total_debt", "Total Debt", "currency", data, (s) => s.totalDebt),
  ];
}

// ---------------------------------------------------------------------------
// Aggregate: compute the full metric set for a company.
// ---------------------------------------------------------------------------

export interface ComputedMetrics {
  latestFiscalYear: number | null;
  priorFiscalYear: number | null;
  /** Keyed by metric id for easy lookup / citation validation. */
  metrics: Record<string, DerivedMetric>;
  trends: TrendSeries[];
  /** Metric ids whose status is not "available" (for missing-data warnings). */
  missing: string[];
}

export function computeMetrics(data: CompanyData): ComputedMetrics {
  const latest = latestStatement(data);
  const prior = priorStatement(data);

  const metrics: Record<string, DerivedMetric> = {};

  if (latest) {
    metrics.revenue = {
      id: "revenue",
      label: "Revenue",
      value: latest.revenue,
      unit: "currency",
      status: isNum(latest.revenue) ? "available" : "unavailable",
      method: "reported revenue",
      sourcePeriods: [latest.fiscalYear],
    };
    metrics.net_income = {
      id: "net_income",
      label: "Net Income",
      value: latest.netIncome,
      unit: "currency",
      status: isNum(latest.netIncome) ? "available" : "unavailable",
      method: "reported net income",
      sourcePeriods: [latest.fiscalYear],
    };
    metrics.total_debt = {
      id: "total_debt",
      label: "Total Debt",
      value: latest.totalDebt,
      unit: "currency",
      status: isNum(latest.totalDebt) ? "available" : "unavailable",
      method: "reported total debt",
      sourcePeriods: [latest.fiscalYear],
    };
    metrics.cash = {
      id: "cash",
      label: "Cash & Equivalents",
      value: latest.cashAndCashEquivalents,
      unit: "currency",
      status: isNum(latest.cashAndCashEquivalents) ? "available" : "unavailable",
      method: "reported cash and cash equivalents",
      sourcePeriods: [latest.fiscalYear],
    };
    metrics.net_margin = netProfitMargin(latest);
    metrics.op_margin = operatingMargin(latest);
    metrics.debt_to_equity = debtToEquity(latest);
    metrics.fcf = freeCashFlow(latest);
    metrics.revenue_growth = revenueGrowth(latest, prior);
    metrics.net_income_growth = yoyGrowth(
      "net_income_growth",
      "Net Income Growth (YoY)",
      "netIncome",
      latest,
      prior,
    );
    metrics.pe_ratio = peRatio(data.valuation);
    metrics.ps_ratio = priceToSales(data.valuation, latest);
    metrics.fcf_yield = freeCashFlowYield(data.valuation, latest);
  }

  const missing = Object.values(metrics)
    .filter((mm) => mm.status !== "available")
    .map((mm) => mm.id);

  return {
    latestFiscalYear: latest?.fiscalYear ?? null,
    priorFiscalYear: prior?.fiscalYear ?? null,
    metrics,
    trends: buildTrends(data),
    missing,
  };
}

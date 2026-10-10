/**
 * Transparent, deterministic financial HEALTH score (0–100).
 *
 * IMPORTANT: this scores the financial strength of the BUSINESS. It is NOT a
 * measure of whether buying the STOCK is safe, and it is NOT a credit rating
 * or a prediction. The UI surfaces this caveat prominently.
 *
 * The score is a weighted average of component sub-scores. Each component is
 * mapped from a real metric onto 0–100 via documented, piecewise-linear
 * thresholds. Weights are declared in COMPONENT_WEIGHTS and are easy to change.
 *
 * Missing metrics are NOT treated as 0 and NOT treated as automatic failures.
 * Instead, a component with no usable input is dropped and the remaining
 * weights are renormalised. If overall data coverage is too thin, the result
 * is an explicit "insufficient data" state rather than a misleading number.
 */
import type { CompanyData } from "@/lib/data/types";
import { computeMetrics, latestStatement, priorStatement } from "./calculations";

export type HealthComponentId =
  | "profitability"
  | "growth"
  | "leverage"
  | "cashFlow"
  | "stability";

/** Weights must be easy to change; they are renormalised over available components. */
export const COMPONENT_WEIGHTS: Record<HealthComponentId, number> = {
  profitability: 0.25,
  growth: 0.2,
  leverage: 0.2,
  cashFlow: 0.2,
  stability: 0.15,
};

/** Minimum fraction of total weight that must be scorable for a valid score. */
export const MIN_COVERAGE = 0.5;

export interface HealthComponent {
  id: HealthComponentId;
  label: string;
  /** 0–100, or null when there was no usable input. */
  score: number | null;
  weight: number;
  /** Metric ids that fed this component. */
  metricsUsed: string[];
  explanation: string;
}

export interface HealthScoreResult {
  status: "available" | "insufficient_data";
  /** 0–100 overall, or null when insufficient. */
  overall: number | null;
  components: HealthComponent[];
  /** Fraction (0–1) of total weight that was scorable. */
  coverage: number;
  warnings: string[];
  summary: string;
}

/** Piecewise-linear map from a value to 0–100 given ascending (input, score) points. */
function piecewise(value: number, points: [number, number][]): number {
  if (value <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (value >= x0 && value <= x1) {
      const t = (value - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function computeHealthScore(data: CompanyData): HealthScoreResult {
  const { metrics } = computeMetrics(data);
  const latest = latestStatement(data);
  const prior = priorStatement(data);
  const warnings: string[] = [];

  const components: HealthComponent[] = [];

  // --- Profitability: net profit margin -----------------------------------
  {
    const m = metrics.net_margin;
    let score: number | null = null;
    if (m?.status === "available" && m.value != null) {
      // <= -10% => 0, 0% => 40, 10% => 75, >= 25% => 100
      score = clamp(
        piecewise(m.value, [
          [-10, 0],
          [0, 40],
          [10, 75],
          [25, 100],
        ]),
      );
    } else {
      warnings.push("Profitability: net profit margin unavailable.");
    }
    components.push({
      id: "profitability",
      label: "Profitability",
      score,
      weight: COMPONENT_WEIGHTS.profitability,
      metricsUsed: ["net_margin"],
      explanation:
        "Based on net profit margin — how much of each unit of revenue becomes profit.",
    });
  }

  // --- Growth: revenue growth YoY -----------------------------------------
  {
    const m = metrics.revenue_growth;
    let score: number | null = null;
    if (m?.status === "available" && m.value != null) {
      // <= -20% => 0, 0% => 45, 10% => 75, >= 30% => 100
      score = clamp(
        piecewise(m.value, [
          [-20, 0],
          [0, 45],
          [10, 75],
          [30, 100],
        ]),
      );
    } else {
      warnings.push("Growth: revenue growth unavailable (needs two consecutive years).");
    }
    components.push({
      id: "growth",
      label: "Growth",
      score,
      weight: COMPONENT_WEIGHTS.growth,
      metricsUsed: ["revenue_growth"],
      explanation: "Based on year-over-year revenue growth.",
    });
  }

  // --- Leverage: debt-to-equity -------------------------------------------
  {
    const m = metrics.debt_to_equity;
    let score: number | null = null;
    if (m?.status === "available" && m.value != null) {
      // 0 => 100, 1 => 70, 2 => 45, >= 4 => 10 (lower leverage scores higher)
      score = clamp(
        piecewise(m.value, [
          [0, 100],
          [1, 70],
          [2, 45],
          [4, 10],
        ]),
      );
    } else if (m?.status === "not_meaningful") {
      // Negative/zero equity is a genuine stress signal, not missing data.
      score = 15;
      warnings.push(
        "Leverage: shareholders' equity is zero or negative; scored as elevated risk.",
      );
    } else {
      warnings.push("Leverage: debt-to-equity unavailable.");
    }
    components.push({
      id: "leverage",
      label: "Leverage",
      score,
      weight: COMPONENT_WEIGHTS.leverage,
      metricsUsed: ["debt_to_equity"],
      explanation: "Based on debt-to-equity — lower leverage scores higher.",
    });
  }

  // --- Cash flow: free cash flow sign & margin ----------------------------
  {
    const fcf = metrics.fcf;
    let score: number | null = null;
    if (fcf?.status === "available" && fcf.value != null && latest?.revenue) {
      const fcfMargin = (fcf.value / Math.abs(latest.revenue)) * 100;
      // <= -10% => 0, 0% => 45, 10% => 80, >= 20% => 100
      score = clamp(
        piecewise(fcfMargin, [
          [-10, 0],
          [0, 45],
          [10, 80],
          [20, 100],
        ]),
      );
    } else if (fcf?.status === "available" && fcf.value != null) {
      // No revenue to normalise against: score purely on sign.
      score = fcf.value >= 0 ? 65 : 25;
    } else {
      warnings.push("Cash flow: free cash flow unavailable.");
    }
    components.push({
      id: "cashFlow",
      label: "Cash Flow Strength",
      score,
      weight: COMPONENT_WEIGHTS.cashFlow,
      metricsUsed: ["fcf", "revenue"],
      explanation: "Based on free cash flow relative to revenue.",
    });
  }

  // --- Stability: positive-earnings consistency across available years ----
  {
    const years = [...data.statements].sort((a, b) => a.fiscalYear - b.fiscalYear);
    const withNI = years.filter((s) => typeof s.netIncome === "number");
    let score: number | null = null;
    if (withNI.length >= 2) {
      const positive = withNI.filter((s) => (s.netIncome as number) >= 0).length;
      const ratio = positive / withNI.length;
      score = clamp(ratio * 100);
      if (prior && latest) {
        // Penalise a margin collapse even if still positive.
        const curM = metrics.net_margin.value;
        if (curM != null && curM < 0) score = Math.min(score, 35);
      }
    } else {
      warnings.push("Stability: needs at least two years of net income.");
    }
    components.push({
      id: "stability",
      label: "Financial Stability",
      score,
      weight: COMPONENT_WEIGHTS.stability,
      metricsUsed: ["net_income"],
      explanation: "Based on how consistently the company reported positive earnings.",
    });
  }

  // --- Aggregate with renormalised weights over scorable components -------
  const scorable = components.filter((c) => c.score != null);
  const availableWeight = scorable.reduce((sum, c) => sum + c.weight, 0);
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const coverage = totalWeight > 0 ? availableWeight / totalWeight : 0;

  if (coverage < MIN_COVERAGE || scorable.length === 0) {
    return {
      status: "insufficient_data",
      overall: null,
      components,
      coverage,
      warnings: [
        ...warnings,
        "Insufficient data coverage to produce a reliable financial health score.",
      ],
      summary:
        "There is not enough complete financial data to compute a reliable health score. Add more complete statements to enable scoring.",
    };
  }

  const overall = Math.round(
    scorable.reduce((sum, c) => sum + (c.score as number) * c.weight, 0) / availableWeight,
  );

  return {
    status: "available",
    overall,
    components,
    coverage,
    warnings,
    summary: describeScore(overall),
  };
}

function describeScore(score: number): string {
  if (score >= 80)
    return "This company shows strong fundamentals across profitability, growth, leverage and cash flow on the available data.";
  if (score >= 60)
    return "This company shows generally solid fundamentals, with some areas to watch.";
  if (score >= 40)
    return "This company shows mixed fundamentals; several indicators warrant caution.";
  return "This company shows weak fundamentals on the available data; multiple indicators are concerning.";
}

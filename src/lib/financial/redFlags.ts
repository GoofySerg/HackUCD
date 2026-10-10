/**
 * Deterministic financial red-flag detection.
 *
 * Red flags are derived ONLY from the validated dataset and deterministic
 * calculations — the AI is never allowed to invent additional numeric flags.
 * The AI's role (elsewhere) is limited to explaining these findings in plain
 * English.
 *
 * Each flag carries metric evidence, a severity, an explanation, and the
 * source fiscal period(s) it was observed in.
 */
import type { CompanyData } from "@/lib/data/types";
import { computeMetrics, freeCashFlow, latestStatement, priorStatement } from "./calculations";

export type RedFlagSeverity = "high" | "medium" | "low";

export interface RedFlag {
  id: string;
  name: string;
  severity: RedFlagSeverity;
  explanation: string;
  /** Metric ids that evidence this flag (must exist in computed metrics). */
  evidenceMetricIds: string[];
  /** Fiscal period(s) in which the flag was observed. */
  sourcePeriods: number[];
}

function isNum(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function detectRedFlags(data: CompanyData): RedFlag[] {
  const flags: RedFlag[] = [];
  const { metrics } = computeMetrics(data);
  const latest = latestStatement(data);
  const prior = priorStatement(data);
  if (!latest) return flags;

  // Negative net income
  if (isNum(latest.netIncome) && latest.netIncome < 0) {
    flags.push({
      id: "negative_net_income",
      name: "Reported a net loss",
      severity: "high",
      explanation: `The company reported a net loss in FY${latest.fiscalYear}. Sustained losses can erode equity and may require external funding.`,
      evidenceMetricIds: ["net_income"],
      sourcePeriods: [latest.fiscalYear],
    });
  }

  // Negative free cash flow
  const fcf = freeCashFlow(latest);
  if (fcf.status === "available" && isNum(fcf.value) && fcf.value < 0) {
    flags.push({
      id: "negative_fcf",
      name: "Negative free cash flow",
      severity: "high",
      explanation: `Free cash flow was negative in FY${latest.fiscalYear}: the business consumed more cash than its operations generated after capital spending.`,
      evidenceMetricIds: ["fcf"],
      sourcePeriods: [latest.fiscalYear],
    });
  }

  // Revenue declining YoY
  if (
    prior &&
    isNum(latest.revenue) &&
    isNum(prior.revenue) &&
    latest.revenue < prior.revenue
  ) {
    flags.push({
      id: "revenue_decline",
      name: "Revenue declined year over year",
      severity: "medium",
      explanation: `Revenue fell from FY${prior.fiscalYear} to FY${latest.fiscalYear}. Declining top-line revenue can signal weakening demand or competitive pressure.`,
      evidenceMetricIds: ["revenue", "revenue_growth"],
      sourcePeriods: [prior.fiscalYear, latest.fiscalYear],
    });
  }

  // Profit margin deterioration
  if (prior) {
    const curMargin = metrics.net_margin;
    const priorMargin = (() => {
      if (!isNum(prior.netIncome) || !isNum(prior.revenue) || prior.revenue === 0) return null;
      return (prior.netIncome / prior.revenue) * 100;
    })();
    if (
      curMargin.status === "available" &&
      isNum(curMargin.value) &&
      priorMargin != null &&
      curMargin.value < priorMargin - 2 // >2pp drop
    ) {
      flags.push({
        id: "margin_deterioration",
        name: "Profit margin deteriorating",
        severity: "medium",
        explanation: `Net profit margin fell from about ${priorMargin.toFixed(1)}% in FY${prior.fiscalYear} to ${curMargin.value.toFixed(1)}% in FY${latest.fiscalYear}.`,
        evidenceMetricIds: ["net_margin"],
        sourcePeriods: [prior.fiscalYear, latest.fiscalYear],
      });
    }
  }

  // Debt increasing faster than revenue
  if (
    prior &&
    isNum(latest.totalDebt) &&
    isNum(prior.totalDebt) &&
    isNum(latest.revenue) &&
    isNum(prior.revenue) &&
    prior.totalDebt > 0 &&
    prior.revenue > 0
  ) {
    const debtGrowth = ((latest.totalDebt - prior.totalDebt) / prior.totalDebt) * 100;
    const revGrowth = ((latest.revenue - prior.revenue) / prior.revenue) * 100;
    if (debtGrowth > 0 && debtGrowth > revGrowth + 5) {
      flags.push({
        id: "debt_outpacing_revenue",
        name: "Debt growing faster than revenue",
        severity: "medium",
        explanation: `Total debt grew ~${debtGrowth.toFixed(1)}% while revenue grew ~${revGrowth.toFixed(1)}% from FY${prior.fiscalYear} to FY${latest.fiscalYear}. Rising leverage relative to revenue can strain future cash flows.`,
        evidenceMetricIds: ["total_debt", "revenue"],
        sourcePeriods: [prior.fiscalYear, latest.fiscalYear],
      });
    }
  }

  // Negative shareholders' equity
  if (isNum(latest.shareholdersEquity) && latest.shareholdersEquity < 0) {
    flags.push({
      id: "negative_equity",
      name: "Negative shareholders' equity",
      severity: "high",
      explanation: `Shareholders' equity was negative in FY${latest.fiscalYear}, meaning reported liabilities exceeded assets. Common ratios such as debt-to-equity become uninterpretable.`,
      evidenceMetricIds: ["debt_to_equity"],
      sourcePeriods: [latest.fiscalYear],
    });
  }

  // Inconsistent cash flow generation across years
  {
    const ocf = [...data.statements]
      .sort((a, b) => a.fiscalYear - b.fiscalYear)
      .map((s) => s.operatingCashFlow)
      .filter(isNum);
    if (ocf.length >= 3) {
      const negatives = ocf.filter((v) => v < 0).length;
      const positives = ocf.length - negatives;
      if (negatives > 0 && positives > 0) {
        flags.push({
          id: "inconsistent_cash_flow",
          name: "Inconsistent operating cash flow",
          severity: "low",
          explanation:
            "Operating cash flow swung between positive and negative across the available years, indicating inconsistent cash generation.",
          evidenceMetricIds: ["fcf"],
          sourcePeriods: data.statements.map((s) => s.fiscalYear),
        });
      }
    }
  }

  // Missing / unusable valuation inputs
  if (metrics.pe_ratio.status !== "available" && metrics.ps_ratio.status !== "available") {
    flags.push({
      id: "no_valuation_data",
      name: "Valuation cannot be assessed",
      severity: "low",
      explanation:
        "The dataset lacks usable valuation inputs (e.g. share price, EPS, or market capitalization), so the platform cannot assess whether the shares are expensive or inexpensive.",
      evidenceMetricIds: ["pe_ratio", "ps_ratio"],
      sourcePeriods: [latest.fiscalYear],
    });
  }

  // Severity ordering: high, medium, low
  const order: Record<RedFlagSeverity, number> = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}

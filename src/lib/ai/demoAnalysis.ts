/**
 * Demo analysis builder.
 *
 * Used ONLY when OpenRouter is not configured. It does NOT fabricate AI
 * output — instead it assembles a clearly-labelled example from the SAME
 * deterministic metrics, health score, and red flags the dashboard uses, so
 * the workflow can be demonstrated end-to-end without an API key.
 *
 * The result is marked `mode: "demo"` and the UI labels it as a static
 * example, explaining that live AI analysis is unavailable.
 */
import type { CompanyData } from "@/lib/data/types";
import { computeMetrics } from "@/lib/financial/calculations";
import { computeHealthScore } from "@/lib/financial/healthScore";
import { detectRedFlags } from "@/lib/financial/redFlags";
import { formatByUnit } from "@/lib/format";
import type { EvidencePackage } from "./evidence";
import type { AnalysisResult, VerifiedFinding } from "./analysisResult";

function finding(partial: Omit<VerifiedFinding,
  "rejectedMetricIds" | "rejectedSourceIds">): VerifiedFinding {
  return { rejectedMetricIds: [], rejectedSourceIds: [], ...partial };
}

export function buildDemoAnalysis(
  data: CompanyData,
  evidence: EvidencePackage,
): AnalysisResult {
  const { metrics } = computeMetrics(data);
  const health = computeHealthScore(data);
  const flags = detectRedFlags(data);
  const currency = data.identity.currency;
  const allSourceIds = data.sources.map((s) => s.id);

  const strengths: VerifiedFinding[] = [];

  const revGrowth = metrics.revenue_growth;
  if (revGrowth.status === "available" && (revGrowth.value ?? 0) > 0) {
    strengths.push(
      finding({
        title: "Revenue is growing",
        explanation: `Revenue grew ${formatByUnit(revGrowth.value, "percent", currency)} year over year, indicating expanding top-line demand.`,
        supportingMetricIds: ["revenue_growth", "revenue"],
        sourceIds: allSourceIds,
        limitations: "Growth in a single year does not guarantee it will continue.",
        verifiedMetricIds: ["revenue_growth", "revenue"],
        verifiedSourceIds: allSourceIds,
      }),
    );
  }
  const margin = metrics.net_margin;
  if (margin.status === "available" && (margin.value ?? 0) > 0) {
    strengths.push(
      finding({
        title: "The business is profitable",
        explanation: `Net profit margin is ${formatByUnit(margin.value, "percent", currency)}, so the company keeps a positive share of each unit of revenue as profit.`,
        supportingMetricIds: ["net_margin", "net_income"],
        sourceIds: allSourceIds,
        limitations: "Margins can change as costs or competition shift.",
        verifiedMetricIds: ["net_margin", "net_income"],
        verifiedSourceIds: allSourceIds,
      }),
    );
  }
  const fcf = metrics.fcf;
  if (fcf.status === "available" && (fcf.value ?? 0) > 0) {
    strengths.push(
      finding({
        title: "Positive free cash flow",
        explanation: `The company generated ${formatByUnit(fcf.value, "currency", currency)} of free cash flow, cash left after operating and capital spending.`,
        supportingMetricIds: ["fcf"],
        sourceIds: allSourceIds,
        limitations: "Free cash flow can be lumpy year to year.",
        verifiedMetricIds: ["fcf"],
        verifiedSourceIds: allSourceIds,
      }),
    );
  }
  if (strengths.length === 0) {
    strengths.push(
      finding({
        title: "Limited positive signals in the available data",
        explanation:
          "On the available data, the strongest conventional positive indicators (growth, profitability, free cash flow) are not clearly present.",
        supportingMetricIds: [],
        sourceIds: allSourceIds,
        limitations: "This reflects the supplied dataset only.",
        verifiedMetricIds: [],
        verifiedSourceIds: allSourceIds,
      }),
    );
  }

  const risks: VerifiedFinding[] = flags.slice(0, 3).map((f) =>
    finding({
      title: f.name,
      explanation: f.explanation,
      supportingMetricIds: f.evidenceMetricIds,
      sourceIds: allSourceIds,
      limitations: "Deterministically detected from the dataset; context may be missing.",
      verifiedMetricIds: f.evidenceMetricIds.filter((id) => evidence.validMetricIds.includes(id)),
      verifiedSourceIds: allSourceIds,
    }),
  );
  if (risks.length === 0) {
    risks.push(
      finding({
        title: "No automated red flags detected",
        explanation:
          "The deterministic red-flag checks did not trigger on the available data. This is not a guarantee of safety — important risks may lie outside the supplied figures.",
        supportingMetricIds: [],
        sourceIds: allSourceIds,
        limitations: "Absence of flags is not absence of risk.",
        verifiedMetricIds: [],
        verifiedSourceIds: allSourceIds,
      }),
    );
  }

  const valuationText = evidence.valuationAvailable
    ? "Valuation metrics are available in the dataset; remember that a financially healthy company can still be an expensive investment."
    : "This dataset lacks usable valuation inputs, so StockScope cannot assess whether the shares are expensive or inexpensive.";

  return {
    ticker: data.identity.ticker,
    datasetVersion: data.datasetVersion,
    model: null,
    generatedAt: new Date().toISOString(),
    mode: "demo",
    bull: { status: "ok", findings: strengths },
    bear: { status: "ok", findings: risks },
    review: {
      status: "ok",
      overallNote:
        "Demo mode: findings are derived deterministically from the dataset. Configure OPENROUTER_API_KEY for live, AI-generated analysis.",
    },
    summary: {
      status: "ok",
      content: {
        whatTheCompanyDoes: data.identity.description,
        financialCondition:
          health.status === "available"
            ? `${health.summary} The overall financial health score is ${health.overall}/100 based on the available data.`
            : health.summary,
        strongestPositives: strengths.map((s) => s.title),
        mostImportantRisks: risks.map((r) => r.title),
        valuationConsiderations: valuationText,
        missingInformation: health.warnings,
        questionsToInvestigate: [
          "How sustainable is the current revenue trend?",
          "What is driving the debt and cash-flow picture?",
          "Are there risks not captured in the supplied financial data?",
        ],
        plainEnglishSummary:
          "This is a clearly-labelled DEMO analysis assembled from StockScope's deterministic financial engine. It is not live AI output. Add an OpenRouter API key to generate a full AI research analysis with Bull, Bear, evidence review, and a plain-English explainer.",
      },
    },
    partial: false,
    warnings: ["Demo mode: live AI analysis is unavailable (no OpenRouter API key configured)."],
  };
}

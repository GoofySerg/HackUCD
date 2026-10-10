/**
 * Analysis orchestrator.
 *
 * Pipeline:
 *   1. Build the evidence package (validated, deterministic).
 *   2. Run Bull + Bear analysts (in parallel).
 *   3. Run the Evidence Reviewer.
 *   4. DETERMINISTICALLY validate every citation against the known metric and
 *      source ids. AI-invented ids are rejected and never shown as
 *      source-backed.
 *   5. Run the Plain-English summary.
 *   6. Return a result with per-agent status and partial-failure handling.
 *
 * Completed results are cached by (ticker, datasetVersion, model) so repeated
 * requests don't waste API credits.
 */
import "server-only";
import type { CompanyData } from "@/lib/data/types";
import { buildEvidencePackage, type EvidencePackage } from "./evidence";
import { runBullAnalyst } from "./bullAnalyst";
import { runBearAnalyst } from "./bearAnalyst";
import { runEvidenceReviewer } from "./evidenceReviewer";
import { runResearchSummary } from "./researchSummary";
import { getOpenRouterConfig, isAiConfigured, OpenRouterError } from "./openrouter";
import type { AgentError, AnalysisResult, VerifiedFinding } from "./analysisResult";
import type { BearOutput, BullOutput, EvidenceReview, Finding } from "./schemas";
import { buildDemoAnalysis } from "./demoAnalysis";

const cache = new Map<string, AnalysisResult>();

function cacheKey(ticker: string, datasetVersion: string, model: string): string {
  return `${ticker}::${datasetVersion}::${model}`;
}

function toAgentError(err: unknown): AgentError {
  if (err instanceof OpenRouterError) return { kind: err.kind, message: err.message };
  return { kind: "unknown", message: err instanceof Error ? err.message : String(err) };
}

/** Validate a finding's citations against the known id sets. Exported for tests. */
export function verifyFinding(
  finding: Finding,
  evidence: EvidencePackage,
  review: EvidenceReview | null,
  side: "bull" | "bear",
): VerifiedFinding {
  const validMetric = new Set(evidence.validMetricIds);
  const validSource = new Set(evidence.validSourceIds);

  const verifiedMetricIds = finding.supportingMetricIds.filter((id) => validMetric.has(id));
  const rejectedMetricIds = finding.supportingMetricIds.filter((id) => !validMetric.has(id));
  const verifiedSourceIds = finding.sourceIds.filter((id) => validSource.has(id));
  const rejectedSourceIds = finding.sourceIds.filter((id) => !validSource.has(id));

  const reviewItem = review?.reviews.find(
    (r) => r.side === side && r.findingTitle.trim() === finding.title.trim(),
  );

  return {
    ...finding,
    verifiedMetricIds,
    verifiedSourceIds,
    rejectedMetricIds,
    rejectedSourceIds,
    reviewSupported: reviewItem?.supported,
    reviewIssues: reviewItem?.issues,
    requiresHumanReview: reviewItem?.requiresHumanReview,
  };
}

export interface GenerateOptions {
  /** Force regeneration even if cached. */
  force?: boolean;
}

/**
 * Generate (or return cached) analysis for a company.
 * When AI is not configured, returns a clearly-labelled demo analysis.
 */
export async function generateAnalysis(
  data: CompanyData,
  opts: GenerateOptions = {},
): Promise<AnalysisResult> {
  const config = getOpenRouterConfig();
  const modelKey = config?.model ?? "demo";
  const key = cacheKey(data.identity.ticker, data.datasetVersion, modelKey);

  if (!opts.force && cache.has(key)) {
    return cache.get(key)!;
  }

  const evidence = buildEvidencePackage(data);

  // Demo mode — no API key. Return labelled static analysis, not fabricated AI.
  if (!isAiConfigured()) {
    const demo = buildDemoAnalysis(data, evidence);
    cache.set(key, demo);
    return demo;
  }

  const warnings: string[] = [];
  const result: AnalysisResult = {
    ticker: data.identity.ticker,
    datasetVersion: data.datasetVersion,
    model: config!.model,
    generatedAt: new Date().toISOString(),
    mode: "live",
    bull: { status: "skipped", findings: [] },
    bear: { status: "skipped", findings: [] },
    review: { status: "skipped", overallNote: "" },
    summary: { status: "skipped", content: null },
    partial: false,
    warnings,
  };

  // 1+2. Bull and Bear in parallel.
  const [bullRes, bearRes] = await Promise.allSettled([
    runBullAnalyst(evidence),
    runBearAnalyst(evidence),
  ]);

  let bull: BullOutput | null = null;
  let bear: BearOutput | null = null;

  if (bullRes.status === "fulfilled") {
    bull = bullRes.value;
    result.bull.status = "ok";
  } else {
    result.bull.status = "failed";
    result.bull.error = toAgentError(bullRes.reason);
    warnings.push(`Bull analyst failed: ${result.bull.error.message}`);
  }

  if (bearRes.status === "fulfilled") {
    bear = bearRes.value;
    result.bear.status = "ok";
  } else {
    result.bear.status = "failed";
    result.bear.error = toAgentError(bearRes.reason);
    warnings.push(`Bear analyst failed: ${result.bear.error.message}`);
  }

  // 3. Evidence review (only if we have at least one side).
  let review: EvidenceReview | null = null;
  if (bull || bear) {
    try {
      review = await runEvidenceReviewer(
        evidence,
        bull ?? { strengths: [] as unknown as BullOutput["strengths"] },
        bear ?? { risks: [] as unknown as BearOutput["risks"] },
      );
      result.review.status = "ok";
      result.review.overallNote = review.overallNote;
    } catch (err) {
      result.review.status = "failed";
      result.review.error = toAgentError(err);
      warnings.push(`Evidence reviewer failed: ${result.review.error.message}`);
    }
  }

  // 4. Deterministic citation validation.
  if (bull) {
    result.bull.findings = bull.strengths.map((f) => verifyFinding(f, evidence, review, "bull"));
  }
  if (bear) {
    result.bear.findings = bear.risks.map((f) => verifyFinding(f, evidence, review, "bear"));
  }

  // 5. Plain-English summary (only if we have findings).
  if (bull || bear) {
    try {
      const summary = await runResearchSummary(
        evidence,
        bull ?? { strengths: [] as unknown as BullOutput["strengths"] },
        bear ?? { risks: [] as unknown as BearOutput["risks"] },
      );
      result.summary.status = "ok";
      result.summary.content = summary;
    } catch (err) {
      result.summary.status = "failed";
      result.summary.error = toAgentError(err);
      warnings.push(`Research summary failed: ${result.summary.error.message}`);
    }
  }

  result.partial =
    result.bull.status === "failed" ||
    result.bear.status === "failed" ||
    result.summary.status === "failed";

  // Only cache if at least one analytical side succeeded.
  if (result.bull.status === "ok" || result.bear.status === "ok") {
    cache.set(key, result);
  }

  return result;
}

/** Return a cached result if present (used by the PDF report route). */
export function getCachedAnalysis(
  data: CompanyData,
): AnalysisResult | null {
  const config = getOpenRouterConfig();
  const modelKey = config?.model ?? "demo";
  const key = cacheKey(data.identity.ticker, data.datasetVersion, modelKey);
  return cache.get(key) ?? null;
}

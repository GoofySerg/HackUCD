/**
 * Shared analysis result types. This module is CLIENT-SAFE (no server-only
 * imports) so both the API route and client components can import the types.
 */
import type { Finding, ResearchSummary } from "./schemas";

/** A finding after deterministic citation validation. */
export interface VerifiedFinding extends Finding {
  /** Metric ids that exist in the computed metric set. */
  verifiedMetricIds: string[];
  /** Source ids that exist in the dataset. */
  verifiedSourceIds: string[];
  /** Cited ids that did NOT match anything (dropped, flagged). */
  rejectedMetricIds: string[];
  rejectedSourceIds: string[];
  /** AI evidence-reviewer verdict for this finding, if available. */
  reviewSupported?: boolean;
  reviewIssues?: string[];
  requiresHumanReview?: boolean;
}

export type AgentStatus = "ok" | "failed" | "skipped";

export interface AgentError {
  kind: string;
  message: string;
}

export interface AnalysisResult {
  ticker: string;
  datasetVersion: string;
  model: string | null;
  generatedAt: string;
  /** Whether this was produced by live AI or is a labelled demo example. */
  mode: "live" | "demo";

  bull: {
    status: AgentStatus;
    findings: VerifiedFinding[];
    error?: AgentError;
  };
  bear: {
    status: AgentStatus;
    findings: VerifiedFinding[];
    error?: AgentError;
  };
  review: {
    status: AgentStatus;
    overallNote: string;
    error?: AgentError;
  };
  summary: {
    status: AgentStatus;
    content: ResearchSummary | null;
    error?: AgentError;
  };

  /** True if any agent failed — UI shows a partial-analysis warning. */
  partial: boolean;
  warnings: string[];
}

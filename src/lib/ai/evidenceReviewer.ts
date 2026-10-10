import "server-only";
import { callStructured } from "./openrouter";
import { evidenceReviewSchema, type EvidenceReview, type BullOutput, type BearOutput } from "./schemas";
import type { EvidencePackage } from "./evidence";
import { evidenceReviewSystemPrompt, userPromptWithEvidence } from "./prompts";

/**
 * AI Agent 3 — Evidence Reviewer. Judges Bull/Bear findings against evidence.
 * This is an ADDITIONAL check on top of deterministic citation validation
 * (see analysis.ts); it never replaces it.
 */
export async function runEvidenceReviewer(
  evidence: EvidencePackage,
  bull: BullOutput,
  bear: BearOutput,
): Promise<EvidenceReview> {
  const findings = {
    bull: bull.strengths.map((s) => ({ title: s.title, explanation: s.explanation })),
    bear: bear.risks.map((r) => ({ title: r.title, explanation: r.explanation })),
  };
  return callStructured(evidenceReviewSchema, {
    system: evidenceReviewSystemPrompt(),
    user: userPromptWithEvidence(
      evidence,
      `Review these findings against the evidence.\nFINDINGS (JSON):\n${JSON.stringify(findings)}`,
    ),
  });
}

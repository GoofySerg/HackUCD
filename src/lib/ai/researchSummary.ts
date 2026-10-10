import "server-only";
import { callStructured } from "./openrouter";
import {
  researchSummarySchema,
  type ResearchSummary,
  type BullOutput,
  type BearOutput,
} from "./schemas";
import type { EvidencePackage } from "./evidence";
import { researchSummarySystemPrompt, userPromptWithEvidence } from "./prompts";

/** AI Agent 4 — Plain-English Research Explainer. */
export async function runResearchSummary(
  evidence: EvidencePackage,
  bull: BullOutput,
  bear: BearOutput,
): Promise<ResearchSummary> {
  const findings = {
    strengths: bull.strengths.map((s) => s.title),
    risks: bear.risks.map((r) => r.title),
  };
  return callStructured(researchSummarySchema, {
    system: researchSummarySystemPrompt(),
    user: userPromptWithEvidence(
      evidence,
      `Write a beginner-friendly research explanation. Validated finding titles (JSON):\n${JSON.stringify(
        findings,
      )}`,
    ),
    timeoutMs: 60_000,
  });
}

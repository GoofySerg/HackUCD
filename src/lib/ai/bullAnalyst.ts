import "server-only";
import { callStructured } from "./openrouter";
import { bullOutputSchema, type BullOutput } from "./schemas";
import type { EvidencePackage } from "./evidence";
import { bullSystemPrompt, userPromptWithEvidence } from "./prompts";

/** AI Agent 1 — Bull Analyst. Evidence-based positive case. */
export async function runBullAnalyst(evidence: EvidencePackage): Promise<BullOutput> {
  return callStructured(bullOutputSchema, {
    system: bullSystemPrompt(),
    user: userPromptWithEvidence(
      evidence,
      "Identify up to three evidence-backed financial strengths for this company.",
    ),
  });
}

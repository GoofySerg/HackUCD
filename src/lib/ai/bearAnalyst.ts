import "server-only";
import { callStructured } from "./openrouter";
import { bearOutputSchema, type BearOutput } from "./schemas";
import type { EvidencePackage } from "./evidence";
import { bearSystemPrompt, userPromptWithEvidence } from "./prompts";

/** AI Agent 2 — Bear Analyst. Evidence-based downside case. */
export async function runBearAnalyst(evidence: EvidencePackage): Promise<BearOutput> {
  return callStructured(bearOutputSchema, {
    system: bearSystemPrompt(),
    user: userPromptWithEvidence(
      evidence,
      "Identify up to three evidence-backed financial risks or concerns for this company.",
    ),
  });
}

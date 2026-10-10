/**
 * Zod schemas for the structured AI outputs and the "evidence package" that
 * is fed to the models. All AI responses are validated against these before
 * being trusted. Citations are additionally verified deterministically in
 * code (see analysis.ts) — the AI cannot invent valid source ids.
 */
import { z } from "zod";

/** A single finding produced by the Bull or Bear analyst. */
export const findingSchema = z.object({
  title: z.string().min(1).max(160),
  explanation: z.string().min(1).max(1200),
  /** Metric ids the finding relies on; validated against computed metrics. */
  supportingMetricIds: z.array(z.string()).max(12).default([]),
  /** Source ids the finding cites; validated against dataset sources. */
  sourceIds: z.array(z.string()).max(12).default([]),
  limitations: z.string().max(600).default(""),
});
export type Finding = z.infer<typeof findingSchema>;

export const bullOutputSchema = z.object({
  strengths: z.array(findingSchema).min(1).max(3),
});
export type BullOutput = z.infer<typeof bullOutputSchema>;

export const bearOutputSchema = z.object({
  risks: z.array(findingSchema).min(1).max(3),
});
export type BearOutput = z.infer<typeof bearOutputSchema>;

/** Evidence reviewer verdict on a single finding, keyed by finding title. */
export const reviewItemSchema = z.object({
  findingTitle: z.string().min(1),
  side: z.enum(["bull", "bear"]),
  supported: z.boolean(),
  /** Concerns: unsupported claims, missing context, contradictions. */
  issues: z.array(z.string()).max(8).default([]),
  requiresHumanReview: z.boolean().default(false),
});
export const evidenceReviewSchema = z.object({
  reviews: z.array(reviewItemSchema).default([]),
  overallNote: z.string().max(800).default(""),
});
export type EvidenceReview = z.infer<typeof evidenceReviewSchema>;

export const researchSummarySchema = z.object({
  whatTheCompanyDoes: z.string().min(1).max(1200),
  financialCondition: z.string().min(1).max(1600),
  strongestPositives: z.array(z.string().max(400)).max(5).default([]),
  mostImportantRisks: z.array(z.string().max(400)).max(5).default([]),
  valuationConsiderations: z.string().max(1200).default(""),
  missingInformation: z.array(z.string().max(300)).max(6).default([]),
  questionsToInvestigate: z.array(z.string().max(300)).max(6).default([]),
  plainEnglishSummary: z.string().min(1).max(2000),
});
export type ResearchSummary = z.infer<typeof researchSummarySchema>;

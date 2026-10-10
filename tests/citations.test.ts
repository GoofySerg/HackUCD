import { describe, it, expect } from "vitest";
import { verifyFinding } from "@/lib/ai/analysis";
import { buildEvidencePackage } from "@/lib/ai/evidence";
import type { Finding } from "@/lib/ai/schemas";
import { makeCompany, makeStatement } from "./fixtures";

const company = makeCompany([
  makeStatement({ fiscalYear: 2023, revenue: 1000 }),
  makeStatement({ fiscalYear: 2024, revenue: 1200 }),
]);
const evidence = buildEvidencePackage(company);

function finding(over: Partial<Finding>): Finding {
  return {
    title: "t",
    explanation: "e",
    supportingMetricIds: [],
    sourceIds: [],
    limitations: "",
    ...over,
  };
}

describe("verifyFinding (deterministic citation validation)", () => {
  it("accepts real metric and source ids", () => {
    const v = verifyFinding(
      finding({ supportingMetricIds: ["revenue"], sourceIds: ["src-1"] }),
      evidence,
      null,
      "bull",
    );
    expect(v.verifiedMetricIds).toEqual(["revenue"]);
    expect(v.verifiedSourceIds).toEqual(["src-1"]);
    expect(v.rejectedMetricIds).toEqual([]);
    expect(v.rejectedSourceIds).toEqual([]);
  });

  it("rejects AI-invented metric and source ids", () => {
    const v = verifyFinding(
      finding({ supportingMetricIds: ["made_up_metric"], sourceIds: ["sec-10k-2099"] }),
      evidence,
      null,
      "bear",
    );
    expect(v.verifiedMetricIds).toEqual([]);
    expect(v.rejectedMetricIds).toEqual(["made_up_metric"]);
    expect(v.rejectedSourceIds).toEqual(["sec-10k-2099"]);
  });

  it("attaches the matching evidence-reviewer verdict", () => {
    const v = verifyFinding(
      finding({ title: "Revenue grows" }),
      evidence,
      {
        reviews: [{ findingTitle: "Revenue grows", side: "bull", supported: false, issues: ["needs context"], requiresHumanReview: true }],
        overallNote: "",
      },
      "bull",
    );
    expect(v.reviewSupported).toBe(false);
    expect(v.requiresHumanReview).toBe(true);
    expect(v.reviewIssues).toContain("needs context");
  });
});

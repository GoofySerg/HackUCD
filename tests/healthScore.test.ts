import { describe, it, expect } from "vitest";
import { computeHealthScore } from "@/lib/financial/healthScore";
import { makeCompany, makeStatement } from "./fixtures";

describe("computeHealthScore", () => {
  it("returns insufficient_data when coverage is too thin", () => {
    const c = makeCompany([
      makeStatement({
        fiscalYear: 2024,
        revenue: null,
        netIncome: null,
        operatingCashFlow: null,
        capitalExpenditures: null,
        totalDebt: null,
        shareholdersEquity: null,
      }),
    ]);
    const r = computeHealthScore(c);
    expect(r.status).toBe("insufficient_data");
    expect(r.overall).toBeNull();
  });

  it("produces a 0-100 score for a healthy multi-year company", () => {
    const c = makeCompany([
      makeStatement({ fiscalYear: 2022, revenue: 800, netIncome: 80, totalDebt: 300, shareholdersEquity: 700 }),
      makeStatement({ fiscalYear: 2023, revenue: 1000, netIncome: 110, totalDebt: 350, shareholdersEquity: 750 }),
      makeStatement({ fiscalYear: 2024, revenue: 1250, netIncome: 150, totalDebt: 400, shareholdersEquity: 820 }),
    ]);
    const r = computeHealthScore(c);
    expect(r.status).toBe("available");
    expect(r.overall).toBeGreaterThanOrEqual(0);
    expect(r.overall).toBeLessThanOrEqual(100);
    expect(r.overall!).toBeGreaterThan(60); // healthy profile
  });

  it("does not treat missing metrics as zeros (renormalises weights)", () => {
    const c = makeCompany([
      makeStatement({ fiscalYear: 2023, revenue: 1000, netIncome: 100, totalDebt: null, shareholdersEquity: null }),
      makeStatement({ fiscalYear: 2024, revenue: 1200, netIncome: 130, totalDebt: null, shareholdersEquity: null }),
    ]);
    const r = computeHealthScore(c);
    // Leverage component has no input -> dropped, not scored 0.
    const leverage = r.components.find((x) => x.id === "leverage")!;
    expect(leverage.score).toBeNull();
    if (r.status === "available") expect(r.coverage).toBeLessThan(1);
  });

  it("scores a loss-making, high-leverage company low", () => {
    const c = makeCompany([
      makeStatement({ fiscalYear: 2022, revenue: 12, netIncome: -88, operatingCashFlow: -78, capitalExpenditures: 15, totalDebt: 90, shareholdersEquity: 280 }),
      makeStatement({ fiscalYear: 2023, revenue: 9, netIncome: -108, operatingCashFlow: -95, capitalExpenditures: 18, totalDebt: 120, shareholdersEquity: 160 }),
      makeStatement({ fiscalYear: 2024, revenue: 7, netIncome: -129, operatingCashFlow: -110, capitalExpenditures: 20, totalDebt: 165, shareholdersEquity: 30 }),
    ]);
    const r = computeHealthScore(c);
    expect(r.status).toBe("available");
    expect(r.overall!).toBeLessThan(40);
  });
});

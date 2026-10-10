import { describe, it, expect } from "vitest";
import { detectRedFlags } from "@/lib/financial/redFlags";
import { makeCompany, makeStatement } from "./fixtures";

function ids(flags: ReturnType<typeof detectRedFlags>) {
  return flags.map((f) => f.id);
}

describe("detectRedFlags", () => {
  it("flags a net loss", () => {
    const c = makeCompany([makeStatement({ fiscalYear: 2024, netIncome: -50 })]);
    expect(ids(detectRedFlags(c))).toContain("negative_net_income");
  });

  it("flags negative free cash flow", () => {
    const c = makeCompany([makeStatement({ fiscalYear: 2024, operatingCashFlow: 10, capitalExpenditures: 80, freeCashFlow: null })]);
    expect(ids(detectRedFlags(c))).toContain("negative_fcf");
  });

  it("flags revenue decline", () => {
    const c = makeCompany([
      makeStatement({ fiscalYear: 2023, revenue: 1200 }),
      makeStatement({ fiscalYear: 2024, revenue: 1000 }),
    ]);
    expect(ids(detectRedFlags(c))).toContain("revenue_decline");
  });

  it("flags debt growing faster than revenue", () => {
    const c = makeCompany([
      makeStatement({ fiscalYear: 2023, revenue: 1000, totalDebt: 400 }),
      makeStatement({ fiscalYear: 2024, revenue: 1050, totalDebt: 700 }),
    ]);
    expect(ids(detectRedFlags(c))).toContain("debt_outpacing_revenue");
  });

  it("flags negative shareholders' equity", () => {
    const c = makeCompany([makeStatement({ fiscalYear: 2024, shareholdersEquity: -10 })]);
    expect(ids(detectRedFlags(c))).toContain("negative_equity");
  });

  it("flags missing valuation data", () => {
    const c = makeCompany([makeStatement({ fiscalYear: 2024 })]); // valuation null
    expect(ids(detectRedFlags(c))).toContain("no_valuation_data");
  });

  it("orders flags by severity (high first)", () => {
    const c = makeCompany([
      makeStatement({ fiscalYear: 2023, revenue: 1200, netIncome: 50 }),
      makeStatement({ fiscalYear: 2024, revenue: 1000, netIncome: -50, operatingCashFlow: 10, capitalExpenditures: 80 }),
    ]);
    const flags = detectRedFlags(c);
    const severities = flags.map((f) => f.severity);
    const order = { high: 0, medium: 1, low: 2 } as const;
    for (let i = 1; i < severities.length; i++) {
      expect(order[severities[i]]).toBeGreaterThanOrEqual(order[severities[i - 1]]);
    }
  });

  it("does not flag a clean company (aside from valuation)", () => {
    const c = makeCompany(
      [
        makeStatement({ fiscalYear: 2023, revenue: 1000, netIncome: 100, totalDebt: 300, shareholdersEquity: 800, operatingCashFlow: 200, capitalExpenditures: 50 }),
        makeStatement({ fiscalYear: 2024, revenue: 1200, netIncome: 130, totalDebt: 320, shareholdersEquity: 860, operatingCashFlow: 240, capitalExpenditures: 60 }),
      ],
      {
        valuation: {
          asOfDate: "2025-01-01", sharePrice: 10, sharesOutstanding: 100, marketCapitalization: 1000,
          earningsPerShare: 1.3, peRatio: null, priceToSalesRatio: null,
        },
      },
    );
    const flagIds = ids(detectRedFlags(c));
    expect(flagIds).not.toContain("negative_net_income");
    expect(flagIds).not.toContain("negative_fcf");
    expect(flagIds).not.toContain("revenue_decline");
    expect(flagIds).not.toContain("no_valuation_data");
  });
});

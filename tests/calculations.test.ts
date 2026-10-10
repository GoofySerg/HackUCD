import { describe, it, expect } from "vitest";
import {
  computeMetrics,
  debtToEquity,
  freeCashFlow,
  netProfitMargin,
  peRatio,
  revenueGrowth,
} from "@/lib/financial/calculations";
import { makeCompany, makeStatement } from "./fixtures";

describe("freeCashFlow", () => {
  it("computes OCF - capex (capex as positive magnitude)", () => {
    const s = makeStatement({ fiscalYear: 2024, operatingCashFlow: 200, capitalExpenditures: 60, freeCashFlow: null });
    const m = freeCashFlow(s);
    expect(m.status).toBe("available");
    expect(m.value).toBe(140);
  });

  it("does not double-subtract a negative reported capex", () => {
    const s = makeStatement({ fiscalYear: 2024, operatingCashFlow: 200, capitalExpenditures: -60, freeCashFlow: null });
    const m = freeCashFlow(s);
    expect(m.value).toBe(140); // abs(capex) used
  });

  it("uses reported FCF when present", () => {
    const s = makeStatement({ fiscalYear: 2024, freeCashFlow: 999 });
    expect(freeCashFlow(s).value).toBe(999);
  });

  it("is unavailable when inputs missing", () => {
    const s = makeStatement({ fiscalYear: 2024, operatingCashFlow: null, capitalExpenditures: null, freeCashFlow: null });
    expect(freeCashFlow(s).status).toBe("unavailable");
  });
});

describe("netProfitMargin", () => {
  it("computes a normal margin", () => {
    const s = makeStatement({ fiscalYear: 2024, netIncome: 100, revenue: 1000 });
    expect(netProfitMargin(s).value).toBeCloseTo(10);
  });
  it("is not meaningful when revenue is zero", () => {
    const s = makeStatement({ fiscalYear: 2024, netIncome: 100, revenue: 0 });
    expect(netProfitMargin(s).status).toBe("not_meaningful");
  });
  it("preserves negative margins", () => {
    const s = makeStatement({ fiscalYear: 2024, netIncome: -50, revenue: 1000 });
    expect(netProfitMargin(s).value).toBeCloseTo(-5);
  });
});

describe("debtToEquity", () => {
  it("computes a normal ratio", () => {
    const s = makeStatement({ fiscalYear: 2024, totalDebt: 500, shareholdersEquity: 800 });
    expect(debtToEquity(s).value).toBeCloseTo(0.625);
  });
  it("flags negative equity as not meaningful", () => {
    const s = makeStatement({ fiscalYear: 2024, totalDebt: 500, shareholdersEquity: -100 });
    const m = debtToEquity(s);
    expect(m.status).toBe("not_meaningful");
    expect(m.value).toBeNull();
  });
  it("flags zero equity as not meaningful", () => {
    const s = makeStatement({ fiscalYear: 2024, totalDebt: 500, shareholdersEquity: 0 });
    expect(debtToEquity(s).status).toBe("not_meaningful");
  });
});

describe("revenueGrowth", () => {
  it("computes YoY growth", () => {
    const prev = makeStatement({ fiscalYear: 2023, revenue: 1000 });
    const cur = makeStatement({ fiscalYear: 2024, revenue: 1200 });
    expect(revenueGrowth(cur, prev).value).toBeCloseTo(20);
  });
  it("is unavailable with no prior year", () => {
    const cur = makeStatement({ fiscalYear: 2024, revenue: 1200 });
    expect(revenueGrowth(cur, null).status).toBe("unavailable");
  });
  it("is not meaningful when prior revenue is zero", () => {
    const prev = makeStatement({ fiscalYear: 2023, revenue: 0 });
    const cur = makeStatement({ fiscalYear: 2024, revenue: 1200 });
    expect(revenueGrowth(cur, prev).status).toBe("not_meaningful");
  });
});

describe("peRatio", () => {
  it("computes from price and EPS", () => {
    const m = peRatio({
      asOfDate: null, sharePrice: 20, sharesOutstanding: null, marketCapitalization: null,
      earningsPerShare: 2, peRatio: null, priceToSalesRatio: null,
    });
    expect(m.value).toBeCloseTo(10);
  });
  it("is not meaningful for negative EPS", () => {
    const m = peRatio({
      asOfDate: null, sharePrice: 20, sharesOutstanding: null, marketCapitalization: null,
      earningsPerShare: -2, peRatio: null, priceToSalesRatio: null,
    });
    expect(m.status).toBe("not_meaningful");
  });
  it("is unavailable with no valuation", () => {
    expect(peRatio(null).status).toBe("unavailable");
  });
});

describe("computeMetrics", () => {
  it("handles a single year of data without crashing", () => {
    const c = makeCompany([makeStatement({ fiscalYear: 2024 })]);
    const r = computeMetrics(c);
    expect(r.latestFiscalYear).toBe(2024);
    expect(r.metrics.revenue_growth.status).toBe("unavailable");
  });
  it("builds trend series across years", () => {
    const c = makeCompany([
      makeStatement({ fiscalYear: 2022, revenue: 800 }),
      makeStatement({ fiscalYear: 2023, revenue: 1000 }),
      makeStatement({ fiscalYear: 2024, revenue: 1200 }),
    ]);
    const r = computeMetrics(c);
    const rev = r.trends.find((t) => t.id === "revenue")!;
    expect(rev.points.map((p) => p.value)).toEqual([800, 1000, 1200]);
  });
});

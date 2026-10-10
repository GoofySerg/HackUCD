import { describe, it, expect } from "vitest";
import { validateCompanyData } from "@/lib/data/validation";
import { makeCompany, makeStatement } from "./fixtures";

const valid = makeCompany([makeStatement({ fiscalYear: 2024 })]);

describe("validateCompanyData", () => {
  it("accepts a valid dataset and uppercases the ticker", () => {
    const r = validateCompanyData({ ...valid, identity: { ...valid.identity, ticker: "tst" } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.identity.ticker).toBe("TST");
  });

  it("rejects a dataset with no statements", () => {
    const r = validateCompanyData({ ...valid, statements: [] });
    expect(r.ok).toBe(false);
  });

  it("rejects duplicate fiscal years with a useful error", () => {
    const r = validateCompanyData({
      ...valid,
      statements: [
        makeStatement({ fiscalYear: 2024, id: "a" }),
        makeStatement({ fiscalYear: 2024, id: "b" }),
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/duplicate fiscalYear/i);
  });

  it("rejects an invalid currency code", () => {
    const r = validateCompanyData({ ...valid, identity: { ...valid.identity, currency: "euro" } });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-ISO fiscalPeriodEnd", () => {
    const r = validateCompanyData({
      ...valid,
      statements: [makeStatement({ fiscalYear: 2024, fiscalPeriodEnd: "31/12/2024" })],
    });
    expect(r.ok).toBe(false);
  });

  it("preserves legitimate zero and negative values", () => {
    const r = validateCompanyData({
      ...valid,
      statements: [makeStatement({ fiscalYear: 2024, netIncome: -500, revenue: 0 })],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.statements[0].netIncome).toBe(-500);
      expect(r.data.statements[0].revenue).toBe(0);
    }
  });

  it("rejects duplicate source ids", () => {
    const r = validateCompanyData({
      ...valid,
      sources: [
        { id: "s", sourceName: "A", sourceURL: null, filingDate: null, retrievedAt: null, dataType: "synthetic" },
        { id: "s", sourceName: "B", sourceURL: null, filingDate: null, retrievedAt: null, dataType: "synthetic" },
      ],
    });
    expect(r.ok).toBe(false);
  });
});

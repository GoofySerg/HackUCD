import type { CompanyData, FinancialStatement } from "@/lib/data/types";

type StatementOverrides = Partial<FinancialStatement> & { fiscalYear: number };

export function makeStatement(o: StatementOverrides): FinancialStatement {
  return {
    id: `T-FY${o.fiscalYear}`,
    fiscalPeriodEnd: `${o.fiscalYear}-12-31`,
    revenue: 1000,
    operatingIncome: 150,
    netIncome: 100,
    totalAssets: 2000,
    totalLiabilities: 1200,
    shareholdersEquity: 800,
    totalDebt: 500,
    cashAndCashEquivalents: 300,
    operatingCashFlow: 200,
    capitalExpenditures: 60,
    freeCashFlow: null,
    ...o,
  };
}

export function makeCompany(statements: FinancialStatement[], extra: Partial<CompanyData> = {}): CompanyData {
  return {
    identity: {
      ticker: "TEST",
      companyName: "Test Co",
      sector: "Technology",
      industry: "Software",
      description: "A synthetic test company.",
      currency: "EUR",
      exchange: "TEST-EX",
    },
    statements,
    valuation: null,
    sources: [
      {
        id: "src-1",
        sourceName: "Synthetic filing",
        sourceURL: null,
        filingDate: null,
        retrievedAt: null,
        dataType: "synthetic",
      },
    ],
    dataType: "synthetic",
    datasetVersion: "test-1",
    ...extra,
  };
}

/**
 * Builds the compact, sanitised "evidence package" handed to the AI agents.
 *
 * Only validated, deterministically-computed data goes in here. Free-text
 * fields from the dataset are sanitised to reduce prompt-injection surface.
 * The package also enumerates the set of VALID metric ids and source ids so
 * citations can be checked deterministically after the AI responds.
 */
import type { CompanyData } from "@/lib/data/types";
import { computeMetrics } from "@/lib/financial/calculations";
import { computeHealthScore } from "@/lib/financial/healthScore";
import { detectRedFlags } from "@/lib/financial/redFlags";
import { sanitizeForPrompt } from "./prompts";

export interface EvidenceMetric {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  status: string;
  note?: string;
}

export interface EvidencePackage {
  identity: {
    ticker: string;
    companyName: string;
    sector: string;
    industry: string;
    description: string;
    currency: string;
    exchange: string;
    dataType: string;
  };
  statements: {
    fiscalYear: number;
    revenue: number | null;
    operatingIncome: number | null;
    netIncome: number | null;
    totalDebt: number | null;
    shareholdersEquity: number | null;
    cashAndCashEquivalents: number | null;
    operatingCashFlow: number | null;
    freeCashFlow: number | null;
  }[];
  metrics: EvidenceMetric[];
  healthScore: {
    status: string;
    overall: number | null;
    components: { id: string; label: string; score: number | null; weight: number }[];
  };
  redFlags: {
    id: string;
    name: string;
    severity: string;
    explanation: string;
    sourcePeriods: number[];
  }[];
  valuationAvailable: boolean;
  sources: { id: string; sourceName: string; filingDate: string | null; dataType: string }[];
  /** Enumerations used for deterministic citation validation. */
  validMetricIds: string[];
  validSourceIds: string[];
}

export function buildEvidencePackage(data: CompanyData): EvidencePackage {
  const computed = computeMetrics(data);
  const health = computeHealthScore(data);
  const redFlags = detectRedFlags(data);

  const metrics: EvidenceMetric[] = Object.values(computed.metrics).map((m) => ({
    id: m.id,
    label: m.label,
    value: m.value,
    unit: m.unit,
    status: m.status,
    ...(m.note ? { note: sanitizeForPrompt(m.note) } : {}),
  }));

  const valuationAvailable =
    computed.metrics.pe_ratio?.status === "available" ||
    computed.metrics.ps_ratio?.status === "available";

  return {
    identity: {
      ticker: data.identity.ticker,
      companyName: sanitizeForPrompt(data.identity.companyName),
      sector: sanitizeForPrompt(data.identity.sector),
      industry: sanitizeForPrompt(data.identity.industry),
      description: sanitizeForPrompt(data.identity.description),
      currency: data.identity.currency,
      exchange: sanitizeForPrompt(data.identity.exchange),
      dataType: data.dataType,
    },
    statements: [...data.statements]
      .sort((a, b) => a.fiscalYear - b.fiscalYear)
      .map((s) => ({
        fiscalYear: s.fiscalYear,
        revenue: s.revenue,
        operatingIncome: s.operatingIncome,
        netIncome: s.netIncome,
        totalDebt: s.totalDebt,
        shareholdersEquity: s.shareholdersEquity,
        cashAndCashEquivalents: s.cashAndCashEquivalents,
        operatingCashFlow: s.operatingCashFlow,
        freeCashFlow: s.freeCashFlow,
      })),
    metrics,
    healthScore: {
      status: health.status,
      overall: health.overall,
      components: health.components.map((c) => ({
        id: c.id,
        label: c.label,
        score: c.score,
        weight: c.weight,
      })),
    },
    redFlags: redFlags.map((f) => ({
      id: f.id,
      name: f.name,
      severity: f.severity,
      explanation: f.explanation,
      sourcePeriods: f.sourcePeriods,
    })),
    valuationAvailable,
    sources: data.sources.map((s) => ({
      id: s.id,
      sourceName: sanitizeForPrompt(s.sourceName),
      filingDate: s.filingDate,
      dataType: s.dataType,
    })),
    validMetricIds: metrics.map((m) => m.id),
    validSourceIds: data.sources.map((s) => s.id),
  };
}

/**
 * Server-side PDF premium report generation using pdfkit.
 *
 * The report uses the SAME validated data and (cached) analysis as the
 * dashboard. It never invents figures: null/unavailable values render as
 * explicit placeholders.
 */
import "server-only";
import PDFDocument from "pdfkit";
import type { CompanyData } from "@/lib/data/types";
import { computeMetrics } from "@/lib/financial/calculations";
import { computeHealthScore } from "@/lib/financial/healthScore";
import { detectRedFlags } from "@/lib/financial/redFlags";
import { formatByUnit, formatDate } from "@/lib/format";
import type { AnalysisResult } from "@/lib/ai/analysisResult";
import { DISCLAIMER_PARAGRAPHS } from "@/lib/disclaimer";

const NAVY = "#0f172a";
const SLATE = "#334155";
const MUTED = "#64748b";
const EMERALD = "#047857";
const RED = "#b91c1c";
const AMBER = "#b45309";

export async function generateReportPdf(
  data: CompanyData,
  analysis: AnalysisResult | null,
): Promise<Buffer> {
  const { metrics } = computeMetrics(data);
  const health = computeHealthScore(data);
  const flags = detectRedFlags(data);
  const currency = data.identity.currency;

  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const heading = (text: string) => {
    doc.moveDown(0.8);
    doc.fillColor(NAVY).fontSize(15).font("Helvetica-Bold").text(text);
    doc.moveDown(0.3);
    doc.fillColor(SLATE).fontSize(10.5).font("Helvetica");
  };
  const body = (text: string) => {
    doc.fillColor(SLATE).fontSize(10.5).font("Helvetica").text(text, { align: "left" });
    doc.moveDown(0.4);
  };
  const bullet = (text: string, color = SLATE) => {
    doc.fillColor(color).fontSize(10.5).font("Helvetica").text(`•  ${text}`, { indent: 6 });
  };

  // --- Title block --------------------------------------------------------
  doc.fillColor(NAVY).fontSize(22).font("Helvetica-Bold").text("StockScope AI");
  doc.fillColor(MUTED).fontSize(10).font("Helvetica").text("Premium Company Research Report");
  doc.moveDown(0.6);
  doc.fillColor(NAVY).fontSize(17).font("Helvetica-Bold")
    .text(`${data.identity.companyName} (${data.identity.ticker})`);
  doc.fillColor(MUTED).fontSize(10).font("Helvetica")
    .text(`${data.identity.sector} · ${data.identity.industry} · ${data.identity.exchange}`);
  if (data.dataType === "synthetic") {
    doc.moveDown(0.3);
    doc.fillColor(AMBER).fontSize(9.5).font("Helvetica-Bold")
      .text("SYNTHETIC / FICTIONAL DATA — for demonstration only. Not real market data.");
  }
  doc.moveDown(0.2);
  const latestYear = metrics.revenue?.sourcePeriods?.[0];
  doc.fillColor(MUTED).fontSize(9).font("Helvetica")
    .text(`Generated ${formatDate(new Date().toISOString())} · Latest reporting year: FY${latestYear ?? "—"}`);

  // --- Executive summary --------------------------------------------------
  heading("Executive Summary");
  if (analysis?.summary.content) {
    body(analysis.summary.content.plainEnglishSummary);
  } else {
    body(
      "No AI research summary is available for this report. The deterministic financial analysis below is still complete.",
    );
  }

  // --- Financial health ---------------------------------------------------
  heading("Financial Health Score");
  if (health.status === "available") {
    doc.fillColor(scoreColor(health.overall!)).fontSize(13).font("Helvetica-Bold")
      .text(`${health.overall} / 100`);
    doc.moveDown(0.2);
    body(health.summary);
    health.components.forEach((c) => {
      bullet(
        `${c.label}: ${c.score == null ? "insufficient data" : Math.round(c.score)}/100 (weight ${(c.weight * 100).toFixed(0)}%)`,
      );
    });
  } else {
    body(health.summary);
  }
  doc.moveDown(0.3);
  doc.fillColor(MUTED).fontSize(8.5).font("Helvetica-Oblique")
    .text("Note: financial health describes the business, not the safety of investing in the stock.");

  // --- Key metrics --------------------------------------------------------
  heading("Key Financial Metrics");
  const keyMetricIds = [
    "revenue",
    "revenue_growth",
    "net_income",
    "net_margin",
    "fcf",
    "total_debt",
    "cash",
    "debt_to_equity",
    "pe_ratio",
  ];
  doc.font("Helvetica").fontSize(10.5);
  keyMetricIds.forEach((id) => {
    const m = metrics[id];
    if (!m) return;
    const val =
      m.status === "available"
        ? formatByUnit(m.value, m.unit, currency)
        : m.status === "not_meaningful"
          ? "not meaningful"
          : "unavailable";
    bullet(`${m.label}: ${val}`);
  });

  // --- Trends -------------------------------------------------------------
  heading("Financial Trends");
  data.statements
    .slice()
    .sort((a, b) => a.fiscalYear - b.fiscalYear)
    .forEach((s) => {
      bullet(
        `FY${s.fiscalYear}: revenue ${fmt(s.revenue, currency)}, net income ${fmt(s.netIncome, currency)}, total debt ${fmt(s.totalDebt, currency)}`,
      );
    });

  // --- Bull / Bear --------------------------------------------------------
  heading(`Bull Case${analysis?.mode === "demo" ? " (demo)" : ""}`);
  renderFindings(analysis?.bull.findings ?? [], EMERALD);

  heading(`Bear Case${analysis?.mode === "demo" ? " (demo)" : ""}`);
  renderFindings(analysis?.bear.findings ?? [], RED);

  // --- Red flags ----------------------------------------------------------
  heading("Key Risks / Red Flags");
  if (flags.length === 0) {
    body("No automated red flags were detected on the available data. This is not a guarantee of safety.");
  } else {
    flags.forEach((f) => {
      const color = f.severity === "high" ? RED : f.severity === "medium" ? AMBER : MUTED;
      bullet(`[${f.severity.toUpperCase()}] ${f.name}: ${f.explanation}`, color);
    });
  }

  // --- Valuation ----------------------------------------------------------
  heading("Valuation Discussion");
  const pe = metrics.pe_ratio;
  const ps = metrics.ps_ratio;
  if (pe?.status === "available" || ps?.status === "available") {
    if (pe?.status === "available") bullet(`P/E: ${formatByUnit(pe.value, "x", currency)}`);
    if (ps?.status === "available") bullet(`P/S: ${formatByUnit(ps.value, "x", currency)}`);
    if (data.valuation?.asOfDate)
      bullet(`Prices as of ${formatDate(data.valuation.asOfDate)} (may be historical).`);
    body("A financially healthy company may still be an expensive investment.");
  } else {
    body("This dataset lacks usable valuation inputs, so StockScope cannot assess whether the shares are expensive or inexpensive.");
  }

  // --- Sources ------------------------------------------------------------
  heading("Verified Sources");
  data.sources.forEach((s) => {
    bullet(
      `[${s.id}] ${s.sourceName}${s.filingDate ? ` — filed ${formatDate(s.filingDate)}` : ""} (${s.dataType})`,
    );
  });

  // --- Limitations & disclaimer ------------------------------------------
  heading("Data Limitations & Disclaimer");
  DISCLAIMER_PARAGRAPHS.forEach((p) => {
    doc.fillColor(MUTED).fontSize(8.5).font("Helvetica").text(p);
    doc.moveDown(0.3);
  });

  doc.end();
  return done;

  function renderFindings(findings: AnalysisResult["bull"]["findings"], color: string) {
    if (findings.length === 0) {
      body("Not available.");
      return;
    }
    findings.forEach((f) => {
      doc.fillColor(color).fontSize(11).font("Helvetica-Bold").text(f.title);
      doc.fillColor(SLATE).fontSize(10).font("Helvetica").text(f.explanation);
      const cites = [
        ...f.verifiedMetricIds.map((m) => `metric:${m}`),
        ...f.verifiedSourceIds.map((s) => `src:${s}`),
      ];
      if (cites.length) {
        doc.fillColor(MUTED).fontSize(8.5).font("Helvetica-Oblique")
          .text(`Evidence: ${cites.join(", ")}`);
      }
      doc.moveDown(0.4);
    });
  }
}

function fmt(v: number | null, currency: string): string {
  return formatByUnit(v, "currency", currency);
}

function scoreColor(score: number): string {
  if (score >= 70) return EMERALD;
  if (score >= 45) return AMBER;
  return RED;
}

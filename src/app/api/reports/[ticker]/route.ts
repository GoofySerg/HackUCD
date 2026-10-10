import { NextResponse } from "next/server";
import { getCompany } from "@/lib/data/companyRepository";
import { requestHasReportAccess } from "@/lib/stripe/access";
import { isStripeConfigured } from "@/lib/stripe/config";
import { generateReportPdf } from "@/lib/reports/pdf";
import { generateAnalysis, getCachedAnalysis } from "@/lib/ai/analysis";

export const maxDuration = 120;

/**
 * GET /api/reports/[ticker]  — download the premium PDF report.
 *
 * PROTECTED: returns 402/403 unless the request's access cookie corresponds to
 * a confirmed Stripe purchase for this ticker. Access cannot be granted by any
 * client-side variable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const data = getCompany(ticker);
  if (!data) {
    return NextResponse.json({ error: "No dataset for that ticker." }, { status: 404 });
  }

  const unlocked = await requestHasReportAccess(ticker);
  if (!unlocked) {
    return NextResponse.json(
      {
        error: "payment_required",
        message: isStripeConfigured()
          ? "This report is locked. Purchase the premium report to unlock the download."
          : "Premium downloads require Stripe to be configured (sandbox).",
      },
      { status: 402 },
    );
  }

  // Use cached analysis if present; otherwise compute (demo) / generate.
  const analysis = getCachedAnalysis(data) ?? (await generateAnalysis(data));

  let pdf: Buffer;
  try {
    pdf = await generateReportPdf(data, analysis);
  } catch (err) {
    return NextResponse.json(
      { error: "pdf_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="StockScope-${ticker}-Report.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

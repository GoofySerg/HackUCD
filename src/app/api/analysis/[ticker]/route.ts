import { NextResponse } from "next/server";
import { getCompany } from "@/lib/data/companyRepository";
import { generateAnalysis } from "@/lib/ai/analysis";

export const maxDuration = 120;

/**
 * POST /api/analysis/[ticker]
 * Runs the full analysis pipeline (or returns a cached/demo result).
 * Body: { force?: boolean } to bypass the cache.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const data = getCompany(ticker);
  if (!data) {
    return NextResponse.json(
      { error: `No dataset found for ticker "${ticker}".` },
      { status: 404 },
    );
  }

  let force = false;
  try {
    const body = (await request.json()) as { force?: boolean };
    force = Boolean(body?.force);
  } catch {
    // no body — fine
  }

  try {
    const result = await generateAnalysis(data, { force });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Analysis failed unexpectedly.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

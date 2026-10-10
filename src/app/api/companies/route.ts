import { NextResponse } from "next/server";
import { listCompanies, listInvalidDatasets } from "@/lib/data/companyRepository";

/** GET /api/companies — list valid companies; ?include=invalid adds diagnostics. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeInvalid = searchParams.get("include") === "invalid";
  const companies = listCompanies();
  return NextResponse.json({
    companies,
    ...(includeInvalid ? { invalid: listInvalidDatasets() } : {}),
  });
}

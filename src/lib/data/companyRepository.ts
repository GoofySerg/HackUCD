/**
 * Company dataset repository.
 *
 * Responsibilities:
 *  - Discover every `*.json` file in `data/companies/` (except README/schema).
 *  - Run the appropriate adapter, then validate with Zod.
 *  - Keep VALID datasets available to the app and EXCLUDE invalid ones,
 *    logging actionable validation errors to the server console.
 *
 * Adding a new company is just dropping a new JSON file into
 * `data/companies/` — no UI or code changes required.
 *
 * This module is server-only (uses `node:fs`). Import it from API routes or
 * server components, never from client components.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { CompanyData, CompanySummary } from "./types";
import { adaptRawDataset } from "./adapters";
import { validateCompanyData } from "./validation";

const COMPANIES_DIR = path.join(process.cwd(), "data", "companies");

/** Files in the companies dir that are not datasets. */
const IGNORED_FILES = new Set(["README.md"]);

interface LoadedRepository {
  companies: Map<string, CompanyData>;
  invalid: { file: string; errors: string[] }[];
}

let cache: LoadedRepository | null = null;

function loadFromDisk(): LoadedRepository {
  const companies = new Map<string, CompanyData>();
  const invalid: { file: string; errors: string[] }[] = [];

  let files: string[] = [];
  try {
    files = fs.readdirSync(COMPANIES_DIR);
  } catch {
    console.warn(
      `[companyRepository] Could not read ${COMPANIES_DIR}. No companies will be available.`,
    );
    return { companies, invalid };
  }

  for (const file of files) {
    if (IGNORED_FILES.has(file)) continue;
    if (!file.toLowerCase().endsWith(".json")) continue;

    const fullPath = path.join(COMPANIES_DIR, file);
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      invalid.push({ file, errors: [`Invalid JSON: ${msg}`] });
      console.error(`[companyRepository] ${file}: invalid JSON — ${msg}`);
      continue;
    }

    const { raw, adapterUsed, warning } = adaptRawDataset(parsed);
    if (warning) console.warn(`[companyRepository] ${file}: ${warning}`);

    const result = validateCompanyData(raw);
    if (!result.ok) {
      invalid.push({ file, errors: result.errors });
      console.error(
        `[companyRepository] ${file}: validation failed (adapter="${adapterUsed}"):\n  - ${result.errors.join(
          "\n  - ",
        )}`,
      );
      continue;
    }

    const data = normalize(result.data);
    const ticker = data.identity.ticker;
    if (companies.has(ticker)) {
      invalid.push({
        file,
        errors: [`Duplicate ticker "${ticker}" — already loaded from another file.`],
      });
      console.error(`[companyRepository] ${file}: duplicate ticker ${ticker}, skipping.`);
      continue;
    }
    companies.set(ticker, data);
  }

  return { companies, invalid };
}

/** Ensure statements are sorted ascending by fiscal year (defensive). */
function normalize(data: CompanyData): CompanyData {
  const statements = [...data.statements].sort((a, b) => a.fiscalYear - b.fiscalYear);
  return { ...data, statements };
}

function getRepo(): LoadedRepository {
  // In development we always reload so dropping in a new JSON is picked up
  // without restarting the dev server. In production we cache once.
  if (process.env.NODE_ENV === "production") {
    if (!cache) cache = loadFromDisk();
    return cache;
  }
  return loadFromDisk();
}

/** All valid companies as lightweight summaries for the selector. */
export function listCompanies(): CompanySummary[] {
  const { companies } = getRepo();
  return [...companies.values()]
    .map(toSummary)
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
}

/** Full validated dataset for a ticker, or null if not found. */
export function getCompany(ticker: string): CompanyData | null {
  const { companies } = getRepo();
  return companies.get(ticker.trim().toUpperCase()) ?? null;
}

/** Files that failed to load, for diagnostics / health endpoints. */
export function listInvalidDatasets(): { file: string; errors: string[] }[] {
  return getRepo().invalid;
}

function toSummary(data: CompanyData): CompanySummary {
  const years = data.statements.map((s) => s.fiscalYear);
  return {
    ticker: data.identity.ticker,
    companyName: data.identity.companyName,
    sector: data.identity.sector,
    industry: data.identity.industry,
    description: data.identity.description,
    currency: data.identity.currency,
    exchange: data.identity.exchange,
    dataType: data.dataType,
    latestFiscalYear: years.length ? Math.max(...years) : 0,
    fiscalYearsCovered: years.length,
  };
}

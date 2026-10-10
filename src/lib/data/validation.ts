/**
 * Zod schemas for runtime validation of raw company datasets.
 *
 * Datasets live in `data/companies/*.json`. They are loaded, parsed, and
 * validated here. Malformed files are rejected with actionable errors and
 * excluded from the company selector (see companyRepository.ts).
 *
 * The CANONICAL shape (what the rest of the app consumes) is produced by the
 * adapter in adapters.ts. This module validates the canonical shape; if your
 * own dataset format differs, map it to this shape in adapters.ts.
 */
import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date (YYYY-MM-DD)");

const nullableFinite = z
  .number()
  .finite("must be a finite number")
  .nullable();

export const dataTypeSchema = z.enum(["real", "synthetic"]);

export const companyIdentitySchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1, "ticker is required")
    .max(12, "ticker is unexpectedly long")
    .transform((t) => t.toUpperCase()),
  companyName: z.string().trim().min(1, "companyName is required"),
  sector: z.string().trim().min(1, "sector is required"),
  industry: z.string().trim().min(1, "industry is required"),
  description: z.string().trim().min(1, "description is required"),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "currency must be a 3-letter ISO 4217 code"),
  exchange: z.string().trim().min(1, "exchange is required"),
});

export const financialStatementSchema = z.object({
  id: z.string().trim().min(1, "statement id is required"),
  fiscalYear: z
    .number()
    .int("fiscalYear must be an integer")
    .gte(1900, "fiscalYear looks invalid")
    .lte(2100, "fiscalYear looks invalid"),
  fiscalPeriodEnd: isoDate,
  revenue: nullableFinite,
  operatingIncome: nullableFinite,
  netIncome: nullableFinite,
  totalAssets: nullableFinite,
  totalLiabilities: nullableFinite,
  shareholdersEquity: nullableFinite,
  totalDebt: nullableFinite,
  cashAndCashEquivalents: nullableFinite,
  operatingCashFlow: nullableFinite,
  capitalExpenditures: nullableFinite,
  freeCashFlow: nullableFinite,
});

export const valuationDataSchema = z.object({
  asOfDate: isoDate.nullable(),
  sharePrice: nullableFinite,
  sharesOutstanding: nullableFinite,
  marketCapitalization: nullableFinite,
  earningsPerShare: nullableFinite,
  peRatio: nullableFinite,
  priceToSalesRatio: nullableFinite,
});

export const sourceReferenceSchema = z.object({
  id: z.string().trim().min(1, "source id is required"),
  sourceName: z.string().trim().min(1, "sourceName is required"),
  sourceURL: z.string().url("sourceURL must be a valid URL").nullable(),
  filingDate: isoDate.nullable(),
  retrievedAt: z.string().datetime({ offset: true }).nullable().or(z.string().datetime().nullable()),
  dataType: dataTypeSchema,
});

export const companyDataSchema = z
  .object({
    identity: companyIdentitySchema,
    statements: z
      .array(financialStatementSchema)
      .min(1, "at least one fiscal-year statement is required"),
    valuation: valuationDataSchema.nullable(),
    sources: z.array(sourceReferenceSchema).min(1, "at least one source is required"),
    dataType: dataTypeSchema,
    datasetVersion: z.string().trim().min(1, "datasetVersion is required"),
  })
  .superRefine((data, ctx) => {
    // Fiscal years must be unique.
    const years = data.statements.map((s) => s.fiscalYear);
    const dupes = years.filter((y, i) => years.indexOf(y) !== i);
    if (dupes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate fiscalYear(s): ${[...new Set(dupes)].join(", ")}`,
        path: ["statements"],
      });
    }
    // Statement ids must be unique.
    const ids = data.statements.map((s) => s.id);
    const dupeIds = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupeIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate statement id(s): ${[...new Set(dupeIds)].join(", ")}`,
        path: ["statements"],
      });
    }
    // Source ids must be unique.
    const srcIds = data.sources.map((s) => s.id);
    const dupeSrc = srcIds.filter((id, i) => srcIds.indexOf(id) !== i);
    if (dupeSrc.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate source id(s): ${[...new Set(dupeSrc)].join(", ")}`,
        path: ["sources"],
      });
    }
  });

export type RawCompanyData = z.input<typeof companyDataSchema>;
export type ValidatedCompanyData = z.output<typeof companyDataSchema>;

export interface ValidationSuccess {
  ok: true;
  data: ValidatedCompanyData;
}
export interface ValidationFailure {
  ok: false;
  /** Flattened, human-readable error messages. */
  errors: string[];
}
export type ValidationResult = ValidationSuccess | ValidationFailure;

/** Validate an unknown object against the canonical company schema. */
export function validateCompanyData(input: unknown): ValidationResult {
  const result = companyDataSchema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return { ok: false, errors };
}

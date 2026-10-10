/**
 * Presentation-only formatting helpers. These never invent data: a `null`
 * value is rendered as an explicit em-dash placeholder, not as 0.
 */
import type { DerivedMetric, MetricUnit } from "@/lib/data/types";

export const NA = "—";

/** Compact currency, e.g. €1.50B, -$120.0M, ¥0. */
export function formatCurrency(value: number | null, currency: string): string {
  if (value == null || !Number.isFinite(value)) return NA;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  let scaled = abs;
  let suffix = "";
  if (abs >= 1e12) {
    scaled = abs / 1e12;
    suffix = "T";
  } else if (abs >= 1e9) {
    scaled = abs / 1e9;
    suffix = "B";
  } else if (abs >= 1e6) {
    scaled = abs / 1e6;
    suffix = "M";
  } else if (abs >= 1e3) {
    scaled = abs / 1e3;
    suffix = "K";
  }
  const symbol = currencySymbol(currency);
  const digits = suffix ? (scaled < 10 ? 2 : scaled < 100 ? 1 : 0) : 0;
  return `${sign}${symbol}${scaled.toLocaleString("en-IE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}${suffix}`;
}

/** Full currency with no scaling, e.g. €1,500,000,000. */
export function formatCurrencyFull(value: number | null, currency: string): string {
  if (value == null || !Number.isFinite(value)) return NA;
  return `${currencySymbol(currency)}${value.toLocaleString("en-IE", {
    maximumFractionDigits: 0,
  })}`;
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return NA;
  return `${value.toFixed(digits)}%`;
}

export function formatRatio(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return NA;
  return value.toFixed(digits);
}

export function formatMultiple(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return NA;
  return `${value.toFixed(digits)}×`;
}

function currencySymbol(currency: string): string {
  switch (currency.toUpperCase()) {
    case "EUR":
      return "€";
    case "USD":
      return "$";
    case "GBP":
      return "£";
    case "JPY":
      return "¥";
    default:
      return `${currency} `;
  }
}

/** Render a derived metric respecting its unit and status. */
export function formatMetric(metric: DerivedMetric, currency: string): string {
  if (metric.status === "unavailable") return NA;
  if (metric.status === "not_meaningful") return "n/m";
  return formatByUnit(metric.value, metric.unit, currency);
}

export function formatByUnit(
  value: number | null,
  unit: MetricUnit,
  currency: string,
): string {
  switch (unit) {
    case "currency":
      return formatCurrency(value, currency);
    case "percent":
      return formatPercent(value);
    case "ratio":
      return formatRatio(value);
    case "x":
      return formatMultiple(value);
    case "count":
      return value == null ? NA : value.toLocaleString("en-IE");
    default:
      return value == null ? NA : String(value);
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return NA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IE", { year: "numeric", month: "short", day: "numeric" });
}

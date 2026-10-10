/**
 * OpenRouter chat-completions client.
 *
 * Server-only. The API key NEVER reaches the browser. All AI calls go through
 * this module so timeouts, error handling, and JSON parsing are consistent.
 *
 * Endpoint: https://openrouter.ai/api/v1/chat/completions
 */
import "server-only";
import { z } from "zod";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 45_000;

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
}

/** Returns config if an API key is present, else null (demo mode). */
export function getOpenRouterConfig(): OpenRouterConfig | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  return { apiKey, model };
}

export function isAiConfigured(): boolean {
  return getOpenRouterConfig() !== null;
}

/** Typed error so callers can show precise, non-fabricated failure states. */
export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "not_configured"
      | "timeout"
      | "rate_limited"
      | "provider_error"
      | "invalid_json"
      | "schema_mismatch"
      | "network",
    readonly status?: number,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface CallOptions {
  system: string;
  user: string;
  /** Low temperature for analytical consistency. */
  temperature?: number;
  timeoutMs?: number;
}

/**
 * Call OpenRouter and return a parsed JSON object validated against `schema`.
 * Requests JSON output via response_format. Throws {@link OpenRouterError}
 * on any failure — callers must NOT fall back to fabricated content.
 */
export async function callStructured<S extends z.ZodTypeAny>(
  schema: S,
  opts: CallOptions,
): Promise<z.output<S>> {
  const config = getOpenRouterConfig();
  if (!config) {
    throw new OpenRouterError("OpenRouter API key is not configured.", "not_configured");
  }

  const messages: ChatMessage[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "HTTP-Referer": process.env.OPENROUTER_APP_URL || "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME || "StockScope AI",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: opts.temperature ?? 0.2,
        response_format: { type: "json_object" },
        messages,
      }),
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new OpenRouterError("OpenRouter request timed out.", "timeout");
    }
    throw new OpenRouterError(
      `Network error contacting OpenRouter: ${err instanceof Error ? err.message : String(err)}`,
      "network",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 429) {
    throw new OpenRouterError("OpenRouter rate limit reached. Try again shortly.", "rate_limited", 429);
  }
  if (!res.ok) {
    const body = await safeText(res);
    throw new OpenRouterError(
      `OpenRouter returned ${res.status}: ${body.slice(0, 300)}`,
      "provider_error",
      res.status,
    );
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new OpenRouterError("OpenRouter response contained no content.", "provider_error");
  }

  let json: unknown;
  try {
    json = JSON.parse(stripCodeFences(content));
  } catch {
    throw new OpenRouterError(
      "OpenRouter did not return valid JSON. The selected model may not support structured output.",
      "invalid_json",
    );
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new OpenRouterError(
      `AI JSON did not match the expected schema: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      "schema_mismatch",
    );
  }
  return parsed.data;
}

function stripCodeFences(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  return trimmed;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}

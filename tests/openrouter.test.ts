import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { callStructured, OpenRouterError, isAiConfigured } from "@/lib/ai/openrouter";

const schema = z.object({ answer: z.string() });

function mockFetchOnce(body: unknown, status = 200) {
  const payload = {
    choices: [{ message: { content: typeof body === "string" ? body : JSON.stringify(body) } }],
  };
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }) as unknown as typeof fetch;
}

describe("openrouter config", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("reports not configured without a key", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(isAiConfigured()).toBe(false);
  });
});

describe("callStructured", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "test/model");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("throws not_configured when key missing", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(callStructured(schema, { system: "s", user: "u" })).rejects.toMatchObject({
      kind: "not_configured",
    });
  });

  it("parses and validates a good JSON response", async () => {
    mockFetchOnce({ answer: "hello" });
    const result = await callStructured(schema, { system: "s", user: "u" });
    expect(result.answer).toBe("hello");
  });

  it("strips code fences before parsing", async () => {
    mockFetchOnce("```json\n{\"answer\":\"fenced\"}\n```");
    const result = await callStructured(schema, { system: "s", user: "u" });
    expect(result.answer).toBe("fenced");
  });

  it("throws invalid_json when content is not JSON", async () => {
    mockFetchOnce("this is not json at all");
    await expect(callStructured(schema, { system: "s", user: "u" })).rejects.toMatchObject({
      kind: "invalid_json",
    });
  });

  it("throws schema_mismatch when JSON shape is wrong", async () => {
    mockFetchOnce({ notAnswer: 123 });
    await expect(callStructured(schema, { system: "s", user: "u" })).rejects.toMatchObject({
      kind: "schema_mismatch",
    });
  });

  it("throws rate_limited on HTTP 429", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "rate limited",
      json: async () => ({}),
    }) as unknown as typeof fetch;
    await expect(callStructured(schema, { system: "s", user: "u" })).rejects.toMatchObject({
      kind: "rate_limited",
    });
  });

  it("throws provider_error on other non-OK status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "server error",
      json: async () => ({}),
    }) as unknown as typeof fetch;
    const err = await callStructured(schema, { system: "s", user: "u" }).catch((e) => e);
    expect(err).toBeInstanceOf(OpenRouterError);
    expect((err as OpenRouterError).kind).toBe("provider_error");
  });
});

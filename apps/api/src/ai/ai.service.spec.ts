import { Test } from "@nestjs/testing";
import { AppConfigService } from "../config/app-config.service";
import { ANTHROPIC_CLIENT } from "./ai.client";
import { AiOutputError, AiService } from "./ai.service";

describe("AiService", () => {
  let aiService: AiService;
  const parse = jest.fn();

  const extraction = {
    companyName: "Acme Inc",
    position: "Backend Engineer",
    techStack: ["TypeScript", "PostgreSQL"],
    location: "Remote (EU)",
    url: null,
  };

  const fakeResponse = (overrides: Record<string, unknown> = {}) => ({
    model: "claude-opus-5-5",
    stop_reason: "end_turn",
    usage: { input_tokens: 812, output_tokens: 64 },
    parsed_output: extraction,
    ...overrides,
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ANTHROPIC_CLIENT, useValue: { beta: { messages: { parse } } } },
        { provide: AppConfigService, useValue: { anthropicModel: "claude-opus-5-5" } },
      ],
    }).compile();
    aiService = module.get(AiService);
  });

  afterEach(() => jest.clearAllMocks());

  it("returns the validated extraction with model and token usage", async () => {
    parse.mockResolvedValue(fakeResponse());

    const result = await aiService.extractJobPosting("We are hiring a backend engineer...");

    expect(result).toEqual({ data: extraction, model: "claude-opus-5-5", inputTokens: 812, outputTokens: 64 });
  });

  it("sends the configured model and wraps the posting as untrusted data", async () => {
    parse.mockResolvedValue(fakeResponse());

    await aiService.extractJobPosting("posting body");

    const params = parse.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.messages[0].content).toBe("<job_posting>\nposting body\n</job_posting>");
  });

  it("reports the fallback model when a different model answered", async () => {
    parse.mockResolvedValue(fakeResponse({ model: "claude-opus-5" }));

    const result = await aiService.extractJobPosting("posting");

    expect(result.model).toBe("claude-opus-5");
  });

  it("throws when parsed_output is null so the job retries", async () => {
    parse.mockResolvedValue(fakeResponse({ parsed_output: null }));

    await expect(aiService.extractJobPosting("posting")).rejects.toThrow(AiOutputError);
  });

  it("throws on a refusal", async () => {
    parse.mockResolvedValue(fakeResponse({ stop_reason: "refusal" }));

    await expect(aiService.extractJobPosting("posting")).rejects.toThrow(AiOutputError);
  });

  it("throws when the output was cut off at max_tokens", async () => {
    parse.mockResolvedValue(fakeResponse({ stop_reason: "max_tokens" }));

    await expect(aiService.extractJobPosting("posting")).rejects.toThrow(AiOutputError);
  });

  it("throws when the output does not match the schema", async () => {
    parse.mockResolvedValue(fakeResponse({ parsed_output: { companyName: "Acme" } }));

    await expect(aiService.extractJobPosting("posting")).rejects.toThrow(AiOutputError);
  });

  it("lets SDK errors propagate so BullMQ can retry", async () => {
    parse.mockRejectedValue(new Error("overloaded"));

    await expect(aiService.extractJobPosting("posting")).rejects.toThrow("overloaded");
  });
});

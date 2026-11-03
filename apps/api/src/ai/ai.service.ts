import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { JobPostingExtractionSchema, type JobPostingExtraction } from "@job-tracker/types";
import { AppConfigService } from "../config/app-config.service";
import { ANTHROPIC_CLIENT } from "./ai.client";
import {
  EXTRACT_JOB_POSTING_SYSTEM_PROMPT,
  buildExtractJobPostingUserMessage,
} from "./prompts/extract-job-posting";

export interface AiCallResult<T> {
  data: T;
  /** The model that actually answered. Can differ from the requested one when a fallback ran. */
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Thrown when Claude's answer can't be used. Deliberately a plain Error, not
 * an HTTP exception: this only ever runs inside a queue job, where throwing
 * is what tells BullMQ to retry.
 */
export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiOutputError";
  }
}

/** The only place in the app that calls the Claude API (CLAUDE.md: AI integration). */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(ANTHROPIC_CLIENT) private readonly client: Anthropic,
    private readonly config: AppConfigService,
  ) {}

  async extractJobPosting(postingText: string): Promise<AiCallResult<JobPostingExtraction>> {
    const response = await this.client.beta.messages.parse({
      model: this.config.anthropicModel,
      max_tokens: 4096,
      // Simple extraction: low effort keeps cost and latency down.
      output_config: { format: betaZodOutputFormat(JobPostingExtractionSchema), effort: "low" },
      // If the primary model declines, the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: EXTRACT_JOB_POSTING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildExtractJobPostingUserMessage(postingText) }],
    });

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    this.logger.log(
      `extractJobPosting model=${response.model} input_tokens=${inputTokens} output_tokens=${outputTokens} stop_reason=${response.stop_reason}`,
    );

    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      throw new AiOutputError(`Unusable response (stop_reason=${response.stop_reason})`);
    }

    // parse() already validated against the schema, but a null result or a
    // schema drift between SDK and app must never reach the user.
    const parsed = JobPostingExtractionSchema.safeParse(response.parsed_output);
    if (!parsed.success) {
      throw new AiOutputError("Model output did not match JobPostingExtractionSchema");
    }

    return { data: parsed.data, model: response.model, inputTokens, outputTokens };
  }
}

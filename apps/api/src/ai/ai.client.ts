import Anthropic from "@anthropic-ai/sdk";
import type { Provider } from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service";

/** Injection token, so tests can swap in a fake client without touching the network. */
export const ANTHROPIC_CLIENT = Symbol("ANTHROPIC_CLIENT");

export const anthropicClientProvider: Provider = {
  provide: ANTHROPIC_CLIENT,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) => new Anthropic({ apiKey: config.anthropicApiKey }),
};

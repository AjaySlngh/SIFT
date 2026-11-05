import Anthropic from "@anthropic-ai/sdk";

export type Stage = "split" | "read" | "classify" | "extract" | "score" | "route" | "act";

export interface LlmCallerIdentity {
  /** users.id of the agent account making this call */
  userId: string;
  model: string;
}

export interface LlmCallOptions {
  stage: Stage;
  caller: LlmCallerIdentity;
  caseId?: string;
  system?: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  toolChoice?: Anthropic.MessageCreateParams["tool_choice"];
  maxTokens?: number;
}

export interface LlmCallResult {
  message: Anthropic.Message;
  usage: {
    inputTokens: number;
    cachedTokens: number;
    outputTokens: number;
  };
}

// Per-model USD rate table, $ per 1M tokens. Keep this in config, tune as pricing changes.
const RATE_TABLE: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
};

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = RATE_TABLE[model];
  if (!rate) return 0;
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * The single entry point for every model call in sift. No stage should import
 * the Anthropic SDK directly. This is where retries, the agent's user id, and
 * the token ledger write all live.
 *
 * TODO: wire up retries with backoff, and the token_ledger insert via @sift/db
 * once a case/document context is threaded through.
 */
export async function callModel(opts: LlmCallOptions): Promise<LlmCallResult> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: opts.caller.model,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: opts.messages,
    tools: opts.tools,
    tool_choice: opts.toolChoice,
  });

  const usage = {
    inputTokens: message.usage.input_tokens,
    // TODO: switch to the prompt-caching beta Usage type to get real cache_read_input_tokens.
    cachedTokens: 0,
    outputTokens: message.usage.output_tokens,
  };

  // TODO: persist to token_ledger (case_id, stage, model, usage, estimateCostUsd(...))
  void estimateCostUsd;

  return { message, usage };
}

export function modelForStage(stage: Stage): string {
  switch (stage) {
    case "split":
    case "classify":
      return process.env.SIFT_MODEL_SPLIT ?? "claude-haiku-4-5";
    case "extract":
      return process.env.SIFT_MODEL_EXTRACT ?? "claude-sonnet-4-5";
    default:
      return process.env.SIFT_MODEL_SPLIT ?? "claude-haiku-4-5";
  }
}

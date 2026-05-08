// OpenAI provider — STUB. Same envelope shape as ollama/groq so flipping
// it on later is a single-file change. When enabled, this should POST to
// /v1/chat/completions with response_format = { type: "json_schema",
// json_schema: { strict: true, schema: ... } } using the node's schema.

import { FAILURE_REASONS } from "../cos-config.mjs";

export async function chat({ model } = {}) {
  return {
    ok: false,
    error: "openai provider not enabled in this build",
    retryable: false,
    provider: "openai",
    model: model ?? null,
    reason: FAILURE_REASONS.PROVIDER_DISABLED,
  };
}

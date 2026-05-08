// Anthropic provider — STUB. Same envelope shape as ollama/groq so flipping
// it on later is a single-file change. When enabled, this should call
// /v1/messages with a prefilled "{" assistant turn to coax JSON out, OR
// (preferred path) the Anthropic JSON tool-use mode.

import { FAILURE_REASONS } from "../cos-config.mjs";

export async function chat({ model } = {}) {
  return {
    ok: false,
    error: "anthropic provider not enabled in this build",
    retryable: false,
    provider: "anthropic",
    model: model ?? null,
    reason: FAILURE_REASONS.PROVIDER_DISABLED,
  };
}

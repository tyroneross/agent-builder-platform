// Provider shim — uniform `chat()` dispatcher across local + cloud providers.
//
// All provider modules export `chat()` returning the same envelope:
//   success: { ok: true,  text, parsed, raw, tokens_in, tokens_out, provider, model }
//   error:   { ok: false, error, retryable, provider, model, reason }
//
// Callers pass `{ provider, model, system, messages, timeoutMs, onChunk, ... }`.
// Provider-specific options (apiKey, baseUrl, stallMs) flow through unchanged.

import * as ollama from "./ollama.mjs";
import * as groq from "./groq.mjs";
import * as anthropic from "./anthropic.mjs";
import * as openai from "./openai.mjs";

const PROVIDERS = {
  ollama,
  groq,
  anthropic,
  openai,
};

export const PROVIDER_NAMES = Object.freeze(Object.keys(PROVIDERS));

// Test seam: tests can install a fake `chat` implementation via setChatImpl().
// Production callers use `chat()` directly; it forwards to whatever impl is
// installed (default: `defaultChat`). Cleared between tests via setChatImpl(null).
let _impl = null;

export function setChatImpl(fn) {
  _impl = fn;
}

export async function chat(opts = {}) {
  if (_impl) return _impl(opts);
  return defaultChat(opts);
}

async function defaultChat(opts) {
  const { provider } = opts;
  if (!provider) {
    return {
      ok: false,
      error: "providers.chat: missing 'provider'",
      retryable: false,
      provider: null,
      model: opts.model ?? null,
      reason: "unknown",
    };
  }
  const mod = PROVIDERS[provider];
  if (!mod) {
    return {
      ok: false,
      error: `providers.chat: unknown provider "${provider}"`,
      retryable: false,
      provider,
      model: opts.model ?? null,
      reason: "provider-disabled",
    };
  }
  return mod.chat(opts);
}

// Re-export ollama helpers for back-compat with existing UI code.
export const ollamaTags = ollama.tags;
export const ollamaPs = ollama.ps;

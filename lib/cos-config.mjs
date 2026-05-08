// Per-node tier routing + cascade policy resolver for the Chief of Staff runner.
//
// Tiers (from agent-skills/chief-of-staff/*.skill.md):
//   parse     - small/fast structural extraction
//   mid       - 8B-class chat with reasonable instruction following
//   synthesis - the strongest local model that fits the task
//
// Routing default per node is a 3-tuple (local primary, local fallback, cloud)
// drawn from the user-locked table in the build packet. Local primary is the
// HEAD of the cascade; local fallback is consulted before cloud; cloud is
// only consulted if `allowCloud` permits it.

export const TIERS = Object.freeze({
  parse: "parse",
  mid: "mid",
  synthesis: "synthesis",
});

export const NODE_ROUTING = Object.freeze({
  intake: {
    tier: TIERS.parse,
    localPrimary: { provider: "ollama", model: "qwen3:8b-q4_K_M" },
    localFallback: { provider: "ollama", model: "llama3.2:3b" },
    cloud: { provider: "groq", model: "llama-3.1-8b-instant" },
  },
  triage: {
    tier: TIERS.synthesis,
    localPrimary: { provider: "ollama", model: "gemma4:26b" },
    localFallback: { provider: "ollama", model: "qwen3:8b-q4_K_M" },
    cloud: { provider: "groq", model: "llama-3.3-70b-versatile" },
  },
  time_block_plan: {
    tier: TIERS.synthesis,
    localPrimary: { provider: "ollama", model: "gemma4:26b" },
    localFallback: { provider: "ollama", model: "qwen3:8b-q4_K_M" },
    cloud: { provider: "groq", model: "llama-3.3-70b-versatile" },
  },
  decision_log: {
    tier: TIERS.mid,
    localPrimary: { provider: "ollama", model: "qwen3:8b-q4_K_M" },
    localFallback: { provider: "ollama", model: "llama3.2:3b" },
    cloud: { provider: "groq", model: "llama-3.1-8b-instant" },
  },
  follow_up_plan: {
    tier: TIERS.mid,
    localPrimary: { provider: "ollama", model: "qwen3:8b-q4_K_M" },
    localFallback: { provider: "ollama", model: "llama3.2:3b" },
    cloud: { provider: "groq", model: "llama-3.1-8b-instant" },
  },
  operating_risks: {
    tier: TIERS.synthesis,
    localPrimary: { provider: "ollama", model: "gemma4:26b" },
    localFallback: { provider: "ollama", model: "qwen3:8b-q4_K_M" },
    cloud: { provider: "groq", model: "llama-3.3-70b-versatile" },
  },
});

const VALID_ALLOW_CLOUD = new Set(["never", "on-failure", "always"]);

/**
 * Resolve the user-facing cascade policy from CLI/env/defaults.
 * Precedence: explicit `opts` > env > default.
 *
 * @param {object} [opts]
 * @param {string} [opts.allowCloud] one of "never" | "on-failure" | "always"
 * @param {number} [opts.maxCloudTokens]
 * @returns {{allowCloud: string, maxCloudTokens: number}}
 */
export function cascadePolicy(opts = {}) {
  const envAllow = process.env.COS_ALLOW_CLOUD;
  const allowRaw = opts.allowCloud ?? envAllow ?? "on-failure";
  const allowCloud = VALID_ALLOW_CLOUD.has(allowRaw) ? allowRaw : "on-failure";

  let maxCloudTokens;
  if (typeof opts.maxCloudTokens === "number") {
    maxCloudTokens = opts.maxCloudTokens;
  } else if (process.env.COS_MAX_CLOUD_TOKENS != null) {
    const n = Number(process.env.COS_MAX_CLOUD_TOKENS);
    maxCloudTokens = Number.isFinite(n) ? n : NaN;
  } else {
    maxCloudTokens = allowCloud === "never" ? 0 : 200000;
  }
  if (!Number.isFinite(maxCloudTokens)) maxCloudTokens = 200000;
  if (allowCloud === "never") maxCloudTokens = 0;

  return { allowCloud, maxCloudTokens };
}

/**
 * Build the ordered cascade for a single node, given the resolved policy.
 * Returns an array of `{provider, model, lane}` steps to try in order.
 *
 *   allowCloud=never       -> [primary, fallback]
 *   allowCloud=on-failure  -> [primary, fallback, cloud]
 *   allowCloud=always      -> [cloud, primary, fallback]
 *
 * `userOverride` lets the runner force a single-step cascade (e.g. when the
 * caller passed `--model llama3.2:3b`); when set, all routing is collapsed to
 * that single step on the local lane.
 */
export function resolveCascade(nodeKey, policy, userOverride = null) {
  if (userOverride) {
    return [
      {
        provider: userOverride.provider ?? "ollama",
        model: userOverride.model,
        lane: "user-override",
      },
    ];
  }
  const route = NODE_ROUTING[nodeKey];
  if (!route) {
    throw new Error(`cos-config: unknown node "${nodeKey}"`);
  }
  const local = [
    { ...route.localPrimary, lane: "local-primary" },
    { ...route.localFallback, lane: "local-fallback" },
  ];
  const cloud = { ...route.cloud, lane: "cloud" };
  if (policy.allowCloud === "always") return [cloud, ...local];
  if (policy.allowCloud === "on-failure") return [...local, cloud];
  return local; // never
}

/** Reasons a step is considered a failure that should advance the cascade. */
export const FAILURE_REASONS = Object.freeze({
  HTTP: "http-error",
  TIMEOUT: "timeout",
  STALL: "stream-stall",
  PARSE: "parse-failed",
  PROVIDER_DISABLED: "provider-disabled",
  MISSING_KEY: "missing-api-key",
  UNKNOWN: "unknown",
});

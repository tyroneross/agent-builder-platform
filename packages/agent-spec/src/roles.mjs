// Unified agent-graph role vocabulary — the single enum both the builder
// (which used node.kind) and the studio (which used node.role) consume.
//
// Before extraction the two surfaces diverged:
//   - studio role:  agent, tool, subagent, guardrail, orchestrator, executor, eval, memory
//   - builder kind: agent, approval, verifier, eval, executor, guardrail, orchestrator,
//                   memory, state
// Studio's spec-export already mapped `kind: n.role` 1:1, so the field NAME was
// the real divergence; the value sets differ only at the edges. This module is
// the reconciliation: one canonical superset + an alias map so a graph designed
// in the builder runs unmodified in the studio and vice-versa.
//
// Vocabulary SHAPE reference (no code imported): loop-builder presets model an
// adjacent focused-loop abstraction as validators[{id, pass_condition, method}]
// + gates. The eval-contract fields below mirror that shape so generated-agent
// eval contracts read consistently with loop-builder loops. See
// loop-builder/skills/loop-builder/presets/*.yaml.

export const ROLES = Object.freeze([
  "agent", // a reasoning/acting node
  "tool", // a deterministic tool invocation node
  "subagent", // a nested agent with its own scoped context
  "guardrail", // umbrella: input/output safety + approval + verification
  "approval", // human-in-the-loop gate before a side effect
  "verifier", // checks an output against a contract before accepting it
  "orchestrator", // routes work between nodes
  "executor", // carries out a settled plan / applies a rule
  "eval", // scores an output against acceptance criteria
  "memory", // reads/writes durable or session memory
  "state", // explicit state node (e.g. langgraph state)
]);

const ROLE_SET = new Set(ROLES);

// Alias map: legacy or umbrella values → canonical role on READ. The builder's
// `approval`/`verifier` are specializations of the studio's `guardrail`; both
// are kept as first-class canonical roles, but a node tagged only `guardrail`
// is accepted as-is, and unknown legacy values fall through to `agent`.
export const ROLE_ALIASES = Object.freeze({
  // studio umbrella ↔ builder specializations (documented, both valid)
  guard: "guardrail",
  gate: "approval",
  check: "verifier",
  verify: "verifier",
  evaluator: "eval",
  eval_gate: "eval",
  router: "orchestrator",
  worker: "executor",
});

/**
 * Normalize a raw role/kind value to a canonical role.
 * Accepts either the studio `role` or the builder `kind` value.
 * Unknown values resolve to "agent" (the safe default the studio already used).
 */
export function canonicalRole(value) {
  if (typeof value !== "string" || !value.trim()) return "agent";
  const v = value.trim().toLowerCase();
  if (ROLE_SET.has(v)) return v;
  if (ROLE_ALIASES[v]) return ROLE_ALIASES[v];
  return "agent";
}

/** True when `value` resolves to a known canonical role (incl. via alias). */
export function isKnownRole(value) {
  if (typeof value !== "string") return false;
  const v = value.trim().toLowerCase();
  return ROLE_SET.has(v) || Boolean(ROLE_ALIASES[v]);
}

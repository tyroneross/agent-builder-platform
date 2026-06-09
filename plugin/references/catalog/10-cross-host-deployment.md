# Cross-Host Deployment For Agent Systems

> Deployment reference - load when an agent must run with API keys, inside Claude, inside Codex, or across multiple AI-agent hosts.
> Parent skill: `agent-builder` - pairs with `08-repo-skill-architecture.md`.

---

## Core Claim

The same agent system can have multiple delivery surfaces, but each surface needs its own contract. Do not treat "API app", "Claude skill/plugin", "Codex plugin", and "other agent host" as interchangeable.

Design the core harness once, then add host adapters.

---

## Deployment Modes

### 1. API-key runtime

Use when the system runs as an app, service, job, CLI, or worker.

Minimum build pack:

- Provider adapter for model calls.
- `.env.example` with key names only.
- Credential preflight that reports missing names without printing values.
- Tool registry with permission tiers.
- State store or checkpoint path.
- Memory adapter.
- Eval runner.
- Observability/cost logs.
- Integration smoke that uses a fixture or cheap model path.

API-key runtime should be the default when a product must run outside a coding-agent host.

### 2. Claude-native package

Use when the agent should operate inside Claude Code or a Claude-oriented plugin/skill host.

Minimum build pack:

- `CLAUDE.md` for repo-local instructions when needed.
- `.claude-plugin/plugin.json` when packaging as a plugin.
- `skills/<skill-id>/SKILL.md` or root `SKILL.md`.
- Optional `commands/` for user-invoked workflows.
- Optional `agents/` for reusable role definitions.
- References/scripts/assets organized for progressive disclosure.

Claude-native packages should keep host-specific instructions separate from runtime code. The skill should explain what to read and when, not preload every reference.

### 3. Codex-native package

Use when the agent should operate inside Codex as a plugin or skill.

Minimum build pack:

- `AGENTS.md` for repo-local instructions.
- `.codex-plugin/plugin.json` with `skills` pointing at the skill root.
- `SKILL.md` or `skills/<skill-id>/SKILL.md` with precise frontmatter.
- Optional `agents/openai.yaml` UI metadata when the package exposes skill-list chips.
- References/scripts/assets organized for progressive disclosure.

Codex-native packages should validate frontmatter, manifest paths, and required files. The plugin root should be copyable without app-only directories unless the package intentionally ships a full app.

### 4. Host-agnostic agent package

Use when the same workflow should work in Claude, Codex, Cursor, Gemini CLI, or another agent host.

Minimum build pack:

- `AGENTS.md` as the repo-neutral instruction layer.
- Host adapters for each supported host.
- JSON/YAML contracts for inputs, outputs, tools, state, and handoffs.
- MCP tools or CLI commands for shared deterministic capabilities.
- No host-only assumptions in core workflow docs.

Use this when distribution and reuse matter more than one-host ergonomics.

### 5. Hybrid product + host companion

Use when the product runs through API keys but developers/operators also need Claude/Codex skills to inspect, operate, or extend it.

Minimum build pack:

- API runtime under `src/`.
- Shared contracts under `contracts/`.
- Host companion under `plugin/`.
- Companion skill that reads shared contracts and points to product commands.
- Separate validation for runtime tests and plugin packaging.

---

## Cross-Agent Collaboration

When Claude, Codex, and other agents work together, define coordination explicitly.

Minimum collaboration contract:

- Stable agent or squad identity.
- One coordinator or lead when work spans shared files.
- File/path ownership claims.
- Handoff envelope with target, task, inputs, expected output, validation, and due/stop condition.
- Artifact receipt with evidence.
- ACK state: sent, received, accepted, rejected, blocked, complete.
- Readback path that proves a message or artifact landed.
- Rule for stale sessions and abandoned claims.

If the repo has a coordination substrate such as Rally, use it. If not, represent the same facts in committed coordination files and require readback before acting on a handoff.

---

## Host Adapter Matrix

| Surface | Primary files | Best for | Avoid for |
|---|---|---|---|
| API runtime | `src/`, `.env.example`, `contracts/`, `evals/` | Product execution, scheduled jobs, user-facing apps | One-off repo-local help |
| Claude native | `CLAUDE.md`, `.claude-plugin/`, `skills/`, `commands/`, `agents/` | Claude Code workflows and Claude plugin distribution | Host-agnostic runtime guarantees by itself |
| Codex native | `AGENTS.md`, `.codex-plugin/`, `SKILL.md`, `agents/openai.yaml` | Codex plugin/skill routing and repo-grounded work | Product runtime by itself |
| MCP | MCP server/tool package | Shared tools across hosts | Agent policy, memory, evals by itself |
| CLI | `bin/`, `scripts/`, documented commands | Deterministic shared operations | Non-deterministic planning by itself |
| Coordination substrate | `.rally/`, coordination docs, handoff envelopes | Multi-agent ownership and receipts | Replacing human/product decisions |

---

## End-To-End Build Sequence

Use this sequence when Agent Builder must produce a complete agent or agent system.

1. **Define job and deployment mode.** API, Claude, Codex, host-agnostic, or hybrid.
2. **Design the core harness.** Agent manifest, state owner, tools, memory, evals, observability.
3. **Choose repo shape.** API-first, host-native, or hybrid.
4. **Create skill bank.** Reuse existing skills, define missing skills, decide chaining.
5. **Write contracts.** Role cards, tool contracts, skill contracts, handoff envelopes, eval scorecards.
6. **Implement runtime/adapters.** Provider adapter, tools, workflow state, host manifests.
7. **Add validation.** Unit, integration, eval, readback, permission, and packaging tests.
8. **Run smoke.** Prove the core path with a fixture, dry run, or low-cost model call.
9. **Package.** Keep app runtime and plugin companion boundaries clean.
10. **Document operations.** Env keys, install path, run commands, failures, rollback, handoff.

---

## API Key Rules

- Store key names in `.env.example`, never values.
- Fail soft on missing optional keys; fail loud on keys required for the selected deployment.
- Keep provider-specific clients behind an adapter.
- Log model, route, token/cost estimates, latency, and tool call count.
- Make offline/fixture mode available for tests.
- Do not require API keys to validate skill packaging or repo structure.

---

## Design Output Requirements

When the user asks to build an agent "end to end", the Agent Builder output must specify:

- Deployment mode and why.
- Repo layout.
- Runtime entrypoint.
- Host entrypoint for Claude/Codex if applicable.
- Skill bank entries.
- Skill chain or router.
- Tool registry and permissions.
- Memory substrate and promotion path.
- Eval suite and metric validity.
- API-key/env contract.
- Install/package path.
- Smoke test and acceptance criteria.

---

*Catalog file 10/10 - cross-host deployment synthesis - June 2026*

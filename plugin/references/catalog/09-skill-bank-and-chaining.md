# Skill Bank And Skill Chaining

> Skill-system reference - load when Agent Builder must choose, compose, create, or modify reusable skills.
> Parent skill: `agent-builder` - pairs with `08-repo-skill-architecture.md`.

---

## Core Claim

Skills are reusable operating procedures. A good skill bank lets an agent system reuse known workflows without hardcoding every workflow into the main orchestrator.

The skill bank should answer four questions:

1. What reusable skills exist?
2. When should each skill trigger?
3. Which skills can be chained safely?
4. Which skills should be copied, wrapped, modified, or kept external?

---

## Skill Bank Structure

Represent every bank entry as a skill card.

```yaml
skill_id: "debug-loop"
purpose: "Root-cause debugging with hypothesis tests and regression proof."
category: "debugging"
host_support: ["codex", "claude", "api-wrapper"]
trigger_signals:
  phrases: ["debug", "root cause", "fix this bug"]
  paths: ["tests/**", "src/**"]
inputs:
  required: ["symptom", "repo path"]
  optional: ["failing command", "logs", "screenshot"]
outputs:
  primary: "root-cause finding plus verified fix or blocker"
  artifacts: ["incident note", "test evidence"]
dependencies:
  can_chain_after: ["research", "logging-tracer"]
  can_chain_before: ["knowledge", "handoff"]
  avoid_with: []
validation:
  checks: ["reproduce failure", "verify fix", "non-regression test"]
modification_policy: "wrap | extend | fork | external"
```

Minimum categories:

| Category | Purpose | Typical examples |
|---|---|---|
| Intake and planning | Turn user intent into scoped work | research, spec-writing, plan-verify |
| Prompt and agent contracts | Write prompts, role cards, output schemas | prompt-builder, agent-builder |
| Build and implementation | Execute code changes | build-loop, framework-specific builders |
| Debugging and RCA | Diagnose failures before patching | debug-loop, debugging-memory |
| Evaluation and QA | Score outputs and verify behavior | eval harness, persona-lab, visual validation |
| Memory and knowledge | Save durable decisions and lessons | knowledge, memory-writer |
| Observability and tracing | Add logs, metrics, traces, cost tracking | logging-tracer, telemetry |
| Security and permissions | Threat model and permission boundaries | security-methodology, threat-modeler |
| Coordination | Cross-agent claims, handoffs, receipts | agent-rally-point, handoff |
| Packaging and release | Build plugin/package/deployment surfaces | plugin-builder, mcp-builder, publish skills |

---

## Skill Chaining Patterns

### 1. Sequential chain

Use when each step depends on the previous output.

```text
research -> spec-writing -> build-loop -> eval -> knowledge
```

Good for: new features, migrations, agent-system builds.

Risk: each step can inherit bad assumptions. Add a plan-verify or evaluation gate before implementation.

### 2. Router chain

Use when one intake step selects the right specialist.

```text
intake -> {debug-loop | ui-design | security-methodology | plugin-builder}
```

Good for: broad assistants, support agents, mixed task queues.

Risk: routing errors. Log the routing reason and allow fallback/escalation.

### 3. Parallel specialist chain

Use when independent lenses can inspect the same artifact without sharing assumptions.

```text
architecture-review + security-review + UX-review -> synthesis
```

Good for: audits and review panels.

Risk: duplicated work and conflicting findings. Require a synthesis step with evidence ranking.

### 4. Generator-critic chain

Use when output quality is subjective or high-stakes.

```text
generator -> critic/evaluator -> revision -> acceptance gate
```

Good for: prompts, product specs, UX copy, analysis reports.

Risk: critic overfitting. Use explicit scorecards and holdout examples.

### 5. Runtime repair chain

Use when a running agent fails and needs recovery.

```text
logging-tracer -> debug-loop -> fix -> replay regression -> knowledge
```

Good for: production or local runtime incidents.

Risk: retry loops. Stop after repeated same-cause failure and escalate with evidence.

---

## When To Chain Skills

Chain skills when:

- The task crosses distinct domains.
- The output of one skill is the input contract for another.
- Independent review materially reduces risk.
- The same sequence has repeated enough times to justify reuse.
- The chain has a clear termination condition.

Do not chain skills when:

- One skill can complete the job cleanly.
- The chain exists only to create more agent activity.
- The handoff format is undefined.
- The target model is small/local and context budget is tight.
- The system lacks receipt/readback evidence for cross-agent handoffs.

---

## Skill Composition Rules

- Every chained skill must declare input and output artifacts.
- The orchestrator owns ordering; specialist skills own domain procedure.
- A downstream skill must not infer missing upstream outputs silently.
- Use a handoff envelope for cross-agent or cross-host transfers.
- Use deterministic scripts for fragile transformation steps.
- Promote repeated chains into a named workflow only after the chain has proven useful.

---

## Plug-And-Play Skill Bank Seed

Use this seed list as a starting library. Names are capability slots, not a requirement that every target repo already has the exact skill installed.

| Slot | Reuse first when | Build/modify when |
|---|---|---|
| `research` | Need repo-grounded pre-decision analysis | Domain has special sources or scoring |
| `spec-writing` | Need buildable requirements | Product has unique compliance or artifact schemas |
| `prompt-builder` | Need production prompt contracts | Prompt must support a new deployment type |
| `agent-builder` | Need harness architecture | The target needs a custom runtime/package output |
| `build-loop` | Need multi-step implementation | Repo needs a lighter or specialized loop |
| `debug-loop` | Need RCA and non-regression | Failure domain has special tools |
| `persona-lab` | Need persona/product review | Personas must be industry-specific |
| `logging-tracer` | Need observability | Runtime has custom tracing infra |
| `security-methodology` | Need permission or threat analysis | Domain has special control frameworks |
| `mcp-builder` | Need MCP server/tool packaging | Tool protocol differs from MCP |
| `plugin-builder` | Need host plugin packaging | Host manifest or install path is custom |
| `knowledge` | Need durable memory writeback | Memory store schema is custom |
| `handoff` | Need durable transfer between agents | Handoff envelope needs domain fields |
| `agent-rally-point` | Need multi-agent coordination | Another coordination substrate is required |

---

## Modify, Wrap, Fork, Or Externalize

| Choice | Use when | Avoid when |
|---|---|---|
| Modify | Existing skill owns the trigger and output | Change would make the skill too broad |
| Wrap | You need pre/post checks around a stable skill | Wrapper hides important failure modes |
| Fork | Domain behavior conflicts with the original skill | Only one or two lines differ |
| Externalize | Skill belongs to another plugin/repo | Runtime needs offline/self-contained behavior |

Default to modifying or wrapping before creating a new parallel skill.

---

*Catalog file 09/10 - skill bank and chaining synthesis - June 2026*

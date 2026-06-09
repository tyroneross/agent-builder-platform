# Local Operational Patterns For Agent Harnesses

> Local scan reference - load when a harness uses durable memory, repo-scoped coordination, daemon/client state, receipts, or eval/metric gates.
> Parent skill: `agent-builder` - sibling: `02-harness-components.md`

---

## Core Claim

Agent harnesses fail when operational truth is implicit. The recurring local pattern across Build Loop, build-loop-memory, Agent Rally Point, Easy Terminal, Atomize AI, and debugger/eval tooling is: make state ownership, promotion, receipts, freshness, and validation mechanical.

Use this file as an overlay on the six-component harness model. It does not replace `02-harness-components.md`; it turns the abstract components into contracts a maintainer can test.

---

## Scan Basis

Fast local scan of sibling development repos, emphasizing authored docs/source/tests over generated artifacts and lockfiles. Highest-signal repos for this reference:

- `build-loop` - workflow phases, autonomy gate, memory bootstrap, Rally presence, validation/readback discipline.
- `build-loop-memory` - project memory lanes, raw/source provenance, adaptive candidates, generated indexes, strict validators.
- `agent-rally-point` - claims, handoffs, artifacts, receipts, canonical paths, room readback, board projection.
- `easy-terminal` + `ptyd` - daemon-owned terminal truth, push streams, bounded subscribers, real socket/PTY tests.
- `atomize-ai` - search-quality evals, proxy-vs-measured labels, deterministic fallbacks, human-validity gates.
- `claude-code-debugger`, `local-smartz`, `agent-astronomer` - focused RCA, retrieval, and context-capacity patterns.

---

## Patterns To Reuse

### 1. Memory needs a promotion boundary

Do not let every observation become long-term memory. Durable memory should have lanes such as decisions, lessons, architecture, debugging, product, and design. Raw source mirrors and adaptive candidates are staging inputs, not canonical memory.

Minimum contract:

- `candidate/raw -> reviewed durable lane` promotion path
- explicit rejection/archive path
- validation command that fails on missing scaffold, malformed metadata, or broken indexes
- generated indexes treated as rebuildable outputs, not the source of truth

### 2. Memory writes need a canonical writer

Direct file writes are easy to create and hard to audit. Build Loop's memory pattern is stronger: use a writer that stamps source repo, workdir, run id, host, creation time, update time, cross-repo validation, and applied-in-repos metadata.

Minimum contract:

- one write API or script for durable memory
- atomic writes and append-only index updates
- provenance frontmatter on every durable entry
- mark-applied flow when a lesson is reused in another repo

### 3. Freshness is a first-class state

Durable memory and hot context have different jobs. Keep stable orientation separate from generated current context, freshness files, context snapshots, and queue state. A harness should surface stale context as a warning before planning from it.

Minimum contract:

- stable context file for orientation
- generated current context with timestamp/freshness metadata
- stale-context check against git history or source revision
- clear rule for when to refresh, rebuild, or ignore stale memory

### 4. Coordination needs facts plus receipts

Narrative boards are useful projections, but they should not be the only state. Multi-agent coordination needs machine-readable claims, handoffs, artifacts, decisions, resolves, and receipts. A write that exits 0 is not enough; the harness must prove the fact can be read back from the intended room/store.

Minimum contract:

- stable agent/squad identity
- canonical path claims
- read-before-write conflict check
- artifact/handoff receipt with target, evidence, and ACK state
- read-after-write regression test

### 5. One owner controls mutable runtime truth

Daemon/client systems drift when UI state, CLI state, and daemon state all act authoritative. Easy Terminal's strongest pattern is daemon-owned session truth: clients observe and mutate through explicit daemon verbs; app state is a projection or grouping layer.

Minimum contract:

- named owner for each mutable state domain
- client/UI state declared as projection or cache
- daemon/API verbs for mutations
- compatibility/health surface for the owner
- recovery path for stale socket, orphaned process, or mismatched version

### 6. Push state where possible and bound every consumer

Polling hides latency and scale failures. Prefer event streams or subscriptions when the runtime already owns state changes. Any stream, socket, or subscriber path needs bounded queues, replay caps, drop/disconnect policy, and burst coalescing tests.

Minimum contract:

- subscription or revision stream for frequently changing state
- polling only as fallback
- bounded queue/backlog policy
- replay cap
- slow-consumer test

### 7. Proxy evals must be labeled as proxy evals

Automated LLM judges are useful, but they are not ground truth by default. Atomize AI's eval harness pattern labels every golden-set row as proxy or measured, provides deterministic offline fallbacks, reports measured-vs-proxy counts, and requires human-rating correlation before a metric is treated as validated.

Minimum contract:

- `proxy: true|false` on eval cases
- loader enforcement that measured rows have expected labels
- deterministic fallback for offline/CI runs
- stderr/report breakdown of proxy vs measured rows
- human-validity gate before optimization trusts a scorer

### 8. Trust gates should exercise the real transport

Unit tests over models and parsers are necessary but incomplete. For agentic systems, the highest-value regressions often cover real sockets, real PTYs, replay, crash recovery, permission denials, and round-trip persistence.

Minimum contract:

- fast deterministic unit tests for schemas and validators
- integration smoke over the actual transport boundary
- replay/regression case for every prior dropped-write or stale-read class
- safety guard for live/prod sockets or irreversible side effects

---

## Evaluation Checklist

When evaluating an existing harness, check these before recommending new frameworks or agents:

| Contract | Pass signal | Failure smell |
|---|---|---|
| State owner | Every mutable domain names one owner | UI, CLI, and daemon all rewrite truth |
| Readback | Mutations are verified by read-after-write tests | Command exits 0 but state disappears |
| Receipts | Handoffs/artifacts have target, evidence, ACK state | Agent says "done" with no receipt |
| Memory promotion | Raw/candidate/durable lanes are separate | Every note goes straight to long-term memory |
| Provenance | Durable memory records source repo/run/host | Lesson cannot be traced to evidence |
| Freshness | Context has timestamp/revision/staleness checks | Old handoffs silently drive plans |
| Backpressure | Streams define queue, replay, and slow-consumer policy | One slow client can block the runtime |
| Eval honesty | Proxy and measured cases are separated | LLM judge score treated as user truth |
| Transport tests | Real boundary smoke exists | Only mocks prove the control path |

---

## Design Implication

For a new harness, add these fields to the design even if the implementation is small:

- **State owner:** which subsystem owns each mutable fact.
- **Mutation evidence:** what proves a write landed and survived readback.
- **Memory promotion rule:** what is canonical, what is staging, what is rejected.
- **Freshness rule:** how stale context is detected and surfaced.
- **Receipt model:** how handoffs, side effects, and artifacts are acknowledged.
- **Eval validity:** which metrics are measured, proxy, unvalidated, or validated.
- **Real-boundary smoke:** the cheapest test that crosses the actual tool/runtime boundary.

If any of those fields are blank, the harness may still be usable, but it is not operations-ready.

---

*Catalog file 07/10 · local operational scan synthesis · June 2026*

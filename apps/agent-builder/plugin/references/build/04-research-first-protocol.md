# Research-First Protocol

> Build reference — load at the Build Mode research gate (B1) before authoring any skill/plugin that touches an unfamiliar domain, library, API, CLI, or file format.
> Parent skill: `agent-builder`. Pairs with `references/build/01-build-skill-or-plugin.md`.
> **Host-agent-is-the-LLM:** this protocol is INSTRUCTIONS for the host agent's own model to follow. It does NOT call any vendor API directly. Claude Code runs Claude, Codex runs GPT — each host's model does the research using its own web/doc tools.

---

## Why This Gate Exists

A skill that hardcodes a wrong method signature, deprecated flag, stale config key, or fabricated pricing is worse than no skill — it confidently misleads every future run. Training data lags reality. So before authoring anything that depends on an external library/API/CLI/format, the host agent researches the current state and cites it. Never author API/config/signatures from memory.

---

## Fire The Gate When ANY Holds

- The target skill/plugin wraps or instructs a **library, SDK, API, CLI, or file format** the agent cannot author from memory with high confidence.
- The methodology depends on **current-state facts** that evolve: versions, deprecations, pricing, model IDs, rate limits, config schema, CLI flags.
- You would **hedge** in the authored content ("as of", "typically", "I think").
- The domain is **unfamiliar** to the agent.

Skip the gate (and record `research: not required — familiar domain`) only when the skill is pure methodology/glue over things the agent already knows cold. Bias toward firing: a wasted search is cheaper than a confidently wrong skill.

---

## Action Ladder (host agent runs these with its OWN tools)

Run in order; stop when you have an authoritative answer.

1. **Library / SDK / API / CLI docs → Context7 (or the host's doc-cache equivalent) first.**
   - Resolve the library id, then query its docs: `resolve-library-id <name>` → `query-docs <id> <question>`.
   - This is the fastest path to current library/API syntax, config keys, and signatures.
2. **WebSearch for current-state / best-practices** when no doc source is registered, or for non-library facts (spec shape, ecosystem conventions, "is X still maintained", current best practice).
   - WebSearch FIRST. Use WebFetch only on a URL the user provided or a link returned by Search/Context7 — do not guess URLs.
3. **No authoritative source found** → mark the claim `TAG:UNVERIFIED` and state exactly what would confirm it. Do not silently fall back to memory.
4. **Tool failure / network error** → say so explicitly. Never paper over it with a memory-sourced guess.

---

## Source Tiers & Confidence Markers

Mark every external factual claim the authored skill carries:

| Tier | Sources | Use |
|---|---|---|
| T1 | Official docs, standards bodies, research labs, peer-reviewed | Cite directly |
| T2 | Well-cited papers, recognized experts, official engineering blogs | Cite with context |
| T3 | Reputable industry blogs, conference talks | Cross-reference T1/T2 |
| T4 | Forums, StackOverflow, personal blogs, SEO content | Leads only — verify up before citing |

Confidence on each claim:
- ✅ **verified** — cite the T1/T2 source.
- ⚠️ **secondary only** — `[INFERRED]`, T3/T4 source named.
- ❓ **unverified** — `[UNVERIFIED]`, state what would confirm.

Two-source minimum for statistics, competitive claims, and disputed facts.

---

## What The Gate Produces

A short **evidence note** that downstream authoring (B4) cites inline:

```
Research evidence — <skill-id>
- Claim: <fact the skill depends on>  | Source: <url / Context7 lib id> | Tier: T1 | Confidence: ✅
- Claim: <...>                        | Source: <...>                  | Tier: T3 | Confidence: ⚠️ [INFERRED]
- Unresolved: <fact>                  | Would confirm: <what>          | Confidence: ❓ [UNVERIFIED]
Summary: <one line on whether the skill can be authored safely now>
```

The authored `SKILL.md`/`AGENTS.md` then carries the verified facts with their markers — so the skill itself stays honest about what is sourced vs assumed.

---

## Encoding This Into A Built Skill

When the skill being built will ITSELF need to research at runtime (e.g. a skill that wraps a fast-moving API), embed this same protocol as a step in that skill's workflow — as instructions for whatever host runs it, not as a hardcoded vendor call. The built skill says "research current X via the host's doc/web tools before acting", mirroring this file. That keeps the host-agent-is-the-LLM contract intact across hosts.

---

*Build reference 04/04 — research-first protocol — June 2026*

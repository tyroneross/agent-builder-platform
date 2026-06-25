# Build A Skill Or Plugin — Workflow

> Build reference — load when Agent Builder must PRODUCE a runnable skill or plugin as the deliverable (not just design or evaluate one).
> Parent skill: `agent-builder`. Inherits from `references/catalog/08-repo-skill-architecture.md` (repo/skill anatomy), `references/catalog/10-cross-host-deployment.md` (host adapters), and `references/templates/agentic-handoff/skill-contract.md` (the skill contract). This file adds the *production* workflow on top of those; it does not restate them.

---

## When This Mode Fires

Use Build Mode when the user asks to **build / create / scaffold / generate / ship** a skill or plugin — i.e. the output is a working `SKILL.md` (+ optional plugin scaffolding) the host can load, not a design memo. Design Mode plans it; Build Mode emits it.

Negative trigger: if the user only wants architecture, comparison, or a gap audit, stay in `design` / `evaluation` / `catalog-lookup`. Do not scaffold files for those.

---

## Non-Negotiable Properties Of Every Build

Every skill/plugin this mode produces MUST satisfy all four:

1. **Research-first when the domain is unfamiliar.** If the target touches a library, API, CLI, file format, or domain you cannot author from memory with confidence, run the research protocol BEFORE authoring. See `references/build/04-research-first-protocol.md`. Cite sources; mark confidence; never invent signatures, flags, config keys, or pricing.
2. **Dual-format output from one source.** Ship BOTH a Claude-native surface (`SKILL.md` + frontmatter, plus `.claude-plugin/plugin.json` and `commands/`/`agents/`/`hooks/` when it is a plugin) AND a host-neutral `AGENTS.md` carrying the same methodology. The two must stay in parity. See `references/build/02-dual-format-parity.md`.
3. **Scripts in the right language; skills call scripts, they do not prose-reimplement logic.** Fragile, repetitive, or determinism-critical work goes into a script in the language that fits (Python default, Rust perf/CLI, R stats, shell orchestration). The skill routes and judges; the script computes. Honor minimal-deps and build-from-scratch bias. See `references/build/03-polyglot-script-guide.md`.
4. **Modular and inherit-first.** Folder per capability. Reuse this plugin's existing catalog/templates rather than duplicating. New skills extend existing ones when the job shares a trigger/output/validation loop; create a parallel skill only on a genuinely distinct one (`08-repo-skill-architecture.md` § Skill Modification Workflow).

---

## Build Workflow

### B0 — Frame The Deliverable

State, in one or two lines each:

- **Job:** the one repeated outcome the skill/plugin owns (outcome-focused, one sentence).
- **Surface:** single skill, or a plugin (skill + commands/agents/hooks). Default to a single skill; promote to a plugin only when the job genuinely needs slash commands, subagents, or hooks.
- **Hosts:** Claude, Codex, host-agnostic, or all. Default to dual-format (Claude + AGENTS.md) unless the user pins one host.
- **Spec profile:** `skill` is the default for a reusable skill/plugin (see SKILL.md § Spec Profile Matrix). Promote only on shared runtime, side effects, or regulated data.
- **Freedom level** (drives script decisions): high (guidance), medium (templates/pseudocode), low (deterministic script). From `08-repo-skill-architecture.md` § Skill Capture step 4.

### B1 — Research Gate

Run `references/build/04-research-first-protocol.md`. Output: a short evidence note (sources + confidence) that downstream authoring cites. If the domain is fully familiar (no external API/CLI/format), record `research: not required — familiar domain` and move on. Do not skip silently.

### B2 — Decide Script Surface

For each fragile/repetitive/deterministic step, pick a language with `references/build/03-polyglot-script-guide.md`. Most skills need zero or one script. Decide BEFORE authoring `SKILL.md` so the skill's "Validation" and routing reference the real script paths. If no step is deterministic enough, ship a script-free skill — do not invent one to look complete.

### B3 — Scaffold The Surface

Use the scaffolder for the file skeleton, then fill it:

```bash
# Python default glue; uv-run, no install needed.
uv run python3 references/scripts/scaffold_skill.py \
  --name "<skill-id>" \
  --description "<third-person description with literal trigger phrases>" \
  --dest "<output-dir>" \
  --kind skill            # or: plugin
  # optional: --script-lang python|rust|r|shell  --allowed-tools "Read,Grep,Bash"
```

The scaffolder emits, from one source of truth, BOTH the Claude surface and `AGENTS.md`, plus a `PARITY.md` checklist instance. See `references/scripts/scaffold_skill.py` and its self-test. If the scaffolder is unavailable in the host, copy `references/templates/build/` by hand and fill the placeholders — the templates are the source of truth, the script only mechanizes the copy.

### B4 — Author The Content

- `SKILL.md`: lean. Frontmatter `name` + `description` (description in third person, literal trigger phrases, under 1,536 chars). Body in imperative form: trigger conditions, the shortest workflow, "read when" links to references, and at least one validation command. Detailed variants go to `references/`. (`08-repo-skill-architecture.md` § Skill Anatomy.)
- `AGENTS.md`: plain Markdown, no frontmatter. Carry the SAME methodology (overview → setup → workflow → validation). This is the host-neutral surface Codex/Cursor/Gemini-CLI/Copilot read.
- For a plugin: fill `.claude-plugin/plugin.json` (`name` required; add `version`/`description`/`author`), and add `commands/`, `agents/`, `hooks/` only as the job needs. Use `${CLAUDE_PLUGIN_ROOT}` for any in-package path inside hooks/commands — never hardcode absolute or `~` paths.

### B5 — Parity Check

Run the dual-format parity checklist (`references/build/02-dual-format-parity.md`). Every methodology rule present in the Claude surface must be present in `AGENTS.md` and vice versa. The scaffolder emits a `PARITY.md` instance to fill; for a hand build, copy `references/templates/build/parity-checklist.md`.

### B6 — Validate

- Frontmatter + path existence: every "read when" reference path resolves; `description` under the cap; manifest `name` kebab-case.
- Script (if any): runs on a fixture and exits cleanly; ships with at least one deterministic test in the same language.
- One realistic use-case dry run: confirm the trigger fires and the workflow produces the named output artifact.
- Dual-format: parity checklist passes.

Record what was checked with a status marker (✅ verified / ⚠️ untested / ❓ uncertain). A build that omits validation is not build-ready (`08-repo-skill-architecture.md` § Design Checklist).

---

## Output Contract (Build Mode)

When Build Mode completes, return:

- The job + surface + hosts + spec profile chosen, and why.
- The research evidence note (sources + confidence) or `not required — familiar domain`.
- The scaffolded file tree (paths), naming the Claude surface AND the `AGENTS.md` surface.
- The script(s) added: language + purpose + test status, or `none — no deterministic step`.
- The filled parity checklist result.
- The validation performed, with status markers.
- Anything unverified or assumed.

---

## Inherit-First Reminders

- Reuse `references/templates/agentic-handoff/skill-contract.md` for the skill contract — do not write a new contract schema.
- Reuse `08-repo-skill-architecture.md` skill anatomy/capture/modification — this file is the production overlay, not a replacement.
- Reuse `10-cross-host-deployment.md` host adapter matrix to decide which surfaces ship.
- A new reference doc is justified only when no existing catalog entry owns the content. Prefer extending over adding.

---

*Build reference 01/04 — build skill-or-plugin workflow — June 2026*

# Dual-Format Output: Claude-Native + AGENTS.md

> Build reference — load when producing a skill/plugin that must run BOTH in Claude Code AND in AGENTS.md-aware hosts (Codex, Cursor, Gemini CLI, Copilot, others).
> Parent skill: `agent-builder`. Pairs with `references/build/01-build-skill-or-plugin.md` and `references/catalog/10-cross-host-deployment.md` (host adapter matrix).

---

## Core Claim

One methodology, two surfaces. Author the methodology once and project it onto two file shapes:

- **Claude-native surface** — `SKILL.md` (YAML frontmatter `name` + `description`), and when it is a plugin: `.claude-plugin/plugin.json` plus `commands/`, `agents/`, `hooks/` as needed.
- **Host-neutral surface** — `AGENTS.md`, plain Markdown, no frontmatter, carrying the same methodology so any AGENTS.md-aware tool uses it without Claude-specific wiring.

The risk is drift: a rule lands in one surface and not the other. The parity checklist below is the contract that prevents it.

---

## What Each Surface Is For (confirmed against current specs, June 2026)

### Claude `SKILL.md` — ✅ official Claude Code docs + `plugin-dev:skill-development`
- Required-by-convention frontmatter: `name` + `description`. `description` is the one recommended field; it is third-person, carries literal trigger phrases, and stays under **1,536 chars** (the combined listing budget). Other fields (`allowed-tools`, `when_to_use`, `effort`, `context: fork`, `disable-model-invocation`, `disallowed-tools`) are optional.
- Body in imperative form, lean, progressive-disclosure: route to `references/` with "read when" conditions rather than inlining everything.
- A skill bundles optional `references/`, `scripts/`, `assets/`, `examples/`.

### Claude `.claude-plugin/plugin.json` — ✅ official Plugins reference + `plugin-dev:plugin-structure`
- Manifest lives in `.claude-plugin/`. Component dirs (`commands/`, `agents/`, `skills/`, `hooks/`) live at the plugin ROOT, not inside `.claude-plugin/`.
- Only **`name`** (kebab-case) is strictly required. Add `version` (semver — without it the commit SHA becomes the version), `description`, `author`, `homepage`, `repository`, `license`, `keywords`.
- Use `${CLAUDE_PLUGIN_ROOT}` for in-package paths in hooks/commands/MCP — never hardcode absolute or `~` paths.

### `AGENTS.md` — ✅ official agents.md spec
- **Just standard Markdown. No required headings, no frontmatter.** Agents parse the prose you provide.
- Location: repo root is primary. In a monorepo, a nested `AGENTS.md` overrides the root one (nearest-wins) — place one per package only where the package genuinely differs.
- Recommended (not required) sections: project overview & setup, build/test commands, code style, testing procedures, security considerations, PR/commit guidelines.
- Read by 30+ tools / 60,000+ projects as of mid-2026 (Codex, Copilot coding agent, Cursor, Zed, Warp, Jules, Aider, goose, and more; Claude Code also reads it, with CLAUDE.md as its richer native format).

---

## The One-Source Discipline

Keep the methodology in ONE authored block and project it. In practice:

1. Write the workflow once (the steps, the rules, the validation).
2. `SKILL.md` body = that workflow in imperative form + frontmatter + Claude "read when" links.
3. `AGENTS.md` = that same workflow as plain prose sections, with the Claude-only mechanics (frontmatter, `${CLAUDE_PLUGIN_ROOT}`, slash-command wiring) translated to host-neutral equivalents or omitted with a one-line note.
4. Shared deep content lives in `references/` and is pointed to from BOTH surfaces, so it is authored exactly once.

The scaffolder (`references/scripts/scaffold_skill.py`) mechanizes this: it takes the name/description/methodology stub and emits both surfaces plus a `PARITY.md` instance from the same inputs, so they cannot diverge at creation time. Drift can still be introduced by later hand-edits — that is what the checklist catches on every change.

---

## Parity Checklist

Run on creation AND on every later edit to either surface. Copy `references/templates/build/parity-checklist.md` into the built package as `PARITY.md` (the scaffolder does this for you).

| # | Parity rule | Claude surface | AGENTS.md surface |
|---|---|---|---|
| 1 | **Identity** | `SKILL.md` frontmatter `name` + plugin.json `name` | H1 title names the same capability |
| 2 | **Purpose / trigger** | `description` carries trigger phrases | "Overview" / "When to use" prose states the same triggers |
| 3 | **Workflow steps** | imperative steps in body | same steps as prose sections, same order |
| 4 | **References** | "read when" links to `references/*` | same `references/*` pointed to (shared, authored once) |
| 5 | **Scripts** | script paths in body + Validation | same script paths + how to run them host-neutrally |
| 6 | **Validation / acceptance** | at least one check named | same check named |
| 7 | **Permissions / tools** | `allowed-tools` (if set) | prose note of required host capabilities |
| 8 | **Setup / build / test** | (skill: in body) | explicit Setup/Build/Test sections (AGENTS.md convention) |
| 9 | **No Claude-only leakage** | Claude mechanics allowed here | `${CLAUDE_PLUGIN_ROOT}`, frontmatter, slash-command syntax translated or footnoted, not left raw |
| 10 | **Version / changelog** | plugin.json `version` bumped | a one-line "last updated / version" note if the package tracks one |

Pass criterion: every methodology rule in one surface has a matching rule in the other. A rule that legitimately exists only on one side (e.g. a Claude hook with no AGENTS.md analogue) must carry a one-line note saying so — silent asymmetry is the defect.

---

## Common Drift Failures

- A new workflow step added to `SKILL.md` but not `AGENTS.md` (rule 3). Most common.
- `${CLAUDE_PLUGIN_ROOT}` or `/command` syntax left raw in `AGENTS.md` (rule 9) — meaningless to a non-Claude host.
- A reference file renamed in one surface's links but not the other (rule 4).
- `description` edited past the 1,536-char cap while adding triggers (rule 2).
- plugin.json `version` bumped but the AGENTS.md "updated" note not touched (rule 10).

---

*Build reference 02/04 — dual-format parity — June 2026*

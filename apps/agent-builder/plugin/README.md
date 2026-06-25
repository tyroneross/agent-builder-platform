# Agent Builder Plugin Companion

This directory is the standalone plugin companion for the Agent Builder app.

Use the full app/workbench when you need the Next.js visual builder, reusable generated structures, investment dashboard, package export, install checks, sandbox runs, or DOE tooling. Use this plugin companion when you only need Agent Builder's design/evaluation method inside Claude, Codex, or another reusable-skill host.

## Package Boundary

`plugin/` is copyable as a unit. It must remain independent of app-root files.

Included:

- `SKILL.md` — canonical cross-LLM skill entrypoint.
- `.claude-plugin/plugin.json` — Claude Code plugin manifest.
- `.codex-plugin/plugin.json` — Codex plugin manifest.
- `metadata.json` — host-neutral companion metadata.
- `examples/` — worked design/evaluation examples.
- `references/` — catalog, methodology, and output templates, including repo structure, skill capture/modification, skill-bank/chaining, cross-host deployment, and agentic handoff contracts.
- `references/build/` — Build Mode: the production workflow for scaffolding a runnable skill/plugin, the dual-format (Claude `SKILL.md` + host-neutral `AGENTS.md`) parity contract, the polyglot script decision guide, and the research-first protocol.
- `references/templates/build/` + `references/scripts/scaffold_skill.py` — source-of-truth dual-format templates and the stdlib scaffolder that emits both surfaces plus a parity checklist and an optional tested helper script (Python/Rust/R/shell).

Not included:

- Next.js app files under `app/`.
- Generator/runtime code under `lib/`.
- Sandbox, DOE, scans, and artifact scripts.
- Generated agents, generated outputs, local telemetry, or `.env` files.
- Node dependencies or build artifacts.

## Install

As a standalone user skill:

```bash
mkdir -p ~/.claude/skills/agent-builder
rsync -a SKILL.md references examples ~/.claude/skills/agent-builder/
```

As a host plugin, point the host at this `plugin/` directory. The Claude and Codex manifests both load the same `SKILL.md`, so the companion has one canonical instruction source.

Inside another plugin, copy this directory into that plugin's `skills/agent-builder/` folder.

## Maintenance Contract

- Keep this package small and text-first.
- Do not import app-root files from `SKILL.md` or references.
- Keep Claude and Codex manifests version-aligned.
- Update this README when the companion gains a new required file or host surface.
- Keep `metadata.json` and `.github/workflows/verify-install.yml` aligned with required reference/template paths before release.
- Use the app repository for heavy workflows: visual builder, generated packages, tests, local model experiments, and dashboards.

## Changelog

### 0.4.0 — Build Mode (additive)

Adds a first-class capability to **build** runnable skills and plugins as deliverables, alongside the existing design/evaluation harness workflow (which is unchanged):

- **Build Mode** (`references/build/01-build-skill-or-plugin.md`): a B0–B6 production workflow with four non-negotiables — research-first, dual-format output, scripts-in-the-right-language, and modular inherit-first reuse. Wired into `SKILL.md` Step 1 as the `build` mode plus a `build` Output Contract.
- **Dual-format output** (`references/build/02-dual-format-parity.md`): every built skill/plugin ships BOTH a Claude-native `SKILL.md` (+ `.claude-plugin/plugin.json` for plugins) AND a host-neutral `AGENTS.md` from one source, with a 10-rule parity checklist that prevents drift.
- **Polyglot scripting** (`references/build/03-polyglot-script-guide.md`): a decision guide for Python (default, `uv`), Rust (perf/CLI), R (stats), and shell (orchestration), with minimal-deps rules and the skill↔script contract.
- **Research-first protocol** (`references/build/04-research-first-protocol.md`): research current docs/best-practices before authoring anything touching an unfamiliar library/API/CLI/format; host-agent-is-the-LLM (no hardcoded vendor calls).
- **Scaffolder** (`references/scripts/scaffold_skill.py`): stdlib-only Python tool that emits both surfaces + `PARITY.md` + an optional tested helper script in any of the four languages. Self-test: `uv run python3 references/scripts/scaffold_skill.py --selftest`.
- Templates conform to the current AGENTS.md spec (plain Markdown, no frontmatter) and current Claude plugin/skill structure (`.claude-plugin/plugin.json`, `SKILL.md` frontmatter `name` + `description` under 1,536 chars), confirmed against official docs June 2026.

# Build Templates

> Source-of-truth templates for Build Mode (`references/build/01-build-skill-or-plugin.md`).
> The scaffolder (`references/scripts/scaffold_skill.py`) fills these placeholders; you can also copy them by hand. The script only mechanizes the copy — these files are the truth.

## Files

| Template | Emits | Notes |
|---|---|---|
| `SKILL.md.template` | Claude-native `SKILL.md` | Frontmatter `name` + `description` (third person, literal triggers, < 1,536 chars). `allowed-tools` line optional. Lean body + progressive disclosure. |
| `AGENTS.md.template` | Host-neutral `AGENTS.md` | Plain Markdown, NO frontmatter (agents.md spec). Same methodology as `SKILL.md`. Repo root primary; nested overrides root in monorepos. |
| `plugin.json.template` | `.claude-plugin/plugin.json` | Only `name` is strictly required; `version`/`description`/`author` recommended. Component dirs (`commands/`, `agents/`, `skills/`, `hooks/`) live at plugin ROOT, not in `.claude-plugin/`. |
| `parity-checklist.md` | `PARITY.md` in the built package | The 10-rule contract that keeps the two surfaces in sync. Run on every edit. |

## Placeholder Reference

Placeholders use `{{NAME}}`. The scaffolder substitutes them; for a hand build, replace every `{{...}}`.

Core: `{{SKILL_ID}}`, `{{SKILL_TITLE}}`, `{{DESCRIPTION}}`, `{{PURPOSE_ONE_LINE}}`, `{{TRIGGER_SUMMARY}}`, `{{TRIGGER_PHRASES}}`, `{{NEGATIVE_TRIGGER}}`, `{{STEP_1..3}}`, `{{OUTPUT_ARTIFACT}}`, `{{VALIDATION_CHECK_1}}`, `{{REFERENCE_1}}`, `{{READ_WHEN_1}}`.

Plugin: `{{PLUGIN_NAME}}`, `{{AUTHOR_NAME}}`, `{{HOMEPAGE}}`, `{{REPOSITORY}}`, `{{LICENSE}}`, `{{KEYWORDS}}`.

Script (filled only when `--script-lang` is set): `{{SCRIPT_BODY_BLOCK}}`, `{{SCRIPT_AGENTS_BLOCK}}`, `{{SCRIPT_VALIDATION_LINE}}`, `{{SCRIPT_VALIDATION_LINE_NEUTRAL}}`.

Optional: `{{ALLOWED_TOOLS_LINE}}`, `{{SETUP_NOTES}}`, `{{HOST_CAPABILITIES}}`, `{{CLAUDE_ONLY_NOTES}}`, `{{OTHER_SKILL_OR_NONE}}`.

## Conventions (confirmed June 2026 against current specs)

- `SKILL.md` — ✅ official Claude Code skills docs + `plugin-dev:skill-development`.
- `.claude-plugin/plugin.json` — ✅ official Plugins reference + `plugin-dev:plugin-structure`.
- `AGENTS.md` — ✅ official agents.md spec (plain Markdown, no frontmatter, nearest-wins).

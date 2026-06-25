# Parity Checklist — {{SKILL_TITLE}}

> Copy of this file ships in the built package as `PARITY.md`. Run on creation AND on every edit to either surface.
> Rationale and surface specs: `references/build/02-dual-format-parity.md`.

Pass criterion: every methodology rule present in one surface has a matching rule in the other. A rule that legitimately exists on only one side must carry a one-line note saying so. Silent asymmetry is the defect.

| # | Parity rule | Claude (`SKILL.md` / `plugin.json`) | `AGENTS.md` | OK? |
|---|---|---|---|-----|
| 1 | Identity — same capability name | frontmatter `name` (+ plugin.json `name`) | H1 title | [ ] |
| 2 | Purpose / trigger — same triggers | `description` trigger phrases | "When To Use" prose | [ ] |
| 3 | Workflow steps — same steps, same order | imperative body steps | prose workflow steps | [ ] |
| 4 | References — same `references/*`, authored once | "read when" links | same links | [ ] |
| 5 | Scripts — same paths + invocation | body + Validation | "Scripts" section | [ ] |
| 6 | Validation / acceptance — same check | Validation section | "Validation / Test" | [ ] |
| 7 | Permissions / tools | `allowed-tools` (if set) | "Required Host Capabilities" | [ ] |
| 8 | Setup / build / test present | (in body) | explicit Setup section | [ ] |
| 9 | No Claude-only leakage | Claude mechanics allowed | `${CLAUDE_PLUGIN_ROOT}` / `/cmd` translated or footnoted | [ ] |
| 10 | Version / changelog in sync | plugin.json `version` | "updated / version" note | [ ] |

## Asymmetry register

List any rule that intentionally exists on only one surface, with the reason:

- (e.g.) `hooks/` PreToolUse guard — Claude-only; no AGENTS.md analogue. Documented in AGENTS.md § Notes On Claude-Only Mechanics.

## Result

- Checked by: <who/what>
- Date: <date>
- Status: ✅ parity / ⚠️ asymmetry registered / ❌ drift found (fix before ship)

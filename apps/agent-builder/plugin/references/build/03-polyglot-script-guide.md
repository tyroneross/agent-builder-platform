# Polyglot Script Decision Guide

> Build reference — load when deciding whether a skill needs a script and which language it should be written in.
> Parent skill: `agent-builder`. Pairs with `references/build/01-build-skill-or-plugin.md`. Honors the standing **minimal-dependencies** and **build-from-scratch** bias.

---

## Core Claim

A skill owns routing and judgment. A script owns work that is fragile, repetitive, or determinism-critical — the work an LLM should not re-derive on every run. Put that work in a script in the language that fits the work, and have the skill *call* it. Do not prose-reimplement deterministic logic inside `SKILL.md`.

---

## First Gate — Do You Even Need A Script?

Add a script only when at least one is true:

- The step is **deterministic** and you want the same output every time (parsing, schema validation, file scaffolding, metric computation).
- The step is **fragile to re-author** (easy for a model to get subtly wrong each run).
- The step is **repetitive** across runs and benefits from a fixed, tested implementation.

If none hold, ship a script-free skill. Inventing a script "to look complete" violates minimal-deps. Most skills need zero or one script.

---

## Language Decision Table

| Pick | When it fits | When NOT to use it | Run command | Deps posture |
|---|---|---|---|---|
| **Python** (default) | Glue, data wrangling, file/text manipulation, JSON/YAML, light parsing, calling other tools, anything without a hard perf or stats need | Hot loops over large data; standalone distributable binary required | `uv run python3 <script>.py` (or `uv run --with <pkg>` for a one-off dep) | stdlib-first; reach for a dep only when replicating it is impractical. Use `uv` for envs/deps/runs. |
| **Rust** | Perf-critical paths, standalone CLI binaries shipped with the skill, heavy/streaming parsing, anything that must run fast with no interpreter | Quick glue, one-off transforms, anything where Python is fast enough | `cargo run` (dev) / built binary (ship) | crates only when they earn their place; prefer std. |
| **R** | Statistics, statistical modeling, statistical plots/visualization where R's ecosystem is the right tool | General glue, file orchestration, perf paths | `Rscript <script>.R` | base R first; add packages only for genuine statistical need. |
| **Shell** | Orchestration: chaining the above, file moves, git/CLI sequencing, environment checks, glue between deterministic tools | Anything with non-trivial logic, data structures, or error handling — escalate to Python | `bash <script>.sh` (or POSIX `sh`) | none; keep it thin. Fail-open or fail-loud explicitly. |

Tie-breakers, in order: **accuracy > speed > cost**. If two languages both fit, prefer the one that is already present in the target repo's toolchain (don't introduce Rust into a Python repo for a 10-line transform). When in doubt, Python.

---

## Minimal-Dependency Rules

- **stdlib / base first.** Python stdlib, Rust std, base R, POSIX shell before any package/crate.
- **Build it yourself** when the dependency is small enough to replicate. Packages are fine to prototype a concept; replace with owned code when practical.
- **Add a dependency only when it provides significant value that is impractical to replicate.** State the value in a one-line comment at the import.
- **Python uses `uv`** for envs, deps, runs, and one-off CLI tools — not pip/poetry/conda unless a conda-locked ML env is genuinely required.

---

## The Skill ↔ Script Contract

When a skill calls a script:

1. The skill names the script path and the exact invocation in its body and in its Validation section.
2. The script has a narrow, documented input (flags/stdin) and a stable output (stdout/file/exit code). Exit non-zero on failure; print actionable errors.
3. The script ships with at least one **deterministic test in the same language** (Python `python3 -m pytest` or a `__main__` self-test; Rust `#[test]`; R `testthat` or a self-check; shell a fixture assertion). A deterministic script without a test is not build-ready.
4. Inside a plugin, reference the script with `${CLAUDE_PLUGIN_ROOT}/...` so it is location-independent. In `AGENTS.md`, give the plain relative path + run command.
5. Hosts run scripts under a minimal PATH — resolve binaries absolutely or `command -v`-guard, and fail-open (exit 0) for advisory hooks, fail-loud for validators.

---

## Scaffolding A Runnable Script

The scaffolder seeds a runnable, tested script in any of the four languages and wires the skill's body + Validation section to invoke it:

```bash
uv run python3 references/scripts/scaffold_skill.py \
  --name "<skill-id>" --description "<...>" --dest "<dir>" \
  --kind skill --script-lang python   # python | rust | r | shell
```

It emits a hello-fixture script with a passing self-test in the chosen language and adds the invocation + validation line to both the `SKILL.md` and `AGENTS.md` surfaces. Replace the fixture body with the real deterministic logic; keep the test. The scaffolder only writes files — it never invokes the script's interpreter — so requesting `--script-lang r` writes the `.R` + its self-test even on a machine without `Rscript`; run the self-test yourself once the interpreter is available.

---

*Build reference 03/04 — polyglot script decision guide — June 2026*

#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2025-2026 Tyrone Ross, Jr <46267523+tyroneross@users.noreply.github.com>
# SPDX-License-Identifier: Apache-2.0
"""Dual-format skill/plugin scaffolder for the agent-builder Build Mode.

Emits, from one set of source-of-truth templates, BOTH the Claude-native surface
(SKILL.md, and for a plugin .claude-plugin/plugin.json) AND a host-neutral AGENTS.md,
plus a PARITY.md checklist instance and an optional runnable+tested helper script in
python | rust | r | shell.

Stdlib only (minimal-deps). Run with uv:  uv run python3 scaffold_skill.py --help
Self-test (no args needed):              uv run python3 scaffold_skill.py --selftest

Design contract: this script MECHANIZES the templates in
references/templates/build/. Those templates are the truth; this file only copies
and substitutes. The skill (SKILL.md Build Mode) calls this script; it does not
prose-reimplement the substitution.
"""
from __future__ import annotations

import argparse
import re
import sys
import tempfile
from pathlib import Path

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "build"

DESCRIPTION_MAX = 1536  # current Claude skill description listing budget (June 2026)

# ---------------------------------------------------------------------------
# Script fixtures: a hello-fixture with a passing self-test in each language.
# Replace the body with real deterministic logic; keep the test.
# ---------------------------------------------------------------------------

SCRIPT_FIXTURES = {
    "python": (
        "scripts/run.py",
        "uv run python3 scripts/run.py",
        '''#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Deterministic helper for {name}. Replace transform(); keep the self-test."""
import sys


def transform(value: str) -> str:
    """The deterministic job. Fixture: echoes input. Replace me."""
    return value


def _selftest() -> int:
    assert transform("ok") == "ok"
    print("scaffold-fixture: self-test passed")
    return 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        raise SystemExit(_selftest())
    print(transform(sys.stdin.read().strip() if not sys.stdin.isatty() else ""))
''',
    ),
    "rust": (
        "src/main.rs",
        "cargo run",
        '''// SPDX-License-Identifier: Apache-2.0
// Deterministic helper for {name}. Replace transform(); keep the test.
fn transform(value: &str) -> String {{
    value.to_string()
}}

fn main() {{
    let mut input = String::new();
    std::io::Read::read_to_string(&mut std::io::stdin(), &mut input).ok();
    println!("{{}}", transform(input.trim()));
}}

#[cfg(test)]
mod tests {{
    use super::*;
    #[test]
    fn fixture_passes() {{
        assert_eq!(transform("ok"), "ok");
    }}
}}
''',
    ),
    "r": (
        "scripts/run.R",
        "Rscript scripts/run.R",
        '''# SPDX-License-Identifier: Apache-2.0
# Deterministic statistical helper for {name}. Replace transform(); keep the self-test.
transform <- function(value) {{
  value
}}

selftest <- function() {{
  stopifnot(transform("ok") == "ok")
  cat("scaffold-fixture: self-test passed\\n")
}}

args <- commandArgs(trailingOnly = TRUE)
if (length(args) > 0 && args[[1]] == "--selftest") {{
  selftest()
}} else {{
  input <- readLines(file("stdin"), warn = FALSE)
  cat(transform(paste(input, collapse = "")), "\\n")
}}
''',
    ),
    "shell": (
        "scripts/run.sh",
        "bash scripts/run.sh",
        '''#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Deterministic orchestration helper for {name}. Replace transform(); keep the self-test.
set -euo pipefail

transform() {{ printf '%s' "$1"; }}

if [ "${{1:-}}" = "--selftest" ]; then
  [ "$(transform ok)" = "ok" ] || {{ echo "self-test FAILED" >&2; exit 1; }}
  echo "scaffold-fixture: self-test passed"
  exit 0
fi

transform "$(cat)"
''',
    ),
}


def _render(template: str, mapping: dict[str, str]) -> str:
    """Substitute {{KEY}} placeholders. Unmatched placeholders are left visible
    so a hand-finisher can see what still needs filling."""
    def repl(m: re.Match) -> str:
        key = m.group(1).strip()
        return mapping.get(key, m.group(0))

    return re.sub(r"\{\{\s*([A-Z0-9_]+)\s*\}\}", repl, template)


def _kebab_ok(name: str) -> bool:
    return bool(re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", name))


def _base_mapping(args: argparse.Namespace) -> dict[str, str]:
    title = args.name.replace("-", " ").title()
    allowed = (
        f"allowed-tools: {args.allowed_tools}\n" if args.allowed_tools else ""
    )
    return {
        "SKILL_ID": args.name,
        "PLUGIN_NAME": args.name,
        "SKILL_TITLE": title,
        "DESCRIPTION": args.description,
        "PURPOSE_ONE_LINE": args.description.split(".")[0].strip() or args.description,
        "TRIGGER_SUMMARY": "the conditions named in the description hold",
        "TRIGGER_PHRASES": "<fill: literal phrases>",
        "NEGATIVE_TRIGGER": "<fill: when NOT to use>",
        "OTHER_SKILL_OR_NONE": "none",
        "STEP_1": "<fill>",
        "STEP_2": "<fill>",
        "STEP_3": "<fill>",
        "OUTPUT_ARTIFACT": "<fill: the artifact this produces>",
        "VALIDATION_CHECK_1": "<fill: at least one concrete check>",
        "REFERENCE_1": "<fill>.md",
        "READ_WHEN_1": "<condition>",
        "ALLOWED_TOOLS_LINE": allowed,
        "SETUP_NOTES": "<fill: install / prerequisites, or 'none'>",
        "HOST_CAPABILITIES": (args.allowed_tools or "<fill: required host tools>"),
        "CLAUDE_ONLY_NOTES": "None — this surface has no Claude-only mechanics."
        if args.kind == "skill" and not args.script_lang
        else "<note any Claude-only hooks/commands translated or omitted here>",
        "AUTHOR_NAME": args.author,
        "HOMEPAGE": args.homepage,
        "REPOSITORY": args.repository,
        "LICENSE": args.license,
        "KEYWORDS": ", ".join(f'"{k.strip()}"' for k in args.keywords.split(",") if k.strip())
        if args.keywords
        else "",
    }


def _script_blocks(lang: str | None, name: str) -> dict[str, str]:
    if not lang:
        return {
            "SCRIPT_BODY_BLOCK": "",
            "SCRIPT_AGENTS_BLOCK": "No deterministic script — this skill is routing/judgment only.",
            "SCRIPT_VALIDATION_LINE": "",
            "SCRIPT_VALIDATION_LINE_NEUTRAL": "",
        }
    rel, run_cmd, _ = SCRIPT_FIXTURES[lang]
    return {
        "SCRIPT_BODY_BLOCK": f"\nThis skill calls a deterministic helper: `{rel}` — run with `{run_cmd}`.",
        "SCRIPT_AGENTS_BLOCK": f"Deterministic helper: `{rel}`. Run: `{run_cmd}`. Self-test: append `--selftest`.",
        "SCRIPT_VALIDATION_LINE": f"- Script self-test passes: `{run_cmd} --selftest` (or `cargo test` for rust).",
        "SCRIPT_VALIDATION_LINE_NEUTRAL": f"- Script self-test: `{run_cmd} --selftest` (rust: `cargo test`).",
    }


def scaffold(args: argparse.Namespace) -> list[Path]:
    if not _kebab_ok(args.name):
        raise SystemExit(f"--name must be kebab-case (got: {args.name!r})")
    if len(args.description) > DESCRIPTION_MAX:
        raise SystemExit(
            f"--description is {len(args.description)} chars; max {DESCRIPTION_MAX}"
        )
    if args.script_lang and args.script_lang not in SCRIPT_FIXTURES:
        raise SystemExit(f"--script-lang must be one of {sorted(SCRIPT_FIXTURES)}")

    dest = Path(args.dest).resolve() / args.name
    dest.mkdir(parents=True, exist_ok=True)

    mapping = _base_mapping(args)
    mapping.update(_script_blocks(args.script_lang, args.name))

    written: list[Path] = []

    def emit(rel: str, content: str) -> None:
        p = dest / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        written.append(p)

    skill_tpl = (TEMPLATES_DIR / "SKILL.md.template").read_text(encoding="utf-8")
    agents_tpl = (TEMPLATES_DIR / "AGENTS.md.template").read_text(encoding="utf-8")
    parity_tpl = (TEMPLATES_DIR / "parity-checklist.md").read_text(encoding="utf-8")

    emit("SKILL.md", _render(skill_tpl, mapping))
    emit("AGENTS.md", _render(agents_tpl, mapping))
    emit("PARITY.md", _render(parity_tpl, mapping))

    if args.kind == "plugin":
        plugin_tpl = (TEMPLATES_DIR / "plugin.json.template").read_text(encoding="utf-8")
        emit(".claude-plugin/plugin.json", _render(plugin_tpl, mapping))

    if args.script_lang:
        rel, _run, body = SCRIPT_FIXTURES[args.script_lang]
        emit(rel, body.format(name=args.name))
        if args.script_lang == "rust":
            emit(
                "Cargo.toml",
                f'[package]\nname = "{args.name.replace("-", "_")}"\nversion = "0.1.0"\nedition = "2021"\n',
            )

    return written


def _selftest() -> int:
    """Deterministic end-to-end: scaffold into a temp dir, assert both surfaces +
    parity exist and that placeholders were substituted. Covers every language."""
    failures = 0
    with tempfile.TemporaryDirectory() as td:
        for kind in ("skill", "plugin"):
            for lang in (None, "python", "rust", "r", "shell"):
                ns = argparse.Namespace(
                    name="sample-skill",
                    description="Sample skill for the scaffolder self-test. Triggers on 'sample'.",
                    dest=td + f"/{kind}-{lang}",
                    kind=kind,
                    script_lang=lang,
                    allowed_tools="Read,Grep",
                    author="Tester",
                    homepage="https://example.com",
                    repository="https://example.com/repo",
                    license="Apache-2.0",
                    keywords="sample,test",
                )
                written = scaffold(ns)
                names = {p.name for p in written}
                root = Path(ns.dest) / ns.name
                checks = [
                    ("SKILL.md" in names, "SKILL.md emitted"),
                    ("AGENTS.md" in names, "AGENTS.md emitted"),
                    ("PARITY.md" in names, "PARITY.md emitted"),
                    (
                        (kind == "plugin") == ((root / ".claude-plugin/plugin.json").exists()),
                        "plugin.json iff kind==plugin",
                    ),
                    (
                        "{{SKILL_ID}}" not in (root / "SKILL.md").read_text(),
                        "no raw {{SKILL_ID}} placeholder left",
                    ),
                    (
                        "name: sample-skill" in (root / "SKILL.md").read_text(),
                        "frontmatter name substituted",
                    ),
                    (
                        "frontmatter" not in (root / "AGENTS.md").read_text().split("\n")[0].lower()
                        and not (root / "AGENTS.md").read_text().startswith("---"),
                        "AGENTS.md has no YAML frontmatter",
                    ),
                    (
                        (lang is None) or any(lang_marker(lang, p) for p in written),
                        f"{lang} script emitted",
                    ),
                ]
                for ok, label in checks:
                    if not ok:
                        failures += 1
                        print(f"FAIL [{kind}/{lang}] {label}")
    if failures == 0:
        print("scaffold_skill self-test: all checks passed")
    return 1 if failures else 0


def lang_marker(lang: str, p: Path) -> bool:
    rel = SCRIPT_FIXTURES[lang][0]
    return p.as_posix().endswith(rel)


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description="Dual-format skill/plugin scaffolder.")
    ap.add_argument("--name", help="kebab-case skill/plugin id")
    ap.add_argument("--description", help="third-person description with trigger phrases (<1536 chars)")
    ap.add_argument("--dest", default=".", help="output directory (skill dir is created under it)")
    ap.add_argument("--kind", choices=["skill", "plugin"], default="skill")
    ap.add_argument("--script-lang", choices=sorted(SCRIPT_FIXTURES), default=None)
    ap.add_argument("--allowed-tools", default=None, help='e.g. "Read,Grep,Bash"')
    ap.add_argument("--author", default="Tyrone Ross")
    ap.add_argument("--homepage", default="")
    ap.add_argument("--repository", default="")
    ap.add_argument("--license", default="Apache-2.0")
    ap.add_argument("--keywords", default="")
    ap.add_argument("--selftest", action="store_true", help="run deterministic self-test and exit")
    return ap


def main(argv: list[str]) -> int:
    args = build_parser().parse_args(argv)
    if args.selftest:
        return _selftest()
    if not args.name or not args.description:
        print("error: --name and --description are required (or use --selftest)", file=sys.stderr)
        return 2
    written = scaffold(args)
    print(f"scaffolded {args.kind} '{args.name}' → {len(written)} files:")
    for p in written:
        print(f"  {p}")
    print("\nNext: fill the {{...}} placeholders, then run the parity checklist (PARITY.md).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import test from "node:test";

const PLUGIN_ROOT = join(process.cwd(), "plugin");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test("plugin companion is standalone and version-aligned", async () => {
  const metadata = await readJson(join(PLUGIN_ROOT, "metadata.json"));
  const claude = await readJson(join(PLUGIN_ROOT, ".claude-plugin/plugin.json"));
  const codex = await readJson(join(PLUGIN_ROOT, ".codex-plugin/plugin.json"));

  assert.equal(metadata.productRole, "plugin-companion");
  assert.equal(metadata.standalone, true);
  assert.equal(metadata.bundledWithAppRepository, true);
  assert.equal(metadata.entrypoint, "SKILL.md");
  assert.equal(claude.version, metadata.version);
  assert.equal(codex.version, metadata.version);
  assert.equal(claude.repository, "https://github.com/tyroneross/agent-builder");
  assert.equal(codex.repository, "https://github.com/tyroneross/agent-builder");
  assert.equal(codex.skills, "./");

  for (const relativePath of metadata.requiredPaths) {
    assert.equal(await exists(join(PLUGIN_ROOT, relativePath)), true, `${relativePath} should exist in plugin companion`);
  }
});

test("plugin companion does not bundle app-only surfaces", async () => {
  const metadata = await readJson(join(PLUGIN_ROOT, "metadata.json"));
  for (const relativePath of metadata.excludedAppPaths) {
    assert.equal(await exists(join(PLUGIN_ROOT, relativePath)), false, `${relativePath} should not exist in plugin companion`);
  }
});

test("build mode surface ships and is wired into SKILL.md", async () => {
  const metadata = await readJson(join(PLUGIN_ROOT, "metadata.json"));
  assert.equal(metadata.version, "0.4.0", "version should be bumped to 0.4.0 for Build Mode");

  // Build reference set + templates + scaffolder must be present.
  const buildSurface = [
    "references/build/01-build-skill-or-plugin.md",
    "references/build/02-dual-format-parity.md",
    "references/build/03-polyglot-script-guide.md",
    "references/build/04-research-first-protocol.md",
    "references/templates/build/SKILL.md.template",
    "references/templates/build/AGENTS.md.template",
    "references/templates/build/plugin.json.template",
    "references/templates/build/parity-checklist.md",
    "references/scripts/scaffold_skill.py",
  ];
  for (const relativePath of buildSurface) {
    assert.equal(await exists(join(PLUGIN_ROOT, relativePath)), true, `${relativePath} should exist`);
    assert.ok(metadata.requiredPaths.includes(relativePath), `${relativePath} should be a requiredPath`);
  }

  // SKILL.md must route to Build Mode.
  const skill = await readFile(join(PLUGIN_ROOT, "SKILL.md"), "utf8");
  assert.match(skill, /###\s+`build`/, "SKILL.md should declare the `build` mode");
  assert.match(skill, /references\/build\/01-build-skill-or-plugin\.md/, "SKILL.md should link the build workflow");

  // AGENTS.md template must NOT carry YAML frontmatter (agents.md spec).
  const agentsTpl = await readFile(join(PLUGIN_ROOT, "references/templates/build/AGENTS.md.template"), "utf8");
  assert.ok(!agentsTpl.startsWith("---"), "AGENTS.md template must not start with YAML frontmatter");
});

test("scaffolder self-test passes (dual-format + polyglot)", () => {
  // Deterministic end-to-end: scaffolds both kinds x all script languages in a tempdir
  // and asserts both surfaces + parity + scripts render. Skips gracefully if python3 absent.
  let py;
  try {
    py = execFileSync("python3", ["--version"], { encoding: "utf8" });
  } catch {
    return; // no interpreter in CI lane; verify-install covers packaging separately
  }
  const out = execFileSync(
    "python3",
    [join(PLUGIN_ROOT, "references/scripts/scaffold_skill.py"), "--selftest"],
    { encoding: "utf8" }
  );
  assert.match(out, /all checks passed/, "scaffolder self-test should pass");
});

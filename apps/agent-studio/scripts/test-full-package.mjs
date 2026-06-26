// Full-package export test (node, no window).
//
// Verifies Studio can produce the COMPLETE installable agent package via the
// shared @tyroneross/agent-pack engine — not just the 10-file portable subset.
// Also checks the v7 authored governance fields flow into the package.

import assert from "node:assert/strict";
import { makeProject } from "../app/lib/projects.js";
import { exportProjectToFullPackage, exportProjectToSpec } from "../app/lib/spec-export.mjs";

let passed = 0;
const ok = (m) => { console.log(`ok - ${m}`); passed++; };

const project = makeProject({ name: "Full Package Test", goal: "g", context: "c", outcome: "o" });

// 1. Full package is the complete bundle, materially larger than the subset.
const full = exportProjectToFullPackage(project);
const subset = exportProjectToSpec(project);
assert.ok(Array.isArray(full.files), "full.files is an array");
assert.ok(full.files.length > subset.files.length, "full package > subset");
assert.ok(full.files.length >= 20, `expected the full ~34-file bundle, got ${full.files.length}`);
ok(`full package emits ${full.files.length} files (subset emits ${subset.files.length})`);

// 2. Core package files are present.
const paths = new Set(full.files.map((f) => f.path));
for (const required of ["agent.yaml", "manifest.json", "tools.json", "system-prompt.md", "README.md"]) {
  assert.ok(paths.has(required), `package missing ${required}`);
}
ok("package contains agent.yaml/manifest.json/tools.json/system-prompt.md/README.md");

// 3. Setup + runtime + evals + memory layers exist (the things the subset stubs).
const hasPrefix = (p) => [...paths].some((x) => x.startsWith(p));
for (const layer of ["setup/", "runtime/", "evals/", "memory/"]) {
  assert.ok(hasPrefix(layer), `package missing ${layer}* files`);
}
ok("package includes setup/ runtime/ evals/ memory/ layers");

// 4. v7 authored governance flows through: a node with a tool + permission lands
//    in the package's tools/permission surface.
const authored = makeProject({ name: "Authored" });
authored.canvas.nodes[0].permission = "deny-by-default";
authored.canvas.nodes[0].tools = [{ name: "read_db", responsibility: "read rows", sideEffect: "read", permission: "allow-read" }];
const fullAuthored = exportProjectToFullPackage(authored);
const agentYaml = fullAuthored.files.find((f) => f.path === "agent.yaml").content;
assert.ok(agentYaml.includes("deny-by-default"), "authored node permission did not reach agent.yaml");
assert.ok(agentYaml.includes("read_db"), "authored node tool did not reach agent.yaml");
ok("v7 authored node tools/permission flow into the package (agent.yaml)");

console.log(`\nall ${passed} full-package checks passed`);

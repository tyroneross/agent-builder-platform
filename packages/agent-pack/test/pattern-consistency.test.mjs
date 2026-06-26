// Binds the two canonical layers so they cannot drift:
//   - governance PATTERNS (patterns.js): permission tiers, tools, frameworks
//   - canvas seeds CANVAS_PATTERNS (canvas-seeds.mjs): starting graphs
// Same pattern id set; every role/kind is a canonical agent-spec role.

import test from "node:test";
import assert from "node:assert/strict";

import { PATTERNS, CANVAS_PATTERNS, findCanvasPattern, canvasFromPattern } from "../index.mjs";
import { isKnownRole, canonicalRole } from "@tyroneross/agent-spec";

test("governance PATTERNS and CANVAS_PATTERNS cover the same id set", () => {
  const gov = new Set(PATTERNS.map((p) => p.id));
  const canvas = new Set(CANVAS_PATTERNS.map((p) => p.id));
  assert.deepEqual([...canvas].sort(), [...gov].sort(),
    "canvas seeds and governance patterns must define the same pattern ids");
});

test("every canvas seed node uses a canonical agent-spec role", () => {
  for (const p of CANVAS_PATTERNS) {
    assert.ok(p.nodes.length > 0, `${p.id} has no nodes`);
    for (const n of p.nodes) {
      assert.ok(isKnownRole(n.role), `${p.id}/${n.id}: role "${n.role}" is not a canonical role`);
    }
    // edges must reference real node ids
    const ids = new Set(p.nodes.map((n) => n.id));
    for (const e of p.edges) {
      assert.ok(ids.has(e.from) && ids.has(e.to), `${p.id}: edge ${e.id} references a missing node`);
    }
  }
});

test("every governance PATTERN node kind canonicalizes to a known role", () => {
  for (const p of PATTERNS) {
    for (const n of p.nodes ?? []) {
      const role = canonicalRole(n.kind);
      assert.ok(isKnownRole(role), `${p.id}/${n.id}: kind "${n.kind}" does not canonicalize to a known role`);
    }
  }
});

test("canvasFromPattern deep-clones a valid canvas", () => {
  const seed = findCanvasPattern("solo-tool-agent");
  assert.ok(seed, "solo-tool-agent canvas seed exists");
  const canvas = canvasFromPattern(seed);
  assert.equal(canvas.nodes.length, seed.nodes.length);
  assert.equal(canvas.edges.length, seed.edges.length);
  assert.deepEqual(canvas.pan, { x: 0, y: 0 });
  assert.equal(canvas.zoom, 1);
  canvas.nodes[0].title = "mutated";
  assert.notEqual(seed.nodes[0].title, "mutated", "clone must not alias the source");
});

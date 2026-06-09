import { test } from "node:test";
import assert from "node:assert/strict";

import {
  slugify,
  toYaml,
  validateSpec,
  lintRoles,
  ROLES,
  canonicalRole,
  isKnownRole,
  CANONICAL_SCHEMA_VERSION,
  isAcceptedSchemaVersion,
  canonicalSchemaVersion,
  SPEC_DEFAULTS,
} from "../index.mjs";

test("slugify matches the original generator contract", () => {
  assert.equal(slugify("Hello World!"), "hello-world");
  assert.equal(slugify("  --Trim--  "), "trim");
  assert.equal(slugify(""), "agent");
  assert.equal(slugify(null), "agent");
  assert.equal(slugify("a".repeat(200)).length, 80);
});

test("toYaml serializes scalars, arrays, nested objects deterministically", () => {
  assert.equal(toYaml([]), "[]");
  assert.equal(toYaml({}), "{}");
  assert.equal(toYaml("plain"), "plain");
  assert.equal(toYaml("has space"), '"has space"');
  assert.equal(toYaml(42), "42");
  assert.equal(toYaml(true), "true");
  assert.equal(toYaml(["a", "b"]), "- a\n- b");
  const nested = toYaml({ name: "x", tags: ["t1", "t2"], meta: { k: "v" } });
  assert.match(nested, /name: x/);
  assert.match(nested, /tags:\n  - t1\n  - t2/);
  assert.match(nested, /meta:\n  k: v/);
});

test("validateSpec preserves the exact original error contract", () => {
  assert.deepEqual(validateSpec({ projectName: "X", nodes: [{ id: "a", title: "A" }] }), []);

  const noName = validateSpec({ nodes: [{ id: "a", title: "A" }] });
  assert.ok(noName.includes("Project name is required."));

  const noNodes = validateSpec({ projectName: "X", nodes: [] });
  assert.ok(noNodes.includes("At least one node is required."));

  const badNode = validateSpec({ projectName: "X", nodes: [{ title: "A" }] });
  assert.ok(badNode.includes("Every node needs an id."));

  const badEdge = validateSpec({
    projectName: "X",
    nodes: [{ id: "a", title: "A" }],
    edges: [{ from: "a", to: "ghost" }],
  });
  assert.ok(badEdge.some((e) => e.includes("ghost")));
});

test("unified role enum is a superset of both prior vocabularies", () => {
  // studio role set
  for (const r of ["agent", "tool", "subagent", "guardrail", "orchestrator", "executor", "eval", "memory"]) {
    assert.ok(ROLES.includes(r), `missing studio role ${r}`);
  }
  // builder kind set
  for (const k of ["agent", "approval", "verifier", "eval", "executor", "guardrail", "orchestrator", "memory", "state"]) {
    assert.ok(ROLES.includes(k), `missing builder kind ${k}`);
  }
});

test("canonicalRole normalizes aliases and unknowns", () => {
  assert.equal(canonicalRole("guardrail"), "guardrail");
  assert.equal(canonicalRole("verify"), "verifier");
  assert.equal(canonicalRole("router"), "orchestrator");
  assert.equal(canonicalRole("WORKER"), "executor");
  assert.equal(canonicalRole("nonsense"), "agent");
  assert.equal(canonicalRole(""), "agent");
  assert.equal(canonicalRole(undefined), "agent");
});

test("isKnownRole recognizes canonical + alias, rejects junk", () => {
  assert.ok(isKnownRole("memory"));
  assert.ok(isKnownRole("verify"));
  assert.ok(!isKnownRole("frobnicate"));
});

test("lintRoles flags only unknown role/kind values", () => {
  const spec = {
    nodes: [
      { id: "a", role: "agent" },
      { id: "b", kind: "approval" },
      { id: "c", role: "frobnicate" },
    ],
  };
  const unknown = lintRoles(spec);
  assert.deepEqual(unknown, [{ id: "c", value: "frobnicate" }]);
});

test("schema-version reconciliation accepts both legacy literals", () => {
  assert.ok(isAcceptedSchemaVersion("agent-spec/v1"));
  assert.ok(isAcceptedSchemaVersion("agent-builder.v1"));
  assert.ok(!isAcceptedSchemaVersion("agent-spec/v2"));
  assert.equal(canonicalSchemaVersion("agent-builder.v1"), CANONICAL_SCHEMA_VERSION);
  assert.equal(canonicalSchemaVersion("agent-spec/v1"), CANONICAL_SCHEMA_VERSION);
  assert.equal(canonicalSchemaVersion("agent-spec/v9"), "agent-spec/v9");
});

test("SPEC_DEFAULTS carries the canonical schema version and local-first posture", () => {
  assert.equal(SPEC_DEFAULTS.schemaVersion, CANONICAL_SCHEMA_VERSION);
  assert.equal(SPEC_DEFAULTS.modelProvider, "ollama");
  assert.equal(SPEC_DEFAULTS.permissions.default, "deny-by-default");
  assert.deepEqual(SPEC_DEFAULTS.tools, []);
});

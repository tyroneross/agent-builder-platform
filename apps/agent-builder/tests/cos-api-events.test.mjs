// Tests for the SSE event taxonomy expansion in lib/cos-runner.mjs.
//
// We mock the provider layer so the runner exercises its event-emission
// logic without calling Ollama or Groq.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runChiefOfStaff } from "../lib/cos-runner.mjs";
import * as providers from "../lib/providers/index.mjs";
import { setChatImpl } from "../lib/providers/index.mjs";

// ---------- helpers ----------

function buildFakeChat({ failOnce = false } = {}) {
  // Returns a chat() impl that succeeds on every call by default. When
  // failOnce=true, the FIRST call returns a non-ok envelope so the cascade
  // advances to the next step.
  let firstCall = true;
  return async function fakeChat({ provider, model, system, messages, jsonSchema }) {
    if (failOnce && firstCall) {
      firstCall = false;
      return {
        ok: false,
        provider,
        model,
        text: "",
        parsed: null,
        reason: "http-error",
        error: "fake failure",
      };
    }
    // Echo a parsed object. We don't actually validate against jsonSchema —
    // the runner just checks `parsed != null`.
    const minimalParsed = { ok: true, _stub: true };
    return {
      ok: true,
      provider,
      model,
      text: JSON.stringify(minimalParsed),
      parsed: minimalParsed,
      tokens_in: 100,
      tokens_out: 50,
    };
  };
}

async function makeRunDir() {
  const dir = await mkdtemp(join(tmpdir(), "cos-events-"));
  return dir;
}

async function makeMinimalSchedule() {
  return JSON.stringify({
    weekOf: "2026-05-08",
    fixedEvents: [],
    flexibleEvents: [],
    baseline: { deepWorkHours: 0, adminHours: 0, contextSwitches: 0, openLoopRisk: "low" },
  });
}

// ---------- tests ----------

test("runner emits cascade-attempt before each provider call", async () => {
  const original = providers.chat;
  setChatImpl(buildFakeChat());
  try {
    const runDir = await makeRunDir();
    const events = [];
    await runChiefOfStaff({
      schedule: await makeMinimalSchedule(),
      goals: "test goal",
      onEvent: (ev) => events.push(ev),
      runDir,
      timeoutMs: 5000,
      allowCloud: "never",
      modelOverride: { provider: "ollama", model: "fake-model" },
    });
    const cascadeAttempts = events.filter((e) => e.type === "cascade-attempt");
    // 6 nodes × 1 successful attempt each = 6 cascade-attempt events.
    assert.equal(cascadeAttempts.length, 6);
    for (const ev of cascadeAttempts) {
      assert.ok(ev.node);
      assert.ok(ev.lane);
      assert.ok(ev.provider);
      assert.ok(ev.model);
      assert.equal(typeof ev.attempt, "number");
    }
    await rm(runDir, { recursive: true, force: true });
  } finally {
    setChatImpl(original);
  }
});

test("runner emits node-step alongside cascade-attempt for back-compat", async () => {
  const original = providers.chat;
  setChatImpl(buildFakeChat());
  try {
    const runDir = await makeRunDir();
    const events = [];
    await runChiefOfStaff({
      schedule: await makeMinimalSchedule(),
      goals: "test goal",
      onEvent: (ev) => events.push(ev),
      runDir,
      timeoutMs: 5000,
      allowCloud: "never",
      modelOverride: { provider: "ollama", model: "fake-model" },
    });
    const nodeSteps = events.filter((e) => e.type === "node-step");
    const cascadeAttempts = events.filter((e) => e.type === "cascade-attempt");
    assert.equal(nodeSteps.length, cascadeAttempts.length);
    // Legacy `node-step` carries `key`, new `cascade-attempt` carries `node`.
    assert.ok(nodeSteps[0].key);
    await rm(runDir, { recursive: true, force: true });
  } finally {
    setChatImpl(original);
  }
});

test("runner emits run-summary as its penultimate event", async () => {
  const original = providers.chat;
  setChatImpl(buildFakeChat());
  try {
    const runDir = await makeRunDir();
    const events = [];
    await runChiefOfStaff({
      schedule: await makeMinimalSchedule(),
      goals: "test goal",
      onEvent: (ev) => events.push(ev),
      runDir,
      timeoutMs: 5000,
      allowCloud: "never",
      modelOverride: { provider: "ollama", model: "fake-model" },
    });
    // `complete` should be last; `run-summary` should be the one immediately before.
    const last = events[events.length - 1];
    const second = events[events.length - 2];
    assert.equal(last.type, "complete");
    assert.equal(second.type, "run-summary");
    assert.ok(second.summary);
    assert.ok(Array.isArray(second.summary.perNode));
    assert.equal(second.summary.perNode.length, 6);
    assert.ok(second.summary.totals);
    await rm(runDir, { recursive: true, force: true });
  } finally {
    setChatImpl(original);
  }
});

test("runner emits lesson-loaded with full lesson text when ledger present", async () => {
  const original = providers.chat;
  setChatImpl(buildFakeChat());
  try {
    // Build a parent dir with a sibling run that has a learning-ledger.
    const parent = await mkdtemp(join(tmpdir(), "cos-ledger-"));
    const sibling = join(parent, "prior-run");
    await mkdir(sibling, { recursive: true });
    await writeFile(
      join(sibling, "learning-ledger.json"),
      JSON.stringify([
        { status: "promoted", lesson: "Block 90 minutes of deep work each morning." },
        { status: "promoted", lesson: "Batch admin tasks into a single afternoon window." },
        { status: "draft", lesson: "Should not appear in lesson-loaded." },
      ]),
    );
    const runDir = join(parent, "this-run");
    await mkdir(runDir, { recursive: true });

    const events = [];
    await runChiefOfStaff({
      schedule: await makeMinimalSchedule(),
      goals: "test goal",
      onEvent: (ev) => events.push(ev),
      runDir,
      timeoutMs: 5000,
      allowCloud: "never",
      modelOverride: { provider: "ollama", model: "fake-model" },
    });

    const lesson = events.find((e) => e.type === "lesson-loaded");
    assert.ok(lesson, "expected a lesson-loaded event");
    assert.deepEqual(lesson.lessons, [
      "Block 90 minutes of deep work each morning.",
      "Batch admin tasks into a single afternoon window.",
    ]);
    assert.deepEqual(lesson.nodes, ["triage", "time_block_plan"]);

    // `lessons-loaded` (legacy count-only) still fires for back-compat.
    const legacy = events.find((e) => e.type === "lessons-loaded");
    assert.ok(legacy);
    assert.equal(legacy.count, 2);

    await rm(parent, { recursive: true, force: true });
  } finally {
    setChatImpl(original);
  }
});

test("runner does NOT emit lesson-loaded when no ledger sibling exists", async () => {
  const original = providers.chat;
  setChatImpl(buildFakeChat());
  try {
    const runDir = await makeRunDir();
    const events = [];
    await runChiefOfStaff({
      schedule: await makeMinimalSchedule(),
      goals: "test goal",
      onEvent: (ev) => events.push(ev),
      runDir,
      timeoutMs: 5000,
      allowCloud: "never",
      modelOverride: { provider: "ollama", model: "fake-model" },
    });
    const lesson = events.find((e) => e.type === "lesson-loaded");
    assert.equal(lesson, undefined);
    await rm(runDir, { recursive: true, force: true });
  } finally {
    setChatImpl(original);
  }
});

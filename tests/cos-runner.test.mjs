// Tests for the multi-provider cascade refactor.
//
// We do NOT call live Ollama or Groq. Instead, we monkey-patch the provider
// shim's `chat()` and assert routing/cascade/parse-retry/telemetry behavior.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  cascadePolicy,
  resolveCascade,
  NODE_ROUTING,
  FAILURE_REASONS,
} from "../lib/cos-config.mjs";
import { recordTelemetry } from "../lib/cos-telemetry.mjs";
import * as providers from "../lib/providers/index.mjs";
import { setChatImpl } from "../lib/providers/index.mjs";
import { chat as anthropicChat } from "../lib/providers/anthropic.mjs";
import { chat as openaiChat } from "../lib/providers/openai.mjs";

// ---------- cascadePolicy precedence ----------

test("cascadePolicy: default is on-failure with 200k token budget", () => {
  const env = { ...process.env };
  delete process.env.COS_ALLOW_CLOUD;
  delete process.env.COS_MAX_CLOUD_TOKENS;
  const p = cascadePolicy();
  process.env = env;
  assert.equal(p.allowCloud, "on-failure");
  assert.equal(p.maxCloudTokens, 200000);
});

test("cascadePolicy: allowCloud=never zeroes the cloud token budget", () => {
  const p = cascadePolicy({ allowCloud: "never" });
  assert.equal(p.allowCloud, "never");
  assert.equal(p.maxCloudTokens, 0);
});

test("cascadePolicy: explicit opts beat env", () => {
  const env = { ...process.env };
  process.env.COS_ALLOW_CLOUD = "always";
  const p = cascadePolicy({ allowCloud: "never" });
  process.env = env;
  assert.equal(p.allowCloud, "never");
});

test("cascadePolicy: invalid allowCloud falls back to on-failure", () => {
  const p = cascadePolicy({ allowCloud: "garbage" });
  assert.equal(p.allowCloud, "on-failure");
});

// ---------- resolveCascade ordering ----------

test("resolveCascade: never -> [primary, fallback], no cloud", () => {
  const c = resolveCascade("intake", { allowCloud: "never", maxCloudTokens: 0 });
  assert.equal(c.length, 2);
  assert.equal(c[0].lane, "local-primary");
  assert.equal(c[1].lane, "local-fallback");
  assert.deepEqual(c.map((s) => s.provider), ["ollama", "ollama"]);
});

test("resolveCascade: on-failure -> [primary, fallback, cloud]", () => {
  const c = resolveCascade("triage", { allowCloud: "on-failure", maxCloudTokens: 200000 });
  assert.equal(c.length, 3);
  assert.deepEqual(c.map((s) => s.lane), ["local-primary", "local-fallback", "cloud"]);
  assert.equal(c[2].provider, "groq");
});

test("resolveCascade: always -> [cloud, primary, fallback]", () => {
  const c = resolveCascade("triage", { allowCloud: "always", maxCloudTokens: 200000 });
  assert.deepEqual(c.map((s) => s.lane), ["cloud", "local-primary", "local-fallback"]);
});

test("resolveCascade: userOverride collapses to single step", () => {
  const c = resolveCascade(
    "triage",
    { allowCloud: "always", maxCloudTokens: 200000 },
    { provider: "ollama", model: "llama3.2:3b" },
  );
  assert.equal(c.length, 1);
  assert.equal(c[0].lane, "user-override");
  assert.equal(c[0].model, "llama3.2:3b");
});

test("resolveCascade: every documented node has a routing entry", () => {
  const expected = [
    "intake",
    "triage",
    "time_block_plan",
    "decision_log",
    "follow_up_plan",
    "operating_risks",
  ];
  for (const k of expected) {
    assert.ok(NODE_ROUTING[k], `node ${k} missing from NODE_ROUTING`);
    assert.ok(NODE_ROUTING[k].localPrimary.model, `node ${k} primary missing`);
    assert.ok(NODE_ROUTING[k].cloud.model, `node ${k} cloud missing`);
  }
});

// ---------- per-node tier honored ----------

test("Different nodes route to different model tiers (parse vs synthesis)", () => {
  // intake = parse → qwen3:8b-q4_K_M
  // triage = synthesis → gemma4:26b
  assert.notEqual(
    NODE_ROUTING.intake.localPrimary.model,
    NODE_ROUTING.triage.localPrimary.model,
    "parse and synthesis tiers collapsed to one model — tier table not honored",
  );
});

// ---------- provider shim dispatch ----------

test("providers.chat: unknown provider returns ok:false", async () => {
  const env = await providers.chat({ provider: "nopenope", model: "x" });
  assert.equal(env.ok, false);
  assert.match(env.error, /unknown provider/);
});

test("providers.chat: missing provider param returns ok:false", async () => {
  const env = await providers.chat({ model: "x" });
  assert.equal(env.ok, false);
  assert.match(env.error, /missing 'provider'/);
});

test("anthropic stub returns provider-disabled envelope with stable shape", async () => {
  const env = await anthropicChat({ model: "claude-anything" });
  assert.equal(env.ok, false);
  assert.equal(env.provider, "anthropic");
  assert.equal(env.reason, FAILURE_REASONS.PROVIDER_DISABLED);
  assert.equal(env.retryable, false);
});

test("openai stub returns provider-disabled envelope with stable shape", async () => {
  const env = await openaiChat({ model: "gpt-anything" });
  assert.equal(env.ok, false);
  assert.equal(env.provider, "openai");
  assert.equal(env.reason, FAILURE_REASONS.PROVIDER_DISABLED);
});

// ---------- groq missing key path ----------

test("groq.chat: missing GROQ_API_KEY returns missing-key envelope", async () => {
  const env = { ...process.env };
  delete process.env.GROQ_API_KEY;
  const { chat: groqChat } = await import("../lib/providers/groq.mjs");
  const out = await groqChat({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: "x" }] });
  process.env = env;
  assert.equal(out.ok, false);
  assert.equal(out.reason, FAILURE_REASONS.MISSING_KEY);
});

// ---------- telemetry write ----------

test("recordTelemetry: appends one JSONL row per call", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cos-tel-"));
  try {
    await recordTelemetry(dir, {
      node: "intake",
      attempt: 1,
      lane: "local-primary",
      provider: "ollama",
      model: "qwen3:8b-q4_K_M",
      tokens_in: 120,
      tokens_out: 88,
      ms: 1234,
      parsed_ok: true,
      fallback_reason: null,
      parse_retry: false,
    });
    await recordTelemetry(dir, {
      node: "triage",
      attempt: 2,
      lane: "cloud",
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      tokens_in: 410,
      tokens_out: 220,
      ms: 870,
      parsed_ok: true,
      fallback_reason: "http-error",
      parse_retry: false,
    });
    const text = await readFile(join(dir, "telemetry.jsonl"), "utf8");
    const lines = text.trim().split("\n");
    assert.equal(lines.length, 2);
    const r1 = JSON.parse(lines[0]);
    const r2 = JSON.parse(lines[1]);
    assert.equal(r1.node, "intake");
    assert.equal(r2.node, "triage");
    assert.equal(r2.fallback_reason, "http-error");
    assert.ok(r1.ts && r2.ts, "ts present");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------- end-to-end cascade with mocked providers ----------

test("runChiefOfStaff: cascade falls back from local to cloud on local error", async () => {
  const mod = await import("../lib/cos-runner.mjs");

  const calls = [];
  setChatImpl(async (opts) => {
    calls.push({ provider: opts.provider, model: opts.model });
    if (opts.provider === "ollama") {
      return {
        ok: false,
        error: "simulated ollama down",
        retryable: true,
        provider: "ollama",
        model: opts.model,
        reason: FAILURE_REASONS.HTTP,
      };
    }
    if (opts.provider === "groq") {
      const fakeJson = '{"weekOf":"2026-W19","fixedEvents":[],"flexibleEvents":[],"baseline":{"deepWorkHours":0,"adminHours":0,"contextSwitches":0,"openLoopRisk":"low"},"notes":[],"topThree":[],"blocks":[],"decisions":[],"items":[],"missingOwners":[],"risks":[]}';
      return {
        ok: true,
        text: fakeJson,
        parsed: JSON.parse(fakeJson),
        raw: { stub: true },
        tokens_in: 100,
        tokens_out: 50,
        provider: "groq",
        model: opts.model,
      };
    }
    return { ok: false, error: "no", retryable: false, provider: opts.provider, model: opts.model, reason: "unknown" };
  });

  const dir = await mkdtemp(join(tmpdir(), "cos-cascade-"));
  try {
    const events = [];
    const { transcript } = await mod.runChiefOfStaff({
      schedule: '{"weekOf":"2026-W19","events":[]}',
      goals: "test",
      allowCloud: "on-failure",
      maxCloudTokens: 200000,
      onEvent: (ev) => events.push(ev),
      runDir: dir,
    });
    // Every node must have ended up on groq.
    for (const [, node] of Object.entries(transcript.nodes)) {
      assert.equal(node.provider, "groq", `${node.name} should have fallen back to groq`);
      assert.equal(node.lane, "cloud");
    }
    // Telemetry should record ollama failures AND groq successes.
    const tel = (await readFile(join(dir, "telemetry.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const ollamaFails = tel.filter((r) => r.provider === "ollama" && !r.parsed_ok);
    const groqWins = tel.filter((r) => r.provider === "groq" && r.parsed_ok);
    assert.ok(ollamaFails.length > 0, "expected ollama failure rows in telemetry");
    assert.ok(groqWins.length >= 6, "expected groq success rows for all 6 nodes");
  } finally {
    setChatImpl(null);
    await rm(dir, { recursive: true, force: true });
  }
});

test("runChiefOfStaff: allowCloud=never never reaches groq", async () => {
  const mod = await import("../lib/cos-runner.mjs");

  const seen = new Set();
  setChatImpl(async (opts) => {
    seen.add(opts.provider);
    return {
      ok: false,
      error: "simulated all-local down",
      retryable: true,
      provider: opts.provider,
      model: opts.model,
      reason: FAILURE_REASONS.HTTP,
    };
  });

  const dir = await mkdtemp(join(tmpdir(), "cos-strict-"));
  try {
    const { transcript } = await mod.runChiefOfStaff({
      schedule: '{"weekOf":"2026-W19","events":[]}',
      goals: "test",
      allowCloud: "never",
      onEvent: () => {},
      runDir: dir,
    });
    assert.ok(!seen.has("groq"), "groq must not be touched under allowCloud=never");
    for (const [, node] of Object.entries(transcript.nodes)) {
      assert.ok(node.error, "every node should have errored cleanly under strict-local");
    }
  } finally {
    setChatImpl(null);
    await rm(dir, { recursive: true, force: true });
  }
});

test("runChiefOfStaff: parse-retry fires on null parse, succeeds on retry", async () => {
  const mod = await import("../lib/cos-runner.mjs");

  // Track per-(provider,model) call counts so we can return null first then valid second.
  const counts = new Map();
  setChatImpl(async (opts) => {
    // The runner's warmup also calls chat; let it succeed quickly.
    if (opts.messages?.[0]?.content?.includes('Return {"ok":true}')) {
      return {
        ok: true,
        text: '{"ok":true}',
        parsed: { ok: true },
        raw: null,
        tokens_in: 1,
        tokens_out: 1,
        provider: opts.provider,
        model: opts.model,
      };
    }
    const k = `${opts.provider}:${opts.model}`;
    const n = (counts.get(k) ?? 0) + 1;
    counts.set(k, n);
    if (n === 1) {
      // Malformed JSON — triggers parse-retry.
      return {
        ok: true,
        text: "this is not json {{{",
        parsed: null,
        raw: null,
        tokens_in: 50,
        tokens_out: 10,
        provider: opts.provider,
        model: opts.model,
      };
    }
    // Retry succeeds.
    const fakeJson = '{"weekOf":"2026-W19","fixedEvents":[],"flexibleEvents":[],"baseline":{"deepWorkHours":0,"adminHours":0,"contextSwitches":0,"openLoopRisk":"low"},"notes":[],"topThree":[],"blocks":[],"decisions":[],"items":[],"missingOwners":[],"risks":[]}';
    return {
      ok: true,
      text: fakeJson,
      parsed: JSON.parse(fakeJson),
      raw: null,
      tokens_in: 100,
      tokens_out: 50,
      provider: opts.provider,
      model: opts.model,
    };
  });

  const dir = await mkdtemp(join(tmpdir(), "cos-retry-"));
  try {
    const { transcript } = await mod.runChiefOfStaff({
      schedule: '{"weekOf":"2026-W19","events":[]}',
      goals: "test",
      allowCloud: "never",
      onEvent: () => {},
      runDir: dir,
    });
    // All nodes should have succeeded on the local primary after a parse-retry.
    for (const [, node] of Object.entries(transcript.nodes)) {
      assert.equal(node.lane, "local-primary", `${node.name} should win on primary after retry`);
      assert.ok(node.parsed != null);
    }
    const tel = (await readFile(join(dir, "telemetry.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    // Different nodes share models (triage/time_block_plan/operating_risks
    // all use gemma4:26b), so the per-(provider,model) counter only triggers
    // a parse-retry the FIRST time each model is touched. Two distinct local
    // primary models in the routing table → at least 2 retry rows.
    const retries = tel.filter((r) => r.parse_retry === true && r.parsed_ok === true);
    assert.ok(retries.length >= 2, `expected ≥2 retry rows, got ${retries.length}`);
    // Every node must still land on a parsed result via local-primary.
    const parsedNodes = Object.values(transcript.nodes).filter((n) => n.parsed != null);
    assert.equal(parsedNodes.length, 6, "every node should have ended with a parsed result");
  } finally {
    setChatImpl(null);
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------- G1: parallel fan-out of independent nodes ----------

test("runChiefOfStaff: decision_log/follow_up_plan/operating_risks run in parallel", async () => {
  const mod = await import("../lib/cos-runner.mjs");

  const FAKE_JSON = '{"weekOf":"2026-W19","fixedEvents":[],"flexibleEvents":[],"baseline":{"deepWorkHours":0,"adminHours":0,"contextSwitches":0,"openLoopRisk":"low"},"notes":[],"topThree":[],"blocks":[],"decisions":[],"items":[],"missingOwners":[],"risks":[]}';

  // Simulate 80ms latency per node call. If the 3 leaf nodes run in parallel,
  // their wall-clock should be ~80ms, not ~240ms.
  setChatImpl(async (opts) => {
    if (opts.messages?.[0]?.content?.includes('Return {"ok":true}')) {
      return {
        ok: true, text: '{"ok":true}', parsed: { ok: true }, raw: null,
        tokens_in: 1, tokens_out: 1, provider: opts.provider, model: opts.model,
      };
    }
    await new Promise((r) => setTimeout(r, 80));
    return {
      ok: true, text: FAKE_JSON, parsed: JSON.parse(FAKE_JSON), raw: null,
      tokens_in: 100, tokens_out: 50, provider: opts.provider, model: opts.model,
    };
  });

  const dir = await mkdtemp(join(tmpdir(), "cos-parallel-"));
  try {
    const { transcript } = await mod.runChiefOfStaff({
      schedule: '{"weekOf":"2026-W19","events":[]}',
      goals: "test",
      allowCloud: "never",
      onEvent: () => {},
      runDir: dir,
    });

    const leaves = ["decision_log", "follow_up_plan", "operating_risks"];
    const ts = leaves.map((k) => ({
      key: k,
      start: Date.parse(transcript.nodes[k].startedAt),
      end: Date.parse(transcript.nodes[k].endedAt),
      dur: transcript.nodes[k].durationMs,
    }));
    const summed = ts.reduce((a, b) => a + b.dur, 0);
    const wall = Math.max(...ts.map((x) => x.end)) - Math.min(...ts.map((x) => x.start));
    // Wall-clock for the fan-out wave should be much less than the sum of
    // individual durations — at least < 70% of summed when they run together.
    assert.ok(
      wall < summed * 0.7,
      `expected fan-out (wall=${wall}ms) << summed (${summed}ms); leaves did not run concurrently`,
    );
  } finally {
    setChatImpl(null);
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------- G2: warmup uses smallest model in cascade ----------

test("runChiefOfStaff: warmup picks smallest local model, not synthesis", async () => {
  const mod = await import("../lib/cos-runner.mjs");

  const FAKE_JSON = '{"weekOf":"2026-W19","fixedEvents":[],"flexibleEvents":[],"baseline":{"deepWorkHours":0,"adminHours":0,"contextSwitches":0,"openLoopRisk":"low"},"notes":[],"topThree":[],"blocks":[],"decisions":[],"items":[],"missingOwners":[],"risks":[]}';
  let warmupModel = null;

  setChatImpl(async (opts) => {
    if (opts.messages?.[0]?.content?.includes('Return {"ok":true}')) {
      warmupModel = opts.model;
      return {
        ok: true, text: '{"ok":true}', parsed: { ok: true }, raw: null,
        tokens_in: 1, tokens_out: 1, provider: opts.provider, model: opts.model,
      };
    }
    return {
      ok: true, text: FAKE_JSON, parsed: JSON.parse(FAKE_JSON), raw: null,
      tokens_in: 100, tokens_out: 50, provider: opts.provider, model: opts.model,
    };
  });

  const dir = await mkdtemp(join(tmpdir(), "cos-warm-"));
  try {
    await mod.runChiefOfStaff({
      schedule: '{"weekOf":"2026-W19","events":[]}',
      goals: "test",
      allowCloud: "never",
      onEvent: () => {},
      runDir: dir,
    });
    assert.ok(warmupModel, "warmup should have run");
    // Smallest model in cascade is llama3.2:3b (parse fallback). Warmup must
    // NOT pick the 26B synthesis model.
    assert.notEqual(warmupModel, "gemma4:26b", `warmup picked synthesis model ${warmupModel}`);
    // Should be one of the small models.
    assert.ok(
      ["llama3.2:3b", "qwen3:8b-q4_K_M"].includes(warmupModel),
      `warmup picked unexpected model ${warmupModel}`,
    );
  } finally {
    setChatImpl(null);
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------- F4: per-node tier honored end-to-end ----------

test("runChiefOfStaff: per-node tier produces different models in telemetry", async () => {
  const mod = await import("../lib/cos-runner.mjs");

  setChatImpl(async (opts) => {
    const fakeJson = '{"weekOf":"2026-W19","fixedEvents":[],"flexibleEvents":[],"baseline":{"deepWorkHours":0,"adminHours":0,"contextSwitches":0,"openLoopRisk":"low"},"notes":[],"topThree":[],"blocks":[],"decisions":[],"items":[],"missingOwners":[],"risks":[]}';
    return {
      ok: true,
      text: fakeJson,
      parsed: JSON.parse(fakeJson),
      raw: null,
      tokens_in: 100,
      tokens_out: 50,
      provider: opts.provider,
      model: opts.model,
    };
  });

  const dir = await mkdtemp(join(tmpdir(), "cos-tier-"));
  try {
    const { transcript } = await mod.runChiefOfStaff({
      schedule: '{"weekOf":"2026-W19","events":[]}',
      goals: "test",
      allowCloud: "never",
      onEvent: () => {},
      runDir: dir,
    });
    // intake (parse) should be on qwen3:8b-q4_K_M, triage (synthesis) on gemma4:26b.
    assert.equal(transcript.nodes.intake.model, NODE_ROUTING.intake.localPrimary.model);
    assert.equal(transcript.nodes.triage.model, NODE_ROUTING.triage.localPrimary.model);
    assert.notEqual(
      transcript.nodes.intake.model,
      transcript.nodes.triage.model,
      "tier table collapsed — intake and triage should not share a model",
    );
  } finally {
    setChatImpl(null);
    await rm(dir, { recursive: true, force: true });
  }
});

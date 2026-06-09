// Test for /api/cos/env-status — the boundary that returns booleans only,
// never the actual API key values. We import the route handler directly and
// invoke its GET function; we don't spin up a Next.js server.

import test from "node:test";
import assert from "node:assert/strict";

// Dynamic import so we control env state before module load if needed.
const { GET } = await import("../app/api/cos/env-status/route.js");

function withEnv(overrides, fn) {
  const snapshot = { ...process.env };
  for (const [k, v] of Object.entries(overrides)) {
    if (v == null) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    process.env = snapshot;
  }
}

async function readBody(response) {
  const text = await response.text();
  return JSON.parse(text);
}

test("env-status: returns booleans for each provider", async () => {
  await withEnv(
    {
      GROQ_API_KEY: "gsk_fake_key_12345",
      ANTHROPIC_API_KEY: "",
      OPENAI_API_KEY: "sk-proj-fake-67890",
    },
    async () => {
      const res = GET();
      const body = await readBody(res);
      assert.equal(body.groq, true);
      assert.equal(body.anthropic, false);
      assert.equal(body.openai, true);
    },
  );
});

test("env-status: response body never contains key-shaped strings", async () => {
  const FAKE_GROQ = "gsk_super_secret_value_do_not_leak_xyz";
  const FAKE_ANTHROPIC = "sk-ant-fake-do-not-leak-abc";
  const FAKE_OPENAI = "sk-proj-fake-do-not-leak-def";
  await withEnv(
    {
      GROQ_API_KEY: FAKE_GROQ,
      ANTHROPIC_API_KEY: FAKE_ANTHROPIC,
      OPENAI_API_KEY: FAKE_OPENAI,
    },
    async () => {
      const res = GET();
      const text = await res.text();
      // Hard guarantee: none of the secret values appear in the body.
      assert.ok(!text.includes(FAKE_GROQ), "GROQ key leaked in response");
      assert.ok(!text.includes(FAKE_ANTHROPIC), "Anthropic key leaked in response");
      assert.ok(!text.includes(FAKE_OPENAI), "OpenAI key leaked in response");
      // And no generic key prefixes.
      assert.ok(!text.includes("sk-"), "OpenAI/Anthropic-style prefix leaked");
      assert.ok(!text.includes("gsk_"), "Groq-style prefix leaked");
    },
  );
});

test("env-status: missing env vars return false rather than throwing", async () => {
  await withEnv(
    { GROQ_API_KEY: null, ANTHROPIC_API_KEY: null, OPENAI_API_KEY: null },
    async () => {
      const res = GET();
      const body = await readBody(res);
      assert.equal(body.groq, false);
      assert.equal(body.anthropic, false);
      assert.equal(body.openai, false);
    },
  );
});

test("env-status: whitespace-only key counts as absent", async () => {
  await withEnv({ GROQ_API_KEY: "   " }, async () => {
    const res = GET();
    const body = await readBody(res);
    assert.equal(body.groq, false);
  });
});

test("env-status: response includes ollamaBaseUrl for UI use", async () => {
  await withEnv({ OLLAMA_BASE_URL: "http://192.168.1.50:11434" }, async () => {
    const res = GET();
    const body = await readBody(res);
    assert.equal(body.ollamaBaseUrl, "http://192.168.1.50:11434");
  });
});

test("env-status: cache-control prevents caching", async () => {
  await withEnv({ GROQ_API_KEY: "x" }, () => {
    const res = GET();
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(res.headers.get("content-type"), "application/json");
  });
});

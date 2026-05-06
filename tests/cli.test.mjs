import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../bin/cos-cli.mjs";

test("CLI parses terminal status and talk options", () => {
  const status = parseArgs(["status", "--port", "3032", "--provider", "ollama"], {});
  assert.equal(status.command, "status");
  assert.equal(status.port, 3032);
  assert.equal(status.baseUrl, "http://127.0.0.1:3032");
  assert.equal(status.provider, "ollama");

  const talk = parseArgs(["talk", "--model", "qwen3:8b-q4_K_M"], {});
  assert.equal(talk.command, "talk");
  assert.equal(talk.useModel, true);
  assert.equal(talk.model, "qwen3:8b-q4_K_M");
});

test("CLI can force deterministic terminal mode", () => {
  const options = parseArgs(["talk", "--no-model", "--no-start"], { COS_MODEL: "qwen3:8b-q4_K_M" });
  assert.equal(options.command, "talk");
  assert.equal(options.useModel, false);
  assert.equal(options.model, "");
  assert.equal(options.autoStart, false);
});

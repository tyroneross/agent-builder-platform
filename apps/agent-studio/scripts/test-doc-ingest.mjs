#!/usr/bin/env node
// Colocated test for app/lib/doc-ingest.mjs: binary docs parse through
// omniparse, text formats stay raw, missing text fails loudly.
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readUploadAsText, DOC_PARSE_EXTENSIONS } from "../app/lib/doc-ingest.mjs";

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures", "doc-ingest");

const checks = [];
function check(name, fn) {
  checks.push([name, fn]);
}

check("extension set covers exactly the omniparse binary formats", () => {
  assert.deepEqual([...DOC_PARSE_EXTENSIONS].sort(), [".pdf", ".pptx", ".xlsx"]);
});

check("raw path: .md reads verbatim", async () => {
  const { contents, parser } = await readUploadAsText(join(FIXTURES, "sample.md"));
  assert.equal(parser, "raw");
  assert.ok(contents.includes("plain text path"));
});

check("omniparse path: .pdf extracts text", async () => {
  const { contents, parser } = await readUploadAsText(join(FIXTURES, "sample.pdf"));
  assert.equal(parser, "omniparse");
  assert.ok(contents.includes("Omniparse PDF fixture text"), `got: ${contents.slice(0, 200)}`);
});

check("omniparse path: .pptx extracts slide text", async () => {
  const { contents, parser } = await readUploadAsText(join(FIXTURES, "sample.pptx"));
  assert.equal(parser, "omniparse");
  assert.ok(contents.includes("DOE Ingest Fixture"), `got: ${contents.slice(0, 200)}`);
});

check("unreadable input throws (callers surface a warning event)", async () => {
  await assert.rejects(() => readUploadAsText(join(FIXTURES, "missing.pdf")));
});

let failed = 0;
for (const [name, fn] of checks) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`not ok - ${name}\n  ${err.message}`);
  }
}
if (failed > 0) {
  console.error(`\n${failed}/${checks.length} doc-ingest checks failed`);
  process.exit(1);
}
console.log(`\nall ${checks.length} doc-ingest checks passed`);

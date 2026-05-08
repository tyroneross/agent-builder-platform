// Telemetry writer — append-only JSONL, atomic write+rename per row.
//
// One row per provider call (initial attempt OR parse-retry OR cascade step).
// Each row carries enough context to debug a cascade after the fact.
//
// Atomicity: we APPEND to the target file, but we serialize via a per-process
// chain of in-flight writes so concurrent calls cannot interleave. Crash
// safety: each row is `JSON.stringify(...) + "\n"` flushed in one `appendFile`.
// Partial rows would be invalid JSON and easy to detect on read.

import { mkdir, appendFile, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";

let _writeChain = Promise.resolve();

/**
 * Append a telemetry row.
 *
 * @param {string} runDir   absolute path to the per-run directory
 * @param {object} row      telemetry payload — see schema below
 *
 * Schema:
 *   ts             ISO timestamp
 *   node           node key (e.g. "intake")
 *   attempt        cascade attempt number, 1-based
 *   lane           "local-primary" | "local-fallback" | "cloud" | "user-override" | "warmup"
 *   provider       "ollama" | "groq" | "anthropic" | "openai"
 *   model          string
 *   tokens_in      number | null
 *   tokens_out     number | null
 *   ms             number
 *   parsed_ok      boolean
 *   fallback_reason  null | "http-error" | "timeout" | "stream-stall" | "parse-failed" | ...
 *   parse_retry    boolean — true if this row is the retry pass
 *   error          string | undefined
 */
export function recordTelemetry(runDir, row) {
  const target = join(runDir, "telemetry.jsonl");
  const line = JSON.stringify({ ts: new Date().toISOString(), ...row }) + "\n";
  _writeChain = _writeChain
    .then(async () => {
      await mkdir(dirname(target), { recursive: true });
      await appendFile(target, line, "utf8");
    })
    .catch((err) => {
      // Telemetry failures must not abort the run; log and continue.
      // eslint-disable-next-line no-console
      console.error(`[cos-telemetry] write failed: ${err.message}`);
    });
  return _writeChain;
}

/**
 * Wait for all pending telemetry writes to flush. Call before reading the
 * file (tests, end-of-run summary). Failures inside the chain are swallowed
 * so this never throws.
 */
export async function flushTelemetry() {
  try { await _writeChain; } catch {}
}

/**
 * Convenience: write a single JSON snapshot atomically (write to .tmp + rename).
 * Used for the per-run summary at end of run.
 */
export async function writeAtomicJSON(path, obj) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await rename(tmp, path);
}

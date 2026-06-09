// Server-side document ingest for uploads (follow-up item 01).
//
// ONE canonical ingest surface: binary document uploads (.pdf/.xlsx/.pptx)
// are converted to LLM-ready text via @tyroneross/omniparse at load time;
// plain-text uploads keep the raw utf8 read. Both run routes
// (/api/agent/run and /api/agent/run-node) consume this helper so the solo
// run and the full run see identical upload context.
//
// Node-runtime only (omniparse touches the filesystem) — never import from
// client components.

import fs from "node:fs/promises";
import path from "node:path";

// Extensions parsed through omniparse. Matches what the published package
// routes natively (detectInputType): pdf -> pdf parser, xlsx -> excel,
// pptx -> powerpoint. Plain-text formats bypass parsing.
export const DOC_PARSE_EXTENSIONS = new Set([".pdf", ".xlsx", ".pptx"]);

/**
 * Read one upload as LLM-ready text.
 *
 * @returns {Promise<{contents: string, parser: "omniparse"|"raw"}>}
 *   Throws on unreadable/unparseable input — callers already wrap loads in
 *   try/catch and surface a non-fatal warning event.
 */
export async function readUploadAsText(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  if (!DOC_PARSE_EXTENSIONS.has(ext)) {
    return { contents: await fs.readFile(absPath, "utf8"), parser: "raw" };
  }
  const { parse } = await import("@tyroneross/omniparse");
  const result = await parse(absPath, { quiet: true });
  const first = Array.isArray(result) ? result[0] : result;
  const contents = first?.markdown || first?.text || "";
  if (!contents) {
    const errs = (first?.errors ?? []).join("; ");
    throw new Error(`omniparse produced no text for ${path.basename(absPath)}${errs ? ` (${errs})` : ""}`);
  }
  return { contents, parser: "omniparse" };
}

// Portable spec defaults — the values the studio fills at export time so a spec
// authored without those fields still validates against the shared contract and
// matches a local-first (Ollama/Next.js) runtime.
//
// Extracted from agent-studio/app/lib/spec-export.mjs#SPEC_DEFAULTS. The builder's
// pattern-aware normalizeSpec() stays in the builder (it depends on the PATTERNS
// registry, which is generation data, not the portable contract). These defaults
// are the field-level fallbacks both apps share.

import { CANONICAL_SCHEMA_VERSION } from "./schema.mjs";

export const SPEC_DEFAULTS = Object.freeze({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  patternId: "solo-tool-agent",
  runtime: "local-nextjs",
  framework: "custom-loop",
  modelProvider: "ollama",
  sandbox: "workspace-write",
  autonomy: "human-in-loop",
  permissions: {
    default: "deny-by-default",
    read: "allow approved local/project context",
    write: "ask first",
    network: "ask first unless source registry marks official docs",
    shell: "ask first",
  },
  memory: {
    working: "current request, selected context, active plan",
    session: "tool outputs and decisions for this run",
    persistent: "operator policy and reusable project facts with provenance",
  },
  // Empty list is accepted by validateSpec; studio specs should not inherit
  // pattern-default tools the user never declared.
  tools: [],
  sources: ["next-app-router", "next-route-handlers", "ollama-api"],
  evalsFrameworkLabel: "Custom loop",
});

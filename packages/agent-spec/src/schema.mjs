// Schema-version reconciliation for the agent-spec contract.
//
// Two literals existed in the wild:
//   - agent-builder generator emitted/read `schemaVersion: "agent-builder.v1"`
//   - agent-studio spec-export emitted `schemaVersion: "agent-spec/v1"`
// Both describe the SAME manifest shape (identical graph: {nodes, edges} and the
// 10-file bundle). This module canonicalizes: read accepts BOTH, write emits ONE.

export const CANONICAL_SCHEMA_VERSION = "agent-spec/v1";

// All historical/aliased schema-version strings that denote the same contract.
export const ACCEPTED_SCHEMA_VERSIONS = Object.freeze([
  "agent-spec/v1",
  "agent-builder.v1",
]);

/** True if `value` is any accepted schema-version string. */
export function isAcceptedSchemaVersion(value) {
  return ACCEPTED_SCHEMA_VERSIONS.includes(value);
}

/**
 * Normalize a schema-version string to the canonical form on READ.
 * Unknown values pass through unchanged (callers decide whether to reject).
 */
export function canonicalSchemaVersion(value) {
  return isAcceptedSchemaVersion(value) ? CANONICAL_SCHEMA_VERSION : value;
}

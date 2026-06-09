// @tyroneross/agent-spec — the single source of truth for the agent-graph spec
// contract shared by agent-builder (design/package) and agent-studio (run).
//
// Replaces:
//   - agent-builder/lib/generator.js's inline slugify/validateSpec/toYaml
//   - agent-studio/app/lib/spec-export.mjs's hand-copied validateSpec + defaults
//     (which carried the literal "switch to import when it becomes a peer dep")

export { slugify } from "./src/slugify.mjs";
export { toYaml } from "./src/yaml.mjs";
export { validateSpec, lintRoles } from "./src/validate.mjs";
export { ROLES, ROLE_ALIASES, canonicalRole, isKnownRole } from "./src/roles.mjs";
export {
  CANONICAL_SCHEMA_VERSION,
  ACCEPTED_SCHEMA_VERSIONS,
  isAcceptedSchemaVersion,
  canonicalSchemaVersion,
} from "./src/schema.mjs";
export { SPEC_DEFAULTS } from "./src/defaults.mjs";

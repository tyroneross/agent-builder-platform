# Skill Contract Template

> Use one skill contract per reusable skill in an agent system. A skill contract names the trigger, context-loading rules, inputs, outputs, references, scripts, validation checks, chaining rules, and modification policy. Pair with the [agent manifest](agent-manifest.md), [role card](role-card.md), and [tool contract](tool-contract.md).

```yaml
skill_contract:
  skill_id: "<skill-id>"
  name: "<Human-readable name>"
  purpose: "<one sentence>"
  owner: "<team, maintainer, or agent>"
  host_support:
    - "codex"
    - "claude"
    - "api-wrapper"
  trigger_conditions:
    phrases:
      - "<phrase>"
    path_patterns:
      - "<glob>"
    import_patterns:
      - "<package-or-module>"
    negative_triggers:
      - "<when not to use>"
  input_contract:
    required:
      - "<field>"
    optional:
      - "<field>"
    assumptions_to_confirm:
      - "<assumption>"
  context_loading:
    always_read:
      - "SKILL.md"
    read_when:
      - file: "references/<file>.md"
        condition: "<condition>"
  outputs:
    primary_artifact: "<artifact>"
    secondary_artifacts:
      - "<artifact>"
    output_schema: "<schema path or inline summary>"
  scripts:
    - path: "scripts/<script>"
      purpose: "<deterministic job>"
      required: false
  skill_chaining:
    can_chain_after:
      - "<skill-id>"
    can_chain_before:
      - "<skill-id>"
    requires_handoff_envelope: true
    termination_condition: "<when the chain stops>"
  permissions:
    reads:
      - "<scope>"
    writes:
      - "<scope>"
    tools:
      - "<tool>"
    approval_required_for:
      - "<action>"
  validation:
    checks:
      - "<command or review check>"
    fixture_tasks:
      - "<representative task>"
    pass_criteria:
      - "<observable>"
  modification_policy:
    default_action: "modify | wrap | fork | externalize"
    do_not_change:
      - "<boundary>"
    versioning_rule: "<when to bump version or record ADR>"
```

## Conventions

- Keep `SKILL.md` lean. Put detailed variants in direct reference files.
- A skill's trigger should be specific enough to avoid stealing work from neighboring skills.
- Chained skills need explicit input and output artifacts. If no artifact crosses the boundary, do not chain.
- Scripts should own fragile deterministic work; the skill should own routing and judgment.
- If the same workflow must run in Claude and Codex, keep host-specific manifests parallel but keep the workflow itself host-neutral.
- When modifying a skill, preserve existing trigger semantics unless the change explicitly fixes a routing bug.

**Reference:** `references/catalog/08-repo-skill-architecture.md` and `references/catalog/09-skill-bank-and-chaining.md`.

# Chief of Staff Growth and Coordination

## Bottom Line

Chief of Staff should grow by adding durable operating capabilities behind
stable layer contracts, not by making the model, UI, integrations, and workflow
logic talk to each other directly.

The current app is a modular baseline. The next phase is to turn it into a
local operating system by adding data stores, deterministic tools, durable
ritual runs, approval execution, and optional integration adapters in that
order.

## Growth Means More Operating Memory, Not More Prompt Surface

The product should become more useful because it knows more about the user's
operating context and can move work through explicit states.

Good growth looks like:

- tasks, commitments, people, meetings, decisions, goals, and learning history
  become structured local records
- rituals read small context packets assembled from those records
- tools make deterministic changes to those records
- integrations stay behind adapters and approval gates
- every important action leaves an audit trail
- the UI shows the next decision or action, not every internal detail

Bad growth looks like:

- prompts read raw files directly
- UI code mutates workspace files
- integrations bypass approval policy
- every ritual has its own private data format
- "agentic" behavior happens without run state, checkpoints, or audit records
- larger models are used as a substitute for explicit state

## The Growth Sequence Should Protect The Architecture

Build in this order:

1. **Local state foundation**
   Add typed stores for tasks, commitments, people, meetings, decisions,
   learning ledger, and ritual runs. Keep the first implementation as local
   JSON/Markdown unless a real query need proves a database is necessary.

2. **Deterministic tools**
   Add tools that operate on those stores: task CRUD, commitment extraction,
   people lookup, meeting cache, decision logging, learning updates, and
   document creation. Tools should validate inputs, return structured outputs,
   and declare permissions.

3. **Ritual workflows**
   Add weekly review, meeting prep, end-of-day review, open-loop triage, and
   eventually weekly planning. Each ritual should have `schema.mjs`,
   `prompt.mjs`, `fallback.mjs`, `render.mjs`, and `run.mjs`.

4. **Durable execution**
   Add a run store before rituals become long-running or approval-paused. A run
   should track `run_id`, `ritual_id`, inputs, steps, model calls, tool calls,
   pending approvals, final artifacts, and errors.

5. **Approval execution**
   Today approvals can be queued and resolved. The next step is to make approved
   actions resumable and executable through constrained executors. Resolution
   should not directly perform arbitrary work; it should resume a known action
   payload with a known permission and tool.

6. **Optional integrations**
   Add Apple Calendar, Reminders, Gmail, Outlook, Slack, filesystem, and cloud
   providers only as adapters. Keep each disabled until configured and approved.
   Integration code should not own product logic.

7. **Agent Builder generation**
   Once the standalone app shape is stable, teach Agent Builder to generate this
   architecture as a template. Generator work should follow the app, not lead it.

## The Architecture Needs New Contracts As It Grows

The current layers are correct, but the contracts need to become more explicit.

### Core Should Own Durable State And Policy

Build in `src/core` when the code defines invariants that every other layer must
obey.

Add:

- `src/core/memory/` for context packets, profile, preferences, and learning
  ledger access
- `src/core/runs/` for ritual run records, checkpoints, and resume state
- `src/core/scheduler/` only after recurring or time-based local actions are
  needed
- stricter approval policies for internet, system, write, and delete execution

Do not put prompt logic, provider-specific code, or UI formatting in core.

### Tools Should Own Deterministic Capabilities

Build in `src/tools` when the code is an action a ritual or future agent may
invoke.

Tool modules should expose:

- id
- input schema or validator
- permission requirement
- dry-run behavior when practical
- execution function
- structured result
- audit metadata

Initial tool folders should be:

- `src/tools/tasks/`
- `src/tools/commitments/`
- `src/tools/decisions/`
- `src/tools/people/`
- `src/tools/meetings/`
- `src/tools/calendar/`
- `src/tools/documents/`

Do not let tools call HTTP routes or manipulate UI state.

### Rituals Should Own Operating Workflows

Build in `src/rituals` when the code answers "what should the Chief of Staff do
with this situation?"

Each mature ritual should be self-contained:

```text
schema.mjs      expected input/output shape
prompt.mjs      model instructions and context packet shape
fallback.mjs    deterministic behavior when model use fails or is disabled
render.mjs      artifact formatting
run.mjs         orchestration of tools, providers, approvals, and artifacts
evals/          fixtures and regression cases
```

Rituals may call tools and providers. They should not perform raw filesystem
writes except through core or tools.

### Integrations Should Own External Adapters

Build in `src/integrations` when code adapts an external system.

Examples:

- `model-providers/ollama`
- `model-providers/openai-compatible`
- `calendar/ics`
- future `calendar/apple-calendar`
- future `reminders/apple-reminders`
- future `mail/gmail`
- future `mail/outlook`
- future `slack`

Adapters should be replaceable. They should expose simple operations to tools
or rituals, not leak provider APIs across the app.

### Server Should Stay Thin

Build in `src/server` only for request parsing, route composition, status
responses, and HTTP error handling.

Routes should:

- read request body
- call core, ritual, or tool functions
- return JSON

Routes should not contain business logic, prompt logic, policy exceptions, or
provider-specific code.

### Public UI Should Coordinate Human Attention

Build in `src/public` when the user needs to choose inputs, inspect output,
approve work, or continue a run.

The UI should emphasize:

- one obvious next action
- current workspace readiness
- active ritual run
- pending approvals
- open loops
- generated artifacts
- local/cloud provider status

Avoid adding panels just because new internals exist. The UI should compress
state into action.

## Coordination Should Happen Through Records And Run State

Coordination should not mean multiple agents freely editing shared state.
Coordination should mean each capability moves records through explicit states.

Use this lifecycle:

```text
input -> context packet -> ritual run -> tool calls -> approvals -> artifacts -> memory updates
```

Recommended state model:

- **Workspace records:** durable user context such as tasks, people, meetings,
  commitments, decisions, goals, and learning entries
- **Run records:** temporary but durable workflow state for a ritual execution
- **Approval records:** pause points that can resume known actions
- **Artifact records:** generated plans, briefs, exports, and documents
- **Audit records:** append-only history of important state changes

Rituals coordinate by reading records and producing run state. Tools coordinate
by changing records through known operations. Integrations coordinate by
executing approved adapter calls. The UI coordinates by helping the user choose
what happens next.

## Where To Build Each New Capability

Use this decision table before adding files:

| Capability | Build Location | Why |
| --- | --- | --- |
| Task creation, completion, status | `src/tools/tasks/` plus core store | Deterministic local state change |
| Commitment extraction from notes | `src/tools/commitments/` plus optional model call through ritual | Produces structured records from text |
| People lookup | `src/tools/people/` plus workspace people index | Deterministic retrieval |
| Meeting prep | `src/rituals/meeting-prep/` | Workflow combines people, meetings, decisions, and commitments |
| Weekly review | `src/rituals/weekly-review/` | Workflow summarizes progress and open loops |
| End-of-day review | `src/rituals/end-of-day-review/` | Workflow carries forward unfinished work |
| Approval execution | `src/core/approvals/`, `src/core/runs/`, and relevant tools | Resume known approved actions safely |
| Apple Calendar adapter | `src/integrations/calendar/apple-calendar/` plus calendar tool | External system adapter |
| Slack adapter | `src/integrations/slack/` plus message/follow-up tool | External internet adapter |
| UI for open loops | `src/public/` | Human attention and next action |
| Agent Builder template | Agent Builder repo, after standalone shape stabilizes | Generator should emit proven architecture |

## Coordination Rules For Future Contributors

1. **Start with the target record.**
   Before adding a feature, name the record it creates, reads, updates, or
   resolves.

2. **Add the deterministic tool before the ritual.**
   If a workflow needs to update tasks, build the task tool first. Then let the
   ritual call it.

3. **Keep model calls inside rituals or model-provider adapters.**
   Do not let tools silently call models unless the tool contract explicitly says
   it is a model-backed extraction tool.

4. **Treat approval as a state transition.**
   Approval should move a known action from pending to approved/rejected and
   optionally resume a run. It should not be a generic permission bypass.

5. **Make every external action adapter-backed.**
   Calendar, reminders, email, Slack, cloud LLMs, and filesystem automation all
   need adapters plus permission metadata.

6. **Prefer local JSON/Markdown until query pressure appears.**
   Add SQLite only when recurring queries, filtering, indexing, or concurrency
   make flat files painful.

7. **Add regression fixtures with each ritual.**
   A ritual without fixtures will drift as prompts and models change.

8. **Use the architecture boundary test as a guardrail.**
   If a new import violates the layer rules, the design is probably leaking.

## Milestones Should Be Capability-Based

### Milestone 1: Local Operating Memory

Goal: the app remembers and edits the core operating records.

Deliverables:

- task store and task tool
- commitment store and extraction tool
- people and meeting cache tools
- decision log tool
- learning ledger tool
- tests for path safety, overwrite safety, and record schema stability

### Milestone 2: Review Rituals

Goal: the app can help the user close loops and prepare for recurring reviews.

Deliverables:

- weekly review ritual
- end-of-day review ritual
- open-loop triage
- deterministic fallbacks
- Markdown artifacts written to the workspace
- eval fixtures for common operating scenarios

### Milestone 3: Meeting Prep

Goal: the app can prepare a useful briefing from local meeting and people
context.

Deliverables:

- meeting prep ritual
- local people lookup
- meeting cache retrieval
- related commitments and decisions
- prep artifact with agenda, context, risks, and proposed follow-ups

### Milestone 4: Executable Approvals

Goal: approved actions can safely resume and execute through known tools.

Deliverables:

- run store
- approval payload schema
- approval executor registry
- resume behavior
- audit entries for approval lifecycle
- tests proving unapproved actions do not execute

### Milestone 5: Optional System And Internet Adapters

Goal: useful external actions become possible without weakening local-first
safety.

Deliverables:

- Apple Calendar or `.ics` upgrade path
- Apple Reminders adapter
- cloud LLM provider controls
- Slack/Gmail/Outlook draft adapters
- explicit configuration checks
- approval and audit coverage

### Milestone 6: Agent Builder Generation

Goal: Agent Builder can generate this standalone app shape repeatably.

Deliverables:

- template manifest
- generated folder structure
- default safety policy
- default ritual/tool contracts
- smoke tests for generated apps

## Architecture Change Triggers

Change the architecture only when one of these pressures appears:

- **Many rituals need the same state access.**
  Add a core store or memory helper.

- **Many tools duplicate validation.**
  Add shared schemas or validators in core.

- **Approval flows need to pause and resume.**
  Add run state before adding more executor logic.

- **Flat files become hard to query.**
  Add SQLite or an index layer behind core store interfaces.

- **External adapters multiply.**
  Add adapter registries and capability metadata, not direct route branches.

- **UI becomes noisy.**
  Add a view model or summary endpoint that compresses state into next actions.

Do not change architecture just because a larger model can read more context or
because one workflow needs a one-off shortcut.

## The Coordination Mental Model

Think of Chief of Staff as a local operating loop:

```text
records give context
rituals decide what should happen
tools make safe local changes
approvals pause risky work
integrations execute approved external actions
artifacts explain what happened
audit logs preserve trust
```

When deciding where to build, ask:

1. Is this an invariant? Put it in `core`.
2. Is this a deterministic action? Put it in `tools`.
3. Is this an operating workflow? Put it in `rituals`.
4. Is this an external system? Put it in `integrations`.
5. Is this HTTP transport? Put it in `server`.
6. Is this human attention or input? Put it in `public`.
7. Is this repeatable generation of the app shape? Put it in Agent Builder.

That separation is the main thing that lets the app grow without becoming
fragile.

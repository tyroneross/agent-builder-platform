// Project storage layer. Owns the on-disk shape, v1→v2 migration, and the
// helpers the canvas uses to read/write projects. Pure module — no React.
//
// Storage shape (v2):
//   {
//     version: 2,
//     activeProjectId: string,
//     projects: [
//       {
//         id: string,
//         name: string,
//         workingFolder: string,   // absolute path or ""
//         createdAt: string,       // ISO
//         canvas: { nodes, edges, pan, zoom }
//       },
//       ...
//     ]
//   }

export const STORAGE_KEY_V1 = "agent-studio:v1";
export const STORAGE_KEY_V2 = "agent-studio:v2";
export const STORAGE_VERSION_V2 = 2;

// Seed graph reused by both new-project flow and v1 hydration default.
export const SEED_NODES = [
  {
    id: "intake",
    role: "agent",
    title: "Intake",
    description: "Normalize the user goal and identify missing inputs before routing.",
    instructions: "",
    x: 120,
    y: 200,
    w: 220,
    h: 130,
  },
  {
    id: "policy",
    role: "guardrail",
    title: "Policy gate",
    description: "Classify read, write, network, shell, and credential intent against permissions.",
    instructions: "",
    x: 400,
    y: 200,
    w: 220,
    h: 130,
  },
  {
    id: "orch",
    role: "orchestrator",
    title: "Orchestrator",
    description: "Choose the next action from the active tool pool.",
    instructions: "",
    x: 680,
    y: 200,
    w: 220,
    h: 130,
  },
  {
    id: "exec",
    role: "executor",
    title: "Executor",
    description: "Run approved reads or writes and return structured results.",
    instructions: "",
    x: 680,
    y: 380,
    w: 220,
    h: 130,
  },
  {
    id: "evalCheck",
    role: "eval",
    title: "Eval check",
    description: "Check output, permissions, and guardrail invariants.",
    instructions: "",
    x: 960,
    y: 290,
    w: 220,
    h: 130,
  },
];

export const SEED_EDGES = [
  { id: "intake->policy", from: "intake", to: "policy" },
  { id: "policy->orch", from: "policy", to: "orch" },
  { id: "orch->exec", from: "orch", to: "exec" },
  { id: "exec->evalCheck", from: "exec", to: "evalCheck" },
  { id: "orch->evalCheck", from: "orch", to: "evalCheck" },
];

export function makeProjectId() {
  // Short, sortable-ish, sufficient for a single-user local tool.
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function seedCanvas() {
  return {
    // Deep clone seeds so per-project mutations don't bleed across projects.
    nodes: SEED_NODES.map((n) => ({ ...n })),
    edges: SEED_EDGES.map((e) => ({ ...e })),
    pan: { x: 0, y: 0 },
    zoom: 1,
  };
}

export function makeProject({ name, workingFolder = "", canvas } = {}) {
  return {
    id: makeProjectId(),
    name: name || "Untitled project",
    workingFolder,
    createdAt: new Date().toISOString(),
    canvas: canvas || seedCanvas(),
  };
}

// Defensive normalization for a single node read from storage. Older saves
// predate the `instructions` field; default it to "" so panel inputs stay
// controlled.
function normalizeNode(n) {
  return typeof n.instructions === "string" ? n : { ...n, instructions: "" };
}

function normalizeCanvas(canvas) {
  if (!canvas || !Array.isArray(canvas.nodes) || !Array.isArray(canvas.edges)) {
    return seedCanvas();
  }
  const pan =
    canvas.pan && typeof canvas.pan.x === "number" && typeof canvas.pan.y === "number"
      ? canvas.pan
      : { x: 0, y: 0 };
  const zoom =
    typeof canvas.zoom === "number" && Number.isFinite(canvas.zoom) ? canvas.zoom : 1;
  return {
    nodes: canvas.nodes.map(normalizeNode),
    edges: canvas.edges,
    pan,
    zoom,
  };
}

// Try to read v2; if absent, try to migrate from v1; if neither exists,
// return null (caller seeds a default).
export function loadStore() {
  if (typeof window === "undefined") return null;
  // Prefer v2 if present.
  try {
    const rawV2 = window.localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (parsed && parsed.version === STORAGE_VERSION_V2 && Array.isArray(parsed.projects)) {
        return hydrateStore(parsed);
      }
      // Malformed v2 — fall through to v1 migration / fresh seed.
    }
  } catch (err) {
    console.warn("[agent-studio] failed to read v2 store:", err);
  }

  // One-time migration from v1.
  try {
    const rawV1 = window.localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const v1 = JSON.parse(rawV1);
      if (v1 && Array.isArray(v1.nodes) && Array.isArray(v1.edges)) {
        const canvas = normalizeCanvas({
          nodes: v1.nodes,
          edges: v1.edges,
          pan: v1.pan,
          zoom: v1.zoom,
        });
        const project = makeProject({ name: "Default", workingFolder: "", canvas });
        const store = {
          version: STORAGE_VERSION_V2,
          activeProjectId: project.id,
          projects: [project],
        };
        // Persist v2 immediately and leave v1 in place — only v2 is read going forward,
        // so v1 becomes dead state we don't need to delete (and keeping it lets a user
        // recover if migration ever produced something they didn't want).
        writeStore(store);
        return store;
      }
    }
  } catch (err) {
    console.warn("[agent-studio] failed to migrate v1 store:", err);
  }

  return null;
}

// Validate + repair a parsed v2 store. Guarantees at least one project and a
// valid activeProjectId pointing at one of them.
function hydrateStore(parsed) {
  const projects = parsed.projects
    .filter((p) => p && typeof p.id === "string" && typeof p.name === "string")
    .map((p) => ({
      id: p.id,
      name: p.name,
      workingFolder: typeof p.workingFolder === "string" ? p.workingFolder : "",
      createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date().toISOString(),
      canvas: normalizeCanvas(p.canvas),
    }));

  if (projects.length === 0) {
    const fallback = makeProject({ name: "Default" });
    return {
      version: STORAGE_VERSION_V2,
      activeProjectId: fallback.id,
      projects: [fallback],
    };
  }

  const activeId = projects.some((p) => p.id === parsed.activeProjectId)
    ? parsed.activeProjectId
    : projects[0].id;

  return {
    version: STORAGE_VERSION_V2,
    activeProjectId: activeId,
    projects,
  };
}

export function writeStore(store) {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      version: STORAGE_VERSION_V2,
      activeProjectId: store.activeProjectId,
      projects: store.projects,
    };
    window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(payload));
  } catch (err) {
    console.warn("[agent-studio] failed to persist v2 store:", err);
  }
}

export function clearStore() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY_V2);
  } catch (err) {
    console.warn("[agent-studio] failed to clear v2 store:", err);
  }
}

// Pure helpers for the reducer-style updates page.js performs.
export function withProjectUpdated(store, projectId, updater) {
  return {
    ...store,
    projects: store.projects.map((p) => (p.id === projectId ? updater(p) : p)),
  };
}

export function withCanvasUpdated(store, projectId, canvasPatch) {
  return withProjectUpdated(store, projectId, (p) => ({
    ...p,
    canvas: { ...p.canvas, ...canvasPatch },
  }));
}

export function getActiveProject(store) {
  return store.projects.find((p) => p.id === store.activeProjectId) ?? store.projects[0] ?? null;
}

// "/Users/..." | "/tmp/..." | "/var/folders/..." (the three paths the API will
// actually serve). Used both server-side (the route) and client-side (passive
// hint, before the round-trip).
export const PERMITTED_PATH_PREFIXES = ["/Users/", "/tmp/", "/var/folders/"];

export function looksAbsolutePath(value) {
  return typeof value === "string" && value.startsWith("/");
}

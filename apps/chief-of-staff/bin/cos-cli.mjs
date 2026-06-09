import process from "node:process";
import { createInterface } from "node:readline/promises";
import { createAppServer } from "../src/server.mjs";

const VERSION = "chief-of-staff 0.1.0";
const DEFAULT_PORT = 3031;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PROVIDER = "ollama";
const REQUEST_TIMEOUT_MS = 10000;
const PLAN_TIMEOUT_MS = 190000;

function printHelp() {
  console.log(`Chief of Staff

Usage:
  cos                       Start the local Chief of Staff browser app
  cos start                 Start the local Chief of Staff browser app
  cos status                Show brief runtime state
  cos talk                  Open the terminal CoS console
  cos --port 3032           Start or connect on a different port
  cos --host 0.0.0.0        Bind the server to a different host
  cos --help                Show this help
  cos --version             Show the CLI version

Terminal console:
  Plain text                Run the daily planning ritual with that text as the goal
  /status                   Show runtime state
  /models                   Show configured model state
  /approvals                Show pending approvals
  /plan <goal>              Run the daily planning ritual
  /note <context>           Add context for later terminal plans
  /clear                    Clear terminal context notes
  /quit                     Exit

Model options:
  --model <name>            Use a specific model for terminal plans
  --provider <id>           Model provider for terminal plans, default: ollama
  --no-model                Force deterministic local fallback mode

Environment:
  PORT                      Default server port
  HOST                      Default server host
  COS_BASE_URL              Existing CoS server URL for status/talk
  COS_WORKSPACE_DIR         Workspace directory for local state
  COS_MODEL                 Model name for terminal plans
  COS_MODEL_PROVIDER        Model provider for terminal plans
`);
}

export function parseArgs(args, env = process.env) {
  const options = {
    command: "start",
    host: env.HOST || DEFAULT_HOST,
    port: Number(env.PORT || DEFAULT_PORT),
    baseUrl: env.COS_BASE_URL || "",
    provider: env.COS_MODEL_PROVIDER || DEFAULT_PROVIDER,
    model: env.COS_MODEL || "",
    useModel: env.COS_USE_MODEL !== "0",
    autoStart: true,
    date: env.COS_PLAN_DATE || new Date().toISOString().slice(0, 10),
    json: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (["start", "status", "talk"].includes(arg)) {
      options.command = arg;
    } else if (arg === "help" || arg === "--help" || arg === "-h") {
      options.command = "help";
    } else if (arg === "version" || arg === "--version" || arg === "-v") {
      options.command = "version";
    } else if (arg === "--port" || arg === "-p") {
      i += 1;
      options.port = Number(args[i]);
    } else if (arg.startsWith("--port=")) {
      options.port = Number(arg.slice("--port=".length));
    } else if (arg === "--host") {
      i += 1;
      options.host = args[i];
    } else if (arg.startsWith("--host=")) {
      options.host = arg.slice("--host=".length);
    } else if (arg === "--base-url") {
      i += 1;
      options.baseUrl = args[i];
    } else if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length);
    } else if (arg === "--provider") {
      i += 1;
      options.provider = args[i];
    } else if (arg.startsWith("--provider=")) {
      options.provider = arg.slice("--provider=".length);
    } else if (arg === "--model") {
      i += 1;
      options.model = args[i];
      options.useModel = true;
    } else if (arg.startsWith("--model=")) {
      options.model = arg.slice("--model=".length);
      options.useModel = true;
    } else if (arg === "--no-model") {
      options.useModel = false;
      options.model = "";
    } else if (arg === "--no-start") {
      options.autoStart = false;
    } else if (arg === "--date") {
      i += 1;
      options.date = args[i];
    } else if (arg.startsWith("--date=")) {
      options.date = arg.slice("--date=".length);
    } else if (arg === "--json") {
      options.json = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error(`invalid port: ${options.port}`);
  }
  if (!options.host) throw new Error("host is required");
  options.baseUrl ||= serverBaseUrl(options);
  return options;
}

function serverBaseUrl({ host, port }) {
  const urlHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  return `http://${urlHost}:${port}`;
}

function notify(state, message) {
  console.log(`[${state}] ${message}`);
}

function truncate(text, max = 96) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}...` : compact;
}

async function api(baseUrl, path, { method = "GET", body, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL(path, baseUrl), {
      method,
      signal: controller.signal,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.error || `request failed: ${response.status}`);
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`request timed out: ${path}`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function getHealth(baseUrl) {
  try {
    return { online: true, health: await api(baseUrl, "/api/health", { timeoutMs: 1500 }) };
  } catch (error) {
    return { online: false, error: error.message };
  }
}

function startServer({ host, port }, { announce = true } = {}) {
  const server = createAppServer();
  const url = serverBaseUrl({ host, port });

  return new Promise((resolve, reject) => {
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        reject(new Error(`port ${port} is already in use. Try: cos --port ${port + 1}`));
      } else {
        reject(error);
      }
    });

    server.listen(port, host, () => {
      if (announce) console.log(`Chief of Staff running at ${url}`);
      resolve({ server, url });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function runtimeSnapshot(options) {
  const health = await getHealth(options.baseUrl);
  if (!health.online) {
    return {
      online: false,
      url: options.baseUrl,
      error: health.error,
    };
  }

  const [vault, approvals, models] = await Promise.allSettled([
    api(options.baseUrl, "/api/vault/status"),
    api(options.baseUrl, "/api/approvals"),
    api(options.baseUrl, `/api/models?provider=${encodeURIComponent(options.provider)}`),
  ]);

  const approvalItems = approvals.status === "fulfilled" ? approvals.value.approvals || [] : [];
  const pendingApprovals = approvalItems.filter((item) => item.status === "pending");

  return {
    online: true,
    url: options.baseUrl,
    workspace: vault.status === "fulfilled"
      ? {
          ready: vault.value.ready,
          missing: Object.entries(vault.value.files || [])
            .filter(([, exists]) => !exists)
            .map(([file]) => file),
        }
      : { ready: false, error: vault.reason.message },
    approvals: approvals.status === "fulfilled"
      ? { pending: pendingApprovals.length, total: approvalItems.length }
      : { pending: null, total: null, error: approvals.reason.message },
    models: models.status === "fulfilled"
      ? {
          provider: models.value.id,
          label: models.value.label,
          recommended: models.value.recommended || "",
          count: (models.value.models || []).length,
          error: models.value.error || "",
        }
      : { provider: options.provider, recommended: "", count: 0, error: models.reason.message },
  };
}

function formatSnapshot(snapshot) {
  if (!snapshot.online) {
    return [
      `CoS runtime: offline`,
      `url: ${snapshot.url}`,
      `error: ${snapshot.error}`,
      `start: cos`,
      `terminal console: cos talk`,
    ].join("\n");
  }

  const workspace = snapshot.workspace.ready
    ? "ready"
    : `not ready${snapshot.workspace.missing?.length ? ` (${snapshot.workspace.missing.length} missing files)` : ""}`;
  const approvals = snapshot.approvals.error
    ? `unknown (${snapshot.approvals.error})`
    : `${snapshot.approvals.pending} pending / ${snapshot.approvals.total} total`;
  const models = snapshot.models.error
    ? `${snapshot.models.provider}: unavailable (${snapshot.models.error})`
    : `${snapshot.models.provider}: ${snapshot.models.count} model(s)${snapshot.models.recommended ? `, recommended ${snapshot.models.recommended}` : ""}`;

  return [
    `CoS runtime: online`,
    `url: ${snapshot.url}`,
    `workspace: ${workspace}`,
    `approvals: ${approvals}`,
    `models: ${models}`,
  ].join("\n");
}

async function runStatus(options) {
  const snapshot = await runtimeSnapshot(options);
  console.log(options.json ? JSON.stringify(snapshot, null, 2) : formatSnapshot(snapshot));
  return snapshot.online ? 0 : 1;
}

async function ensureTalkRuntime(options) {
  notify("connecting", options.baseUrl);
  const health = await getHealth(options.baseUrl);
  if (health.online) return { ownedServer: null };
  if (!options.autoStart) throw new Error(`CoS is not reachable at ${options.baseUrl}`);

  notify("starting", `local CoS server on ${serverBaseUrl(options)}`);
  const started = await startServer(options, { announce: false });
  options.baseUrl = started.url;
  return { ownedServer: started.server };
}

async function resolveModelForPlans(options) {
  if (!options.useModel) return { useModel: false, provider: options.provider, model: "" };
  if (options.model) return { useModel: true, provider: options.provider, model: options.model };

  try {
    const provider = await api(options.baseUrl, `/api/models?provider=${encodeURIComponent(options.provider)}`, { timeoutMs: 6000 });
    if (provider.recommended) {
      return { useModel: true, provider: options.provider, model: provider.recommended };
    }
    return { useModel: false, provider: options.provider, model: "", reason: provider.error || "no model found" };
  } catch (error) {
    return { useModel: false, provider: options.provider, model: "", reason: error.message };
  }
}

function printPlanBrief(result) {
  const plan = result.plan || {};
  console.log("");
  console.log(`Summary: ${plan.summary || "No summary returned."}`);
  const priorities = (plan.topPriorities || []).slice(0, 3);
  if (priorities.length) {
    console.log("Top priorities:");
    priorities.forEach((item, index) => {
      console.log(`${index + 1}. ${item.outcome}${item.why ? ` - ${item.why}` : ""}`);
    });
  }
  if (plan.followUps?.length) console.log(`Follow-ups: ${plan.followUps.length}`);
  if (plan.risks?.length) console.log(`Risks: ${plan.risks.length}`);
  if (plan.approvalsNeeded?.length) console.log(`Approvals queued: ${plan.approvalsNeeded.length}`);
  if (result.document?.path) console.log(`Document: ${result.document.path}`);
  console.log("");
}

async function runPlanFromTerminal(options, modelState, goal, contextNotes) {
  const notes = contextNotes.length ? contextNotes.join("\n\n") : "";
  const modelNote = modelState.useModel ? `${modelState.provider}/${modelState.model}` : "deterministic local mode";
  notify("running", `${modelNote}: ${truncate(goal)}`);
  const result = await api(options.baseUrl, "/api/plan/daily", {
    method: "POST",
    timeoutMs: PLAN_TIMEOUT_MS,
    body: {
      date: options.date,
      goal,
      notes,
      scheduleText: "",
      provider: modelState.provider,
      model: modelState.model,
      useModel: modelState.useModel,
    },
  });
  if (modelState.useModel && result.fallback) {
    notify("fallback", "model unavailable; returned deterministic plan");
  } else {
    notify("done", result.fallback ? "deterministic daily plan complete" : "daily plan complete");
  }
  printPlanBrief(result);
}

async function printModels(options) {
  const models = await api(options.baseUrl, `/api/models?provider=${encodeURIComponent(options.provider)}`);
  if (models.error) {
    console.log(`${models.id}: unavailable (${models.error})`);
    return;
  }
  console.log(`${models.id}: ${models.models.length} model(s)`);
  if (models.recommended) console.log(`recommended: ${models.recommended}`);
  for (const model of models.models.slice(0, 8)) console.log(`- ${model.name}`);
}

async function printApprovals(options) {
  const data = await api(options.baseUrl, "/api/approvals");
  const pending = (data.approvals || []).filter((item) => item.status === "pending");
  if (!pending.length) {
    console.log("No pending approvals.");
    return;
  }
  console.log(`${pending.length} pending approval(s):`);
  for (const item of pending) console.log(`- ${item.id}: ${item.title}`);
}

function printTalkHelp() {
  console.log([
    "Commands:",
    "  /status       Show runtime state",
    "  /models       Show model state",
    "  /approvals    Show pending approvals",
    "  /plan <goal>  Run a daily plan",
    "  /note <text>  Add context for later plans",
    "  /clear        Clear terminal context notes",
    "  /quit         Exit",
    "Plain text also runs a daily plan.",
  ].join("\n"));
}

async function runTalk(options) {
  const { ownedServer } = await ensureTalkRuntime(options);
  const contextNotes = [];
  let rl;

  try {
    notify("initializing", "workspace");
    await api(options.baseUrl, "/api/vault/init", { method: "POST" });
    const snapshot = await runtimeSnapshot(options);
    notify("ready", `${snapshot.workspace.ready ? "workspace ready" : "workspace not ready"}; ${snapshot.approvals.pending ?? 0} pending approvals`);

    const modelState = await resolveModelForPlans(options);
    if (modelState.useModel) notify("model", `using ${modelState.provider}/${modelState.model}`);
    else notify("model", `deterministic local mode${modelState.reason ? ` (${modelState.reason})` : ""}`);

    printTalkHelp();
    rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.on("SIGINT", () => {
      process.stdout.write("\n");
      rl.close();
    });

    while (true) {
      let line;
      try {
        line = await rl.question("cos> ");
      } catch {
        break;
      }
      const text = line.trim();
      if (!text) continue;
      if (text === "/quit" || text === "quit" || text === "exit") break;
      if (text === "/help" || text === "help") {
        printTalkHelp();
      } else if (text === "/status") {
        console.log(formatSnapshot(await runtimeSnapshot(options)));
      } else if (text === "/models") {
        await printModels(options);
      } else if (text === "/approvals") {
        await printApprovals(options);
      } else if (text === "/clear") {
        contextNotes.length = 0;
        notify("context", "cleared");
      } else if (text.startsWith("/note ")) {
        contextNotes.push(text.slice("/note ".length).trim());
        notify("context", `${contextNotes.length} note(s) stored for this terminal session`);
      } else if (text.startsWith("/plan ")) {
        await runPlanFromTerminal(options, modelState, text.slice("/plan ".length).trim(), contextNotes);
      } else {
        await runPlanFromTerminal(options, modelState, text, contextNotes);
      }
    }
  } finally {
    if (rl) rl.close();
    if (ownedServer) {
      notify("stopping", "terminal-owned CoS server");
      await closeServer(ownedServer);
    }
  }
}

async function runStart(options) {
  const { server } = await startServer(options);
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      server.close(() => process.exit(0));
    });
  }
}

export async function main(args = process.argv.slice(2)) {
  try {
    const options = parseArgs(args);
    if (options.command === "help") {
      printHelp();
    } else if (options.command === "version") {
      console.log(VERSION);
    } else if (options.command === "status") {
      process.exitCode = await runStatus(options);
    } else if (options.command === "talk") {
      await runTalk(options);
    } else {
      await runStart(options);
    }
  } catch (error) {
    console.error(error.message);
    console.error("Run `cos --help` for usage.");
    process.exitCode = 1;
  }
}

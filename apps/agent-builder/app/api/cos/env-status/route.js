// Returns ONLY booleans about which cloud-provider keys are present in the
// server's environment. Never echoes the key values themselves — that's the
// security boundary this endpoint exists for.
//
// The UI uses this to surface the GROQ-key-detected indicator next to the
// cloud controls. Keys are read at request time (not module load) so dev-mode
// hot reload picks up env changes without a server restart.

export const runtime = "nodejs";
// Do not cache — env can change between requests in dev.
export const dynamic = "force-dynamic";

function present(name) {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

export function GET() {
  const body = {
    groq: present("GROQ_API_KEY"),
    anthropic: present("ANTHROPIC_API_KEY"),
    openai: present("OPENAI_API_KEY"),
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

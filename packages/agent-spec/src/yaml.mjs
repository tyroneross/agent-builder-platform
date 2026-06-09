// Extracted verbatim from agent-builder/lib/generator.js#toYaml (+ quoteYaml).
// Minimal deterministic YAML serializer for agent specs. Single source of truth.

function quoteYaml(value) {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "null";
  const text = String(value);
  if (!text) return '""';
  if (/^[a-zA-Z0-9_./:-]+$/.test(text)) return text;
  return JSON.stringify(text);
}

export function toYaml(value, indent = 0) {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          const rendered = toYaml(item, indent + 2);
          return `${pad}- ${rendered.trimStart()}`;
        }
        return `${pad}- ${quoteYaml(item)}`;
      })
      .join("\n");
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return "{}";
    return entries
      .map(([key, item]) => {
        if (Array.isArray(item)) {
          return item.length ? `${pad}${key}:\n${toYaml(item, indent + 2)}` : `${pad}${key}: []`;
        }
        if (item && typeof item === "object") {
          return `${pad}${key}:\n${toYaml(item, indent + 2)}`;
        }
        return `${pad}${key}: ${quoteYaml(item)}`;
      })
      .join("\n");
  }

  return `${pad}${quoteYaml(value)}`;
}

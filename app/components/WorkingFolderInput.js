"use client";

import { useEffect, useRef, useState } from "react";
import { PERMITTED_PATH_PREFIXES, looksAbsolutePath } from "../lib/projects";

// Working folder input for the active project.
//
// Three input modes, all converging on the same setter:
//   1. Type / paste an absolute path. Validation hits /api/fs/validate after
//      a short debounce. Inline status: green check (exists+dir+writable),
//      amber dot (exists but not writable, or not a directory), red X
//      (rejected / missing), or no-badge (empty).
//   2. Browse — <input type="file" webkitdirectory />. We use the picker's
//      metadata only to surface the folder name as a hint; the picker does
//      not expose the absolute filesystem path in standard browsers, so we
//      never pretend it set the path.
//   3. Drag and drop a directory onto the drop zone. Same browser limitation
//      as Browse: we can only read names, never absolute paths.
export default function WorkingFolderInput({ value, onChange }) {
  const [draft, setDraft] = useState(value ?? "");
  const [status, setStatus] = useState({ kind: "idle" }); // idle | checking | ok | warn | error
  const [hint, setHint] = useState("");
  const debounceRef = useRef(null);
  const dropRef = useRef(null);

  // Keep draft in sync with the active project's stored value (e.g. on project switch).
  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  // Validate against /api/fs/validate after typing settles.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!draft) {
      setStatus({ kind: "idle" });
      setHint("");
      return;
    }
    if (!looksAbsolutePath(draft)) {
      setStatus({ kind: "warn" });
      setHint("must be absolute path (start with /)");
      return;
    }
    if (!PERMITTED_PATH_PREFIXES.some((prefix) => draft.startsWith(prefix))) {
      setStatus({ kind: "warn" });
      setHint("path outside permitted root (/Users, /tmp, /var/folders)");
      return;
    }
    setStatus({ kind: "checking" });
    setHint("");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/fs/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: draft }),
        });
        const data = await res.json();
        if (!data.ok) {
          setStatus({ kind: "error" });
          setHint(data.error || "rejected");
          return;
        }
        if (!data.exists) {
          setStatus({ kind: "error" });
          setHint("path does not exist");
          return;
        }
        if (!data.isDirectory) {
          setStatus({ kind: "warn" });
          setHint("path is not a directory");
          return;
        }
        if (!data.writable) {
          setStatus({ kind: "warn" });
          setHint("directory is not writable");
          return;
        }
        setStatus({ kind: "ok" });
        setHint("ready");
      } catch (err) {
        setStatus({ kind: "error" });
        setHint(err?.message || "validation failed");
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft]);

  function commit(next) {
    setDraft(next);
    onChange(next);
  }

  function onBrowsePicked(e) {
    // The picker hands us a FileList of files inside the chosen folder. Most
    // browsers expose only the relative path (folderName/sub/file). We can read
    // the top folder name but not its absolute location.
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const first = files[0];
    const rel = first.webkitRelativePath || "";
    const folderName = rel.split("/")[0] || "";
    if (folderName) {
      // No absolute path is possible here, so we surface the hint and *do not*
      // overwrite the user's typed path. We just nudge them.
      setHint(`Browser only revealed folder name "${folderName}". Paste the absolute path manually.`);
    }
    // Reset the input so the same folder can be picked again.
    e.target.value = "";
  }

  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current) dropRef.current.classList.add("is-drop-hover");
  }
  function onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current) dropRef.current.classList.remove("is-drop-hover");
  }
  async function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current) dropRef.current.classList.remove("is-drop-hover");
    const items = e.dataTransfer?.items;
    if (items && items.length > 0) {
      // We can read the dropped item's name, but standard browsers do NOT
      // expose its absolute filesystem path. Match the Browse behavior.
      const first = items[0];
      const entry = typeof first.webkitGetAsEntry === "function" ? first.webkitGetAsEntry() : null;
      const name = entry?.name || first.getAsFile?.()?.name || "";
      if (name) {
        setHint(`Browser only revealed name "${name}". Paste the absolute path manually.`);
      }
    }
  }

  const badge =
    status.kind === "ok" ? <span className="wf-badge wf-ok" title="Validated">✓</span> :
    status.kind === "warn" ? <span className="wf-badge wf-warn" title={hint}>!</span> :
    status.kind === "error" ? <span className="wf-badge wf-error" title={hint}>✕</span> :
    status.kind === "checking" ? <span className="wf-badge wf-check" title="Checking…">…</span> :
    null;

  return (
    <div className="wf">
      <span className="panel-label">Working folder</span>
      <div className="wf-row">
        <input
          className="panel-input wf-input"
          type="text"
          value={draft}
          placeholder="/Users/you/path/to/project"
          onChange={(e) => commit(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          data-working-folder-input
        />
        {badge}
      </div>
      <div className="wf-actions">
        <label className="tool-btn wf-browse" data-working-folder-browse>
          browse
          <input
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            style={{ display: "none" }}
            onChange={onBrowsePicked}
            data-working-folder-browse-input
          />
        </label>
        <div
          className="wf-drop"
          ref={dropRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          data-working-folder-drop
        >
          drag a folder here
        </div>
      </div>
      <p className="wf-hint">
        {hint
          ? hint
          : "Browser security only reveals the folder name. To set a working path, paste the absolute path manually (Mac Finder: Cmd-Option-C, then paste)."}
      </p>
      <style jsx>{`
        .wf {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .wf-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .wf-input {
          flex: 1;
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          font-size: 12px;
        }
        .panel-label {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .panel-input {
          width: 100%;
          padding: 8px 10px;
          font-family: inherit;
          font-size: 13px;
          color: var(--ink);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          outline: none;
          transition: border-color 100ms ease, box-shadow 100ms ease;
        }
        .panel-input:hover {
          border-color: var(--border-strong);
        }
        .panel-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .wf-badge {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }
        .wf-ok { background: var(--accent-soft); color: var(--accent-strong); }
        .wf-warn { background: var(--policy-soft); color: var(--policy); }
        .wf-error { background: var(--danger-soft); color: var(--danger); }
        .wf-check { background: var(--surface); color: var(--muted); border: 1px solid var(--border); }
        .wf-actions {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }
        .wf-browse {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          cursor: pointer;
          height: 32px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          font-size: 13px;
          color: var(--ink);
          font-family: inherit;
        }
        .wf-browse:hover {
          border-color: var(--accent);
          color: var(--accent-strong);
        }
        .wf-drop {
          flex: 1;
          border: 1px dashed var(--border-strong);
          border-radius: 8px;
          padding: 8px 10px;
          text-align: center;
          font-size: 12px;
          color: var(--muted);
          cursor: copy;
          transition: border-color 100ms ease, background 100ms ease;
        }
        .wf-drop.is-drop-hover {
          border-color: var(--accent);
          background: var(--accent-soft);
          color: var(--accent-strong);
        }
        .wf-hint {
          font-size: 11px;
          color: var(--faint);
          margin: 0;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}

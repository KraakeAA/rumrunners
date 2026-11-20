"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

type Item = { id: string; title: string; body: string; authorName: string; createdAt: string };

const bar: CSSProperties = {
  padding: "6px 8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 15,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};
const box: CSSProperties = {
  border: "1px solid #6b5d3a",
  borderTop: 0,
  background: "#1f2a25",
  padding: "8px 10px",
  fontSize: 13,
  lineHeight: 1.45
};
const field: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "6px 8px",
  border: "1px solid #a08340",
  borderRadius: 0,
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16,
  fontFamily: "inherit"
};

export default function UpdatesSection() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/updates", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error ?? "Updates could not be loaded.");
        return;
      }
      setItems(d.updates);
      setIsAdmin(Boolean(d.isAdmin));
    } catch {
      setErr("Updates could not be loaded.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send(payload: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "That could not be saved.");
      else {
        after?.();
        load();
      }
    } catch {
      setErr("That could not be saved.");
    }
    setBusy(false);
  }

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Updates</div>
      {err && <p className="notice" style={{ color: "#f09a8c" }}>{err}</p>}

      {isAdmin && (
        <div style={{ ...box, display: "grid", gap: 6 }}>
          <input value={title} maxLength={100} placeholder="Title" onChange={(e) => setTitle(e.target.value)} style={field} />
          <textarea value={body} rows={4} maxLength={5000} placeholder="What has changed?" onChange={(e) => setBody(e.target.value)} style={{ ...field, resize: "vertical" }} />
          <button
            type="button"
            className="button"
            disabled={busy || title.trim().length < 3 || body.trim().length < 3}
            onClick={() => send({ title, body }, () => { setTitle(""); setBody(""); })}
            style={{ padding: "6px 12px", fontSize: 13 }}
          >
            Post update
          </button>
        </div>
      )}

      {items === null ? (
        !err && <p className="flavour">Loading…</p>
      ) : items.length === 0 ? (
        <div style={{ ...box, color: "#b7ad93" }}>No updates yet.</div>
      ) : (
        items.map((u) => (
          <div key={u.id} style={box}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <strong style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{u.title}</strong>
              <span style={{ fontSize: 11, color: "#b7ad93", flexShrink: 0 }}>
                {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginTop: 4 }}>{u.body}</div>
            <div style={{ fontSize: 11, color: "#b7ad93", marginTop: 4 }}>
              {u.authorName}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => send({ action: "delete", id: u.id })}
                  style={{ marginLeft: 10, background: "none", border: 0, color: "#e4c04d", textDecoration: "underline", cursor: "pointer", fontSize: 11 }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

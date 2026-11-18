"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

type Hit = { username: string; rank: string; alive: boolean; online: boolean };

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
const box: CSSProperties = { border: "1px solid #6b5d3a", background: "#1f2a25", padding: "6px 8px" };
const input: CSSProperties = {
  height: 32,
  width: "100%",
  boxSizing: "border-box",
  padding: "0 8px",
  border: "1px solid #a08340",
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16
};

export default function FindPlayerSection() {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"any" | "alive" | "dead">("any");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function find(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/players/search?q=${encodeURIComponent(name.trim())}&status=${status}`,
        { cache: "no-store" }
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(String(d.error ?? "The search failed."));
        return;
      }
      setHits(d.players ?? []);
      setMore(Boolean(d.more));
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const choice = (value: "any" | "alive" | "dead", text: string, colour?: string) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 13, color: colour }}>
      <input type="radio" name="status" checked={status === value} onChange={() => setStatus(value)} />
      {text}
    </label>
  );

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      {more && (
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#c9bfa6" }}>
          More than 10 results were found. Only the first 10 are shown.
        </p>
      )}

      <div style={bar}>Find Player</div>
      <form onSubmit={find} style={{ ...box, borderTop: 0, display: "grid", gap: 6 }}>
        <input
          style={input}
          placeholder="Name"
          aria-label="Player name"
          autoCapitalize="none"
          autoCorrect="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div>
          {choice("any", "Any")}
          {choice("alive", "Alive")}
          {choice("dead", "Dead", "#e08f7f")}
        </div>
        <div style={{ textAlign: "center" }}>
          <button type="submit" className="button" style={{ padding: "6px 24px", fontSize: 14, opacity: busy ? 0.55 : 1 }} disabled={busy}>
            {busy ? "Searching…" : "Find!"}
          </button>
        </div>
        {error && <p className="notice" style={{ margin: 0, color: "#f09a8c" }}>{error}</p>}
      </form>

      {hits && (
        <div style={{ marginTop: 8 }}>
          <div style={bar}>Results</div>
          {hits.length === 0 ? (
            <div style={{ ...box, borderTop: 0, fontSize: 13, color: "#c9bfa6" }}>No players found.</div>
          ) : (
            hits.map((h) => (
              <a
                key={h.username}
                href={`/profile/${encodeURIComponent(h.username)}`}
                style={{
                  ...box,
                  borderTop: 0,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  color: "#f1e8d3",
                  textDecoration: "none",
                  fontSize: 14
                }}
              >
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{h.username}</span>
                <span style={{ fontSize: 11, color: "#b7ad93", flexShrink: 0 }}>
                  {h.rank} ·{" "}
                  <span style={{ color: h.alive ? (h.online ? "#00ff00" : "#b7ad93") : "#e08f7f" }}>
                    {h.alive ? (h.online ? "Online" : "Offline") : "Dead"}
                  </span>
                </span>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}

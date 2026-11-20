"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Grave = { name: string; rank: string; diedAt: string; killedBy: string | null; revived: boolean };

const bar: CSSProperties = {
  padding: "6px 8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 16,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};
const box: CSSProperties = { border: "1px solid #6b5d3a", background: "#1f2a25", padding: "7px 9px", fontSize: 13 };

export default function GraveyardSection() {
  const [graves, setGraves] = useState<Grave[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/graveyard", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) setError(String(d.error ?? "The graveyard could not be reached."));
        else setGraves(d.graves ?? []);
      })
      .catch(() => setError("Unable to connect. Please try again."));
  }, []);

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Graveyard</div>
      <div style={{ ...box, borderTop: 0, color: "#c9bfa6", fontSize: 12 }}>
        Those who have fallen. Death is final: a name that comes back starts again from nothing.
      </div>
      {error && <p className="notice" style={{ color: "#f09a8c" }}>{error}</p>}
      {!graves && !error && <div style={{ ...box, borderTop: 0, color: "#b7ad93" }}>Loading…</div>}
      {graves && graves.length === 0 && (
        <div style={{ ...box, borderTop: 0, color: "#c9bfa6" }}>Nobody has died yet.</div>
      )}
      {graves?.map((g) => (
        <div key={g.name} style={{ ...box, borderTop: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <strong style={{ fontFamily: "Georgia, serif", overflowWrap: "anywhere" }}>† {g.name}</strong>
            <span style={{ fontSize: 11, color: "#b7ad93", flexShrink: 0 }}>{g.rank}</span>
          </div>
          <div style={{ fontSize: 12, color: "#b7ad93" }}>
            {g.killedBy === "suicide" ? "Took their own life" : g.killedBy ? `Shot by ${g.killedBy}` : "Cause unknown"} ·{" "}
            {new Date(g.diedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            {g.revived ? " · name revived" : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useState, type CSSProperties } from "react";

type Life = { id: string; username: string; rank: string; diedAt: string; killedBy: string | null };

const bar: CSSProperties = {
  padding: "6px 8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 15,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #7a2a22, #3d1511)",
  borderTop: "1px solid #b0504a",
  borderBottom: "1px solid #b0504a",
  textShadow: "0 1px 2px #000"
};
const box: CSSProperties = { border: "1px solid #6b5d3a", background: "#1f2a25", padding: "8px 10px" };
const input: CSSProperties = {
  height: 34,
  width: "100%",
  boxSizing: "border-box",
  padding: "0 8px",
  border: "1px solid #a08340",
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16
};

export default function DeadScreen({
  name,
  rank,
  gold,
  killedBy,
  lives
}: {
  name: string;
  rank: string;
  gold: number;
  killedBy: string | null;
  lives: Life[];
}) {
  const [newName, setNewName] = useState("");
  const [pick, setPick] = useState(lives[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go(body: Record<string, string>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/rebirth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(d.error ?? "That could not be completed."));
        setBusy(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Unable to connect. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "16px 10px", color: "#f1e8d3" }}>
      <div style={bar}>YOU ARE DEAD</div>

      <div style={{ ...box, borderTop: 0, textAlign: "center" }}>
        <p style={{ margin: "0 0 6px", fontSize: 14 }}>
          <strong>{name}</strong>, {rank}, is gone.
          {killedBy === "suicide" ? " Took their own life." : killedBy ? ` Shot down by ${killedBy}.` : ""}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#c9bfa6" }}>
          Everything is lost: rank, cash, cars, kit and all. Only your gold survives
          {gold > 0 ? ` (${gold.toLocaleString("en-GB")}).` : "."}
        </p>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ ...bar, background: "linear-gradient(180deg, #8a7038, #4d3d1c)", borderColor: "#b0904a" }}>
          Start again with a new name
        </div>
        <div style={{ ...box, borderTop: 0, display: "grid", gap: 8 }}>
          <input
            style={input}
            placeholder="New username"
            aria-label="New username"
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={18}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            type="button"
            className="button"
            disabled={busy || newName.trim().length < 3}
            onClick={() => go({ mode: "new", username: newName.trim() })}
          >
            Begin a new life
          </button>
        </div>
      </div>

      {lives.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ ...bar, background: "linear-gradient(180deg, #8a7038, #4d3d1c)", borderColor: "#b0904a" }}>
            Or revive a previous name
          </div>
          <div style={{ ...box, borderTop: 0, display: "grid", gap: 8 }}>
            <select style={input} aria-label="Previous names" value={pick} onChange={(e) => setPick(e.target.value)}>
              {lives.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.username} (was {l.rank})
                </option>
              ))}
            </select>
            <button type="button" className="button secondary" disabled={busy || !pick} onClick={() => go({ mode: "revive", id: pick })}>
              Revive this name
            </button>
            <p style={{ margin: 0, fontSize: 11, color: "#b7ad93" }}>
              A revived name starts from scratch like any new life.
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="notice" role="alert" style={{ marginTop: 8, color: "#f09a8c" }}>
          {error}
        </p>
      )}

      <p style={{ textAlign: "center", marginTop: 14 }}>
        <a href="/logout" style={{ color: "#b7ad93", fontSize: 12 }}>Sign out</a>
      </p>
    </main>
  );
}

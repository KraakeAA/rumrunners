"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { clock } from "@/components/EnergyBar";

type Inmate = {
  username: string;
  rank: string;
  reason: string;
  security: number;
  remaining: number;
  crewName?: string | null;
  crewColor?: string | null;
};

type Me = {
  remaining: number;
  reason: string | null;
  security: number;
  selfBustUsed: boolean;
};

type BustStats = {
  wins: number;
  fails: number;
  streak: number;
  best: number;
  worst: number;
  milestones: { number: number; freed: string; date: string }[];
};

const bar: CSSProperties = {
  padding: "3px 8px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontFamily: "Georgia, serif",
  fontSize: 13,
  lineHeight: 1.25,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000",
};

const stars = (n: number) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

const hms = (secs: number) =>
  [Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");

const mins = (secs: number) =>
  secs >= 3600
    ? `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
    : secs >= 60
      ? `${Math.ceil(secs / 60)}m`
      : `${secs}s`;

export default function JailSection({ onChanged }: { onChanged: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [inmates, setInmates] = useState<Inmate[]>([]);
  const [stats, setStats] = useState<BustStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [good, setGood] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/game/jail", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setMe(d.me);
      setStats(d.bustStats ?? null);
      setInmates(d.inmates ?? []);
      setTick(0);
    } catch {
      /* keep what we have */
    }
  }, []);

  useEffect(() => {
    load();
    const poll = window.setInterval(load, 30000);
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(t);
    };
  }, [load]);

  async function act(body: object) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/game/jail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      setGood(Boolean(d.success));
      setMessage(d.message || d.error || "");
    } catch {
      setGood(false);
      setMessage("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
      await load();
      onChanged();
    }
  }

  const myLeft = me ? Math.max(0, me.remaining - tick) : 0;
  const locked = myLeft > 0;

  const chip: CSSProperties = {
    padding: "3px 9px",
    border: "1px solid #6b5d3a",
    background: "#17201c",
    color: "#f7efdb",
    fontSize: 11,
    textDecoration: "none",
  };

  // Locked up: a page of its own. The game sends every action here.
  if (locked && me) {
    const others = inmates.filter((i) => Math.max(0, i.remaining - tick) > 0);
    return (
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
        <div style={bar}>
          <span style={{ flex: 1, textAlign: "center" }}>You are in jail!</span>
        </div>

        <div style={{ border: "1px solid #6b5d3a", borderTop: 0, background: "#1f2a25", textAlign: "center", padding: "6px 8px 8px" }}>
          <div style={{ fontSize: 12, color: "#b7ad93" }}>{me.reason ?? "Sentenced"}</div>
          <div style={{ fontSize: 12, color: "#c9bfa6", marginTop: 6 }}>Time Remaining</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: "#f7efdb", letterSpacing: 2, lineHeight: 1.1 }}>
            {hms(myLeft)}
          </div>
          <div style={{ color: "#e4c04d", fontSize: 16, letterSpacing: 3, margin: "0 0 4px" }}>
            {stars(me.security)}
          </div>

          <div style={{ background: "#17201c", border: "1px solid #2b3630", padding: "8px 10px" }}>
            <div style={{ fontSize: 13, color: "#f1e8d3" }}>
              {me.selfBustUsed
                ? "You've already tried to break out of this sentence."
                : "Try to break out. You only get one attempt."}
            </div>
            <button
              type="button"
              className="button"
              disabled={busy || me.selfBustUsed}
              onClick={() => act({ action: "self" })}
              style={{ marginTop: 6, width: "70%", padding: "7px 0", fontSize: 13, opacity: busy || me.selfBustUsed ? 0.55 : 1 }}
            >
              {me.selfBustUsed ? "Escape tried" : "Break out"}
            </button>
            {!me.selfBustUsed && (
              <div style={{ fontSize: 11, color: "#b7ad93", marginTop: 4 }}>
                If the guards catch you, time is added to your sentence.
              </div>
            )}
          </div>
        </div>

        {message && (
          <p className="notice" style={{ color: good ? "#7fe08f" : "#f1e8d3" }}>
            {message}
          </p>
        )}

        <div style={{ ...bar, marginTop: 6 }}>
          <span style={{ flex: 1, textAlign: "center" }}>Other inmates</span>
        </div>
        <div
          style={{
            border: "1px solid #6b5d3a",
            borderTop: 0,
            background: "#1f2a25",
            padding: 8,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            justifyContent: "center",
          }}
        >
          {others.filter((i) => i.username !== undefined).length === 0 && (
            <span style={{ fontSize: 12, color: "#b7ad93" }}>Nobody else is inside.</span>
          )}
          {others.map((i) => (
            <Link key={i.username} href={`/profile/${encodeURIComponent(i.username)}`} style={chip}>
              {i.username}
            </Link>
          ))}
        </div>

        <p style={{ fontSize: 11, color: "#b7ad93", textAlign: "center", margin: "8px 0 0" }}>
          Crimes, thefts, casino games and the railway are shut to you until you are free. You can
          still use the menu for stats and information pages.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>
        <span style={{ flex: 1, textAlign: "center" }}>Pentonville Prison</span>
      </div>

      {message && (
        <p className="notice" style={{ color: good ? "#7fe08f" : "#f1e8d3" }}>
          {message}
        </p>
      )}

      <div style={{ ...bar, marginTop: 6 }}>
        <span style={{ flex: 1, textAlign: "center" }}>Inmates ({inmates.length})</span>
        <button
          type="button"
          aria-label="Refresh"
          onClick={load}
          style={{ background: "none", border: 0, color: "#f7efdb", fontSize: 16, cursor: "pointer" }}
        >
          ⟳
        </button>
      </div>

      <div style={{ border: "1px solid #6b5d3a", borderTop: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "3px 8px",
            fontSize: 10,
            color: "#d9b45f",
            background: "#26322c",
            borderBottom: "1px solid #6b5d3a",
          }}
        >
          <span>Name</span>
          <span style={{ marginRight: 74 }}>Security ▾</span>
        </div>

        {inmates.length === 0 && (
          <div style={{ padding: 12, textAlign: "center", fontSize: 12, color: "#b7ad93" }}>
            The cells are empty.
          </div>
        )}

        {inmates.map((i) => {
          const left = Math.max(0, i.remaining - tick);
          if (left <= 0) return null;
          return (
            <div
              key={i.username}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 64px",
                borderBottom: "1px solid #6b5d3a",
                background: "#1c2621",
              }}
            >
              <div style={{ minWidth: 0, padding: "3px 6px", display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                    <Link
                      href={`/profile/${encodeURIComponent(i.username)}`}
                      style={{
                        color: "#f7efdb",
                        fontSize: 11,
                        textDecoration: "none",
                        padding: "1px 6px",
                        border: "1px solid #6b5d3a",
                        background: "#2a332e",
                        borderRadius: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "100%",
                      }}
                    >
                      {i.username}
                    </Link>
                    {i.crewName && (
                      <span
                        title={i.crewName}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: 9,
                          color: "#d4cab2",
                          minWidth: 0,
                        }}
                      >
                        <span style={{ width: 8, height: 8, flexShrink: 0, background: i.crewColor || "#6b5d3a", border: "1px solid #000" }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.crewName}</span>
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      lineHeight: 1.3,
                      color: "#b7ad93",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {i.reason}
                  </div>
                </div>

                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ color: "#e4c04d", fontSize: 10, letterSpacing: 0.5, lineHeight: 1.2 }}>{stars(i.security)}</div>
                  <div style={{ fontSize: 10, color: "#c9bfa6", lineHeight: 1.2 }}>{mins(left)}</div>
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => act({ action: "bust", username: i.username })}
                style={{
                  border: 0,
                  borderLeft: "1px solid #6b5d3a",
                  background: "#232d28",
                  color: "#f7efdb",
                  fontSize: 11,
                  cursor: "pointer",
                  opacity: busy ? 0.55 : 1,
                }}
              >
                Bust Out!
              </button>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 10, color: "#b7ad93", textAlign: "center", margin: "6px 0 0" }}>
        Higher security means longer odds, and if you fail you end up inside yourself.
      </p>

      {stats && (
        <>
          <div style={{ ...bar, marginTop: 8 }}>
            <span style={{ flex: 1, textAlign: "center" }}>Your Statistics</span>
          </div>
          <div style={{ border: "1px solid #6b5d3a", borderTop: 0 }}>
            {(() => {
              const total = stats.wins + stats.fails;
              const pct = (n: number) => (total > 0 ? ((n / total) * 100).toFixed(1) : "0.0");
              const rows: [string, string, boolean][] = [
                ["Successful:", `${stats.wins.toLocaleString("en-GB")} (${pct(stats.wins)}%)`, false],
                ["Failed:", `${stats.fails.toLocaleString("en-GB")} (${pct(stats.fails)}%)`, false],
                ["Total:", total.toLocaleString("en-GB"), false],
                ["Current Streak:", String(stats.streak), stats.streak < 0],
                ["Best Streak:", String(stats.best), false],
                ["Worst Streak:", String(stats.worst), false]
              ];
              return rows.map(([label, value, bad], i) => (
                <div
                  key={label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "34% 1fr",
                    borderTop: i === 0 ? 0 : "1px solid #6b5d3a",
                    fontSize: 11
                  }}
                >
                  <div style={{ padding: "3px 6px", background: "#2a382f", borderRight: "1px solid #6b5d3a", color: "#f1e8d3" }}>{label}</div>
                  <div style={{ padding: "3px 6px", background: bad ? "#523b3b" : "#222e27", color: "#f1e8d3" }}>{value}</div>
                </div>
              ));
            })()}
          </div>

          <div style={{ ...bar, marginTop: 8 }}>
            <span style={{ flex: 1, textAlign: "center" }}>Milestone Busts</span>
          </div>
          <div style={{ border: "1px solid #6b5d3a", borderTop: 0, fontSize: 11 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "18% 1fr 30%",
                padding: "3px 8px",
                fontWeight: 400,
                background: "#2a382f",
                borderBottom: "1px solid #6b5d3a"
              }}
            >
              <span>Bust</span>
              <span style={{ textAlign: "center" }}>Username</span>
              <span style={{ textAlign: "right" }}>Date</span>
            </div>
            {stats.milestones.length === 0 && (
              <div style={{ padding: 8, textAlign: "center", fontSize: 12, color: "#b7ad93", background: "#222e27" }}>
                No milestone busts yet. Your 1st, 10th, 25th, 50th and 100th are recorded here.
              </div>
            )}
            {stats.milestones.map((m) => (
              <div
                key={m.number}
                style={{ display: "grid", gridTemplateColumns: "18% 1fr 30%", padding: "3px 8px", background: "#222e27", borderTop: "1px solid #2b3630" }}
              >
                <span>{m.number.toLocaleString("en-GB")}</span>
                <span style={{ textAlign: "center" }}>
                  <Link href={`/profile/${encodeURIComponent(m.freed)}`} style={{ color: "#f7efdb", textDecoration: "none" }}>
                    {m.freed}
                  </Link>
                </span>
                <span style={{ textAlign: "right" }}>{m.date}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

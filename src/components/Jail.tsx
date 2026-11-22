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
  username?: string;
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

const bustBtn: CSSProperties = {
  flexShrink: 0,
  padding: "3px 10px",
  border: "1px solid #b0904a",
  borderRadius: 3,
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  color: "#f7efdb",
  fontSize: 11,
  cursor: "pointer",
};

const hms = (secs: number) =>
  [Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");

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
  // Anyone still inside, with you always at the top.
  const visible = inmates
    .filter((i) => Math.max(0, i.remaining - tick) > 0)
    .sort((a, b) => Number(b.username === me?.username) - Number(a.username === me?.username));

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>
        <span style={{ flex: 1, textAlign: "center" }}>Pentonville Prison</span>
      </div>

      {message && (
        <div
          role="status"
          style={{
            margin: "4px 0 0",
            padding: "3px 8px",
            fontSize: 12,
            lineHeight: 1.3,
            color: "#f1e8d3",
            background: "#1f2a25",
            border: "1px solid #6b5d3a",
            borderLeft: `3px solid ${good ? "#5fae6b" : "#b0603f"}`
          }}
        >
          {message}
        </div>
      )}

      <div style={{ ...bar, marginTop: 4 }}>
        <span style={{ flex: 1, textAlign: "center" }}>Inmates ({visible.length})</span>
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
        {visible.length === 0 && (
          <div style={{ padding: 10, textAlign: "center", fontSize: 12, color: "#b7ad93" }}>
            The cells are empty.
          </div>
        )}

        {visible.map((i) => (
          <div
            key={i.username}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "3px 8px",
              borderBottom: "1px solid #2b3630",
              background: "#1c2621",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              {i.crewColor ? (
                <span
                  title={i.crewName ?? undefined}
                  style={{ width: 9, height: 9, flexShrink: 0, background: i.crewColor }}
                />
              ) : null}
              <Link
                href={`/profile/${encodeURIComponent(i.username)}`}
                style={{
                  color: "#f7efdb",
                  fontSize: 12,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {i.username}
              </Link>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: "#c9bfa6", fontVariantNumeric: "tabular-nums" }}>
                {hms(Math.max(0, i.remaining - tick))}
              </span>
              {i.username === me?.username ? (
                <button
                  type="button"
                  disabled={busy || !!me?.selfBustUsed}
                  onClick={() => act({ action: "self" })}
                  style={{ ...bustBtn, opacity: busy || !!me?.selfBustUsed ? 0.55 : 1 }}
                >
                  {me?.selfBustUsed ? "Tried" : "Break out"}
                </button>
              ) : !locked ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act({ action: "bust", username: i.username })}
                  style={{ ...bustBtn, opacity: busy ? 0.55 : 1 }}
                >
                  Bust out
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </div>

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

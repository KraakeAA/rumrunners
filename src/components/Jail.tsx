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
};

type Me = {
  remaining: number;
  reason: string | null;
  security: number;
  selfBustUsed: boolean;
};

const bar: CSSProperties = {
  padding: "6px 8px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontFamily: "Georgia, serif",
  fontSize: 15,
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
    fontSize: 13,
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

        <div style={{ border: "1px solid #6b5d3a", borderTop: 0, background: "#1f2a25", textAlign: "center", padding: "10px 10px 12px" }}>
          <div style={{ fontSize: 12, color: "#b7ad93" }}>{me.reason ?? "Sentenced"}</div>
          <div style={{ fontSize: 12, color: "#c9bfa6", marginTop: 6 }}>Time Remaining</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 38, color: "#f7efdb", letterSpacing: 2, lineHeight: 1.1 }}>
            {hms(myLeft)}
          </div>
          <div style={{ color: "#e4c04d", fontSize: 22, letterSpacing: 3, margin: "2px 0 8px" }}>
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
            padding: "4px 8px",
            fontSize: 11,
            color: "#b7ad93",
            background: "#161d19",
            borderBottom: "1px solid #6b5d3a",
          }}
        >
          <span>Name</span>
          <span style={{ marginRight: 74 }}>Security</span>
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
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 8px",
                background: "#17201c",
                borderBottom: "1px solid #2b3630",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  href={`/profile/${encodeURIComponent(i.username)}`}
                  style={{ color: "#f7efdb", fontSize: 14, textDecoration: "none", fontWeight: 600 }}
                >
                  {i.username}
                </Link>
                <div
                  style={{
                    fontSize: 11,
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
                <div style={{ color: "#e4c04d", fontSize: 12, letterSpacing: 1 }}>{stars(i.security)}</div>
                <div style={{ fontSize: 11, color: "#c9bfa6" }}>{mins(left)}</div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => act({ action: "bust", username: i.username })}
                style={{
                  flexShrink: 0,
                  alignSelf: "stretch",
                  width: 78,
                  margin: "-5px -8px -5px 0",
                  border: 0,
                  borderLeft: "1px solid #6b5d3a",
                  background: "linear-gradient(180deg, #2f4a3c, #1a2b22)",
                  color: "#f7efdb",
                  fontFamily: "Georgia, serif",
                  fontSize: 13,
                  cursor: "pointer",
                  opacity: busy ? 0.55 : 1,
                }}
              >
                Bust out!
              </button>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: "#b7ad93", textAlign: "center", margin: "8px 0 0" }}>
        Higher security means longer odds, and if you fail you end up inside yourself.
      </p>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { GameImage } from "@/components/GameImage";

type Session = { key: string; name: string; energy: number; xp: number };
type Stat = {
  key: "strength" | "stamina" | "agility";
  label: string;
  blurb: string;
  level: number;
  into: number;
  needed: number;
  maxed: boolean;
  sessions: Session[];
};
type Data = {
  jailed: boolean;
  maxLevel: number;
  stats: Stat[];
  perks: { energySaved: number; jailBonus: number };
};

const GOLD = "#c69a48";
const IVORY = "#e8dcc0";

const ICONS: Record<Stat["key"], string> = { strength: "🏋", stamina: "🏃", agility: "🤸" };

const bar: CSSProperties = {
  padding: "7px 8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 16,
  letterSpacing: 0.5,
  color: IVORY,
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};

export default function GymnasiumSection({
  onEnergy,
  onLevels
}: {
  onEnergy: (energy: number) => void;
  onLevels: (levels: { strength: number; stamina: number; agility: number }) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [good, setGood] = useState(false);
  const [active, setActive] = useState<Stat["key"]>("strength");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/gym", { cache: "no-store" });
      if (!r.ok) return;
      const d: Data = await r.json();
      setData(d);
      onLevels({
        strength: d.stats.find((s) => s.key === "strength")?.level ?? 0,
        stamina: d.stats.find((s) => s.key === "stamina")?.level ?? 0,
        agility: d.stats.find((s) => s.key === "agility")?.level ?? 0
      });
    } catch {
      /* keep what is on screen */
    }
  }, [onLevels]);

  useEffect(() => {
    load();
  }, [load]);

  async function train(stat: string, session: string) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/gym", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stat, session })
      });
      const j = await r.json().catch(() => ({}));
      setGood(r.ok);
      setMessage(r.ok ? String(j.message ?? "Done.") : String(j.error ?? "That did not work."));
      if (r.ok && typeof j.energy === "number") onEnergy(j.energy);
      await load();
    } catch {
      setGood(false);
      setMessage("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
        <div style={bar}>Gymnasium</div>
        <p className="flavour">Loading…</p>
      </div>
    );
  }

  const s = data.stats.find((x) => x.key === active) ?? data.stats[0];
  const perk =
    s.key === "stamina"
      ? `${data.perks.energySaved}% less energy on crimes and auto theft`
      : s.key === "agility"
        ? `+${data.perks.jailBonus}% chance when breaking out of jail`
        : s.blurb;
  const pct = s.maxed ? 100 : Math.min(100, Math.round((s.into / Math.max(1, s.needed)) * 100));

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Gymnasium</div>

      {/* The three stats, as tabs with their levels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4, marginTop: 6 }}>
        {data.stats.map((x) => {
          const on = x.key === active;
          return (
            <button
              key={x.key}
              type="button"
              onClick={() => setActive(x.key)}
              style={{
                padding: "6px 2px",
                border: on ? "1px solid #f0dfa8" : "1px solid #6b5d3a",
                background: on ? "linear-gradient(180deg, #8a7038, #4d3d1c)" : "#1a221e",
                color: on ? "#f7efdb" : "#b7ad93",
                cursor: "pointer",
                lineHeight: 1.2
              }}
            >
              <span style={{ display: "block", fontSize: 15 }}>{ICONS[x.key]}</span>
              <span style={{ display: "block", fontSize: 11 }}>{x.label}</span>
              <span style={{ display: "block", fontSize: 10, color: on ? "#f7efdb" : GOLD }}>Lv {x.level}</span>
            </button>
          );
        })}
      </div>

      {message && (
        <p
          style={{
            margin: "6px 0 0",
            padding: "6px 8px",
            fontSize: 12,
            textAlign: "center",
            border: `1px solid ${good ? "#6b5d3a" : "#6b3a33"}`,
            background: good ? "#171d1a" : "#2e1d1a",
            color: good ? "#e3d3a8" : "#f09a8c"
          }}
        >
          {message}
        </p>
      )}

      <div style={{ marginTop: 6, border: "1px solid #6b5d3a", background: "#1a221e" }}>
        {/* Picture banner with the level over it */}
        <div style={{ position: "relative", height: 92, borderBottom: "1px solid #6b5d3a", overflow: "hidden" }}>
          <GameImage slot={`gym/${s.key}`} width="100%" height={92} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              padding: "6px 8px",
              background: "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.75))",
              pointerEvents: "none"
            }}
          >
            <span style={{ fontFamily: "Georgia, serif", fontSize: 17, color: IVORY, textShadow: "0 2px 4px #000" }}>
              {s.label}
            </span>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 13, color: IVORY, textShadow: "0 2px 4px #000" }}>
              Level <strong style={{ fontSize: 20 }}>{s.level}</strong> / {data.maxLevel}
            </span>
          </div>
        </div>

        {/* Progress to next level */}
        <div style={{ padding: "6px 8px 4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#b7ad93", marginBottom: 3 }}>
            <span>{s.maxed ? "Fully trained" : "Next level"}</span>
            <span>{s.maxed ? "MAX" : `${s.into.toLocaleString("en-GB")} / ${s.needed.toLocaleString("en-GB")} xp`}</span>
          </div>
          <div style={{ height: 12, background: "#0e1411", border: "1px solid #6b5d3a", position: "relative" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(180deg, #d9b55c, ${GOLD})` }} />
            <span
              style={{
                position: "absolute",
                inset: 0,
                textAlign: "center",
                fontSize: 9,
                lineHeight: "11px",
                fontWeight: 700,
                color: "#fff",
                textShadow: "0 1px 1px #000"
              }}
            >
              {pct}%
            </span>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: "#b7ad93", textAlign: "center", fontStyle: "italic" }}>{perk}</div>
        </div>

        {/* The four sessions as cards */}
        {!data.jailed && !s.maxed && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: "4px 8px 8px" }}>
            {s.sessions.map((x) => (
              <div
                key={x.key}
                style={{ border: "1px solid #3d4a41", background: "#171d1a", padding: "5px 6px", textAlign: "center" }}
              >
                <div style={{ fontSize: 12, color: IVORY, marginBottom: 2 }}>{x.name}</div>
                <div style={{ fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: "#e3d3a8" }}>+{x.xp} xp</span>
                  <span style={{ color: "#6b5d3a" }}> · </span>
                  <span style={{ color: "#b7ad93" }}>{x.energy} energy</span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => train(s.key, x.key)}
                  style={{
                    width: "100%",
                    padding: "5px 0",
                    border: "1px solid #a08340",
                    borderRadius: 3,
                    background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
                    color: IVORY,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    cursor: "pointer",
                    opacity: busy ? 0.55 : 1
                  }}
                >
                  Train
                </button>
              </div>
            ))}
          </div>
        )}
        {data.jailed && (
          <p style={{ margin: 0, padding: "4px 8px 8px", fontSize: 11, color: "#b7ad93", textAlign: "center" }}>
            There is no training behind bars.
          </p>
        )}
      </div>
    </div>
  );
}

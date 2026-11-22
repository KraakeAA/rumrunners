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
const trainBtn: CSSProperties = {
  minWidth: 62,
  padding: "6px 10px",
  border: "1px solid #a08340",
  borderRadius: 3,
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  color: IVORY,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.5,
  cursor: "pointer"
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

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Gymnasium</div>
      <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
        {message && (
          <p className="notice" style={{ margin: "2px 0", color: good ? "#7fe08f" : "#f09a8c" }}>
            {message}
          </p>
        )}

        {data.stats.map((s) => {
          const perk =
            s.key === "stamina"
              ? `${data.perks.energySaved}% less energy on crimes and auto theft`
              : s.key === "agility"
                ? `+${data.perks.jailBonus}% chance when breaking out of jail`
                : null;
          const pct = s.maxed ? 100 : Math.min(100, Math.round((s.into / Math.max(1, s.needed)) * 100));
          return (
            <div key={s.key} style={{ border: "1px solid #6b5d3a", background: "#1a221e" }}>
              <div style={{ ...bar, fontSize: 14, padding: "4px 8px" }}>{s.label}</div>
              <div style={{ display: "flex", alignItems: "stretch" }}>
                <div style={{ position: "relative", width: 104, flexShrink: 0, borderRight: "1px solid #6b5d3a" }}>
                  <GameImage slot={`gym/${s.key}`} width={104} height="100%" />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "Georgia, serif",
                      color: IVORY,
                      textShadow: "0 2px 4px #000",
                      pointerEvents: "none"
                    }}
                  >
                    <span style={{ fontSize: 12 }}>Level</span>
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{s.level}</span>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {!data.jailed && !s.maxed && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", padding: "3px 6px", background: "#161d19", color: "#d9b45f", fontSize: 11, fontWeight: 600 }}>
                        <span style={{ flex: 1 }}>Exercise</span>
                        <span style={{ width: 40, textAlign: "center" }}>XP</span>
                        <span style={{ width: 34, textAlign: "center" }}>⚡</span>
                        <span style={{ width: 70 }} />
                      </div>
                      {s.sessions.map((x) => (
                        <div
                          key={x.key}
                          style={{ display: "flex", alignItems: "center", padding: "5px 6px", borderTop: "1px solid #6b5d3a", fontSize: 12 }}
                        >
                          <span style={{ flex: 1, minWidth: 0, color: IVORY }}>{x.name}</span>
                          <span style={{ width: 40, textAlign: "center", color: "#9be39f" }}>+{x.xp}</span>
                          <span style={{ width: 34, textAlign: "center", color: "#e4c04d" }}>{x.energy}</span>
                          <span style={{ width: 70, textAlign: "right" }}>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => train(s.key, x.key)}
                              style={{ ...trainBtn, opacity: busy ? 0.55 : 1 }}
                            >
                              Train
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ padding: "4px 6px", fontSize: 11, color: "#b7ad93", borderTop: "1px solid #6b5d3a" }}>
                    {s.maxed
                      ? "Fully trained."
                      : `Next level: ${s.into.toLocaleString("en-GB")} / ${s.needed.toLocaleString("en-GB")} xp`}
                    {perk && <div style={{ color: "#9be39f" }}>{perk}</div>}
                  </div>
                  <div style={{ margin: "0 6px 5px", height: 12, background: "#0e1411", border: "1px solid #6b5d3a", position: "relative" }}>
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
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

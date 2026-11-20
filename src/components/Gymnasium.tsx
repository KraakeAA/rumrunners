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
  guns: { name: string; strength: number; unlocked: boolean }[];
};

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
const box: CSSProperties = { border: "1px solid #6b5d3a", background: "#1f2a25", padding: "8px 10px", fontSize: 13 };

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
  const [pick, setPick] = useState<{ stat: string; session: string } | null>(null);

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
        <div style={{ ...box, color: "#c9bfa6", fontSize: 12 }}>
          Training costs energy only. Pick a session: the harder ones give more xp for the energy. Every stat
          tops out at level {data.maxLevel}, and a new life starts again from nothing.
        </div>

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
            <div key={s.key} style={{ border: "1px solid #6b5d3a", background: "#1f2a25" }}>
              <div style={{ ...bar, fontSize: 14, padding: "4px 8px" }}>{s.label}</div>
              <div style={{ display: "flex", alignItems: "stretch" }}>
                <div style={{ position: "relative", width: 104, flexShrink: 0, borderRight: "1px solid #3d4a41" }}>
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
                      color: "#f7efdb",
                      textShadow: "0 2px 4px #000",
                      pointerEvents: "none"
                    }}
                  >
                    <span style={{ fontSize: 12 }}>Level</span>
                    <span style={{ fontSize: 26, lineHeight: 1 }}>{s.level}</span>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {!data.jailed && !s.maxed && (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#2a3630", color: "#d8cfb8" }}>
                          <th style={{ textAlign: "left", padding: "3px 6px", fontWeight: 600 }}>Exercise</th>
                          <th style={{ width: 38, padding: "3px 2px", background: "#243b27" }}>XP</th>
                          <th style={{ width: 38, padding: "3px 2px", background: "#3b2b27" }}>⚡</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.sessions.map((x) => {
                          const on = pick?.stat === s.key && pick.session === x.key;
                          return (
                            <tr
                              key={x.key}
                              onClick={() => setPick({ stat: s.key, session: x.key })}
                              style={{
                                cursor: "pointer",
                                background: on ? "#3a2f20" : "transparent",
                                borderTop: "1px solid #34402f"
                              }}
                            >
                              <td style={{ padding: "5px 6px", color: "#f7efdb" }}>
                                <input
                                  type="radio"
                                  name="exercise"
                                  checked={on}
                                  onChange={() => setPick({ stat: s.key, session: x.key })}
                                  style={{ marginRight: 6, verticalAlign: "middle" }}
                                />
                                {x.name}
                              </td>
                              <td style={{ textAlign: "center", background: "#1c2d20", color: "#9be39f" }}>+{x.xp}</td>
                              <td style={{ textAlign: "center", background: "#2d211e", color: "#e4c04d" }}>{x.energy}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  <div style={{ padding: "4px 6px", fontSize: 11, color: "#b7ad93", borderTop: "1px solid #34402f" }}>
                    {s.maxed
                      ? "Fully trained."
                      : `Required xp for next level: ${s.into.toLocaleString("en-GB")} / ${s.needed.toLocaleString("en-GB")}`}
                    {perk && <div style={{ color: "#9be39f" }}>{perk}</div>}
                  </div>
                  <div style={{ margin: "0 6px 5px", height: 12, background: "#0e1411", border: "1px solid #34402f", position: "relative" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(180deg, #3fae45, #1f6b27)" }} />
                    <span
                      style={{
                        position: "absolute",
                        inset: 0,
                        textAlign: "center",
                        fontSize: 9,
                        lineHeight: "11px",
                        color: "#f7efdb"
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

        {!data.jailed && (
          <div style={{ textAlign: "center", margin: "2px 0" }}>
            <button
              type="button"
              className="button"
              style={{ padding: "7px 26px", fontSize: 14, opacity: busy || !pick ? 0.55 : 1 }}
              disabled={busy || !pick}
              onClick={() => pick && train(pick.stat, pick.session)}
            >
              Work out!
            </button>
          </div>
        )}

        <div style={{ ...bar, marginTop: 6 }}>Guns and the Strength they need</div>
        <div style={box}>
          {data.guns.map((g) => (
            <div
              key={g.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                padding: "3px 0",
                color: g.unlocked ? "#f7efdb" : "#8f8a76"
              }}
            >
              <span>{g.name}</span>
              <span style={{ color: g.unlocked ? "#9be39f" : "#e4c04d", flexShrink: 0 }}>
                {g.unlocked ? "Can hold" : `Strength ${g.strength}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

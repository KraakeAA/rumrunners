"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

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

// A row of 30 blocks: one for every level, the current one part filled.
function LevelBar({ level, fraction, max }: { level: number; fraction: number; max: number }) {
  return (
    <div style={{ display: "flex", gap: 2, height: 14 }} aria-label={`Level ${level} of ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < level;
        const partial = i === level;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 0,
              background: "#0e1411",
              border: `1px solid ${filled || partial ? "#8a7038" : "#34402f"}`,
              position: "relative",
              overflow: "hidden"
            }}
          >
            {(filled || partial) && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: filled ? "100%" : `${Math.round(fraction * 100)}%`,
                  background: "linear-gradient(180deg, #c9a653, #8a7038)"
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

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
          return (
            <div key={s.key} style={box}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: "Georgia, serif", fontSize: 16, color: "#f7efdb" }}>{s.label}</span>
                <strong style={{ color: "#e4c04d", fontSize: 15 }}>
                  Level {s.level} / {data.maxLevel}
                </strong>
              </div>
              <div style={{ fontSize: 12, color: "#b7ad93", margin: "2px 0 6px" }}>
                {s.blurb}
                {perk && <div style={{ color: "#9be39f" }}>{perk}</div>}
              </div>

              <LevelBar level={s.level} fraction={s.into / s.needed} max={data.maxLevel} />
              <div style={{ fontSize: 11, color: "#8f8a76", margin: "3px 0 8px" }}>
                {s.maxed
                  ? "Fully trained"
                  : `${s.into.toLocaleString("en-GB")} / ${s.needed.toLocaleString("en-GB")} xp to level ${s.level + 1}`}
              </div>

              {!data.jailed && !s.maxed && (
                <div style={{ display: "grid", gap: 4 }}>
                  {s.sessions.map((x) => (
                    <div
                      key={x.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "4px 6px",
                        background: "#17201c",
                        border: "1px solid #34402f"
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "#f7efdb" }}>{x.name}</div>
                        <div style={{ fontSize: 11, color: "#b7ad93" }}>
                          ⚡{x.energy} · +{x.xp} xp
                        </div>
                      </div>
                      <button
                        className="button"
                        style={{ padding: "5px 14px", fontSize: 12, flexShrink: 0, opacity: busy ? 0.55 : 1 }}
                        disabled={busy}
                        onClick={() => train(s.key, x.key)}
                      >
                        Train
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

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

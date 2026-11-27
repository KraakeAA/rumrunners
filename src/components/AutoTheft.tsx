"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CARS, MAX_THEFT_CHANCE, THEFT_COOLDOWNS, THEFT_LEVELS, theftChance } from "@/lib/era";
import { rankForLevel } from "@/lib/ranks";
import { energyCostFor } from "@/lib/training";

type TheftResult = {
  success: boolean;
  car: { key: string; name: string; maker: string; year: string; speed: number; boot: number; price: number; tier: number; scrap: number; note: string };
  place: string;
  city: string;
  chance: number;
  heat: number;
  plate: string;
  damage: number;
  fine: number;
  jailSeconds?: number;
  notices?: string[];
  xpGained: number;
  leveledUp: boolean;
  energy: number;
  money: number;
  experience: number;
  rank: string;
  rankLevel: number;
};

type Props = {
  rankLevel: number;
  energy: number;
  staminaLevel?: number;
  theftLeft: (level: number) => number;
  jailLeft: number;
  isAdmin?: boolean;
  onActed: () => void;
  currentCity: string;
  onResult: (r: {
    energy: number;
    money: number;
    experience: number;
    rank: string;
    rankLevel: number;
  }) => void;
};

const panel: CSSProperties = {
  background: "#1f2a25",
  border: "1px solid #6b5d3a",
  marginBottom: 6,
  color: "#f1e8d3",
  fontSize: 12,
};
const barStyle: CSSProperties = {
  padding: "3px 8px",
  textAlign: "center",
  fontWeight: 700,
  fontSize: 13,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderBottom: "1px solid #b0904a",
};
const btn: CSSProperties = {
  padding: "6px 12px",
  border: "1px solid #b0904a",
  borderRadius: 3,
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  color: "#f7efdb",
  fontSize: 13,
  cursor: "pointer",
};

// The car picture. Drop transparent art into public/images/cars/<car key>.png (or .webp).
function CarArt({ carKey, name }: { carKey: string; name: string }) {
  const [attempt, setAttempt] = useState(0);
  const files = [`${carKey}.png`, `${carKey}.webp`];
  if (attempt >= files.length) {
    return (
      <div
        style={{
          height: 150,
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "#7d765f",
        }}
      >
        {name}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/images/cars/${files[attempt]}`}
      alt={name}
      onError={() => setAttempt((a) => a + 1)}
      style={{ display: "block", width: "100%", maxHeight: 300, objectFit: "contain", textShadow: "none" }}
    />
  );
}

const POPUP_MS = 8000;

// Full-screen pop-up after a theft: the car large on the dimmed page, then what you took.
// Tap anywhere to close.
function TheftPopup({ result, onClose }: { result: TheftResult; onClose: () => void }) {
  // Kept in a ref so the page redrawing never restarts the timer.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const end = window.setTimeout(() => closeRef.current(), POPUP_MS);
    return () => window.clearTimeout(end);
  }, [result]);

  const good = result.success;
  const shadow = "0 2px 6px #000, 0 0 14px #000";

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-label={good ? "Car stolen" : "Caught"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        background: "rgba(0, 0, 0, 0.8)",
        textAlign: "center",
        color: "#fff",
        textShadow: shadow,
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <CarArt carKey={result.car.key} name={result.car.name} />
      </div>

      {good ? (
        <>
          <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>You stole a</div>
          <div style={{ margin: "6px 0", fontSize: 28, lineHeight: 1.1, fontWeight: 800 }}>{result.car.name}</div>
          <div style={{ fontSize: 15 }}>It has {result.damage}% damage</div>
          <div style={{ marginTop: 3, fontSize: 12, color: "#d9cfb4" }}>
            from {result.place} · +{result.xpGained} XP{result.leveledUp ? ` · Promoted to ${result.rank}!` : ""}
          </div>
        </>
      ) : (
        <>
          <div style={{ marginTop: 4, fontSize: 28, fontWeight: 800, color: "#f09a8c" }}>Caught!</div>
          <div style={{ marginTop: 6, fontSize: 15 }}>
            A constable spotted you going for the {result.car.name} at {result.place}.
          </div>
          {result.jailSeconds ? (
            <div style={{ marginTop: 4, fontSize: 13, color: "#f09a8c" }}>
              Locked up for {result.jailSeconds >= 60 ? `${Math.ceil(result.jailSeconds / 60)} minutes` : `${result.jailSeconds} seconds`}.
            </div>
          ) : null}
          <div style={{ marginTop: 3, fontSize: 12, color: "#d9cfb4" }}>+{result.xpGained} XP</div>
        </>
      )}
    </div>
  );
}

// How long a level makes you wait, in plain words.
function waitWords(secs: number) {
  if (secs >= 3600) return `${Math.round(secs / 3600)} hr`;
  return `${Math.round(secs / 60)} min`;
}

// Countdown on a button: m:ss, or h:mm:ss for the long waits.
function countdown(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const sec = secs % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

// A slim picture strip for each job. Drop art into public/images/autotheft/level-1.png (or .jpg / .webp).
function LevelBanner({ level, name, locked, unlock }: { level: number; name: string; locked: boolean; unlock: string }) {
  const [attempt, setAttempt] = useState(0);
  const files = [`level-${level}.png`, `level-${level}.jpg`, `level-${level}.webp`];
  return (
    <div
      style={{
        position: "relative",
        height: 54,
        overflow: "hidden",
        background: "linear-gradient(135deg, #2b2a24, #14130f)",
        borderBottom: "1px solid #6b5d3a",
      }}
    >
      {attempt < files.length && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/images/autotheft/${files[attempt]}`}
          alt=""
          onError={() => setAttempt((a) => a + 1)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: locked ? 0.35 : 0.85,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "0 8px",
          background: "linear-gradient(90deg, rgba(0,0,0,0.7), rgba(0,0,0,0.15))",
        }}
      >
        <span
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 14,
            fontWeight: 700,
            color: "#f7efdb",
            textShadow: "0 1px 3px #000",
            lineHeight: 1.15,
          }}
        >
          {name}
        </span>
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            color: locked ? "#e0a24f" : "#e4c04d",
            textShadow: "0 1px 2px #000",
            textAlign: "right",
          }}
        >
          {locked ? `Unlocks at ${unlock}` : `Level ${level}`}
        </span>
      </div>
    </div>
  );
}

// A bar that fills as far as the chance goes, with the 50% cap as full.
function ChanceBar({ chance }: { chance: number }) {
  const pct = Math.round(chance * 100);
  return (
    <div
      title={`${pct}% chance of success`}
      aria-label={`${pct}% chance of success`}
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        height: 14,
        background: "#120d09",
        border: "1px solid #55503f",
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, (chance / MAX_THEFT_CHANCE) * 100)}%`,
          height: "100%",
          background: "linear-gradient(180deg, #d9b24a, #7a5a14)",
        }}
      />
      <span
        style={{
          position: "absolute",
          inset: 0,
          textAlign: "center",
          fontSize: 10,
          lineHeight: "13px",
          fontWeight: 700,
          color: "#fff",
          textShadow: "0 1px 1px #000",
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

export default function AutoTheftSection({
  rankLevel,
  energy,
  staminaLevel = 0,
  theftLeft,
  jailLeft,
  isAdmin = false,
  onActed,
  currentCity,
  onResult,
}: Props) {
  const [notices, setNotices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TheftResult | null>(null);

  async function steal(level: number) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/game/autotheft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });
      const data = await response.json();
      if (!response.ok) {
        setResult(null);
        onActed();
        setError(
          data.error === "COOLDOWN"
            ? `You can't try that again yet. Wait ${data.remaining ?? "a few"} seconds.`
            : data.error || "The job failed."
        );
        return;
      }
      setResult(data as TheftResult);
      if (Array.isArray(data.notices) && data.notices.length > 0) setNotices(data.notices);
      onActed();
      onResult({
        energy: data.energy,
        money: data.money,
        experience: data.experience,
        rank: data.rank,
        rankLevel: data.rankLevel,
      });
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      {result && <TheftPopup result={result} onClose={() => setResult(null)} />}

      {notices.length > 0 && (
        <div style={{ ...panel, padding: 8, color: "#e08f7f", border: "1px solid #a0443c" }}>
          {notices.map((n, i) => (
            <div key={i}>{n}</div>
          ))}
          <button
            type="button"
            onClick={() => setNotices([])}
            style={{ ...btn, padding: "2px 8px", fontSize: 11, marginTop: 4 }}
          >
            OK
          </button>
        </div>
      )}

      {error && (
        <div style={{ ...panel, padding: 8, textAlign: "center", color: "#e0584f" }}>{error}</div>
      )}

      <div style={{ ...panel, marginBottom: 6 }}>
        <div style={barStyle}>Auto Theft</div>
        {THEFT_LEVELS.map((l) => {
          const locked = !isAdmin && rankLevel < l.minRank;
          const wait = isAdmin ? 0 : theftLeft(l.level);
          const levelEnergy = energyCostFor(l.energy, staminaLevel);
          const tired = !isAdmin && energy < levelEnergy;
          const jailed = !isAdmin && jailLeft > 0;
          const disabled = busy || locked || wait > 0 || tired || jailed || CARS.length === 0;
          const label = jailed ? "Jailed" : wait > 0 ? countdown(wait) : tired ? "Tired" : "Steal";
          const chance = theftChance(l, rankLevel);
          return (
            <div key={l.level} style={{ borderBottom: "1px solid #3d4a40" }}>
              <LevelBanner level={l.level} name={l.name} locked={locked} unlock={rankForLevel(l.minRank)} />
              <div style={{ padding: "5px 8px 6px", opacity: locked ? 0.5 : 1 }}>
                <div style={{ fontSize: 10, lineHeight: 1.25, color: "#a89f86", marginBottom: 5 }}>{l.blurb}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "#c9bfa6", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {levelEnergy} energy
                  </span>
                  <span style={{ fontSize: 10, color: "#c9bfa6", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {waitWords(THEFT_COOLDOWNS[l.level] ?? 180)} wait
                  </span>
                  <ChanceBar chance={chance} />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => steal(l.level)}
                    style={{
                      ...btn,
                      width: 66,
                      padding: "3px 0",
                      fontSize: 12,
                      flexShrink: 0,
                      opacity: disabled ? 0.5 : 1,
                      cursor: disabled ? "default" : "pointer",
                    }}
                  >
                    {locked ? "Locked" : label}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 10, color: "#c9bfa6", padding: "4px 8px", textAlign: "center" }}>
          {currentCity} streets · your cars are in the Cars tab of your Character
        </div>
      </div>
    </div>
  );
}

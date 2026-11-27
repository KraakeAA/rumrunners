"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { rankForLevel } from "@/lib/ranks";
import { clock } from "@/components/EnergyBar";
import { crimeForCity } from "@/lib/city-crimes";
import { GameImage, slugify } from "@/components/GameImage";
import { useGame } from "@/components/GameContext";
import { energyCostFor } from "@/lib/training";
import { CRIMES, crimeChance, crimeCooldownSeconds } from "@/lib/game";

const titleBarStyle = {
  padding: "3px 8px",
  textAlign: "center" as const,
  fontSize: 13,
  lineHeight: 1.25,
  fontWeight: 400,
  fontFamily: "Georgia, serif",
  letterSpacing: 0.3,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038 0%, #4d3d1c 100%)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};

const btn: CSSProperties = {
  border: "1px solid #b0904a",
  borderRadius: 3,
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  color: "#f7efdb",
  cursor: "pointer"
};

// How long a crime makes you wait, in plain words.
function waitWords(secs: number) {
  if (secs >= 3600) return `${Math.round(secs / 3600)} hr`;
  if (secs >= 60) return `${Math.round(secs / 60)} min`;
  return `${Math.round(secs)} sec`;
}

// The crimes are grouped into tabs by rank: each crime unlocks at its own rank.
const CRIME_TABS: { from: number; to: number }[] = [
  { from: 1, to: 3 },
  { from: 4, to: 6 },
  { from: 7, to: 9 },
  { from: 10, to: 13 }
];

// A slim picture strip for each crime. Drop art into public/images/crimes/<crime id>.webp
// (or .jpg / .png). Until it is there the strip is plain, and the little city picture still shows.
function CrimeBanner({
  crimeId,
  slot,
  name,
  locked,
  lockedText
}: {
  crimeId: string;
  slot: string;
  name: string;
  locked: boolean;
  lockedText: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const files = [`${crimeId}.webp`, `${crimeId}.jpg`, `${crimeId}.png`];
  return (
    <div
      style={{
        position: "relative",
        height: 54,
        overflow: "hidden",
        background: "linear-gradient(135deg, #2b2a24, #14130f)",
        borderBottom: "1px solid #6b5d3a"
      }}
    >
      {attempt < files.length && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/images/crimes/${files[attempt]}`}
          alt=""
          onError={() => setAttempt((a) => a + 1)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: locked ? 0.35 : 0.85
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 4px 0 4px",
          background: "linear-gradient(90deg, rgba(0,0,0,0.7), rgba(0,0,0,0.15))"
        }}
      >
        <GameImage slot={slot} width={46} height={46} dim={locked} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: "Georgia, serif",
            fontSize: 14,
            fontWeight: 700,
            color: locked ? "#a9a28a" : "#f7efdb",
            textShadow: "0 1px 3px #000",
            lineHeight: 1.15
          }}
        >
          {name}
        </span>
        {locked && (
          <span
            style={{
              flexShrink: 0,
              fontSize: 10,
              color: "#e0a24f",
              textShadow: "0 1px 2px #000",
              textAlign: "right",
              paddingRight: 4
            }}
          >
            {lockedText}
          </span>
        )}
      </div>
    </div>
  );
}

// A bar that fills as your chance grows, full at 100%.
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
        overflow: "hidden"
      }}
    >
      <div
        style={{
          width: `${Math.min(100, chance * 100)}%`,
          height: "100%",
          background: "linear-gradient(180deg, #d9b24a, #7a5a14)"
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
          textShadow: "0 1px 1px #000"
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

// The Crimes page, at /crimes.
export default function CrimesPage() {
  const g = useGame();
  const [crimeTier, setCrimeTier] = useState(-1);

  // How many times you have tried each crime: your chance grows with every attempt.
  const [practice, setPractice] = useState<Record<string, number>>({});
  useEffect(() => {
    if (g.busy) return;
    let alive = true;
    fetch("/api/game/crime/practice", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && d.practice && typeof d.practice === "object") setPractice(d.practice);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [g.busy]);

  // Every crime is listed; the ones above your rank are greyed out with the rank that unlocks them.
  const crimeTiers = useMemo(
    () =>
      CRIME_TABS.map((t) => CRIMES.filter((c) => c.minRankLevel >= t.from && c.minRankLevel <= t.to)).filter(
        (list) => list.length > 0
      ),
    []
  );
  const tabRanks = CRIME_TABS.filter((t) => CRIMES.some((c) => c.minRankLevel >= t.from && c.minRankLevel <= t.to));
  const topOpenTier = Math.max(
    0,
    crimeTiers.reduce((n, t, i) => (t[0].minRankLevel <= g.rankLevel ? i : n), 0)
  );
  const activeTier = crimeTier === -1 ? topOpenTier : Math.min(crimeTier, crimeTiers.length - 1);

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={titleBarStyle}>Crimes</div>

      {g.jailLeft > 0 && (
        <p className="notice">
          You are in jail for another {clock(g.jailLeft)}.{" "}
          <button
            type="button"
            onClick={() => g.go("Jail")}
            style={{ background: "none", border: 0, color: "#e4c04d", textDecoration: "underline", cursor: "pointer", fontSize: 12 }}
          >
            Go to the prison
          </button>
        </p>
      )}

      {g.notice && <p className="notice">{g.notice}</p>}

      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        {crimeTiers.map((t, i) => {
          const open = t[0].minRankLevel <= g.rankLevel;
          const on = i === activeTier;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setCrimeTier(i)}
              style={{
                flex: 1,
                minWidth: 0,
                padding: "4px 0",
                fontSize: 13,
                border: on ? "1px solid #f0dfa8" : "1px solid #6b5d3a",
                background: on ? "#8f8668" : "#4a4640",
                color: open ? "#f7efdb" : "#9a9382",
                cursor: "pointer"
              }}
            >
              {tabRanks[i].from}–{tabRanks[i].to}
              {!open && <span style={{ fontSize: 11 }}> 🔒</span>}
            </button>
          );
        })}
      </div>

      <div style={{ margin: "2px 0 4px", fontSize: 11, color: "#b7ad93", textAlign: "center" }}>
        {crimeTiers[activeTier][0].minRankLevel <= g.rankLevel
          ? `Ranks ${tabRanks[activeTier].from}–${tabRanks[activeTier].to} · the more you do a crime, the better you get`
          : `Unlocks at ${rankForLevel(crimeTiers[activeTier][0].minRankLevel)}`}
      </div>

      <div style={{ background: "#1f2a25", border: "1px solid #6b5d3a", color: "#f1e8d3", fontSize: 12, marginBottom: 6 }}>
        {crimeTiers[activeTier].map((baseCrime) => {
          const crime = crimeForCity(baseCrime, g.currentCity);
          const slot = `crimes/${slugify(g.currentCity)}/${crime.id}`;
          const locked = !g.isAdmin && crime.minRankLevel > g.rankLevel;
          const wait = g.isAdmin ? 0 : g.crimeLeft(crime.id);
          const crimeEnergy = energyCostFor(crime.energyCost, g.staminaLevel);
          const needsEnergy = !g.isAdmin && g.energy < crimeEnergy;
          const jailed = !g.isAdmin && g.jailLeft > 0;
          const disabled = g.busy || locked || wait > 0 || needsEnergy || jailed;
          const label = jailed ? "Jailed" : wait > 0 ? clock(wait) : needsEnergy ? "Tired" : "Commit!";

          return (
            <div key={crime.id} style={{ borderBottom: "1px solid #3d4a40" }}>
              <CrimeBanner
                crimeId={crime.id}
                slot={slot}
                name={crime.name}
                locked={locked}
                lockedText={`Unlocks at ${rankForLevel(crime.minRankLevel)}`}
              />
              <div style={{ padding: "5px 8px 6px", opacity: locked ? 0.5 : 1 }}>
                <div style={{ fontSize: 10, lineHeight: 1.25, color: "#a89f86", marginBottom: 5 }}>{crime.description}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: needsEnergy ? "#f09a8c" : "#c9bfa6", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {crimeEnergy} energy
                  </span>
                  <span style={{ fontSize: 10, color: "#c9bfa6", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {waitWords(crimeCooldownSeconds(crime.energyCost))} wait
                  </span>
                  <ChanceBar chance={crimeChance(baseCrime, practice[crime.id] ?? 0)} />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => g.commitCrime(crime.id)}
                    style={{
                      ...btn,
                      width: 66,
                      padding: "3px 0",
                      fontSize: 12,
                      flexShrink: 0,
                      opacity: disabled ? 0.5 : 1,
                      cursor: disabled ? "default" : "pointer"
                    }}
                  >
                    {locked ? "Locked" : label}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

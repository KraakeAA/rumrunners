"use client";

import { useMemo, useState } from "react";
import { rankForLevel } from "@/lib/ranks";
import { clock } from "@/components/EnergyBar";
import { crimeForCity } from "@/lib/city-crimes";
import { JobCard, slugify } from "@/components/GameImage";
import { useGame } from "@/components/GameContext";
import { energyCostFor } from "@/lib/training";
import { CRIMES, crimeCooldownSeconds } from "@/lib/game";

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

// The Crimes page, at /crimes.
export default function CrimesPage() {
  const g = useGame();
  const [crimeTier, setCrimeTier] = useState(-1);

  // Crimes come in tiers of four. Every crime is listed; the ones above
  // your rank are greyed out with the rank that unlocks them.
  const crimeTiers = useMemo(() => {
    const out: (typeof CRIMES)[number][][] = [];
    for (let i = 0; i < CRIMES.length; i += 4) out.push(CRIMES.slice(i, i + 4));
    return out;
  }, []);
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
              {i + 1}
              {!open && <span style={{ fontSize: 11 }}> 🔒</span>}
            </button>
          );
        })}
      </div>

      <div style={{ margin: "2px 0 4px", fontSize: 11, color: "#b7ad93", textAlign: "center" }}>
        {crimeTiers[activeTier][0].minRankLevel <= g.rankLevel
          ? `Tier ${activeTier + 1} · unlocked`
          : `Tier ${activeTier + 1} unlocks at ${rankForLevel(crimeTiers[activeTier][0].minRankLevel)}`}
      </div>

      <div style={{ display: "grid", gap: 0 }}>
        {crimeTiers[activeTier].map((baseCrime) => {
          const crime = crimeForCity(baseCrime, g.currentCity);
          if (!g.isAdmin && crime.minRankLevel > g.rankLevel) {
            return (
              <JobCard
                key={crime.id}
                slot={`crimes/${slugify(g.currentCity)}/${crime.id}`}
                title={crime.name}
                description={crime.description}
                meters={[]}
                locked
                lockedText={`Unlocks at ${rankForLevel(crime.minRankLevel)}`}
                buttonLabel="Locked"
                compact
              />
            );
          }

          const wait = g.crimeLeft(crime.id);
          const crimeEnergy = energyCostFor(crime.energyCost, g.staminaLevel);
          const needsEnergy = !g.isAdmin && g.energy < crimeEnergy;
          const disabled = g.busy || (!g.isAdmin && (wait > 0 || needsEnergy || g.jailLeft > 0));

          return (
            <JobCard
              key={crime.id}
              slot={`crimes/${slugify(g.currentCity)}/${crime.id}`}
              title={crime.name}
              description={crime.description}
              meters={[]}
              seconds={crimeCooldownSeconds(crime.energyCost)}
              hideTime
              energy={crimeEnergy}
              tired={needsEnergy}
              waiting={!g.isAdmin && wait > 0}
              waitLeft={g.isAdmin ? 0 : wait}
              disabled={disabled}
              buttonLabel={
                !g.isAdmin && g.jailLeft > 0 ? "Jailed" : !g.isAdmin && wait > 0 ? clock(wait) : needsEnergy ? "Tired" : "Commit!"
              }
              onClick={() => g.commitCrime(crime.id)}
              compact
            />
          );
        })}
      </div>
    </div>
  );
}

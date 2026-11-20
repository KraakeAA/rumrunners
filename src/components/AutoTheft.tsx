"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { CARS, PLATE_COST, PLATE_HEAT_DROP, THEFT_COOLDOWNS, THEFT_LEVELS } from "@/lib/era";
import { GameImage, JobCard, heatMeter, meter, slugify } from "@/components/GameImage";
import { clock } from "@/components/EnergyBar";
import { rankForLevel } from "@/lib/ranks";
import { energyCostFor } from "@/lib/training";
import { DamageBar, HeatBar } from "@/components/Travel";

type TheftResult = {
  success: boolean;
  car: { name: string; year: string; speed: number; boot: number; tier: number; scrap: number };
  place: string;
  city: string;
  chance: number;
  heat: number;
  plate: string;
  damage: number;
  fine: number;
  jailSeconds?: number;
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
  onActed: () => void;
  currentCity: string;
  onCash: (cash: number) => void;
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
  padding: "4px 8px",
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
const sub: CSSProperties = { fontSize: 11, color: "#c9bfa6" };
const TIER_NAMES = ["", "Common", "Decent", "Fine", "Grand"];

type WorkshopCar = {
  id: string;
  name: string;
  plate: string;
  city: string;
  heat: number;
  damage: number;
  repairCost: number;
};

export default function AutoTheftSection({
  rankLevel,
  energy,
  staminaLevel = 0,
  theftLeft,
  jailLeft,
  onActed,
  currentCity,
  onCash,
  onResult,
}: Props) {
  const [cars, setCars] = useState<WorkshopCar[]>([]);
  const [selected, setSelected] = useState("");
  const [shopMsg, setShopMsg] = useState("");

  const loadCars = useCallback(async () => {
    try {
      const r = await fetch("/api/garage", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setCars(Array.isArray(d.cars) ? d.cars : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadCars();
  }, [loadCars]);

  async function workshop(action: "plate" | "repair") {
    if (!selected) return;
    setBusy(true);
    setShopMsg("");
    try {
      const response = await fetch("/api/garage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, carId: selected }),
      });
      const data = await response.json();
      setShopMsg(data.error || data.message || "");
      if (response.ok) {
        if (typeof data.money === "number") onCash(data.money);
        loadCars();
      }
    } catch {
      setShopMsg("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const picked = cars.find((c) => c.id === selected);
  const pickedHere = !!picked;

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
      onActed();
      loadCars();
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
      {result && (
        <div style={{ ...panel, textAlign: "center" }}>
          <div style={barStyle}>{result.success ? "You got away with it!" : "Caught!"}</div>
          <div style={{ padding: 10, lineHeight: 1.6 }}>
            {result.success ? (
              <>
                <div style={{ maxWidth: 300, margin: "0 auto 8px" }}>
                  <GameImage slot={`cars/${slugify(result.car.name)}`} width="100%" height={150} />
                </div>
                <div>
                  You took a <strong>{result.car.name}</strong> from {result.place}. It is now in your
                  garage in {result.city}, plate {result.plate}.
                </div>
                <div style={sub}>
                  {TIER_NAMES[result.car.tier]} motor · melts down for{" "}
                  {result.car.scrap.toLocaleString("en-GB")} bullets
                </div>
                <div style={{ maxWidth: 260, margin: "6px auto 0" }}>
                  <HeatBar heat={result.heat} />
                  <DamageBar damage={result.damage} />
                </div>
              </>
            ) : (
              <div>
                You went for a <strong>{result.car.name}</strong> at {result.place}, but a constable
                spotted you.
                {result.fine > 0
                  ? ` You were fined £${result.fine.toLocaleString("en-GB")}.`
                  : " You had nothing to be fined."}
              </div>
            )}
            {result.jailSeconds ? (
              <div style={{ color: "#e08f7f", marginTop: 6 }}>
                You were locked up for {result.jailSeconds >= 60 ? `${Math.ceil(result.jailSeconds / 60)} minutes` : `${result.jailSeconds} seconds`}.
              </div>
            ) : null}
            <div style={{ ...sub, marginTop: 6 }}>
              +{result.xpGained} XP{result.leveledUp ? ` · Promoted to ${result.rank}!` : ""}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ ...panel, padding: 8, textAlign: "center", color: "#e0584f" }}>{error}</div>
      )}

      <div style={{ ...panel, marginBottom: 6 }}>
        <div style={barStyle}>Auto Theft</div>
        <div style={{ padding: 6 }}>
          {THEFT_LEVELS.filter(
            (l, i) => rankLevel >= l.minRank || (i === 0 || rankLevel >= THEFT_LEVELS[i - 1].minRank)
          ).map((l) => {
            const slot = `autotheft/level-${l.level}`;
            if (rankLevel < l.minRank) {
              return (
                <JobCard
                  key={l.level}
                  slot={slot}
                  title={l.name}
                  description={l.blurb}
                  meters={[]}
                  locked
                  lockedText={`Unlocks at ${rankForLevel(l.minRank)}`}
                  buttonLabel="Locked"
                />
              );
            }
            const wait = theftLeft(l.level);
            const levelEnergy = energyCostFor(l.energy, staminaLevel);
            const tired = energy < levelEnergy;
            const disabled = busy || wait > 0 || tired || jailLeft > 0 || CARS.length === 0;
            const avgTier = l.weights.reduce((sum, w, i) => sum + w * (i + 1), 0) / 100;
            const avgHeat = l.heat.reduce((sum, h) => sum + h, 0) / l.heat.length;
            return (
              <JobCard
                key={l.level}
                slot={slot}
                title={l.name}
                description={l.blurb}
                meters={[
                  meter("Take", avgTier / 4 * 5, TIER_NAMES[Math.min(4, Math.max(1, Math.round(avgTier)))]),
                  heatMeter(avgHeat / 16)
                ]}
                seconds={THEFT_COOLDOWNS[l.level] ?? 60}
                energy={levelEnergy}
                tired={tired}
                waiting={wait > 0}
                waitLeft={wait}
                disabled={disabled}
                buttonLabel={jailLeft > 0 ? "Jailed" : wait > 0 ? clock(wait) : tired ? "Tired" : "Steal!"}
                onClick={() => steal(l.level)}
              />
            );
          })}
        </div>
        <div style={{ ...sub, padding: "6px 8px", textAlign: "center" }}>
          You&apos;ll be working the streets of {currentCity}.
        </div>
      </div>

      <div style={panel}>
        <div style={barStyle}>Your cars: number plates and repairs</div>
        {cars.length === 0 ? (
          <div style={{ padding: 8, ...sub }}>You have no cars yet.</div>
        ) : (
          <>
            {cars.map((c) => (
              <label
                key={c.id}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  padding: "5px 8px",
                  borderBottom: "1px solid #6b5d3a",
                  background: selected === c.id ? "#3a2f20" : "transparent",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="workshop-car"
                  checked={selected === c.id}
                  onChange={() => setSelected(c.id)}
                />
                <span style={{ flex: 1 }}>
                  <strong>{c.name}</strong> <span style={sub}>[{c.plate}]</span>
                  <HeatBar heat={c.heat} />
                  <DamageBar damage={c.damage} />
                </span>
              </label>
            ))}
            <div style={{ padding: 8 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={{ ...btn, opacity: !picked || !pickedHere || busy ? 0.5 : 1 }}
                  disabled={!picked || !pickedHere || busy}
                  onClick={() => workshop("plate")}
                >
                  Change number plate (£{PLATE_COST})
                </button>
                <button
                  type="button"
                  style={{
                    ...btn,
                    opacity: !picked || !pickedHere || busy || picked.damage <= 0 ? 0.5 : 1,
                  }}
                  disabled={!picked || !pickedHere || busy || picked.damage <= 0}
                  onClick={() => workshop("repair")}
                >
                  {picked && picked.damage > 0
                    ? `Repair (£${picked.repairCost.toLocaleString("en-GB")})`
                    : "Repair"}
                </button>
              </div>
              <div style={{ ...sub, marginTop: 6 }}>
                A new plate takes {PLATE_HEAT_DROP} points off the car&apos;s heat. Damaged cars are
                slower: up to 50% longer waits between journeys. Repairs cost more for finer cars.
              </div>
              {shopMsg && <p style={{ color: "#ddc18d", margin: "6px 0 0" }}>{shopMsg}</p>}
            </div>
          </>
        )}
      </div>

    </div>
  );
}

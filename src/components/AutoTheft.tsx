"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { CARS, PLATE_COST, PLATE_HEAT_DROP, THEFT_LEVELS } from "@/lib/era";
import { clock } from "@/components/EnergyBar";
import { rankForLevel } from "@/lib/ranks";
import { DamageBar, HeatBar } from "@/components/Travel";

type TheftResult = {
  success: boolean;
  car: { name: string; year: string; speed: number; boot: number; tier: number };
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
  const pickedHere = picked ? picked.city === currentCity : false;

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
                <div>
                  You took a <strong>{result.car.name}</strong> from {result.place}. It is now in your
                  garage in {result.city}, plate {result.plate}.
                </div>
                <div style={sub}>
                  {TIER_NAMES[result.car.tier]} motor · {result.car.speed} mph · boot holds{" "}
                  {result.car.boot} crates
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
        <div style={{ display: "grid", gap: 0 }}>
          {THEFT_LEVELS.filter(
            (l, i) => rankLevel >= l.minRank || (i === 0 || rankLevel >= THEFT_LEVELS[i - 1].minRank)
          ).map((l) => {
            if (rankLevel < l.minRank) {
              return (
                <div
                  key={l.level}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 8px",
                    borderBottom: "1px solid #2b3630",
                    opacity: 0.6,
                    background: "#161b18",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: 14, color: "#8a8470" }}>
                      {l.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#8a8470" }}>
                      Unlocks at {rankForLevel(l.minRank)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="button"
                    style={{ flexShrink: 0, width: 70, padding: "5px 0", fontSize: 12, opacity: 0.55 }}
                    disabled
                  >
                    Locked
                  </button>
                </div>
              );
            }
            const wait = theftLeft(l.level);
            const tired = energy < l.energy;
            const disabled = busy || wait > 0 || tired || jailLeft > 0 || CARS.length === 0;
            return (
              <div
                key={l.level}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 8px",
                  borderBottom: "1px solid #2b3630",
                  opacity: wait > 0 ? 0.75 : 1,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 14, color: "#f7efdb" }}>
                    {l.name}
                  </div>
                  <div style={{ ...sub, lineHeight: 1.3 }}>{l.blurb}</div>
                </div>
                <span title="Energy cost" style={{ flexShrink: 0, fontSize: 12, color: tired ? "#e08f7f" : "#e4c04d" }}>
                  ⚡{l.energy}
                </span>
                <button
                  type="button"
                  className="button"
                  style={{ flexShrink: 0, width: 70, padding: "5px 0", fontSize: 12, opacity: disabled ? 0.55 : 1 }}
                  disabled={disabled}
                  onClick={() => steal(l.level)}
                >
                  {jailLeft > 0 ? "Jailed" : wait > 0 ? clock(wait) : tired ? "Tired" : "Steal"}
                </button>
              </div>
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
                  <div style={sub}>
                    Parked in{" "}
                    <strong style={{ color: c.city === currentCity ? "#6fcf6f" : "#f1e8d3" }}>{c.city}</strong>
                  </div>
                  <HeatBar heat={c.heat} />
                  <DamageBar damage={c.damage} />
                </span>
              </label>
            ))}
            <div style={{ padding: 8 }}>
              {picked && !pickedHere && (
                <div style={{ color: "#ddc18d", marginBottom: 6 }}>
                  That car is in {picked.city}. You must be there to work on it.
                </div>
              )}
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

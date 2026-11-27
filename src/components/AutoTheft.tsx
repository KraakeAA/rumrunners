"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CARS, PLATE_COST, PLATE_HEAT_DROP, SHIP_CITIES, THEFT_COOLDOWNS, THEFT_LEVELS, EXPOSURE_MINUTES } from "@/lib/era";
import { GameImage, JobCard, slugify } from "@/components/GameImage";
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
const sub: CSSProperties = { fontSize: 11, color: "#c9bfa6" };
const TIER_NAMES = ["", "Common", "Decent", "Fine", "Grand"];

type WorkshopCar = {
  id: string;
  name: string;
  tier: number;
  plate: string;
  plateOrigin: string;
  plateChanged: boolean;
  exposedUntil: string | null;
  originCity: string;
  city: string;
  heat: number;
  damage: number;
  repairCost: number;
  shipCost: number;
};

type Pane = "plate" | "repair" | "ship";

function PlateBadge({ plate }: { plate: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0 6px",
        background: "#141414",
        color: "#e8e4d4",
        border: "1px solid #c9c5b4",
        borderRadius: 2,
        fontFamily: "Georgia, serif",
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: 1.5,
        lineHeight: "17px",
      }}
    >
      {plate}
    </span>
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
  onCash,
  onResult,
}: Props) {
  const [cars, setCars] = useState<WorkshopCar[]>([]);
  const [selected, setSelected] = useState("");
  const [pane, setPane] = useState<Pane>("plate");
  const [shopMsg, setShopMsg] = useState("");
  const [notices, setNotices] = useState<string[]>([]);
  const [shipTo, setShipTo] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const actedRef = useRef(onActed);
  actedRef.current = onActed;

  // A one-second clock for the 5 minute countdowns.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadCars = useCallback(async () => {
    try {
      const r = await fetch("/api/garage", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setCars(Array.isArray(d.cars) ? d.cars : []);
      if (Array.isArray(d.notices) && d.notices.length > 0) {
        setNotices(d.notices);
        actedRef.current();
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadCars();
    // Check again just after any 5 minute window closes, and every minute.
    const t = setInterval(loadCars, 60_000);
    return () => clearInterval(t);
  }, [loadCars]);

  async function garageJob(action: Pane, carId: string, destination?: string) {
    if (busy) return;
    setBusy(true);
    setShopMsg("");
    try {
      const response = await fetch("/api/garage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, carId, destination }),
      });
      const data = await response.json();
      setShopMsg(data.error || data.message || "");
      if (response.ok) {
        if (typeof data.money === "number") onCash(data.money);
        if (action === "ship") setShipTo({ ...shipTo, [carId]: "" });
        if (data.caught) {
          setSelected("");
          onActed();
        }
        loadCars();
      }
    } catch {
      setShopMsg("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
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
                  <GameImage slot={`cars/${slugify(result.car.name)}`} width="100%" height={120} />
                </div>
                <div>
                  You took a <strong>{result.car.name}</strong> from {result.place}. It is in your
                  garage in {result.city} with {result.plate} plates.
                </div>
                <div style={sub}>
                  {TIER_NAMES[result.car.tier]} motor · melts down for{" "}
                  {result.car.scrap.toLocaleString("en-GB")} bullets
                </div>
                <div style={{ maxWidth: 260, margin: "6px auto 0" }}>
                  <HeatBar heat={result.heat} />
                  <DamageBar damage={result.damage} />
                </div>
                <div style={{ color: "#e0a24f", marginTop: 6, fontSize: 11 }}>
                  It&apos;s red hot. Fit a false plate within {EXPOSURE_MINUTES} minutes or the police will
                  find it. Open Your cars below.
                </div>
              </>
            ) : (
              <div>
                You went for a <strong>{result.car.name}</strong> at {result.place}, but a constable
                spotted you.
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
        <div style={{ padding: 6 }}>
          {THEFT_LEVELS.filter(
            (l, i) => isAdmin || rankLevel >= l.minRank || (i === 0 || rankLevel >= THEFT_LEVELS[i - 1].minRank)
          ).map((l) => {
            const slot = `autotheft/level-${l.level}`;
            if (!isAdmin && rankLevel < l.minRank) {
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
                  compact
                />
              );
            }
            const wait = isAdmin ? 0 : theftLeft(l.level);
            const levelEnergy = energyCostFor(l.energy, staminaLevel);
            const tired = !isAdmin && energy < levelEnergy;
            const disabled = busy || (!isAdmin && (wait > 0 || tired || jailLeft > 0)) || CARS.length === 0;
            return (
              <JobCard
                key={l.level}
                slot={slot}
                title={l.name}
                description={l.blurb}
                meters={[]}
                seconds={THEFT_COOLDOWNS[l.level] ?? 60}
                hideTime
                energy={levelEnergy}
                tired={tired}
                waiting={wait > 0}
                waitLeft={wait}
                disabled={disabled}
                buttonLabel={!isAdmin && jailLeft > 0 ? "Jailed" : wait > 0 ? clock(wait) : tired ? "Tired" : "Steal!"}
                onClick={() => steal(l.level)}
                compact
              />
            );
          })}
        </div>
        <div style={{ ...sub, padding: "6px 8px", textAlign: "center" }}>
          You&apos;ll be working the streets of {currentCity}.
        </div>
      </div>
            <div style={panel}>
        <div style={barStyle}>Your cars ({cars.length})</div>
        {cars.length === 0 ? (
          <div style={{ padding: 8, ...sub }}>You have no cars yet.</div>
        ) : (
          <>
            {cars.map((c) => {
              const open = selected === c.id;
              const left = c.exposedUntil ? Math.max(0, Math.ceil((new Date(c.exposedUntil).getTime() - now) / 1000)) : 0;
              const exposed = !!c.exposedUntil;
              return (
                <div
                  key={c.id}
                  style={{
                    padding: "5px 8px",
                    borderBottom: "1px solid #6b5d3a",
                    background: open ? "#26352d" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <GameImage slot={`cars/${slugify(c.name)}`} width={46} height={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 13 }}>{c.name}</strong>
                        <PlateBadge plate={c.plate} />
                      </div>
                      <div style={sub}>
                        {c.plateChanged ? "False plate" : `${c.plateOrigin} plate`} · {c.city}
                        {c.city !== c.originCity ? ` (from ${c.originCity})` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(open ? "" : c.id);
                        setPane("plate");
                        setShopMsg("");
                      }}
                      style={{ ...btn, padding: "3px 10px", fontSize: 12, flexShrink: 0 }}
                    >
                      {open ? "Close" : "Select"}
                    </button>
                  </div>
                  <HeatBar heat={c.heat} />
                  <DamageBar damage={c.damage} />
                  {exposed && (
                    <div style={{ marginTop: 3, fontSize: 11, color: left > 0 ? "#e0a24f" : "#e0584f" }}>
                      {left > 0
                        ? `Stolen plates! Police find it in ${clock(left)} unless you change the plate.`
                        : "Police are on to it. Refreshing..."}
                    </div>
                  )}

                  {open && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {(["plate", "repair", "ship"] as Pane[]).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setPane(p);
                              setShopMsg("");
                            }}
                            style={{
                              ...btn,
                              flex: 1,
                              padding: "4px 0",
                              fontSize: 12,
                              opacity: pane === p ? 1 : 0.55,
                              outline: pane === p ? "1px solid #f7efdb" : "none",
                            }}
                          >
                            {p === "plate" ? "Plate" : p === "repair" ? "Repair" : "Ship"}
                          </button>
                        ))}
                      </div>

                      <div style={{ padding: "6px 0 0" }}>
                        {pane === "plate" && (
                          <>
                            <div style={sub}>
                              A false plate from any city but {c.originCity}, and it can never go back. Takes{" "}
                              {PLATE_HEAT_DROP} off the heat.
                            </div>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => garageJob("plate", c.id)}
                              style={{ ...btn, marginTop: 4, padding: "4px 10px", fontSize: 12, opacity: busy ? 0.5 : 1 }}
                            >
                              Change plate (£{PLATE_COST})
                            </button>
                          </>
                        )}
                        {pane === "repair" && (
                          <>
                            <div style={sub}>
                              Damaged cars are slower: up to 50% longer waits between journeys.
                            </div>
                            <button
                              type="button"
                              disabled={busy || c.damage <= 0}
                              onClick={() => garageJob("repair", c.id)}
                              style={{ ...btn, marginTop: 4, padding: "4px 10px", fontSize: 12, opacity: busy || c.damage <= 0 ? 0.5 : 1 }}
                            >
                              {c.damage > 0 ? `Repair (£${c.repairCost.toLocaleString("en-GB")})` : "No damage"}
                            </button>
                          </>
                        )}
                        {pane === "ship" && (
                          <>
                            <div style={{ ...sub, color: c.plateChanged ? "#c9bfa6" : "#e0a24f" }}>
                              {c.plateChanged
                                ? "Rail freight to another city. Shipped cars are harder for police to trace."
                                : "Change the plate first! A car on its stolen plates is caught at the station and you go to jail."}
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                              <select
                                value={shipTo[c.id] ?? ""}
                                onChange={(e) => setShipTo({ ...shipTo, [c.id]: e.target.value })}
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  padding: "3px 6px",
                                  border: "1px solid #a08340",
                                  borderRadius: 0,
                                  background: "#0e1411",
                                  color: "#f7efdb",
                                  fontSize: 16,
                                }}
                              >
                                <option value="">Send to…</option>
                                {SHIP_CITIES.filter((x) => x !== c.city).map((x) => (
                                  <option key={x} value={x}>
                                    {x}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={!shipTo[c.id] || busy}
                                onClick={() => garageJob("ship", c.id, shipTo[c.id])}
                                style={{ ...btn, padding: "4px 10px", fontSize: 12, flexShrink: 0, opacity: !shipTo[c.id] || busy ? 0.5 : 1 }}
                              >
                                Ship (£{c.shipCost.toLocaleString("en-GB")})
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {shopMsg && <p style={{ color: "#ddc18d", margin: 0, padding: "6px 8px" }}>{shopMsg}</p>}
            <div style={{ ...sub, padding: "6px 8px" }}>
              Heat: <span style={{ color: "#6fcf6f" }}>green</span> is quiet, <span style={{ color: "#e0a24f" }}>amber</span>{" "}
              is watched, <span style={{ color: "#e0584f" }}>red</span> is hunted. It cools slowly over about two
              days. Police can only find amber and red cars; a green car is safe.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CARS, heatZone, PLATE_COST, SHIP_CITIES, SHIP_MINUTES, THEFT_COOLDOWN_SECONDS, THEFT_LEVELS } from "@/lib/era";
import { clock } from "@/components/EnergyBar";
import { rankForLevel } from "@/lib/ranks";
import { energyCostFor } from "@/lib/training";

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

type WorkshopCar = {
  id: string;
  name: string;
  tier: number;
  plate: string;
  plateOrigin: string;
  plateChanged: boolean;
  exposedUntil: string | null;
  shipArrivesAt: string | null;
  canWork: boolean;
  originCity: string;
  city: string;
  heat: number;
  damage: number;
  repairCost: number;
  shipCost: number;
};

type Pane = "plate" | "repair" | "ship" | "drop";

// Short city codes for the car rows.
const CITY_CODES: Record<string, string> = {
  London: "LON",
  Birmingham: "BIR",
  Manchester: "MAN",
  Liverpool: "LIV",
  Glasgow: "GLA",
};
function short(city: string) {
  return CITY_CODES[city] ?? city.slice(0, 3).toUpperCase();
}

function PlateBadge({ plate }: { plate: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        flexShrink: 0,
        width: 56,
        boxSizing: "border-box",
        textAlign: "center",
        padding: "0 2px",
        background: "#141414",
        color: "#e8e4d4",
        border: "1px solid #c9c5b4",
        borderRadius: 2,
        fontFamily: "Georgia, serif",
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: 1,
        lineHeight: "14px",
        whiteSpace: "nowrap",
      }}
    >
      {plate}
    </span>
  );
}

// Three equal bars. The more are lit, the hotter the car, and they take the colour of the zone.
function HeatBars({ heat }: { heat: number }) {
  const zone = heatZone(heat);
  const lit = zone === "red" ? 3 : zone === "amber" ? 2 : 1;
  const colour = zone === "red" ? "#e0584f" : zone === "amber" ? "#e0a24f" : "#6fcf6f";
  return (
    <span
      title={`Heat ${zone}`}
      aria-label={`Heat ${zone}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 2, height: 13, flexShrink: 0 }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 11,
            borderRadius: 1,
            background: i < lit ? colour : "#2d3731",
          }}
        />
      ))}
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
  const [picked, setPicked] = useState<string[]>([]);
  const [shopMsg, setShopMsg] = useState("");
  const [notices, setNotices] = useState<string[]>([]);
  const [shipDest, setShipDest] = useState("");
  const [dropArm, setDropArm] = useState("");
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
      const list: WorkshopCar[] = Array.isArray(d.cars) ? d.cars : [];
      setCars(list);
      setPicked((p) => p.filter((id) => list.some((c) => c.id === id)));
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

  // Does the same job for every ticked car that it applies to, one after another.
  async function runBatch(action: Pane) {
    if (busy) return;
    const targets = cars.filter((c) => picked.includes(c.id) && canDo(action, c));
    if (targets.length === 0) return;
    if (action === "ship" && !shipDest) {
      setShopMsg("Choose a city to ship to first.");
      return;
    }
    setBusy(true);
    setShopMsg("");
    let done = 0;
    let spent = 0;
    let failure = "";
    let lastMoney: number | null = null;
    let caught = false;
    try {
      for (const c of targets) {
        const response = await fetch("/api/garage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, carId: c.id, destination: action === "ship" ? shipDest : undefined }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          failure = data.error || "That could not be completed.";
          break;
        }
        done++;
        spent += costOf(action, c);
        if (typeof data.money === "number") lastMoney = data.money;
        if (data.caught) {
          caught = true;
          failure = data.message || "";
          break;
        }
      }
    } catch {
      failure = "Unable to connect. Please try again.";
    }
    const verb = action === "plate" ? "fitted with false plates" : action === "repair" ? "repaired" : action === "drop" ? "dropped" : `sent to ${shipDest} (arrives in ${SHIP_MINUTES} minutes)`;
    const parts: string[] = [];
    if (done > 0) {
      parts.push(
        action === "drop"
          ? `${done} ${done === 1 ? "car" : "cars"} dropped.`
          : `${done} ${done === 1 ? "car" : "cars"} ${verb} for £${spent.toLocaleString("en-GB")}.`
      );
    }
    if (failure) parts.push(failure);
    setShopMsg(parts.join(" "));
    if (lastMoney !== null) onCash(lastMoney);
    setPicked([]);
    if (caught) onActed();
    await loadCars();
    setBusy(false);
  }

  // What a job costs for a car, and whether it applies to that car right now.
  function costOf(action: Pane, c: WorkshopCar) {
    return action === "plate" ? PLATE_COST : action === "repair" ? c.repairCost : action === "ship" ? c.shipCost : 0;
  }
  function canDo(action: Pane, c: WorkshopCar) {
    const moving = !!c.shipArrivesAt && new Date(c.shipArrivesAt).getTime() > now;
    if (action === "drop") return true;
    if (action === "repair") return c.damage > 0 && c.canWork && !moving;
    if (action === "ship") return !moving && c.city !== shipDest;
    return c.canWork && !moving && (!c.plateChanged || heatZone(c.heat) !== "green");
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
              <div>
                You stole the <strong>{result.car.name}</strong> from {result.place}. It has {result.damage}% damage.
              </div>
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
        {THEFT_LEVELS.map((l) => {
          const locked = !isAdmin && rankLevel < l.minRank;
          const wait = isAdmin ? 0 : theftLeft(l.level);
          const levelEnergy = energyCostFor(l.energy, staminaLevel);
          const tired = !isAdmin && energy < levelEnergy;
          const jailed = !isAdmin && jailLeft > 0;
          const disabled = busy || locked || wait > 0 || tired || jailed || CARS.length === 0;
          const label = locked
            ? "Locked"
            : jailed
              ? "Jailed"
              : wait > 0
                ? clock(wait)
                : tired
                  ? "Tired"
                  : "Steal";
          return (
            <div
              key={l.level}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 8px",
                borderBottom: "1px solid #3d4a40",
                opacity: locked ? 0.55 : 1,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 18,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid #b0904a",
                  borderRadius: 9,
                  background: "#17201c",
                  color: "#e4c04d",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {l.level}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    color: "#f7efdb",
                  }}
                >
                  {l.name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    lineHeight: 1.2,
                    color: locked ? "#e0a24f" : "#a89f86",
                  }}
                >
                  {locked ? `Unlocks at ${rankForLevel(l.minRank)}` : l.blurb}
                </div>
              </div>
              {!locked && (
                <span style={{ fontSize: 10, color: "#c9bfa6", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {levelEnergy} energy
                </span>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => steal(l.level)}
                style={{
                  ...btn,
                  width: 62,
                  padding: "3px 0",
                  fontSize: 12,
                  flexShrink: 0,
                  opacity: disabled ? 0.5 : 1,
                  cursor: disabled ? "default" : "pointer",
                }}
              >
                {label}
              </button>
            </div>
          );
        })}
        <div style={{ ...sub, padding: "4px 8px", fontSize: 10, textAlign: "center" }}>
          {currentCity} streets · {Math.round(THEFT_COOLDOWN_SECONDS / 60)} minute wait after every job
        </div>
      </div>

      <div style={panel}>
        <div style={barStyle}>Your cars ({cars.length})</div>
        {cars.length === 0 ? (
          <div style={{ padding: 8, ...sub }}>You have no cars yet.</div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 6px",
                background: "#17201c",
                borderBottom: "1px solid #6b5d3a",
                fontSize: 8,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#8f8770",
              }}
            >
              <input
                type="checkbox"
                aria-label="Select all cars"
                checked={picked.length === cars.length}
                onChange={(e) => setPicked(e.target.checked ? cars.map((c) => c.id) : [])}
                style={{ width: 15, height: 15, margin: 0, flexShrink: 0 }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>Car</span>
              <span style={{ width: 56, textAlign: "center", flexShrink: 0 }}>Plate</span>
              <span style={{ width: 46, textAlign: "center", flexShrink: 0 }}>City</span>
              <span style={{ width: 26, textAlign: "right", flexShrink: 0 }}>Dmg</span>
              <span style={{ width: 19, textAlign: "center", flexShrink: 0 }}>Heat</span>
              <span style={{ width: 40, textAlign: "center", flexShrink: 0 }}>Ship</span>
            </div>

            {cars.map((c) => {
              const on = picked.includes(c.id);
              const left = c.exposedUntil ? Math.max(0, Math.ceil((new Date(c.exposedUntil).getTime() - now) / 1000)) : 0;
              const transit = c.shipArrivesAt ? Math.max(0, Math.ceil((new Date(c.shipArrivesAt).getTime() - now) / 1000)) : 0;
              return (
                <div
                  key={c.id}
                  style={{ borderBottom: "1px solid #3d4a40", background: on ? "#26352d" : "transparent" }}
                >
                  <label
                    title={`${c.name}, in ${c.city}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 6px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.name}`}
                      checked={on}
                      onChange={() => setPicked(on ? picked.filter((id) => id !== c.id) : [...picked, c.id])}
                      style={{ width: 15, height: 15, margin: 0, flexShrink: 0 }}
                    />
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: 1.15,
                        color: "#f1e8d3",
                      }}
                    >
                      {c.name}
                    </span>
                    <PlateBadge plate={c.plate} />
                    <span
                      title={`Stolen in ${c.originCity}, now in ${c.city}`}
                      style={{ width: 46, flexShrink: 0, textAlign: "center", fontSize: 9, whiteSpace: "nowrap", color: "#c9bfa6" }}
                    >
                      {short(c.originCity)}
                      {c.originCity !== c.city ? <span style={{ color: "#9fc4e4" }}>{`>${short(c.city)}`}</span> : ""}
                    </span>
                    <span
                      title={`${c.damage}% damage`}
                      style={{
                        width: 26,
                        flexShrink: 0,
                        textAlign: "right",
                        fontSize: 10,
                        color: c.damage >= 35 ? "#e0584f" : c.damage > 0 ? "#e0a24f" : "#6f7a70",
                      }}
                    >
                      {c.damage}%
                    </span>
                    <HeatBars heat={c.heat} />
                    <span style={{ width: 40, flexShrink: 0, textAlign: "center" }}>
                      {transit > 0 && (
                        <span
                          title={`Shipping to ${c.city}`}
                          style={{
                            display: "inline-block",
                            padding: "0 3px",
                            border: "1px solid #5a7fa0",
                            borderRadius: 2,
                            background: "#1b2a38",
                            color: "#9fc4e4",
                            fontSize: 10,
                            lineHeight: "14px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {clock(transit)}
                        </span>
                      )}
                    </span>
                  </label>
                  {c.exposedUntil && (
                    <div style={{ padding: "0 6px 3px 27px", fontSize: 10, color: left > 0 ? "#e0a24f" : "#e0584f" }}>
                      {left > 0
                        ? `Stolen plates! Police find it in ${clock(left)} unless you ship it out of ${c.city}.`
                        : "Police are on to it. Refreshing..."}
                    </div>
                  )}
                </div>
              );
            })}
                        {picked.length > 0 &&
              (() => {
                const chosen = cars.filter((c) => picked.includes(c.id));
                const plates = chosen.filter((c) => canDo("plate", c));
                const repairs = chosen.filter((c) => canDo("repair", c));
                const ships = chosen.filter((c) => canDo("ship", c));
                const sum = (list: WorkshopCar[], a: Pane) => list.reduce((n, c) => n + costOf(a, c), 0);
                const actionBtn = (list: WorkshopCar[]): CSSProperties => ({
                  ...btn,
                  flex: 1,
                  padding: "5px 2px",
                  fontSize: 12,
                  opacity: busy || list.length === 0 ? 0.45 : 1,
                });
                return (
                  <div style={{ padding: 8, background: "#17201c", borderTop: "1px solid #6b5d3a" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        disabled={busy || plates.length === 0}
                        onClick={() => runBatch("plate")}
                        style={actionBtn(plates)}
                      >
                        Plate ({plates.length}) £{sum(plates, "plate").toLocaleString("en-GB")}
                      </button>
                      <button
                        type="button"
                        disabled={busy || repairs.length === 0}
                        onClick={() => runBatch("repair")}
                        style={actionBtn(repairs)}
                      >
                        Repair ({repairs.length}) £{sum(repairs, "repair").toLocaleString("en-GB")}
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                      <select
                        aria-label="Ship to"
                        value={shipDest}
                        onChange={(e) => setShipDest(e.target.value)}
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
                        <option value="">Ship to…</option>
                        {SHIP_CITIES.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy || ships.length === 0 || !shipDest}
                        onClick={() => runBatch("ship")}
                        style={{ ...actionBtn(ships), flex: "none", padding: "5px 10px" }}
                      >
                        Ship ({ships.length}) £{sum(ships, "ship").toLocaleString("en-GB")}
                      </button>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const key = picked.join(",");
                          if (dropArm === key) {
                            setDropArm("");
                            runBatch("drop");
                          } else {
                            setDropArm(key);
                          }
                        }}
                        style={{
                          ...btn,
                          width: "100%",
                          padding: "5px 2px",
                          fontSize: 12,
                          border: "1px solid #a0443c",
                          background: dropArm === picked.join(",") ? "linear-gradient(180deg, #a0443c, #5a1f1b)" : "linear-gradient(180deg, #3a2420, #241513)",
                          opacity: busy ? 0.45 : 1,
                        }}
                      >
                        {dropArm === picked.join(",")
                          ? `Tap again to drop ${picked.length} for good`
                          : `Drop (${picked.length})`}
                      </button>
                    </div>
                  </div>
                );
              })()}

            {shopMsg && <p style={{ color: "#ddc18d", margin: 0, padding: "6px 8px" }}>{shopMsg}</p>}
          </>
        )}
      </div>
    </div>
  );
}

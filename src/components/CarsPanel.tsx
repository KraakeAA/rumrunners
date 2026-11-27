"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { heatZone, PLATE_COST, SHIP_CITIES, SHIP_MINUTES } from "@/lib/era";
import { clock } from "@/components/EnergyBar";

type WorkshopCar = {
  id: string;
  name: string;
  tier: number;
  plate: string;
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

const CITY_CODES: Record<string, string> = {
  London: "LON",
  Birmingham: "BIR",
  Manchester: "MAN",
  Liverpool: "LIV",
  Glasgow: "GLA"
};
const short = (city: string) => CITY_CODES[city] ?? city.slice(0, 3).toUpperCase();

const toolBtn: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "5px 2px",
  border: "1px solid #5a5a54",
  borderRadius: 3,
  background: "linear-gradient(180deg, #5b5b56, #333330)",
  color: "#f1e8d3",
  fontSize: 12,
  fontFamily: "inherit",
  cursor: "pointer"
};

const pickStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "3px 8px",
  border: "1px solid #5a5a54",
  borderRadius: 12,
  background: "#e8e8e4",
  color: "#1b1b19",
  fontSize: 16,
  fontFamily: "inherit"
};

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
        whiteSpace: "nowrap"
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
        <span key={i} style={{ width: 5, height: 11, borderRadius: 1, background: i < lit ? colour : "#2d3731" }} />
      ))}
    </span>
  );
}

// The garage, shown as the Cars tab of the Character panel.
export default function CarsPanel({ onCash }: { onCash?: (cash: number) => void }) {
  const [cars, setCars] = useState<WorkshopCar[]>([]);
  const [maxCars, setMaxCars] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [notices, setNotices] = useState<string[]>([]);
  const [shipDest, setShipDest] = useState("");
  const [dropArm, setDropArm] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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
      setMaxCars(Number(d.maxCars) || 0);
      setPicked((p) => p.filter((id) => list.some((c) => c.id === id)));
      if (Array.isArray(d.notices) && d.notices.length > 0) setNotices(d.notices);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadCars();
    const t = setInterval(loadCars, 30_000);
    return () => clearInterval(t);
  }, [loadCars]);

  const costOf = (action: Pane, c: WorkshopCar) =>
    action === "plate" ? PLATE_COST : action === "repair" ? c.repairCost : action === "ship" ? c.shipCost : 0;

  function canDo(action: Pane, c: WorkshopCar) {
    const moving = !!c.shipArrivesAt && new Date(c.shipArrivesAt).getTime() > now;
    if (action === "drop") return true;
    if (action === "repair") return c.damage > 0 && c.canWork && !moving;
    if (action === "ship") return !moving && c.city !== shipDest;
    return c.canWork && !moving && (!c.plateChanged || heatZone(c.heat) !== "green");
  }

  // Does the same job for every ticked car it applies to, one after another.
  async function runBatch(action: Pane) {
    if (busy) return;
    const targets = cars.filter((c) => picked.includes(c.id) && canDo(action, c));
    if (targets.length === 0) return;
    if (action === "ship" && !shipDest) {
      setMsg("Choose a city to ship to first.");
      return;
    }
    setBusy(true);
    setMsg("");
    let done = 0;
    let spent = 0;
    let failure = "";
    let lastMoney: number | null = null;
    try {
      for (const c of targets) {
        const response = await fetch("/api/garage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, carId: c.id, destination: action === "ship" ? shipDest : undefined })
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
          failure = data.message || "";
          break;
        }
      }
    } catch {
      failure = "Unable to connect. Please try again.";
    }
    const verb =
      action === "plate"
        ? "fitted with false plates"
        : action === "repair"
          ? "repaired"
          : action === "drop"
            ? "dropped"
            : `sent to ${shipDest} (arrives in ${SHIP_MINUTES} minutes)`;
    const parts: string[] = [];
    if (done > 0) {
      parts.push(
        action === "drop"
          ? `${done} ${done === 1 ? "car" : "cars"} dropped.`
          : `${done} ${done === 1 ? "car" : "cars"} ${verb} for £${spent.toLocaleString("en-GB")}.`
      );
    }
    if (failure) parts.push(failure);
    setMsg(parts.join(" "));
    if (lastMoney !== null) onCash?.(lastMoney);
    setPicked([]);
    await loadCars();
    setBusy(false);
  }

  const chosen = cars.filter((c) => picked.includes(c.id));
  const n = (a: Pane) => chosen.filter((c) => canDo(a, c)).length;
  const total = (a: Pane) => chosen.filter((c) => canDo(a, c)).reduce((s, c) => s + costOf(a, c), 0);
  const off = (a: Pane) => busy || n(a) === 0 || (a === "ship" && !shipDest);
  const faded = (disabled: boolean): CSSProperties => ({
    ...toolBtn,
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? "default" : "pointer"
  });
  const dropKey = picked.join(",");
  const armed = dropArm !== "" && dropArm === dropKey;

  return (
    <div style={{ padding: 8 }}>
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 14, paddingBottom: 6, borderBottom: "1px solid #4a4a44" }}>
        Cars
      </div>

      {notices.length > 0 && (
        <div style={{ margin: "6px 0 0", padding: "6px 8px", border: "1px solid #a0443c", background: "#2a1715", color: "#e8a89a", fontSize: 11 }}>
          {notices.map((t, i) => (
            <div key={i}>{t}</div>
          ))}
          <button
            type="button"
            onClick={() => setNotices([])}
            style={{ ...toolBtn, flex: "none", marginTop: 4, padding: "1px 10px", fontSize: 11 }}
          >
            OK
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
        <button type="button" disabled={off("plate")} onClick={() => runBatch("plate")} style={faded(off("plate"))}>
          Plate{n("plate") > 0 ? ` (${n("plate")})` : ""}
        </button>
        <button type="button" disabled={off("repair")} onClick={() => runBatch("repair")} style={faded(off("repair"))}>
          Repair{n("repair") > 0 ? ` (${n("repair")})` : ""}
        </button>
        <button type="button" disabled={off("ship")} onClick={() => runBatch("ship")} style={faded(off("ship"))}>
          Ship{n("ship") > 0 ? ` (${n("ship")})` : ""}
        </button>
        <button
          type="button"
          disabled={busy || picked.length === 0}
          onClick={() => {
            if (armed) {
              setDropArm("");
              runBatch("drop");
            } else {
              setDropArm(dropKey);
            }
          }}
          style={{
            ...faded(busy || picked.length === 0),
            border: "1px solid #a0443c",
            background: armed ? "linear-gradient(180deg, #a0443c, #5a1f1b)" : "linear-gradient(180deg, #4a2a26, #2a1513)"
          }}
        >
          {armed ? "Sure?" : `Drop${picked.length > 0 ? ` (${picked.length})` : ""}`}
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
        <select aria-label="Ship to" value={shipDest} onChange={(e) => setShipDest(e.target.value)} style={pickStyle}>
          <option value="">Ship to…</option>
          {SHIP_CITIES.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setPicked(picked.length === cars.length ? [] : cars.map((c) => c.id))}
          style={{ background: "none", border: 0, color: "#f1e8d3", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: "0 2px", flexShrink: 0 }}
        >
          {picked.length === cars.length && cars.length > 0 ? "Clear" : "Select all"}
        </button>
      </div>

      {picked.length > 0 && (
        <div style={{ marginTop: 5, fontSize: 10, color: "#b7ad93", textAlign: "center" }}>
          Plate £{total("plate").toLocaleString("en-GB")} · Repair £{total("repair").toLocaleString("en-GB")} · Ship £
          {total("ship").toLocaleString("en-GB")}
        </div>
      )}
      {msg && <div style={{ marginTop: 5, fontSize: 11, color: "#ddc18d" }}>{msg}</div>}

      <div style={{ marginTop: 6, border: "1px solid #3a372f", background: "#111110", borderRadius: 3 }}>
        {!loaded ? (
          <div style={{ padding: 10, color: "#8f8873", fontSize: 11 }}>Loading…</div>
        ) : cars.length === 0 ? (
          <div style={{ padding: 10, color: "#8f8873", fontSize: 11, textAlign: "center" }}>You have no cars yet.</div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 6px",
                borderBottom: "1px solid #3a372f",
                fontSize: 8,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#8f8770"
              }}
            >
              <span style={{ width: 15, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>Car</span>
              <span style={{ width: 56, textAlign: "center", flexShrink: 0 }}>Plate</span>
              <span style={{ width: 46, textAlign: "center", flexShrink: 0 }}>City</span>
              <span style={{ width: 26, textAlign: "right", flexShrink: 0 }}>Dmg</span>
              <span style={{ width: 19, textAlign: "center", flexShrink: 0 }}>Heat</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {cars.map((c) => {
                const on = picked.includes(c.id);
                const left = c.exposedUntil ? Math.max(0, Math.ceil((new Date(c.exposedUntil).getTime() - now) / 1000)) : 0;
                const transit = c.shipArrivesAt ? Math.max(0, Math.ceil((new Date(c.shipArrivesAt).getTime() - now) / 1000)) : 0;
                return (
                  <div key={c.id} style={{ borderBottom: "1px solid #2a2a27", background: on ? "#26302a" : "transparent" }}>
                    <label
                      title={`${c.name}, in ${c.city}`}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${c.name}`}
                        checked={on}
                        onChange={() => setPicked(on ? picked.filter((id) => id !== c.id) : [...picked, c.id])}
                        style={{ width: 15, height: 15, margin: 0, flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, lineHeight: 1.15, color: "#f1e8d3" }}>
                        {c.name}
                      </span>
                      <PlateBadge plate={c.plate} />
                      {transit > 0 ? (
                        <span
                          title={`Shipping to ${c.city}`}
                          style={{
                            width: 46,
                            boxSizing: "border-box",
                            flexShrink: 0,
                            textAlign: "center",
                            border: "1px solid #5a7fa0",
                            borderRadius: 2,
                            background: "#1b2a38",
                            color: "#9fc4e4",
                            fontSize: 10,
                            lineHeight: "14px",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {clock(transit)}
                        </span>
                      ) : (
                        <span
                          title={`Stolen in ${c.originCity}, now in ${c.city}`}
                          style={{ width: 46, flexShrink: 0, textAlign: "center", fontSize: 9, whiteSpace: "nowrap", color: "#c9bfa6" }}
                        >
                          {short(c.originCity)}
                          {c.originCity !== c.city ? <span style={{ color: "#9fc4e4" }}>{`>${short(c.city)}`}</span> : ""}
                        </span>
                      )}
                      <span
                        title={`${c.damage}% damage`}
                        style={{
                          width: 26,
                          flexShrink: 0,
                          textAlign: "right",
                          fontSize: 10,
                          color: c.damage >= 35 ? "#e0584f" : c.damage > 0 ? "#e0a24f" : "#6f7a70"
                        }}
                      >
                        {c.damage}%
                      </span>
                      <HeatBars heat={c.heat} />
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
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 6, textAlign: "right", fontSize: 11, color: "#b7ad93" }}>
        {cars.length}
        {maxCars > 0 ? `/${maxCars}` : ""} cars
      </div>
    </div>
  );
}

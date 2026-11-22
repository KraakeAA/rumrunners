"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { CITY_STORIES, RAIL_MINUTES, SHIP_CITIES } from "@/lib/era";

type GarageCar = {
  id: string;
  key: string;
  name: string;
  year: string;
  speed: number;
  boot: number;
  price: number;
  scrap: number;
  minutes: number;
  tier: number;
  note: string;
  originCity: string;
  city: string;
  heat: number;
  plate: string;
  damage: number;
  repairCost: number;
  shipCost: number;
  baseMinutes: number;
};

type GarageData = {
  money: number;
  currentCity: string;
  cars: GarageCar[];
  maxCars: number;
  plateCost: number;
};

type TravelData = {
  cities: string[];
  currentCity: string;
  canTravel: boolean;
  cooldownUntil: string | null;
};

type Arrival = {
  welcome: string;
  history: string;
  vehicle: string;
  minutes: number;
};

const panel: CSSProperties = {
  background: "#1f2a25",
  border: "1px solid #6b5d3a",
  marginBottom: 8,
  color: "#f1e8d3",
  fontSize: 13,
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

function Bar({ children }: { children: ReactNode }) {
  return <div style={barStyle}>{children}</div>;
}

export function HeatBar({ heat }: { heat: number }) {
  const colour = heat >= 70 ? "#e0584f" : heat >= 40 ? "#e0a24f" : "#6fcf6f";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
      <span style={{ fontSize: 11, color: "#c9bfa6", width: 32 }}>Heat</span>
      <div style={{ flex: 1, height: 7, background: "#0e1411", border: "1px solid #5b4d3a" }}>
        <div style={{ width: `${Math.max(0, Math.min(100, heat))}%`, height: "100%", background: colour }} />
      </div>
      <span style={{ fontSize: 11, color: colour, width: 30, textAlign: "right" }}>{heat}%</span>
    </div>
  );
}

export function DamageBar({ damage }: { damage: number }) {
  // 0% is perfect, 50% is badly damaged.
  const colour = damage >= 35 ? "#e0584f" : damage >= 15 ? "#e0a24f" : "#6fcf6f";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
      <span style={{ fontSize: 11, color: "#c9bfa6", width: 32 }}>Dmg</span>
      <div style={{ flex: 1, height: 7, background: "#0e1411", border: "1px solid #5b4d3a" }}>
        <div style={{ width: `${Math.min(100, damage * 2)}%`, height: "100%", background: colour }} />
      </div>
      <span style={{ fontSize: 11, color: colour, width: 30, textAlign: "right" }}>{damage}%</span>
    </div>
  );
}

async function getJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json();
  return { ok: response.ok, body };
}

async function postJson(url: string, payload: Record<string, unknown>) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: response.ok, body: await response.json() };
  } catch {
    return { ok: false, body: { error: "Unable to connect. Please try again." } };
  }
}

function clock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  return `${m}m ${String(total % 60).padStart(2, "0")}s`;
}

/* ------------------------------- Travel ------------------------------- */

export function TravelSection({
  onArrive,
  isAdmin = false,
}: {
  onArrive: (city: string) => void;
  isAdmin?: boolean;
}) {
  const [data, setData] = useState<TravelData | null>(null);
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const t = await getJson("/api/travel");
      if (!t.ok) {
        setError(t.body.error || "Unable to load travel information.");
        return;
      }
      setData(t.body as TravelData);
    } catch {
      setError("Unable to connect. Please try again.");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [load]);

  if (!data) return <p className="flavour">{error || "Checking the timetables..."}</p>;

  const remaining = data.cooldownUntil
    ? Math.max(0, new Date(data.cooldownUntil).getTime() - now)
    : 0;
  const canTravel = isAdmin || remaining === 0;
  const minutes = RAIL_MINUTES;
  const story = CITY_STORIES[data.currentCity];

  async function go() {
    if (!destination || busy || !data) return;
    setBusy(true);
    setError("");
    const { ok, body } = await postJson("/api/travel", {
      action: "travel",
      destination,
    });
    setBusy(false);

    if (!ok) {
      setError(body.error || "Your journey could not be completed.");
      if (body.cooldownUntil) {
        setData({ ...data, cooldownUntil: body.cooldownUntil });
      }
      return;
    }

    setArrival({
      welcome: body.welcome,
      history: body.history,
      vehicle: body.vehicle,
      minutes: body.minutes,
    });
    setData({
      ...data,
      currentCity: body.currentCity,
      cooldownUntil: body.cooldownUntil,
      canTravel: body.canTravel,
    });
    setDestination("");
    onArrive(body.currentCity);
    load();
  }

  return (
    <div>
      {arrival && (
        <div style={{ ...panel, textAlign: "center" }}>
          <Bar>{arrival.welcome}</Bar>
          <div style={{ padding: 10, lineHeight: 1.5 }}>
            <div style={{ marginBottom: 6 }}>{arrival.history}</div>
            <div style={{ color: "#c9bfa6", fontSize: 12 }}>
              You travelled by {arrival.vehicle}. You can travel again in {arrival.minutes} minutes.
            </div>
          </div>
        </div>
      )}

      <div style={panel}>
        <Bar>Travel</Bar>
        <div style={{ padding: 8, lineHeight: 1.6 }}>
          <div>
            You are in <strong>{data.currentCity}</strong>.
          </div>
          {!arrival && story && (
            <div style={{ color: "#c9bfa6", fontSize: 12 }}>{story.history}</div>
          )}
          {!canTravel && (
            <div style={{ color: "#ddc18d", marginTop: 4 }}>
              You can travel again in <strong>{clock(remaining)}</strong>.
            </div>
          )}
        </div>
      </div>

      <div style={panel}>
        <Bar>The railway</Bar>
        <div style={{ padding: 8, color: "#c9bfa6", fontSize: 12, lineHeight: 1.5 }}>
          Every journey is by train: instant, then a {RAIL_MINUTES} minute wait before you can
          travel again. Your booze travels with you, up to your rank&apos;s limit.
        </div>
      </div>

      <div style={panel}>
        <Bar>Choose your destination</Bar>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 8 }}>
          {data.cities
            .filter((c) => c !== data.currentCity)
            .map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDestination(c)}
                style={{
                  ...btn,
                  outline: destination === c ? "2px solid #ddc18d" : "none",
                }}
              >
                {c}
              </button>
            ))}
        </div>
        <div style={{ padding: "0 8px 8px", textAlign: "center" }}>
          <button
            type="button"
            style={{ ...btn, opacity: !destination || !canTravel || busy ? 0.5 : 1 }}
            disabled={!destination || !canTravel || busy}
            onClick={go}
          >
            {destination ? `Travel to ${destination} (${minutes} min)` : "Pick a destination"}
          </button>
          {error && <p style={{ color: "#e0584f", margin: "8px 0 0" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

const sub: CSSProperties = { fontSize: 12, color: "#c9bfa6" };
/* ------------------------------- Garage ------------------------------- */

export function GarageSection({ onCash }: { onCash?: (money: number) => void }) {
  const [data, setData] = useState<GarageData | null>(null);
  const [msg, setMsg] = useState("");
  const [shipTo, setShipTo] = useState<Record<string, string>>({});
  const [shipping, setShipping] = useState(false);

  async function ship(carId: string) {
    const destination = shipTo[carId];
    if (!destination || shipping) return;
    setShipping(true);
    setMsg("");
    try {
      const { ok, body } = await postJson("/api/garage", { action: "ship", carId, destination });
      setMsg(body.error || body.message || "");
      if (ok) {
        if (typeof body.money === "number") onCash?.(body.money);
        setShipTo({ ...shipTo, [carId]: "" });
        load();
      }
    } catch {
      setMsg("Unable to connect. Please try again.");
    } finally {
      setShipping(false);
    }
  }

  const load = useCallback(async () => {
    try {
      const g = await getJson("/api/garage");
      if (!g.ok) {
        setMsg(g.body.error || "The garage is unavailable right now.");
        return;
      }
      setData(g.body as GarageData);
    } catch {
      setMsg("Unable to connect. Please try again.");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (!data) return <p className="flavour">{msg || "Opening the garage..."}</p>;

  return (
    <div>
      <div style={panel}>
        <Bar>
          Your Garage ({data.cars.length}/{data.maxCars})
        </Bar>
        {data.cars.length === 0 && (
          <div style={{ padding: 8, color: "#c9bfa6" }}>
            No cars yet. Steal one through Auto Theft.
          </div>
        )}
        {data.cars.map((c) => (
          <div key={c.id} style={{ padding: "7px 8px", borderBottom: "1px solid #6b5d3a" }}>
            <strong>{c.name}</strong> <span style={sub}>({c.year})</span>
            <div style={{ fontWeight: 700, letterSpacing: 1 }}>Plate: {c.plate}</div>
            <div style={sub}>
              Stolen in {c.originCity} · now in {c.city} · melts down for{" "}
              {c.scrap.toLocaleString("en-GB")} bullets
            </div>
            <HeatBar heat={c.heat} />
            <DamageBar damage={c.damage} />
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
              <select
                value={shipTo[c.id] ?? ""}
                onChange={(e) => setShipTo({ ...shipTo, [c.id]: e.target.value })}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "5px 6px",
                  border: "1px solid #a08340",
                  borderRadius: 0,
                  background: "#0e1411",
                  color: "#f7efdb",
                  fontSize: 16
                }}
              >
                <option value="">Ship to…</option>
                {SHIP_CITIES.filter((s) => s !== c.city).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="button"
                disabled={!shipTo[c.id] || shipping}
                onClick={() => ship(c.id)}
                style={{ padding: "6px 10px", fontSize: 12, flexShrink: 0, opacity: !shipTo[c.id] || shipping ? 0.55 : 1 }}
              >
                Ship (£{c.shipCost.toLocaleString("en-GB")})
              </button>
            </div>
          </div>
        ))}
        {msg && <div style={{ padding: "6px 8px", color: "#ddc18d" }}>{msg}</div>}
        <div style={{ padding: 8, fontSize: 12, color: "#c9bfa6" }}>
          Cars are not driven. Ship them to another city by rail freight (the plate stays the same),
          melt them down for bullets at the Bullet Factory, or use them on Organised Crime jobs.
          Need more room? Buy a bigger garage in the Store.
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { CITY_STORIES, RAIL_MINUTES } from "@/lib/era";

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
  background: "#29231d",
  border: "1px solid #3a342c",
  marginBottom: 8,
  color: "#e6d4b1",
  fontSize: 13,
};
const barStyle: CSSProperties = {
  padding: "4px 8px",
  textAlign: "center",
  fontWeight: 700,
  fontSize: 13,
  color: "#f0dfbd",
  background: "linear-gradient(180deg, #725839, #392819)",
  borderBottom: "1px solid #b49a70",
};
const btn: CSSProperties = {
  padding: "6px 12px",
  border: "1px solid #b49a70",
  borderRadius: 3,
  background: "linear-gradient(180deg, #725839, #392819)",
  color: "#f0dfbd",
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
      <span style={{ fontSize: 11, color: "#c4b69f", width: 32 }}>Heat</span>
      <div style={{ flex: 1, height: 7, background: "#14110d", border: "1px solid #5b4d3a" }}>
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
      <span style={{ fontSize: 11, color: "#c4b69f", width: 32 }}>Dmg</span>
      <div style={{ flex: 1, height: 7, background: "#14110d", border: "1px solid #5b4d3a" }}>
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
}: {
  onArrive: (city: string) => void;
}) {
  const [data, setData] = useState<TravelData | null>(null);
  const [cars, setCars] = useState<GarageCar[]>([]);
  const [carId, setCarId] = useState("");
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
      const g = await getJson("/api/garage");
      if (g.ok) setCars((g.body as GarageData).cars);
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
  const canTravel = remaining === 0;
  const here = cars.filter((c) => c.city === data.currentCity);
  const chosen = here.find((c) => c.id === carId);
  const minutes = chosen ? chosen.minutes : RAIL_MINUTES;
  const story = CITY_STORIES[data.currentCity];

  async function go() {
    if (!destination || busy || !data) return;
    setBusy(true);
    setError("");
    const { ok, body } = await postJson("/api/travel", {
      action: "travel",
      destination,
      carId: carId || undefined,
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
    setCarId("");
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
            <div style={{ color: "#c4b69f", fontSize: 12 }}>
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
            <div style={{ color: "#c4b69f", fontSize: 12 }}>{story.history}</div>
          )}
          {!canTravel && (
            <div style={{ color: "#ddc18d", marginTop: 4 }}>
              You can travel again in <strong>{clock(remaining)}</strong>.
            </div>
          )}
        </div>
      </div>

      <div style={panel}>
        <Bar>1. Choose your vehicle</Bar>
        <label style={rowStyle(carId === "")}>
          <input type="radio" name="vehicle" checked={carId === ""} onChange={() => setCarId("")} />
          <span>
            <strong>Railway</strong>
            <div style={sub}>Instant · wait {RAIL_MINUTES} min before travelling again · no booze</div>
          </span>
        </label>
        {here.map((c) => (
          <label key={c.id} style={rowStyle(carId === c.id)}>
            <input type="radio" name="vehicle" checked={carId === c.id} onChange={() => setCarId(c.id)} />
            <span style={{ flex: 1 }}>
              <strong>{c.name}</strong> <span style={sub}>[{c.plate}]</span>
              <div style={sub}>
                Instant · wait {c.minutes} min · {c.speed} mph · boot holds {c.boot} crates
              </div>
              <HeatBar heat={c.heat} />
              <DamageBar damage={c.damage} />
            </span>
          </label>
        ))}
        {here.length === 0 && (
          <div style={{ padding: 8, color: "#c4b69f", fontSize: 12 }}>
            {cars.length === 0
              ? "You don't own a car yet. Steal one through Auto Theft."
              : `None of your cars are in ${data.currentCity}.`}
          </div>
        )}
      </div>

      <div style={panel}>
        <Bar>2. Choose your destination</Bar>
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

const sub: CSSProperties = { fontSize: 12, color: "#c4b69f" };
function rowStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: "7px 8px",
    borderBottom: "1px solid #3a342c",
    background: active ? "#3a2f20" : "transparent",
    cursor: "pointer",
  };
}

/* ------------------------------- Garage ------------------------------- */

export function GarageSection() {
  const [data, setData] = useState<GarageData | null>(null);
  const [msg, setMsg] = useState("");

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
          <div style={{ padding: 8, color: "#c4b69f" }}>
            No cars yet. Steal one through Auto Theft (unlocked at rank 3).
          </div>
        )}
        {data.cars.map((c) => (
          <div key={c.id} style={{ padding: "7px 8px", borderBottom: "1px solid #3a342c" }}>
            <strong>{c.name}</strong> <span style={sub}>({c.year})</span>
            <div style={{ fontWeight: 700, letterSpacing: 1 }}>Plate: {c.plate}</div>
            <div style={sub}>
              Stolen in {c.originCity} · now in{" "}
              <strong style={{ color: c.city === data.currentCity ? "#6fcf6f" : "#e6d4b1" }}>
                {c.city}
              </strong>
            </div>
            <div style={sub}>
              {c.speed} mph · wait {c.minutes} min between journeys · boot holds {c.boot} crates ·
              melts down for {c.scrap.toLocaleString("en-GB")} bullets
            </div>
            <HeatBar heat={c.heat} />
            <DamageBar damage={c.damage} />
          </div>
        ))}
        <div style={{ padding: 8, fontSize: 12, color: "#c4b69f" }}>
          Change plates and repair cars on the Auto Theft page.
          Cars stay where you leave them. Drive a car to travel with it, or melt it down at the
          Bullet Factory (Gun Shop) in the city where it is parked.
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import CasinoGames from "@/components/CasinoGames";
import { ARMS } from "@/lib/era";
import type { CasinoView, FactoryView, VenueData } from "@/lib/venues";

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

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
const input: CSSProperties = {
  padding: "6px 8px",
  border: "1px solid #5b4d3a",
  borderRadius: 3,
  background: "#14110d",
  color: "#f0dfbd",
  fontSize: 14,
  width: 130,
  boxSizing: "border-box",
};
const GREEN = "#6fcf6f";
const RED = "#e0584f";

function Bar({ children }: { children: ReactNode }) {
  return <div style={barStyle}>{children}</div>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        padding: "5px 8px",
        borderBottom: "1px solid #3a342c",
      }}
    >
      <span style={{ color: "#c4b69f" }}>{label}</span>
      <span style={{ textAlign: "right" }}>{children}</span>
    </div>
  );
}

function useVenues() {
  const [data, setData] = useState<VenueData | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/venues", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || "Unavailable right now.");
        return;
      }
      setError("");
      setData(body as VenueData);
    } catch {
      setError("Unable to connect. Please try again.");
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, reload };
}

async function post(url: string, payload: Record<string, unknown>) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    return { ok: response.ok, body };
  } catch {
    return { ok: false, body: { error: "Unable to connect. Please try again." } };
  }
}

/* ---------------------------- Casino page ---------------------------- */

export function CasinoSection({
  game,
  cash,
  onCash,
}: {
  game: "Keno" | "Slots";
  cash: number;
  onCash: (cash: number) => void;
}) {
  const { data, error, reload } = useVenues();
  const [msg, setMsg] = useState("");
  const [maxBetInput, setMaxBetInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ text: string; good: boolean } | null>(null);

  const casino: CasinoView | undefined = data?.casinos.find(
    (c) => c.city === data.currentCity && c.game === game
  );

  useEffect(() => {
    if (casino?.isMine) setMaxBetInput(String(casino.maxBet));
  }, [casino?.isMine, casino?.maxBet]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    const { ok, body } = await post("/api/venues/casino", payload);
    setMsg(body.error || body.message || "");
    setBusy(false);
    if (ok) {
      reload();
      // Cash changed when buying: refresh from the venue data.
      try {
        const r = await fetch("/api/venues", { cache: "no-store" });
        const d = (await r.json()) as VenueData;
        if (typeof d.me?.money === "number") onCash(d.me.money);
      } catch {
        /* ignore */
      }
    }
  }

  if (error && !data) return <p className="flavour">{error}</p>;
  if (!data || !casino) return <p className="flavour">Loading the casino...</p>;

  // Owner view: control panel instead of the game.
  if (casino.isMine) {
    const profit = casino.profit ?? 0;
    return (
      <div>
        <div style={panel}>
          <Bar>
            {casino.label} - {casino.city} (You own this casino)
          </Bar>
          <Row label="Profit / loss">
            <strong style={{ color: profit >= 0 ? GREEN : RED }}>
              {profit >= 0 ? "+" : "-"}
              {gbp(Math.abs(profit))} {profit >= 0 ? "▲" : "▼"}
            </strong>
          </Row>
          <Row label="Cash on hand (the casino bankroll)">
            <strong>{gbp(casino.ownerCash ?? 0)}</strong>
          </Row>
          <Row label="Games played">{(casino.plays ?? 0).toLocaleString("en-GB")}</Row>
          <Row label="Total wagered">{gbp(casino.wagered ?? 0)}</Row>
          <Row label="Current maximum bet">{gbp(casino.maxBet)}</Row>
          <div style={{ padding: 8 }}>
            <div style={{ marginBottom: 6, color: "#c4b69f" }}>Set the maximum bet</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input
                style={input}
                inputMode="numeric"
                value={maxBetInput}
                onChange={(e) => setMaxBetInput(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <button
                type="button"
                style={btn}
                disabled={busy}
                onClick={() =>
                  act({ action: "setMaxBet", city: casino.city, game, maxBet: Number(maxBetInput) })
                }
              >
                Save
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#c4b69f", margin: "8px 0 0", lineHeight: 1.5 }}>
              Players bet against your cash on hand. If a player wins more than you
              can cover, they take the casino from you. Top prize here is{" "}
              {casino.topMultiplier.toLocaleString("en-GB")}x the bet, so keep your
              maximum bet low enough to stay safe.
            </p>
            {msg && <p style={{ color: "#ddc18d", margin: "8px 0 0" }}>{msg}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Everyone else: the game, with the owner and max bet shown.
  return (
    <div>
      {banner && (
        <div
          style={{
            ...panel,
            padding: 10,
            textAlign: "center",
            fontWeight: 700,
            color: banner.good ? GREEN : RED,
          }}
        >
          {banner.text}
        </div>
      )}

      {!casino.ownerId && (
        <div style={{ ...panel, padding: 8, textAlign: "center" }}>
          <div style={{ marginBottom: 6 }}>
            No one owns the {casino.city} {casino.label} casino. You can buy it for{" "}
            <strong>{gbp(casino.price)}</strong> and run it yourself.
          </div>
          <button type="button" style={btn} disabled={busy} onClick={() => act({ action: "buy", city: casino.city, game })}>
            Buy this casino
          </button>
          {msg && <p style={{ color: "#ddc18d", margin: "8px 0 0" }}>{msg}</p>}
        </div>
      )}

      <CasinoGames
        key={`${casino.id}-${casino.ownerId ?? "house"}`}
        game={game}
        cash={cash}
        onCash={onCash}
        ownerName={casino.ownerName}
        maxBet={casino.maxBet}
        onPlayed={(info) => {
          if (info.takeover) {
            setBanner({
              text: `${info.previousOwner ?? "The owner"} couldn't cover the bet. You now own this casino!`,
              good: true,
            });
          } else {
            setBanner(null);
          }
          reload();
        }}
      />
    </div>
  );
}

/* ----------------------------- Cities page ---------------------------- */

export function CitiesSection({
  onGo,
}: {
  onGo: (section: string) => void;
}) {
  const { data, error } = useVenues();

  if (error && !data) return <p className="flavour">{error}</p>;
  if (!data) return <p className="flavour">Loading cities...</p>;

  const cities = Array.from(new Set(data.casinos.map((c) => c.city)));

  return (
    <div>
      {cities.map((city) => {
        const rows = data.casinos.filter((c) => c.city === city);
        const factory = data.factories.find((f) => f.city === city);
        return (
          <div key={city} style={panel}>
            <Bar>
              {city}
              {data.currentCity === city ? " (you are here)" : ""}
            </Bar>
            {rows.map((c) => (
              <Row key={c.id} label={`${c.label} Owner`}>
                <OwnerCell owner={c.ownerName} wealth={c.ownerWealth} mine={c.isMine} figure={c.ownerId ? gbp(c.maxBet) : `Buy ${gbp(c.price)}`} figureLabel={c.ownerId ? "max bet" : ""} />
              </Row>
            ))}
            {factory && (
              <Row label="Bullet Factory Owner">
                <OwnerCell
                  owner={factory.ownerName}
                  wealth={factory.ownerWealth}
                  mine={factory.isMine}
                  figure={factory.ownerId ? `${gbp(factory.pricePerBullet)} each` : `Buy ${gbp(factory.price)}`}
                  figureLabel={factory.ownerId ? `${factory.stock.toLocaleString("en-GB")} in stock` : ""}
                />
              </Row>
            )}
          </div>
        );
      })}
      <div style={{ textAlign: "center" }}>
        <button type="button" style={btn} onClick={() => onGo("Railway")}>
          Travel
        </button>{" "}
        <button type="button" style={btn} onClick={() => onGo("Gun Shop")}>
          Bullet Factory
        </button>
      </div>
    </div>
  );
}

function OwnerCell({
  owner,
  wealth,
  mine,
  figure,
  figureLabel,
}: {
  owner: string | null;
  wealth: string | null;
  mine: boolean;
  figure: string;
  figureLabel: string;
}) {
  if (!owner) {
    return (
      <span>
        <em style={{ color: "#c4b69f" }}>No one owns it</em>
        <div style={{ color: GREEN, fontSize: 12 }}>{figure}</div>
      </span>
    );
  }
  return (
    <span>
      <strong>{mine ? `${owner} (you)` : owner}</strong>
      <div style={{ fontSize: 12 }}>
        <span style={{ color: GREEN }}>{figure}</span>
        {figureLabel ? <span style={{ color: "#c4b69f" }}> {figureLabel}</span> : null}
      </div>
      {wealth && <div style={{ fontSize: 11, color: "#c4b69f" }}>{wealth}</div>}
    </span>
  );
}

/* --------------------------- Bullet factory --------------------------- */

function countdown(iso: string | null, now: number): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000));
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

export function BulletFactorySection({
  onCash,
  onBullets,
}: {
  onCash: (cash: number) => void;
  onBullets: (bullets: number) => void;
}) {
  const { data, error, reload } = useVenues();
  const [msg, setMsg] = useState("");
  const [qty, setQty] = useState("100");
  const [priceInput, setPriceInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [garage, setGarage] = useState<
    { id: string; name: string; scrap: number; city: string }[]
  >([]);
  const [garageCity, setGarageCity] = useState("");

  const loadGarage = useCallback(async () => {
    try {
      const r = await fetch("/api/garage", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setGarage(Array.isArray(d.cars) ? d.cars : []);
      setGarageCity(typeof d.currentCity === "string" ? d.currentCity : "");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadGarage();
  }, [loadGarage]);

  async function melt(carId: string) {
    setBusy(true);
    setMsg("");
    const { ok, body } = await post("/api/venues/scrap", { carId });
    setMsg(body.error || body.message || "");
    setBusy(false);
    if (ok) {
      if (typeof body.bullets === "number") onBullets(body.bullets);
      loadGarage();
      reload();
    }
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const factory: FactoryView | undefined = data?.factories.find(
    (f) => f.city === data.currentCity
  );
  const mine = factory?.isMine ?? false;
  const myPrice = factory?.pricePerBullet;

  useEffect(() => {
    if (mine && myPrice !== undefined) setPriceInput(String(myPrice));
  }, [mine, myPrice]);

  // When the timer runs out, reload so the new batch shows up.
  const nextRunAt = factory?.nextRunAt ?? null;
  useEffect(() => {
    if (nextRunAt && new Date(nextRunAt).getTime() <= now - 1500) {
      reload();
    }
  }, [now, nextRunAt, reload]);

  async function refreshCash() {
    try {
      const r = await fetch("/api/venues", { cache: "no-store" });
      const d = (await r.json()) as VenueData;
      if (typeof d.me?.money === "number") onCash(d.me.money);
      if (typeof d.me?.bullets === "number") onBullets(d.me.bullets);
    } catch {
      /* ignore */
    }
  }

  async function ownerAct(payload: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    const { ok, body } = await post("/api/venues/factory", payload);
    setMsg(body.error || body.message || "");
    setBusy(false);
    if (ok) {
      reload();
      refreshCash();
    }
  }

  async function buyBullets() {
    if (!factory) return;
    setBusy(true);
    setMsg("");
    const { ok, body } = await post("/api/venues/bullets", {
      city: factory.city,
      quantity: Number(qty),
    });
    if (ok) {
      onCash(body.money);
      onBullets(body.bullets);
      setMsg(`You bought ${body.quantity.toLocaleString("en-GB")} bullets for ${gbp(body.cost)}.`);
      reload();
    } else {
      setMsg(body.error || "That could not be completed.");
    }
    setBusy(false);
  }

  if (error && !data) return <p className="flavour">{error}</p>;
  if (!data || !factory) return <p className="flavour">Loading the factory...</p>;

  const title = `${factory.city} Bullet Factory`;

  return (
    <div>
      <div style={panel}>
        <Bar>{title}</Bar>
        {factory.ownerId ? (
          <Row label="Owner">
            <strong>{factory.isMine ? `${factory.ownerName} (you)` : factory.ownerName}</strong>
          </Row>
        ) : (
          <Row label="Owner">
            <em style={{ color: "#c4b69f" }}>No one owns it</em>
          </Row>
        )}
        <Row label="Bullets in stock">{factory.stock.toLocaleString("en-GB")}</Row>
        <Row label="Price per bullet">{gbp(factory.pricePerBullet)}</Row>
        {factory.ownerId && (
          <Row label="Next batch">
            {factory.batchSize.toLocaleString("en-GB")} bullets in{" "}
            <strong>{countdown(factory.nextRunAt, now)}</strong>
          </Row>
        )}
      </div>

      {!factory.ownerId && (
        <div style={{ ...panel, padding: 8, textAlign: "center" }}>
          <div style={{ marginBottom: 6, lineHeight: 1.5 }}>
            Buy this factory for <strong>{gbp(factory.price)}</strong>. It makes{" "}
            {factory.batchSize.toLocaleString("en-GB")} bullets every 30 minutes. Each batch costs{" "}
            {gbp(factory.steelCost)} of steel from your cash on hand. If you can&apos;t
            pay for the steel, you lose the factory.
          </div>
          <button type="button" style={btn} disabled={busy} onClick={() => ownerAct({ action: "buy", city: factory.city })}>
            Buy this factory
          </button>
        </div>
      )}

      {mine && (
        <div style={panel}>
          <Bar>Factory controls</Bar>
          <Row label="Cash on hand (pays for steel)">
            <strong>{gbp(factory.ownerCash ?? 0)}</strong>
          </Row>
          <Row label="Steel cost per batch">{gbp(factory.steelCost)}</Row>
          <Row label="Total bullets made">{(factory.totalProduced ?? 0).toLocaleString("en-GB")}</Row>
          <Row label="Sales revenue">
            <strong style={{ color: GREEN }}>{gbp(factory.revenue ?? 0)}</strong>
          </Row>
          <div style={{ padding: 8 }}>
            <div style={{ marginBottom: 6, color: "#c4b69f" }}>Price per bullet</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input
                style={input}
                inputMode="numeric"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <button
                type="button"
                style={btn}
                disabled={busy}
                onClick={() =>
                  ownerAct({ action: "setPrice", city: factory.city, pricePerBullet: Number(priceInput) })
                }
              >
                Save
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#c4b69f", margin: "8px 0 0", lineHeight: 1.5 }}>
              Keep at least {gbp(factory.steelCost)} in cash on hand for every batch,
              or the factory is lost.
            </p>
          </div>
        </div>
      )}

      {!mine && factory.stock > 0 && (
        <div style={{ ...panel, padding: 8 }}>
          <div style={{ marginBottom: 6, color: "#c4b69f" }}>
            Buy bullets (you carry {data.me.bullets.toLocaleString("en-GB")})
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <input
              style={input}
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))}
            />
            <button type="button" style={btn} disabled={busy} onClick={buyBullets}>
              Buy
            </button>
            <span style={{ fontSize: 12, color: "#c4b69f" }}>
              Cost {gbp((Number(qty) || 0) * factory.pricePerBullet)}
            </span>
          </div>
        </div>
      )}

      <div style={panel}>
        <Bar>Melt a car for bullets</Bar>
        {garage.filter((c) => c.city === garageCity).length === 0 ? (
          <div style={{ padding: 8, color: "#c4b69f" }}>
            You have no cars parked in {garageCity || "this city"} to melt down. Steal one through
            Auto Theft, or drive one here.
          </div>
        ) : (
          garage.filter((c) => c.city === garageCity).map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderBottom: "1px solid #3a342c",
              }}
            >
              <span>
                {c.name}
                <div style={{ fontSize: 12, color: "#c4b69f" }}>
                  {c.scrap.toLocaleString("en-GB")} bullets
                </div>
              </span>
              <button type="button" style={btn} disabled={busy} onClick={() => melt(c.id)}>
                Melt down
              </button>
            </div>
          ))
        )}
      </div>

      <div style={panel}>
        <Bar>Arms of the era</Bar>
        {ARMS.map((a) => (
          <div key={a.name} style={{ padding: "5px 8px", borderBottom: "1px solid #3a342c" }}>
            <strong>{a.name}</strong>{" "}
            <span style={{ color: "#c4b69f", fontSize: 12 }}>
              {a.maker} · {a.calibre}
            </span>
            <div style={{ fontSize: 12, color: "#c4b69f" }}>{a.note}</div>
          </div>
        ))}
      </div>

      {msg && <p style={{ color: "#ddc18d", textAlign: "center" }}>{msg}</p>}
    </div>
  );
}

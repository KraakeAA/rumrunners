"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import CasinoGames from "@/components/CasinoGames";
import TableGames from "@/components/TableGames";
import { betText, isHouseOnly, UNLIMITED_BET, WAR_MAX_BET, type CasinoGameKey, type CasinoView, type FactoryView, type VenueData } from "@/lib/venues";

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

const panel: CSSProperties = {
  background: "#1f2a25",
  border: "1px solid #6b5d3a",
  marginBottom: 8,
  color: "#f1e8d3",
  fontSize: 12,
};
const barStyle: CSSProperties = {
  padding: "6px 8px",
  textAlign: "center",
  fontWeight: 400,
  fontFamily: "Georgia, serif",
  fontSize: 15,
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
const input: CSSProperties = {
  padding: "6px 8px",
  border: "1px solid #5b4d3a",
  borderRadius: 3,
  background: "#0e1411",
  color: "#f7efdb",
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
        borderBottom: "1px solid #6b5d3a",
      }}
    >
      <span style={{ color: "#c9bfa6" }}>{label}</span>
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
  game: CasinoGameKey;
  cash: number;
  onCash: (cash: number) => void;
}) {
  const { data, error, reload } = useVenues();
  const [msg, setMsg] = useState("");
  const [maxBetInput, setMaxBetInput] = useState("");
  const [noLimit, setNoLimit] = useState(false);
  const [chipInput, setChipInput] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ text: string; good: boolean } | null>(null);
  const [takenOver, setTakenOver] = useState<{ previousOwner: string | null; payout: number } | null>(null);

  const casino: CasinoView | undefined = data?.casinos.find(
    (c) => c.city === data.currentCity && c.game === game
  );

  // Counts down the opening window of a newly owned casino.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (casino?.isMine) {
      const unlimited = casino.maxBet >= UNLIMITED_BET;
      setNoLimit(unlimited);
      setMaxBetInput(unlimited ? "" : String(casino.maxBet));
    }
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
  const openLeft = casino.openAt ? Math.max(0, Math.ceil((new Date(casino.openAt).getTime() - now) / 1000)) : 0;

  const takeoverPopup = takenOver ? (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.75)"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 340,
          boxSizing: "border-box",
          textAlign: "center",
          background: "#100d0c",
          border: "2px solid #c69a48",
          borderRadius: 6,
          overflow: "hidden",
          color: "#e8dcc0"
        }}
      >
        <div style={{ padding: "10px 12px", background: "linear-gradient(180deg, #6e1220, #590d18)", borderBottom: "1px solid #c69a48", fontWeight: 700, fontSize: 18, letterSpacing: 0.5 }}>
          Casino Taken Over
        </div>
        <div style={{ padding: "16px 14px", lineHeight: 1.5, fontSize: 15 }}>
          <p style={{ margin: "0 0 10px" }}>
            <strong style={{ color: "#ffffff" }}>{takenOver.previousOwner ?? "The owner"}</strong> couldn&apos;t afford to pay.
          </p>
          <p style={{ margin: "0 0 10px" }}>
            You were paid what was left: <strong style={{ color: "#7fe08f" }}>{gbp(takenOver.payout)}</strong>.
          </p>
          <p style={{ margin: 0, fontWeight: 700, color: "#ffe08a" }}>You now own this casino.</p>
        </div>
        <div style={{ padding: "0 14px 14px" }}>
          <button type="button" style={{ ...btn, minWidth: 120 }} onClick={() => setTakenOver(null)}>
            OK
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (casino.isMine) {
    const profit = casino.profit ?? 0;
    return (
      <div>
        {takeoverPopup}
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
          <Row label="Casino chips (the bankroll)">
            <strong>{gbp(casino.chips ?? 0)}</strong>
          </Row>
          <Row label="Wealth">{casino.ownerWealth ?? "Bankrupt"}</Row>
          {openLeft > 0 && (
            <div style={{ padding: "6px 8px", textAlign: "center", color: "#ddc18d", borderBottom: "1px solid #6b5d3a" }}>
              Closed to players for {Math.floor(openLeft / 60)}m {String(openLeft % 60).padStart(2, "0")}s. Stock it with chips.
            </div>
          )}
          <div style={{ padding: 8, borderBottom: "1px solid #6b5d3a" }}>
            <div style={{ marginBottom: 6, color: "#c9bfa6" }}>Deposit or withdraw chips</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input
                style={input}
                inputMode="numeric"
                placeholder="Amount"
                value={chipInput}
                onChange={(e) => setChipInput(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <button
                type="button"
                style={btn}
                disabled={busy}
                onClick={async () => {
                  await act({ action: "deposit", city: casino.city, game, amount: Number(chipInput) });
                  setChipInput("");
                }}
              >
                Deposit
              </button>
              <button
                type="button"
                style={btn}
                disabled={busy}
                onClick={async () => {
                  await act({ action: "withdraw", city: casino.city, game, amount: Number(chipInput) });
                  setChipInput("");
                }}
              >
                Withdraw
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#c9bfa6", margin: "6px 0 0", lineHeight: 1.4 }}>
              Depositing turns your cash into casino chips. Withdrawing turns chips back into cash.
            </p>
          </div>
          <Row label="Games played">{(casino.plays ?? 0).toLocaleString("en-GB")}</Row>
          <Row label="Total wagered">{gbp(casino.wagered ?? 0)}</Row>
          <Row label="Current maximum bet">{betText(casino.maxBet)}</Row>
          <div style={{ padding: 8 }}>
            <div style={{ marginBottom: 6, color: "#c9bfa6" }}>Set the maximum bet</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input
                style={input}
                inputMode="numeric"
                value={noLimit ? "" : maxBetInput}
                placeholder={noLimit ? "No limit" : ""}
                disabled={noLimit}
                onChange={(e) => setMaxBetInput(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <button
                type="button"
                style={btn}
                disabled={busy}
                onClick={() =>
                  act({ action: "setMaxBet", city: casino.city, game, maxBet: Number(maxBetInput), unlimited: noLimit })
                }
              >
                Save
              </button>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: "#c9bfa6" }}>
              <input type="checkbox" checked={noLimit} onChange={(e) => setNoLimit(e.target.checked)} />
              No limit
            </label>
            <p style={{ fontSize: 12, color: "#c9bfa6", margin: "8px 0 0", lineHeight: 1.5 }}>
              Players bet with their own cash, against your chips. If a player wins more
              than the chips you hold, they only get what is left. Top prize here is{" "}
              {casino.topMultiplier.toLocaleString("en-GB")}x the bet, so keep enough chips
              in the casino. When the casino is sold, its chips are returned to you as cash.
            </p>
            {msg && <p style={{ color: "#ddc18d", margin: "8px 0 0" }}>{msg}</p>}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #6b5d3a" }}>
              <button
                type="button"
                style={{ ...btn, background: "linear-gradient(180deg, #7a2a22, #4a1814)", borderColor: "#b3584c" }}
                disabled={busy}
                onClick={() => setConfirmDrop(true)}
              >
                Drop casino
              </button>
            </div>
          </div>
        </div>

        {confirmDrop && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              display: "grid",
              placeItems: "center",
              padding: 16,
              background: "rgba(0, 0, 0, 0.7)"
            }}
          >
            <div style={{ ...panel, width: "100%", maxWidth: 320, marginBottom: 0 }}>
              <Bar>Are you sure?</Bar>
              <div style={{ padding: 12, textAlign: "center", lineHeight: 1.5 }}>
                <p style={{ margin: "0 0 10px" }}>
                  Drop the {casino.city} {casino.label} casino? You will lose ownership and
                  anyone can buy it.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button
                    type="button"
                    style={{ ...btn, background: "linear-gradient(180deg, #7a2a22, #4a1814)", borderColor: "#b3584c" }}
                    disabled={busy}
                    onClick={async () => {
                      await act({ action: "drop", city: casino.city, game });
                      setConfirmDrop(false);
                    }}
                  >
                    Yes
                  </button>
                  <button type="button" style={btn} disabled={busy} onClick={() => setConfirmDrop(false)}>
                    No
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Everyone else: the game, with the owner and max bet shown.
  const gameKey = `${casino.id}-${casino.ownerId ?? "house"}`;
  const onPlayed = (info: { takeover: boolean; previousOwner: string | null; payout: number }) => {
    if (info.takeover) {
      setTakenOver({ previousOwner: info.previousOwner, payout: info.payout });
      setBanner(null);
    } else {
      setBanner(null);
    }
    reload();
  };
  // Nobody owns it: only the buy screen, no game.
  if (!casino.ownerId && !isHouseOnly(casino.game)) {
    return (
      <div>
        {takeoverPopup}
        <div style={panel}>
          <Bar>
            {casino.label} - {casino.city}
          </Bar>
          <div style={{ padding: 12, textAlign: "center", lineHeight: 1.5 }}>
            <p style={{ margin: "0 0 10px" }}>
              No one owns the {casino.city} {casino.label} casino, so it is shut. Buy it for{" "}
              <strong>{gbp(casino.price)}</strong> to open it and run it yourself.
            </p>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#c9bfa6" }}>
              Your cash on hand: {gbp(cash)}
            </p>
            <button type="button" style={btn} disabled={busy} onClick={() => act({ action: "buy", city: casino.city, game })}>
              Buy this casino
            </button>
            {msg && <p style={{ color: "#ddc18d", margin: "8px 0 0" }}>{msg}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {takeoverPopup}
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

      {casino.ownerId && openLeft > 0 ? (
        <div style={{ ...panel, padding: 10, textAlign: "center", color: "#ddc18d" }}>
          {casino.ownerName} has just taken this casino and is stocking it with chips. It opens in{" "}
          {Math.floor(openLeft / 60)}m {String(openLeft % 60).padStart(2, "0")}s.
        </div>
      ) : game === "Keno" || game === "Slots" ? (
        <CasinoGames
          key={gameKey}
          game={game}
          cash={cash}
          onCash={onCash}
          ownerName={casino.ownerName}
          ownerCrewColor={casino.ownerCrewColor}
          wealth={casino.ownerName ? casino.ownerWealth ?? "Bankrupt" : null}
          maxBet={casino.maxBet}
          onPlayed={onPlayed}
        />
      ) : (
        <TableGames
          key={gameKey}
          game={game}
          cash={cash}
          onCash={onCash}
          ownerName={casino.ownerName}
          ownerCrewColor={casino.ownerCrewColor}
          wealth={casino.ownerName ? casino.ownerWealth ?? "Bankrupt" : null}
          maxBet={casino.maxBet}
          onPlayed={onPlayed}
        />
      )}
    </div>
  );
}

/* ----------------------------- Cities page ---------------------------- */

const cityRegions: Record<string, string> = {
  London: "Greater London",
  Birmingham: "West Midlands",
  Manchester: "Greater Manchester",
  Liverpool: "Merseyside",
  Glasgow: "Scotland"
};

function OwnerLine({
  owner,
  figure,
  figureNote,
  wealth
}: {
  owner: string | null;
  figure: string;
  figureNote?: string;
  wealth: string | null;
}) {
  if (!owner) {
    return (
      <div style={{ lineHeight: 1.25 }}>
        <div style={{ color: "#8a8470", fontStyle: "italic", fontSize: 10 }}>No owner</div>
        <div style={{ color: GREEN, fontSize: 10 }}>{figure}</div>
      </div>
    );
  }
  return (
    <div style={{ lineHeight: 1.25 }}>
      <div style={{ fontSize: 11 }}>
        {owner === "Rumrunners" ? (
          <span style={{ color: "#f7efdb" }}>{owner}</span>
        ) : (
          <Link
            href={`/profile/${encodeURIComponent(owner)}`}
            style={{ color: "#f7efdb", textDecoration: "underline", textDecorationColor: "#6b5d3a", textUnderlineOffset: 3 }}
          >
            {owner}
          </Link>
        )}
      </div>
      <div style={{ fontSize: 10, color: "#b7ad93" }}>
        {figure}
        {figureNote ? <em> {figureNote}</em> : null}
      </div>
      {wealth && <div style={{ fontSize: 9, color: "#8f8a76" }}>{wealth}</div>}
    </div>
  );
}

function CityRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "36% 1fr", borderTop: "1px solid #6b5d3a" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "2px 6px",
          textAlign: "right",
          background: "#17201c",
          borderRight: "1px solid #6b5d3a",
          color: "#e3d9bf",
          fontSize: 10,
          lineHeight: 1.2
        }}
      >
        {label}:
      </div>
      <div style={{ padding: "2px 6px", minWidth: 0, background: "#1f2a25" }}>{children}</div>
    </div>
  );
}

export function CitiesSection() {
  const { data, error } = useVenues();

  if (error && !data) return <p className="flavour">{error}</p>;
  if (!data) return <p className="flavour">Loading cities...</p>;

  const cities = Array.from(new Set(data.casinos.map((c) => c.city)));

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={{ ...barStyle, padding: "3px 8px", fontSize: 13, borderBottom: 0, border: "1px solid #b0904a" }}>Cities</div>

      <div style={{ display: "grid", gap: 3, marginTop: 3 }}>
        {cities.map((city) => {
          const rows = data.casinos.filter((c) => c.city === city);
          const factory = data.factories.find((f) => f.city === city);
          const here = data.currentCity === city;

          return (
            <div
              key={city}
              style={{
                border: `1px solid ${here ? "#a08340" : "#6b5d3a"}`,
                background: "#1f2a25"
              }}
            >
              <div
                style={{
                  padding: "3px 8px 3px",
                  textAlign: "center",
                  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
                  borderBottom: "1px solid #b0904a"
                }}
              >
                <div style={{ fontFamily: "Georgia, serif", fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: "#f7efdb", textShadow: "0 1px 2px #000" }}>
                  {city}
                </div>
                <div style={{ fontSize: 9, lineHeight: 1.2, color: "#e3d3a8" }}>{cityRegions[city] ?? "Britain"}</div>
              </div>

              {(() => {
                const casinoRow = (game: string) => {
                  const c = rows.find((r) => r.game === game);
                  if (!c) return null;
                  return (
                    <CityRow key={c.id} label={`${c.label} Owner`}>
                      <OwnerLine
                        owner={c.ownerName}
                        figure={c.ownerId ? betText(c.maxBet) : `Buy ${gbp(c.price)}`}
                        figureNote={undefined}
                        wealth={c.ownerWealth}
                      />
                    </CityRow>
                  );
                };
                return (
                  <>
                    {casinoRow("Slots")}
                    {casinoRow("Roulette")}
                    {factory && (
                      <CityRow label="Bullet Factory Owner">
                        <OwnerLine
                          owner={factory.ownerName}
                          figure={factory.ownerId ? `${gbp(factory.pricePerBullet)} each` : `Buy ${gbp(factory.price)}`}
                          figureNote={factory.ownerId ? `(${factory.stock.toLocaleString("en-GB")})` : undefined}
                          wealth={factory.ownerWealth}
                        />
                      </CityRow>
                    )}
                    <CityRow label="Racetrack Owner">
                      <div style={{ color: "#8a8470", fontStyle: "italic", fontSize: 10 }}>Not open yet</div>
                    </CityRow>
                    {casinoRow("Blackjack")}
                    {casinoRow("Keno")}
                    <CityRow label="War Owner">
                      <OwnerLine owner="Rumrunners" figure={gbp(WAR_MAX_BET)} wealth={null} />
                    </CityRow>
                  </>
                );
              })()}

            </div>
          );
        })}
      </div>

    </div>
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
    { id: string; name: string; scrap: number }[]
  >([]);

  const loadGarage = useCallback(async () => {
    try {
      const r = await fetch("/api/garage", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setGarage(Array.isArray(d.cars) ? d.cars : []);
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
            <em style={{ color: "#c9bfa6" }}>No one owns it</em>
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
            <div style={{ marginBottom: 6, color: "#c9bfa6" }}>Price per bullet</div>
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
            <p style={{ fontSize: 12, color: "#c9bfa6", margin: "8px 0 0", lineHeight: 1.5 }}>
              Keep at least {gbp(factory.steelCost)} in cash on hand for every batch,
              or the factory is lost.
            </p>
          </div>
        </div>
      )}

      {!mine && factory.stock > 0 && (
        <div style={{ ...panel, padding: 8 }}>
          <div style={{ marginBottom: 6, color: "#c9bfa6" }}>
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
            <span style={{ fontSize: 12, color: "#c9bfa6" }}>
              Cost {gbp((Number(qty) || 0) * factory.pricePerBullet)}
            </span>
          </div>
        </div>
      )}

      <div style={panel}>
        <Bar>Melt a car for bullets</Bar>
        {garage.length === 0 ? (
          <div style={{ padding: 8, color: "#c9bfa6" }}>
            You have no cars to melt down. Steal one through Auto Theft.
          </div>
        ) : (
          garage.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderBottom: "1px solid #6b5d3a",
              }}
            >
              <span>
                {c.name}
                <div style={{ fontSize: 12, color: "#c9bfa6" }}>
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

      {msg && <p style={{ color: "#ddc18d", textAlign: "center" }}>{msg}</p>}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { GameImage } from "@/components/GameImage";

type Row = {
  key: string;
  name: string;
  price: number;
  low: number;
  high: number;
  held: number;
  sellable: number;
  tag: "low" | "fair" | "high";
};

type Data = {
  city: string;
  money: number;
  jailed: boolean;
  capacity: number;
  used: number;
  market: Row[];
};

const bar: CSSProperties = {
  padding: "6px 8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 15,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};

const subBar: CSSProperties = {
  padding: "3px 8px",
  textAlign: "center",
  fontSize: 12,
  color: "#d9c9a0",
  background: "#2a3630",
  borderTop: "1px solid #3d4a41",
  borderBottom: "1px solid #3d4a41"
};

const list: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 4,
  background: "#171d1a"
};

const card: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "64px minmax(0, 1fr)",
  gap: 8,
  padding: 6,
  background: "#1f2a25",
  border: "1px solid #3d4a41"
};

const fieldLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.4,
  marginBottom: 2
};

const confirmBtn: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ffffff",
  borderRadius: 3,
  background: "#ffffff",
  color: "#111111",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer"
};

const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: 30,
  padding: "0 2px",
  border: "1px solid #a08340",
  borderRadius: 0,
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16,
  textAlign: "center",
  minWidth: 0
};

const tagColour: Record<Row["tag"], string> = {
  low: "#7fe08f",
  fair: "#b7ad93",
  high: "#e4c04d"
};

const tagLabel: Record<Row["tag"], string> = { low: "Low", fair: "Fair", high: "High" };

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;
const whole = (v: string | undefined) => {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export default function BootleggingSection({ onCash }: { onCash: (money: number) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [buy, setBuy] = useState<Record<string, string>>({});
  const [sell, setSell] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [good, setGood] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/game/bootlegging", { cache: "no-store" });
      if (!r.ok) return;
      const d: Data = await r.json();
      setData(d);
      onCash(d.money);
    } catch {
      /* keep what is on screen */
    }
  }, [onCash]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 60000);
    return () => window.clearInterval(t);
  }, [load]);

  async function complete() {
    if (!data) return;

    const sells = data.market
      .map((m) => ({ m, n: whole(sell[m.key]) }))
      .filter((x) => x.n > 0);
    const buys = data.market
      .map((m) => ({ m, n: whole(buy[m.key]) }))
      .filter((x) => x.n > 0);

    if (sells.length === 0 && buys.length === 0) {
      setGood(false);
      setMessage("Enter how many crates to buy or sell first.");
      return;
    }

    for (const s of sells) {
      if (s.n > s.m.sellable) {
        setGood(false);
        setMessage(`You can't sell ${s.n} crates of ${s.m.name} here.`);
        return;
      }
    }

    setBusy(true);
    setMessage("");
    const done: string[] = [];

    try {
      // Sell first so the room and the cash are free for the buying.
      const jobs = [
        ...sells.map((x) => ({ action: "sell" as const, booze: x.m.key, qty: x.n })),
        ...buys.map((x) => ({ action: "buy" as const, booze: x.m.key, qty: x.n }))
      ];

      for (const job of jobs) {
        const r = await fetch("/api/game/bootlegging", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: job.action, booze: job.booze, qty: String(job.qty) })
        });
        const j = await r.json().catch(() => ({}));

        if (!r.ok) {
          setGood(false);
          setMessage(
            [...done, String(j.error ?? "That did not work.")].join(" ")
          );
          await load();
          return;
        }

        done.push(String(j.message ?? "Done."));
      }

      setGood(true);
      setMessage(done.join(" "));
      setBuy({});
      setSell({});
      await load();
    } catch {
      setGood(false);
      setMessage("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
        <div style={bar}>Bootlegging</div>
        <p className="flavour">Loading…</p>
      </div>
    );
  }

  const buyTotal = data.market.reduce((n, m) => n + whole(buy[m.key]) * m.price, 0);
  const sellTotal = data.market.reduce((n, m) => n + whole(sell[m.key]) * m.price, 0);
  const buyCrates = data.market.reduce((n, m) => n + whole(buy[m.key]), 0);
  const sellCrates = data.market.reduce((n, m) => n + whole(sell[m.key]), 0);
  const over = data.used - sellCrates + buyCrates > data.capacity;

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Bootlegging · {data.city}</div>

      <div style={{ border: "1px solid #6b5d3a", borderTop: 0, background: "#1f2a25" }}>
        <div style={{ padding: "6px 10px", fontSize: 12, lineHeight: 1.5, color: "#d4cab2" }}>
          <strong style={{ color: "#f7efdb" }}>Crate information:</strong>
          <br />
          Able to carry: <strong style={{ color: "#f7efdb" }}>{data.capacity}</strong> · Carrying:{" "}
          <strong style={{ color: data.used >= data.capacity ? "#e08f7f" : "#f7efdb" }}>
            {data.used}
          </strong>
          <br />
          More crates with every rank.
        </div>

        <div style={subBar}>Buy and sell</div>
        <div style={list}>
          {data.market.map((m) => (
            <div key={m.key} style={card}>
              <GameImage slot={`booze/${m.key}`} width="100%" ratio={1} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 13, color: "#f7efdb", fontFamily: "Georgia, serif" }}>{m.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f7efdb", whiteSpace: "nowrap" }}>
                    {gbp(m.price)}{" "}
                    <span style={{ fontSize: 10, fontWeight: 400, color: tagColour[m.tag] }}>{tagLabel[m.tag]}</span>
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "#b7ad93", margin: "1px 0 4px" }}>
                  You hold {m.held}
                  {m.held > 0 && m.sellable < m.held
                    ? ` · ${m.sellable > 0 ? `${m.sellable} sellable here` : "can't sell here"}`
                    : ""}
                </div>

                {!data.jailed && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div>
                      <div style={{ ...fieldLabel, color: "#7fe08f" }}>BUY</div>
                      <input
                        aria-label={`Buy crates of ${m.name}`}
                        inputMode="numeric"
                        placeholder="0"
                        value={buy[m.key] ?? ""}
                        onChange={(e) => setBuy({ ...buy, [m.key]: e.target.value.replace(/\D/g, "") })}
                        style={input}
                      />
                    </div>
                    <div>
                      <div style={{ ...fieldLabel, color: "#e4c04d" }}>SELL</div>
                      <input
                        aria-label={`Sell crates of ${m.name}`}
                        inputMode="numeric"
                        placeholder="0"
                        disabled={m.sellable === 0}
                        value={sell[m.key] ?? ""}
                        onChange={(e) => setSell({ ...sell, [m.key]: e.target.value.replace(/\D/g, "") })}
                        style={{ ...input, opacity: m.sellable === 0 ? 0.35 : 1 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "8px 10px", borderTop: "1px solid #3d4a41" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#d4cab2", marginBottom: 8 }}>
            <span>
              Buying: <strong style={{ color: "#f7efdb" }}>{gbp(buyTotal)}</strong>
            </span>
            <span>
              Selling: <strong style={{ color: "#7fe08f" }}>{gbp(sellTotal)}</strong>
            </span>
          </div>
          {!data.jailed && (
            <button
              type="button"
              style={{ ...confirmBtn, opacity: busy ? 0.55 : 1 }}
              disabled={busy}
              onClick={complete}
            >
              Confirm
            </button>
          )}
        </div>

        {over && (
          <p className="notice" style={{ margin: "0 10px 8px", color: "#f09a8c" }}>
            That is more crates than you can carry.
          </p>
        )}
        {message && (
          <p className="notice" style={{ margin: "0 10px 8px", color: good ? "#7fe08f" : "#f09a8c" }}>
            {message}
          </p>
        )}
      </div>

      <p style={{ margin: "6px 0 0", fontSize: 11, color: "#b7ad93", textAlign: "center", lineHeight: 1.4 }}>
        Prices differ in every city. Buy where it&apos;s low, take the train to another city,
        and sell where it&apos;s high. Crates can&apos;t be sold in the city where you bought them.
      </p>
    </div>
  );
}

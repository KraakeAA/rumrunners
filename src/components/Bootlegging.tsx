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

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 4,
  padding: 4,
  background: "#1f2a25"
};

const tile: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 3,
  justifyItems: "center",
  textAlign: "center"
};

// The same light pill as the Search! button on the forum.
const pillBtn: CSSProperties = {
  padding: "7px 16px",
  border: "1px solid #d6d6d6",
  borderRadius: 999,
  background: "#f2f2f2",
  color: "#111111",
  fontSize: 14,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  cursor: "pointer",
  WebkitAppearance: "none"
};

const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: 28,
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
        <div style={grid}>
          {data.market.map((m) => (
            <div key={m.key} style={tile}>
              <GameImage slot={`booze/${m.key}`} width="100%" height={58} />
              <div style={{ fontSize: 11, lineHeight: 1.2, color: "#f7efdb", minHeight: 26 }}>
                {m.name}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f7efdb" }}>{gbp(m.price)}</div>
              <div style={{ fontSize: 10, color: tagColour[m.tag] }}>{tagLabel[m.tag]}</div>

              {!data.jailed && (
                <>
                  <div style={{ fontSize: 10, color: "#7fe08f", fontWeight: 700, marginTop: 2 }}>BUY</div>
                  <input
                    aria-label={`Buy crates of ${m.name}`}
                    inputMode="numeric"
                    value={buy[m.key] ?? ""}
                    onChange={(e) => setBuy({ ...buy, [m.key]: e.target.value.replace(/\D/g, "") })}
                    style={input}
                  />

                  <div style={{ fontSize: 10, color: "#e4c04d", fontWeight: 700, marginTop: 2 }}>
                    SELL · {m.held} held
                  </div>
                  <input
                    aria-label={`Sell crates of ${m.name}`}
                    inputMode="numeric"
                    disabled={m.sellable === 0}
                    value={sell[m.key] ?? ""}
                    onChange={(e) => setSell({ ...sell, [m.key]: e.target.value.replace(/\D/g, "") })}
                    style={{ ...input, opacity: m.sellable === 0 ? 0.35 : 1 }}
                  />
                  {m.held > 0 && m.sellable < m.held && (
                    <div style={{ fontSize: 9, lineHeight: 1.2, color: "#e4c04d" }}>
                      {m.sellable > 0 ? `${m.sellable} sellable here` : "can't sell here"}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 10px",
            borderTop: "1px solid #3d4a41"
          }}
        >
          <div style={{ fontSize: 12, lineHeight: 1.5, color: "#d4cab2" }}>
            Buying: <strong style={{ color: "#f7efdb" }}>{gbp(buyTotal)}</strong>
            <br />
            Selling: <strong style={{ color: "#7fe08f" }}>{gbp(sellTotal)}</strong>
          </div>
          {!data.jailed && (
            <button
              type="button"
              style={{ ...pillBtn, opacity: busy ? 0.55 : 1 }}
              disabled={busy}
              onClick={complete}
            >
              Complete transaction!
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

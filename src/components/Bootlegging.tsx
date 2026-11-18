"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

type Car = {
  id: string;
  name: string;
  plate: string;
  boot: number;
  cargo: Record<string, number>;
  used: number;
};

type Row = {
  key: string;
  name: string;
  price: number;
  low: number;
  high: number;
  tag: "low" | "fair" | "high";
};

type Data = {
  city: string;
  money: number;
  jailed: boolean;
  cars: Car[];
  market: Row[];
};

const bar: CSSProperties = {
  padding: "6px 8px",
  fontFamily: "Georgia, serif",
  fontSize: 15,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};

const box: CSSProperties = {
  border: "1px solid #6b5d3a",
  background: "#1f2a25",
  padding: "6px 8px"
};

const input: CSSProperties = {
  height: 30,
  padding: "0 8px",
  border: "1px solid #a08340",
  borderRadius: 0,
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16,
  minWidth: 0
};

const small: CSSProperties = { padding: "5px 12px", fontSize: 12, flexShrink: 0 };

const tagStyle: Record<Row["tag"], CSSProperties> = {
  low: { color: "#7fe08f", border: "1px solid #3f8a4d" },
  fair: { color: "#b7ad93", border: "1px solid #55452e" },
  high: { color: "#e4c04d", border: "1px solid #8a7038" }
};

const tagLabel: Record<Row["tag"], string> = { low: "Low", fair: "Fair", high: "High" };

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

export default function BootleggingSection({ onCash }: { onCash: (money: number) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [carId, setCarId] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
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
      setCarId((cur) => (d.cars.some((c) => c.id === cur) ? cur : d.cars[0]?.id ?? ""));
    } catch {
      /* keep what is on screen */
    }
  }, [onCash]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 60000);
    return () => window.clearInterval(t);
  }, [load]);

  async function trade(action: "buy" | "sell", booze: string) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/game/bootlegging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, carId, booze, qty: qty[booze] || "1" })
      });
      const j = await r.json().catch(() => ({}));
      setGood(r.ok);
      setMessage(r.ok ? String(j.message ?? "Done.") : String(j.error ?? "That did not work."));
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

  const car = data.cars.find((c) => c.id === carId);

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Bootlegging · {data.city}</div>

      <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
        {data.cars.length === 0 ? (
          <div style={{ ...box, fontSize: 12, color: "#e08f7f", lineHeight: 1.4 }}>
            You have no car in {data.city}. Spirits go in a car&apos;s boot, and the railway
            can&apos;t carry them. Steal one through Auto Theft, or drive one here.
          </div>
        ) : (
          <div style={box}>
            <select
              aria-label="Car"
              value={carId}
              onChange={(e) => setCarId(e.target.value)}
              style={{ ...input, width: "100%" }}
            >
              {data.cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.plate ? ` (${c.plate})` : ""} · {c.used}/{c.boot} crates
                </option>
              ))}
            </select>
          </div>
        )}

        {message && (
          <p className="notice" style={{ margin: "2px 0", color: good ? "#7fe08f" : "#f09a8c" }}>
            {message}
          </p>
        )}

        {data.market.map((m) => {
          const held = car?.cargo[m.key] ?? 0;

          return (
            <div key={m.key} style={box}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 14, color: "#f7efdb" }}>
                    {m.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#b7ad93" }}>
                    {held > 0 ? `${held} in the boot` : "None in the boot"}
                  </div>
                </div>

                <span style={{ ...tagStyle[m.tag], padding: "1px 6px", fontSize: 10 }}>
                  {tagLabel[m.tag]}
                </span>
                <strong style={{ fontSize: 14, color: "#f7efdb", minWidth: 52, textAlign: "right" }}>
                  {gbp(m.price)}
                </strong>
              </div>

              {car && !data.jailed && (
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input
                    aria-label={`Crates of ${m.name}`}
                    inputMode="numeric"
                    placeholder="1"
                    value={qty[m.key] ?? ""}
                    onChange={(e) => setQty({ ...qty, [m.key]: e.target.value.replace(/\D/g, "") })}
                    style={{ ...input, width: 56, textAlign: "center", paddingLeft: 2, paddingRight: 2 }}
                  />
                  <button
                    className="button"
                    style={{ ...small, flex: 1, opacity: busy ? 0.55 : 1 }}
                    disabled={busy}
                    onClick={() => trade("buy", m.key)}
                  >
                    Buy
                  </button>
                  <button
                    className="button secondary"
                    style={{ ...small, flex: 1, opacity: busy || held === 0 ? 0.55 : 1 }}
                    disabled={busy || held === 0}
                    onClick={() => trade("sell", m.key)}
                  >
                    Sell
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#b7ad93", textAlign: "center", lineHeight: 1.4 }}>
          Prices differ in every city. Buy where it&apos;s low, drive the car to another city,
          and sell where it&apos;s high.
        </p>
      </div>
    </div>
  );
}

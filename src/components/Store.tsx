"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { StoreItem } from "@/lib/store";

type Item = StoreItem & { owned: boolean };

type Data = {
  money: number;
  garageSlots: number;
  protection: number;
  protectionCap: number;
  garageCap: number;
  items: Item[];
};

type Tab = "gun" | "protection" | "garage";

const TABS: { key: Tab; label: string }[] = [
  { key: "gun", label: "Guns" },
  { key: "protection", label: "Protection" },
  { key: "garage", label: "Garages" }
];

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

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
  padding: "7px 8px",
  display: "flex",
  alignItems: "center",
  gap: 8
};

export default function StoreSection({ onCash }: { onCash: (money: number) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("gun");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [good, setGood] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/store", { cache: "no-store" });
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
  }, [load]);

  async function buy(item: Item) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind, key: item.key })
      });
      const j = await r.json().catch(() => ({}));
      setGood(r.ok);
      if (r.ok) {
        setData(j as Data);
        onCash((j as Data).money);
        setMessage(String(j.message ?? "Bought."));
      } else {
        setMessage(String(j.error ?? "That did not work."));
      }
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
        <div style={bar}>Store</div>
        <p className="flavour">Loading…</p>
      </div>
    );
  }

  const list = data.items.filter((i) => i.kind === tab);

  function stat(i: Item) {
    if (i.kind === "gun") {
      return `Attack ${i.value}${i.detail ? ` · ${i.detail}` : ""}${i.strength ? ` · Needs Strength ${i.strength}` : ""}`;
    }
    if (i.kind === "protection") return `+${i.value}% protection`;
    return `+${i.value} car spaces`;
  }

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Store</div>

      <div style={{ display: "flex", marginTop: 6 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setMessage("");
            }}
            style={{
              flex: 1,
              padding: "8px 0",
              fontFamily: "Georgia, serif",
              fontSize: 14,
              cursor: "pointer",
              color: tab === t.key ? "#f7efdb" : "#b7ad93",
              background: tab === t.key ? "linear-gradient(180deg, #8a7038, #4d3d1c)" : "#17201c",
              border: "1px solid #6b5d3a"
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
        {tab === "protection" && (
          <div style={{ fontSize: 12, color: "#d4cab2", textAlign: "center" }}>
            Your protection: <strong>{data.protection}%</strong> (maximum {data.protectionCap}%)
          </div>
        )}
        {tab === "garage" && (
          <div style={{ fontSize: 12, color: "#d4cab2", textAlign: "center" }}>
            Your garage holds <strong>{data.garageSlots}</strong> cars (maximum {data.garageCap})
          </div>
        )}

        {message && (
          <p className="notice" style={{ margin: "2px 0", color: good ? "#7fe08f" : "#f09a8c" }}>
            {message}
          </p>
        )}

        {list.map((i) => (
          <div key={i.key} style={box}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 14, color: "#f7efdb" }}>{i.name}</div>
              <div style={{ fontSize: 11, color: "#c9bfa6" }}>{stat(i)}</div>
              <div style={{ fontSize: 11, color: "#8f8873" }}>{i.note}</div>
            </div>
            {i.owned ? (
              <span style={{ fontSize: 12, color: "#7fe08f", flexShrink: 0 }}>Owned</span>
            ) : (
              <button
                className="button"
                style={{ padding: "5px 10px", fontSize: 12, flexShrink: 0, opacity: busy || data.money < i.price ? 0.55 : 1 }}
                disabled={busy || data.money < i.price}
                onClick={() => buy(i)}
              >
                {gbp(i.price)}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

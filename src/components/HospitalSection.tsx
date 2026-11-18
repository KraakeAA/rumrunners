"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

type Data = { health: number; money: number; costPerPoint: number; cost: number };

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

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
const box: CSSProperties = { border: "1px solid #6b5d3a", background: "#1f2a25", padding: "8px 10px", fontSize: 13 };

export default function HospitalSection({ onCash }: { onCash?: (money: number) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/hospital", { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(d.error ?? "The hospital could not be reached."));
        return;
      }
      setData(d);
    } catch {
      setError("Unable to connect. Please try again.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function heal() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/hospital", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(d.error ?? "That could not be completed."));
      } else {
        setData(d);
        setMessage(String(d.message ?? ""));
        if (typeof d.money === "number") onCash?.(d.money);
      }
    } catch {
      setError("Unable to connect. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Hospital</div>
      <div style={{ ...box, borderTop: 0 }}>
        {data ? (
          <>
            <p style={{ margin: "0 0 6px" }}>
              Your health is <strong>{data.health}%</strong>. You heal slowly by yourself, one point every three
              minutes. The doctors will patch you up straight away for {gbp(data.costPerPoint)} a point.
            </p>
            {data.health < 100 ? (
              <button
                type="button"
                className="button"
                disabled={busy || data.money < data.cost}
                style={{ opacity: busy || data.money < data.cost ? 0.55 : 1 }}
                onClick={heal}
              >
                {data.money < data.cost ? `Can't afford ${gbp(data.cost)}` : `Heal fully for ${gbp(data.cost)}`}
              </button>
            ) : (
              <p style={{ margin: 0, color: "#9be39f" }}>You are in perfect health.</p>
            )}
          </>
        ) : (
          <p style={{ margin: 0, color: "#b7ad93" }}>{error || "Loading…"}</p>
        )}
      </div>
      {error && data && <p className="notice" style={{ color: "#f09a8c" }}>{error}</p>}
      {message && <p className="notice" style={{ color: "#9be39f" }}>{message}</p>}
    </div>
  );
}

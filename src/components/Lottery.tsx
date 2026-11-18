"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

type Data = {
  money: number;
  drawAt: string;
  ticketPrice: number;
  maxTickets: number;
  houseCut: number;
  tickets: number;
  mine: number;
  pot: number;
  prize: number;
  last: { drawAt: string; prize: number; winner: string | null; tickets: number } | null;
};

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
const box: CSSProperties = { border: "1px solid #6b5d3a", background: "#1f2a25", padding: "8px 10px" };
const input: CSSProperties = {
  height: 32,
  width: 70,
  padding: "0 6px",
  border: "1px solid #a08340",
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16,
  textAlign: "center"
};

function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${String(s % 60).padStart(2, "0")}s`;
}

export default function LotterySection({ onCash }: { onCash: (money: number) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [good, setGood] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/game/lottery", { cache: "no-store" });
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
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    const u = window.setInterval(load, 60000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(u);
    };
  }, [load]);

  // The draw has just passed: fetch the fresh pot.
  useEffect(() => {
    if (data && new Date(data.drawAt).getTime() <= now) load();
  }, [data, now, load]);

  async function buy() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/game/lottery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty: Number(qty) || 1 })
      });
      const j = await r.json().catch(() => ({}));
      setGood(r.ok);
      if (r.ok) {
        setData(j as Data);
        onCash((j as Data).money);
        setMessage(String(j.message ?? "Done."));
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
        <div style={bar}>Lottery</div>
        <p className="flavour">Loading…</p>
      </div>
    );
  }

  const left = new Date(data.drawAt).getTime() - now;
  const drawLabel = new Date(data.drawAt).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Lottery</div>

      <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
        <div style={{ ...box, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#c9bfa6" }}>Next draw · {drawLabel}</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "#f7efdb", margin: "2px 0" }}>
            {countdown(left)}
          </div>
          <div style={{ fontSize: 13, color: "#d4cab2" }}>
            Prize for the winner: <strong style={{ color: "#e4c04d" }}>{gbp(data.prize)}</strong>
          </div>
          <div style={{ fontSize: 11, color: "#8f8873" }}>
            {data.tickets.toLocaleString("en-GB")} ticket{data.tickets === 1 ? "" : "s"} sold · pot{" "}
            {gbp(data.pot)} · the house keeps {Math.round(data.houseCut * 100)}%
          </div>
        </div>

        <div style={box}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            Tickets cost {gbp(data.ticketPrice)} each. You hold <strong>{data.mine}</strong> (up to{" "}
            {data.maxTickets} per draw).
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              style={input}
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
            />
            <button
              type="button"
              className="button"
              style={{ padding: "6px 14px", fontSize: 13, opacity: busy ? 0.55 : 1 }}
              disabled={busy}
              onClick={buy}
            >
              Buy tickets ({gbp((Number(qty) || 0) * data.ticketPrice)})
            </button>
          </div>
          {message && (
            <p className="notice" style={{ margin: "6px 0 0", color: good ? "#7fe08f" : "#f09a8c" }}>
              {message}
            </p>
          )}
        </div>

        <div style={{ ...box, fontSize: 12, color: "#c9bfa6" }}>
          {data.last ? (
            <>
              Last draw: <strong style={{ color: "#f7efdb" }}>{data.last.winner ?? "no one"}</strong> won{" "}
              {gbp(data.last.prize)} from {data.last.tickets.toLocaleString("en-GB")} tickets.
            </>
          ) : (
            "No draw has been made yet."
          )}
          <div style={{ marginTop: 4 }}>
            One pot for everyone, drawn every Wednesday at 8pm. Every ticket has an equal chance, and
            everyone who played gets a letter with the result.
          </div>
        </div>
      </div>
    </div>
  );
}

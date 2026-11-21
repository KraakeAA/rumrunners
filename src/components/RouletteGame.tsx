"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type Played = { takeover: boolean; previousOwner: string | null; payout: number };

type Bet = { type: string; number?: number; amount: number };

type Spin = {
  result: number;
  win: boolean;
  payout: number;
  bet: number;
  money?: number;
  takeover?: boolean;
  previousOwner?: string | null;
};

const GOLD = "#b0904a";
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// The order of the pockets round a European wheel, starting from zero.
const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];
const STEP = 360 / WHEEL.length;
const SPIN_MS = 4000;

const CHIPS = [10, 100, 1_000, 10_000, 100_000, 1_000_000];
const CHIP_COLOURS: Record<number, string> = {
  10: "#2f6fb5",
  100: "#2a8a4a",
  1000: "#b03030",
  10000: "#6b3fa0",
  100000: "#c9a227",
  1000000: "#222222"
};

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;
const short = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}m` : n >= 1_000 ? `${+(n / 1_000).toFixed(1)}k` : String(n);

const colourOf = (n: number) => (n === 0 ? "#1f6b3a" : REDS.has(n) ? "#9c1f1f" : "#161616");

const keyOf = (type: string, number?: number) => (type === "number" ? `number:${number}` : type);
const labelOf = (b: Bet) =>
  b.type === "number"
    ? `number ${b.number}`
    : (
        {
          red: "Red", black: "Black", odd: "Odd", even: "Even", low: "1-18", high: "19-36",
          dozen1: "1st 12", dozen2: "2nd 12", dozen3: "3rd 12", col1: "Column 1", col2: "Column 2", col3: "Column 3"
        } as Record<string, string>
      )[b.type] ?? b.type;

const pt = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(100 + r * Math.sin(a)).toFixed(2)},${(100 - r * Math.cos(a)).toFixed(2)}`;
};

function WheelFace() {
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" style={{ display: "block" }}>
      <circle cx="100" cy="100" r="99" fill="#4a2f17" stroke={GOLD} strokeWidth="2" />
      {WHEEL.map((n, i) => {
        const a0 = (i - 0.5) * STEP;
        const a1 = (i + 0.5) * STEP;
        return (
          <g key={n}>
            <path
              d={`M ${pt(58, a0)} L ${pt(92, a0)} A 92 92 0 0 1 ${pt(92, a1)} L ${pt(58, a1)} A 58 58 0 0 0 ${pt(58, a0)} Z`}
              fill={colourOf(n)}
              stroke="#d9c38a"
              strokeWidth="0.5"
            />
            <text
              x="100"
              y="22"
              fontSize="9"
              fontFamily="Georgia, serif"
              fill="#f7efdb"
              textAnchor="middle"
              transform={`rotate(${i * STEP} 100 100)`}
            >
              {n}
            </text>
          </g>
        );
      })}
      <circle cx="100" cy="100" r="56" fill="#2a1a0c" stroke={GOLD} strokeWidth="1.5" />
      <circle cx="100" cy="100" r="40" fill="#5a4326" stroke="#d9c38a" strokeWidth="1" />
      <circle cx="100" cy="100" r="9" fill="#d9c38a" />
      <path d="M100 62 L100 138 M62 100 L138 100" stroke="#d9c38a" strokeWidth="2.4" />
    </svg>
  );
}

export default function RouletteGame({
  limit,
  onCash,
  onPlayed
}: {
  limit: number;
  onCash: (cash: number) => void;
  onPlayed?: (info: Played) => void;
}) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [chip, setChip] = useState(10);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [rot, setRot] = useState(0);
  const [spinId, setSpinId] = useState(0);
  const [shown, setShown] = useState<Spin | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [lastBets, setLastBets] = useState<Bet[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const total = bets.reduce((sum, b) => sum + b.amount, 0);
  const chipsAvailable = CHIPS.filter((c) => c <= limit);

  function place(type: string, number?: number) {
    if (busy) return;
    setMessage("");
    if (total + chip > limit) {
      setMessage(`The maximum bet here is ${gbp(limit)}.`);
      return;
    }
    setBets((prev) => {
      const key = keyOf(type, number);
      const at = prev.findIndex((b) => keyOf(b.type, b.number) === key);
      if (at === -1) return [...prev, { type, number, amount: chip }];
      return prev.map((b, i) => (i === at ? { ...b, amount: b.amount + chip } : b));
    });
  }

  function undo() {
    if (busy) return;
    setBets((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.amount > chip) return prev.map((b, i) => (i === prev.length - 1 ? { ...b, amount: b.amount - chip } : b));
      return prev.slice(0, -1);
    });
  }

  async function spin() {
    if (busy) return;
    if (bets.length === 0) {
      setMessage("Tap the table to place a bet, then tap the wheel.");
      return;
    }
    setBusy(true);
    setMessage("");
    setShown(null);

    let d: (Spin & { error?: string }) | null = null;
    try {
      const r = await fetch("/api/game/roulette", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bets: bets.map((b) => ({ type: b.type, number: b.number, amount: b.amount })) })
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMessage(String(body.error ?? "That did not work."));
      } else {
        d = body;
      }
    } catch {
      setMessage("Unable to connect. Please try again.");
    }

    if (!d) {
      setBusy(false);
      return;
    }

    // Turn the wheel so the winning pocket stops under the pointer at the top.
    const index = WHEEL.indexOf(d.result);
    const want = -index * STEP;
    const delta = (((want - rot) % 360) + 360) % 360;
    setRot(rot + 360 * 5 + delta);
    setSpinId((n) => n + 1);

    const result = d;
    setLastBets(bets);
    timer.current = setTimeout(() => {
      setShown(result);
      setHistory((h) => [result.result, ...h].slice(0, 14));
      setBets([]);
      if (typeof result.money === "number") onCash(result.money);
      onPlayed?.({
        takeover: Boolean(result.takeover),
        previousOwner: result.previousOwner ?? null,
        payout: result.payout ?? 0
      });
      setBusy(false);
    }, SPIN_MS + 150);
  }

  const cell = (bg: string, chosen: boolean, landed: boolean): CSSProperties => ({
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    margin: 0,
    minWidth: 0,
    background: bg,
    color: "#f7efdb",
    fontFamily: "Georgia, serif",
    fontSize: 14,
    lineHeight: 1.1,
    cursor: busy ? "default" : "pointer",
    border: "1px solid rgba(176,144,74,0.55)",
    boxSizing: "border-box",
    outline: chosen ? "2px solid #ffe08a" : "none",
    outlineOffset: -2,
    boxShadow: landed ? "inset 0 0 0 3px #ffffff, inset 0 0 14px 4px rgba(255,255,255,0.55)" : "none",
    zIndex: chosen ? 2 : 1,
    WebkitTapHighlightColor: "rgba(255,224,138,0.3)"
  });

  const amountOn = (type: string, number?: number) => {
    const b = bets.find((x) => keyOf(x.type, x.number) === keyOf(type, number));
    return b ? b.amount : 0;
  };

  const badge = (amount: number) =>
    amount > 0 ? (
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 2,
          top: 2,
          minWidth: 20,
          padding: "1px 4px",
          borderRadius: 10,
          boxSizing: "border-box",
          background: "radial-gradient(circle at 35% 30%, #fff2a8, #e4b822 60%, #9a7410)",
          border: "1px solid #5a4306",
          color: "#2a1c00",
          fontFamily: "Arial, sans-serif",
          fontSize: 10,
          fontWeight: 700,
          lineHeight: "13px",
          textAlign: "center"
        }}
      >
        {short(amount)}
      </span>
    ) : null;

  const landed = shown ? shown.result : null;

  return (
    <div style={{ padding: "4px 8px 12px" }}>
      <style>{`@keyframes rg-ball { from { transform: rotate(0deg); } to { transform: rotate(-1800deg); } }`}</style>

      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "stretch" }}>
        {/* The wheel: tap it to spin */}
        <button
          type="button"
          onClick={spin}
          disabled={busy}
          aria-label="Spin the wheel"
          style={{
            position: "relative",
            flex: "0 0 48%",
            aspectRatio: "1",
            padding: 0,
            border: 0,
            background: "transparent",
            cursor: busy ? "default" : "pointer",
            WebkitTapHighlightColor: "transparent"
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `rotate(${rot}deg)`,
              transition: spinId === 0 ? "none" : `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.6, 0.1, 1)`
            }}
          >
            <WheelFace />
          </div>

          {/* The ball runs the other way and settles at the top */}
          <div
            key={spinId}
            style={{
              position: "absolute",
              inset: 0,
              animation: spinId === 0 ? "none" : `rg-ball ${SPIN_MS}ms cubic-bezier(0.12, 0.6, 0.1, 1) forwards`
            }}
          >
            <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" style={{ display: "block" }}>
              <circle cx="100" cy="30" r="5" fill="#fbfbf5" stroke="#999" strokeWidth="0.8" />
            </svg>
          </div>

          {/* Pointer */}
          <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
            <path d="M92 0 L108 0 L100 12 Z" fill="#ffe08a" stroke="#5a4306" strokeWidth="1" />
          </svg>

          {!busy && !shown && (
            <span
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                padding: "3px 7px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.7)",
                color: "#ffe08a",
                fontSize: 11,
                fontFamily: "Georgia, serif",
                letterSpacing: 1
              }}
            >
              SPIN
            </span>
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              padding: "5px 6px",
              textAlign: "center",
              fontSize: 12,
              lineHeight: 1.35,
              color: "#2a1c00",
              background: "linear-gradient(180deg, #e8dcb5, #c9b98a)",
              border: "1px solid #7a6330",
              borderRadius: 3
            }}
          >
            <strong>Maximum bet</strong>
            <div>{gbp(limit)}</div>
            <strong>Current bet</strong>
            <div style={{ color: "#8a1f1f", fontWeight: 700 }}>{gbp(total)}</div>
          </div>

          <div style={{ flex: 1, border: `1px solid ${GOLD}`, borderRadius: 3, overflow: "hidden", background: "#0e1411", display: "flex", flexDirection: "column" }}>
            <div
              style={{
                flex: 1,
                display: "grid",
                placeItems: "center",
                background: shown ? colourOf(shown.result) : "#1a241f",
                color: "#f7efdb",
                fontFamily: "Georgia, serif",
                fontSize: 40,
                minHeight: 52
              }}
            >
              {busy && !shown ? "…" : shown ? shown.result : "?"}
            </div>
            <div
              style={{
                padding: "3px 2px",
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1,
                background: "#1b0f0f",
                color: shown ? (shown.win ? "#7fe08f" : "#f0c2b8") : "#b7ad93"
              }}
            >
              {shown ? (shown.win ? "WIN!" : "LOSE!") : "—"}
            </div>
            <div style={{ padding: "2px 2px 3px", textAlign: "center", fontSize: 12, color: "#e8e0d4" }}>
              {shown ? `${shown.payout - shown.bet >= 0 ? "+" : "-"}${gbp(Math.abs(shown.payout - shown.bet))}` : " "}
            </div>
          </div>
        </div>
      </div>

      {/* Past results */}
      <div style={{ display: "flex", gap: 3, marginTop: 6, minHeight: 22, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#b7ad93", marginRight: 2 }}>Last:</span>
        {history.length === 0 && <span style={{ fontSize: 11, color: "#6f6a58" }}>no spins yet</span>}
        {history.map((n, i) => (
          <span
            key={i}
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: colourOf(n),
              border: "1px solid #b0904a",
              color: "#f7efdb",
              fontSize: 11
            }}
          >
            {n}
          </span>
        ))}
      </div>

      {message && (
        <p role="alert" className="notice" style={{ margin: "6px 0 0", textAlign: "center" }}>
          {message}
        </p>
      )}

      {/* The table */}
      <div
        role="group"
        aria-label="Roulette table"
        style={{
          display: "grid",
          gridTemplateColumns: "50px 32px 1fr 1fr 1fr",
          gridTemplateRows: "36px repeat(12, 34px) 34px",
          marginTop: 8,
          padding: 4,
          background: "#173a25",
          border: `2px solid ${GOLD}`,
          borderRadius: 4
        }}
      >
        <button
          type="button"
          disabled={busy}
          aria-label="Number 0"
          onClick={() => place("number", 0)}
          style={{ ...cell("#1f6b3a", amountOn("number", 0) > 0, landed === 0), gridColumn: "3 / span 3", gridRow: 1, fontSize: 18 }}
        >
          0{badge(amountOn("number", 0))}
        </button>

        {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            aria-label={`Number ${n}`}
            onClick={() => place("number", n)}
            style={{
              ...cell(REDS.has(n) ? "#8e1f1f" : "#151515", amountOn("number", n) > 0, landed === n),
              gridColumn: ((n - 1) % 3) + 3,
              gridRow: Math.ceil(n / 3) + 1,
              fontSize: 16
            }}
          >
            {n}
            {badge(amountOn("number", n))}
          </button>
        ))}

        {[
          { type: "dozen1", label: "1st 12" },
          { type: "dozen2", label: "2nd 12" },
          { type: "dozen3", label: "3rd 12" }
        ].map((d, i) => (
          <button
            key={d.type}
            type="button"
            disabled={busy}
            aria-label={`${d.label}, pays 2 to 1`}
            onClick={() => place(d.type)}
            style={{ ...cell("#23402d", amountOn(d.type) > 0, false), gridColumn: 2, gridRow: `${2 + i * 4} / span 4`, fontSize: 12 }}
          >
            <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", letterSpacing: 1 }}>{d.label}</span>
            {badge(amountOn(d.type))}
          </button>
        ))}

        {[
          { type: "low", label: "1-18", bg: "#23402d" },
          { type: "even", label: "Even", bg: "#23402d" },
          { type: "red", label: "Red", bg: "#8e1f1f" },
          { type: "black", label: "Black", bg: "#151515" },
          { type: "odd", label: "Odd", bg: "#23402d" },
          { type: "high", label: "19-36", bg: "#23402d" }
        ].map((o, i) => (
          <button
            key={o.type}
            type="button"
            disabled={busy}
            aria-label={`${o.label}, pays 1 to 1`}
            onClick={() => place(o.type)}
            style={{ ...cell(o.bg, amountOn(o.type) > 0, false), gridColumn: 1, gridRow: `${2 + i * 2} / span 2`, fontSize: 12 }}
          >
            {o.label}
            {badge(amountOn(o.type))}
          </button>
        ))}

        {["col1", "col2", "col3"].map((c, i) => (
          <button
            key={c}
            type="button"
            disabled={busy}
            aria-label={`Column ${i + 1}, pays 2 to 1`}
            onClick={() => place(c)}
            style={{ ...cell("#23402d", amountOn(c) > 0, false), gridColumn: i + 3, gridRow: 14, fontSize: 13 }}
          >
            2:1
            {badge(amountOn(c))}
          </button>
        ))}
      </div>

      {/* Chips */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>
        {chipsAvailable.map((c) => (
          <button
            key={c}
            type="button"
            disabled={busy}
            aria-label={`Chip of ${gbp(c)}`}
            aria-pressed={chip === c}
            onClick={() => setChip(c)}
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              border: chip === c ? "3px solid #ffe08a" : "3px dashed rgba(255,255,255,0.7)",
              background: CHIP_COLOURS[c],
              color: "#fff",
              fontFamily: "Arial, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
              boxShadow: chip === c ? "0 0 10px rgba(255,224,138,0.8)" : "none"
            }}
          >
            {short(c)}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" style={smallBtn} disabled={busy || bets.length === 0} onClick={undo}>
          Undo
        </button>
        <button type="button" style={smallBtn} disabled={busy || bets.length === 0} onClick={() => setBets([])}>
          Clear
        </button>
        <button
          type="button"
          style={smallBtn}
          disabled={busy || lastBets.length === 0}
          onClick={() => {
            const sum = lastBets.reduce((s, b) => s + b.amount, 0);
            if (sum > limit) return setMessage(`The maximum bet here is ${gbp(limit)}.`);
            setMessage("");
            setBets(lastBets.map((b) => ({ ...b })));
          }}
        >
          Repeat last
        </button>
        <button type="button" style={{ ...smallBtn, minWidth: 90 }} disabled={busy} onClick={spin}>
          Spin
        </button>
      </div>

      {bets.length > 0 && (
        <p style={{ margin: "8px 0 0", fontSize: 12, textAlign: "center", color: "#d4d0c4" }}>
          {bets.map((b) => `${gbp(b.amount)} on ${labelOf(b)}`).join(" · ")}
        </p>
      )}
      <p style={{ margin: "6px 0 0", fontSize: 11, textAlign: "center", color: "#8d8878" }}>
        Single numbers pay 35 to 1. Dozens and columns pay 2 to 1. Everything else pays 1 to 1.
      </p>
    </div>
  );
}

const smallBtn: CSSProperties = {
  minHeight: 40,
  padding: "6px 14px",
  border: "1px solid #b0904a",
  borderRadius: 3,
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  color: "#f7efdb",
  fontSize: 14,
  cursor: "pointer"
};

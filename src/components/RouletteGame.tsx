"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type Played = { takeover: boolean; previousOwner: string | null; payout: number };

type Bet = { type: string; number?: number; amount: number };
type PlacedChip = { type: string; number?: number; value: number };

// The most chips that can sit on one spot of the table, whatever they are worth.
const MAX_CHIPS_PER_SPOT = 25;

type Spin = {
  result: number;
  win: boolean;
  payout: number;
  bet: number;
  money?: number;
  takeover?: boolean;
  previousOwner?: string | null;
};

const IVORY = "#f3e9cf";
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// The order of the pockets round a European wheel, starting from zero.
const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];
const STEP = 360 / WHEEL.length;
const SPIN_MS = 3000;

const CHIPS = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000, 100_000_000];
const CHIP_COLOURS: Record<number, string> = {
  1: "#6d6a62",
  10: "#27527a",
  100: "#2a6b45",
  1000: "#7d1f2b",
  10000: "#4e3478",
  100000: "#9a7a2a",
  1000000: "#1b1816",
  100000000: "#5c1a48"
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

// ---- The artwork ------------------------------------------------------------------------
// public/images/roulette/roulette-table.png (1800 x 1600) and roulette-wheel.png.
// Everything that changes is laid on top of the picture. All the numbers below are
// positions measured on the 1800 x 1600 picture.
const ART_W = 1800;
const ART_H = 1600;
const TABLE_SRC = "/images/roulette/roulette-table.png";
const WHEEL_SRC = "/images/roulette/roulette-wheel.png";

// The bowl the wheel sits in (an ellipse, seen at an angle).
const BOWL = { cx: 382, cy: 418, w: 572, squash: 0.677 };

// Horizontal gold lines between the three number rows and the bottom of the block.
const ROW_Y = [791, 896, 1006, 1123];

// The 13 gold lines that run down the 12 number columns, measured at four heights.
const LINE_Y = [805, 905, 1015, 1115];
const NUM_LINES: number[][] = [
  [282, 262, 241, 221],
  [390, 375, 359, 345],
  [494, 483, 470, 459],
  [600, 591, 581, 572],
  [704, 697, 691, 684],
  [807, 803, 799, 796],
  [910, 909, 908, 907],
  [1015, 1017, 1018, 1019],
  [1120, 1123, 1127, 1131],
  [1223, 1229, 1237, 1243],
  [1324, 1334, 1345, 1354],
  [1426, 1439, 1453, 1466],
  [1529, 1548, 1568, 1587]
];
const ZERO_LEFT = [160, 131, 102, 76];
const BLOCK_RIGHT = [1665, 1689, 1714, 1736];

type P = [number, number];

// x on a line at height y, from samples taken at LINE_Y (extends the line if y is outside them).
function xAt(samples: number[], y: number): number {
  const n = LINE_Y.length;
  const i = y <= LINE_Y[0] ? 0 : y >= LINE_Y[n - 1] ? n - 2 : LINE_Y.findIndex((v, k) => y >= v && y < LINE_Y[k + 1]);
  const t = (y - LINE_Y[i]) / (LINE_Y[i + 1] - LINE_Y[i]);
  return samples[i] + (samples[i + 1] - samples[i]) * t;
}

// A line through two measured points.
const through = (y0: number, x0: number, y1: number, x1: number) => (y: number) => x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);

type Spot = { key: string; type: string; number?: number; label: string; pts: P[]; fill: string };

function quad(left: (y: number) => number, right: (y: number) => number, y0: number, y1: number): P[] {
  return [
    [left(y0), y0],
    [right(y0), y0],
    [right(y1), y1],
    [left(y1), y1]
  ];
}

function buildSpots(): Spot[] {
  const spots: Spot[] = [];

  // Zero
  spots.push({
    key: "number:0",
    type: "number",
    number: 0,
    label: "Number 0",
    fill: "#1f6b3a",
    pts: quad((y) => xAt(ZERO_LEFT, y), (y) => xAt(NUM_LINES[0], y), ROW_Y[0], ROW_Y[3])
  });

  // 1-36, three to a column: the top row is 3, 6, 9... the bottom row is 1, 4, 7...
  for (let c = 0; c < 12; c++) {
    for (let r = 0; r < 3; r++) {
      const n = c * 3 + (3 - r);
      spots.push({
        key: `number:${n}`,
        type: "number",
        number: n,
        label: `Number ${n}`,
        fill: REDS.has(n) ? "#9c1f1f" : "#161616",
        pts: quad((y) => xAt(NUM_LINES[c], y), (y) => xAt(NUM_LINES[c + 1], y), ROW_Y[r], ROW_Y[r + 1])
      });
    }
  }

  // 2 to 1 at the end of each row (top row = column 3, bottom row = column 1)
  ["col3", "col2", "col1"].forEach((t, r) => {
    spots.push({
      key: t,
      type: t,
      label: `Column ${t.slice(3)}, pays 2 to 1`,
      fill: "#23402d",
      pts: quad((y) => xAt(NUM_LINES[12], y), (y) => xAt(BLOCK_RIGHT, y), ROW_Y[r], ROW_Y[r + 1])
    });
  });

  // Dozens
  const dozenLines = [
    through(1135, 168, 1245, 138),
    through(1135, 647, 1245, 641),
    through(1135, 1136, 1245, 1145),
    through(1135, 1633, 1245, 1660)
  ];
  ["dozen1", "dozen2", "dozen3"].forEach((t, i) => {
    spots.push({
      key: t,
      type: t,
      label: `${i + 1}${["st", "nd", "rd"][i]} 12, pays 2 to 1`,
      fill: "#23402d",
      pts: quad(dozenLines[i], dozenLines[i + 1], 1127, 1253)
    });
  });

  // Outside bets
  const outLines = [
    through(1265, 132, 1385, 100),
    through(1265, 391, 1385, 374),
    through(1265, 640, 1385, 632),
    through(1265, 892, 1385, 892),
    through(1265, 1144, 1385, 1152),
    through(1265, 1408, 1385, 1426),
    through(1265, 1666, 1385, 1696)
  ];
  ["low", "even", "red", "black", "odd", "high"].forEach((t, i) => {
    spots.push({
      key: t,
      type: t,
      label: `${labelOf({ type: t, amount: 0 })}, pays 1 to 1`,
      fill: "#23402d",
      pts: quad(outLines[i], outLines[i + 1], 1259, 1394)
    });
  });

  return spots;
}

const SPOTS = buildSpots();
const centre = (pts: P[]): P => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
const pointsAttr = (pts: P[]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export default function RouletteGame({
  wealth,
  limit,
  cash,
  onCash,
  onPlayed
}: {
  wealth?: string | null;
  limit: number;
  cash: number;
  onCash: (cash: number) => void;
  onPlayed?: (info: Played) => void;
}) {
  const [stack, setStack] = useState<PlacedChip[]>([]);
  const [chip, setChip] = useState(10);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [rot, setRot] = useState(0);
  const [spinId, setSpinId] = useState(0);
  const [shown, setShown] = useState<Spin | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  // Every chip on the table, added up spot by spot.
  const bets: Bet[] = [];
  for (const c of stack) {
    const found = bets.find((b) => keyOf(b.type, b.number) === keyOf(c.type, c.number));
    if (found) found.amount += c.value;
    else bets.push({ type: c.type, number: c.number, amount: c.value });
  }
  const total = bets.reduce((sum, b) => sum + b.amount, 0);
  const chipsAvailable = CHIPS.filter((c) => c <= limit);

  function place(type: string, number?: number) {
    if (busy) return;
    setMessage("");
    const onSpot = stack.filter((c) => keyOf(c.type, c.number) === keyOf(type, number)).length;
    if (onSpot >= MAX_CHIPS_PER_SPOT) {
      setMessage(`You can only put ${MAX_CHIPS_PER_SPOT} chips on one spot.`);
      return;
    }
    if (total + chip > limit) {
      setMessage(`The maximum bet here is ${limit >= 2_000_000_000 ? "unlimited" : gbp(limit)}.`);
      return;
    }
    setStack((prev) => [...prev, { type, number, value: chip }]);
  }

  function undo() {
    if (busy) return;
    setStack((prev) => prev.slice(0, -1));
  }

  async function spin() {
    if (busy) return;
    if (bets.length === 0) {
      setMessage("Pick a chip and tap the table to place a bet first.");
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

    // The stake leaves the pocket straight away; the winnings arrive when the wheel stops.
    onCash(Math.max(0, cash - total));

    // Turn the wheel so the winning pocket stops under the pointer at the top.
    const index = WHEEL.indexOf(d.result);
    const want = -index * STEP;
    const delta = (((want - rot) % 360) + 360) % 360;
    setRot(rot + 360 * 5 + delta);
    setSpinId((n) => n + 1);

    const result = d;
    timer.current = setTimeout(() => {
      setShown(result);
      setHistory((h) => [result.result, ...h].slice(0, 14));
      if (typeof result.money === "number") onCash(result.money);
      onPlayed?.({
        takeover: Boolean(result.takeover),
        previousOwner: result.previousOwner ?? null,
        payout: result.payout ?? 0
      });
      setBusy(false);
    }, SPIN_MS + 150);
  }

  const amountOn = (key: string) => {
    const b = bets.find((x) => keyOf(x.type, x.number) === key);
    return b ? b.amount : 0;
  };

  const landed = shown ? shown.result : null;
  const net = shown ? shown.payout - shown.bet : 0;
  const text = (extra: CSSProperties): CSSProperties => ({ fontFamily: "Georgia, 'Times New Roman', serif", ...extra });

  return (
    <div style={{ padding: "4px 0 10px" }}>
      <style>{`@keyframes rg-ball { from { transform: rotate(0deg); } to { transform: rotate(-1800deg); } }
        @keyframes rg-strip { from { transform: translateX(0px); } to { transform: translateX(-3330px); } }
        .rg-strip { animation: rg-strip 1.1s linear infinite; }
        `}</style>

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 680,
          margin: "0 auto",
          aspectRatio: `${ART_W} / ${ART_H}`,
          backgroundColor: "#100d0c",
          overflow: "hidden"
        }}
      >
        {/* The picture of the table */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={TABLE_SRC}
          alt=""
          draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", userSelect: "none" }}
        />

        {/* The wheel, tilted to sit in its bowl. Tap it to spin. */}
        <button
          type="button"
          onClick={spin}
          disabled={busy}
          aria-label="Tap the wheel to spin"
          style={{
            position: "absolute",
            left: pct(BOWL.cx - BOWL.w / 2, ART_W),
            top: pct(BOWL.cy - BOWL.w / 2, ART_H),
            width: pct(BOWL.w, ART_W),
            height: pct(BOWL.w, ART_H),
            padding: 0,
            border: 0,
            background: "transparent",
            borderRadius: "50%",
            transform: `scaleY(${BOWL.squash})`,
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={WHEEL_SRC} alt="" draggable={false} style={{ width: "100%", height: "100%", display: "block" }} />
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
            <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" style={{ display: "block" }}>
              <circle cx="50" cy="14.5" r="2.4" fill="#fbfbf5" stroke="#8a8a80" strokeWidth="0.4" />
            </svg>
          </div>
        </button>

        {!busy && !shown && (
          <span
            style={text({
              position: "absolute",
              left: pct(BOWL.cx, ART_W),
              top: pct(BOWL.cy, ART_H),
              transform: "translate(-50%, -50%)",
              padding: "3px 8px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.72)",
              color: "#ffe08a",
              fontSize: "clamp(9px, 2.6vw, 13px)",
              letterSpacing: 0.5,
              whiteSpace: "nowrap",
              pointerEvents: "none"
            })}
          >
            TAP TO SPIN
          </span>
        )}

        {/* Hit areas, chips and the live figures, all in picture coordinates */}
        <svg
          viewBox={`0 0 ${ART_W} ${ART_H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          role="group"
          aria-label="Roulette table"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <defs>
            <linearGradient id="rg-fade-l" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#100d0c" stopOpacity="0.95" />
              <stop offset="1" stopColor="#100d0c" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="rg-fade-r" x1="1" x2="0" y1="0" y2="0">
              <stop offset="0" stopColor="#100d0c" stopOpacity="0.95" />
              <stop offset="1" stopColor="#100d0c" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Pointer above the wheel */}
          <polygon points={`${BOWL.cx - 22},${BOWL.cy - 205} ${BOWL.cx + 22},${BOWL.cy - 205} ${BOWL.cx},${BOWL.cy - 168}`} fill="#ffe08a" stroke="#5a4306" strokeWidth="4" />

          {/* How much the casino holds, as a wealth rank */}
          {wealth ? (
            <text x={ART_W - 30} y={ART_H - 36} textAnchor="end" dominantBaseline="central" fontSize="40" fill={IVORY} style={text({ fontWeight: 700 })}>
              Casino wealth: <tspan fill="#ffd36b">{wealth}</tspan>
            </text>
          ) : null}

          {/* Maximum and current bet */}
          <text x="1004" y="196" textAnchor="middle" dominantBaseline="central" fontSize="44" fill={IVORY} style={text({ fontWeight: 700 })}>
            {limit >= 2_000_000_000 ? "No limit" : gbp(limit)}
          </text>
          <text x="1004" y="322" textAnchor="middle" dominantBaseline="central" fontSize="44" fill="#ffd36b" style={text({ fontWeight: 700 })}>
            {gbp(total)}
          </text>

          {/* Result */}
          <rect x="772" y="428" width="472" height="168" rx="6" fill={shown ? colourOf(shown.result) : "#1a1210"} stroke="#c69a48" strokeWidth="3" />
          <text x="1008" y="516" textAnchor="middle" dominantBaseline="central" fontSize="150" fill={IVORY} style={text({ fontWeight: 700 })}>
            {busy && !shown ? "" : shown ? shown.result : "?"}
          </text>
          {busy && !shown && (
            <g aria-label="Spinning">
              <clipPath id="rg-box">
                <rect x="775" y="431" width="466" height="162" rx="5" />
              </clipPath>
              <g clipPath="url(#rg-box)">
                <g className="rg-strip">
                  {[0, 1, 2, 3].flatMap((rep) =>
                    WHEEL.map((n, i) => {
                      const x = 640 + (rep * WHEEL.length + i) * 90;
                      return (
                        <g key={`${rep}-${i}`}>
                          <rect x={x} y="440" width="86" height="144" rx="6" fill={colourOf(n)} stroke="#c69a48" strokeWidth="3" />
                          <text x={x + 43} y="512" textAnchor="middle" dominantBaseline="central" fontSize="58" fill={IVORY} style={text({ fontWeight: 700 })}>
                            {n}
                          </text>
                        </g>
                      );
                    })
                  )}
                </g>
                {/* Fades at the edges so the numbers blur past */}
                <rect x="775" y="431" width="90" height="162" fill="url(#rg-fade-l)" />
                <rect x="1151" y="431" width="90" height="162" fill="url(#rg-fade-r)" />
                {/* The marker the ball will stop under */}
                <polygon points="1008,431 1024,431 1008,452 992,431" fill="#ffe08a" stroke="#5a4306" strokeWidth="2" />
                <polygon points="1008,593 1024,593 1008,572 992,572" fill="none" />
              </g>
            </g>
          )}
          <rect
            x="772"
            y="614"
            width="472"
            height="64"
            rx="6"
            fill={shown ? (net >= 0 ? "#1f8a3a" : "#b32222") : "#2a1f1a"}
            stroke="#c69a48"
            strokeWidth="3"
          />
          <text
            x="1008"
            y="647"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="46"
            fill={shown ? "#ffffff" : "#b7ad93"}
            style={text({ fontWeight: 700, letterSpacing: 2 })}
          >
            {shown ? `${net >= 0 ? "WIN" : "LOSS"} ${gbp(Math.abs(net))}` : "—"}
          </text>

          {/* Recent numbers, newest at the top */}
          {history.slice(0, 8).map((n, i) => (
            <g key={i}>
              <rect
                x="1346"
                y={108 + i * 70}
                width="348"
                height="52"
                rx="6"
                fill={colourOf(n)}
                stroke={i === 0 ? "#ffe08a" : "#c69a48"}
                strokeWidth={i === 0 ? 5 : 2}
              />
              <text x="1520" y={108 + i * 70 + 27} textAnchor="middle" dominantBaseline="central" fontSize="40" fill={IVORY} style={text({ fontWeight: 700 })}>
                {n}
              </text>
            </g>
          ))}

          {/* The winning number lights up */}
          {landed !== null &&
            SPOTS.filter((s) => s.type === "number" && s.number === landed).map((s) => (
              <polygon key="landed" points={pointsAttr(s.pts)} fill="rgba(255,255,255,0.28)" stroke="#ffffff" strokeWidth="7" />
            ))}

          {/* Tap areas */}
          {SPOTS.map((s) => (
            <polygon
              key={s.key}
              points={pointsAttr(s.pts)}
              fill="transparent"
              stroke={amountOn(s.key) > 0 ? "#ffe08a" : "none"}
              strokeWidth="5"
              role="button"
              aria-label={s.label}
              onClick={() => place(s.type, s.number)}
              style={{ pointerEvents: busy ? "none" : "all", cursor: "pointer" }}
            />
          ))}

          {/* Chips on the table */}
          {SPOTS.filter((s) => amountOn(s.key) > 0).map((s) => {
            const [x, y] = centre(s.pts);
            const amount = amountOn(s.key);
            return (
              <g key={`chip-${s.key}`} style={{ pointerEvents: "none" }}>
                <circle cx={x} cy={y} r="40" fill="#e4b822" stroke="#5a4306" strokeWidth="4" />
                <circle cx={x} cy={y} r="31" fill="none" stroke="#fff2a8" strokeWidth="3" strokeDasharray="10 8" />
                <text x={x} y={y + 2} textAnchor="middle" dominantBaseline="central" fontSize={short(amount).length > 3 ? 27 : 32} fill="#2a1c00" style={{ fontFamily: "Arial, sans-serif", fontWeight: 700 }}>
                  {short(amount)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {message && (
        <p role="alert" className="notice" style={{ margin: "6px 10px 0", textAlign: "center" }}>
          {message}
        </p>
      )}

      {/* Chips */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginTop: 8, padding: "0 6px" }}>
        {chipsAvailable.map((c) => {
          const on = chip === c;
          const body = CHIP_COLOURS[c];
          return (
            <button
              key={c}
              type="button"
              disabled={busy}
              aria-label={`Chip of ${gbp(c)}`}
              aria-pressed={on}
              onClick={() => setChip(c)}
              style={{
                position: "relative",
                width: 34,
                height: 34,
                borderRadius: "50%",
                border: 0,
                padding: 0,
                cursor: busy ? "default" : "pointer",
                // Ivory edge notches around a coloured body, like a casino chip seen from above.
                background: `repeating-conic-gradient(#e8dcc0 0deg 15deg, ${body} 15deg 45deg)`,
                boxShadow: on
                  ? "0 0 0 2px #100d0c, 0 0 0 3.5px #c69a48, 0 3px 8px rgba(0,0,0,0.6)"
                  : "0 2px 4px rgba(0,0,0,0.6)",
                transform: on ? "translateY(-3px)" : "none",
                transition: "transform 0.12s"
              }}
            >
              <span
                style={{
                  position: "absolute",
                  inset: 5,
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.22), rgba(0,0,0,0) 60%), ${body}`,
                  border: "1px solid rgba(232,220,192,0.75)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#f7efdb",
                  fontFamily: "Georgia, serif",
                  fontSize: short(c).length > 3 ? 8 : 10,
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  textShadow: "0 1px 1px rgba(0,0,0,0.7)"
                }}
              >
                {short(c)}
              </span>
            </button>
          );
        })}

        <span aria-hidden="true" style={{ width: 1, height: 22, background: "#6b5d3a", margin: "0 2px" }} />

        <button type="button" aria-label="Undo last chip" title="Undo" style={roundBtn} disabled={busy || stack.length === 0} onClick={undo}>
          ↶
        </button>
        <button type="button" aria-label="Clear the table" title="Clear" style={roundBtn} disabled={busy || stack.length === 0} onClick={() => setStack([])}>
          ✕
        </button>
      </div>
    </div>
  );
}

const roundBtn: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  border: "1px solid #6b5d3a",
  background: "#1a221e",
  color: "#d9c48f",
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
  cursor: "pointer"
};

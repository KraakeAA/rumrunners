
"use client";

import { useMemo, useState } from "react";

type Result = {
  error?: string;
  money?: number;
  bet?: number;
  payout?: number;
  net?: number;
  drawn?: number[];
  matches?: number;
  multiplier?: number;
  reels?: string[];
  combination?: string;
};

export default function CasinoGames({
  game,
  cash,
  onCash,
}: {
  game: "Keno" | "Slots";
  cash: number;
  onCash: (cash: number) => void;
}) {
  const [bet, setBet] = useState("10");
  const [selected, setSelected] = useState<number[]>([]);
  const [savedNumbers, setSavedNumbers] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const numbers = useMemo(
    () => Array.from({ length: 80 }, (_, i) => i + 1),
    []
  );

  function toggleNumber(n: number) {
    setMessage("");
    setResult(null);

    setSelected((current) =>
      current.includes(n)
        ? current.filter((x) => x !== n)
        : current.length < 10
          ? [...current, n]
          : current
    );
  }

  function clearNumbers() {
    setSelected([]);
    setResult(null);
    setMessage("");
  }

  function saveNumbers() {
    if (selected.length !== 10) {
      setMessage("Choose exactly 10 numbers before saving.");
      return;
    }

    setSavedNumbers([...selected]);
    setMessage("Your numbers have been saved.");
  }

  function loadSavedNumbers() {
    if (savedNumbers.length !== 10) {
      setMessage("You haven't saved a set of numbers yet.");
      return;
    }

    setSelected([...savedNumbers]);
    setResult(null);
    setMessage("");
  }

  async function play() {
    setMessage("");
    setResult(null);

    const stake = Number(bet);

    if (!Number.isSafeInteger(stake) || stake < 1 || stake > 1000000) {
      setMessage("Enter a whole-number bet between £1 and £1,000,000.");
      return;
    }

    if (game === "Keno" && selected.length !== 10) {
      setMessage("Choose exactly 10 numbers.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        `/api/game/${game.toLowerCase()}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            game === "Keno"
              ? { bet: stake, selected }
              : { bet: stake }
          ),
        }
      );

      const data: Result = await response.json();

      if (!response.ok) {
        setMessage(data.error || "The game could not be played.");
      } else {
        setResult(data);

        if (typeof data.money === "number") {
          onCash(data.money);
        }
      }
    } catch {
      setMessage("Unable to connect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (game === "Keno") {
    const drawn = result?.drawn || [];
    const matches = selected.filter((n) => drawn.includes(n));

    return (
      <section
        className="casino-game"
        style={{
          padding: 0,
          margin: 0,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          overflow: "hidden",
          border: "1px solid #77716a",
          borderRadius: 6,
          background: "#403d3b",
          color: "#eee",
        }}
      >
        {/* Game heading */}
        <div
          style={{
            minHeight: 44,
            padding: "8px 12px",
            background: "linear-gradient(#493b2b, #211a14)",
            borderBottom: "1px solid #80776d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            boxSizing: "border-box",
          }}
        >
          <strong style={{ fontSize: 18 }}>Keno</strong>
          <span
            style={{
              position: "absolute",
              right: 12,
              color: "#a99c8d",
              fontSize: 20,
            }}
          >
            ⓘ
          </span>
        </div>

        {/* Draw information */}
        <div
          style={{
            padding: "7px",
            textAlign: "center",
            background: "#34302e",
            borderBottom: "1px solid #77716a",
            fontSize: 14,
          }}
        >
          <span style={{ color: "#e00022" }}>🔴</span>
          {" "}
          Keno Draw
        </div>

        {/* Win message ABOVE the number grid */}
        {result && (
          <div
            style={{
              margin: "10px 10px 5px",
              padding: "11px 7px",
              borderRadius: 6,
              background: "#353130",
              textAlign: "center",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {matches.length > 0 ? (
              <>
                You matched <strong>{result.matches}</strong> numbers
                {" "}and won{" "}
                <strong style={{ color: "#ffe1a2" }}>
                  £{(result.payout || 0).toLocaleString("en-GB")}!
                </strong>
              </>
            ) : (
              <>
                You matched <strong>0</strong> numbers.
                Better luck next time!
              </>
            )}
          </div>
        )}

        {!result && (
          <div
            style={{
              margin: "9px 10px 5px",
              padding: "8px 5px",
              background: "#353130",
              borderRadius: 5,
              textAlign: "center",
              fontSize: 12,
              color: "#d1cbc5",
            }}
          >
            Choose 10 numbers · {selected.length}/10 selected
          </div>
        )}

        {/* Compact 10-column number grid */}
        <div
          className="keno-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
            gap: 0,
            padding: "7px 9px 2px",
            margin: 0,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {numbers.map((n) => {
            const isSelected = selected.includes(n);
            const isDrawn = drawn.includes(n);
            const isMatch = isSelected && isDrawn;

            let background = "#555252";
            let color = "#d0cece";
            let border = "1px solid #85817e";

            if (isDrawn && !isSelected) {
              background = "#0800ed";
              color = "#fff";
            }

            if (isSelected) {
              background = "#a500ed";
              color = "#fff";
            }

            if (isMatch) {
              background = "#a500ed";
              color = "#fff";
              border = "1px solid #d17bfa";
            }

            return (
              <button
                key={n}
                type="button"
                onClick={() => toggleNumber(n)}
                disabled={busy}
                aria-label={`Number ${n}${isMatch ? ", matched" : ""}`}
                style={{
                  minWidth: 0,
                  width: "100%",
                  aspectRatio: "1 / 1",
                  padding: 0,
                  margin: 0,
                  borderRadius: 0,
                  border,
                  background,
                  color,
                  fontSize: "clamp(10px, 3.5vw, 17px)",
                  fontWeight: isMatch ? 600 : 400,
                  display: "grid",
                  placeItems: "center",
                  cursor: busy ? "default" : "pointer",
                  boxSizing: "border-box",
                  WebkitAppearance: "none",
                }}
              >
                {n}
              </button>
            );
          })}
        </div>

        {/* Clear, balance and Save */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 5,
            padding: "8px 10px 2px",
          }}
        >
          <div style={{ justifySelf: "start" }}>
            <button
              type="button"
              onClick={clearNumbers}
              disabled={busy}
              style={smallButtonStyle}
            >
              Clear!
            </button>
          </div>

          <strong
            style={{
              fontSize: 13,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            💵 £{cash.toLocaleString("en-GB")}
          </strong>

          <div style={{ justifySelf: "end" }}>
            <button
              type="button"
              onClick={savedNumbers.length === 10 ? loadSavedNumbers : saveNumbers}
              disabled={busy}
              style={smallButtonStyle}
            >
              {savedNumbers.length === 10 ? "Load!" : "Save!"}
            </button>
          </div>
        </div>

        {/* Bet amount at the bottom */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
            padding: "12px 8px 5px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <span style={{ fontSize: 13 }}>£</span>

          <input
            type="number"
            min="1"
            max="1000000"
            step="1"
            value={bet}
            onChange={(e) => setBet(e.target.value)}
            disabled={busy}
            aria-label="Keno bet amount"
            style={{
              width: "min(47%, 190px)",
              minWidth: 90,
              height: 42,
              padding: "5px 10px",
              background: "#fff",
              color: "#111",
              border: "2px solid #2877ad",
              borderRadius: 9,
              fontSize: 20,
              boxSizing: "border-box",
            }}
          />

          <button
            type="button"
            onClick={play}
            disabled={busy}
            style={{
              padding: "7px 15px",
              minHeight: 36,
              borderRadius: 22,
              background: "#078cf0",
              color: "#fff",
              border: "2px solid #b9d8f0",
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {busy ? "…" : "Bet!"}
          </button>
        </div>

        {/* Maximum bet and wealth information */}
        <div
          style={{
            textAlign: "center",
            padding: "5px 8px 13px",
            fontSize: 13,
            lineHeight: 1.8,
            color: "#e1deda",
          }}
        >
          <div>
            <strong>Maximum bet:</strong> £50,000
          </div>

          <div>
            <strong>Wealth:</strong> {cash >= 1000000
              ? "Excessively Rich"
              : cash >= 100000
                ? "Wealthy"
                : "Building your fortune"}
          </div>
        </div>

        {result && (
          <div
            style={{
              margin: "0 10px 9px",
              padding: 7,
              background: "#302b28",
              borderRadius: 4,
              textAlign: "center",
              fontSize: 12,
            }}
          >
            <strong>Drawn:</strong> {drawn.join(" · ")}
            {" · "}
            <strong>Matches:</strong> {result.matches}
            {" · "}
            <strong>Multiplier:</strong> {result.multiplier}×
          </div>
        )}

        {message && (
          <div
            style={{
              margin: "0 10px 10px",
              padding: 8,
              background: "#302b28",
              color: "#f2c7a5",
              borderRadius: 4,
              textAlign: "center",
              fontSize: 13,
            }}
          >
            {message}
          </div>
        )}
      </section>
    );
  }

  // Existing Slots game remains available.
  return (
    <section className="casino-game">
      <div className="casino-title">
        <div>
          <p className="eyebrow">THE GAMING ROOMS</p>
          <h2>{game}</h2>
        </div>

        <div className="casino-cash">
          Cash on hand
          <b>£{cash.toLocaleString("en-GB")}</b>
        </div>
      </div>

      <div className="casino-controls">
        <label>
          Stake (£)
          <input
            type="number"
            min="1"
            max="1000000"
            step="1"
            value={bet}
            onChange={(e) => setBet(e.target.value)}
          />
        </label>

        <span className="selection-count">
          Three-reel fruit machine
        </span>

        <button className="button" disabled={busy} onClick={play}>
          {busy ? "Playing…" : "Spin reels"}
        </button>
      </div>

      <div className="slot-machine">
        <div className="slot-reels">
          {(result?.reels || ["?", "?", "?"]).map((s, i) => (
            <div className="slot-reel" key={i}>{s}</div>
          ))}
        </div>

        <p>{result?.combination || "THE HOUSE FRUIT MACHINE"}</p>
      </div>

      <div className="payout-table">
        <b>SLOT PAYOUTS</b>
        <div className="payout-grid">
          <span>2 × Cherry <b>2×</b></span>
          <span>1 × 7 <b>5×</b></span>
          <span>2 × 7 <b>10×</b></span>
          <span>3 × Cherries <b>20×</b></span>
          <span>3 × Oranges <b>50×</b></span>
          <span>3 × BAR <b>100×</b></span>
          <span>3 × 777 <b>500×</b></span>
        </div>
      </div>

      {result && (
        <p className="notice">
          {result.net !== undefined && result.net >= 0
            ? `You are up £${result.net.toLocaleString("en-GB")}.`
            : `You are down £${Math.abs(result.net || 0).toLocaleString("en-GB")}.`}
        </p>
      )}

      {message && <p className="notice error">{message}</p>}
    </section>
  );
}

const smallButtonStyle: React.CSSProperties = {
  padding: "3px 6px",
  borderRadius: 0,
  border: "1px solid #ddd",
  background: "#dedede",
  color: "#111",
  fontSize: 12,
  lineHeight: 1.2,
  cursor: "pointer",
};

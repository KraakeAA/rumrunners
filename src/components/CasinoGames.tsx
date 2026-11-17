
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const numbers = useMemo(
    () => Array.from({ length: 80 }, (_, i) => i + 1),
    []
  );

  function toggleNumber(n: number) {
    setSelected((current) =>
      current.includes(n)
        ? current.filter((x) => x !== n)
        : current.length < 10
          ? [...current, n]
          : current
    );
  }

  async function play() {
    setMessage("");
    setResult(null);

    const stake = Number(bet);

    if (!Number.isSafeInteger(stake) || stake < 1) {
      setMessage("Enter a whole-number stake.");
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

        {game === "Keno" ? (
          <span className="selection-count">
            Numbers selected: {selected.length}/10
          </span>
        ) : (
          <span className="selection-count">
            Three-reel fruit machine
          </span>
        )}

        <button
          className="button"
          disabled={busy}
          onClick={play}
        >
          {busy
            ? "Playing…"
            : game === "Keno"
              ? "Draw numbers"
              : "Spin reels"}
        </button>
      </div>

      {game === "Keno" ? (
        <>
          <p className="casino-instruction">
            Choose ten numbers. Twenty numbers will be drawn from 1–80.
          </p>

          <div className="keno-grid">
            {numbers.map((n) => (
              <button
                key={n}
                className={`keno-number ${
                  selected.includes(n) ? "chosen" : ""
                } ${
                  result?.drawn?.includes(n) ? "drawn" : ""
                }`}
                onClick={() => toggleNumber(n)}
                disabled={busy}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="payout-table">
            <b>KENO PAYOUTS</b>

            <div className="payout-grid">
              {[
                [5, "5×"],
                [6, "24×"],
                [7, "142×"],
                [8, "1,000×"],
                [9, "4,500×"],
                [10, "10,000×"],
              ].map(([n, p]) => (
                <span key={n}>
                  {n} matches <b>{p}</b>
                </span>
              ))}
            </div>
          </div>

          {result?.drawn && (
            <div className="result-strip">
              <b>Drawn:</b> {result.drawn.join(" · ")}
              <br />
              <b>Matches:</b> {result.matches}
              {" · "}
              <b>Return:</b> £
              {result.payout?.toLocaleString("en-GB")}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="slot-machine">
            <div className="slot-reels">
              {(result?.reels || ["?", "?", "?"]).map((s, i) => (
                <div className="slot-reel" key={i}>
                  {s}
                </div>
              ))}
            </div>

            <p>
              {result?.combination || "THE HOUSE FRUIT MACHINE"}
            </p>
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

            <small>
              One spin, one payout. Only the highest qualifying
              prize is awarded.
            </small>
          </div>

          {result?.reels && (
            <div className="result-strip">
              <b>{result.combination}</b>
              {" · "}
              {result.multiplier}×
              {" · "}
              Return £{result.payout?.toLocaleString("en-GB")}
            </div>
          )}
        </>
      )}

      {result && (
        <p className="notice">
          {result.net !== undefined && result.net >= 0
            ? `You are up £${result.net.toLocaleString("en-GB")}.`
            : `You are down £${Math.abs(
                result.net || 0
              ).toLocaleString("en-GB")}.`}
        </p>
      )}

      {message && (
        <p className="notice error">{message}</p>
      )}
    </section>
  );
}

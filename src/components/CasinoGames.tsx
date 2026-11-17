
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
    if (busy) return;

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
    if (busy) return;

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
          border: "1px solid #66533d",
          borderRadius: 5,
          background: "#292521",
          color: "#e8e0d4",
          fontFamily: "Arial, sans-serif",
          boxShadow: "0 3px 12px #0008",
        }}
      >
        <div
          style={{
            minHeight: 43,
            padding: "8px 12px",
            background: "linear-gradient(180deg, #55432e, #292017)",
            borderBottom: "1px solid #786044",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            boxSizing: "border-box",
          }}
        >
          <strong
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 19,
              color: "#e9d2a7",
              letterSpacing: 1,
            }}
          >
            Keno
          </strong>

          <span
            style={{
              position: "absolute",
              right: 12,
              color: "#b69a6d",
              fontSize: 19,
            }}
          >
            ⓘ
          </span>
        </div>

        <div
          style={{
            padding: "7px",
            textAlign: "center",
            background: "#302820",
            borderBottom: "1px solid #574532",
            fontSize: 14,
            color: "#d9c7a8",
          }}
        >
          <span style={{ color: "#b78a4d" }}>◉</span>
          {" "}Keno Draw
        </div>

        {result && (
          <div
            style={{
              margin: "10px 10px 5px",
              padding: "14px 8px",
              borderRadius: 5,
              background: "#403b38",
              textAlign: "center",
              fontSize: 14,
              lineHeight: 1.5,
              color: "#e6e1dc",
              fontWeight: 700,
            }}
          >
            {matches.length > 0 ? (
              <>
                You matched {result.matches} numbers and won £
                {(result.payout || 0).toLocaleString("en-GB")}!
              </>
            ) : (
              <>You matched 0 numbers and won £0!</>
            )}
          </div>
        )}

        {!result && (
          <div
            style={{
              margin: "9px 10px 5px",
              padding: "8px 5px",
              background: "#302820",
              border: "1px solid #50402e",
              borderRadius: 3,
              textAlign: "center",
              fontSize: 12,
              color: "#c6b69d",
            }}
          >
            Choose 10 numbers · {selected.length}/10 selected
          </div>
        )}

        <div
          className="keno-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
            gap: 2,
            padding: "7px 9px 3px",
            margin: 0,
            width: "100%",
            boxSizing: "border-box",
            background: "#292521",
          }}
        >
          {numbers.map((n) => {
            const isSelected = selected.includes(n);
            const isDrawn = drawn.includes(n);
            const isMatch = isSelected && isDrawn;

            let background = "#393633";
            let color = "#bdb5a9";
            let border = "1px solid #62594e";
            let shadow = "none";

            if (isSelected) {
              background = "linear-gradient(145deg, #713b38, #482522)";
              color = "#f3ded2";
              border = "1px solid #a66b58";
            }

            if (isDrawn && !isSelected) {
              background = "linear-gradient(145deg, #344653, #202d37)";
              color = "#d1dce1";
              border = "1px solid #60798a";
            }

            if (isMatch) {
              background = "linear-gradient(145deg, #a83bd0, #69218b)";
              color = "#fff2ff";
              border = "1px solid #d58af0";
              shadow = "inset 0 0 7px #f2caff55";
            }

            return (
              <button
                key={n}
                type="button"
                onClick={() => toggleNumber(n)}
                disabled={busy}
                aria-label={`Number ${n}${isMatch ? ", winning match" : isSelected ? ", selected" : isDrawn ? ", drawn" : ""}`}
                style={{
                  minWidth: 0,
                  width: "100%",
                  aspectRatio: "1 / 1",
                  padding: 0,
                  margin: 0,
                  borderRadius: 2,
                  border,
                  background,
                  color,
                  fontSize: "clamp(10px, 3.5vw, 16px)",
                  fontWeight: isMatch ? 700 : 500,
                  display: "grid",
                  placeItems: "center",
                  cursor: busy ? "default" : "pointer",
                  boxSizing: "border-box",
                  boxShadow: shadow,
                  WebkitAppearance: "none",
                }}
              >
                {n}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "5px 12px",
            padding: "5px 8px 7px",
            fontSize: 10,
            color: "#b9aa94",
          }}
        >
          <span><b style={{ color: "#c66be5" }}>■</b> Winning match</span>
          <span><b style={{ color: "#a36a60" }}>■</b> Your selection</span>
          <span><b style={{ color: "#718b9b" }}>■</b> Other drawn</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 5,
            padding: "7px 11px 3px",
            borderTop: "1px solid #4d4031",
            background: "#29231d",
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
              color: "#e1c48e",
            }}
          >
            💵 £{cash.toLocaleString("en-GB")}
          </strong>

          <div style={{ justifySelf: "end" }}>
            <button
              type="button"
              onClick={
                savedNumbers.length === 10
                  ? loadSavedNumbers
                  : saveNumbers
              }
              disabled={busy}
              style={smallButtonStyle}
            >
              {savedNumbers.length === 10 ? "Load!" : "Save!"}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
            padding: "12px 8px 5px",
            width: "100%",
            boxSizing: "border-box",
            background: "#29231d",
          }}
        >
          <span style={{ fontSize: 14, color: "#c4ad85" }}>£</span>

          <input
            type="number"
            min="1"
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
              background: "#171411",
              color: "#ead9b8",
              border: "1px solid #94764c",
              borderRadius: 3,
              fontSize: 19,
              boxSizing: "border-box",
              outline: "none",
            }}
          />

          <button
            type="button"
            onClick={play}
            disabled={busy}
            style={{
              padding: "7px 16px",
              minHeight: 38,
              borderRadius: 3,
              background: "linear-gradient(180deg, #987345, #614528)",
              color: "#fff0d5",
              border: "1px solid #c3a06a",
              fontSize: 14,
              fontWeight: 700,
              whiteSpace: "nowrap",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Playing…" : "Bet!"}
          </button>
        </div>

        <div
          style={{
            textAlign: "center",
            padding: "5px 8px 12px",
            fontSize: 12,
            lineHeight: 1.8,
            color: "#c4b69f",
            background: "#29231d",
          }}
        >
          <div>
            <strong style={{ color: "#ddc18d" }}>Maximum bet:</strong>
            {" "}As permitted by the game
          </div>

          <div>
            <strong style={{ color: "#ddc18d" }}>Numbers selected:</strong>
            {" "}{selected.length}/10
          </div>
        </div>

        {result?.drawn && (
          <div
            style={{
              margin: "0 10px 10px",
              padding: 8,
              background: "#302820",
              border: "1px solid #574532",
              borderRadius: 3,
              textAlign: "center",
              fontSize: 11,
              color: "#cbb99a",
              lineHeight: 1.8,
            }}
          >
            <strong>Drawn numbers:</strong>
            <div>{result.drawn.join(" · ")}</div>
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
              background: "#382522",
              border: "1px solid #805044",
              color: "#e6b9a7",
              borderRadius: 3,
              textAlign: "center",
              fontSize: 12,
            }}
          >
            {message}
          </div>
        )}
      </section>
    );
  }

  // Rumrunners fruit machine.
  // Images are stored directly inside the public folder.
  const slotSymbols: Record<string, { src: string; alt: string }> = {
    "7": { src: "/seven.png", alt: "Lucky seven" },
    BAR: { src: "/bar-rum.png", alt: "BAR with rum bottle" },
    "🍒": { src: "/cherries.png", alt: "Cherries" },
    "🍊": { src: "/orange.png", alt: "Orange" },
  };

  const reels = result?.reels || ["7", "BAR", "🍒"];
  const slotWon = Boolean(result && (result.payout || 0) > 0);

  return (
    <section
      className="casino-game"
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "18px 10px 24px",
        boxSizing: "border-box",
        background: "#050505",
        color: "#f2f2f2",
      }}
    >
      <div
        style={{
          width: "min(100%, 400px)",
          overflow: "hidden",
          border: "2px solid #817b72",
          background: "#484848",
          boxShadow: "0 3px 12px #0009",
        }}
      >
        <div
          style={{
            minHeight: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "7px 10px",
            boxSizing: "border-box",
            borderBottom: "2px solid #8c8275",
            background:
              "linear-gradient(180deg, #6c5944 0%, #392d21 48%, #211a14 100%)",
            color: "#f0e8dc",
            fontSize: 20,
            letterSpacing: 0.3,
          }}
        >
          Slot Machines
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 2,
            background: "#a9a6a2",
            borderBottom: "2px solid #a49b8e",
          }}
        >
          {reels.map((symbol, index) => {
            const artwork = slotSymbols[symbol] || slotSymbols["7"];

            return (
              <div
                key={`${index}-${symbol}`}
                style={{
                  height: "clamp(92px, 25vw, 130px)",
                  minWidth: 0,
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 5,
                  boxSizing: "border-box",
                }}
              >
                <img
                  src={artwork.src}
                  alt={artwork.alt}
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div
          aria-live="polite"
          style={{
            minHeight: 43,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "7px 5px",
            boxSizing: "border-box",
            background: slotWon
              ? "linear-gradient(180deg, #4c694f, #354b38)"
              : "linear-gradient(180deg, #484848, #3e3e3e)",
            borderBottom: "2px solid #8a8177",
            color: "#f3f3f3",
            textAlign: "center",
            fontSize: 15,
            lineHeight: 1.35,
          }}
        >
          {result
            ? slotWon
              ? `You won £${(result.payout || 0).toLocaleString("en-GB")}`
              : "No win this time"
            : " "}
        </div>

        <div
          style={{
            minHeight: 300,
            padding: "42px 15px 28px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 12,
            boxSizing: "border-box",
            background: "#484848",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              width: "100%",
            }}
          >
            <span
              style={{
                fontSize: 43,
                lineHeight: 1,
                fontWeight: 300,
                color: "#fff",
              }}
            >
              £
            </span>

            <input
              type="number"
              min="1"
              max="1000000"
              step="1"
              value={bet}
              onChange={(e) => setBet(e.target.value)}
              disabled={busy}
              aria-label="Slot machine bet amount"
              style={{
                width: 125,
                maxWidth: "55%",
                height: 57,
                padding: "5px 9px",
                border: "1px solid #d5d5d5",
                borderRadius: 9,
                background: "#fff",
                color: "#111",
                fontSize: 27,
                textAlign: "center",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="button"
            onClick={play}
            disabled={busy}
            style={{
              minWidth: 170,
              minHeight: 43,
              padding: "6px 22px",
              borderRadius: 24,
              border: "2px solid #aaa",
              background:
                "linear-gradient(180deg, #f1f1f1 0%, #c9c9c9 52%, #999 100%)",
              color: "#111",
              fontSize: 20,
              fontWeight: 500,
              boxShadow: "0 2px 2px #222",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Pulling…" : "Pull Handle"}
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 5,
              fontSize: 17,
              color: "#f1f1f1",
              whiteSpace: "nowrap",
            }}
          >
            <span aria-hidden="true">💵</span>
            £{cash.toLocaleString("en-GB")}
          </div>

          {message && (
            <div
              role="alert"
              style={{
                width: "100%",
                marginTop: 5,
                padding: 8,
                boxSizing: "border-box",
                background: "#382522",
                border: "1px solid #805044",
                color: "#f0c5b5",
                borderRadius: 3,
                textAlign: "center",
                fontSize: 13,
              }}
            >
              {message}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          width: "min(100%, 440px)",
          padding: "28px 8px 0",
          boxSizing: "border-box",
          textAlign: "center",
          fontSize: 14,
          lineHeight: 1.8,
          color: "#e8e8e8",
        }}
      >
        <div>
          This slot machine is owned by <strong>Rumrunners</strong>
        </div>
        <div>
          The maximum bet is set at <strong>£1,000,000.</strong>
        </div>
      </div>
    </section>
  );
}

const smallButtonStyle: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 2,
  border: "1px solid #9a8059",
  background: "linear-gradient(180deg, #493a29, #2d241a)",
  color: "#e6d2ad",
  fontSize: 12,
  lineHeight: 1.2,
  cursor: "pointer",
};

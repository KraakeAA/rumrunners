
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

type Props = {
  game: "Keno" | "Slots";
  cash: number;
  onCash: (cash: number) => void;
};

const goldButton: React.CSSProperties = {
  padding: "5px 10px",
  border: "1px solid #b49a70",
  borderRadius: 3,
  background: "linear-gradient(180deg, #725839, #392819)",
  color: "#f0dfbd",
  fontSize: 12,
  cursor: "pointer",
};

export default function CasinoGames({ game, cash, onCash }: Props) {
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

  function toggleNumber(number: number) {
    if (busy) return;

    setMessage("");
    setResult(null);

    setSelected((current) =>
      current.includes(number)
        ? current.filter((n) => n !== number)
        : current.length < 10
          ? [...current, number]
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
      setMessage("Enter a valid whole-number stake.");
      return;
    }

    if (game === "Keno" && selected.length !== 10) {
      setMessage("Choose exactly 10 numbers.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(`/api/game/${game.toLowerCase()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          game === "Keno"
            ? { bet: stake, selected }
            : { bet: stake }
        ),
      });

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
      setMessage("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (game === "Keno") {
    const drawn = result?.drawn || [];
    const matches = selected.filter((n) => drawn.includes(n));

    return (
      <section
        style={{
          width: "100%",
          boxSizing: "border-box",
          overflow: "hidden",
          border: "1px solid #806747",
          borderRadius: 4,
          background: "#29231d",
          color: "#e8e0d4",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            minHeight: 43,
            padding: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            boxSizing: "border-box",
            background:
              "linear-gradient(180deg, #94764d, #59432b 50%, #302115)",
            borderBottom: "2px solid #b49a70",
          }}
        >
          <strong
            style={{
              color: "#f0dfbd",
              fontFamily: "Georgia, serif",
              fontSize: 19,
              letterSpacing: 1,
            }}
          >
            Keno
          </strong>
          <span
            style={{
              position: "absolute",
              right: 12,
              color: "#d2b783",
              fontSize: 19,
            }}
          >
            ⓘ
          </span>
        </div>

        <div
          style={{
            padding: 7,
            textAlign: "center",
            background: "#34291e",
            borderBottom: "1px solid #705638",
            fontSize: 14,
            color: "#e2cda9",
          }}
        >
          <span style={{ color: "#bd8b4d" }}>◉</span> Keno Draw
        </div>

        {result && (
          <div
            style={{
              margin: "10px 10px 5px",
              padding: 14,
              borderRadius: 4,
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
              padding: 8,
              background: "#302820",
              border: "1px solid #705638",
              borderRadius: 3,
              textAlign: "center",
              fontSize: 12,
              color: "#d4c09e",
            }}
          >
            Choose 10 numbers · {selected.length}/10 selected
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
            gap: 2,
            padding: "7px 9px 3px",
            background: "#29231d",
            boxSizing: "border-box",
          }}
        >
          {numbers.map((number) => {
            const isSelected = selected.includes(number);
            const isDrawn = drawn.includes(number);
            const isMatch = isSelected && isDrawn;

            let background = "#393633";
            let color = "#bdb5a9";
            let border = "1px solid #62594e";

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
            }

            return (
              <button
                key={number}
                type="button"
                onClick={() => toggleNumber(number)}
                disabled={busy}
                aria-label={`Number ${number}`}
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
                  WebkitAppearance: "none",
                }}
              >
                {number}
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
            color: "#c5b497",
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
            borderTop: "1px solid #705638",
            background: "#29231d",
          }}
        >
          <div style={{ justifySelf: "start" }}>
            <button
              type="button"
              onClick={clearNumbers}
              disabled={busy}
              style={goldButton}
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
              style={goldButton}
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
              border: "1px solid #705638",
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

  const slotSymbols: Record<string, { src: string; alt: string }> = {
    "7": {
      src: "/seven.png",
      alt: "Lucky seven",
    },
    BAR: {
      src: "/bar-rum.png",
      alt: "BAR with rum bottle",
    },
    "🍒": {
      src: "/cherries.png",
      alt: "Cherries",
    },
    "🍊": {
      src: "/orange.png",
      alt: "Orange",
    },
  };

  function getSlotArtwork(symbol: string) {
    const key = symbol.trim();
    const normalised = key.toLowerCase();

    if (
      key === "7" ||
      normalised === "seven" ||
      normalised === "777"
    ) {
      return slotSymbols["7"];
    }

    if (key === "BAR" || normalised === "bar") {
      return slotSymbols.BAR;
    }

    if (
      key === "🍒" ||
      normalised === "cherries" ||
      normalised === "cherry"
    ) {
      return slotSymbols["🍒"];
    }

    if (
      key === "🍊" ||
      normalised === "orange" ||
      normalised === "oranges"
    ) {
      return slotSymbols["🍊"];
    }

    return slotSymbols["7"];
  }

  const reels = result?.reels || ["7", "BAR", "🍒"];
  const slotWon = Boolean(result && (result.payout || 0) > 0);

  return (
    <section
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "6px 0 12px",
        boxSizing: "border-box",
        background: "transparent",
        color: "#f2eadb",
      }}
    >
      <div
        style={{
          width: "min(100%, 360px)",
          overflow: "hidden",
          border: "2px solid #b49a70",
          borderRadius: 2,
          background:
            "linear-gradient(145deg, #665033 0%, #49351f 40%, #2c1e10 100%)",
          boxShadow:
            "0 3px 10px #0008, inset 0 0 0 1px #80643e",
        }}
      >
        {/* Antique gold machine header */}
        <div
          style={{
            minHeight: 42,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px 8px",
            boxSizing: "border-box",
            borderBottom: "2px solid #c1a16b",
            background:
              "linear-gradient(180deg, #a18459 0%, #80613d 30%, #594027 68%, #382617 100%)",
            color: "#f4dfb7",
            fontFamily: "Georgia, serif",
            fontSize: 19,
            letterSpacing: 0.5,
            textShadow: "0 1px 3px #000",
          }}
        >
          Slot Machines
        </div>

        {/* Three compact reel windows */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 2,
            padding: 3,
            background:
              "linear-gradient(180deg, #c6a979, #94744b 55%, #62472b)",
            borderBottom: "2px solid #b49a70",
          }}
        >
          {reels.map((symbol, index) => {
            const artwork = getSlotArtwork(symbol);

            return (
              <div
                key={`${index}-${symbol}`}
                style={{
                  height: "clamp(76px, 22vw, 105px)",
                  minWidth: 0,
                  background: "#fffaf0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 4,
                  boxSizing: "border-box",
                  border: "1px solid #d8c49f",
                  boxShadow: "inset 0 0 5px #9b8157",
                  overflow: "hidden",
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

        {/* Win or no-win message */}
        <div
          aria-live="polite"
          style={{
            minHeight: 39,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px 5px",
            boxSizing: "border-box",
            background: slotWon
              ? "linear-gradient(180deg, #61764f, #405638)"
              : "linear-gradient(180deg, #80613c, #584027)",
            borderBottom: "2px solid #b49a70",
            color: "#f4e6c7",
            textAlign: "center",
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.3,
            textShadow: "0 1px 2px #0008",
          }}
        >
          {result
            ? slotWon
              ? `You won £${(result.payout || 0).toLocaleString("en-GB")}`
              : "No win this time"
            : "Ready to play"}
        </div>

        {/* Compact bronze and gold control cabinet */}
        <div
          style={{
            minHeight: 225,
            padding: "24px 12px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 10,
            boxSizing: "border-box",
            background:
              "linear-gradient(145deg, #70583b 0%, #5b452d 25%, #493520 55%, #352516 80%, #291b10 100%)",
            boxShadow:
              "inset 0 2px 8px #c4a16b33, inset 0 -5px 12px #120b05aa",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
            }}
          >
            <span
              style={{
                fontSize: 37,
                lineHeight: 1,
                fontWeight: 300,
                color: "#f0d7a5",
                textShadow: "0 1px 3px #000",
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
                width: 112,
                maxWidth: "55%",
                height: 49,
                padding: "5px 8px",
                border: "2px solid #c4a675",
                borderRadius: 7,
                background: "#f7f4ed",
                color: "#17120c",
                fontSize: 24,
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
              minWidth: 155,
              minHeight: 39,
              padding: "5px 18px",
              borderRadius: 24,
              border: "2px solid #c5b18c",
              background:
                "linear-gradient(180deg, #f1f1ed 0%, #c9c5bc 52%, #99958d 100%)",
              color: "#17130e",
              fontSize: 18,
              fontWeight: 500,
              boxShadow: "0 2px 3px #100d09",
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
              gap: 7,
              marginTop: 3,
              fontSize: 15,
              color: "#f0dfbd",
              whiteSpace: "nowrap",
              textShadow: "0 1px 2px #000",
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
                border: "1px solid #b18a5b",
                color: "#f0c5b5",
                borderRadius: 3,
                textAlign: "center",
                fontSize: 12,
              }}
            >
              {message}
            </div>
          )}
        </div>
      </div>

      {/* Machine ownership and betting limit */}
      <div
        style={{
          width: "min(100%, 360px)",
          padding: "17px 5px 0",
          boxSizing: "border-box",
          textAlign: "center",
          fontSize: 13,
          lineHeight: 1.7,
          color: "#e6d4b1",
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

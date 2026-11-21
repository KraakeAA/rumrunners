"use client";

import { useEffect, useMemo, useState } from "react";

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
  takeover?: boolean;
  previousOwner?: string | null;
  city?: string;
};

type Props = {
  game: "Keno" | "Slots";
  cash: number;
  onCash: (cash: number) => void;
  ownerName?: string | null;
  maxBet?: number;
  onPlayed?: (info: { takeover: boolean; previousOwner: string | null; payout: number }) => void;
};

export default function CasinoGames({
  game,
  cash,
  onCash,
  ownerName,
  maxBet,
  onPlayed,
}: Props) {
  const limit = maxBet ?? 1000000;
  const ownerLabel = ownerName || "Rumrunners";
  const [bet, setBet] = useState("10");
  const [selected, setSelected] = useState<number[]>([]);
  const [savedSets, setSavedSets] = useState<number[][]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("rr-keno-sets");
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setSavedSets(parsed.filter((x) => Array.isArray(x) && x.length === 10).slice(0, 12));
      }
    } catch {
      /* no saved sets */
    }
  }, []);
  const [editSets, setEditSets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const numbers = useMemo(
    () => Array.from({ length: 80 }, (_, i) => i + 1),
    []
  );

  function storeSets(sets: number[][]) {
    setSavedSets(sets);
    try {
      window.localStorage.setItem("rr-keno-sets", JSON.stringify(sets));
    } catch {
      /* not saved this time */
    }
  }

  function toggleNumber(number: number) {
    if (busy) return;

    setMessage("");

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

    const sorted = [...selected].sort((x, y) => x - y);
    if (savedSets.some((set) => set.join(",") === sorted.join(","))) {
      setMessage("You have already saved that set.");
      return;
    }
    if (savedSets.length >= 12) {
      setMessage("You can only keep 12 saved sets. Delete one first.");
      return;
    }

    storeSets([...savedSets, sorted]);
    setMessage("Your numbers have been saved.");
  }

  function loadSet(set: number[]) {
    if (busy) return;
    setSelected([...set]);
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

        if (onPlayed) {
          onPlayed({
            takeover: Boolean(data.takeover),
            previousOwner: data.previousOwner ?? null,
            payout: data.payout || 0,
          });
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
    const matchCount = result?.matches ?? 0;
    const panelBg = "#2a2f2c";

    const outlineButton: React.CSSProperties = {
      padding: "3px 8px",
      border: "2px solid #b9a36a",
      borderRadius: 0,
      background: "#3b3a32",
      color: "#f7efdb",
      fontSize: 13,
      lineHeight: 1.2,
      cursor: busy ? "default" : "pointer",
      WebkitAppearance: "none",
    };

    return (
      <section
        style={{
          width: "100%",
          boxSizing: "border-box",
          overflow: "hidden",
          border: "1px solid #6b5d3a",
          background: panelBg,
          color: "#e8e0d4",
        }}
      >
        <div
          style={{
            padding: "6px 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            boxSizing: "border-box",
            background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
            borderBottom: "1px solid #b0904a",
          }}
        >
          <strong
            style={{
              color: "#f7efdb",
              fontFamily: "Georgia, serif",
              fontSize: 14,
              fontWeight: 700,
              textShadow: "0 1px 2px #000",
            }}
          >
            Keno
          </strong>
          <span style={{ position: "absolute", right: 10, color: "#d2b783", fontSize: 16 }}>ⓘ</span>
        </div>

        <div
          style={{
            padding: "4px 7px",
            textAlign: "center",
            background: "#343a36",
            borderBottom: "1px solid #6b5d3a",
            fontSize: 12,
            color: "#f1e8d3",
          }}
        >
          {ownerLabel}
        </div>

        <div
          style={{
            margin: "10px 10px 8px",
            minHeight: 46,
            padding: "10px 8px",
            borderRadius: 6,
            background: "#242926",
            textAlign: "center",
            fontSize: 12,
            lineHeight: 1.4,
            color: "#f1e8d3",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
          }}
        >
          {result ? (
            (result.payout || 0) > 0 ? (
              <span>
                You matched <b>{matchCount}</b> numbers and won{" "}
                <b>£{(result.payout || 0).toLocaleString("en-GB")}</b>!
              </span>
            ) : (
              <span>
                You matched <b>{matchCount}</b> numbers, no win.
              </span>
            )
          ) : (
            <span style={{ color: "#b7ad93" }}>Pick 10 numbers and place your bet.</span>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
            gap: 0,
            margin: "0 auto",
            width: "calc(100% - 20px)",
            border: "1px solid #8a8a80",
            boxSizing: "border-box",
          }}
        >
          {numbers.map((number) => {
            const isSelected = selected.includes(number);
            const isDrawn = drawn.includes(number);
            const isMatch = isSelected && isDrawn;

            let background = "#5a5a55";
            let color = "#cfc9bb";

            if (isSelected) {
              background = "#e8341f";
              color = "#fff";
            }
            if (isDrawn && !isSelected) {
              background = "#0a0adf";
              color = "#fff";
            }
            if (isMatch) {
              background = "#9a22f0";
              color = "#fff";
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
                  borderRadius: 0,
                  border: "1px solid #8a8a80",
                  background,
                  color,
                  fontSize: "clamp(12px, 4.4vw, 20px)",
                  fontWeight: 400,
                  lineHeight: 1,
                  display: "grid",
                  placeItems: "center",
                  cursor: busy ? "default" : "pointer",
                  boxSizing: "border-box",
                  WebkitAppearance: "none",
                  touchAction: "manipulation",
                }}
              >
                {number}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "start",
            gap: 5,
            margin: "10px 10px 0",
          }}
        >
          <div style={{ justifySelf: "start" }}>
            <button type="button" onClick={clearNumbers} disabled={busy} style={outlineButton}>
              Clear!
            </button>
          </div>

          <div style={{ textAlign: "center", fontSize: 13, color: "#f1e8d3", whiteSpace: "nowrap", paddingTop: 2 }}>
            £{cash.toLocaleString("en-GB")}
          </div>

          <div style={{ justifySelf: "end" }}>
            <button type="button" onClick={saveNumbers} disabled={busy} style={outlineButton}>
              Save!
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
            padding: "14px 8px 6px",
            boxSizing: "border-box",
          }}
        >
          <span style={{ fontSize: 13, color: "#d4cab2" }}>£</span>

          <input
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={bet}
            onChange={(e) => setBet(e.target.value)}
            disabled={busy}
            aria-label="Keno bet amount"
            style={{
              width: "min(52%, 200px)",
              height: 34,
              padding: "0 8px",
              background: "#f1e8d3",
              color: "#1b1b18",
              border: 0,
              borderRadius: 4,
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />

          <button
            type="button"
            onClick={play}
            disabled={busy}
            style={{
              padding: "0 14px",
              height: 28,
              borderRadius: 14,
              background: "linear-gradient(180deg, #a98240, #6b4f22)",
              color: "#fff0d5",
              border: "1px solid #d1b072",
              fontSize: 13,
              whiteSpace: "nowrap",
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "…" : "Bet!"}
          </button>
        </div>

        <div style={{ textAlign: "center", fontSize: 12, lineHeight: 1.7, color: "#f1e8d3", padding: "4px 8px 10px" }}>
          <div>
            <b>Maximum bet:</b> £{limit.toLocaleString("en-GB")}
          </div>
        </div>

        {message && (
          <div
            style={{
              margin: "0 10px 10px",
              padding: "6px 8px",
              background: "#382522",
              border: "1px solid #805044",
              color: "#e6b9a7",
              borderRadius: 3,
              textAlign: "center",
              fontSize: 11,
            }}
          >
            {message}
          </div>
        )}

        <div style={{ margin: "0 10px 12px", padding: "8px 8px 10px", borderRadius: 6, background: "#242926" }}>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            <b>Saved Sets</b>{" "}
            <button
              type="button"
              onClick={() => setEditSets((e) => !e)}
              style={{ background: "none", border: 0, padding: 0, color: "#d9b45f", fontSize: 12, cursor: "pointer" }}
            >
              ({editSets ? "Done" : "Edit"})
            </button>
          </div>

          {savedSets.length === 0 ? (
            <div style={{ fontSize: 11, color: "#b7ad93" }}>
              Pick 10 numbers and tap Save! to keep a set here.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {savedSets.map((set, idx) => (
                <div key={set.join("-")} style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => (editSets ? storeSets(savedSets.filter((_, i) => i !== idx)) : loadSet(set))}
                    aria-label={editSets ? "Delete this set" : "Use this set"}
                    style={{
                      width: "100%",
                      padding: 0,
                      border: "1px solid #8a8a80",
                      background: "#5a5a55",
                      display: "grid",
                      gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                      cursor: "pointer",
                      WebkitAppearance: "none",
                    }}
                  >
                    {set.map((n) => (
                      <span
                        key={n}
                        style={{
                          fontSize: "clamp(9px, 3vw, 13px)",
                          lineHeight: 1.3,
                          color: "#e8e0d4",
                          textAlign: "center",
                          border: "1px solid #8a8a80",
                          padding: "1px 0",
                        }}
                      >
                        {n}
                      </span>
                    ))}
                  </button>
                  {editSets && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        background: "#c0392b",
                        color: "#fff",
                        fontSize: 11,
                        lineHeight: "16px",
                        textAlign: "center",
                        pointerEvents: "none",
                      }}
                    >
                      ×
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
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
          width: "min(100%, 300px)",
          overflow: "hidden",
          border: "2px solid #b0904a",
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
            minHeight: 36,
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
            fontSize: 15,
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
            borderBottom: "2px solid #b0904a",
          }}
        >
          {reels.map((symbol, index) => {
            const artwork = getSlotArtwork(symbol);

            return (
              <div
                key={`${index}-${symbol}`}
                style={{
                  height: "clamp(66px, 20vw, 84px)",
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
            minHeight: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px 5px",
            boxSizing: "border-box",
            background: slotWon
              ? "linear-gradient(180deg, #61764f, #405638)"
              : "linear-gradient(180deg, #80613c, #584027)",
            borderBottom: "2px solid #b0904a",
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
            minHeight: 0,
            padding: "10px 10px 10px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 8,
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
                fontSize: 22,
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
                width: 100,
                maxWidth: "55%",
                height: 36,
                padding: "5px 8px",
                border: "2px solid #c4a675",
                borderRadius: 7,
                background: "#f7f4ed",
                color: "#17120c",
                fontSize: 16,
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
              minWidth: 0,
              minHeight: 28,
              padding: "3px 16px",
              borderRadius: 24,
              border: "2px solid #c5b18c",
              background:
                "linear-gradient(180deg, #f1f1ed 0%, #c9c5bc 52%, #99958d 100%)",
              color: "#17130e",
              fontSize: 13,
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
              color: "#f7efdb",
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
          width: "fit-content",
          maxWidth: "calc(100% - 20px)",
          margin: "8px auto",
          padding: "5px 14px",
          boxSizing: "border-box",
          textAlign: "center",
          fontSize: 12,
          lineHeight: 1.6,
          color: "#e3f0e0",
          background: "rgba(36, 92, 54, 0.38)",
          border: "1px solid rgba(111, 207, 111, 0.4)",
          borderRadius: 4,
        }}
      >
        <div>
          This slot machine is owned by <strong>{ownerLabel}</strong>
        </div>
        <div>
          The maximum bet is set at <strong>£{limit.toLocaleString("en-GB")}.</strong>
        </div>
      </div>
    </section>
  );
}

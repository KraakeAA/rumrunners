"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Card = { r: number; s: number };

type Props = {
  game: "Blackjack" | "Roulette" | "War";
  cash: number;
  onCash: (cash: number) => void;
  ownerName?: string | null;
  maxBet?: number;
  onPlayed?: (info: { takeover: boolean; previousOwner: string | null; payout: number }) => void;
};

type Played = { takeover?: boolean; previousOwner?: string | null; payout?: number; money?: number };

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

const wrap: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #806747",
  borderRadius: 4,
  background: "#1f2a25",
  color: "#e8e0d4"
};
const head: CSSProperties = {
  padding: 8,
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 19,
  letterSpacing: 1,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #94764d, #59432b 50%, #302115)",
  borderBottom: "2px solid #b0904a"
};
const btn: CSSProperties = {
  padding: "7px 14px",
  border: "1px solid #b0904a",
  borderRadius: 3,
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  color: "#f7efdb",
  fontSize: 14,
  cursor: "pointer"
};
const input: CSSProperties = {
  height: 32,
  width: 90,
  padding: "0 8px",
  border: "1px solid #a08340",
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16,
  textAlign: "center"
};

function CardFace({ card, down }: { card?: Card; down?: boolean }) {
  const red = card && (card.s === 1 || card.s === 2);
  return (
    <div
      style={{
        width: 46,
        height: 64,
        borderRadius: 4,
        border: "1px solid #b0904a",
        background: down || !card ? "repeating-linear-gradient(45deg, #5b2a2a, #5b2a2a 4px, #3d1b1b 4px, #3d1b1b 8px)" : "#f7efdb",
        color: red ? "#b3261e" : "#1a1a1a",
        display: "grid",
        placeItems: "center",
        fontFamily: "Georgia, serif",
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1.1,
        textAlign: "center"
      }}
    >
      {!down && card ? (
        <span>
          {RANKS[card.r]}
          <br />
          {SUITS[card.s]}
        </span>
      ) : null}
    </div>
  );
}

function Row({ label, cards, total, hidden }: { label: string; cards: Card[]; total?: number | null; hidden?: boolean }) {
  return (
    <div style={{ textAlign: "center", margin: "8px 0" }}>
      <div style={{ fontSize: 12, color: "#d2b783", marginBottom: 4 }}>
        {label}
        {total != null ? ` · ${total}` : ""}
      </div>
      <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap" }}>
        {cards.map((c, i) => (
          <CardFace key={i} card={c} />
        ))}
        {hidden && <CardFace down />}
      </div>
    </div>
  );
}

const ROULETTE_OPTIONS: { type: string; label: string; pays: string }[] = [
  { type: "red", label: "Red", pays: "1:1" },
  { type: "black", label: "Black", pays: "1:1" },
  { type: "odd", label: "Odd", pays: "1:1" },
  { type: "even", label: "Even", pays: "1:1" },
  { type: "low", label: "1-18", pays: "1:1" },
  { type: "high", label: "19-36", pays: "1:1" },
  { type: "dozen1", label: "1st 12", pays: "2:1" },
  { type: "dozen2", label: "2nd 12", pays: "2:1" },
  { type: "dozen3", label: "3rd 12", pays: "2:1" },
  { type: "col1", label: "Column 1", pays: "2:1" },
  { type: "col2", label: "Column 2", pays: "2:1" },
  { type: "col3", label: "Column 3", pays: "2:1" }
];

export default function TableGames({ game, onCash, ownerName, maxBet, onPlayed }: Props) {
  const limit = maxBet ?? 1_000_000;
  const [bet, setBet] = useState("10");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // Blackjack
  const [bj, setBj] = useState<{
    done: boolean;
    bet: number;
    player: Card[];
    playerTotal: number;
    dealer: Card[];
    dealerTotal: number | null;
    hidden: boolean;
    label?: string;
    payout?: number;
  } | null>(null);

  // War
  const [war, setWar] = useState<{
    player: Card;
    dealer: Card;
    war: boolean;
    warPlayer: Card | null;
    warDealer: Card | null;
    win: boolean;
    payout: number;
  } | null>(null);

  // Roulette
  const [pick, setPick] = useState<string>("red");
  const [straight, setStraight] = useState("");
  const [spin, setSpin] = useState<{ result: number; win: boolean; payout: number } | null>(null);

  function report(d: Played) {
    if (typeof d.money === "number") onCash(d.money);
    onPlayed?.({ takeover: Boolean(d.takeover), previousOwner: d.previousOwner ?? null, payout: d.payout ?? 0 });
  }

  // Pick up a blackjack hand left in play (e.g. after a refresh).
  useEffect(() => {
    if (game !== "Blackjack") return;
    fetch("/api/game/blackjack", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.inPlay) {
          setBj(d);
          setBet(String(d.bet));
        }
      })
      .catch(() => {});
  }, [game]);

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMessage(String(d.error ?? "That did not work."));
        return null;
      }
      return d;
    } catch {
      setMessage("Unable to connect. Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const stake = Number(bet);
  const stakeOk = Number.isSafeInteger(stake) && stake >= 1;

  async function deal() {
    if (!stakeOk) return setMessage("Enter a valid whole-number stake.");
    setBj(null);
    const d = await post("/api/game/blackjack", { action: "deal", bet: stake });
    if (!d) return;
    setBj(d);
    if (typeof d.money === "number") onCash(d.money);
    if (d.done) report(d);
  }

  async function move(action: "hit" | "stand") {
    const d = await post("/api/game/blackjack", { action });
    if (!d) return;
    setBj(d);
    if (typeof d.money === "number") onCash(d.money);
    if (d.done) report(d);
  }

  async function playWar() {
    if (!stakeOk) return setMessage("Enter a valid whole-number stake.");
    setWar(null);
    const d = await post("/api/game/war", { bet: stake });
    if (!d) return;
    setWar(d);
    report(d);
  }

  async function spinWheel() {
    if (!stakeOk) return setMessage("Enter a valid whole-number stake.");
    if (pick === "number" && (straight === "" || Number(straight) < 0 || Number(straight) > 36)) {
      return setMessage("Pick a number from 0 to 36.");
    }
    setSpin(null);
    const d = await post("/api/game/roulette", {
      bet: stake,
      type: pick,
      number: pick === "number" ? Number(straight) : undefined
    });
    if (!d) return;
    setSpin(d);
    report(d);
  }

  const inPlay = game === "Blackjack" && bj && !bj.done;

  const stakeRow = (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", flexWrap: "wrap", margin: "8px 0" }}>
      <span style={{ fontSize: 13 }}>Bet £</span>
      <input
        style={{ ...input, opacity: inPlay ? 0.6 : 1 }}
        inputMode="numeric"
        value={bet}
        disabled={busy || !!inPlay}
        onChange={(e) => setBet(e.target.value.replace(/\D/g, ""))}
      />
    </div>
  );

  const resultBox = (text: string, good: boolean) => (
    <div
      style={{
        margin: "8px 10px",
        padding: 12,
        borderRadius: 4,
        background: "#403b38",
        textAlign: "center",
        fontWeight: 700,
        color: good ? "#7fe08f" : "#f0c2b8"
      }}
    >
      {text}
    </div>
  );

  return (
    <section style={wrap}>
      <div style={head}>{game}</div>
      <div style={{ padding: "6px 10px", textAlign: "center", fontSize: 12, color: "#d4c09e", background: "#34291e" }}>
        Run by {ownerName || "Rumrunners"} · max bet {gbp(limit)}
      </div>

      {message && <p className="notice" style={{ margin: "8px 10px 0", textAlign: "center" }}>{message}</p>}

      {/* ------------------------------ Blackjack ------------------------------ */}
      {game === "Blackjack" && (
        <div style={{ padding: "4px 10px 12px" }}>
          <p style={{ fontSize: 11, color: "#b7ad93", textAlign: "center", margin: "6px 0 0" }}>
            Blackjack pays 3 to 2. Dealer stands on 17. Hit or stand.
          </p>

          {bj && (
            <>
              <Row label="Dealer" cards={bj.dealer} total={bj.dealerTotal} hidden={bj.hidden} />
              <Row label="You" cards={bj.player} total={bj.playerTotal} />
              {bj.done && resultBox(
                `${bj.label ?? "Hand over"}${bj.payout ? ` · you get back ${gbp(bj.payout)}` : ""}`,
                (bj.payout ?? 0) >= bj.bet && (bj.payout ?? 0) > 0
              )}
            </>
          )}

          {inPlay ? (
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 6 }}>
              <button type="button" style={{ ...btn, opacity: busy ? 0.55 : 1 }} disabled={busy} onClick={() => move("hit")}>
                Hit
              </button>
              <button type="button" style={{ ...btn, opacity: busy ? 0.55 : 1 }} disabled={busy} onClick={() => move("stand")}>
                Stand
              </button>
            </div>
          ) : (
            <>
              {stakeRow}
              <div style={{ textAlign: "center" }}>
                <button type="button" style={{ ...btn, opacity: busy ? 0.55 : 1 }} disabled={busy} onClick={deal}>
                  Deal
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* -------------------------------- War -------------------------------- */}
      {game === "War" && (
        <div style={{ padding: "4px 10px 12px" }}>
          <p style={{ fontSize: 11, color: "#b7ad93", textAlign: "center", margin: "6px 0 0" }}>
            Higher card wins and pays 1 to 1. Aces are high. On a tie it&apos;s war: a second card
            each, and you win 1.5 times your bet if yours is equal or higher.
          </p>

          {war && (
            <>
              <Row label="Dealer" cards={war.war && war.warDealer ? [war.dealer, war.warDealer] : [war.dealer]} />
              <Row label="You" cards={war.war && war.warPlayer ? [war.player, war.warPlayer] : [war.player]} />
              {resultBox(
                war.win
                  ? `${war.war ? "You won the war" : "You win"}! You get back ${gbp(war.payout)}.`
                  : `${war.war ? "You lost the war." : "Dealer wins."}`,
                war.win
              )}
            </>
          )}

          {stakeRow}
          <div style={{ textAlign: "center" }}>
            <button type="button" style={{ ...btn, opacity: busy ? 0.55 : 1 }} disabled={busy} onClick={playWar}>
              Deal
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------ Roulette ------------------------------ */}
      {game === "Roulette" && (
        <div style={{ padding: "4px 10px 12px" }}>
          <p style={{ fontSize: 11, color: "#b7ad93", textAlign: "center", margin: "6px 0 0" }}>
            European wheel, one zero. A single number pays 35 to 1.
          </p>

          {spin && (
            <>
              <div style={{ textAlign: "center", margin: "10px 0 0" }}>
                <span
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    border: "3px solid #b0904a",
                    background: spin.result === 0 ? "#1f6b3a" : REDS.has(spin.result) ? "#9c1f1f" : "#161616",
                    color: "#f7efdb",
                    fontFamily: "Georgia, serif",
                    fontSize: 26
                  }}
                >
                  {spin.result}
                </span>
              </div>
              {resultBox(
                spin.win ? `A winner! You get back ${gbp(spin.payout)}.` : "No luck this time.",
                spin.win
              )}
            </>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginTop: 8 }}>
            {ROULETTE_OPTIONS.map((o) => (
              <button
                key={o.type}
                type="button"
                onClick={() => setPick(o.type)}
                style={{
                  padding: "6px 2px",
                  fontSize: 12,
                  cursor: "pointer",
                  color: "#f7efdb",
                  border: pick === o.type ? "2px solid #ddc18d" : "1px solid #6b5d3a",
                  background: o.type === "red" ? "#6e1f1f" : o.type === "black" ? "#161616" : "#2a342f"
                }}
              >
                {o.label}
                <div style={{ fontSize: 10, color: "#c9bfa6" }}>{o.pays}</div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPick("number")}
              style={{
                gridColumn: "1 / span 3",
                padding: "6px 2px",
                fontSize: 12,
                cursor: "pointer",
                color: "#f7efdb",
                border: pick === "number" ? "2px solid #ddc18d" : "1px solid #6b5d3a",
                background: "#2a342f"
              }}
            >
              Single number (35:1)
            </button>
          </div>

          {pick === "number" && (
            <div style={{ textAlign: "center", marginTop: 6 }}>
              <input
                style={input}
                inputMode="numeric"
                placeholder="0-36"
                value={straight}
                onChange={(e) => setStraight(e.target.value.replace(/\D/g, "").slice(0, 2))}
              />
            </div>
          )}

          {stakeRow}
          <div style={{ textAlign: "center" }}>
            <button type="button" style={{ ...btn, opacity: busy ? 0.55 : 1 }} disabled={busy} onClick={spinWheel}>
              Spin
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

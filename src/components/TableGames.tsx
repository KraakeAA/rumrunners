"use client";

import { useEffect, useState, type CSSProperties } from "react";
import RouletteGame from "@/components/RouletteGame";
import { InfoButton, OwnerBar } from "@/components/CasinoInfo";

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
  padding: 6,
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 15,
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


export default function TableGames({ game, cash, onCash, ownerName, maxBet, onPlayed }: Props) {
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
      <div style={{ ...head, position: "relative" }}>
        {game}
        <InfoButton game={game} />
      </div>
      <OwnerBar ownerName={ownerName} />
      {game !== "Roulette" && (
        <div style={{ textAlign: "center", fontSize: 12, color: "#b7ad93", margin: "6px 0 0" }}>Max bet {gbp(limit)}</div>
      )}

      {message && <p className="notice" style={{ margin: "8px 10px 0", textAlign: "center" }}>{message}</p>}

      {/* ------------------------------ Blackjack ------------------------------ */}
      {game === "Blackjack" && (
        <div style={{ padding: "4px 10px 12px" }}>

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
      {game === "Roulette" && <RouletteGame limit={limit} cash={cash} onCash={onCash} onPlayed={onPlayed} />}
    </section>
  );
}

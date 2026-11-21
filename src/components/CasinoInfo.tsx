"use client";

import { useState, type ReactNode } from "react";

export type InfoGame = "Keno" | "Slots" | "Roulette" | "Blackjack" | "War";

const OWNED =
  "This casino is player-owned. Any money won or lost comes from or is added to the owner's chip supply. If the owner is unable to pay out a winning, the casino will be transferred to you and you will now own the casino.";

const RULES: Record<InfoGame, { title: string; intro: string[]; lines?: string[] }> = {
  Keno: {
    title: "Keno",
    intro: [
      "To play, select 10 numbers from a chart of 80. The game will draw 20 random numbers. The more numbers you match the more you win. You must match at least 5 numbers to win."
    ],
    lines: [
      "Matching 5 numbers will pay out your bet x 5",
      "Matching 6 numbers will pay out your bet x 24",
      "Matching 7 numbers will pay out your bet x 142",
      "Matching 8 numbers will pay out your bet x 1,000",
      "Matching 9 numbers will pay out your bet x 4,500",
      "Matching 10 numbers will pay out your bet x 10,000"
    ]
  },
  Slots: {
    title: "Slot Machines",
    intro: ["Place your bet and pull the lever. Three reels spin and your winnings depend on what lines up."],
    lines: [
      "7 7 7 will pay out your bet x 500",
      "BAR BAR BAR will pay out your bet x 100",
      "Three oranges will pay out your bet x 50",
      "Three cherries will pay out your bet x 20",
      "Two 7s will pay out your bet x 10",
      "A single 7 will pay out your bet x 5",
      "Two cherries, anywhere, will pay out your bet x 2"
    ]
  },
  Roulette: {
    title: "Roulette",
    intro: [
      "Pick a chip, tap the table to place it, then tap the wheel to spin. You can place chips on as many spots as you like, up to 25 chips on one spot."
    ],
    lines: [
      "A single number pays out your bet x 36",
      "A dozen (1st, 2nd or 3rd 12) pays out your bet x 3",
      "A column (2 to 1) pays out your bet x 3",
      "Red, Black, Odd, Even, 1-18 and 19-36 pay out your bet x 2",
      "Zero is green. It only wins if you bet on zero."
    ]
  },
  Blackjack: {
    title: "Blackjack",
    intro: ["Get closer to 21 than the dealer without going over. Hit to take a card, stand to keep your hand. The dealer stands on 17."],
    lines: ["Blackjack will pay out your bet x 2.5", "A winning hand will pay out your bet x 2", "A push returns your bet"]
  },
  War: {
    title: "War",
    intro: [
      "You and the dealer each draw a card. The higher card wins, and aces are high. On a tie it's war: a second card each, and you win if yours is equal or higher."
    ],
    lines: ["A higher card will pay out your bet x 2", "Winning a war will pay out your bet x 1.5"]
  }
};

export function InfoButton({ game }: { game: InfoGame }) {
  const [open, setOpen] = useState(false);
  const r = RULES[game];

  return (
    <>
      <button
        type="button"
        aria-label={`How ${r.title} works`}
        onClick={() => setOpen(true)}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          width: 30,
          height: 30,
          padding: 0,
          border: 0,
          background: "transparent",
          color: "#f4dfb7",
          fontSize: 20,
          lineHeight: "30px",
          cursor: "pointer",
          textShadow: "0 1px 2px #000"
        }}
      >
        ⓘ
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${r.title} rules`}
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
            background: "rgba(0,0,0,0.78)",
            textAlign: "left"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              maxHeight: "86vh",
              overflowY: "auto",
              boxSizing: "border-box",
              padding: "18px 18px 16px",
              background: "#1c1816",
              border: "2px solid #c69a48",
              borderRadius: 8,
              color: "#f1e8d3",
              fontFamily: "system-ui, sans-serif"
            }}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: 22, color: "#ffffff" }}>{r.title}</h3>
            <p style={{ margin: "0 0 12px", fontSize: 15, lineHeight: 1.5 }}>{OWNED}</p>
            {r.intro.map((t) => (
              <p key={t} style={{ margin: "0 0 12px", fontSize: 15, lineHeight: 1.5 }}>
                {t}
              </p>
            ))}
            {r.lines && (
              <>
                <div style={{ margin: "4px 0 6px", fontSize: 16, fontWeight: 700, color: "#ffffff" }}>Payouts:</div>
                {r.lines.map((t) => (
                  <div key={t} style={{ fontSize: 14, lineHeight: 1.6, color: "#cfc6b0" }}>
                    {t}
                  </div>
                ))}
              </>
            )}
            <div style={{ textAlign: "right", marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  minWidth: 96,
                  padding: "8px 18px",
                  border: "1px solid #c69a48",
                  borderRadius: 999,
                  background: "#f1e8d3",
                  color: "#1c1816",
                  fontSize: 16,
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// The "Owner: name" bar under a casino's title. The name links to their profile.
export function OwnerBar({ ownerName }: { ownerName?: string | null }) {
  let name: ReactNode = <span style={{ color: "#ffffff" }}>Rumrunners</span>;
  if (ownerName) {
    name = (
      <a href={`/profile/${encodeURIComponent(ownerName)}`} style={{ color: "#ffffff", textDecoration: "underline" }}>
        {ownerName}
      </a>
    );
  }
  return (
    <div
      style={{
        margin: "6px 0 0",
        padding: "7px 10px",
        boxSizing: "border-box",
        textAlign: "center",
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: 0.5,
        color: "#e8dcc0",
        background: "linear-gradient(180deg, #6e1220, #590d18)",
        borderTop: "1px solid #c69a48",
        borderBottom: "1px solid #c69a48"
      }}
    >
      Owner: {name}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

export type CrimeOutcome = {
  crimeName: string;
  displayName?: string;
  label: string;
  tier: string;
  sceneTitle: string;
  setup: string;
  result: string;
  success: boolean;
  cashChange: number;
  xpGained: number;
  streakBonus: number;
  leveledUp: boolean;
  rank: string;
  jailSeconds: number;
};

const COLOURS: Record<string, string> = {
  perfect: "#e4c04d",
  clean: "#7fe08f",
  messy: "#d9a441",
  backed_off: "#b7ad93",
  got_away: "#e0a07f",
  caught: "#e06b5e"
};

const CAPTION: Record<string, string> = {
  perfect: "Perfect score",
  clean: "Strong haul",
  messy: "Messy haul",
  backed_off: "Backed off",
  got_away: "Empty-handed",
  caught: "Caught"
};

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;
const SHOW_MS = 9000;

// The small box that pops up after a job and tells you how it went.
export default function CrimePopup({ outcome, onClose }: { outcome: CrimeOutcome; onClose: () => void }) {
  const [running, setRunning] = useState(false);
  // Kept in a ref so the page re-drawing (energy ticks, balance checks) never restarts the timer.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  const colour = COLOURS[outcome.tier] ?? (outcome.success ? "#7fe08f" : "#e06b5e");
  const good = outcome.success;

  useEffect(() => {
    const start = window.setTimeout(() => setRunning(true), 30);
    const end = window.setTimeout(() => closeRef.current(), SHOW_MS);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(end);
    };
  }, [outcome]);

  const fined = outcome.cashChange < 0;
  const hasMoney = outcome.cashChange !== 0;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-label={outcome.label}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0, 0, 0, 0.5)"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#1d2723",
          border: `1px solid ${colour}`,
          boxShadow: "0 8px 30px rgba(0,0,0,0.7)",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 12px",
            background: "linear-gradient(180deg, #2f3b35, #232d28)",
            borderBottom: `1px solid ${colour}`
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1, color: good ? "#4fd35a" : "#e06b5e" }}>
            {good ? "✔" : "✖"}
          </span>
          <span
            style={{
              flex: 1,
              fontFamily: "Georgia, serif",
              fontSize: 19,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "#f7efdb"
            }}
          >
            {outcome.label}
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{ background: "none", border: 0, color: "#b7ad93", fontSize: 18, cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        {outcome.leveledUp && (
          <div
            style={{
              padding: "6px 10px",
              textAlign: "center",
              fontFamily: "Georgia, serif",
              fontSize: 15,
              color: "#1b1405",
              background: "linear-gradient(180deg, #f0d878, #c9a23a)"
            }}
          >
            ★ Promoted to {outcome.rank}! ★
            <div style={{ fontSize: 11, marginTop: 1 }}>New jobs may have opened up.</div>
          </div>
        )}

        <div style={{ padding: "10px 12px" }}>
          <div
            style={{
              fontSize: 11,
              color: "#9d9680",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 4
            }}
          >
            {outcome.displayName ?? outcome.crimeName} · {outcome.sceneTitle}
          </div>
          {outcome.setup && (
            <p style={{ margin: "0 0 5px", fontStyle: "italic", color: "#c9bfa6", fontSize: 13, lineHeight: 1.4 }}>
              {outcome.setup}
            </p>
          )}
          <p style={{ margin: "0 0 10px", color: "#f1e8d3", fontSize: 14, lineHeight: 1.4 }}>{outcome.result}</p>

          {hasMoney && (
            <div
              style={{
                textAlign: "center",
                padding: "8px 6px",
                border: `1px solid ${fined ? "#7a3a33" : "#3f7a47"}`,
                background: fined ? "rgba(122, 58, 51, 0.25)" : "rgba(63, 122, 71, 0.25)"
              }}
            >
              <div style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 700, color: fined ? "#f09a8c" : "#8ff09a" }}>
                {fined ? `−${gbp(Math.abs(outcome.cashChange))}` : `+${gbp(outcome.cashChange)}`}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: fined ? "#d9877a" : "#6fc77a" }}>
                {fined ? "Fined" : CAPTION[outcome.tier] ?? "Take"}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 10, fontSize: 14, color: "#e9e0c8" }}>
            <span>
              <span style={{ color: "#e4c04d" }}>★</span> +{outcome.xpGained} XP
            </span>
            {outcome.success && outcome.streakBonus > 0 && (
              <span style={{ color: "#7fe08f" }}>🔥 Streak +{Math.round(outcome.streakBonus * 100)}%</span>
            )}
            {outcome.jailSeconds > 0 && (
              <span style={{ color: "#f09a8c" }}>
                ⛓ Jailed {outcome.jailSeconds >= 60 ? `${Math.ceil(outcome.jailSeconds / 60)} min` : `${outcome.jailSeconds} sec`}
              </span>
            )}
          </div>
        </div>

        <div style={{ height: 4, background: "#0e1411" }}>
          <div
            style={{
              height: "100%",
              width: running ? "0%" : "100%",
              background: colour,
              transition: `width ${SHOW_MS}ms linear`
            }}
          />
        </div>
      </div>
    </div>
  );
}

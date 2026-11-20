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

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;
const SHOW_MS = 6000;

// The small box that pops up after a job: what happened and whether it worked.
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
    const start = window.setTimeout(() => setRunning(true), 60);
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
          maxWidth: 340,
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
            gap: 8,
            padding: "7px 10px",
            background: "linear-gradient(180deg, #2f3b35, #232d28)",
            borderBottom: `1px solid ${colour}`
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1, color: good ? "#4fd35a" : "#e06b5e" }}>
            {good ? "✔" : "✖"}
          </span>
          <span
            style={{
              flex: 1,
              fontFamily: "Georgia, serif",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 0.8,
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

        <div style={{ padding: "9px 11px" }}>
          <div
            style={{
              fontSize: 10,
              color: "#9d9680",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 3
            }}
          >
            {outcome.displayName ?? outcome.crimeName}
          </div>
          <p style={{ margin: "0 0 8px", color: "#e9e0c8", fontSize: 13, lineHeight: 1.4 }}>{outcome.result}</p>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              padding: "6px 10px",
              border: `1px solid ${good ? "#3f7a47" : "#7a3a33"}`,
              background: good ? "rgba(63, 122, 71, 0.25)" : "rgba(122, 58, 51, 0.25)"
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: good ? "#6fc77a" : "#d9877a" }}>
              {good ? "Successful" : "Failed"}
            </span>
            {hasMoney && (
              <span style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, color: fined ? "#f09a8c" : "#8ff09a" }}>
                {fined ? `−${gbp(Math.abs(outcome.cashChange))}` : `+${gbp(outcome.cashChange)}`}
              </span>
            )}
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: "#e4c04d" }}>★ +{outcome.xpGained} XP</div>
          {outcome.leveledUp && (
            <div style={{ marginTop: 5, fontFamily: "Georgia, serif", fontSize: 13, color: "#e4c04d" }}>
              ★ Promoted to {outcome.rank}! New jobs may have opened up.
            </div>
          )}

          {outcome.jailSeconds > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#f09a8c" }}>
              ⛓ Jailed {outcome.jailSeconds >= 60 ? `${Math.ceil(outcome.jailSeconds / 60)} min` : `${outcome.jailSeconds} sec`}
            </div>
          )}
        </div>

        <div style={{ height: 3, background: "#0e1411" }}>
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

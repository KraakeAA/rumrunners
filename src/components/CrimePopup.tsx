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
        background: "rgba(0, 0, 0, 0.45)"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 270,
          background: "#1a221e",
          border: "1px solid #6b5d3a",
          borderTop: `2px solid ${colour}`,
          boxShadow: "0 6px 22px rgba(0,0,0,0.7)",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            borderBottom: "1px solid #3a3320"
          }}
        >
          <span
            style={{
              flex: 1,
              fontFamily: "Georgia, serif",
              fontSize: 12,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: colour
            }}
          >
            {outcome.label}
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{ background: "none", border: 0, color: "#8f8670", fontSize: 15, lineHeight: 1, cursor: "pointer", padding: 0 }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "6px 8px" }}>
          <div style={{ fontSize: 9, color: "#8f8670", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 }}>
            {outcome.displayName ?? outcome.crimeName}
          </div>
          <p style={{ margin: "0 0 6px", color: "#e0d7bf", fontSize: 12, lineHeight: 1.35 }}>{outcome.result}</p>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              padding: "3px 6px",
              borderTop: "1px solid #3a3320",
              borderBottom: "1px solid #3a3320"
            }}
          >
            <span style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: good ? "#7fc48a" : "#d9877a" }}>
              {good ? "Successful" : "Failed"}
            </span>
            {hasMoney && (
              <span style={{ fontSize: 13, fontWeight: 600, color: fined ? "#f09a8c" : "#8fdf9a" }}>
                {fined ? `−${gbp(Math.abs(outcome.cashChange))}` : `+${gbp(outcome.cashChange)}`}
              </span>
            )}
          </div>

          {outcome.jailSeconds > 0 && (
            <div style={{ marginTop: 5, fontSize: 11, color: "#f09a8c" }}>
              Jailed for {outcome.jailSeconds >= 60 ? `${Math.ceil(outcome.jailSeconds / 60)} min` : `${outcome.jailSeconds} sec`}
            </div>
          )}
        </div>

        <div style={{ height: 2, background: "#0e1411" }}>
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

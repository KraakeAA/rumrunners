"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Stats = {
  takenAt: string;
  players: { total: number; alive: number };
  money: { cash: number; bank: number; crewBanks: number; total: number; gold: number; previousTotal: number | null };
  crimes: {
    total: number;
    succeeded: number;
    failed: number;
    cashEarned: number;
  };
  autoTheft: { stolen: number; failed: number; carsNow: number };
  organisedCrime: { jobs: number; earned: number };
  kills: number;
  crews: { id: string; name: string; color: string; members: number }[];
};

const bar: CSSProperties = {
  padding: "6px 8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 15,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};
const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  padding: "5px 10px",
  border: "1px solid #6b5d3a",
  borderTop: 0,
  background: "#1f2a25",
  fontSize: 13
};

const n = (v: number) => v.toLocaleString("en-GB");
const gbp = (v: number) => `£${v.toLocaleString("en-GB")}`;
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : "0%");

function Row({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div style={rowStyle}>
      <span style={{ color: "#c9bfa6" }}>{label}</span>
      <strong style={{ fontWeight: 600, color: tone === "good" ? "#7fe08f" : tone === "bad" ? "#f09a8c" : "#f7efdb", textAlign: "right" }}>
        {value}
      </strong>
    </div>
  );
}

export default function GameStatistics() {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/stats", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(String(d.error ?? "Statistics could not be loaded."));
        setS(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Statistics could not be loaded."));
  }, []);

  if (error) return <p className="notice" style={{ color: "#f09a8c" }}>{error}</p>;
  if (!s) return <p className="flavour">Loading…</p>;

  const change = s.money.previousTotal == null ? null : s.money.total - s.money.previousTotal;

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Game Statistics</div>
      <div style={{ ...rowStyle, justifyContent: "center", fontSize: 11, color: "#b7ad93" }}>
        Updated every hour · last at{" "}
        {new Date(s.takenAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </div>

      <div style={{ ...bar, marginTop: 8 }}>Players</div>
      <Row label="Players alive" value={n(s.players.alive)} />
      <Row label="Players in total" value={n(s.players.total)} />
      <Row label="Kills" value={n(s.kills)} />

      <div style={{ ...bar, marginTop: 8 }}>Money in the game</div>
      <Row label="Cash in hand" value={gbp(s.money.cash)} />
      <Row label="In banks" value={gbp(s.money.bank)} />
      <Row label="In crew banks" value={gbp(s.money.crewBanks)} />
      <Row label="Total money" value={gbp(s.money.total)} />
      {change !== null && (
        <Row
          label="Change since last update"
          value={`${change > 0 ? "+" : change < 0 ? "-" : ""}${gbp(Math.abs(change))}`}
          tone={change > 0 ? "good" : change < 0 ? "bad" : undefined}
        />
      )}
      <Row label="Gold held" value={n(s.money.gold)} />

      <div style={{ ...bar, marginTop: 8 }}>Crimes</div>
      <Row label="Crimes committed" value={n(s.crimes.total)} />
      <Row label="Succeeded" value={n(s.crimes.succeeded)} />
      <Row label="Failed" value={n(s.crimes.failed)} />
      <Row label="Success rate" value={pct(s.crimes.succeeded, s.crimes.total)} />
      <Row label="Cash earned from crimes" value={gbp(s.crimes.cashEarned)} />

      <div style={{ ...bar, marginTop: 8 }}>Auto theft</div>
      <Row label="Cars stolen" value={n(s.autoTheft.stolen)} />
      <Row label="Thefts failed" value={n(s.autoTheft.failed)} />
      <Row label="Success rate" value={pct(s.autoTheft.stolen, s.autoTheft.stolen + s.autoTheft.failed)} />
      <Row label="Cars in garages now" value={n(s.autoTheft.carsNow)} />

      <div style={{ ...bar, marginTop: 8 }}>Organised crime</div>
      <Row label="Jobs completed" value={n(s.organisedCrime.jobs)} />
      <Row label="Total paid out" value={gbp(s.organisedCrime.earned)} />

      <div style={{ ...bar, marginTop: 8 }}>Crews</div>
      {s.crews.length === 0 ? (
        <div style={{ ...rowStyle, color: "#b7ad93" }}>There are no crews yet.</div>
      ) : (
        s.crews.map((c) => (
          <a
            key={c.id}
            href={`/crew/${c.id}`}
            style={{ ...rowStyle, textDecoration: "none", color: "#f7efdb", alignItems: "center" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span aria-hidden="true" style={{ width: 12, height: 12, background: c.color, border: "1px solid #000", flexShrink: 0 }} />
              <span style={{ overflowWrap: "anywhere" }}>{c.name}</span>
            </span>
            <span style={{ color: "#b7ad93", flexShrink: 0 }}>{c.members} members ›</span>
          </a>
        ))
      )}
    </div>
  );
}

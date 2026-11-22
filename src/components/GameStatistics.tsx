"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

type Stats = {
  takenAt: string;
  players: { total: number; alive: number };
  money: { cash: number; bank: number; crewBanks: number; total: number; gold: number; previousTotal: number | null };
  crimes: { total: number; succeeded: number; failed: number; cashEarned: number };
  autoTheft: { stolen: number; failed: number; carsNow: number };
  organisedCrime: { jobs: number; earned: number };
  kills: number;
  ranks?: { rank: string; players: number }[];
  topBusters?: { username: string; busts: number }[];
  busts?: { won: number; failed: number };
  crews: { id: string; name: string; color: string; members: number }[];
};

const bar: CSSProperties = {
  padding: "1px 6px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 11,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};
const cell: CSSProperties = {
  padding: "1px 6px",
  borderBottom: "1px solid #3a3320",
  fontSize: 11,
  lineHeight: 1.25
};
const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  border: "1px solid #6b5d3a",
  borderTop: 0,
  background: "#1f2a25"
};

const n = (v: number) => v.toLocaleString("en-GB");
const gbp = (v: number) => `£${v.toLocaleString("en-GB")}`;
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : "0%");

function Section({ title, children, first }: { title: string; children: ReactNode; first?: boolean }) {
  return (
    <>
      <div style={{ ...bar, marginTop: first ? 0 : 4 }}>{title}</div>
      <table style={table}>
        <tbody>{children}</tbody>
      </table>
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <tr>
      <td style={{ ...cell, color: "#c9bfa6" }}>{label}</td>
      <td
        style={{
          ...cell,
          textAlign: "right",
          fontWeight: 600,
          color: tone === "good" ? "#7fe08f" : tone === "bad" ? "#f09a8c" : "#f7efdb"
        }}
      >
        {value}
      </td>
    </tr>
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
  const ranks = s.ranks ?? [];
  const busters = s.topBusters ?? [];

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={{ ...bar, fontSize: 12, padding: "2px 6px" }}>Statistics</div>
      <div style={{ ...cell, textAlign: "center", fontSize: 9, color: "#b7ad93", border: "1px solid #6b5d3a", borderTop: 0, background: "#1f2a25" }}>
        Updated every hour · last at{" "}
        {new Date(s.takenAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </div>

      <Section title="Crews">
        {s.crews.length === 0 ? (
          <tr>
            <td style={{ ...cell, color: "#b7ad93" }}>There are no crews yet.</td>
          </tr>
        ) : (
          s.crews.map((c) => (
            <tr key={c.id}>
              <td style={cell}>
                <a href={`/crew/${c.id}`} style={{ color: "#f7efdb", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, background: c.color, border: "1px solid #000", flexShrink: 0 }} />
                  <span style={{ overflowWrap: "anywhere" }}>{c.name}</span>
                </a>
              </td>
              <td style={{ ...cell, textAlign: "right", color: "#b7ad93", whiteSpace: "nowrap" }}>{c.members}</td>
            </tr>
          ))
        )}
      </Section>

      <Section title="Players">
        <Row label="Players alive" value={n(s.players.alive)} />
        <Row label="Players in total" value={n(s.players.total)} />
        <Row label="Kills" value={n(s.kills)} />
      </Section>

      <Section title="Money in the game">
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
      </Section>

      <Section title="Crimes">
        <Row label="Crimes committed" value={n(s.crimes.total)} />
        <Row label="Succeeded" value={n(s.crimes.succeeded)} />
        <Row label="Failed" value={n(s.crimes.failed)} />
        <Row label="Success rate" value={pct(s.crimes.succeeded, s.crimes.total)} />
        <Row label="Cash earned" value={gbp(s.crimes.cashEarned)} />
      </Section>

      <Section title="Auto theft">
        <Row label="Cars stolen" value={n(s.autoTheft.stolen)} />
        <Row label="Thefts failed" value={n(s.autoTheft.failed)} />
        <Row label="Success rate" value={pct(s.autoTheft.stolen, s.autoTheft.stolen + s.autoTheft.failed)} />
        <Row label="Cars in garages" value={n(s.autoTheft.carsNow)} />
      </Section>

      <Section title="Organised crime">
        <Row label="Jobs completed" value={n(s.organisedCrime.jobs)} />
        <Row label="Total paid out" value={gbp(s.organisedCrime.earned)} />
      </Section>

      {s.busts && (
        <Section title="Jail busts">
          <Row label="Successful busts" value={n(s.busts.won)} />
          <Row label="Failed busts" value={n(s.busts.failed)} />
          <Row label="Success rate" value={pct(s.busts.won, s.busts.won + s.busts.failed)} />
        </Section>
      )}

      {ranks.length > 0 && (
        <Section title="Ranks">
          {ranks.map((r) => (
            <Row key={r.rank} label={r.rank} value={n(r.players)} />
          ))}
        </Section>
      )}

      {busters.length > 0 && (
        <Section title="Top 10 busters">
          {busters.map((b, i) => (
            <tr key={b.username}>
              <td style={cell}>
                <span style={{ color: "#b7ad93", display: "inline-block", width: 18 }}>{i + 1}.</span>
                <a href={`/profile/${encodeURIComponent(b.username)}`} style={{ color: "#f7efdb", textDecoration: "none" }}>
                  {b.username}
                </a>
              </td>
              <td style={{ ...cell, textAlign: "right", fontWeight: 600, color: "#f7efdb" }}>{n(b.busts)}</td>
            </tr>
          ))}
        </Section>
      )}
    </div>
  );
}

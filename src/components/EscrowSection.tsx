"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";

type Item = { id: string; mine: boolean; kind: string; amount: number; carName: string };
type Escrow = {
  id: string;
  status: "invited" | "active";
  fromMe: boolean;
  expiresAt: string | null;
  other: string;
  myLocked: boolean;
  theirLocked: boolean;
  myAgreed: boolean;
  theirAgreed: boolean;
  items: Item[];
};
type Data = {
  meName: string;
  money: number;
  gold: number;
  feePercent: number;
  maxItems: number;
  cars: { id: string; name: string; plate: string; city: string }[];
  casinos: { id: string; name: string }[];
  statements: { id: string; name: string }[];
  escrows: Escrow[];
};

const GOLD = "#b0904a";
const LINE = "#6b5d3a";

const wrap: CSSProperties = { width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 };
const panel: CSSProperties = { border: `1px solid ${LINE}`, background: "#1f2a25", color: "#f1e8d3", fontSize: 13 };
const bar: CSSProperties = {
  padding: "6px 8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 15,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderBottom: `1px solid ${GOLD}`,
  textShadow: "0 1px 2px #000"
};
const subBar: CSSProperties = {
  padding: "4px 8px",
  fontSize: 11,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: "#e3d3a8",
  background: "#171d1a",
  borderBottom: `1px solid ${LINE}`
};
const input: CSSProperties = {
  height: 32,
  padding: "0 8px",
  border: `1px solid ${LINE}`,
  borderRadius: 3,
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16,
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box"
};
const primary: CSSProperties = {
  padding: "7px 14px",
  border: `1px solid ${GOLD}`,
  borderRadius: 3,
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  color: "#f7efdb",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap"
};
const secondary: CSSProperties = {
  padding: "7px 14px",
  border: `1px solid ${LINE}`,
  borderRadius: 3,
  background: "#171d1a",
  color: "#e4dac3",
  fontSize: 13,
  cursor: "pointer",
  whiteSpace: "nowrap"
};
const mini: CSSProperties = { ...primary, padding: "5px 12px", fontSize: 12 };
const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

const kindTag: Record<string, string> = { cash: "Cash", gold: "Gold", car: "Car", casino: "Casino", statement: "Statement" };

function itemText(i: Item) {
  if (i.kind === "cash") return gbp(i.amount);
  if (i.kind === "gold") return `${i.amount.toLocaleString("en-GB")} gold`;
  return i.carName; // a car, a casino or a witness statement
}

function secondsLeft(iso: string | null, now: number): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
}

function timeLeft(iso: string | null, now: number): string {
  const s = secondsLeft(iso, now);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Name({ name }: { name: string }) {
  return (
    <Link
      href={`/profile/${encodeURIComponent(name)}`}
      style={{ fontWeight: 700, color: "#ffe08a", textDecoration: "underline", textDecorationColor: LINE, textUnderlineOffset: 3 }}
    >
      {name}
    </Link>
  );
}

function Pill({ children, tone }: { children: ReactNode; tone: "good" | "wait" | "warn" }) {
  const colours = {
    good: { c: "#9be39f", b: "#2f5a38", bg: "#1b2e21" },
    wait: { c: "#b7ad93", b: "#3a3a2c", bg: "#1a1f1c" },
    warn: { c: "#f0c46a", b: "#6b5d3a", bg: "#2a2619" }
  }[tone];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 8px",
        borderRadius: 999,
        fontSize: 11,
        color: colours.c,
        border: `1px solid ${colours.b}`,
        background: colours.bg,
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </span>
  );
}

export default function EscrowSection({
  onCash,
  onGold
}: {
  onCash: (money: number) => void;
  onGold: (gold: number) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [username, setUsername] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [carId, setCarId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [good, setGood] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/escrow", { cache: "no-store" });
      if (!r.ok) return;
      const d: Data = await r.json();
      setData(d);
      onCash(d.money);
      onGold(d.gold);
    } catch {
      /* keep what is on screen */
    }
  }, [onCash, onGold]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 4000);
    return () => window.clearInterval(t);
  }, [load]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const j = await r.json().catch(() => ({}));
      setGood(r.ok);
      setMessage(r.ok ? String(j.message ?? "Done.") : String(j.error ?? "That did not work."));
      if (r.ok && payload.action === "invite") setUsername("");
      await load();
    } catch {
      setGood(false);
      setMessage("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div style={wrap}>
        <div style={{ ...panel }}>
          <div style={bar}>Escrow Services</div>
          <p className="flavour" style={{ padding: 8, margin: 0 }}>Loading…</p>
        </div>
      </div>
    );
  }

  const notice = message ? (
    <div
      style={{
        padding: "6px 8px",
        textAlign: "center",
        fontSize: 12,
        border: `1px solid ${good ? "#2f5a38" : "#6b3a33"}`,
        background: good ? "#1b2e21" : "#2e1d1a",
        color: good ? "#9be39f" : "#f09a8c"
      }}
    >
      {message}
    </div>
  ) : null;

  // Once an invitation is accepted, both players go straight into the trade window.
  const current = data.escrows.find((e) => e.status === "active");

  // ---------------- The trade window ----------------
  if (current) {
    const mine = current.items.filter((i) => i.mine);
    const theirs = current.items.filter((i) => !i.mine);
    const bothAccepted = current.myLocked && current.theirLocked;
    const myCash = mine.filter((i) => i.kind === "cash").reduce((n, i) => n + i.amount, 0);
    const theirCash = theirs.filter((i) => i.kind === "cash").reduce((n, i) => n + i.amount, 0);
    const fee = (n: number) => Math.floor((n * data.feePercent) / 100);
    const left = secondsLeft(current.expiresAt, now);

    const step = (n: number, label: string, on: boolean, done: boolean) => (
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            fontWeight: 700,
            color: on || done ? "#1a1408" : "#8f8a76",
            background: on || done ? GOLD : "#2a2f2c",
            border: `1px solid ${on || done ? GOLD : "#3a3a2c"}`
          }}
        >
          {done ? "✓" : n}
        </span>
        <span style={{ fontSize: 12, color: on ? "#f7efdb" : "#8f8a76", fontWeight: on ? 700 : 400 }}>{label}</span>
      </div>
    );

    // One half of the window: a header with the player's name, their items, and a status line.
    const side = (name: string, items: Item[], accepted: boolean, who: "you" | "them") => (
      <div style={{ border: `1px solid ${LINE}`, background: "#1a221e", minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            padding: "5px 8px",
            textAlign: "center",
            fontFamily: "Georgia, serif",
            fontSize: 13,
            color: "#f7efdb",
            background: "linear-gradient(180deg, #5c4a22, #3a2f16)",
            borderBottom: `1px solid ${GOLD}`,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {who === "you" ? "You" : name}
        </div>
        <div style={{ padding: "4px 8px", minHeight: 64, flex: 1 }}>
          {items.length === 0 && <div style={{ color: "#8f8a76", fontSize: 12, padding: "8px 0", textAlign: "center" }}>Nothing added yet</div>}
          {items.map((i) => (
            <div
              key={i.id}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: "1px solid #2b3630", minWidth: 0 }}
            >
              <span style={{ fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase", color: "#c9b27a", flexShrink: 0, width: 50 }}>
                {kindTag[i.kind] ?? i.kind}
              </span>
              <span style={{ fontSize: 13, overflowWrap: "anywhere", minWidth: 0 }}>{itemText(i)}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "4px 8px", textAlign: "center", borderTop: "1px solid #2b3630" }}>
          <Pill tone={accepted ? "good" : "wait"}>{accepted ? (bothAccepted ? "Agreed" : "Locked in") : bothAccepted ? "Not agreed" : "Not accepted"}</Pill>
        </div>
      </div>
    );

    // The statuses are different on the agree screen, so work them out here.
    const mineStatus = bothAccepted ? current.myAgreed : current.myLocked;
    const theirStatus = bothAccepted ? current.theirAgreed : current.theirLocked;

    const feeNotes =
      myCash > 0 || theirCash > 0 ? (
        <div style={{ padding: "6px 8px", fontSize: 11, color: "#b7ad93", lineHeight: 1.5, borderTop: `1px solid ${LINE}`, background: "#171d1a" }}>
          {myCash > 0 && (
            <div>
              {current.other} receives <b style={{ color: "#f1e8d3" }}>{gbp(myCash - fee(myCash))}</b> of your {gbp(myCash)} after the agent&apos;s {data.feePercent}% fee.
            </div>
          )}
          {theirCash > 0 && (
            <div>
              You receive <b style={{ color: "#f1e8d3" }}>{gbp(theirCash - fee(theirCash))}</b> of their {gbp(theirCash)} after the agent&apos;s {data.feePercent}% fee.
            </div>
          )}
        </div>
      ) : null;

    // Only two choices on every trade screen: cancel, or go forward.
    const choices = (label: string, doneLabel: string, done: boolean, action: string) => (
      <div style={{ display: "flex", gap: 8, padding: 8, borderTop: `1px solid ${LINE}`, background: "#171d1a" }}>
        <button
          type="button"
          style={{ ...secondary, flex: 1, padding: "10px 12px", fontSize: 14, opacity: busy ? 0.55 : 1 }}
          disabled={busy}
          onClick={() => act({ action: "cancel", id: current.id })}
        >
          Cancel
        </button>
        <button
          type="button"
          style={{ ...primary, flex: 1, padding: "10px 12px", fontSize: 14, opacity: busy || done ? 0.5 : 1 }}
          disabled={busy || done}
          onClick={() => act({ action, id: current.id })}
        >
          {done ? doneLabel : label}
        </button>
      </div>
    );

    return (
      <div style={wrap}>
        <div style={panel}>
          <div style={bar}>Escrow Trade</div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 8px", borderBottom: `1px solid ${LINE}`, background: "#171d1a" }}>
            <span style={{ fontSize: 13 }}>
              Trading with <Name name={current.other} />
            </span>
            <Pill tone={left < 300 ? "warn" : "wait"}>{timeLeft(current.expiresAt, now)} left</Pill>
          </div>

          <div style={{ display: "flex", padding: "7px 8px", borderBottom: `1px solid ${LINE}` }}>
            {step(1, "Offers", !bothAccepted, bothAccepted)}
            <div style={{ width: 24, alignSelf: "center", height: 1, background: LINE }} />
            {step(2, "Agree", bothAccepted, false)}
          </div>

          {notice && <div style={{ padding: 8, paddingBottom: 0 }}>{notice}</div>}

          <div style={{ padding: 8, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#c9bfa6", textAlign: "center", lineHeight: 1.45 }}>
              {bothAccepted
                ? "Both offers are locked in. Check the trade, then agree. When you have both agreed the agent hands everything over."
                : current.myLocked
                  ? `Your offer is locked in. Waiting for ${current.other} to accept.`
                  : "Add what you want to trade, then press Accept to lock your offer in."}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {side(data.meName, mine, mineStatus, "you")}
              {side(current.other, theirs, theirStatus, "them")}
            </div>
          </div>

          {feeNotes}

          {!bothAccepted && !current.myLocked && (
            <div style={{ borderTop: `1px solid ${LINE}` }}>
              <div style={subBar}>Add to the trade</div>
              <div style={{ padding: 8, display: "grid", gap: 6 }}>
                {(["gold", "cash"] as const).map((k) => (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 6, alignItems: "center" }}>
                    <span style={{ color: "#e4dac3", fontSize: 12 }}>{k === "gold" ? "Gold" : "Cash"}</span>
                    <input
                      inputMode="numeric"
                      placeholder={k === "gold" ? "Amount of gold" : "Amount in £"}
                      value={amounts[k] ?? ""}
                      onChange={(e) => setAmounts({ ...amounts, [k]: e.target.value.replace(/\D/g, "") })}
                      style={input}
                      aria-label={`${k} to add`}
                    />
                    <button
                      type="button"
                      style={{ ...mini, opacity: busy || !(Number(amounts[k]) > 0) ? 0.5 : 1 }}
                      disabled={busy || !(Number(amounts[k]) > 0)}
                      onClick={async () => {
                        await act({ action: "add", id: current.id, kind: k, amount: Number(amounts[k]) });
                        setAmounts((a) => ({ ...a, [k]: "" }));
                      }}
                    >
                      Add
                    </button>
                  </div>
                ))}

                <div style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 6, alignItems: "center" }}>
                  <span style={{ color: "#e4dac3", fontSize: 12 }}>Car</span>
                  <select value={carId} onChange={(e) => setCarId(e.target.value)} style={input} aria-label="Choose a car">
                    <option value="">{data.cars.length ? "Choose a car…" : "No cars to trade"}</option>
                    {data.cars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.plate ? ` (${c.plate})` : ""} · {c.city}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    style={{ ...mini, opacity: busy || !carId ? 0.5 : 1 }}
                    disabled={busy || !carId}
                    onClick={async () => {
                      await act({ action: "add", id: current.id, kind: "car", carId });
                      setCarId("");
                    }}
                  >
                    Add
                  </button>
                </div>

                {data.casinos.map((c) => (
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 6, alignItems: "center" }}>
                    <span style={{ color: "#e4dac3", fontSize: 12 }}>Casino</span>
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{c.name}</span>
                    <button
                      type="button"
                      style={{ ...mini, opacity: busy ? 0.5 : 1 }}
                      disabled={busy}
                      onClick={() => act({ action: "add", id: current.id, kind: "casino", casinoId: c.id })}
                    >
                      Add
                    </button>
                  </div>
                ))}

                {(data.statements ?? []).map((st) => (
                  <div key={st.id} style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 6, alignItems: "center" }}>
                    <span style={{ color: "#e4dac3", fontSize: 12 }}>Note</span>
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{st.name}</span>
                    <button
                      type="button"
                      style={{ ...mini, opacity: busy ? 0.5 : 1 }}
                      disabled={busy}
                      onClick={() => act({ action: "add", id: current.id, kind: "statement", statementId: st.id })}
                    >
                      Add
                    </button>
                  </div>
                ))}

                <div style={{ fontSize: 11, color: "#b7ad93", lineHeight: 1.5 }}>
                  You have {gbp(data.money)} cash and {data.gold.toLocaleString("en-GB")} gold. Guns, protection and
                  bullets can&apos;t be traded. A casino you add is closed to gamblers while it is in escrow. What you add
                  is taken from your account and held by the agent. It can&apos;t be taken back.
                </div>
              </div>
            </div>
          )}

          {!bothAccepted && !current.myLocked && (
            <div style={{ padding: "6px 8px", fontSize: 11, color: "#f0c46a", textAlign: "center", borderTop: `1px solid ${LINE}`, background: "#2a2619" }}>
              Once you press Accept your offer is locked in. If you make a mistake, cancel and start again.
            </div>
          )}

          {bothAccepted
            ? choices("Agree", "Agreed", current.myAgreed, "agree")
            : choices("Accept", "Accepted", current.myLocked, "lock")}
        </div>
      </div>
    );
  }

  // ---------------- The office ----------------
  const invites = data.escrows.filter((e) => e.status === "invited" && !e.fromMe);
  const waiting = data.escrows.filter((e) => e.status === "invited" && e.fromMe);

  return (
    <div style={wrap}>
      <div style={panel}>
        <div style={bar}>Escrow Services</div>
        <div style={{ padding: "8px 10px", color: "#c9bfa6", fontSize: 12, lineHeight: 1.5, borderBottom: `1px solid ${LINE}` }}>
          Trade safely with another player. Once they accept your invitation, an agent holds what each of you adds.
          When you have both agreed, the agent hands everything over. Cash, gold, cars, casinos and witness
          statements can be traded. The agent charges {data.feePercent}% on cash. A trade is cancelled automatically
          after 30 minutes if you haven&apos;t both agreed.
        </div>

        {notice && <div style={{ padding: 8, paddingBottom: 0 }}>{notice}</div>}

        {invites.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={subBar}>Invitations for you</div>
            {invites.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: `1px solid ${LINE}` }}>
                <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                  <Name name={e.other} /> wants to trade with you.
                </span>
                <button type="button" style={{ ...mini, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={() => act({ action: "accept", id: e.id })}>
                  Accept
                </button>
                <button type="button" style={{ ...secondary, padding: "5px 12px", fontSize: 12, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={() => act({ action: "decline", id: e.id })}>
                  Decline
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <div style={subBar}>Start a trade</div>
          <div style={{ display: "flex", gap: 8, padding: 8, borderBottom: `1px solid ${LINE}` }}>
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={input}
              autoCapitalize="none"
              autoCorrect="off"
              aria-label="Username to invite"
            />
            <button
              type="button"
              style={{ ...primary, opacity: busy || !username.trim() ? 0.5 : 1 }}
              disabled={busy || !username.trim()}
              onClick={() => act({ action: "invite", username })}
            >
              Invite
            </button>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={subBar}>Pending</div>
          {invites.length + waiting.length === 0 && (
            <div style={{ padding: "10px 8px", textAlign: "center", color: "#8f8a76", fontSize: 12 }}>You have no pending escrows</div>
          )}
          {waiting.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderTop: `1px solid ${LINE}` }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                Waiting for <Name name={e.other} /> to accept
                <div style={{ marginTop: 2 }}>
                  <Pill tone="wait">{timeLeft(e.expiresAt, now)} left</Pill>
                </div>
              </span>
              <button type="button" style={{ ...secondary, padding: "5px 12px", fontSize: 12, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={() => act({ action: "cancel", id: e.id })}>
                Cancel
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

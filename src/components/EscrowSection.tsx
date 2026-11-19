"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

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
  escrows: Escrow[];
};

const bar: CSSProperties = {
  padding: "6px 8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 16,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};
const box: CSSProperties = { border: "1px solid #6b5d3a", background: "#1f2a25", padding: "8px 10px", fontSize: 13 };
const input: CSSProperties = {
  height: 32,
  padding: "0 8px",
  border: "1px solid #a08340",
  borderRadius: 0,
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16,
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box"
};
const small: CSSProperties = { padding: "5px 12px", fontSize: 12, flexShrink: 0 };
const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

function itemText(i: Item) {
  if (i.kind === "cash") return gbp(i.amount);
  if (i.kind === "gold") return `${i.amount.toLocaleString("en-GB")} gold`;
  return i.carName; // a car or a casino
}

function timeLeft(iso: string | null, now: number): string {
  if (!iso) return "";
  const s = Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function EscrowSection({
  onCash,
  onGold
}: {
  onCash: (money: number) => void;
  onGold: (gold: number) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [openId, setOpenId] = useState("");
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
    const t = window.setInterval(load, 8000);
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
      if (r.ok) {
        if (payload.action === "invite") setUsername("");
        if (payload.action === "cancel" || payload.action === "decline") setOpenId("");
      }
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
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
        <div style={bar}>Escrow Services</div>
        <p className="flavour">Loading…</p>
      </div>
    );
  }

  const notice = message && (
    <p className="notice" style={{ margin: "2px 0", color: good ? "#7fe08f" : "#f09a8c" }}>
      {message}
    </p>
  );

  const current = data.escrows.find((e) => e.id === openId && e.status === "active");

  // ---------------- The trade screen ----------------
  if (current) {
    const mine = current.items.filter((i) => i.mine);
    const theirs = current.items.filter((i) => !i.mine);
    const bothAccepted = current.myLocked && current.theirLocked;
    const myCash = mine.filter((i) => i.kind === "cash").reduce((n, i) => n + i.amount, 0);
    const theirCash = theirs.filter((i) => i.kind === "cash").reduce((n, i) => n + i.amount, 0);
    const fee = (n: number) => Math.floor((n * data.feePercent) / 100);

    // The split window: one half for each player, the name above.
    const side = (name: string, items: Item[], accepted: boolean) => (
      <div style={{ border: "1px solid #6b5d3a", background: "#1f2a25", minWidth: 0 }}>
        <div
          style={{
            padding: "5px 6px",
            textAlign: "center",
            fontFamily: "Georgia, serif",
            fontSize: 14,
            color: "#f7efdb",
            background: "linear-gradient(180deg, #5c4a22, #3a2f16)",
            borderBottom: "1px solid #a08340",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {name}
        </div>
        <div style={{ padding: "6px 8px", minHeight: 70, fontSize: 13 }}>
          {items.length === 0 && <div style={{ color: "#8f8a76" }}>Nothing added</div>}
          {items.map((i) => (
            <div key={i.id} style={{ padding: "3px 0", borderBottom: "1px solid #2b3630", overflowWrap: "anywhere" }}>
              {itemText(i)}
            </div>
          ))}
        </div>
        <div
          style={{
            padding: "3px 6px",
            textAlign: "center",
            fontSize: 11,
            borderTop: "1px solid #2b3630",
            color: accepted ? "#9be39f" : "#8f8a76"
          }}
        >
          {accepted ? "Accepted" : "Not accepted"}
        </div>
      </div>
    );

    const feeNotes = (
      <>
        {myCash > 0 && (
          <div style={{ fontSize: 11, color: "#b7ad93" }}>
            {current.other} receives {gbp(myCash - fee(myCash))} of your {gbp(myCash)} after the agent&apos;s{" "}
            {data.feePercent}% fee.
          </div>
        )}
        {theirCash > 0 && (
          <div style={{ fontSize: 11, color: "#b7ad93" }}>
            You receive {gbp(theirCash - fee(theirCash))} of their {gbp(theirCash)} after the agent&apos;s{" "}
            {data.feePercent}% fee.
          </div>
        )}
      </>
    );

    const timer = (
      <div style={{ fontSize: 12, color: "#e4c04d", textAlign: "center" }}>
        Time left: {timeLeft(current.expiresAt, now)} · the escrow is cancelled automatically if you haven&apos;t both
        agreed by then.
      </div>
    );

    const bottom = (
      <div style={{ display: "flex", gap: 6 }}>
        <button className="button secondary" style={{ ...small, flex: 1 }} onClick={() => setOpenId("")}>
          Back
        </button>
        <button
          className="button secondary"
          style={{ ...small, flex: 1, opacity: busy ? 0.55 : 1 }}
          disabled={busy}
          onClick={() => act({ action: "cancel", id: current.id })}
        >
          Cancel escrow and return everything
        </button>
      </div>
    );

    // ---- Screen 2: both have accepted, now each agrees ----
    if (bothAccepted) {
      return (
        <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
          <div style={bar}>Agree to the trade</div>
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {notice}
            {timer}
            <div style={{ fontSize: 12, color: "#e4c04d", textAlign: "center" }}>
              Both of you accepted. Check the trade, then agree. When you have both agreed the agent hands
              everything over.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {side(data.meName, mine, current.myAgreed)}
              {side(current.other, theirs, current.theirAgreed)}
            </div>
            {feeNotes}
            {!current.myAgreed ? (
              <button
                className="button"
                style={{ opacity: busy ? 0.55 : 1 }}
                disabled={busy}
                onClick={() => act({ action: "agree", id: current.id })}
              >
                Agree
              </button>
            ) : (
              <div style={{ fontSize: 12, color: "#9be39f", textAlign: "center" }}>
                You agreed. Waiting for {current.other} to agree.
              </div>
            )}
            {bottom}
          </div>
        </div>
      );
    }

    // ---- Screen 1: add things, then accept ----
    return (
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
        <div style={bar}>Escrow</div>
        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
          {notice}
          {timer}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {side(data.meName, mine, current.myLocked)}
            {side(current.other, theirs, current.theirLocked)}
          </div>
          {feeNotes}

          {!current.myLocked && (
            <div style={{ ...box, display: "grid", gap: 6 }}>
              {(["gold", "cash"] as const).map((k) => (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "48px 1fr auto", gap: 6, alignItems: "center" }}>
                  <span style={{ color: "#f7efdb" }}>{k === "gold" ? "Gold" : "Cash"}</span>
                  <input
                    inputMode="numeric"
                    placeholder={k === "gold" ? "Amount of gold" : "Amount in £"}
                    value={amounts[k] ?? ""}
                    onChange={(e) => setAmounts({ ...amounts, [k]: e.target.value.replace(/\D/g, "") })}
                    style={input}
                    aria-label={`${k} to add`}
                  />
                  <button
                    className="button"
                    style={{ ...small, opacity: busy ? 0.55 : 1 }}
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

              <div style={{ display: "grid", gridTemplateColumns: "48px 1fr auto", gap: 6, alignItems: "center" }}>
                <span style={{ color: "#f7efdb" }}>Car</span>
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
                  className="button"
                  style={{ ...small, opacity: busy ? 0.55 : 1 }}
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
                <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}>
                  <span style={{ color: "#f7efdb" }}>{c.name}</span>
                  <button
                    className="button"
                    style={{ ...small, opacity: busy ? 0.55 : 1 }}
                    disabled={busy}
                    onClick={() => act({ action: "add", id: current.id, kind: "casino", casinoId: c.id })}
                  >
                    Add
                  </button>
                </div>
              ))}

              <div style={{ fontSize: 11, color: "#b7ad93" }}>
                You have {gbp(data.money)} cash and {data.gold.toLocaleString("en-GB")} gold. You can add as many
                things as you like. Guns, protection and bullets can&apos;t be traded. A casino you add is closed to gamblers while it is in escrow. What you add is taken from
                your account and held by the agent, and can't be taken back.
              </div>
            </div>
          )}

          {!current.myLocked ? (
            <>
              <div style={{ fontSize: 11, color: "#e4c04d", textAlign: "center" }}>
                Once you press Accept your offer is locked in. Nothing can be taken back, so if you make a mistake
                you will need to cancel the escrow and start again.
              </div>
              <button
                className="button"
                style={{ opacity: busy ? 0.55 : 1 }}
                disabled={busy}
                onClick={() => act({ action: "lock", id: current.id })}
              >
                Accept
              </button>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "#b7ad93", textAlign: "center" }}>
              You accepted, so your offer is locked in. Waiting for {current.other} to accept.
            </div>
          )}
          {bottom}
        </div>
      </div>
    );
  }

  // ---------------- The office ----------------
  const invites = data.escrows.filter((e) => e.status === "invited" && !e.fromMe);
  const waiting = data.escrows.filter((e) => e.status === "invited" && e.fromMe);
  const active = data.escrows.filter((e) => e.status === "active");

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Escrow Services</div>
      <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
        <div style={{ ...box, color: "#c9bfa6", fontSize: 12, lineHeight: 1.5 }}>
          Trade safely with another player. Once they accept your invitation, an agent takes possession of the
          goods each of you adds. When you have both locked your offers and agreed to the trade, the agent hands
          everything over. Cash, gold, cars and casinos can be traded, and the agent charges {data.feePercent}% on all cash. An escrow is cancelled automatically after 30 minutes if you haven&apos;t both agreed.
        </div>

        {notice}

        {invites.length > 0 && (
          <>
            <div style={{ ...bar, fontSize: 14 }}>Invitations for you</div>
            {invites.map((e) => (
              <div key={e.id} style={{ ...box, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1 }}>
                  <strong>{e.other}</strong> wants to trade with you.
                </span>
                <button
                  className="button"
                  style={{ ...small, opacity: busy ? 0.55 : 1 }}
                  disabled={busy}
                  onClick={async () => {
                    await act({ action: "accept", id: e.id });
                    setOpenId(e.id);
                  }}
                >
                  Accept
                </button>
                <button
                  className="button secondary"
                  style={{ ...small, opacity: busy ? 0.55 : 1 }}
                  disabled={busy}
                  onClick={() => act({ action: "decline", id: e.id })}
                >
                  Decline
                </button>
              </div>
            ))}
          </>
        )}

        <div style={{ ...bar, fontSize: 14 }}>Schedule escrow</div>
        <div style={{ ...box, display: "grid", gap: 6 }}>
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={input}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button
            className="button"
            style={{ opacity: busy ? 0.55 : 1 }}
            disabled={busy || !username.trim()}
            onClick={() => act({ action: "invite", username })}
          >
            Send invitation
          </button>
        </div>

        <div style={{ ...bar, fontSize: 14 }}>Pending escrows</div>
        {invites.length + waiting.length + active.length === 0 && (
          <div style={{ ...box, textAlign: "center", color: "#b7ad93" }}>You have no pending escrows</div>
        )}

        {active.map((e) => (
          <div key={e.id} style={{ ...box, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1 }}>
              Trade with <strong>{e.other}</strong>
              <div style={{ fontSize: 11, color: "#b7ad93" }}>
                {e.items.length} item{e.items.length === 1 ? "" : "s"} in the trade
                {e.myLocked ? " · you have accepted" : ""} · {timeLeft(e.expiresAt, now)} left
              </div>
            </span>
            <button className="button" style={small} onClick={() => setOpenId(e.id)}>
              Open
            </button>
            <button
              className="button secondary"
              style={{ ...small, opacity: busy ? 0.55 : 1 }}
              disabled={busy}
              onClick={() => act({ action: "cancel", id: e.id })}
            >
              Cancel
            </button>
          </div>
        ))}

        {waiting.map((e) => (
          <div key={e.id} style={{ ...box, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1 }}>
              Waiting for <strong>{e.other}</strong> to accept
              <div style={{ fontSize: 11, color: "#b7ad93" }}>{timeLeft(e.expiresAt, now)} left</div>
            </span>
            <button
              className="button secondary"
              style={{ ...small, opacity: busy ? 0.55 : 1 }}
              disabled={busy}
              onClick={() => act({ action: "cancel", id: e.id })}
            >
              Cancel
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

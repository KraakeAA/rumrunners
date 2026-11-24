"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

type Row = { id: string; at: string; who: string; player: boolean; amount: number; reference: string };
type History = {
  money: number;
  bank: number;
  interestPercent: number;
  nextInterestAt: string | null;
  nextInterest: number;
  feePercent: number;
  sent: Row[];
  received: Row[];
  totalSent: number;
  totalReceived: number;
};

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

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
const cell: CSSProperties = { border: "1px solid #6b5d3a", background: "#1f2a25", padding: "7px 9px", fontSize: 13 };
const field: CSSProperties = {
  height: 34,
  width: "100%",
  boxSizing: "border-box",
  padding: "0 8px",
  border: "1px solid #a08340",
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16
};

function left(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${m}m ${s}s`;
}

function when(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function BankSection({
  money,
  bank,
  onMoney,
  onBank
}: {
  money: number;
  bank: number;
  onMoney: (n: number) => void;
  onBank: (n: number) => void;
}) {
  const [hist, setHist] = useState<History | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [amountText, setAmountText] = useState("");
  const [to, setTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [reference, setReference] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const load = useCallback(async (all: boolean) => {
    try {
      const res = await fetch(`/api/bank/transfer${all ? "?all=1" : ""}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setHist(d);
        if (typeof d.bank === "number") onBank(d.bank);
      }
    } catch {
      // keep what we have
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load(showAll);
  }, [load, showAll]);

  async function deposit(action: "deposit" | "withdraw") {
    const amount = Number(amountText);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      setError("Enter a whole number amount.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/game/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, amount })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(d.error ?? "Bank transaction failed."));
      } else {
        onMoney(d.money);
        onBank(d.bank);
        load(showAll);
        setMessage(action === "deposit" ? `Deposited ${gbp(amount)}.` : `Withdrew ${gbp(amount)}.`);
      }
    } catch {
      setError("Unable to reach the bank.");
    }
    setBusy(false);
  }

  async function send() {
    const amount = Number(sendAmount);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/bank/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), amount, reference })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(d.error ?? "That could not be completed."));
      } else {
        onMoney(d.money);
        onBank(d.bank);
        setMessage(String(d.message ?? "Sent."));
        setTo("");
        setSendAmount("");
        setReference("");
        if (showAll) load(true);
        else setHist(d);
        load(showAll);
      }
    } catch {
      setError("Unable to reach the bank.");
    }
    setBusy(false);
  }

  const fee = hist?.feePercent ?? 10;
  const sendNum = Number(sendAmount);
  const receives = Number.isSafeInteger(sendNum) && sendNum > 0 ? sendNum - Math.floor((sendNum * fee) / 100) : 0;

  const list = (title: string, rows: Row[] | undefined, prefix: string, totalLabel: string, total: number) => (
    <div style={{ marginTop: 10 }}>
      <div style={bar}>
        {title}{" "}
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          style={{ background: "none", border: 0, color: "#f7efdb", textDecoration: "underline", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
        >
          ({showAll ? "Show 10" : "View all"})
        </button>
      </div>
      {!rows || rows.length === 0 ? (
        <div style={{ ...cell, borderTop: 0, color: "#c9bfa6" }}>Nothing yet.</div>
      ) : (
        rows.map((r) => (
          <div key={r.id} style={{ ...cell, borderTop: 0, background: "#26302b" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: "#b7ad93", fontSize: 12 }}>{when(r.at)}</span>
              <strong>{gbp(r.amount)}</strong>
            </div>
            <div style={{ overflowWrap: "anywhere" }}>
              {r.player ? `${prefix} ` : ""}
              <strong>{r.who}</strong>
              {r.reference ? <span style={{ color: "#b7ad93" }}> · {r.reference}</span> : null}
            </div>
          </div>
        ))
      )}
      <div style={{ ...cell, borderTop: 0, textAlign: "right" }}>
        <strong>{totalLabel}:</strong> {gbp(total)}
      </div>
    </div>
  );

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Local Bank</div>
      <div style={{ ...cell, borderTop: 0 }}>
        <div>Risk: <strong>Low</strong></div>
        <div>Daily Interest: <strong>{hist?.interestPercent ?? 3}%</strong></div>
        <div>Transfer Fee: <strong>{fee}%</strong></div>
        <div style={{ fontSize: 11, color: "#b7ad93", marginTop: 3 }}>
          Cash on the street can be taken. Money in the bank is safer.
        </div>
      </div>

      {error && <p className="notice" role="alert" style={{ color: "#f09a8c" }}>{error}</p>}
      {message && <p className="notice" style={{ color: "#9be39f" }}>{message}</p>}

      <div style={{ marginTop: 10 }}>
        <div style={bar}>Bank Account</div>
        <div style={{ display: "flex", ...cell, borderTop: 0, gap: 8, justifyContent: "space-around", textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "#b7ad93" }}>On hand</div>
            <strong style={{ fontSize: 14 }}>{gbp(money)}</strong>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#b7ad93" }}>In bank</div>
            <strong style={{ fontSize: 14 }}>{gbp(bank)}</strong>
          </div>
        </div>
        <div style={{ ...cell, borderTop: 0, fontSize: 12, textAlign: "center", color: "#c9bfa6" }}>
          {hist?.nextInterestAt
            ? `Next interest: ${gbp(hist.nextInterest)} in ${left(new Date(hist.nextInterestAt).getTime() - now)}. Any deposit, withdrawal or transfer restarts the 24 hours.`
            : "Put money in the bank and it earns 3% every 24 hours."}
        </div>
        <div style={{ ...cell, borderTop: 0, display: "grid", gap: 8 }}>
          <input
            style={field}
            aria-label="Amount"
            inputMode="numeric"
            placeholder="Amount (£)"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="button" style={{ flex: 1, opacity: busy ? 0.55 : 1 }} disabled={busy} onClick={() => deposit("deposit")}>
              Deposit
            </button>
            <button className="button secondary" style={{ flex: 1, opacity: busy ? 0.55 : 1 }} disabled={busy} onClick={() => deposit("withdraw")}>
              Withdraw
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={bar}>Transfer money</div>
        <div style={{ display: "grid", gridTemplateColumns: "38% 1fr" }}>
          <div style={{ ...cell, borderTop: 0, display: "flex", alignItems: "center" }}>Send to:</div>
          <div style={{ ...cell, borderTop: 0 }}>
            <input
              style={field}
              aria-label="Send to"
              autoCapitalize="none"
              autoCorrect="off"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div style={{ ...cell, borderTop: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Amount:</span>
            <span>£</span>
          </div>
          <div style={{ ...cell, borderTop: 0 }}>
            <input
              style={field}
              aria-label="Transfer amount"
              inputMode="numeric"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
          <div style={{ ...cell, borderTop: 0 }}>
            Reference: <em style={{ color: "#b7ad93" }}>(optional)</em>
          </div>
          <div style={{ ...cell, borderTop: 0 }}>
            <input
              style={field}
              aria-label="Reference"
              maxLength={60}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>
        <div style={{ ...cell, borderTop: 0, display: "grid", gap: 6, placeItems: "center" }}>
          {receives > 0 && (
            <span style={{ fontSize: 12, color: "#c9bfa6" }}>
              They will receive {gbp(receives)} after the {fee}% fee. Paid from your cash on hand.
            </span>
          )}
          <button
            type="button"
            className="button"
            style={{ padding: "6px 26px", opacity: busy || !to.trim() || !sendAmount ? 0.55 : 1 }}
            disabled={busy || !to.trim() || !sendAmount}
            onClick={send}
          >
            Send!
          </button>
        </div>
      </div>

      {list("Last 10 transfers", hist?.sent, "To", "Total sent", hist?.totalSent ?? 0)}
      {list("Last 10 received", hist?.received, "From", "Total received", hist?.totalReceived ?? 0)}
    </div>
  );
}

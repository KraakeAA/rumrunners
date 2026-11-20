"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Banner } from "@/components/GameImage";

type Bounty = {
  id: string;
  targetId: string;
  targetName: string;
  amount: number;
  paidBy: string;
  createdAt: string;
  reason: string;
};
type Data = {
  money: number;
  meId: string;
  minimum: number;
  reasonMax: number;
  bounties: Bounty[];
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
const cell: CSSProperties = {
  border: "1px solid #6b5d3a",
  background: "#2a332e",
  padding: "5px 8px",
  fontSize: 13,
  overflowWrap: "anywhere"
};
const head: CSSProperties = { ...cell, background: "#3a3a30", color: "#d4cab2" };
const input: CSSProperties = {
  height: 34,
  width: "100%",
  boxSizing: "border-box",
  padding: "0 8px",
  border: "1px solid #a08340",
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16
};

function when(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function HitlistSection({ onCash }: { onCash?: (money: number) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState("");
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/hitlist", { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(d.error ?? "The Hitlist could not be loaded."));
        return;
      }
      setData(d);
    } catch {
      setError("Unable to connect. Please try again.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(body: Record<string, unknown>, done?: () => void) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/hitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(d.error ?? "That could not be completed."));
      } else {
        setData(d);
        setMessage(String(d.message ?? ""));
        if (typeof d.money === "number") onCash?.(d.money);
        done?.();
      }
    } catch {
      setError("Unable to connect. Please try again.");
    }
    setBusy(false);
  }

  const picked = data?.bounties.find((b) => b.id === pick);
  const canBuyOff = Boolean(picked && data && picked.targetId === data.meId);
  const reasonMax = data?.reasonMax ?? 150;

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Hitlist</div>

      {error && <p className="notice" role="alert" style={{ color: "#f09a8c" }}>{error}</p>}
      {message && <p className="notice" style={{ color: "#9be39f" }}>{message}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "26% 1fr 1fr 44px" }}>
        <div style={{ ...head, gridRow: "1 / span 3" }}>Target</div>
        <div style={head}>Amount</div>
        <div style={head}>Paid by</div>
        <div style={{ ...head, gridRow: "1 / span 3" }} />
        <div style={{ ...head, gridColumn: "2 / span 2" }}>Date</div>
        <div style={{ ...head, gridColumn: "2 / span 2" }}>Reason</div>

        {!data ? (
          <div style={{ ...cell, gridColumn: "1 / -1", color: "#b7ad93" }}>Loading…</div>
        ) : data.bounties.length === 0 ? (
          <div style={{ ...cell, gridColumn: "1 / -1", color: "#c9bfa6" }}>Nobody has a price on their head.</div>
        ) : (
          data.bounties.map((b) => (
            <div key={b.id} style={{ display: "contents" }}>
              <div style={{ ...cell, gridRow: "span 3", background: "#454545" }}>{b.targetName}</div>
              <div style={{ ...cell, background: "#454545" }}>{gbp(b.amount)}</div>
              <div style={{ ...cell, background: "#454545" }}>{b.paidBy}</div>
              <div style={{ ...cell, gridRow: "span 3", background: "#454545", display: "grid", placeItems: "center", padding: 0 }}>
                <input
                  type="radio"
                  name="bounty"
                  aria-label={`Select the bounty on ${b.targetName}`}
                  checked={pick === b.id}
                  onChange={() => setPick(b.id)}
                  style={{ width: 22, height: 22 }}
                />
              </div>
              <div style={{ ...cell, gridColumn: "2 / span 2", background: "#454545" }}>{when(b.createdAt)}</div>
              <div style={{ ...cell, gridColumn: "2 / span 2", background: "#454545" }}>{b.reason || "No reason given."}</div>
            </div>
          ))
        )}

        <div style={{ ...cell, gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
          {picked && !canBuyOff && (
            <span style={{ fontSize: 11, color: "#b7ad93" }}>You can only buy off a bounty on your own head.</span>
          )}
          <button
            type="button"
            className="button"
            style={{ padding: "5px 18px", fontSize: 14, opacity: busy || !canBuyOff ? 0.55 : 1 }}
            disabled={busy || !canBuyOff}
            onClick={() => act({ action: "buyoff", id: pick }, () => setPick(""))}
          >
            Buy off{picked && canBuyOff ? ` (${gbp(picked.amount)})` : "!"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Banner slot="banners/hitlist" />
      </div>
      <div style={{ ...bar, marginTop: 0 }}>Add Target</div>
      <div style={{ ...cell, color: "#d4cab2", padding: "8px 10px" }}>
        <strong>Fees</strong>
        <div>Add target: 5% of amount{data ? ` (minimum bounty ${gbp(data.minimum)})` : ""}</div>
        <div style={{ fontSize: 11, color: "#b7ad93", marginTop: 3 }}>
          Whoever kills the target collects every bounty on him.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <div style={head}>Username:</div>
        <div style={head}>Amount:</div>
        <div style={cell}>
          <input
            style={input}
            aria-label="Target username"
            autoCapitalize="none"
            autoCorrect="off"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        <div style={{ ...cell, display: "flex", alignItems: "center", gap: 4 }}>
          £
          <input
            style={input}
            aria-label="Bounty amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </div>
        <div style={{ ...head, display: "flex", justifyContent: "space-between" }}>
          <span>Reason:</span>
          <span style={{ color: "#b7ad93" }}>({reasonMax - reason.length} chars left)</span>
        </div>
        <div style={{ ...head, background: "#3a3a30" }} />
        <div style={{ ...cell, gridColumn: "1 / -1" }}>
          <textarea
            aria-label="Reason"
            maxLength={reasonMax}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ ...input, height: 110, padding: 8, resize: "none" }}
          />
        </div>
        <div style={{ ...head, gridColumn: "1 / -1" }}>Anonymously:</div>
        <div style={{ ...cell, gridColumn: "1 / -1", display: "flex", justifyContent: "center", gap: 40 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="radio" name="anon" checked={anonymous} onChange={() => setAnonymous(true)} /> Yes
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="radio" name="anon" checked={!anonymous} onChange={() => setAnonymous(false)} /> No
          </label>
        </div>
        <div style={{ ...cell, gridColumn: "1 / -1", display: "grid", placeItems: "center" }}>
          <button
            type="button"
            className="button"
            style={{ padding: "6px 24px", fontSize: 15, opacity: busy || !target.trim() || !amount ? 0.55 : 1 }}
            disabled={busy || !target.trim() || !amount}
            onClick={() =>
              act({ action: "add", target: target.trim(), amount: Number(amount), reason, anonymous }, () => {
                setTarget("");
                setAmount("");
                setReason("");
              })
            }
          >
            Add target!
          </button>
        </div>
      </div>
    </div>
  );
}

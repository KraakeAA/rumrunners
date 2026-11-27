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
  padding: "3px 8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 13,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};
const box: CSSProperties = {
  background: "#1f2a25",
  border: "1px solid #6b5d3a",
  marginBottom: 6,
  color: "#f1e8d3",
  fontSize: 12
};
const input: CSSProperties = {
  height: 30,
  width: "100%",
  boxSizing: "border-box",
  padding: "0 8px",
  border: "1px solid #a08340",
  borderRadius: 0,
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16
};
const label: CSSProperties = { fontSize: 10, color: "#c9bfa6", marginBottom: 2, display: "block" };

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
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
    // Keep the list fresh, so a bounty that has just been paid out disappears by itself.
    const t = window.setInterval(() => {
      if (!document.hidden) load();
    }, 3_000);
    return () => window.clearInterval(t);
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
  const canBuyOff = Boolean(picked);
  const reasonMax = data?.reasonMax ?? 150;

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <Banner slot="banners/hitlist" />

      {error && <p className="notice" role="alert" style={{ color: "#f09a8c", margin: "0 0 6px" }}>{error}</p>}
      {message && <p className="notice" style={{ color: "#9be39f", margin: "0 0 6px" }}>{message}</p>}

      <div style={box}>
        <div style={bar}>Hitlist{data ? ` (${data.bounties.length})` : ""}</div>

        {!data ? (
          <div style={{ padding: 8, color: "#b7ad93" }}>Loading…</div>
        ) : data.bounties.length === 0 ? (
          <div style={{ padding: 8, color: "#c9bfa6" }}>Nobody has a price on their head.</div>
        ) : (
          data.bounties.map((b) => {
            const on = pick === b.id;
            return (
              <label
                key={b.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 8px",
                  borderBottom: "1px solid #3d4a40",
                  background: on ? "#26352d" : "transparent",
                  cursor: "pointer"
                }}
              >
                <input
                  type="radio"
                  name="bounty"
                  aria-label={`Select the bounty on ${b.targetName}`}
                  checked={on}
                  onChange={() => setPick(b.id)}
                  style={{ width: 16, height: 16, margin: 0, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <strong style={{ fontSize: 13, overflowWrap: "anywhere" }}>{b.targetName}</strong>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#e4c04d", flexShrink: 0 }}>{gbp(b.amount)}</span>
                  </div>
                  <div style={{ fontSize: 10, lineHeight: 1.3, color: "#a89f86", overflowWrap: "anywhere" }}>
                    by {b.paidBy} · {when(b.createdAt)}
                    {b.reason ? ` · ${b.reason}` : ""}
                  </div>
                </div>
              </label>
            );
          })
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 8,
            padding: "5px 8px",
            background: "#17201c"
          }}
        >
          <span style={{ fontSize: 10, color: "#b7ad93", flex: 1 }}>
            {picked ? `Pay to remove the bounty on ${picked.targetName}.` : "Pick a bounty to pay it off."}
          </span>
          <button
            type="button"
            className="button"
            style={{ padding: "4px 14px", fontSize: 12, opacity: busy || !canBuyOff ? 0.55 : 1 }}
            disabled={busy || !canBuyOff}
            onClick={() => act({ action: "buyoff", id: pick }, () => setPick(""))}
          >
            Buy off{picked && canBuyOff ? ` (${gbp(picked.amount)})` : ""}
          </button>
        </div>
      </div>

      <div style={box}>
        <div style={bar}>Add Target</div>
        <div style={{ padding: 8 }}>
          <div style={{ fontSize: 10, color: "#b7ad93", marginBottom: 6 }}>
            Fee 5% of the amount{data ? `, minimum bounty ${gbp(data.minimum)}` : ""}. Whoever kills the target collects
            every bounty on him.
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={label}>Username</span>
              <input
                style={input}
                aria-label="Target username"
                autoCapitalize="none"
                autoCorrect="off"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={label}>Amount (£)</span>
              <input
                style={input}
                aria-label="Bounty amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
          </div>

          <div style={{ marginTop: 6 }}>
            <span style={label}>
              Reason ({reasonMax - reason.length} left)
            </span>
            <textarea
              aria-label="Reason"
              maxLength={reasonMax}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ ...input, height: 54, padding: 6, resize: "none" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                style={{ width: 16, height: 16, margin: 0 }}
              />
              Anonymous
            </label>
            <button
              type="button"
              className="button"
              style={{ padding: "4px 16px", fontSize: 13, opacity: busy || !target.trim() || !amount ? 0.55 : 1 }}
              disabled={busy || !target.trim() || !amount}
              onClick={() =>
                act({ action: "add", target: target.trim(), amount: Number(amount), reason, anonymous }, () => {
                  setTarget("");
                  setAmount("");
                  setReason("");
                })
              }
            >
              Add target
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

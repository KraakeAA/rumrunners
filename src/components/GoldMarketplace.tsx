"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

type Listing = {
  id: string;
  remaining: number;
  batchSize: number;
  batches: number;
  price: number;
  mine: boolean;
};

type Data = {
  gold: number;
  money: number;
  recentValue: number | null;
  feePercent: number;
  page: number;
  pages: number;
  listings: Listing[];
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
const box: CSSProperties = { border: "1px solid #6b5d3a", background: "#1f2a25", padding: "7px 9px", fontSize: 13 };
const mineBox: CSSProperties = { ...box, background: "#17201c", borderColor: "#4d4430" };
const input: CSSProperties = {
  height: 30,
  padding: "0 8px",
  border: "1px solid #a08340",
  borderRadius: 0,
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16,
  minWidth: 0,
  width: "100%"
};
const small: CSSProperties = { padding: "5px 12px", fontSize: 12, flexShrink: 0 };
const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;
const digits = (v: string) => v.replace(/\D/g, "");

export default function GoldMarketplace({
  onCash,
  onGold
}: {
  onCash: (money: number) => void;
  onGold: (gold: number) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [page, setPage] = useState(1);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState("");
  const [batch, setBatch] = useState("1");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [good, setGood] = useState(false);

  const load = useCallback(
    async (p: number) => {
      try {
        const r = await fetch(`/api/marketplace/gold?page=${p}`, { cache: "no-store" });
        if (!r.ok) return;
        const d: Data = await r.json();
        setData(d);
        setPage(d.page);
        onCash(d.money);
        onGold(d.gold);
      } catch {
        /* keep what is on screen */
      }
    },
    [onCash, onGold]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/marketplace/gold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const j = await r.json().catch(() => ({}));
      setGood(r.ok);
      setMessage(r.ok ? String(j.message ?? "Done.") : String(j.error ?? "That did not work."));
      if (r.ok) {
        if (typeof j.money === "number") onCash(j.money);
        if (typeof j.gold === "number") onGold(j.gold);
        if (payload.action === "list") {
          setAmount("");
          setBatch("1");
          setPrice("");
        }
      }
      await load(page);
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
        <div style={bar}>Gold Marketplace</div>
        <p className="flavour">Loading…</p>
      </div>
    );
  }

  const nAmount = Number(amount) || 0;
  const nPrice = Number(price) || 0;
  const gross = nAmount * nPrice;
  const net = gross - Math.floor((gross * data.feePercent) / 100);

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Gold Marketplace</div>

      <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
        <div style={{ ...box, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#d4cab2" }}>Your gold</span>
          <strong style={{ color: "#e4c04d" }}>{data.gold.toLocaleString("en-GB")}</strong>
        </div>
        <div style={{ ...box, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#d4cab2" }}>Recent value</span>
          <strong>{data.recentValue ? `${gbp(data.recentValue)} per gold` : "No sales yet"}</strong>
        </div>

        {message && (
          <p className="notice" style={{ margin: "2px 0", color: good ? "#7fe08f" : "#f09a8c" }}>
            {message}
          </p>
        )}

        {data.listings.length === 0 && (
          <div style={{ ...box, textAlign: "center", color: "#b7ad93" }}>No gold is for sale right now.</div>
        )}

        {data.listings.map((l) => {
          const together = l.batchSize === l.remaining;
          const q = Number(qty[l.id]) || 0;
          return (
            <div key={l.id} style={l.mine ? mineBox : box}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 13, color: "#f7efdb" }}>
                    <strong style={{ fontSize: 15 }}>{l.remaining.toLocaleString("en-GB")}</strong> gold coins
                  </div>
                  <div style={{ fontSize: 11, color: "#b7ad93" }}>
                    {l.batchSize === 1
                      ? "Sold individually"
                      : together
                        ? "Sold all together"
                        : `Batches of ${l.batchSize.toLocaleString("en-GB")} (${l.batches} available)`}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong>{gbp(l.price)}</strong> <span style={{ fontSize: 11, color: "#b7ad93" }}>each</span>
                  {l.batchSize > 1 && (
                    <div style={{ fontSize: 11, color: "#b7ad93" }}>{gbp(l.price * l.batchSize)} per batch</div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                {l.mine ? (
                  <>
                    <span style={{ flex: 1, fontSize: 11, color: "#b7ad93" }}>Your listing</span>
                    <button
                      className="button secondary"
                      style={{ ...small, opacity: busy ? 0.55 : 1 }}
                      disabled={busy}
                      onClick={() => act({ action: "remove", id: l.id })}
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    {!together && (
                      <input
                        aria-label={l.batchSize === 1 ? "Gold to buy" : "Batches to buy"}
                        inputMode="numeric"
                        placeholder={l.batchSize === 1 ? "Gold" : "Batches"}
                        value={qty[l.id] ?? ""}
                        onChange={(e) => setQty({ ...qty, [l.id]: digits(e.target.value) })}
                        style={{ ...input, width: 90 }}
                      />
                    )}
                    <span style={{ flex: 1, fontSize: 11, color: "#b7ad93" }}>
                      {!together && q > 0 ? `Cost ${gbp(q * l.batchSize * l.price)}` : ""}
                    </span>
                    <button
                      className="button"
                      style={{ ...small, opacity: busy ? 0.55 : 1 }}
                      disabled={busy}
                      onClick={() =>
                        act({ action: "buy", id: l.id, batches: together ? 1 : q || 1 })
                      }
                    >
                      {together ? `Buy all · ${gbp(l.price * l.remaining)}` : "Buy"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {data.pages > 1 && (
          <div style={{ ...box, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              className="button secondary"
              style={{ ...small, opacity: page <= 1 ? 0.45 : 1 }}
              disabled={page <= 1}
              onClick={() => load(page - 1)}
            >
              ‹ Previous
            </button>
            <span style={{ fontSize: 12 }}>
              Page {page} of {data.pages}
            </span>
            <button
              className="button secondary"
              style={{ ...small, opacity: page >= data.pages ? 0.45 : 1 }}
              disabled={page >= data.pages}
              onClick={() => load(page + 1)}
            >
              Next ›
            </button>
          </div>
        )}
        <p style={{ margin: 0, fontSize: 11, color: "#b7ad93", textAlign: "center" }}>
          Listings in a darker panel are your own. Cheapest first.
        </p>

        <div style={{ ...bar, marginTop: 6 }}>Create new listing</div>
        <div style={{ ...box, display: "grid", gap: 6 }}>
          <label style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 6 }}>
            Amount
            <input
              inputMode="numeric"
              placeholder="Gold to sell"
              value={amount}
              onChange={(e) => setAmount(digits(e.target.value))}
              style={input}
            />
          </label>
          <label style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 6 }}>
            Batch size
            <input
              inputMode="numeric"
              placeholder="1"
              value={batch}
              onChange={(e) => setBatch(digits(e.target.value))}
              style={input}
            />
          </label>
          <label style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 6 }}>
            Price each
            <input
              inputMode="numeric"
              placeholder="£ per gold coin"
              value={price}
              onChange={(e) => setPrice(digits(e.target.value))}
              style={input}
            />
          </label>
          <div style={{ fontSize: 11, color: "#b7ad93", lineHeight: 1.45 }}>
            Batch size 1 lets buyers take any amount. Set it equal to the amount to sell it all together.
            {gross > 0 && (
              <>
                {" "}
                If it all sells you receive <strong style={{ color: "#f7efdb" }}>{gbp(net)}</strong> after the{" "}
                {data.feePercent}% tax.
              </>
            )}
          </div>
          <button
            className="button"
            style={{ opacity: busy ? 0.55 : 1 }}
            disabled={busy}
            onClick={() =>
              act({ action: "list", amount: nAmount, batchSize: Number(batch) || 1, price: nPrice })
            }
          >
            List!
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: "#b7ad93", textAlign: "center", lineHeight: 1.45 }}>
          The gold leaves your account and is held on the Marketplace once listed. Press Remove to get
          the unsold gold back.
        </p>
      </div>
    </div>
  );
}

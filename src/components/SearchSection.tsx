"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { GameImage } from "@/components/GameImage";

type Detective = { key: string; name: string; note: string; price: number; minutes: number };
type Hunt = {
  id: string;
  targetName: string;
  tier: string;
  status: string;
  foundAt: string;
  foundCity: string | null;
  windowEndsAt: string | null;
  shots: number;
};
type Data = {
  money: number;
  city: string;
  firepower: number;
  shielded: boolean;
  shieldUntil: string | null;
  windowMinutes: number;
  detectives: Detective[];
  hunts: Hunt[];
};

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

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
const box: CSSProperties = { border: "1px solid #6b5d3a", background: "#1f2a25", padding: "7px 9px", fontSize: 13 };
const sectionHead: CSSProperties = {
  padding: "3px 8px",
  fontSize: 12,
  fontWeight: 600,
  color: "#d8cfb8",
  background: "#2a3630",
  borderTop: "1px solid #3d4a41",
  borderBottom: "1px solid #3d4a41"
};
const input: CSSProperties = {
  height: 32,
  width: "100%",
  boxSizing: "border-box",
  padding: "0 8px",
  border: "1px solid #a08340",
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16
};

function span(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const minutesText = (m: number) => (m >= 60 ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${m} minutes`);

export default function SearchSection({
  onCash
}: {
  onCash?: (money: number) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("");
  const [tier, setTier] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/whack", { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(d.error ?? "The detectives could not be reached."));
        return;
      }
      setData(d);
    } catch {
      setError("Unable to connect. Please try again.");
    }
  }, []);

  useEffect(() => {
    load();
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const poll = window.setInterval(load, 30000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [load]);

  async function act(body: Record<string, string>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/whack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(d.error ?? "That could not be completed."));
        load();
      } else {
        setData(d);
        setMessage(String(d.message ?? ""));
        if (typeof d.money === "number") onCash?.(d.money);
        if (body.action === "hire") setTarget("");
      }
    } catch {
      setError("Unable to connect. Please try again.");
    }
    setBusy(false);
  }

  const chosen = data?.detectives.find((d) => d.key === tier) ?? data?.detectives[0];

  function huntLine(h: Hunt) {
    if (h.status === "searching") return `Searching. Report in ${span(new Date(h.foundAt).getTime() - now)}.`;
    if (h.status === "found") {
      const left = h.windowEndsAt ? new Date(h.windowEndsAt).getTime() - now : 0;
      return left > 0 ? `Found in ${h.foundCity}. ${span(left)} left to take the shot.` : "The trail went cold.";
    }
    if (h.status === "done") return "Finished.";
    if (h.status === "lost") return "The trail was lost.";
    return "The trail went cold.";
  }

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Search</div>
      <div style={{ ...box, borderTop: 0, color: "#c9bfa6", fontSize: 12 }}>
        Hire a detective to find a man. When he reports, you will have {data ? minutesText(data.windowMinutes) : "a few hours"} to
        get to that city and take the shot from the Whack page.
      </div>

      {data && data.shielded && (
        <div style={{ ...box, borderTop: 0, display: "grid", gap: 2 }}>
          {data.shielded && data.shieldUntil && (
            <span style={{ color: "#8ec9e8" }}>
              New-player protection until {new Date(data.shieldUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.
              Hiring a detective ends it.
            </span>
          )}
        </div>
      )}

      {error && <p className="notice" role="alert" style={{ color: "#f09a8c" }}>{error}</p>}
      {message && <p className="notice" style={{ color: "#9be39f" }}>{message}</p>}

      <div style={{ marginTop: 8 }}>
        <div style={bar}>Private investigators</div>
        <div style={{ display: "flex", border: "1px solid #6b5d3a", borderTop: 0, background: "#1f2a25" }}>
          <div style={{ width: 118, flexShrink: 0, borderRight: "1px solid #3d4a41" }}>
            <GameImage slot="search/investigator" width={118} height="100%" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={sectionHead}>Search for:</div>
            <div style={{ padding: 6 }}>
              <input
                style={input}
                placeholder="Name of the man to find"
                aria-label="Target name"
                autoCapitalize="none"
                autoCorrect="off"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div style={sectionHead}>Hire:</div>
            <div style={{ padding: "4px 6px", display: "grid", gap: 4 }}>
              {(data?.detectives ?? []).map((d) => (
                <label
                  key={d.key}
                  style={{ display: "flex", alignItems: "flex-start", gap: 6, cursor: "pointer", fontSize: 13 }}
                >
                  <input
                    type="radio"
                    name="detective"
                    checked={chosen?.key === d.key}
                    onChange={() => setTier(d.key)}
                    style={{ marginTop: 3 }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: "#f7efdb" }}>{d.name}</span>{" "}
                    <span style={{ color: "#e4c04d" }}>{gbp(d.price)}</span>
                    <div style={{ fontSize: 11, color: "#b7ad93" }}>
                      {d.note} Reports in {minutesText(d.minutes)}.
                    </div>
                  </span>
                </label>
              ))}
            </div>
            <div style={sectionHead}>Information:</div>
            <div style={{ padding: "4px 8px", fontSize: 11, color: "#c9bfa6", lineHeight: 1.35 }}>
              Once your man is found you will have {data ? minutesText(data.windowMinutes) : "a few hours"} to
              reach his city and take the shot. Finer detectives report sooner.
            </div>
          </div>
        </div>
        <div
          style={{
            ...box,
            borderTop: "1px solid #3d4a41",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10
          }}
        >
          <span>
            Total cost: <strong style={{ color: "#e4c04d" }}>{chosen ? gbp(chosen.price) : "£0"}</strong>
          </span>
          <button
            type="button"
            className="button"
            style={{ padding: "5px 20px", fontSize: 13, opacity: busy || !target.trim() || !chosen ? 0.55 : 1 }}
            disabled={busy || !target.trim() || !chosen || (data && chosen ? data.money < chosen.price : true)}
            onClick={() => chosen && act({ action: "hire", tier: chosen.key, target: target.trim() })}
          >
            {data && chosen && data.money < chosen.price ? "Can't afford" : "Hire!"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={bar}>Current searches</div>
        {!data || data.hunts.length === 0 ? (
          <div style={{ ...box, borderTop: 0, color: "#c9bfa6" }}>You do not have any current searches.</div>
        ) : (
          data.hunts.map((h) => {
            const live = h.status === "found" && h.windowEndsAt && new Date(h.windowEndsAt).getTime() > now;
            return (
              <div key={h.id} style={{ ...box, borderTop: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{h.targetName}</strong>
                  <span style={{ fontSize: 11, color: "#b7ad93" }}>{h.tier}</span>
                </div>
                <div style={{ fontSize: 12, color: live ? "#e4c04d" : "#b7ad93" }}>{huntLine(h)}</div>
                {live && (
                  <div style={{ fontSize: 12, color: "#9be39f", marginTop: 3 }}>
                    Found. Go to Whack to take the shot.
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

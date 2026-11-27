"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

type Detective = { key: string; name: string; note: string; price: number; minMinutes: number; maxMinutes: number; windowMinutes: number };
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
type Statement = {
  id: string;
  victimName: string;
  city: string;
  createdAt: string;
  inEscrow: boolean;
  opened: boolean;
  killerName: string | null;
};
type Data = {
  money: number;
  city: string;
  firepower: number;
  shielded: boolean;
  shieldUntil: string | null;
  bullets: number;
  detectives: Detective[];
  hunts: Hunt[];
  statements: Statement[];
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
const box: CSSProperties = { border: "1px solid #6b5d3a", background: "#1f2a25", padding: "7px 9px", fontSize: 13 };
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

export default function WhackSection({
  onCash,
  isAdmin = false
}: {
  onCash?: (money: number) => void;
  isAdmin?: boolean;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [bulletInput, setBulletInput] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"targets" | "statements">("targets");

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

  async function act(body: Record<string, string | number>) {
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
      }
    } catch {
      setError("Unable to connect. Please try again.");
    }
    setBusy(false);
  }
  function huntLine(h: Hunt) {
    if (h.status === "searching") return `Searching. Report in ${span(new Date(h.foundAt).getTime() - now)}.`;
    if (h.status === "found") {
      const left = h.windowEndsAt ? new Date(h.windowEndsAt).getTime() - now : 0;
      return left > 0 ? `Found in ${h.foundCity}. ${span(left)} left to take the shot.` : "The trail went cold.";
    }
    if (h.status === "done") return "Finished.";
    if (h.status === "failed") return "You took your shot and missed.";
    if (h.status === "lost") return "The trail was lost.";
    return "The trail went cold.";
  }

  const targets = (data?.hunts ?? []).filter(
    (h) => isAdmin
      ? h.status === "found" || h.status === "searching"
      : h.status === "found" && h.windowEndsAt && new Date(h.windowEndsAt).getTime() > now
  );
    return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Whack</div>
      <div style={{ ...box, borderTop: 0, color: "#c9bfa6", fontSize: 12 }}>
        Once a detective has found your man, get to his city with a gun in your hand and take your one shot before the trail goes cold.
        You choose how many bullets to fire. If he survives, the detective is gone and you must hire again. Hire detectives on the Search page.
      </div>

      {data && (
        <div style={{ ...box, borderTop: 0, display: "grid", gap: 2 }}>
          <span>You are in <strong>{data.city}</strong>. Firepower <strong>{data.firepower}</strong>
            {data.firepower === 0 ? " (equip a gun in Character)" : ""}. Bullets <strong>{data.bullets.toLocaleString("en-GB")}</strong>.</span>
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

      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
        {(["targets", "statements"] as const).map((t) => {
          const on = tab === t;
          const unopened = (data?.statements ?? []).filter((x) => !x.opened).length;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "6px 4px",
                fontSize: 13,
                border: on ? "1px solid #f0dfa8" : "1px solid #6b5d3a",
                background: on ? "linear-gradient(180deg, #8a7038, #4d3d1c)" : "#1a221e",
                color: on ? "#f7efdb" : "#b7ad93",
                cursor: "pointer"
              }}
            >
              {t === "targets" ? "Targets" : `Witness statements${unopened > 0 ? ` (${unopened})` : ""}`}
            </button>
          );
        })}
      </div>

      {tab === "statements" && (
        <div style={{ marginTop: 6 }}>
          <div style={bar}>Witness statements</div>
          <div style={{ ...box, borderTop: 0, color: "#c9bfa6", fontSize: 12 }}>
            When someone is gunned down in front of you, you may be asked to give a statement. Open it to see who did it,
            or leave it closed. Opening can&apos;t be undone. A closed statement can be traded through Escrow and may be worth more.
          </div>
          {!data || data.statements.length === 0 ? (
            <div style={{ ...box, borderTop: 0, color: "#c9bfa6" }}>You have no witness statements.</div>
          ) : (
            data.statements.map((x) => (
              <div key={x.id} style={{ ...box, borderTop: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ overflowWrap: "anywhere" }}>{x.victimName}</strong>
                  <span style={{ fontSize: 11, color: x.opened ? "#9be39f" : "#e4c04d", flexShrink: 0 }}>
                    {x.opened ? "Opened" : "Closed"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#b7ad93" }}>
                  Gunned down in {x.city} ·{" "}
                  {new Date(x.createdAt).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
                {x.opened ? (
                  <div style={{ marginTop: 4, color: "#f7efdb", overflowWrap: "anywhere" }}>
                    You witnessed <strong style={{ color: "#e0584f" }}>{x.killerName}</strong> shoot {x.victimName} in {x.city}.
                  </div>
                ) : x.inEscrow ? (
                  <div style={{ marginTop: 4, fontSize: 12, color: "#b7ad93" }}>In an escrow trade.</div>
                ) : (
                  <button
                    type="button"
                    className="button"
                    style={{ marginTop: 6, padding: "5px 18px", fontSize: 13, opacity: busy ? 0.55 : 1 }}
                    disabled={busy}
                    onClick={() => act({ action: "openStatement", id: x.id })}
                  >
                    Open
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "targets" && (
      <div style={{ marginTop: 8 }}>
        <div style={bar}>Targets found</div>
        {!data || targets.length === 0 ? (
          <div style={{ ...box, borderTop: 0, color: "#c9bfa6" }}>
            No one has been found. Hire a detective on the Search page.
          </div>
        ) : (
          targets.map((h) => {
            const live = isAdmin || (h.status === "found" && h.windowEndsAt && new Date(h.windowEndsAt).getTime() > now);
            const here = isAdmin || data.city === h.foundCity;
            return (
              <div key={h.id} style={{ ...box, borderTop: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{h.targetName}</strong>
                  <span style={{ fontSize: 11, color: "#b7ad93" }}>{h.tier}</span>
                </div>
                <div style={{ fontSize: 12, color: live ? "#e4c04d" : "#b7ad93" }}>{huntLine(h)}</div>
                {live && !here && (
                  <div style={{ fontSize: 12, color: "#e08f7f", marginTop: 3 }}>
                    Take the railway to {h.foundCity} first.
                  </div>
                )}
                {live && here && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        style={{ ...input, width: 120 }}
                        inputMode="numeric"
                        placeholder="Bullets"
                        aria-label="Bullets to fire"
                        value={bulletInput[h.id] ?? ""}
                        onChange={(e) => setBulletInput({ ...bulletInput, [h.id]: e.target.value.replace(/\D/g, "") })}
                      />
                      <button
                        type="button"
                        className="button"
                        style={{ padding: "5px 18px", fontSize: 13, opacity: busy || !(Number(bulletInput[h.id]) > 0) ? 0.55 : 1 }}
                        disabled={busy || !(Number(bulletInput[h.id]) > 0)}
                        onClick={() => act({ action: "shoot", id: h.id, bullets: Number(bulletInput[h.id]) })}
                      >
                        Shoot
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: "#b7ad93", marginTop: 3 }}>
                      One shot only. The bullets are used up either way.
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      )}
    </div>
  );
}

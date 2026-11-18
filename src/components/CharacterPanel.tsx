"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

type SlotItem = { type: string; name: string; kind: string; value: number };
type Slot = { key: string; label: string; side: "left" | "right"; item: SlotItem | null };
type Kit = {
  type: string;
  slot: string;
  name: string;
  note: string;
  kind: string;
  value: number;
  detail: string | null;
  equipped: boolean;
};
type Data = {
  name: string;
  rank: string;
  health: number;
  money: number;
  gold: number;
  bullets: number;
  firepower: number;
  protection: number;
  slots: Slot[];
  kit: Kit[];
};

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

const bar: CSSProperties = {
  padding: "6px 8px",
  fontFamily: "Georgia, serif",
  fontSize: 15,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

const slotBox = (filled: boolean, picked: boolean): CSSProperties => ({
  width: "100%",
  minHeight: 58,
  boxSizing: "border-box",
  padding: 4,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  gap: 2,
  border: picked ? "2px solid #e4c04d" : "1px solid #6b5d3a",
  borderRadius: 3,
  background: filled ? "linear-gradient(180deg, #2f3a33, #1b231e)" : "#121815",
  color: filled ? "#f1e8d3" : "#6f6a58",
  fontSize: 10,
  lineHeight: 1.15,
  textTransform: filled ? "none" : "uppercase",
  letterSpacing: filled ? 0 : 0.5,
  cursor: "pointer",
  fontFamily: "inherit"
});

const smallBtn: CSSProperties = {
  padding: "6px 14px",
  border: "1px solid #a08340",
  borderRadius: 3,
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  color: "#f7efdb",
  fontFamily: "Georgia, serif",
  fontSize: 13,
  cursor: "pointer"
};


// A simple line-art figure that shows whatever is equipped.
function Figure({ worn }: { worn: Record<string, string | undefined> }) {
  const hat = worn.hat;
  const body = worn.body;
  const guard = worn.guard;
  const home = worn.home;
  const motor = worn.motor;
  const primary = worn.primary;
  const side = worn.sidearm;

  return (
    <svg viewBox="0 0 100 150" width="100%" style={{ maxHeight: 200 }} aria-hidden="true">
      {/* Behind the figure: the door and the car */}
      {home && (
        <g>
          <rect x="74" y="46" width="24" height="102" fill="#3a2f22" stroke="#6b5d3a" />
          <rect x="77" y="52" width="18" height="40" fill="#2a2118" stroke="#8a7a58" />
          <rect x="77" y="98" width="18" height="44" fill="#2a2118" stroke="#8a7a58" />
          <rect x="74" y="70" width="24" height="3" fill="#7d8a90" />
          <rect x="74" y="118" width="24" height="3" fill="#7d8a90" />
          <circle cx="79" cy="95" r="1.8" fill="#c9a74a" />
        </g>
      )}
      {motor && (
        <g>
          <path d="M2 140 L2 130 Q10 124 24 124 L40 116 L68 116 L82 126 L98 128 L98 140 Z" fill="#14181a" stroke="#55606a" />
          <path d="M42 119 L66 119 L76 126 L38 126 Z" fill="#26323a" />
          <circle cx="22" cy="141" r="6" fill="#0b0d0e" stroke="#55606a" />
          <circle cx="78" cy="141" r="6" fill="#0b0d0e" stroke="#55606a" />
        </g>
      )}

      {/* Legs and torso */}
      <rect x="30" y="112" width="16" height="32" fill="#1d2420" />
      <rect x="54" y="112" width="16" height="32" fill="#1d2420" />
      <path d="M26 56 Q50 44 74 56 L78 112 L22 112 Z" fill={body === "protection:plated_jacket" ? "#3a4248" : "#2c3630"} stroke="#55452e" />
      <path d="M44 48 L50 70 L56 48 Z" fill="#e8dfc8" />
      <rect x="47" y="52" width="6" height="20" fill="#7a2a22" />

      {/* Body armour */}
      {body === "protection:plated_jacket" && (
        <g fill="#7d8a90" stroke="#aab6bc" strokeWidth="0.6">
          <rect x="29" y="60" width="16" height="16" rx="1" />
          <rect x="55" y="60" width="16" height="16" rx="1" />
          <rect x="29" y="80" width="16" height="16" rx="1" />
          <rect x="55" y="80" width="16" height="16" rx="1" />
          <rect x="31" y="100" width="38" height="9" rx="1" />
        </g>
      )}
      {body === "protection:vest" && (
        <g>
          <path d="M30 58 L44 52 L44 108 L30 108 Z" fill="#4d4a3a" stroke="#8a7a58" />
          <path d="M70 58 L56 52 L56 108 L70 108 Z" fill="#4d4a3a" stroke="#8a7a58" />
          <rect x="30" y="76" width="40" height="3" fill="#8a7a58" />
          <rect x="30" y="92" width="40" height="3" fill="#8a7a58" />
        </g>
      )}

      {/* Head, hair and hat */}
      <circle cx="50" cy="34" r="11" fill="#c9b48a" />
      <path d="M39 31 Q50 18 61 31 Q50 25 39 31 Z" fill="#3a2f22" />
      {hat === "protection:steel_hat" && (
        <g>
          <ellipse cx="50" cy="26" rx="19" ry="4" fill="#59636a" stroke="#aab6bc" strokeWidth="0.6" />
          <path d="M36 26 Q36 8 50 8 Q64 8 64 26 Z" fill="#6c777e" stroke="#aab6bc" strokeWidth="0.6" />
          <rect x="36" y="21" width="28" height="3" fill="#1b1f21" />
        </g>
      )}

      {/* Guard: dog or hired heavy, on the left */}
      {guard === "protection:guard_dog" && (
        <g fill="#2b2118" stroke="#6b5d3a" strokeWidth="0.6">
          <ellipse cx="14" cy="128" rx="12" ry="6" />
          <circle cx="5" cy="121" r="5" />
          <path d="M2 116 L4 111 L7 116 Z" />
          <rect x="6" y="130" width="3" height="14" />
          <rect x="18" y="130" width="3" height="14" />
          <path d="M25 125 L32 118 L29 127 Z" />
        </g>
      )}
      {guard === "protection:bodyguard" && (
        <g fill="#1a1f1c" stroke="#55452e" strokeWidth="0.6">
          <circle cx="11" cy="64" r="7" fill="#b39d78" />
          <rect x="5" y="52" width="12" height="5" fill="#26302a" />
          <path d="M0 76 Q11 68 22 76 L22 112 L0 112 Z" fill="#2c3630" />
          <rect x="2" y="112" width="8" height="34" />
          <rect x="12" y="112" width="8" height="34" />
        </g>
      )}

      {/* Primary gun, held across the body */}
      {primary === "gun:greener" && (
        <g>
          <line x1="30" y1="100" x2="88" y2="74" stroke="#1b1f21" strokeWidth="3" />
          <line x1="30" y1="100" x2="50" y2="91" stroke="#7a5230" strokeWidth="5" />
        </g>
      )}
      {primary === "gun:lee_enfield" && (
        <g>
          <line x1="26" y1="102" x2="94" y2="70" stroke="#1b1f21" strokeWidth="2.4" />
          <line x1="26" y1="102" x2="58" y2="87" stroke="#7a5230" strokeWidth="5" />
          <rect x="52" y="86" width="9" height="5" fill="#1b1f21" transform="rotate(-25 56 88)" />
        </g>
      )}
      {primary === "gun:thompson" && (
        <g>
          <line x1="28" y1="100" x2="84" y2="76" stroke="#7a5230" strokeWidth="5" />
          <line x1="52" y1="90" x2="90" y2="74" stroke="#1b1f21" strokeWidth="4" />
          <rect x="56" y="92" width="11" height="11" rx="5" fill="#2a2d2e" stroke="#aab6bc" strokeWidth="0.6" />
          <rect x="70" y="82" width="4" height="9" fill="#7a5230" />
        </g>
      )}

      {/* Sidearm, in the right hand */}
      {side && <line x1="72" y1="60" x2="84" y2="88" stroke="#2c3630" strokeWidth="6" strokeLinecap="round" />}
      {side && <circle cx="85" cy="90" r="3.5" fill="#c9b48a" />}
      {(side === "gun:webley" || side === "gun:enfield") && (
        <g>
          <rect x="84" y="82" width={side === "gun:webley" ? 16 : 13} height="4" fill="#1b1f21" />
          <circle cx="86" cy="84" r="3.5" fill="#2a2d2e" stroke="#aab6bc" strokeWidth="0.6" />
          <rect x="82" y="86" width="4" height="9" fill="#5a3a22" />
        </g>
      )}
      {side === "gun:colt" && (
        <g>
          <rect x="83" y="81" width="15" height="5" fill="#1b1f21" />
          <rect x="82" y="86" width="5" height="10" fill="#222" />
        </g>
      )}
      {side === "gun:mauser" && (
        <g>
          <rect x="83" y="80" width="17" height="3.5" fill="#1b1f21" />
          <rect x="84" y="83" width="9" height="6" fill="#7a5230" />
          <rect x="82" y="88" width="4" height="8" fill="#222" />
        </g>
      )}
    </svg>
  );
}

export default function CharacterPanel({
  onClose,
  onStats
}: {
  onClose: () => void;
  onStats?: (s: { protection: number; firepower: number }) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/character", { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Your character could not be loaded.");
        return;
      }
      setData(d);
    } catch {
      setError("Your character could not be loaded.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: "equip" | "unequip", type: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, type })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "That could not be completed.");
      } else {
        setData(d);
        setMessage(d.message ?? "");
        onStats?.({ protection: d.protection, firepower: d.firepower });
        if (action === "unequip") setPicked("");
      }
    } catch {
      setError("That could not be completed.");
    }
    setBusy(false);
  }

  const kitItem = data?.kit.find((k) => k.type === picked) ?? null;
  const slotCol = (side: "left" | "right") =>
    (data?.slots ?? []).filter((s) => s.side === side);

  function tapSlot(s: Slot) {
    if (s.item) setPicked(s.item.type);
    else setPicked("");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Character"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "56px 8px 12px",
        overflowY: "auto"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 380,
          boxSizing: "border-box",
          border: "1px solid #6b5d3a",
          background: "#161d19",
          color: "#f1e8d3",
          fontSize: 13
        }}
      >
        <div style={bar}>
          <strong style={{ letterSpacing: 1 }}>CHARACTER</strong>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{ background: "none", border: 0, color: "#f7efdb", fontSize: 20, cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {!data && !error && <p style={{ padding: 12, margin: 0, color: "#b7ad93" }}>Loading…</p>}
        {error && (
          <p style={{ padding: "8px 10px", margin: 0, color: "#e08a7a" }} role="alert">
            {error}
          </p>
        )}

        {data && (
          <>
            {/* SLOTS AROUND THE FIGURE */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "76px 1fr 76px",
                gap: 6,
                padding: 8,
                alignItems: "start"
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                {slotCol("left").map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => tapSlot(s)}
                    style={slotBox(!!s.item, !!s.item && s.item.type === picked)}
                  >
                    {s.item ? (
                      <>
                        <strong style={{ fontSize: 10 }}>{s.item.name}</strong>
                        <span style={{ color: "#9be39f" }}>+{s.item.value}%</span>
                      </>
                    ) : (
                      s.label
                    )}
                  </button>
                ))}
              </div>

              <div style={{ textAlign: "center", minWidth: 0 }}>
                <div style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 14, overflowWrap: "anywhere" }}>
                  {data.name}
                </div>
                <Figure worn={Object.fromEntries(data.slots.map((sl) => [sl.key, sl.item?.type]))} />
                <div style={{ fontSize: 12, color: "#b7ad93" }}>{data.rank}</div>
                <div
                  aria-label={`Health ${data.health}%`}
                  style={{ margin: "4px auto 0", height: 10, width: "90%", background: "#2a1a17", border: "1px solid #55452e" }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.max(0, Math.min(100, data.health))}%`,
                      background: data.health > 50 ? "#4caf50" : data.health > 25 ? "#d9a441" : "#c0392b"
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: "#b7ad93" }}>{data.health}% health</div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {slotCol("right").map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => tapSlot(s)}
                    style={slotBox(!!s.item, !!s.item && s.item.type === picked)}
                  >
                    {s.item ? (
                      <>
                        <strong style={{ fontSize: 10 }}>{s.item.name}</strong>
                        <span style={{ color: "#e4c04d" }}>Attack {s.item.value}</span>
                      </>
                    ) : (
                      s.label
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* NUMBERS */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "4px 10px",
                padding: "6px 10px",
                borderTop: "1px solid #2a3a30",
                borderBottom: "1px solid #2a3a30",
                background: "#1f2a25"
              }}
            >
              <span>Cash <strong style={{ color: "#9be39f" }}>{gbp(data.money)}</strong></span>
              <span>Gold <strong style={{ color: "#e4c04d" }}>{data.gold.toLocaleString("en-GB")}</strong></span>
              <span>Bullets <strong>{data.bullets.toLocaleString("en-GB")}</strong></span>
              <span>Firepower <strong style={{ color: "#e4c04d" }}>{data.firepower}</strong></span>
              <span style={{ gridColumn: "1 / -1" }}>
                Protection <strong style={{ color: "#8ec9e8" }}>{data.protection}%</strong>
              </span>
            </div>

            {/* SELECTED ITEM */}
            <div style={{ padding: 8 }}>
              {kitItem ? (
                <div style={{ border: "1px solid #6b5d3a", background: "#1f2a25", padding: 8 }}>
                  <strong style={{ fontFamily: "Georgia, serif" }}>{kitItem.name}</strong>
                  {kitItem.detail && <span style={{ color: "#b7ad93" }}> · {kitItem.detail}</span>}
                  <p style={{ margin: "4px 0", color: "#b7ad93", fontSize: 12 }}>{kitItem.note}</p>
                  <p style={{ margin: "0 0 8px", fontSize: 12 }}>
                    {kitItem.kind === "gun" ? `Attack ${kitItem.value}` : `+${kitItem.value}% protection`}
                  </p>
                  {kitItem.equipped ? (
                    <button type="button" disabled={busy} onClick={() => act("unequip", kitItem.type)} style={smallBtn}>
                      Put away
                    </button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => act("equip", kitItem.type)} style={smallBtn}>
                      Equip
                    </button>
                  )}
                </div>
              ) : (
                <p style={{ margin: 0, textAlign: "center", color: "#6f6a58" }}>Select an item</p>
              )}
              {message && <p style={{ margin: "6px 0 0", color: "#9be39f", fontSize: 12 }}>{message}</p>}
            </div>

            {/* WHAT YOU OWN */}
            <div style={{ padding: "0 8px 10px" }}>
              <div style={{ ...bar, fontSize: 13 }}>
                <span>Your kit</span>
                <span style={{ fontSize: 11 }}>{data.kit.length}</span>
              </div>
              {data.kit.length === 0 ? (
                <p style={{ margin: "8px 0 0", color: "#b7ad93", fontSize: 12 }}>
                  Nothing yet. Buy guns and protection in the Store.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                  {data.kit.map((k) => (
                    <button
                      key={k.type}
                      type="button"
                      onClick={() => setPicked(k.type)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "7px 8px",
                        textAlign: "left",
                        border: picked === k.type ? "2px solid #e4c04d" : "1px solid #6b5d3a",
                        background: "#1f2a25",
                        color: "#f1e8d3",
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "inherit"
                      }}
                    >
                      <span>{k.name}</span>
                      <span style={{ color: k.equipped ? "#9be39f" : "#6f6a58", whiteSpace: "nowrap" }}>
                        {k.equipped ? "Equipped" : "Not worn"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

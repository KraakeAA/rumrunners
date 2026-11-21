"use client";

import { useCallback, useEffect, useState } from "react";
import ItemIcon from "@/components/ItemIcon";

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
  strength?: number;
  canWield?: boolean;
  equipped: boolean;
};
type Data = {
  name: string;
  rank: string;
  health: number;
  money: number;
  gold: number;
  bullets: number;
  strengthLevel: number;
  staminaLevel: number;
  agilityLevel: number;
  firepower: number;
  protection: number;
  slots: Slot[];
  kit: Kit[];
};

// The window shows three slots. Protection is one slot on screen, but the game still
// keeps hats, armour, guards, doors and cars separately, so they all still add up.
type Pick = "primary" | "sidearm" | "protection";
const PROTECTION_SLOTS = ["hat", "body", "guard", "home", "motor"];

const GOLD = "#C69A48";
const IVORY = "#E8DCC0";
const BURGUNDY = "#590D18";
const BLACK = "#100D0C";
const SERIF = "'Libre Baskerville', Georgia, 'Times New Roman', serif";

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

// ---- Character pictures ----------------------------------------------------------------
// public/images/characters/ (nested folders, or all the files loose in that folder).
const PRIMARY_ART: Record<string, { combo: string; solo: string }> = {
  "gun:greener": { combo: "shotgun", solo: "pump-shotgun" },
  "gun:lee_enfield": { combo: "lee-enfield", solo: "bolt-action-rifle" },
  "gun:thompson": { combo: "thompson-drum", solo: "thompson-smg" }
};
const SIDEARM_ART: Record<string, { combo: string; solo: string }> = {
  "gun:webley": { combo: "webley", solo: "webley-revolver" },
  "gun:enfield": { combo: "enfield", solo: "enfield-revolver" },
  "gun:colt": { combo: "colt", solo: "colt-m1911" },
  "gun:mauser": { combo: "mauser", solo: "mauser-c96" }
};

function artPaths(primary?: string, side?: string): string[] {
  const p = primary ? PRIMARY_ART[primary] : undefined;
  const s = side ? SIDEARM_ART[side] : undefined;
  let folder = "unarmed";
  let name = "character";
  if (p && s) {
    folder = "combinations";
    name = `${p.combo}__${s.combo}`;
  } else if (p) {
    folder = "primary";
    name = p.solo;
  } else if (s) {
    folder = "secondary";
    name = s.solo;
  }
  return [`/images/characters/${folder}/${name}.png`, `/images/characters/${name}.png`];
}

const FADE =
  "linear-gradient(to right, transparent 0%, #000 18%, #000 82%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 5%, #000 90%, transparent 100%)";

function CharacterArt({ primary, sidearm }: { primary?: string; sidearm?: string }) {
  const paths = artPaths(primary, sidearm);
  const key = paths[0];
  const [state, setState] = useState({ key, attempt: 0 });
  const attempt = state.key === key ? state.attempt : 0;

  if (attempt >= paths.length) {
    return <div className="cw-art cw-art-missing">Portrait not found</div>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="cw-art"
      src={paths[attempt]}
      alt=""
      onError={() => setState({ key, attempt: attempt + 1 })}
      style={{
        WebkitMaskImage: FADE,
        WebkitMaskComposite: "source-in",
        maskImage: FADE,
        maskComposite: "intersect"
      }}
    />
  );
}

// ---- Styling ---------------------------------------------------------------------------
const CSS = `
.cw-overlay {
  position: fixed; inset: 0; z-index: 1000; height: 100dvh;
  display: flex; justify-content: center; align-items: center;
  background: rgba(6, 2, 3, 0.78);
  padding: max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right))
           max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
  box-sizing: border-box;
}
.cw-modal {
  position: relative; width: 100%; max-width: 1040px; max-height: 100%;
  display: flex; flex-direction: column; box-sizing: border-box;
  color: ${IVORY}; font-family: ${SERIF};
  background: radial-gradient(ellipse at 50% 0%, #3a0a12 0%, ${BLACK} 62%);
  border: 2px solid ${GOLD}; border-radius: 10px;
  box-shadow: 0 0 0 1px #000, 0 0 0 4px ${BURGUNDY}, 0 0 0 5px rgba(198,154,72,0.55), 0 18px 50px rgba(0,0,0,0.8);
  overflow: hidden;
}
.cw-head {
  position: relative; flex: 0 0 auto; text-align: center;
  padding: 12px 52px 10px;
  background: linear-gradient(180deg, #6e1020, ${BURGUNDY} 55%, #3b0910);
  border-bottom: 2px solid ${GOLD};
}
.cw-title { margin: 0; font-size: 26px; letter-spacing: 6px; font-weight: 700; color: #f3dca0; text-shadow: 0 2px 4px #000; }
.cw-close {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  width: 44px; height: 44px; display: grid; place-items: center;
  background: transparent; border: 0; color: ${GOLD}; font-size: 30px; line-height: 1; cursor: pointer;
}
.cw-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
.cw-stage { display: grid; grid-template-columns: minmax(210px, 290px) minmax(0, 1fr) minmax(250px, 330px); gap: 16px; padding: 16px; align-items: start; }
.cw-slots { display: flex; flex-direction: column; gap: 12px; }
.cw-slot {
  width: 100%; min-height: 118px; box-sizing: border-box; padding: 8px 6px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center;
  background: linear-gradient(180deg, #6a1022, ${BURGUNDY} 60%, #3a0a12);
  border: 1px solid ${GOLD}; border-radius: 8px; color: ${IVORY}; font-family: inherit; cursor: pointer;
  box-shadow: inset 0 0 0 2px rgba(0,0,0,0.45), inset 0 0 0 3px rgba(198,154,72,0.35);
  -webkit-tap-highlight-color: rgba(198,154,72,0.25);
}
.cw-slot[aria-pressed="true"] { border-color: #f3dca0; box-shadow: inset 0 0 0 2px rgba(0,0,0,0.45), 0 0 0 2px #f3dca0, 0 0 14px rgba(243,220,160,0.5); }
.cw-slot-label { font-size: 13px; letter-spacing: 2px; font-weight: 700; color: #f3dca0; text-transform: uppercase; }
.cw-slot-item { font-size: 13px; font-style: italic; color: ${IVORY}; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cw-slot-sub { font-size: 12px; color: ${GOLD}; }
.cw-portrait { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.cw-name { font-size: 24px; font-weight: 700; color: #f3dca0; text-align: center; overflow-wrap: anywhere; text-shadow: 0 2px 4px #000; }
.cw-art { display: block; height: min(460px, 56dvh); width: auto; max-width: 100%; object-fit: contain; margin: 4px 0; }
.cw-art-missing { display: grid; place-items: center; width: 200px; color: ${GOLD}; font-size: 13px; }
.cw-rank {
  margin-top: 2px; padding: 6px 22px; font-size: 15px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
  color: #f3dca0; background: linear-gradient(180deg, #6a1022, ${BURGUNDY}); border: 1px solid ${GOLD};
  clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 10px 100%, 0 50%);
}
.cw-healthbar { position: relative; width: min(100%, 420px); height: 18px; margin-top: 10px; background: #0b0605; border: 1px solid ${GOLD}; border-radius: 9px; overflow: hidden; }
.cw-manage { background: rgba(16,13,12,0.78); border: 1px solid ${GOLD}; border-radius: 8px; overflow: hidden; min-height: 120px; }
.cw-panel-title {
  margin: 0; padding: 7px 10px; font-size: 14px; letter-spacing: 3px; text-transform: uppercase; text-align: center; font-weight: 700;
  color: #f3dca0; background: linear-gradient(180deg, #6a1022, ${BURGUNDY}); border-bottom: 1px solid ${GOLD};
}
.cw-hint { margin: 0; padding: 14px 12px; color: ${IVORY}; opacity: 0.8; font-size: 14px; text-align: center; line-height: 1.5; }
.cw-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-top: 1px solid rgba(198,154,72,0.3); }
.cw-row:first-of-type { border-top: 0; }
.cw-row-main { flex: 1 1 auto; min-width: 0; }
.cw-row-name { font-size: 14px; color: ${IVORY}; line-height: 1.25; }
.cw-row-stat { font-size: 12px; color: ${GOLD}; margin-top: 2px; }
.cw-btn {
  flex: 0 0 auto; min-width: 84px; min-height: 44px; padding: 6px 12px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 700; letter-spacing: 1px; color: #f3dca0;
  background: linear-gradient(180deg, #7d1627, ${BURGUNDY}); border: 1px solid ${GOLD}; border-radius: 6px;
  -webkit-tap-highlight-color: rgba(198,154,72,0.25);
}
.cw-btn[disabled] { opacity: 0.5; cursor: default; }
.cw-btn.cw-ghost { background: transparent; }
.cw-msg { margin: 0; padding: 8px 12px; font-size: 13px; text-align: center; }
.cw-bottom { display: grid; grid-template-columns: 1fr 1fr 1.15fr; gap: 12px; padding: 0 16px 16px; }
.cw-card { background: rgba(16,13,12,0.78); border: 1px solid ${GOLD}; border-radius: 8px; overflow: hidden; }
.cw-line { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 9px 12px; border-top: 1px solid rgba(198,154,72,0.3); font-size: 15px; }
.cw-line:first-of-type { border-top: 0; }
.cw-line span:first-child { color: ${GOLD}; }
.cw-combat { display: grid; grid-template-columns: 1fr 1fr; text-align: center; padding: 10px 6px 6px; }
.cw-big { font-size: 26px; font-weight: 700; line-height: 1.1; }
.cw-small { font-size: 13px; color: ${IVORY}; opacity: 0.9; }
.cw-bar { position: relative; height: 22px; margin: 6px 12px 10px; background: #0b0605; border: 1px solid ${GOLD}; border-radius: 11px; overflow: hidden; }
.cw-bar-fill { height: 100%; }
.cw-bar-text { position: absolute; inset: 0; display: grid; place-items: center; font-size: 12px; font-weight: 700; color: #fff; text-shadow: 0 1px 2px #000; }

@media (max-width: 760px) {
  .cw-title { font-size: 20px; letter-spacing: 4px; }
  .cw-head { padding: 10px 52px 8px; }
  .cw-stage { grid-template-columns: 1fr; gap: 10px; padding: 10px; }
  .cw-portrait { order: 1; }
  .cw-slots { order: 2; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .cw-manage { order: 3; }
  .cw-slot { min-height: 108px; padding: 6px 3px; }
  .cw-slot-label { font-size: 11px; letter-spacing: 1px; }
  .cw-slot-item { font-size: 12px; }
  .cw-art { height: min(340px, 40dvh); }
  .cw-name { font-size: 21px; }
  .cw-bottom { grid-template-columns: 1fr; padding: 0 10px 12px; gap: 10px; }
}
`;

const GLYPH: Record<Pick, string> = {
  primary: "M2 9h20v3.2H12.5l-1.2 6H7.8l1.1-6H2z",
  sidearm: "M3 7h14v4h-6l-1.2 7H6.3l1.2-7H3z",
  protection: "M12 2l9 3v7c0 5-4 8.5-9 10-5-1.5-9-5-9-10V5z"
};

function EmptyGlyph({ kind }: { kind: Pick }) {
  return (
    <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden="true" style={{ opacity: 0.4 }}>
      <path d={GLYPH[kind]} fill="none" stroke={GOLD} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

const SLOT_TITLE: Record<Pick, string> = {
  primary: "Primary Gun",
  sidearm: "Sidearm",
  protection: "Protection"
};

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
  const [picked, setPicked] = useState<Pick | null>(null);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      }
    } catch {
      setError("That could not be completed.");
    }
    setBusy(false);
  }

  const worn = (key: string) => data?.slots.find((s) => s.key === key)?.item ?? null;
  const primary = worn("primary");
  const sidearm = worn("sidearm");
  const protectionWorn = PROTECTION_SLOTS.map(worn)
    .filter((x): x is SlotItem => x !== null)
    .sort((a, b) => b.value - a.value);

  function slotView(kind: Pick) {
    if (kind === "primary" || kind === "sidearm") {
      const item = kind === "primary" ? primary : sidearm;
      return {
        type: item?.type ?? null,
        name: item?.name ?? "None",
        sub: item ? `Attack ${item.value}` : ""
      };
    }
    const top = protectionWorn[0];
    return {
      type: top?.type ?? null,
      name: top?.name ?? "None",
      sub: top
        ? protectionWorn.length > 1
          ? `+${protectionWorn.length - 1} more · ${data?.protection ?? 0}%`
          : `+${top.value}%`
        : ""
    };
  }

  function listFor(kind: Pick): Kit[] {
    const all = data?.kit ?? [];
    const list = kind === "protection" ? all.filter((k) => k.kind === "protection") : all.filter((k) => k.slot === kind);
    return [...list].sort((a, b) => b.value - a.value);
  }

  const health = data ? Math.max(0, Math.min(100, data.health)) : 0;
  const prot = data ? Math.max(0, Math.min(100, data.protection)) : 0;
  const healthColour =
    health > 50 ? "linear-gradient(180deg, #6fd34a, #2f8a22)" : health > 25 ? "linear-gradient(180deg, #e0b24a, #8a6416)" : "linear-gradient(180deg, #d64a3a, #7a1c12)";

  const slotButton = (kind: Pick) => {
    const v = slotView(kind);
    return (
      <button
        key={kind}
        type="button"
        className="cw-slot"
        aria-pressed={picked === kind}
        aria-label={`${SLOT_TITLE[kind]}: ${v.name}. Tap to manage.`}
        onClick={() => {
          setPicked(picked === kind ? null : kind);
          setMessage("");
          setError("");
        }}
      >
        {v.type ? <ItemIcon typeKey={v.type} size={52} fallback={<EmptyGlyph kind={kind} />} /> : <EmptyGlyph kind={kind} />}
        <span className="cw-slot-label">{SLOT_TITLE[kind]}</span>
        <span className="cw-slot-item">{v.name}</span>
        {v.sub && <span className="cw-slot-sub">{v.sub}</span>}
      </button>
    );
  };

  return (
    <div className="cw-overlay" role="dialog" aria-modal="true" aria-label="Character" onClick={onClose}>
      <style>{CSS}</style>
      <div className="cw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cw-head">
          <h2 className="cw-title">CHARACTER</h2>
          <button type="button" className="cw-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="cw-scroll">
          {!data && !error && <p className="cw-hint">Loading…</p>}
          {error && !data && (
            <p className="cw-msg" role="alert" style={{ color: "#ff9a8a" }}>
              {error}
            </p>
          )}

          {data && (
            <>
              <div className="cw-stage">
                <div className="cw-slots">
                  {slotButton("primary")}
                  {slotButton("sidearm")}
                  {slotButton("protection")}
                </div>

                <div className="cw-portrait">
                  <div className="cw-name">{data.name}</div>
                  <CharacterArt primary={primary?.type} sidearm={sidearm?.type} />
                  <div className="cw-rank">Rank: {data.rank}</div>
                  <div className="cw-healthbar" aria-label={`Health ${health}%`}>
                    <div style={{ height: "100%", width: `${health}%`, background: healthColour }} />
                    <span className="cw-bar-text">{health}%</span>
                  </div>
                </div>

                <div className="cw-manage">
                  <h3 className="cw-panel-title">{picked ? SLOT_TITLE[picked] : "Equipment"}</h3>

                  {!picked && <p className="cw-hint">Tap Primary Gun, Sidearm or Protection to see what you own and equip it.</p>}

                  {picked && listFor(picked).length === 0 && (
                    <p className="cw-hint">
                      You don&apos;t own any {picked === "protection" ? "protection" : "guns of this kind"} yet. Buy some in the Store.
                    </p>
                  )}

                  {picked &&
                    listFor(picked).map((k) => {
                      const locked = !k.equipped && k.canWield === false;
                      return (
                        <div className="cw-row" key={k.type}>
                          <ItemIcon typeKey={k.type} size={46} />
                          <div className="cw-row-main">
                            <div className="cw-row-name">{k.name}</div>
                            <div className="cw-row-stat">
                              {k.kind === "gun" ? `Attack ${k.value}` : `+${k.value}% defence`}
                              {k.kind === "gun" && (k.strength ?? 0) > 0 ? ` · Needs Strength ${k.strength}` : ""}
                            </div>
                          </div>
                          {k.equipped ? (
                            <button type="button" className="cw-btn cw-ghost" disabled={busy} onClick={() => act("unequip", k.type)}>
                              Put away
                            </button>
                          ) : (
                            <button type="button" className="cw-btn" disabled={busy || locked} onClick={() => act("equip", k.type)}>
                              {locked ? "Locked" : "Equip"}
                            </button>
                          )}
                        </div>
                      );
                    })}

                  {message && (
                    <p className="cw-msg" style={{ color: "#9be39f" }}>
                      {message}
                    </p>
                  )}
                  {error && (
                    <p className="cw-msg" role="alert" style={{ color: "#ff9a8a" }}>
                      {error}
                    </p>
                  )}
                </div>
              </div>

              <div className="cw-bottom">
                <div className="cw-card">
                  <h3 className="cw-panel-title">Wallet</h3>
                  <div className="cw-line">
                    <span>Cash</span>
                    <strong>{gbp(data.money)}</strong>
                  </div>
                  <div className="cw-line">
                    <span>Gold</span>
                    <strong>{data.gold.toLocaleString("en-GB")}</strong>
                  </div>
                  <div className="cw-line">
                    <span>Bullets</span>
                    <strong>{data.bullets.toLocaleString("en-GB")}</strong>
                  </div>
                </div>

                <div className="cw-card">
                  <h3 className="cw-panel-title">Attributes</h3>
                  <div className="cw-line">
                    <span>Strength</span>
                    <strong>{data.strengthLevel}</strong>
                  </div>
                  <div className="cw-line">
                    <span>Stamina</span>
                    <strong>{data.staminaLevel}</strong>
                  </div>
                  <div className="cw-line">
                    <span>Agility</span>
                    <strong>{data.agilityLevel}</strong>
                  </div>
                </div>

                <div className="cw-card">
                  <h3 className="cw-panel-title">Combat</h3>
                  <div className="cw-combat">
                    <div>
                      <div className="cw-big" style={{ color: "#f0c040" }}>
                        {data.firepower}
                      </div>
                      <div className="cw-small">Firepower</div>
                    </div>
                    <div>
                      <div className="cw-big" style={{ color: "#70c0f0" }}>
                        {data.protection}%
                      </div>
                      <div className="cw-small">Defence</div>
                    </div>
                  </div>
                  <div className="cw-bar" aria-label={`Health ${data.health} of 100`}>
                    <div className="cw-bar-fill" style={{ width: `${health}%`, background: "linear-gradient(180deg, #e04030, #801810)" }} />
                    <span className="cw-bar-text">{data.health} / 100</span>
                  </div>
                  <div className="cw-bar" aria-label={`Protection ${data.protection} of 100`}>
                    <div className="cw-bar-fill" style={{ width: `${prot}%`, background: "linear-gradient(180deg, #4c8ac0, #234a70)" }} />
                    <span className="cw-bar-text">{data.protection} / 100</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

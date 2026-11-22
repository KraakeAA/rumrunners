"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Car = { id: string; name: string; plate: string; city: string; held: boolean };
type Prop = { id: string; city: string; game?: string };
type Target = {
  username: string;
  email: string;
  isAdmin: boolean;
  staffRole: string;
  banned: boolean;
  banReason: string;
  rank: string;
  rankLevel: number;
  money: number;
  bank: number;
  gold: number;
  bullets: number;
  health: number;
  jailed: boolean;
  city: string;
  crew: string;
  cars: Car[];
  casinos: Prop[];
  factories: Prop[];
};
type Lists = {
  cars: { key: string; name: string }[];
  cities: string[];
  casinos: { id: string; label: string; owner: string }[];
  factories: { id: string; label: string; owner: string }[];
};

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
const box: CSSProperties = {
  border: "1px solid #6b5d3a",
  borderTop: 0,
  background: "#1f2a25",
  padding: "8px 10px",
  fontSize: 13,
  lineHeight: 1.4,
  display: "grid",
  gap: 6
};
const field: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "6px 8px",
  border: "1px solid #a08340",
  borderRadius: 0,
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16,
  fontFamily: "inherit"
};
const sub: CSSProperties = { fontSize: 11, color: "#b7ad93" };
const btn: CSSProperties = { padding: "6px 12px", fontSize: 13 };

export default function AdminSection({ staff = 3 }: { staff?: number }) {
  const full = staff >= 3;
  const [lists, setLists] = useState<Lists | null>(null);
  const [query, setQuery] = useState("");
  const [t, setT] = useState<Target | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [reason, setReason] = useState("");
  const [field1, setField1] = useState("money");
  const [mode, setMode] = useState("add");
  const [amount, setAmount] = useState("");
  const [level, setLevel] = useState("");
  const [carKey, setCarKey] = useState("");
  const [carCity, setCarCity] = useState("London");
  const [propKey, setPropKey] = useState("");
  const [giveKey, setGiveKey] = useState("");
  const [giveAmount, setGiveAmount] = useState("");
  const [giveCity, setGiveCity] = useState("London");
  const [staffPick, setStaffPick] = useState("helper");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    fetch("/api/admin", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.cars) setLists(d);
        else setErr(d.error ?? "Admin tools could not be loaded.");
      })
      .catch(() => setErr("Admin tools could not be loaded."));
  }, []);

  async function find(name = query) {
    setErr("");
    setMsg("");
    try {
      const r = await fetch(`/api/admin?username=${encodeURIComponent(name.trim())}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setT(null);
        setErr(d.error ?? "Not found.");
        return;
      }
      setT(d.player);
    } catch {
      setErr("Not found.");
    }
  }

  async function act(body: Record<string, unknown>, after?: () => void) {
    if (!t) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: t.username, ...body })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "That could not be completed.");
      else {
        setMsg(d.message ?? "Done.");
        if (d.player) setT(d.player);
        after?.();
      }
    } catch {
      setErr("That could not be completed.");
    }
    setBusy(false);
  }

  const n = (v: number) => v.toLocaleString("en-GB");
  const propChoices = lists ? [...lists.casinos.map((c) => ({ ...c, kind: "casino" })), ...lists.factories.map((f) => ({ ...f, kind: "factory" }))] : [];

  const giveKind = giveKey.split(":")[0];
  const giveId = giveKey.slice(giveKey.indexOf(":") + 1);
  const giveReady =
    giveKey !== "" && (giveKind !== "stat" || (giveAmount !== "" && giveAmount !== "-" && Number(giveAmount) !== 0));

  function give() {
    if (giveKind === "stat") {
      act({ action: "adjust", field: giveId, mode: "add", amount: Number(giveAmount) }, () => setGiveAmount(""));
    } else if (giveKind === "car") {
      act({ action: "givecar", model: giveId, city: giveCity });
    } else if (giveKind === "casino" || giveKind === "factory") {
      act({ action: "giveproperty", kind: giveKind, propertyId: giveId });
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Admin</div>
      <div style={box}>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={query}
            placeholder="Player name"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && query.trim() && find()}
            style={{ ...field, flex: 1, minWidth: 0 }}
          />
          <button type="button" className="button" disabled={!query.trim()} onClick={() => find()} style={{ ...btn, flexShrink: 0 }}>
            Find
          </button>
        </div>
        {err && <div style={{ color: "#f09a8c" }}>{err}</div>}
        {msg && <div style={{ color: "#9be39f" }}>{msg}</div>}
      </div>

      {t && (
        <>
          <div style={{ ...bar, fontSize: 13, padding: "4px 8px", marginTop: 6 }}>
            {t.username}
            {t.isAdmin ? " (admin)" : t.staffRole === "MODERATOR" ? " (moderator)" : t.staffRole === "HELPER" ? " (helper)" : ""}
          </div>
          <div style={box}>
            <div>
              {t.rank} (level {t.rankLevel}) · {t.city} · health {t.health}%{t.jailed ? " · in jail" : ""}
              {t.crew ? ` · crew ${t.crew}` : ""}
            </div>
            <div style={sub}>{t.email}</div>
            <div>
              Cash £{n(t.money)} · Bank £{n(t.bank)} · Gold {n(t.gold)} · Bullets {n(t.bullets)}
            </div>
            {t.banned && <div style={{ color: "#f09a8c" }}>Banned{t.banReason ? `: ${t.banReason}` : ""}</div>}
          </div>

          <div style={{ ...bar, fontSize: 13, padding: "4px 8px", marginTop: 6 }}>Ban</div>
          <div style={box}>
            {t.banned ? (
              <button type="button" className="button" disabled={busy} onClick={() => act({ action: "unban" })} style={btn}>
                Unban {t.username}
              </button>
            ) : (
              <>
                <input value={reason} maxLength={200} placeholder="Reason (they will see it)" onChange={(e) => setReason(e.target.value)} style={field} />
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || t.isAdmin}
                  onClick={() => act({ action: "ban", reason }, () => setReason(""))}
                  style={btn}
                >
                  Ban {t.username}
                </button>
              </>
            )}
          </div>

          {full && (
            <>
          <div style={{ ...bar, fontSize: 13, padding: "4px 8px", marginTop: 6 }}>Staff role</div>
          <div style={box}>
            <div style={{ display: "flex", gap: 6 }}>
              <select value={staffPick} onChange={(e) => setStaffPick(e.target.value)} style={{ ...field, flex: 1, minWidth: 0 }}>
                <option value="none">Ordinary player</option>
                <option value="helper">Helper (answers tickets)</option>
                <option value="moderator">Moderator (tickets, bans, reports)</option>
                <option value="admin">Admin (everything)</option>
              </select>
              <button type="button" className="button" disabled={busy} onClick={() => act({ action: "setstaff", role: staffPick })} style={{ ...btn, flexShrink: 0 }}>
                Set
              </button>
            </div>
          </div>

          <div style={{ ...bar, fontSize: 13, padding: "4px 8px", marginTop: 6 }}>Give</div>
          <div style={box}>
            <select value={giveKey} onChange={(e) => setGiveKey(e.target.value)} style={field}>
              <option value="">Pick something to give…</option>
              <optgroup label="Money and supplies">
                <option value="stat:money">Cash</option>
                <option value="stat:bank">Bank</option>
                <option value="stat:gold">Gold</option>
                <option value="stat:bullets">Bullets</option>
              </optgroup>
              {lists && (
                <optgroup label="Cars">
                  {lists.cars.map((c) => (
                    <option key={c.key} value={`car:${c.key}`}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {lists && (
                <optgroup label="Casinos">
                  {lists.casinos
                    .filter((c) => !c.label.startsWith("War"))
                    .map((c) => (
                      <option key={c.id} value={`casino:${c.id}`}>
                        {c.label}
                        {c.owner ? ` (now ${c.owner})` : ""}
                      </option>
                    ))}
                </optgroup>
              )}
              {lists && (
                <optgroup label="Bullet factories">
                  {lists.factories.map((f) => (
                    <option key={f.id} value={`factory:${f.id}`}>
                      {f.label}
                      {f.owner ? ` (now ${f.owner})` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {giveKind === "stat" && (
              <input
                value={giveAmount}
                inputMode="numeric"
                placeholder="Amount"
                onChange={(e) => setGiveAmount(e.target.value.replace(/[^\d-]/g, ""))}
                style={field}
              />
            )}
            {giveKind === "car" && lists && (
              <select value={giveCity} onChange={(e) => setGiveCity(e.target.value)} style={field}>
                {lists.cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="button" disabled={busy || !giveReady} onClick={give} style={btn}>
              Give {t.username}
            </button>
          </div>

          <div style={{ ...bar, fontSize: 13, padding: "4px 8px", marginTop: 6 }}>Set or take away</div>
          <div style={box}>
            <div style={{ display: "flex", gap: 6 }}>
              <select value={field1} onChange={(e) => setField1(e.target.value)} style={{ ...field, flex: 1 }}>
                <option value="money">Cash</option>
                <option value="bank">Bank</option>
                <option value="gold">Gold</option>
                <option value="bullets">Bullets</option>
              </select>
              <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ ...field, flex: 1 }}>
                <option value="add">Add / take (use minus)</option>
                <option value="set">Set to</option>
              </select>
            </div>
            <input value={amount} placeholder="Amount" onChange={(e) => setAmount(e.target.value.replace(/[^\d-]/g, ""))} style={field} />
            <button
              type="button"
              className="button"
              disabled={busy || !amount || amount === "-"}
              onClick={() => act({ action: "adjust", field: field1, mode, amount: Number(amount) }, () => setAmount(""))}
              style={btn}
            >
              Apply
            </button>
          </div>

            </>
          )}

          <div style={{ ...bar, fontSize: 13, padding: "4px 8px", marginTop: 6 }}>Rank, health and jail</div>
          <div style={box}>
            {full && <div style={{ display: "flex", gap: 6 }}>
              <input value={level} placeholder="Rank level (1-100)" onChange={(e) => setLevel(e.target.value.replace(/\D/g, ""))} style={{ ...field, flex: 1, minWidth: 0 }} />
              <button type="button" className="button" disabled={busy || !level} onClick={() => act({ action: "setrank", level: Number(level) }, () => setLevel(""))} style={{ ...btn, flexShrink: 0 }}>
                Set rank
              </button>
            </div>}
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="button secondary" disabled={busy} onClick={() => act({ action: "revive" })} style={{ ...btn, flex: 1 }}>
                Revive / heal
              </button>
              <button type="button" className="button secondary" disabled={busy || !t.jailed} onClick={() => act({ action: "release" })} style={{ ...btn, flex: 1 }}>
                Release from jail
              </button>
            </div>
          </div>

          {full && (
            <>
          <div style={{ ...bar, fontSize: 13, padding: "4px 8px", marginTop: 6 }}>Cars</div>
          <div style={box}>
            {t.cars.length === 0 && <div style={sub}>No cars.</div>}
            {t.cars.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {c.name} <span style={sub}>[{c.plate}] · {c.city}{c.held ? " · held by escrow" : ""}</span>
                </div>
                <button type="button" className="button secondary" disabled={busy} onClick={() => act({ action: "removecar", carId: c.id })} style={{ padding: "4px 10px", fontSize: 11, flexShrink: 0 }}>
                  Take
                </button>
              </div>
            ))}
            {lists && (
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <select value={carKey} onChange={(e) => setCarKey(e.target.value)} style={{ ...field, flex: 2, minWidth: 0 }}>
                  <option value="">Give a car…</option>
                  {lists.cars.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select value={carCity} onChange={(e) => setCarCity(e.target.value)} style={{ ...field, flex: 1, minWidth: 0 }}>
                  {lists.cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button type="button" className="button" disabled={busy || !carKey} onClick={() => act({ action: "givecar", model: carKey, city: carCity }, () => setCarKey(""))} style={{ ...btn, flexShrink: 0 }}>
                  Give
                </button>
              </div>
            )}
          </div>

          <div style={{ ...bar, fontSize: 13, padding: "4px 8px", marginTop: 6 }}>Casinos and factories</div>
          <div style={box}>
            {t.casinos.length + t.factories.length === 0 && <div style={sub}>Owns none.</div>}
            {t.casinos.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  {c.game} in {c.city}
                </div>
                <button type="button" className="button secondary" disabled={busy} onClick={() => act({ action: "removeproperty", kind: "casino", propertyId: c.id })} style={{ padding: "4px 10px", fontSize: 11 }}>
                  Take
                </button>
              </div>
            ))}
            {t.factories.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>Bullet factory in {f.city}</div>
                <button type="button" className="button secondary" disabled={busy} onClick={() => act({ action: "removeproperty", kind: "factory", propertyId: f.id })} style={{ padding: "4px 10px", fontSize: 11 }}>
                  Take
                </button>
              </div>
            ))}
            {lists && (
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <select value={propKey} onChange={(e) => setPropKey(e.target.value)} style={{ ...field, flex: 1, minWidth: 0 }}>
                  <option value="">Give one…</option>
                  {propChoices.map((p) => (
                    <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>
                      {p.label}
                      {p.owner ? ` (now ${p.owner})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="button"
                  disabled={busy || !propKey}
                  onClick={() => {
                    const [kind, id] = propKey.split(":");
                    act({ action: "giveproperty", kind, propertyId: id }, () => setPropKey(""));
                  }}
                  style={{ ...btn, flexShrink: 0 }}
                >
                  Give
                </button>
              </div>
            )}
          </div>

            </>
          )}

          <div style={{ ...bar, fontSize: 13, padding: "4px 8px", marginTop: 6 }}>Send a letter</div>
          <div style={box}>
            <input value={subject} maxLength={100} placeholder="Subject" onChange={(e) => setSubject(e.target.value)} style={field} />
            <textarea value={text} rows={4} maxLength={5000} placeholder="Message" onChange={(e) => setText(e.target.value)} style={{ ...field, resize: "vertical" }} />
            <button
              type="button"
              className="button"
              disabled={busy || !subject.trim() || !text.trim()}
              onClick={() => act({ action: "letter", subject, text }, () => { setSubject(""); setText(""); })}
              style={btn}
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}

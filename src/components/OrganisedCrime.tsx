"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { OC_CHOICES, OC_ITEMS, type OcChoice } from "@/lib/oc";

type Slot = {
  role: string;
  roleName: string;
  state: "empty" | "invited" | "selecting" | "ready";
  username: string | null;
  percent: number | null;
  choice: OcChoice | null;
  choiceLabel: string | null;
  mine: boolean;
};

type Oc = {
  id: string;
  everyoneReady: boolean;
  sharesSet: boolean;
  city: string;
  leader: string;
  isLeader: boolean;
  leaderPercent: number;
  slots: Slot[];
};

type Invite = {
  ocId: string;
  leader: string;
  city: string;
  role: string;
  roleName: string;
  percent: number | null;
};

type Car = { id: string; name: string; plate: string; tier: number };

type Data = {
  me: { city: string; money: number; jailed: boolean };
  startCost: number;
  oc: Oc | null;
  invites: Invite[];
  cars: Car[];
};

const bar: CSSProperties = {
  padding: "3px 8px",
  fontFamily: "Georgia, serif",
  fontSize: 13,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};

const box: CSSProperties = {
  border: "1px solid #6b5d3a",
  background: "#1f2a25",
  padding: "6px 8px"
};

const input: CSSProperties = {
  height: 30,
  padding: "0 8px",
  border: "1px solid #a08340",
  borderRadius: 0,
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16,
  minWidth: 0
};

const small: CSSProperties = { padding: "5px 10px", fontSize: 12, flexShrink: 0 };

const pct = (n: number | null) => (n === null ? "Not set" : `${n}%`);

const stateLabel: Record<Slot["state"], string> = {
  empty: "Open",
  invited: "Invited",
  selecting: "Selecting items",
  ready: "Ready"
};

export default function OrganisedCrimeSection() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [good, setGood] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, string>>({});
  const [carId, setCarId] = useState("");
  const [confirmDisband, setConfirmDisband] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/game/oc", { cache: "no-store" });
      if (!r.ok) return;
      setData(await r.json());
    } catch {
      /* keep what is on screen */
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 10000);
    return () => window.clearInterval(t);
  }, [load]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/game/oc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const j = await r.json().catch(() => ({}));
      setGood(r.ok);
      setMessage(r.ok ? String(j.message ?? "Done.") : String(j.error ?? "That did not work."));
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
        <div style={bar}>Organised Crime</div>
        <p className="flavour">Loading…</p>
      </div>
    );
  }

  const { oc, invites, cars, me } = data;
  const mySlot = oc?.slots.find((s) => s.mine);

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Organised Crime{oc ? ` · ${oc.city}` : ""}</div>

      {message && (
        <p
          className="notice"
          style={{ margin: "6px 0", color: good ? "#7fe08f" : "#f09a8c" }}
        >
          {message}
        </p>
      )}

      {/* ---------- NOT IN A CREW ---------- */}
      {!oc && (
        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
          {invites.length > 0 && (
            <div style={box}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 14, marginBottom: 4 }}>
                Invitations
              </div>

              {invites.map((i) => {
                const here = me.city === i.city;

                return (
                  <div
                    key={i.ocId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 0",
                      borderTop: "1px solid #2f3b34"
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.35 }}>
                      <strong style={{ color: "#f7efdb" }}>{i.leader}</strong> · {i.city}
                      <br />
                      <span style={{ color: "#b7ad93" }}>
                        {i.roleName} · Share: {i.percent === null ? "Not currently set" : `${i.percent}%`}
                      </span>
                      {!here && (
                        <div style={{ color: "#e08f7f" }}>Be in {i.city} to accept.</div>
                      )}
                    </div>

                    <button
                      className="button"
                      style={{ ...small, opacity: !here || busy || me.jailed ? 0.55 : 1 }}
                      disabled={!here || busy || me.jailed}
                      onClick={() => act({ action: "accept", ocId: i.ocId })}
                    >
                      Accept
                    </button>
                    <button
                      className="button secondary"
                      style={small}
                      disabled={busy}
                      onClick={() => act({ action: "decline", ocId: i.ocId })}
                    >
                      Decline
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div style={box}>
            <p style={{ margin: "0 0 6px", fontSize: 12, color: "#d4cab2", lineHeight: 1.4 }}>
              A crew is four people: you as leader, a weapons expert, an explosive expert and a
              driver. It is tied to the city you start it in.
            </p>
            <button
              className="button"
              style={{ width: "100%", padding: "7px 0", fontSize: 13, opacity: busy || me.jailed ? 0.55 : 1 }}
              disabled={busy || me.jailed}
              onClick={() => act({ action: "start" })}
            >
              Start a crew in {me.city} · £{data.startCost.toLocaleString("en-GB")}
            </button>
          </div>
        </div>
      )}
            {/* ---------- IN A CREW ---------- */}
      {oc && (
        <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
          <div style={{ ...box, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>
              <strong style={{ color: "#f7efdb" }}>{oc.leader}</strong>{" "}
              <span style={{ color: "#b7ad93" }}>Leader</span>
            </span>
            <span style={{ color: "#e4c04d" }}>{oc.leaderPercent}%</span>
          </div>

          {oc.slots.map((s) => (
            <div key={s.role} style={box}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 14, color: "#f7efdb" }}>
                    {s.roleName}
                  </div>
                  <div style={{ fontSize: 11, color: "#b7ad93" }}>
                    {s.username ? `${s.username} · ` : ""}
                    {stateLabel[s.state]}
                    {s.state !== "empty" ? ` · Share ${pct(s.percent)}` : ""}
                  </div>
                  {s.choiceLabel && (
                    <div style={{ fontSize: 11, color: "#7fe08f" }}>{s.choiceLabel}</div>
                  )}
                </div>

                {oc.isLeader && s.state !== "empty" && (
                  <button
                    className="button secondary"
                    style={small}
                    disabled={busy}
                    onClick={() => act({ action: "kick", role: s.role })}
                  >
                    {s.state === "invited" ? "Withdraw" : "Kick"}
                  </button>
                )}
              </div>

              {oc.isLeader && s.state === "empty" && (
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input
                    aria-label={`Player to invite as ${s.roleName}`}
                    placeholder="Player name"
                    value={names[s.role] ?? ""}
                    onChange={(e) => setNames({ ...names, [s.role]: e.target.value })}
                    style={{ ...input, flex: 1 }}
                  />
                  <input
                    aria-label="Share percent"
                    placeholder="%"
                    inputMode="numeric"
                    value={shares[s.role] ?? ""}
                    onChange={(e) => setShares({ ...shares, [s.role]: e.target.value.replace(/\D/g, "") })}
                    style={{ ...input, width: 46, textAlign: "center", paddingLeft: 2, paddingRight: 2 }}
                  />
                  <button
                    className="button"
                    style={small}
                    disabled={busy}
                    onClick={async () => {
                      await act({
                        action: "invite",
                        role: s.role,
                        username: names[s.role] ?? "",
                        percent: shares[s.role] ?? ""
                      });
                      setNames((n) => ({ ...n, [s.role]: "" }));
                    }}
                  >
                    Invite
                  </button>
                </div>
              )}

              {oc.isLeader && s.state !== "empty" && (
                <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#b7ad93" }}>Share</span>
                  <input
                    aria-label={`Share for ${s.roleName}`}
                    placeholder={s.percent === null ? "%" : String(s.percent)}
                    inputMode="numeric"
                    value={shares[s.role] ?? ""}
                    onChange={(e) => setShares({ ...shares, [s.role]: e.target.value.replace(/\D/g, "") })}
                    style={{ ...input, width: 52, textAlign: "center", paddingLeft: 2, paddingRight: 2 }}
                  />
                  <button
                    className="button secondary"
                    style={small}
                    disabled={busy || (shares[s.role] ?? "") === ""}
                    onClick={async () => {
                      await act({ action: "percent", role: s.role, percent: shares[s.role] ?? "" });
                      setShares((n) => ({ ...n, [s.role]: "" }));
                    }}
                  >
                    Set
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* ---------- MY ITEMS ---------- */}
          {mySlot && (
            <div style={box}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 14, marginBottom: 6 }}>
                {mySlot.state === "ready" ? "Your choice" : "Select your items"}
              </div>

              {mySlot.role === "driver" ? (
                cars.length === 0 && mySlot.state !== "ready" ? (
                  <p style={{ margin: 0, fontSize: 12, color: "#e08f7f" }}>
                    You have no undamaged car free to use. Damaged cars can&apos;t be
                    driven on a job. Repair them on the Auto Theft page, or steal another.
                  </p>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <select
                      aria-label="Car"
                      value={carId}
                      onChange={(e) => setCarId(e.target.value)}
                      style={{ ...input, flex: 1 }}
                    >
                      <option value="">Choose a car…</option>
                      {cars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.plate ? ` (${c.plate})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      className="button"
                      style={{ ...small, opacity: !carId || busy ? 0.55 : 1 }}
                      disabled={!carId || busy}
                      onClick={() => act({ action: "choose", carId })}
                    >
                      Confirm
                    </button>
                  </div>
                )
              ) : (
                <div style={{ display: "grid", gap: 4 }}>
                  {OC_CHOICES.map((c) => {
                    const label = OC_ITEMS[mySlot.role as "weapons" | "explosives"][c];
                    const picked = mySlot.choice === c;

                    return (
                      <button
                        key={c}
                        className="button"
                        disabled={busy}
                        onClick={() => act({ action: "choose", choice: c })}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "7px 10px",
                          fontSize: 13,
                          textAlign: "left",
                          borderColor: picked ? "#7fe08f" : undefined
                        }}
                      >
                        <span>{label}</span>
                        <span style={{ color: picked ? "#7fe08f" : "#b7ad93", textTransform: "capitalize" }}>
                          {picked ? "Chosen" : c}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {oc.isLeader && (
            <div style={box}>
              <button
                className="button"
                style={{
                  width: "100%",
                  padding: "8px 0",
                  fontSize: 14,
                  opacity: busy || !oc.everyoneReady || !oc.sharesSet ? 0.55 : 1
                }}
                disabled={busy || !oc.everyoneReady || !oc.sharesSet}
                onClick={() => act({ action: "commit" })}
              >
                Commit OC
              </button>
              {(!oc.everyoneReady || !oc.sharesSet) && (
                <div style={{ marginTop: 4, fontSize: 11, color: "#b7ad93", textAlign: "center" }}>
                  {!oc.everyoneReady
                    ? "Everyone has to be ready before you can commit."
                    : "Set a share for every crew member first."}
                </div>
              )}
            </div>
          )}

          <div style={box}>
            {oc.isLeader ? (
              confirmDisband ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: "#f0c2b8", textAlign: "center", lineHeight: 1.4 }}>
                    Disband the crew? Everyone is sent home and the start fee is not refunded.
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="button"
                      style={{ ...small, flex: 1, padding: "8px 0", opacity: busy ? 0.55 : 1 }}
                      disabled={busy}
                      onClick={() => {
                        setConfirmDisband(false);
                        act({ action: "disband" });
                      }}
                    >
                      Yes, disband
                    </button>
                    <button
                      className="button secondary"
                      style={{ ...small, flex: 1, padding: "8px 0" }}
                      disabled={busy}
                      onClick={() => setConfirmDisband(false)}
                    >
                      Keep crew
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="button secondary"
                  style={{ width: "100%", padding: "8px 0", fontSize: 13 }}
                  disabled={busy}
                  onClick={() => setConfirmDisband(true)}
                >
                  Disband crew
                </button>
              )
            ) : (
              <button
                className="button secondary"
                style={{ width: "100%", padding: "8px 0", fontSize: 13 }}
                disabled={busy}
                onClick={() => act({ action: "leave" })}
              >
                Leave crew
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

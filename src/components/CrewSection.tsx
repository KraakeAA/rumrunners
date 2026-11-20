"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CREW_COLOURS, MAX_ANSWER_LENGTH, MAX_MOTTO_LENGTH, MAX_QUESTIONS, MAX_QUESTION_LENGTH } from "@/lib/crew";

type CrewRow = { id: string; name: string; color: string; members: number };
type Member = { username: string; rank: string; isLeader: boolean; donated: number };
type Application = { id: string; username: string; rank: string; answers: string[]; createdAt: string };
type Mine = {
  id: string;
  name: string;
  color: string;
  motto: string;
  questions: string[];
  bank: number;
  isLeader: boolean;
  leaderName: string;
  createdAt: string;
  members: Member[];
  applications: Application[];
};
type Data = {
  money: number;
  cost: number;
  maxCrews: number;
  maxMembers: number;
  crewCount: number;
  crews: CrewRow[];
  mine: Mine | null;
};
type ApplyInfo = {
  id: string;
  name: string;
  color: string;
  questions: string[];
  members: number;
  maxMembers: number;
  alreadyApplied: boolean;
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
const box: CSSProperties = {
  border: "1px solid #6b5d3a",
  borderTop: 0,
  background: "#1f2a25",
  padding: "8px 10px",
  fontSize: 13,
  lineHeight: 1.4
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

function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6, maxWidth: 320 }}>
      {CREW_COLOURS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Colour ${c}`}
          onClick={() => onPick(c)}
          style={{
            height: 28,
            padding: 0,
            background: c,
            border: value === c ? "2px solid #f7efdb" : "1px solid #3a3a34",
            boxShadow: value === c ? "0 0 0 1px #000" : "none",
            cursor: "pointer"
          }}
        />
      ))}
    </div>
  );
}

export default function CrewSection({ onCash }: { onCash: (money: number) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Not in a crew
  const [starting, setStarting] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(CREW_COLOURS[0]);
  const [pick, setPick] = useState("");
  const [applyInfo, setApplyInfo] = useState<ApplyInfo | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);

  // In a crew
  const [tab, setTab] = useState<"overview" | "bank" | "applications" | "settings">("overview");
  const [amount, setAmount] = useState("");
  const [motto, setMotto] = useState("");
  const [setColour, setSetColour] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [confirm, setConfirm] = useState("");

  const sync = useCallback(
    (d: Data) => {
      setData(d);
      onCash(d.money);
      if (d.mine) {
        setMotto(d.mine.motto);
        setSetColour(d.mine.color);
        setQuestions(d.mine.questions);
      }
    },
    [onCash]
  );

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/crew", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "Crews could not be loaded.");
        return;
      }
      sync(d);
    } catch {
      setError("Crews could not be loaded.");
    }
  }, [sync]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/crew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "That could not be completed.");
      } else {
        setMessage(d.message ?? "");
        sync(d);
        after?.();
      }
    } catch {
      setError("That could not be completed.");
    }
    setBusy(false);
  }

  async function openApplication() {
    if (!pick) return;
    setError("");
    setMessage("");
    try {
      const r = await fetch(`/api/crew?apply=${encodeURIComponent(pick)}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "That crew could not be loaded.");
        return;
      }
      setApplyInfo(d);
      setAnswers((d.questions as string[]).map(() => ""));
    } catch {
      setError("That crew could not be loaded.");
    }
  }

  if (!data) {
    return (
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
        <div style={bar}>Crew</div>
        {error ? (
          <p className="notice" style={{ color: "#f09a8c" }}>
            {error}
          </p>
        ) : (
          <p className="flavour">Loading…</p>
        )}
      </div>
    );
  }

  const notices = (
    <>
      {error && (
        <p className="notice" role="alert" style={{ color: "#f09a8c", margin: "6px 0 0" }}>
          {error}
        </p>
      )}
      {message && (
        <p className="notice" style={{ color: "#9be39f", margin: "6px 0 0" }}>
          {message}
        </p>
      )}
    </>
  );

  // ------------------------------------------------------------- not in a crew
  if (!data.mine) {
    const full = data.crewCount >= data.maxCrews;

    if (applyInfo) {
      return (
        <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
          <div style={{ ...bar, background: `linear-gradient(180deg, ${applyInfo.color}, #1a1a18)` }}>
            Apply to {applyInfo.name}
          </div>
          <div style={box}>
            {applyInfo.alreadyApplied ? (
              <p style={{ margin: 0 }}>You have already applied to this crew. The leader will get back to you by letter.</p>
            ) : applyInfo.members >= applyInfo.maxMembers ? (
              <p style={{ margin: 0 }}>This crew is full.</p>
            ) : applyInfo.questions.length === 0 ? (
              <p style={{ margin: 0 }}>This crew has no questions. Press Apply and the leader will see your name.</p>
            ) : (
              <p style={{ margin: 0 }}>Answer the leader&apos;s questions below.</p>
            )}

            {!applyInfo.alreadyApplied && applyInfo.members < applyInfo.maxMembers && (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {applyInfo.questions.map((q, i) => (
                  <label key={i} style={{ display: "grid", gap: 3 }}>
                    <strong style={{ fontSize: 13 }}>
                      {i + 1}. {q}
                    </strong>
                    <textarea
                      rows={2}
                      maxLength={MAX_ANSWER_LENGTH}
                      value={answers[i] ?? ""}
                      onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))}
                      style={{ ...field, resize: "vertical" }}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
          {notices}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="button secondary" onClick={() => setApplyInfo(null)} style={{ padding: "6px 14px", fontSize: 13 }}>
              Back
            </button>
            {!applyInfo.alreadyApplied && applyInfo.members < applyInfo.maxMembers && (
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() =>
                  act({ action: "apply", crewId: applyInfo.id, answers }, () => {
                    setApplyInfo(null);
                    setPick("");
                  })
                }
                style={{ padding: "6px 18px", fontSize: 13, opacity: busy ? 0.55 : 1 }}
              >
                Apply!
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
        <div style={bar}>Start Crew</div>
        <div style={box}>
          <p style={{ margin: "0 0 6px" }}>Become leader of a crew with up to {data.maxMembers} members.</p>
          <p style={{ margin: 0 }}>
            Only {data.maxCrews} crews can exist at once ({data.crewCount} so far). Starting one costs money, but no
            weekly payment is due.
          </p>
          <div style={{ textAlign: "center", margin: "10px 0 4px" }}>
            <div style={{ fontSize: 16 }}>{gbp(data.cost)}</div>
            <div style={sub}>Start cost</div>
          </div>

          {!starting ? (
            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                className="button"
                disabled={full}
                onClick={() => setStarting(true)}
                style={{ padding: "6px 22px", fontSize: 13, opacity: full ? 0.55 : 1 }}
              >
                {full ? "All crews taken" : "Continue >"}
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              <label style={{ display: "grid", gap: 3 }}>
                <strong>Name:</strong>
                <input
                  value={name}
                  maxLength={24}
                  placeholder="Name of crew"
                  onChange={(e) => setName(e.target.value)}
                  style={field}
                />
              </label>
              <div style={{ display: "grid", gap: 3 }}>
                <strong>Colour:</strong>
                <Swatches value={color} onPick={setColor} />
              </div>
              <div style={{ ...sub }}>
                Your colour is the banner shown on every member&apos;s profile.
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button type="button" className="button secondary" onClick={() => setStarting(false)} style={{ padding: "6px 14px", fontSize: 13 }}>
                  Cancel!
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busy || !name.trim()}
                  onClick={() => act({ action: "start", name, color })}
                  style={{ padding: "6px 18px", fontSize: 13, opacity: busy || !name.trim() ? 0.55 : 1 }}
                >
                  Start!
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ ...bar, marginTop: 8 }}>No Crew</div>
        <div style={box}>
          <p style={{ margin: "0 0 8px" }}>
            You are not part of any crew. Pick one below to apply. The crew&apos;s leader sets the questions.
          </p>
          {data.crews.length === 0 ? (
            <p style={{ ...sub, margin: 0 }}>There are no crews yet. Start the first one.</p>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ ...field, flex: 1, minWidth: 0 }}>
                <option value="">-- Select crew --</option>
                {data.crews.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.members}/{data.maxMembers})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="button"
                disabled={!pick}
                onClick={openApplication}
                style={{ padding: "7px 14px", fontSize: 13, flexShrink: 0, opacity: pick ? 1 : 0.55 }}
              >
                Apply
              </button>
            </div>
          )}
        </div>
        {notices}
      </div>
    );
  }

  // --------------------------------------------------------------- in a crew
  const crew = data.mine;
  const pending = crew.applications.length;
  const tabs: { key: typeof tab; label: string }[] = [
    { key: "overview", label: "Crew" },
    { key: "bank", label: "Bank" },
    ...(crew.isLeader
      ? [
          { key: "applications" as const, label: pending > 0 ? `Applications (${pending})` : "Applications" },
          { key: "settings" as const, label: "Settings" }
        ]
      : [])
  ];

  const tabBtn = (active: boolean): CSSProperties => ({
    flex: 1,
    padding: "6px 2px",
    fontSize: 12,
    border: "1px solid #6b5d3a",
    borderTop: 0,
    background: active ? "#4d3d1c" : "#17201c",
    color: active ? "#f7efdb" : "#b7ad93",
    cursor: "pointer",
    fontFamily: "inherit"
  });

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={{ ...bar, background: `linear-gradient(180deg, ${crew.color}, #1a1a18)` }}>{crew.name}</div>
      <div style={{ display: "flex" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setError("");
              setMessage("");
              setConfirm("");
            }}
            style={tabBtn(tab === t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {notices}

      {tab === "overview" && (
        <>
          <div style={{ ...box, marginTop: 6, borderTop: "1px solid #6b5d3a" }}>
            {crew.motto ? (
              <p style={{ margin: "0 0 6px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{crew.motto}</p>
            ) : (
              <p style={{ ...sub, margin: "0 0 6px" }}>No crew description yet.</p>
            )}
            <div style={sub}>
              Leader: <strong style={{ color: "#f1e8d3" }}>{crew.leaderName}</strong> · {crew.members.length}/
              {data.maxMembers} members · Founded{" "}
              {new Date(crew.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <div style={{ marginTop: 6 }}>
              <Link href={`/crew/${crew.id}`} style={{ color: "#e4c04d" }}>
                View the crew profile
              </Link>
            </div>
          </div>

          <div style={{ ...bar, fontSize: 13, padding: "4px 8px", marginTop: 6 }}>Members</div>
          {crew.members.map((m) => (
            <div
              key={m.username}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 8px",
                border: "1px solid #6b5d3a",
                borderTop: 0,
                background: "#17201c",
                fontSize: 13
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/profile/${encodeURIComponent(m.username)}`} style={{ color: "#f7efdb", textDecoration: "none", fontWeight: 600 }}>
                  {m.username}
                </Link>
                {m.isLeader && <span style={{ color: "#e4c04d", fontSize: 11 }}> · Leader</span>}
                <div style={sub}>
                  {m.rank} · gave {gbp(m.donated)}
                </div>
              </div>
              {crew.isLeader && !m.isLeader && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => (confirm === `kick:${m.username}` ? act({ action: "kick", username: m.username }, () => setConfirm("")) : setConfirm(`kick:${m.username}`))}
                  style={{ padding: "4px 10px", fontSize: 11, flexShrink: 0 }}
                >
                  {confirm === `kick:${m.username}` ? "Sure?" : "Remove"}
                </button>
              )}
            </div>
          ))}

          {!crew.isLeader && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => (confirm === "leave" ? act({ action: "leave" }, () => setConfirm("")) : setConfirm("leave"))}
                style={{ padding: "6px 18px", fontSize: 13 }}
              >
                {confirm === "leave" ? "Press again to leave" : "Leave crew"}
              </button>
            </div>
          )}
        </>
      )}

      {tab === "bank" && (
        <>
          <div style={{ ...box, marginTop: 6, borderTop: "1px solid #6b5d3a", textAlign: "center" }}>
            <div style={sub}>Crew bank</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "#f7efdb" }}>{gbp(crew.bank)}</div>
            <div style={sub}>You hold {gbp(data.money)} in cash.</div>
          </div>
          <div style={box}>
            <input
              inputMode="numeric"
              placeholder="Amount (£)"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              style={field}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button
                type="button"
                className="button"
                disabled={busy || !amount}
                onClick={() => act({ action: "donate", amount: Number(amount) }, () => setAmount(""))}
                style={{ flex: 1, padding: "7px 0", fontSize: 13, opacity: busy || !amount ? 0.55 : 1 }}
              >
                Donate
              </button>
              {crew.isLeader && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || !amount}
                  onClick={() => act({ action: "withdraw", amount: Number(amount) }, () => setAmount(""))}
                  style={{ flex: 1, padding: "7px 0", fontSize: 13, opacity: busy || !amount ? 0.55 : 1 }}
                >
                  Withdraw
                </button>
              )}
            </div>
            <p style={{ ...sub, margin: "6px 0 0" }}>
              Any member can put money in. Only the leader can take it out.
            </p>
          </div>
        </>
      )}

      {tab === "applications" && crew.isLeader && (
        <>
          {crew.applications.length === 0 ? (
            <div style={{ ...box, marginTop: 6, borderTop: "1px solid #6b5d3a", color: "#b7ad93" }}>
              No applications waiting.
            </div>
          ) : (
            crew.applications.map((a) => (
              <div key={a.id} style={{ ...box, marginTop: 6, borderTop: "1px solid #6b5d3a" }}>
                <div>
                  <Link href={`/profile/${encodeURIComponent(a.username)}`} style={{ color: "#f7efdb", fontWeight: 700 }}>
                    {a.username}
                  </Link>{" "}
                  <span style={sub}>{a.rank}</span>
                </div>
                {crew.questions.length === 0 ? (
                  <div style={{ ...sub, marginTop: 4 }}>No questions were set.</div>
                ) : (
                  crew.questions.map((q, i) => (
                    <div key={i} style={{ marginTop: 5 }}>
                      <div style={sub}>{q}</div>
                      <div style={{ overflowWrap: "anywhere" }}>{a.answers[i] || "—"}</div>
                    </div>
                  ))
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() => act({ action: "review", applicationId: a.id, accept: true })}
                    style={{ flex: 1, padding: "6px 0", fontSize: 13, opacity: busy ? 0.55 : 1 }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={() => act({ action: "review", applicationId: a.id, accept: false })}
                    style={{ flex: 1, padding: "6px 0", fontSize: 13, opacity: busy ? 0.55 : 1 }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {tab === "settings" && crew.isLeader && (
        <>
          <div style={{ ...box, marginTop: 6, borderTop: "1px solid #6b5d3a", display: "grid", gap: 8 }}>
            <label style={{ display: "grid", gap: 3 }}>
              <strong>Crew description</strong>
              <textarea
                rows={4}
                maxLength={MAX_MOTTO_LENGTH}
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                style={{ ...field, resize: "vertical" }}
              />
            </label>
            <div style={{ display: "grid", gap: 3 }}>
              <strong>Colour</strong>
              <Swatches value={setColour} onPick={setSetColour} />
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <strong>Application questions</strong>
              <div style={sub}>Up to {MAX_QUESTIONS}. Leave them all empty to take applicants without questions.</div>
              {Array.from({ length: MAX_QUESTIONS }, (_, i) => (
                <input
                  key={i}
                  value={questions[i] ?? ""}
                  maxLength={MAX_QUESTION_LENGTH}
                  placeholder={`Question ${i + 1}`}
                  onChange={(e) => {
                    const next = Array.from({ length: MAX_QUESTIONS }, (_, j) => questions[j] ?? "");
                    next[i] = e.target.value;
                    setQuestions(next);
                  }}
                  style={field}
                />
              ))}
            </div>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => act({ action: "edit", motto, color: setColour, questions })}
              style={{ padding: "7px 0", fontSize: 13, opacity: busy ? 0.55 : 1 }}
            >
              Save
            </button>
          </div>

          <div style={{ ...box, marginTop: 6, borderTop: "1px solid #6b5d3a", textAlign: "center" }}>
            <p style={{ ...sub, margin: "0 0 6px" }}>
              Disbanding ends the crew for everyone. What is left in the crew bank comes to you.
            </p>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => (confirm === "disband" ? act({ action: "disband" }, () => setConfirm("")) : setConfirm("disband"))}
              style={{ padding: "6px 18px", fontSize: 13 }}
            >
              {confirm === "disband" ? "Press again to disband" : "Disband crew"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import ForumBoard from "@/components/ForumBoard";
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

export default function CrewSection({
  onCash,
  isAdmin = false,
  playerId = ""
}: {
  onCash: (money: number) => void;
  isAdmin?: boolean;
  playerId?: string;
}) {
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
  const [tab, setTab] = useState<"overview" | "bank" | "forum" | "applications" | "settings">("overview");
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

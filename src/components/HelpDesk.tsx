"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

type Row = { id: string; category: string; subject: string; status: string; from: string; createdAt: string; updatedAt: string };
type Overview = { level: number; staffName: string; categories: { key: string; label: string }[]; mine: Row[]; queue: Row[] };
type Detail = Row & { mine: boolean; messages: { id: string; authorName: string; isStaff: boolean; body: string; createdAt: string }[] };

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
  lineHeight: 1.45
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

const STATUS: Record<string, string> = { open: "Waiting", answered: "Answered", closed: "Closed" };
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function HelpDesk() {
  const [data, setData] = useState<Overview | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [category, setCategory] = useState("");
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/tickets", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "The Help Desk could not be loaded.");
      else setData(d);
    } catch {
      setErr("The Help Desk could not be loaded.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function open(id: string) {
    setErr("");
    setMsg("");
    try {
      const r = await fetch(`/api/tickets?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "That ticket isn't there.");
      else {
        setDetail(d.ticket);
        setReply("");
      }
    } catch {
      setErr("That ticket isn't there.");
    }
  }

  async function post(payload: Record<string, unknown>, after?: (id: string) => void) {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "That could not be completed.");
      else {
        setMsg(d.message ?? "");
        after?.(d.id);
        load();
      }
    } catch {
      setErr("That could not be completed.");
    }
    setBusy(false);
  }

  const notices = (
    <>
      {err && <p className="notice" style={{ color: "#f09a8c", margin: "6px 0 0" }}>{err}</p>}
      {msg && <p className="notice" style={{ color: "#9be39f", margin: "6px 0 0" }}>{msg}</p>}
    </>
  );

  if (!data) {
    return (
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
        <div style={bar}>Help Desk</div>
        {err ? <p className="notice" style={{ color: "#f09a8c" }}>{err}</p> : <p className="flavour">Loading…</p>}
      </div>
    );
  }

  // ------------------------------------------------------------ one ticket
  if (detail) {
    const closed = detail.status === "closed";
    return (
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
        <div style={bar}>{detail.category}</div>
        <div style={box}>
          <div style={sub}>
            {detail.mine ? "Your ticket" : `From ${detail.from}`} · {STATUS[detail.status] ?? detail.status} · opened {when(detail.createdAt)}
          </div>
        </div>
        {detail.messages.map((m) => (
          <div key={m.id} style={{ ...box, background: m.isStaff ? "#26322c" : "#1f2a25" }}>
            <div style={{ ...sub, marginBottom: 3 }}>
              <strong style={{ color: m.isStaff ? "#9be39f" : "#f1e8d3" }}>{m.authorName}</strong>
              {m.isStaff ? " (staff)" : ""} · {when(m.createdAt)}
            </div>
            <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body}</div>
          </div>
        ))}
        {notices}
        {!closed && (
          <div style={{ ...box, borderTop: "1px solid #6b5d3a", marginTop: 6, display: "grid", gap: 6 }}>
            <textarea
              rows={4}
              maxLength={5000}
              value={reply}
              placeholder="Write a reply"
              onChange={(e) => setReply(e.target.value)}
              style={{ ...field, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="button"
                disabled={busy || reply.trim().length < 2}
                onClick={() => post({ action: "reply", id: detail.id, body: reply }, () => open(detail.id))}
                style={{ flex: 1, padding: "6px 0", fontSize: 13 }}
              >
                Reply
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => post({ action: "close", id: detail.id }, () => setDetail(null))}
                style={{ flex: 1, padding: "6px 0", fontSize: 13 }}
              >
                Close ticket
              </button>
            </div>
          </div>
        )}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setDetail(null);
              setMsg("");
              setErr("");
              load();
            }}
            style={{ padding: "6px 18px", fontSize: 13 }}
          >
            « Back
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------- overview
  const list = (rows: Row[], showFrom: boolean) =>
    rows.map((t) => (
      <button
        key={t.id}
        type="button"
        onClick={() => open(t.id)}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: "6px 10px",
          border: "1px solid #6b5d3a",
          borderTop: 0,
          background: "#17201c",
          color: "#f1e8d3",
          fontFamily: "inherit",
          fontSize: 13,
          cursor: "pointer"
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <strong style={{ flex: 1, minWidth: 0 }}>
            {t.category}
            {showFrom ? ` · ${t.from}` : ""}
          </strong>
          <span style={{ ...sub, flexShrink: 0, color: t.status === "answered" ? "#9be39f" : "#e4c04d" }}>
            {STATUS[t.status] ?? t.status}
          </span>
        </div>
        <div style={{ ...sub, overflowWrap: "anywhere" }}>{t.subject}</div>
        <div style={sub}>{when(t.updatedAt)}</div>
      </button>
    ));

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      {data.level >= 1 && (
        <>
          <div style={bar}>Tickets waiting ({data.queue.length})</div>
          {data.queue.length === 0 ? (
            <div style={{ ...box, color: "#b7ad93" }}>Nothing waiting. Well done.</div>
          ) : (
            list(data.queue, true)
          )}
          <div style={{ ...sub, padding: "3px 2px 8px" }}>You are signed in as {data.staffName}. You only see the categories your level covers.</div>
        </>
      )}

      <div style={bar}>Create a help ticket</div>
      <div style={{ ...box, display: "grid", gap: 6 }}>
        <label style={{ display: "grid", gap: 3 }}>
          <strong>Category:</strong>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={field}>
            <option value="">--- Choose category ---</option>
            {data.categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <textarea
          rows={5}
          maxLength={5000}
          value={text}
          placeholder="Describe what happened. Include names and amounts if they matter."
          onChange={(e) => setText(e.target.value)}
          style={{ ...field, resize: "vertical" }}
        />
        <button
          type="button"
          className="button"
          disabled={busy || !category || text.trim().length < 10}
          onClick={() => post({ action: "create", category, body: text }, () => { setText(""); setCategory(""); })}
          style={{ padding: "6px 0", fontSize: 13, opacity: busy || !category || text.trim().length < 10 ? 0.55 : 1 }}
        >
          Send ticket
        </button>
      </div>
      {notices}

      <div style={{ ...bar, marginTop: 8 }}>Your tickets</div>
      {data.mine.length === 0 ? (
        <div style={{ ...box, color: "#b7ad93" }}>You have not sent any tickets.</div>
      ) : (
        list(data.mine, false)
      )}
    </div>
  );
}

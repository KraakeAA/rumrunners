"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

type Mail = {
  id: string;
  from: string;
  subject: string;
  body: string;
  ocId: string | null;
  read: boolean;
  createdAt: string;
};

const BORDER = "#6b5d3a";

const tabBtn = (active: boolean): CSSProperties => ({
  flex: 1,
  padding: "3px 6px",
  fontSize: 12,
  border: `1px solid ${BORDER}`,
  background: active ? "#4d3d1c" : "#1f2a25",
  color: active ? "#f7efdb" : "#c9bfa6",
  cursor: "pointer",
  fontFamily: "inherit"
});

const small: CSSProperties = {
  padding: "2px 8px",
  fontSize: 11,
  border: `1px solid ${BORDER}`,
  background: "#1f2a25",
  color: "#e4dac3",
  cursor: "pointer",
  fontFamily: "inherit"
};

const linkBtn: CSSProperties = {
  background: "none",
  border: 0,
  padding: 0,
  color: "#d9c48f",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "inherit"
};

const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });

export default function MailboxSection({
  onOpenOc,
  onReply,
  onChanged,
  refreshKey = ""
}: {
  onOpenOc: () => void;
  onReply: (name: string) => void;
  onChanged?: () => void;
  refreshKey?: string;
}) {
  const [mail, setMail] = useState<Mail[] | null>(null);
  const [view, setView] = useState<"all" | "unread">("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/mail", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setMail(j.messages ?? []);
    } catch {
      /* keep what is on screen */
    }
  }, []);

  useEffect(() => {
    load();
    // refreshKey changes whenever a new letter arrives, so reload then.
  }, [load, refreshKey]);

  async function post(body: Record<string, unknown>) {
    await fetch("/api/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).catch(() => null);
    await load();
    onChanged?.();
  }

  const rows = useMemo(() => {
    const list = mail ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((m) => {
      if (view === "unread" && m.read) return false;
      if (!q) return true;
      return m.from.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q) || m.body.toLowerCase().includes(q);
    });
  }, [mail, view, search]);

  const unread = (mail ?? []).filter((m) => !m.read).length;

  function toggleBox(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function deleteSelected() {
    if (picked.length === 0) return;
    await post({ action: "deleteMany", ids: picked });
    setPicked([]);
  }

  async function deleteAll() {
    if (!window.confirm("Delete every message in your mailbox?")) return;
    await post({ action: "deleteAll" });
    setPicked([]);
  }

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={{ display: "flex", gap: 4 }}>
        <button type="button" style={tabBtn(view === "all")} onClick={() => setView("all")}>
          Mailbox
        </button>
        <button type="button" style={tabBtn(view === "unread")} onClick={() => setView("unread")}>
          Unread{unread > 0 ? ` (${unread})` : ""}
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 5, flexWrap: "wrap" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
          }}
          style={{ display: "flex", gap: 4, flex: 1, minWidth: 150 }}
        >
          <input
            aria-label="Search messages"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) setSearch("");
            }}
            placeholder="Find a conversation"
            style={{
              flex: 1,
              minWidth: 0,
              height: 24,
              padding: "0 6px",
              fontSize: 12,
              border: `1px solid ${BORDER}`,
              background: "#e8dcc0",
              color: "#100d0c"
            }}
          />
          <button type="submit" style={small}>
            Search
          </button>
        </form>
        <span style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 11, color: "#c9bfa6" }}>
          Delete:
          <button type="button" style={small} onClick={deleteAll} disabled={!mail || mail.length === 0}>
            All
          </button>
          <button type="button" style={{ ...small, opacity: picked.length ? 1 : 0.5 }} onClick={deleteSelected} disabled={picked.length === 0}>
            Selected
          </button>
        </span>
      </div>

      {mail === null ? (
        <p className="flavour">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="flavour" style={{ fontSize: 12 }}>
          {search ? "Nothing matches that search." : view === "unread" ? "No unread messages." : "Your mailbox is empty."}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
          {rows.map((m) => (
            <div
              key={m.id}
              onClick={() => {
                if (!m.read) post({ action: "read", id: m.id });
              }}
              style={{
                border: `1px solid ${m.read ? BORDER : "#c69a48"}`,
                background: m.read ? "#1a221e" : "#26322c"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 8,
                  padding: "2px 8px",
                  background: "linear-gradient(180deg, #3a3524, #2a2619)",
                  borderBottom: `1px solid ${BORDER}`
                }}
              >
                <span style={{ fontSize: 13, color: m.read ? "#d4cab2" : "#fff3cf", fontWeight: m.read ? 400 : 700, overflowWrap: "anywhere" }}>
                  {m.from}
                  {!m.read && <span style={{ marginLeft: 6, fontSize: 9, letterSpacing: 0.6, color: "#c69a48" }}>NEW</span>}
                </span>
                <span style={{ fontSize: 10, fontStyle: "italic", color: "#a89f86", flexShrink: 0 }}>{stamp(m.createdAt)}</span>
              </div>

              <p
                style={{
                  margin: 0,
                  padding: "6px 8px",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: m.read ? "#cfc6ad" : "#fbf4de"
                }}
              >
                {m.body}
              </p>

              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 8px",
                  borderTop: `1px solid ${BORDER}`,
                  background: "#171d1a",
                  flexWrap: "wrap"
                }}
              >
                <input
                  type="checkbox"
                  aria-label="Select message"
                  checked={picked.includes(m.id)}
                  onChange={() => toggleBox(m.id)}
                  style={{ width: 13, height: 13, margin: 0 }}
                />
                <button type="button" style={linkBtn} onClick={() => post({ action: "delete", id: m.id })}>
                  Delete
                </button>
                {m.from !== "The Underworld" && (
                  <>
                    <span style={{ color: "#6b5d3a" }}>·</span>
                    <button type="button" style={linkBtn} onClick={() => onReply(m.from)}>
                      Reply
                    </button>
                  </>
                )}
                {m.ocId && (
                  <>
                    <span style={{ color: "#6b5d3a" }}>·</span>
                    <button type="button" style={linkBtn} onClick={onOpenOc}>
                      Organised Crime
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { SYSTEM_SENDERS } from "@/lib/mailtext";

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
  fontSize: 12,
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

// In letters from the game itself, [[u:Name]] becomes a bold link to that player.
function renderText(text: string, system: boolean): ReactNode {
  if (!system) return text;
  const parts: ReactNode[] = [];
  const re = /\[\[u:([^\]]+)\]\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const name = match[1];
    parts.push(
      <Link
        key={`${match.index}-${name}`}
        href={`/profile/${encodeURIComponent(name)}`}
        style={{ fontWeight: 700, color: "#ffe08a", textDecoration: "underline", textDecorationColor: "#6b5d3a", textUnderlineOffset: 3 }}
      >
        {name}
      </Link>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function MailboxSection({
  onOpenOc,
  onReply,
  onChanged,
  refreshKey = ""
}: {
  onOpenOc: () => void;
  onReply: (name: string, quote?: { from: string; at: string; body: string }) => void;
  onChanged?: () => void;
  refreshKey?: string;
}) {
  const [mail, setMail] = useState<Mail[] | null>(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  // New letters are lit while you are in the mailbox. Opening the mailbox marks
  // them read, so once you leave they are no longer lit.
  const [fresh, setFresh] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/mail", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      const list: Mail[] = j.messages ?? [];
      setMail(list);
      const newIds = list.filter((m) => !m.read).map((m) => m.id);
      if (newIds.length > 0) {
        setFresh((cur) => Array.from(new Set([...cur, ...newIds])));
        fetch("/api/mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "readAll" })
        })
          .then(() => onChangedRef.current?.())
          .catch(() => null);
      }
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
      if (!q) return true;
      return m.from.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q) || m.body.toLowerCase().includes(q);
    });
  }, [mail, search]);

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
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 0, flexWrap: "wrap" }}>
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
          {search ? "Nothing matches that search." : "Your mailbox is empty."}
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8, marginTop: 8 }}>
          {rows.map((m) => {
            const lit = fresh.includes(m.id);
            const system = SYSTEM_SENDERS.includes(m.from);
            return (
              <div
                key={m.id}
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  border: `1px solid ${lit ? "#b0904a" : BORDER}`,
                  background: lit ? "#26322c" : "#1f2a25"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px",
                    background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
                    borderBottom: "1px solid #b0904a"
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      color: "#f7efdb",
                      fontWeight: 700,
                      textShadow: "0 1px 2px #000",
                      overflowWrap: "anywhere"
                    }}
                  >
                    {m.from}
                    {lit && <span style={{ marginLeft: 6, fontSize: 9, letterSpacing: 0.6, color: "#ffe08a" }}>NEW</span>}
                  </span>
                  <span style={{ fontSize: 10, fontStyle: "italic", color: "#efe3c3", flexShrink: 0 }}>{stamp(m.createdAt)}</span>
                </div>

                {system && (
                  <div style={{ padding: "7px 8px 0", fontSize: 13, fontWeight: 700, color: "#ffe08a", overflowWrap: "anywhere" }}>
                    {renderText(m.subject, true)}
                  </div>
                )}
                <p
                  style={{
                    margin: 0,
                    padding: system ? "4px 8px 8px" : "7px 8px",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    fontSize: 13,
                    lineHeight: 1.45,
                    color: lit ? "#fbf4de" : "#e0d7c0"
                  }}
                >
                  {renderText(m.body, system)}
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "4px 8px",
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
                    style={{ width: 14, height: 14, margin: 0, flexShrink: 0 }}
                  />
                  <button type="button" style={linkBtn} onClick={() => post({ action: "delete", id: m.id })}>
                    Delete
                  </button>
                  {!system && (
                    <>
                      <span style={{ color: BORDER }}>·</span>
                      <button
                        type="button"
                        style={linkBtn}
                        onClick={() => onReply(m.from, { from: m.from, at: stamp(m.createdAt), body: m.body })}
                      >
                        Reply
                      </button>
                    </>
                  )}
                  {m.ocId && (
                    <>
                      <span style={{ color: BORDER }}>·</span>
                      <button type="button" style={linkBtn} onClick={onOpenOc}>
                        Organised Crime
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

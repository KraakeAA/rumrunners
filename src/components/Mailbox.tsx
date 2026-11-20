"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

type Mail = {
  id: string;
  from: string;
  subject: string;
  body: string;
  ocId: string | null;
  read: boolean;
  createdAt: string;
};

const bar: CSSProperties = {
  padding: "6px 8px",
  fontFamily: "Georgia, serif",
  fontSize: 15,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};

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
  const [open, setOpen] = useState("");

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

  async function post(action: "read" | "delete", id: string) {
    await fetch("/api/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id })
    }).catch(() => null);
    await load();
    onChanged?.();
  }

  function toggle(m: Mail) {
    const next = open === m.id ? "" : m.id;
    setOpen(next);
    if (next && !m.read) post("read", m.id);
  }

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Mailbox</div>

      {mail === null ? (
        <p className="flavour">Loading…</p>
      ) : mail.length === 0 ? (
        <p className="flavour">No letters.</p>
      ) : (
        <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
          {mail.map((m) => (
            <div key={m.id} style={{ border: "1px solid #6b5d3a", background: "#1f2a25" }}>
              <button
                type="button"
                onClick={() => toggle(m)}
                style={{
                  display: "flex",
                  width: "100%",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "6px 8px",
                  border: 0,
                  background: "none",
                  color: m.read ? "#b7ad93" : "#f7efdb",
                  fontWeight: m.read ? 400 : 700,
                  fontSize: 13,
                  textAlign: "left",
                  cursor: "pointer"
                }}
              >
                <span>
                  {m.subject}
                  <span style={{ color: "#8a8470", fontWeight: 400 }}> · {m.from}</span>
                </span>
                <span style={{ color: "#8a8470", fontWeight: 400, fontSize: 11, flexShrink: 0 }}>
                  {new Date(m.createdAt).toLocaleDateString("en-GB", {
                    timeZone: "Europe/London",
                    day: "numeric",
                    month: "short"
                  })}
                </span>
              </button>

              {open === m.id && (
                <div style={{ padding: "4px 8px 8px", borderTop: "1px solid #2f3b34" }}>
                  <p
                    style={{
                      margin: "4px 0 8px",
                      whiteSpace: "pre-wrap",
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: "#e4dac3"
                    }}
                  >
                    {m.body}
                  </p>

                  <div style={{ display: "flex", gap: 6 }}>
                    {m.from !== "The Underworld" && (
                      <button
                        className="button"
                        style={{ padding: "5px 10px", fontSize: 12 }}
                        onClick={() => onReply(m.from)}
                      >
                        Reply
                      </button>
                    )}
                    {m.ocId && (
                      <button
                        className="button"
                        style={{ padding: "5px 10px", fontSize: 12 }}
                        onClick={onOpenOc}
                      >
                        Organised Crime
                      </button>
                    )}
                    <button
                      className="button secondary"
                      style={{ padding: "5px 10px", fontSize: 12 }}
                      onClick={() => post("delete", m.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, type CSSProperties } from "react";

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

const field: CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "6px 8px",
  border: "1px solid #a08340",
  borderRadius: 0,
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16
};

export default function SendLetterSection({ initialTo = "" }: { initialTo?: string }) {
  const [to, setTo] = useState(initialTo);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [good, setGood] = useState(false);

  async function send() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", to, body: text })
      });
      const j = await r.json().catch(() => ({}));
      setGood(r.ok);
      setMessage(r.ok ? String(j.message ?? "Sent.") : String(j.error ?? "That did not send."));
      if (r.ok) setText("");
    } catch {
      setGood(false);
      setMessage("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>Send Letter</div>

      <div style={{ border: "1px solid #6b5d3a", borderTop: 0, background: "#1f2a25", padding: 8, display: "grid", gap: 6 }}>
        <input
          aria-label="Player name"
          placeholder="Player name"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          style={{ ...field, height: 34 }}
        />
        <textarea
          aria-label="Message"
          placeholder="Write your message…"
          value={text}
          maxLength={2000}
          rows={7}
          onChange={(e) => setText(e.target.value)}
          style={{ ...field, resize: "vertical", fontFamily: "inherit" }}
        />
        <button
          className="button"
          style={{ padding: "7px 0", fontSize: 13, opacity: busy || !to.trim() || !text.trim() ? 0.55 : 1 }}
          disabled={busy || !to.trim() || !text.trim()}
          onClick={send}
        >
          Send
        </button>
      </div>

      {message && (
        <p className="notice" style={{ margin: "6px 0", color: good ? "#7fe08f" : "#f09a8c" }}>
          {message}
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Data = {
  username: string;
  profileQuote: string | null;
  profilePictureUrl: string | null;
  profileStatus: string | null;
  allowProfileImages: boolean;
  friendsOnlyImages: boolean;
  showOcStatus: boolean;
  showProfileViews: boolean;
  showOrganization: boolean;
};

const OPTIONS: { key: keyof Data; label: string }[] = [
  { key: "allowProfileImages", label: "See pictures in other players' profiles?" },
  { key: "friendsOnlyImages", label: "Only show images in messages from friends?" },
  { key: "showOcStatus", label: "Display OC status on profile?" },
  { key: "showProfileViews", label: "Display profile views on profile?" },
  { key: "showOrganization", label: "Display organisation on profile?" }
];

const bar: CSSProperties = {
  padding: "8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 17,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #5a4a33, #2d2418)",
  border: "1px solid #8a7a66"
};
const cell: CSSProperties = { background: "#3a3a3a", border: "1px solid #6f665a", padding: 8 };
const field: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 8,
  border: "1px solid #a08340",
  borderRadius: 6,
  background: "#fff",
  color: "#111",
  fontSize: 16
};
const blue: CSSProperties = {
  padding: "6px 16px",
  border: "1px solid #5aa9ff",
  borderRadius: 16,
  background: "#0a7aff",
  color: "#fff",
  fontSize: 16,
  cursor: "pointer"
};

const DURATIONS = [
  { label: "Until removed", minutes: 0 },
  { label: "1 hour", minutes: 60 },
  { label: "1 day", minutes: 1440 },
  { label: "1 week", minutes: 10080 }
];

export default function ProfileEditor() {
  const [d, setD] = useState<Data | null>(null);
  const [quote, setQuote] = useState("");
  const [pic, setPic] = useState("");
  const [status, setStatus] = useState("");
  const [mins, setMins] = useState(0);
  const [msg, setMsg] = useState("");
  const [good, setGood] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Data | null) => {
        if (!j) return;
        setD(j);
        setQuote(j.profileQuote ?? "");
        setPic(j.profilePictureUrl ?? "");
        setStatus(j.profileStatus ?? "");
      })
      .catch(() => {});
  }, []);

  async function save(payload: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const j = await r.json().catch(() => ({}));
      setGood(r.ok);
      setMsg(String(r.ok ? j.message ?? "Saved." : j.error ?? "That did not work."));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setGood(false);
      setMsg("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!d) {
    return (
      <main style={{ minHeight: "100vh", background: "#0b0f0d", color: "#f1e8d3", padding: 8 }}>
        Loading…
      </main>
    );
  }

  const flip = (key: keyof Data) => setD({ ...d, [key]: !d[key] } as Data);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0f0d",
        color: "#f1e8d3",
        padding: 8,
        fontFamily: '"DejaVu Sans", Verdana, Arial, sans-serif'
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto", display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <a href={`/profile/${encodeURIComponent(d.username)}`} style={{ ...cell, flex: 1, textAlign: "center", color: "#f1e8d3", textDecoration: "none" }}>
            View profile
          </a>
          <a href="/" style={{ ...cell, flex: 1, textAlign: "center", color: "#f1e8d3", textDecoration: "none" }}>
            Back to game
          </a>
        </div>

        {msg && (
          <div style={{ ...cell, textAlign: "center", color: good ? "#7fe08f" : "#f09a8c" }}>{msg}</div>
        )}

        <section>
          <div style={bar}>Profile Status Bar</div>
          <div style={{ ...cell, display: "grid", gap: 8 }}>
            <input
              style={field}
              maxLength={140}
              placeholder="Message (leave empty to clear)"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
            <select style={field} value={mins} onChange={(e) => setMins(Number(e.target.value))}>
              {DURATIONS.map((x) => (
                <option key={x.minutes} value={x.minutes}>
                  {x.label}
                </option>
              ))}
            </select>
            <div style={{ textAlign: "right" }}>
              <button style={{ ...blue, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => save({ action: "status", message: status, minutes: mins })}>
                Post!
              </button>
            </div>
          </div>
        </section>

        <section>
          <div style={bar}>Profile (View)</div>
          <div style={{ ...cell, background: "#4a4a4a", textAlign: "center" }}>Quote</div>
          <div style={{ ...cell, display: "grid", gap: 8 }}>
            <textarea
              style={{ ...field, minHeight: 160, resize: "vertical" }}
              maxLength={2000}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
            />
            <div style={{ fontSize: 12, color: "#c9bfa6" }}>
              You can use [b]bold[/b], [i]italic[/i], [u]underline[/u] and [center]centred[/center].
            </div>
            <div style={{ textAlign: "right" }}>
              <button style={{ ...blue, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => save({ action: "quote", quote })}>
                Update!
              </button>
            </div>
          </div>
        </section>

        <section>
          <div style={bar}>Profile Picture</div>
          <div style={{ ...cell, display: "grid", gap: 8 }}>
            {pic && /^https:\/\//i.test(pic) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pic} alt="Preview" style={{ maxWidth: "100%", maxHeight: 300, margin: "0 auto", display: "block" }} />
            )}
            <input
              style={field}
              inputMode="url"
              placeholder="https://… address of your picture"
              value={pic}
              onChange={(e) => setPic(e.target.value)}
            />
            <div style={{ fontSize: 12, color: "#c9bfa6" }}>
              Paste the web address of a picture hosted elsewhere. Leave empty to remove it.
            </div>
            <div style={{ textAlign: "right" }}>
              <button style={{ ...blue, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => save({ action: "picture", url: pic })}>
                Update!
              </button>
            </div>
          </div>
        </section>

        <section>
          <div style={bar}>Options</div>
          {OPTIONS.map((o) => (
            <label key={o.key} style={{ ...cell, display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                style={{ width: 22, height: 22 }}
                checked={Boolean(d[o.key])}
                onChange={() => flip(o.key)}
              />
              <span>{o.label}</span>
            </label>
          ))}
          <div style={{ ...cell, textAlign: "center" }}>
            <button
              style={{ ...blue, opacity: busy ? 0.6 : 1 }}
              disabled={busy}
              onClick={() =>
                save({
                  action: "options",
                  allowProfileImages: d.allowProfileImages,
                  friendsOnlyImages: d.friendsOnlyImages,
                  showOcStatus: d.showOcStatus,
                  showProfileViews: d.showProfileViews,
                  showOrganization: d.showOrganization
                })
              }
            >
              Change!
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

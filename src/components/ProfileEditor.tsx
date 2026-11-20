"use client";

import { useEffect, useState, type CSSProperties } from "react";
import SiteMenuBar from "@/components/SiteMenuBar";

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
const cell: CSSProperties = { background: "#1f2a25", border: "1px solid #6b5d3a", padding: 8 };
const field: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 8,
  border: "1px solid #a08340",
  borderRadius: 0,
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: 16
};
const blue: CSSProperties = {
  padding: "6px 18px",
  fontSize: 15,
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
        <SiteMenuBar />
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
      <SiteMenuBar />
      <div style={{ maxWidth: 560, margin: "0 auto", display: "grid", gap: 10 }}>
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
              <button className="button" style={{ ...blue, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => save({ action: "status", message: status, minutes: mins })}>
                Post!
              </button>
            </div>
          </div>
        </section>

        <section>
          <a
            href={`/profile/${encodeURIComponent(d.username)}`}
            style={{ ...bar, display: "block", textDecoration: "none", cursor: "pointer" }}
          >
            Profile (View) ›
          </a>
          <div style={{ ...cell, background: "#17201c", textAlign: "center", color: "#d4cab2" }}>Quote</div>
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
              <button className="button" style={{ ...blue, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => save({ action: "quote", quote })}>
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
              <button className="button" style={{ ...blue, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => save({ action: "picture", url: pic })}>
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
              className="button" style={{ ...blue, opacity: busy ? 0.6 : 1 }}
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

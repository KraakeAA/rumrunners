"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export type ForumCategory = "OFFICIAL" | "CLASSIFIEDS" | "OFF_TOPIC" | "SUGGESTIONS" | "CREW";

type Post = {
  id: string;
  body: string;
  createdAt: string;
  author: { username: string };
};

type Topic = {
  id: string;
  authorId: string;
  category: ForumCategory;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
  author: { username: string };
  posts: Post[];
  _count: { posts: number };
};

const PER_PAGE = 15;
const POSTS_PER_PAGE = 20;

// Text sizes, copied from the Bootleggers forum. Change a number here and it
// changes everywhere on the forums.
const SIZE = { bar: 14, row: 11, name: 12, body: 12, small: 10, input: 16 };

const bar: CSSProperties = {
  position: "relative",
  padding: "5px 8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: SIZE.bar,
  lineHeight: 1.25,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  border: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};

const panel: CSSProperties = {
  border: "1px solid #6b5d3a",
  borderTop: 0,
  background: "#1f2a25",
  padding: 6
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
  fontSize: SIZE.input,
  fontFamily: "inherit"
};

// The big white reply box, rounded like Bootleggers.
const whiteBox: CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  minHeight: 100,
  padding: "8px 10px",
  border: 0,
  borderRadius: 8,
  background: "#fff",
  color: "#111",
  fontSize: SIZE.input,
  fontFamily: "inherit",
  resize: "vertical"
};

const blueButton: CSSProperties = {
  padding: "3px 18px",
  border: "2px solid #4aa3ff",
  borderRadius: 14,
  background: "#0a6cf0",
  color: "#fff",
  fontSize: 13,
  fontFamily: "inherit",
  cursor: "pointer"
};

const linkButton: CSSProperties = {
  background: "none",
  border: 0,
  padding: 0,
  color: "#e4c04d",
  textDecoration: "underline",
  fontSize: "inherit",
  fontFamily: "inherit",
  cursor: "pointer"
};

// The forum smileys: yellow faces drawn here, typed into a post as :name:.
const SMILEYS = ["smile", "sad", "shock", "tongue", "unsure", "nerd", "grin", "happy", "cool", "laugh", "up", "down"] as const;
type SmileyName = (typeof SMILEYS)[number];

function Smiley({ name, size = 20 }: { name: SmileyName; size?: number }) {
  const ink = "#4a3200";
  const face = (
    <>
      <circle cx="10" cy="10" r="9" fill="#ffd93b" stroke="#a97c00" strokeWidth="1" />
      <ellipse cx="7" cy="5.2" rx="4" ry="2" fill="#fff6b0" opacity="0.55" />
    </>
  );
  const eyes = (
    <>
      <circle cx="7" cy="8" r="1.2" fill={ink} />
      <circle cx="13" cy="8" r="1.2" fill={ink} />
    </>
  );
  let inner: ReactNode = null;
  if (name === "smile") inner = <>{eyes}<path d="M5.5 12 Q10 16.5 14.5 12" fill="none" stroke={ink} strokeWidth="1.3" strokeLinecap="round" /></>;
  if (name === "sad") inner = <>{eyes}<path d="M6 15 Q10 11 14 15" fill="none" stroke={ink} strokeWidth="1.3" strokeLinecap="round" /></>;
  if (name === "shock")
    inner = (
      <>
        <ellipse cx="7" cy="7.6" rx="1.7" ry="2.1" fill="#fff" stroke={ink} strokeWidth="0.8" />
        <ellipse cx="13" cy="7.6" rx="1.7" ry="2.1" fill="#fff" stroke={ink} strokeWidth="0.8" />
        <circle cx="7" cy="7.8" r="0.8" fill={ink} />
        <circle cx="13" cy="7.8" r="0.8" fill={ink} />
        <ellipse cx="10" cy="14" rx="2" ry="2.6" fill={ink} />
      </>
    );
  if (name === "tongue")
    inner = (
      <>
        {eyes}
        <path d="M5.5 12 Q10 15.5 14.5 12" fill="none" stroke={ink} strokeWidth="1.3" strokeLinecap="round" />
        <path d="M8 13.4 H12 V15.6 Q10 17.8 8 15.6 Z" fill="#e0384f" stroke={ink} strokeWidth="0.6" />
      </>
    );
  if (name === "unsure") inner = <>{eyes}<path d="M6 14 L14 12.6" fill="none" stroke={ink} strokeWidth="1.3" strokeLinecap="round" /></>;
  if (name === "nerd")
    inner = (
      <>
        <circle cx="6.6" cy="8" r="2.6" fill="#fff" stroke={ink} strokeWidth="1" />
        <circle cx="13.4" cy="8" r="2.6" fill="#fff" stroke={ink} strokeWidth="1" />
        <path d="M9.2 8 H10.8" stroke={ink} strokeWidth="1" />
        <circle cx="6.8" cy="8.2" r="0.9" fill={ink} />
        <circle cx="13.2" cy="8.2" r="0.9" fill={ink} />
        <path d="M6 13 Q10 16.5 14 13" fill="none" stroke={ink} strokeWidth="1.2" strokeLinecap="round" />
      </>
    );
  if (name === "grin")
    inner = (
      <>
        {eyes}
        <path d="M4.8 11.2 H15.2 Q14 16.8 10 16.8 Q6 16.8 4.8 11.2 Z" fill="#fff" stroke={ink} strokeWidth="1" strokeLinejoin="round" />
        <path d="M5 13 H15" stroke={ink} strokeWidth="0.6" />
      </>
    );
  if (name === "happy") inner = <>{eyes}<path d="M6.5 12.6 Q10 15 13.5 12.6" fill="none" stroke={ink} strokeWidth="1.2" strokeLinecap="round" /></>;
  if (name === "cool")
    inner = (
      <>
        <path d="M3.6 6.6 H16.4 V8.2 Q16.4 10.4 14.2 10.4 Q12 10.4 11.6 8.2 H8.4 Q8 10.4 5.8 10.4 Q3.6 10.4 3.6 8.2 Z" fill="#1d1d1d" />
        <path d="M5.5 13 Q10 16.8 14.5 13" fill="none" stroke={ink} strokeWidth="1.3" strokeLinecap="round" />
      </>
    );
  if (name === "laugh")
    inner = (
      <>
        <path d="M4.8 8.6 L7 6.8 L9.2 8.6" fill="none" stroke={ink} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.8 8.6 L13 6.8 L15.2 8.6" fill="none" stroke={ink} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 11.4 H15 Q14 17 10 17 Q6 17 5 11.4 Z" fill="#fff" stroke={ink} strokeWidth="1" strokeLinejoin="round" />
      </>
    );
  const thumb = (up: boolean) => (
    <g transform={up ? undefined : "translate(0 20) scale(1 -1)"}>
      <path
        d="M2 10 H5.6 V18 H2 Z M5.6 10.6 L8.4 5.6 Q9.2 2.4 11.2 3.2 Q12.4 4 11.6 6.6 L11 8.4 H16.6 Q18.4 8.6 18 10.6 L17.2 15.6 Q16.8 17.6 15 17.6 H8 Q6.4 17.6 5.6 16.4 Z"
        fill="#f1c48c"
        stroke="#8a5a2a"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </g>
  );
  if (name === "up" || name === "down")
    return (
      <svg viewBox="0 0 20 20" width={size} height={size} aria-label={name === "up" ? "thumbs up" : "thumbs down"} style={{ display: "inline-block", verticalAlign: "-0.3em" }}>
        {thumb(name === "up")}
      </svg>
    );
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-label={name} style={{ display: "inline-block", verticalAlign: "-0.3em" }}>
      {face}
      {inner}
    </svg>
  );
}

// Plain text with :name: swapped for the matching smiley.
function withSmileys(text: string, keyBase: string): ReactNode[] {
  return text.split(/(:(?:smile|sad|shock|tongue|unsure|nerd|grin|happy|cool|laugh|up|down):)/g).map((part, i) => {
    const m = /^:(\w+):$/.exec(part);
    if (m && (SMILEYS as readonly string[]).includes(m[1])) return <Smiley key={`${keyBase}-${i}`} name={m[1] as SmileyName} size={18} />;
    return <span key={`${keyBase}-${i}`}>{part}</span>;
  });
}

const nth = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]}`;
};

// "Nov 20th, 2026 10:41:51 AM", UK time.
const stamp = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/London",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).formatToParts(new Date(value));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("month")} ${nth(Number(g("day")))}, ${g("year")} ${g("hour")}:${g("minute")}:${g("second")} ${g("dayPeriod")}`;
};

// Turns "[Name wrote]\n...text...\n\n" (what the (Q) button adds) into speech bubbles.
function renderBody(text: string) {
  const out: ReactNode[] = [];
  const re = /\[([^\]\n]{1,40}) wrote\]\n([\s\S]*?)(?:\n\n|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(...withSmileys(text.slice(last, m.index), `t${k++}`));
    out.push(
      <div key={k++} style={{ margin: "2px 0 10px" }}>
        <div
          style={{
            padding: "7px 11px",
            borderRadius: 14,
            background: "linear-gradient(180deg, #f2f2f2, #c9c9c9)",
            color: "#1d1d1d",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word"
          }}
        >
          {withSmileys(m[2], `q${k}`)}
        </div>
        <div style={{ textAlign: "right", fontSize: SIZE.row, color: "#cfc6ad", padding: "2px 10px 0" }}>{m[1]} said</div>
      </div>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...withSmileys(text.slice(last), `t${k++}`));
  return out;
}

export default function ForumBoard({
  category,
  title,
  isAdmin,
  playerId,
  leader = false
}: {
  category: ForumCategory;
  title: string;
  isAdmin: boolean;
  playerId: string;
  leader?: boolean;
}) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selected, setSelected] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [postPage, setPostPage] = useState(0);
  const topicRef = useRef<HTMLDivElement>(null);
  const [staff, setStaff] = useState(isAdmin ? 3 : leader ? 1 : 0);

  // Helpers, moderators and admins can pin topics, so find out who this is.
  useEffect(() => {
    fetch("/api/balance", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.staff === "number") setStaff(Math.max(d.staff, isAdmin ? 3 : leader ? 1 : 0));
      })
      .catch(() => {});
  }, [isAdmin, leader]);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/forum?category=${category}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not load the forum.");
      setTopics(d.topics ?? []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the forum.");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  // The forum stays on screen; opening a topic just brings that topic into view.
  const selectedId = selected?.id;
  useEffect(() => {
    if (selectedId) topicRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId]);

  async function openTopic(id: string) {
    setError("");
    try {
      const r = await fetch(`/api/forum/topic/${id}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not open that topic.");
      setSelected(d.topic);
      setPostPage(0);
      setReply("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that topic.");
    }
  }

  async function createTopic() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title: subject, body })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "Could not add the topic.");
        return;
      }
      setSubject("");
      setBody("");
      setShowNew(false);
      setPage(0);
      await loadTopics();
      if (d.topic?.id) await openTopic(d.topic.id);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/forum/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "Could not add the reply.");
        return;
      }
      setReply("");
      await openTopic(selected.id);
      await loadTopics();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function moderate(values: { pinned?: boolean; locked?: boolean }) {
    if (!selected) return;
    setError("");
    try {
      const r = await fetch(`/api/forum/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "That did not work.");
        return;
      }
      setSelected({ ...selected, ...d.topic });
      await loadTopics();
    } catch {
      setError("Unable to connect. Please try again.");
    }
  }

  async function deleteTopic() {
    if (!selected) return;
    if (!window.confirm("Delete this topic and all its replies?")) return;
    setError("");
    try {
      const r = await fetch(`/api/forum/${selected.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "Could not delete the topic.");
        return;
      }
      setSelected(null);
      await loadTopics();
    } catch {
      setError("Unable to connect. Please try again.");
    }
  }

  const quote = (author: string, text: string) => {
    const short = text.length > 300 ? text.slice(0, 300) + "…" : text;
    setReply((cur) => `${cur}${cur ? "\n" : ""}[${author} wrote]\n${short}\n\n`);
  };

  const shown = topics.filter((t) =>
    search ? t.title.toLowerCase().includes(search.toLowerCase()) : true
  );
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const pageNo = Math.min(page, pages - 1);
  const rows = shown.slice(pageNo * PER_PAGE, pageNo * PER_PAGE + PER_PAGE);

  const postCard = (key: string, n: number, author: string, text: string, when: string) => (
    <div key={key} style={{ border: "1px solid #6b5d3a", background: "#1f2a25", marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          padding: "3px 6px",
          fontSize: SIZE.name,
          background: "#2a382f",
          borderBottom: "1px solid #6b5d3a"
        }}
      >
        <span>
          <a href={`/profile/${encodeURIComponent(author)}`} style={{ color: "#f7efdb", fontWeight: 700, textDecoration: "none" }}>
            {author}
          </a>{" "}
          <button
            type="button"
            aria-label={`Quote ${author}`}
            title="Quote"
            onClick={() => quote(author, text)}
            style={{ ...linkButton, textDecoration: "none", color: "#b7ad93" }}
          >
            (Q)
          </button>
        </span>
        <span style={{ fontStyle: "italic", color: "#8f8873" }}>#{n}</span>
      </div>
      <div style={{ padding: "7px 8px", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: SIZE.body, lineHeight: 1.35, color: "#e8dfc8" }}>
        {renderBody(text)}
      </div>
      <div style={{ margin: "0 4px 4px", padding: "5px 8px", textAlign: "right", fontSize: SIZE.small, color: "#9a937d", background: "#17201c" }}>
        {when}
      </div>
    </div>
  );

  // Replies are numbered from #1 and shown newest first, so the first reply is
  // last. The topic itself (its author's opening post) sits above them.
  const thread = selected
    ? selected.posts
        .map((p, i) => ({ id: p.id, n: i + 1, author: p.author.username, text: p.body, at: p.createdAt }))
        .reverse()
    : [];
  const postPages = Math.max(1, Math.ceil(thread.length / POSTS_PER_PAGE));
  const postPageNo = Math.min(postPage, postPages - 1);
  const postRows = thread.slice(postPageNo * POSTS_PER_PAGE, postPageNo * POSTS_PER_PAGE + POSTS_PER_PAGE);

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0, fontSize: SIZE.row }}>
      {error && (
        <p className="notice" style={{ margin: "0 0 6px", color: "#f09a8c" }}>
          {error}
        </p>
      )}

      {/* ---------- ADD REPLY (to the topic that is open) ---------- */}
      {selected && (
        <>
          <div style={bar}>Add reply</div>
          <div style={panel}>
            {selected.locked ? (
              <p style={{ margin: 0, fontSize: SIZE.name, color: "#b7ad93", textAlign: "center" }}>This discussion has been locked.</p>
            ) : (
              <>
                <textarea
                  aria-label="Your reply"
                  rows={5}
                  maxLength={5000}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  style={whiteBox}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", margin: "6px 4px 0" }}>
                  <button
                    type="button"
                    style={{ ...blueButton, opacity: busy || !reply.trim() ? 0.55 : 1 }}
                    disabled={busy || !reply.trim()}
                    onClick={sendReply}
                  >
                    Add!
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 4 }}>
                  {SMILEYS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      aria-label={`Add ${e}`}
                      onClick={() => setReply((cur) => `${cur}:${e}:`)}
                      style={{ ...linkButton, textDecoration: "none", lineHeight: 1, padding: 2 }}
                    >
                      <Smiley name={e} size={22} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ---------- THE TOPIC LIST (always on the page) ---------- */}
      {showNew && (
        <>
          <div style={{ ...bar, marginTop: selected ? 6 : 0 }}>New topic</div>
          <div style={panel}>
            <label style={{ fontSize: SIZE.name, color: "#d4cab2" }}>Subject:</label>
            {category === "CLASSIFIEDS" && (
              <select
                aria-label="Listing type"
                defaultValue=""
                onChange={(e) => {
                  const prefix = e.target.value + ": ";
                  setSubject((cur) =>
                    /^(Buying|Selling|Trading): /.test(cur) ? prefix + cur.replace(/^[A-Za-z]+: /, "") : prefix + cur
                  );
                }}
                style={{ ...field, margin: "4px 0", height: 34 }}
              >
                <option value="" disabled>
                  Listing type (optional)
                </option>
                <option value="Buying">Buying</option>
                <option value="Selling">Selling</option>
                <option value="Trading">Trading</option>
              </select>
            )}
            <input
              aria-label="Subject"
              value={subject}
              maxLength={100}
              onChange={(e) => setSubject(e.target.value)}
              style={{ ...field, height: 34, margin: "4px 0 6px" }}
            />
            <label style={{ fontSize: SIZE.name, color: "#d4cab2" }}>Message:</label>
            <textarea
              aria-label="Message"
              rows={6}
              maxLength={5000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ ...whiteBox, margin: "4px 0 6px" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
              <button type="button" className="button secondary" style={{ padding: "3px 14px", fontSize: 13, borderRadius: 14 }} onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button
                type="button"
                style={{ ...blueButton, opacity: busy || subject.trim().length < 3 || body.trim().length < 3 ? 0.55 : 1 }}
                disabled={busy || subject.trim().length < 3 || body.trim().length < 3}
                onClick={createTopic}
              >
                Add!
              </button>
            </div>
          </div>
        </>
      )}

      <div style={{ ...bar, marginTop: showNew || selected ? 6 : 0 }}>
        {title}
        {(category !== "OFFICIAL" || staff >= 1) && (
          <>
            {" "}(
            <button type="button" onClick={() => setShowNew((v) => !v)} style={{ ...linkButton, color: "#f7efdb" }}>
              {showNew ? "Cancel" : "Add topic"}
            </button>
            )
          </>
        )}
        <button
          type="button"
          aria-label="Refresh"
          onClick={loadTopics}
          style={{ ...linkButton, position: "absolute", right: 10, top: 4, fontSize: 18, color: "#f7efdb", textDecoration: "none" }}
        >
          ⟳
        </button>
      </div>

      <div style={{ border: "1px solid #6b5d3a", borderTop: 0, background: "#1f2a25", padding: "3px 3px 0" }}>
        {loading ? (
          <p style={{ margin: 0, padding: 10, fontSize: SIZE.row, color: "#b7ad93", textAlign: "center" }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ margin: 0, padding: 10, fontSize: SIZE.row, color: "#b7ad93", textAlign: "center" }}>
            {search ? "Nothing matches that search." : "No topics yet. Be the first to start one."}
          </p>
        ) : (
          rows.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => openTopic(t.id)}
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "5px 6px",
                margin: 0,
                border: 0,
                background: selected?.id === t.id ? "#5a4444" : i % 2 === 0 ? "#2a382f" : "#222e27",
                color: "#f1e8d3",
                fontSize: SIZE.row,
                fontFamily: "inherit",
                lineHeight: 1.25,
                textAlign: "left",
                cursor: "pointer"
              }}
            >
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.pinned ? "★ " : ""}
                {t.title}
                {t.locked ? " 🔒" : ""}
              </span>
              <span style={{ flexShrink: 0, color: "#cfc6ad" }}>{t._count.posts}</span>
            </button>
          ))
        )}

        <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 22px 14px", fontSize: SIZE.name, minHeight: 20 }}>
          <span>
            {pageNo > 0 && (
              <button type="button" onClick={() => setPage(pageNo - 1)} style={{ ...linkButton, textDecoration: "none", color: "#f7efdb" }}>
                Prev
              </button>
            )}
          </span>
          <span>
            {pageNo < pages - 1 && (
              <button type="button" onClick={() => setPage(pageNo + 1)} style={{ ...linkButton, textDecoration: "none", color: "#f7efdb" }}>
                Next
              </button>
            )}
          </span>
        </div>
      </div>

      {/* ---------- THE OPEN TOPIC, BELOW THE LIST ---------- */}
      {selected && (
        <div ref={topicRef} style={{ marginTop: 10, scrollMarginTop: 8 }}>
          <div style={{ ...bar, textAlign: "left", paddingLeft: 6 }}>
            <strong>
              {selected.pinned ? "★ " : ""}
              {selected.title}
              {selected.locked ? " 🔒" : ""}
            </strong>{" "}
            -{" "}
            <a href={`/profile/${encodeURIComponent(selected.author.username)}`} style={{ color: "#f7efdb", textDecoration: "none" }}>
              {selected.author.username}
            </a>{" "}
            <button
              type="button"
              aria-label={`Quote ${selected.author.username}`}
              title="Quote"
              onClick={() => quote(selected.author.username, selected.body)}
              style={{ ...linkButton, textDecoration: "none", color: "#cfc6ad" }}
            >
              (Q)
            </button>
          </div>
          <div style={{ border: "1px solid #6b5d3a", borderTop: 0, background: "#1f2a25", marginBottom: 8 }}>
            <div style={{ padding: "7px 8px", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: SIZE.body, lineHeight: 1.35, color: "#e8dfc8" }}>
              {renderBody(selected.body)}
            </div>
            <div style={{ margin: "0 4px 4px", padding: "5px 8px", textAlign: "right", fontSize: SIZE.small, color: "#9a937d", background: "#17201c" }}>
              {stamp(selected.createdAt)}
            </div>
          </div>

          {(staff >= 1 || isAdmin || leader || selected.authorId === playerId) && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 0 8px" }}>
              {(staff >= 1 || isAdmin) && (
                <button className="button secondary" style={{ padding: "4px 10px", fontSize: SIZE.name }} onClick={() => moderate({ pinned: !selected.pinned })}>
                  {selected.pinned ? "Unpin" : "Pin"}
                </button>
              )}
              <button className="button secondary" style={{ padding: "4px 10px", fontSize: SIZE.name }} onClick={() => moderate({ locked: !selected.locked })}>
                {selected.locked ? "Unlock" : "Lock"}
              </button>
              {(isAdmin || leader || selected.authorId === playerId) && (
                <button className="button secondary" style={{ padding: "4px 10px", fontSize: SIZE.name }} onClick={deleteTopic}>
                  Delete topic
                </button>
              )}
            </div>
          )}

          {postRows.map((p) => postCard(p.id, p.n, p.author, p.text, stamp(p.at)))}

          {postPages > 1 && (
            <div style={{ textAlign: "center", fontSize: SIZE.name, color: "#d4cab2", padding: "4px 0 8px" }}>
              Page
              <br />
              <select
                aria-label="Page"
                value={postPageNo}
                onChange={(e) => setPostPage(Number(e.target.value))}
                style={{ ...field, display: "inline-block", width: "auto", padding: "2px 8px", marginTop: 3 }}
              >
                {Array.from({ length: postPages }, (_, i) => (
                  <option key={i} value={i}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div style={{ ...bar, marginTop: 6 }}>Search</div>
      <div style={{ ...panel, display: "flex", gap: 6, alignItems: "center" }}>
        <input
          aria-label="Search topics"
          placeholder="Search for…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSearch(query.trim());
              setPage(0);
            }
          }}
          style={{ ...field, flex: 1, minWidth: 0, height: 32, borderRadius: 8 }}
        />
        <button
          type="button"
          style={{ ...blueButton, padding: "3px 14px", flexShrink: 0 }}
          onClick={() => {
            setSearch(query.trim());
            setPage(0);
          }}
        >
          Search!
        </button>
      </div>
    </div>
  );
}
